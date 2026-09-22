// Canonical copy: lives under supabase/functions/ so the Supabase Edge
// Function bundler (which only includes files inside supabase/functions/)
// can resolve it. src/lib/parsing/htmlExtract.ts re-exports from here for
// the frontend/tests. See that file's comment for details.
import { sanitizeText } from './textUtils.ts'

/**
 * Regex-based (no DOM APIs) HTML extraction helpers. Deliberately
 * dependency-free so the exact same code runs in the browser, in Vitest,
 * and in the parse-job Supabase Edge Function (Deno has no DOMParser /
 * jsdom by default and we don't want an extra runtime dependency there).
 */

export interface StructuredFields {
  company: string | null
  role: string | null
  jd: string | null
  location: string | null
  datePosted: string | null
}

function emptyFields(): StructuredFields {
  return { company: null, role: null, jd: null, location: null, datePosted: null }
}

// ---------------------------------------------------------------------------
// JSON-LD JobPosting
// ---------------------------------------------------------------------------

function findJsonLdBlocks(html: string): string[] {
  const blocks: string[] = []
  const re = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
  let match: RegExpExecArray | null
  while ((match = re.exec(html))) {
    blocks.push(match[1])
  }
  return blocks
}

function flattenJsonLdGraph(node: unknown): unknown[] {
  if (node && typeof node === 'object' && '@graph' in (node as Record<string, unknown>)) {
    const graph = (node as Record<string, unknown>)['@graph']
    if (Array.isArray(graph)) return graph
  }
  return [node]
}

function isJobPostingNode(node: unknown): boolean {
  if (!node || typeof node !== 'object') return false
  const type = (node as Record<string, unknown>)['@type']
  if (typeof type === 'string') return type === 'JobPosting'
  if (Array.isArray(type)) return type.includes('JobPosting')
  return false
}

function formatJsonLdLocation(jobLocation: unknown): string | null {
  const locations = Array.isArray(jobLocation) ? jobLocation : [jobLocation]
  for (const loc of locations) {
    if (!loc || typeof loc !== 'object') continue
    const address = (loc as Record<string, unknown>).address
    if (address && typeof address === 'object') {
      const a = address as Record<string, unknown>
      const parts = [a.addressLocality, a.addressRegion, a.addressCountry]
        .filter((v): v is string => typeof v === 'string' && v.trim().length > 0)
      if (parts.length > 0) return parts.join(', ')
    }
  }
  return null
}

/** Extracts JobPosting fields from JSON-LD `<script type="application/ld+json">` blocks. */
export function extractFromJsonLd(html: string): StructuredFields {
  const result = emptyFields()
  for (const block of findJsonLdBlocks(html)) {
    let parsed: unknown
    try {
      parsed = JSON.parse(block.trim())
    } catch {
      continue
    }
    const candidates = Array.isArray(parsed) ? parsed : [parsed]
    for (const candidate of candidates) {
      for (const node of flattenJsonLdGraph(candidate)) {
        if (!isJobPostingNode(node)) continue
        const obj = node as Record<string, unknown>
        const hiringOrg = obj.hiringOrganization
        const company =
          hiringOrg && typeof hiringOrg === 'object'
            ? String((hiringOrg as Record<string, unknown>).name ?? '')
            : typeof hiringOrg === 'string'
              ? hiringOrg
              : undefined
        result.company = result.company ?? sanitizeText(company)
        result.role = result.role ?? sanitizeText(typeof obj.title === 'string' ? obj.title : undefined)
        result.jd = result.jd ?? sanitizeText(typeof obj.description === 'string' ? obj.description : undefined)
        result.location = result.location ?? formatJsonLdLocation(obj.jobLocation)
        result.datePosted =
          result.datePosted ?? (typeof obj.datePosted === 'string' ? normalizeDate(obj.datePosted) : null)
      }
    }
  }
  return result
}

// ---------------------------------------------------------------------------
// Embedded JSON application state (Next.js __NEXT_DATA__, window.__*_STATE__)
// ---------------------------------------------------------------------------

const JOB_TITLE_KEYS = ['title', 'jobTitle', 'job_title', 'postingTitle']
const JOB_DESC_KEYS = ['description', 'jobDescription', 'job_description', 'body', 'descriptionHtml']
const JOB_COMPANY_KEYS = ['company', 'companyName', 'company_name', 'organizationName']
const JOB_LOCATION_KEYS = ['location', 'jobLocation', 'locationName', 'city']

