/** True if `value` parses as an absolute http(s) URL. */
export function isValidHttpUrl(value: string): boolean {
  if (!value.trim()) return false
  try {
    const url = new URL(value.trim())
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

/** Returns the hostname of a URL, or the original string if it can't be parsed. */
export function shortenUrl(value: string | null | undefined): string {
  if (!value) return ''
  try {
    const url = new URL(value)
    return url.hostname.replace(/^www\./, '')
  } catch {
    return value
  }
}

/** Formats an ISO date (YYYY-MM-DD) or timestamp for display; empty string on missing/invalid input. */
export function formatDate(value: string | null | undefined): string {
  if (!value) return ''
  const date = new Date(value.length === 10 ? `${value}T00:00:00` : value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
}

/** Today's date as YYYY-MM-DD in the local timezone. */
export function todayIso(): string {
  const now = new Date()
  const offset = now.getTimezoneOffset()
  const local = new Date(now.getTime() - offset * 60 * 1000)
  return local.toISOString().slice(0, 10)
}

export function classNames(...values: Array<string | false | null | undefined>): string {
  return values.filter(Boolean).join(' ')
}

/** Strips HTML tags and collapses whitespace from extracted text content. */
export function sanitizeText(value: string | null | undefined, maxLength = 20000): string | null {
  if (!value) return null
  const withoutTags = value.replace(/<[^>]*>/g, ' ')
  const decoded = decodeHtmlEntities(withoutTags)
  const collapsed = decoded.replace(/[ \t\f\v]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim()
  if (!collapsed) return null
  return collapsed.slice(0, maxLength)
}

function decodeHtmlEntities(value: string): string {
  const entities: Record<string, string> = {
    '&amp;': '&',
    '&lt;': '<',
    '&gt;': '>',
    '&quot;': '"',
    '&#39;': "'",
    '&apos;': "'",
    '&nbsp;': ' ',
  }
  return value
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCharCode(Number(code)))
    .replace(/&(amp|lt|gt|quot|#39|apos|nbsp);/g, (m) => entities[m] ?? m)
}
