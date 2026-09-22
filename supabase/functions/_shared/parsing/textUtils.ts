// Self-contained text-cleanup helpers used by the parsing layer. Kept
// dependency-free (no imports) so this whole directory can be bundled
// standalone by the Supabase Edge Function deployer, which only includes
// files inside supabase/functions/ - it cannot reach files under src/.

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