function firstStringValue(obj: Record<string, unknown>, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = obj[key]
    if (typeof value === 'string' && value.trim()) return value
    if (value && typeof value === 'object' && 'name' in (value as Record<string, unknown>)) {
      const name = (value as Record<string, unknown>).name
      if (typeof name === 'string' && name.trim()) return name
    }
  }
  return undefined
}

/** Depth-limited search through a parsed JSON blob for an object that looks like a job posting. */
function findJobLikeNode(node: unknown, depth = 0): Record<string, unknown> | null {
  if (depth > 6 || !node || typeof node !== 'object') return null
  if (Array.isArray(node)) {
    for (const item of node) {
      const found = findJobLikeNode(item, depth + 1)
      if (found) return found
    }
    return null
  }
  const obj = node as Record<string, unknown>
  const hasTitle = JOB_TITLE_KEYS.some((k) => typeof obj[k] === 'string' && (obj[k] as string).trim())
  const hasDesc = JOB_DESC_KEYS.some((k) => typeof obj[k] === 'string' && (obj[k] as string).length > 40)
  if (hasTitle && hasDesc) return obj
  for (const value of Object.values(obj)) {
    const found = findJobLikeNode(value, depth + 1)
    if (found) return found
  }
  return null
}

function extractBalancedJson(source: string, startIndex: number): string | null {
  let depth = 0
  let inString = false
  let stringChar = ''
  let escaped = false
  for (let i = startIndex; i < source.length; i++) {
    const ch = source[i]
    if (inString) {
      if (escaped) {
        escaped = false
      } else if (ch === '\\') {
        escaped = true
      } else if (ch === stringChar) {
        inString = false
      }
      continue
    }
    if (ch === '"' || ch === "'") {
      inString = true
      stringChar = ch
      continue
    }
    if (ch === '{') depth++
    if (ch === '}') {
      depth--
      if (depth === 0) return source.slice(startIndex, i + 1)
    }
  }
  return null
}

/** Best-effort scan for embedded JSON application state (Next.js data blobs, window.__STATE__ assignments). */
export function extractFromEmbeddedJson(html: string): StructuredFields {
  const result = emptyFields()
  const candidates: string[] = []

  const nextDataMatch = html.match(
    /<script[^>]+id=["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/i,
  )
  if (nextDataMatch) candidates.push(nextDataMatch[1])

  const assignmentRe = /window\.__[A-Z0-9_]+__?\s*=\s*(\{)/g
  let match: RegExpExecArray | null
  while ((match = assignmentRe.exec(html))) {
    const jsonText = extractBalancedJson(html, match.index + match[0].length - 1)
    if (jsonText) candidates.push(jsonText)
  }

  for (const candidate of candidates) {
    let parsed: unknown
    try {
      parsed = JSON.parse(candidate)
    } catch {
      continue
    }
    const jobNode = findJobLikeNode(parsed)
    if (!jobNode) continue
    result.role = result.role ?? sanitizeText(firstStringValue(jobNode, JOB_TITLE_KEYS))
    result.jd = result.jd ?? sanitizeText(firstStringValue(jobNode, JOB_DESC_KEYS))
    result.company = result.company ?? sanitizeText(firstStringValue(jobNode, JOB_COMPANY_KEYS))
    result.location = result.location ?? sanitizeText(firstStringValue(jobNode, JOB_LOCATION_KEYS))
    if (result.role || result.jd) break
  }

  return result
}

// ---------------------------------------------------------------------------
// OpenGraph / standard meta tags
// ---------------------------------------------------------------------------

function getMetaContent(html: string, attr: 'property' | 'name', key: string): string | undefined {
  const re = new RegExp(
    `<meta[^>]+${attr}=["']${key}["'][^>]*content=["']([^"']*)["']`,
    'i',
  )
  const altRe = new RegExp(
    `<meta[^>]+content=["']([^"']*)["'][^>]*${attr}=["']${key}["']`,
    'i',
  )
  return html.match(re)?.[1] ?? html.match(altRe)?.[1]
}

export function extractFromOpenGraph(html: string): StructuredFields {
  const result = emptyFields()
  result.role = sanitizeText(getMetaContent(html, 'property', 'og:title'))
  result.jd = sanitizeText(getMetaContent(html, 'property', 'og:description'))
  result.company = sanitizeText(getMetaContent(html, 'property', 'og:site_name'))
  return result
}

export function extractFromStandardMeta(html: string): StructuredFields {
  // Deliberately does NOT read <title> for `role` - the page title is a
  // last-resort signal handled by the semantic-fallback layer (below h1),
  // so a page's raw <title> text (often "<Role> at <Company>") never
  // out-ranks a proper <h1> heading.
  const result = emptyFields()
  const description = getMetaContent(html, 'name', 'description')
  result.jd = sanitizeText(description)
  return result
}

// ---------------------------------------------------------------------------
// Semantic HTML fallback: headings, labeled description/location containers
// ---------------------------------------------------------------------------

function extractByClassOrId(html: string, needle: RegExp): string | undefined {
  const tagRe = new RegExp(
    `<(div|section|span|p)[^>]*(?:class|id)=["'][^"']*(?:${needle.source})[^"']*["'][^>]*>([\\s\\S]*?)<\\/\\1>`,
    'i',
  )
  return html.match(tagRe)?.[2]
}

export function extractFromSemanticFallback(html: string): StructuredFields {
  const result = emptyFields()

  const h1Match = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)
  result.role = sanitizeText(h1Match?.[1] ?? titleMatch?.[1])

  const descriptionContainer = extractByClassOrId(html, /job[-_ ]?description|posting[-_ ]?description|description/i)
  if (descriptionContainer) {
    result.jd = sanitizeText(descriptionContainer)
  } else {
    const paragraphs = Array.from(html.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi))
    const longEnough = paragraphs
      .map((m) => sanitizeText(m[1]))
      .find((text) => text && text.length > 80)
    result.jd = longEnough ?? null
  }

  const locationContainer = extractByClassOrId(html, /job[-_ ]?location|posting[-_ ]?location|location/i)
  result.location = sanitizeText(locationContainer)

  return result
}

