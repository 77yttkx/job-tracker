import type { BehaviorAnswer } from '../types/interviewPrep'

/**
 * Builds a `prompt_key -> most-recently-updated answer` map (V3.2 spec
 * section 2: "Do not duplicate the same answer unintentionally when a
 * user reopens a prompt"). Pulled out of BQQuestionsPage.tsx as a pure
 * function so the dedupe/lookup behavior is directly unit-testable,
 * consistent with this codebase's convention of separating logic from
 * JSX (see answerFilters.ts, answerValidation.ts, dateField.ts).
 *
 * Answers with a null/undefined prompt_key (every manually-created
 * answer, and every legacy generated answer) are excluded entirely - they
 * never count as "answering" a guided prompt, so a user's own
 * custom-worded answer to a similar topic never gets silently treated as
 * a duplicate or hides the guided prompt as unanswered.
 */
export function buildAnswerByPromptKey(answers: readonly BehaviorAnswer[]): Map<string, BehaviorAnswer> {
  const map = new Map<string, BehaviorAnswer>()
  for (const answer of answers) {
    if (!answer.prompt_key) continue
    const existing = map.get(answer.prompt_key)
    if (!existing || answer.updated_at > existing.updated_at) {
      map.set(answer.prompt_key, answer)
    }
  }
  return map
}
