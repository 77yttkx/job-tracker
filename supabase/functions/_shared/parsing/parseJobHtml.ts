// Canonical copy: lives under supabase/functions/ so the Supabase Edge
// Function bundler (which only includes files inside supabase/functions/)
// can resolve it and its siblings (sponsorship.ts, htmlExtract.ts).
// src/lib/parsing/parseJobHtml.ts re-exports from here for the
// frontend/tests, so this is the single source of truth.
import { classifySponsorship } from './sponsorship.ts'
import type { Sponsorship } from './sponsorship.ts'
import {
  detectProvider,
  extractFromEmbeddedJson,
  extractFromJsonLd,
  extractFromOpenGraph,
  extractFromSemanticFallback,
  extractFromStandardMeta,
  extractProviderSpecific,
} from './htmlExtract.ts'
import type { StructuredFields, Provider } from './htmlExtract.ts'

export interface ParseJobHtmlResult {
  company: string | null
  role: string | null
  jd: string | null
  applied_date: string | null
  location: string | null
  sponsorship: Sponsorship
  source: string
  warnings: string[]
}

interface Layer {
  name: string
  fields: StructuredFields
}

function mergeLayers(layers: Layer[]): { fields: StructuredFields; filledBy: Record<string, string> } {
  const fields: StructuredFields = { company: null, role: null, jd: null, location: null, datePosted: null }
  const filledBy: Record<string, string> = {}
  for (const layer of layers) {
    for (const key of Object.keys(fields) as Array<keyof StructuredFields>) {
      if (!fields[key] && layer.fields[key]) {
        fields[key] = layer.fields[key]
        filledBy[key] = layer.name
      }
    }
  }
  return { fields, filledBy }
}

/**
 * Runs the full layered extraction strategy against raw HTML for a job
 * posting page: provider-specific hints, then structured data (JSON-LD,
 * embedded JSON app state, OpenGraph/meta), then a semantic HTML fallback.
 * Pure function - no fetch, no DOM APIs - safe to unit test with fixture
 * HTML and safe to run in the Deno parse-job Edge Function.
 */
export function parseJobHtml(html: string, hostname: string): ParseJobHtmlResult {
  const provider: Provider = detectProvider(hostname)
  const warnings: string[] = []

  const layers: Layer[] = [
    { name: `provider:${provider}`, fields: extractProviderSpecific(html, provider) },
    { name: 'json-ld', fields: extractFromJsonLd(html) },
    { name: 'embedded-json', fields: extractFromEmbeddedJson(html) },
    { name: 'opengraph', fields: extractFromOpenGraph(html) },
    { name: 'standard-meta', fields: extractFromStandardMeta(html) },
    { name: 'semantic-fallback', fields: extractFromSemanticFallback(html) },
  ]

  const { fields, filledBy } = mergeLayers(layers)

  const missing: string[] = []
  if (!fields.company) missing.push('company')
  if (!fields.role) missing.push('role')
  if (!fields.jd) missing.push('description')
  if (!fields.location) missing.push('location')
  if (missing.length > 0) {
    warnings.push(`Could not extract: ${missing.join(', ')}. Enter these fields manually.`)
  }

  const sponsorship = classifySponsorship(fields.jd)
  if (sponsorship === 'Unknown' && fields.jd) {
    warnings.push('Sponsorship could not be determined from the description - defaulted to Unknown.')
  }

  const usedLayers = new Set(Object.values(filledBy))
  const source = usedLayers.size > 0 ? Array.from(usedLayers).join('+') : 'none'

  return {
    company: fields.company,
    role: fields.role,
    jd: fields.jd,
    applied_date: fields.datePosted,
    location: fields.location,
    sponsorship,
    source,
    warnings,
  }
}
