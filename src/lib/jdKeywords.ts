/**
 * Deterministic, local keyword/synonym matching for "Prepare for a Job"
 * (V3.2 spec section 4B) - no model or API call of any kind. Given a job
 * description's plain text, `detectCompetencies` returns the subset of
 * BQ-relevant competencies whose keyword list has at least one
 * case-insensitive substring match in that text, each with the specific
 * matched phrase(s) so the UI can be transparent about why a competency
 * was suggested ("JD keyword match", never "AI analysis" - see
 * PrepareForJobPage.tsx).
 *
 * The seven competency labels below are exactly the ones ANSWER_TAGS
 * already uses for Leadership/Teamwork/Ownership/Communication/
 * Adaptability/Time Management, and "Problem Solving" for the spec's
 * "Data Analysis / Problem Solving" - so a detected competency chip and a
 * saved answer's tag are the same string, and recommendAnswersForTags
 * (bqRecommendations.ts) can match them with plain equality, no separate
 * mapping table.
 *
 * This module is intentionally the ONLY place the synonym list lives
 * (spec: "Put the synonym/keyword mapping in a centralized, testable
 * constant/module") - PrepareForJobPage.tsx never inlines its own
 * keyword strings.
 */

export type Competency =
  | 'Teamwork'
  | 'Ownership'
  | 'Problem Solving'
  | 'Communication'
  | 'Adaptability'
  | 'Leadership'
  | 'Time Management'

/** Display label shown next to a competency chip, spelling out the spec's "X / Y" naming without changing the underlying tag string used for matching. */
export const COMPETENCY_DISPLAY_LABELS: Record<Competency, string> = {
  Teamwork: 'Collaboration / Teamwork',
  Ownership: 'Ownership',
  'Problem Solving': 'Data Analysis / Problem Solving',
  Communication: 'Communication',
  Adaptability: 'Ambiguity / Adaptability',
  Leadership: 'Leadership',
  'Time Management': 'Time Management / Prioritization',
}

/**
 * Keyword/synonym phrases for each competency, matched as plain
 * case-insensitive substrings of the JD text (no stemming/NLP library -
 * each phrase already covers its own common word-forms, e.g. both
 * "collaborate" and "collaboration" via the shared "collaborat" stem).
 * Order within a list doesn't matter; order of the record does not
 * affect ranking (detectCompetencies returns competencies in this
 * object's key order, which is stable and matches the spec's own list
 * order).
 */
export const COMPETENCY_KEYWORDS: Record<Competency, readonly string[]> = {
  Teamwork: [
    'team',
    'teamwork',
    'collaborat',
    'cross-functional',
    'cross functional',
    'partner closely',
    'partner with',
    'work closely with',
  ],
  Ownership: [
    'ownership',
    'own the',
    'accountab',
    'end-to-end',
    'end to end',
    'self-starter',
    'self starter',
    'drive results',
    'take initiative',
    'autonomously',
  ],
  'Problem Solving': [
    'problem solving',
    'problem-solving',
    'analytical',
    'data analysis',
    'data-driven',
    'data driven',
    'troubleshoot',
    'root cause',
    'debug',
    'critical thinking',
  ],
  Communication: [
    'communication',
    'communicate',
    'present to',
    'presentation',
    'stakeholder',
    'written and verbal',
    'verbal and written',
    'articulate',
  ],
  Adaptability: [
    'ambiguity',
    'ambiguous',
    'adapt',
    'fast-paced',
    'fast paced',
    'changing priorities',
    'flexible',
    'flexibility',
    'evolving',
  ],
  Leadership: [
    'leadership',
    'lead a team',
    'lead cross-functional',
    'leading a',
    'mentor',
    'manage a team',
    'people management',
  ],
  'Time Management': [
    'deadline',
    'prioriti',
    'multiple projects',
    'time management',
    'competing priorities',
    'fast turnaround',
    'juggle multiple',
  ],
}

export interface DetectedCompetency {
  competency: Competency
  /** The specific keyword phrase(s) from COMPETENCY_KEYWORDS that matched, in the order checked - shown to the user so the match is verifiable ("matched: 'cross-functional'"), never asserted without one. */
  matchedKeywords: string[]
}

/**
 * Scans `jdText` for every competency whose keyword list has at least one
 * substring match, case-insensitively. Never returns a competency without
 * at least one real matched keyword recorded (spec: "Do not claim a
 * keyword was found unless the JD text contains a matching keyword or
 * documented synonym"). Returns an empty array for empty/whitespace-only
 * text.
 */
export function detectCompetencies(jdText: string | null | undefined): DetectedCompetency[] {
  const haystack = (jdText ?? '').toLowerCase()
  if (!haystack.trim()) return []

  const results: DetectedCompetency[] = []
  for (const competency of Object.keys(COMPETENCY_KEYWORDS) as Competency[]) {
    const matchedKeywords = COMPETENCY_KEYWORDS[competency].filter((keyword) =>
      haystack.includes(keyword.toLowerCase()),
    )
    if (matchedKeywords.length > 0) {
      results.push({ competency, matchedKeywords })
    }
  }
  return results
}

/** All competency labels, for offering the ones NOT auto-detected as manually-addable options (spec: "the user can... manually add another relevant competency"). */
export const ALL_COMPETENCIES = Object.keys(COMPETENCY_KEYWORDS) as Competency[]
