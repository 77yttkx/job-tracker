import type { BehaviorAnswer } from '../types/interviewPrep'

/**
 * Search + tag filtering for Answer Library
 * (src/pages/interviewPrep/AnswerLibraryPage.tsx). Kept separate from the
 * page for direct unit-testability, mirroring src/lib/insightsFilters.ts's
 * applyJobFilters for the Table page.
 */

/** True if `answer`'s question, answer text, or notes contains `term`, case-insensitively (V3.2 spec section 3: "Search across question, answer, and notes"). An empty term always matches. */
export function matchesAnswerSearch(
  answer: Pick<BehaviorAnswer, 'interview_question' | 'star_answer' | 'notes'>,
  term: string,
): boolean {
  if (!term.trim()) return true
  const haystack = `${answer.interview_question} ${answer.star_answer} ${answer.notes}`.toLowerCase()
  return haystack.includes(term.trim().toLowerCase())
}

/** True if `answer` carries every one of `activeTags` (AND across selected tag filters, matched case-insensitively) - an empty `activeTags` set always matches. */
export function matchesAnswerTags(answer: Pick<BehaviorAnswer, 'tags'>, activeTags: Set<string>): boolean {
  if (activeTags.size === 0) return true
  const answerTagsLower = new Set(answer.tags.map((t) => t.toLowerCase()))
  for (const tag of activeTags) {
    if (!answerTagsLower.has(tag.toLowerCase())) return false
  }
  return true
}

/** Applies search AND tag filtering together, in that order - the combination used by Answer Library. */
export function filterAnswers<T extends Pick<BehaviorAnswer, 'interview_question' | 'star_answer' | 'notes' | 'tags'>>(
  answers: T[],
  search: string,
  activeTags: Set<string>,
): T[] {
  return answers.filter((answer) => matchesAnswerSearch(answer, search) && matchesAnswerTags(answer, activeTags))
}
