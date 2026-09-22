// Conservative, text-based sponsorship classification from a job
// description. Pure/dependency-free so it runs identically in the browser,
// in Vitest, and in the parse-job Supabase Edge Function (Deno). This file
// is the canonical implementation - it lives under supabase/functions/
// because Supabase's Edge Function bundler only includes files inside
// supabase/functions/, and src/lib/parsing/sponsorship.ts re-exports from
// here (see that file's comment) so frontend tests keep working unchanged.
//
// Rules (per product spec):
// - "No" only for explicit no-sponsorship language.
// - "Yes" only for explicit positive language.
// - "Unknown" when sponsorship is absent, ambiguous, contradictory, or the
//   input is missing. Never infer "Yes" merely because no restriction was
//   found - absence of a negative is not a positive.

/** Local to the parsing layer so this module has zero external imports (see file header). Structurally identical to src/lib/constants.ts's Sponsorship type. */
export type Sponsorship = 'Yes' | 'No' | 'Unknown'

const NEGATIVE_PATTERNS: RegExp[] = [
  /unable to (provide |offer |take over )?sponsor/,
  /will not (provide |offer )?sponsor/,
  /does not (provide |offer )?sponsor/,
  /is not able to sponsor/,
  /are not able to sponsor/,
  /can ?not sponsor/,
  /no longer (able to )?sponsor/,
  /not sponsor(ing)?\b/,
  /no (visa )?sponsorship/,
  /without sponsorship/,
  /not eligible for sponsorship/,
  /sponsorship (is|are) not (available|provided|offered)/,
  /do not (offer|provide) (visa )?sponsorship/,
  /does not (offer|provide) (visa )?sponsorship/,
]

const POSITIVE_PATTERNS: RegExp[] = [
  /sponsorship (is |are )?available/,
  /\bwe (do |can )?sponsor\b/,
  /\bwill sponsor\b/,
  /sponsorship (is |are )?provided/,
  /sponsorship (is |are )?offered/,
  /\bable to sponsor\b/,
  /open to sponsoring/,
]

function normalize(text: string): string {
  return text.replace(/\s+/g, ' ').trim().toLowerCase()
}

export function classifySponsorship(text: string | null | undefined): Sponsorship {
  if (!text || !text.trim()) return 'Unknown'
  let remaining = normalize(text)

  // Redact every negative-pattern match before testing the positive
  // patterns, so a phrase like "no visa sponsorship available" - a clearly
  // negative statement that happens to contain the word "available" - is
  // never miscounted as a contradictory positive signal.
  let hasNegative = false
  for (const pattern of NEGATIVE_PATTERNS) {
    const globalPattern = new RegExp(pattern.source, 'g')
    if (pattern.test(remaining)) hasNegative = true
    remaining = remaining.replace(globalPattern, ' ')
  }

  const hasPositive = POSITIVE_PATTERNS.some((pattern) => pattern.test(remaining))

  if (hasNegative && hasPositive) return 'Unknown'
  if (hasNegative) return 'No'
  if (hasPositive) return 'Yes'
  return 'Unknown'
}