function normalizeDate(value: string): string | null {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return date.toISOString().slice(0, 10)
}

// ---------------------------------------------------------------------------
// Provider-specific hints
// ---------------------------------------------------------------------------

export type Provider =
  | 'greenhouse'
  | 'lever'
  | 'workday'
  | 'ashby'
  | 'smartrecruiters'
  | 'icims'
  | 'jobvite'
  | 'phenom'
  | 'generic'

const PROVIDER_HOSTNAME_PATTERNS: Array<[RegExp, Provider]> = [
  [/(^|\.)greenhouse\.io$/i, 'greenhouse'],
  [/(^|\.)lever\.co$/i, 'lever'],
  [/myworkdayjobs\.com$/i, 'workday'],
  [/(^|\.)ashbyhq\.com$/i, 'ashby'],
  [/(^|\.)smartrecruiters\.com$/i, 'smartrecruiters'],
  [/(^|\.)icims\.com$/i, 'icims'],
  [/(^|\.)jobvite\.com$/i, 'jobvite'],
  [/(^|\.)phenompeople\.com$/i, 'phenom'],
]

export function detectProvider(hostname: string): Provider {
  for (const [pattern, provider] of PROVIDER_HOSTNAME_PATTERNS) {
    if (pattern.test(hostname)) return provider
  }
  return 'generic'
}

/** A small set of provider-specific DOM conventions, used as an extra precision pass before the generic layers. */
export function extractProviderSpecific(html: string, provider: Provider): StructuredFields {
  const result = emptyFields()
  switch (provider) {
    case 'greenhouse': {
      const title = html.match(/<h1[^>]+class=["'][^"']*app-title[^"']*["'][^>]*>([\s\S]*?)<\/h1>/i)
      const company = html.match(/<span[^>]+class=["'][^"']*company-name[^"']*["'][^>]*>([\s\S]*?)<\/span>/i)
      const content = html.match(/<div[^>]+id=["']content["'][^>]*>([\s\S]*?)<\/div>/i)
      result.role = sanitizeText(title?.[1])
      result.company = sanitizeText(company?.[1])
      result.jd = sanitizeText(content?.[1])
      return result
    }
    case 'lever': {
      const title = html.match(/<h2[^>]+class=["'][^"']*posting-headline[^"']*["'][^>]*>([\s\S]*?)<\/h2>/i)
      const location = html.match(/<div[^>]+class=["'][^"']*posting-categories[^"']*["'][^>]*>([\s\S]*?)<\/div>/i)
      result.role = sanitizeText(title?.[1])
      result.location = sanitizeText(location?.[1])
      return result
    }
    default:
      return result
  }
}
