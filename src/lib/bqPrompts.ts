import { ANSWER_TAGS } from './interviewPrepConstants'

/**
 * The ten guided "BQ Questions" prompt templates (V3.2 spec section 2).
 * Each maps to exactly one of the existing ANSWER_TAGS values, so a
 * prompt's tag and a saved answer's tags use the exact same vocabulary -
 * no separate mapping table needed to match a prompt back to an answer
 * with that tag (see recommendAnswersForTags in bqRecommendations.ts,
 * which reuses these same tag strings).
 *
 * `key` is a short, stable identifier persisted on an answer created from
 * this prompt (BehaviorAnswer.prompt_key - see supabase-v3_2-bq-
 * structure.sql) so reopening the same prompt edits that answer instead
 * of creating a duplicate (src/pages/interviewPrep/bq/BQQuestionsPage.tsx).
 * Keys are deliberately plain slugs, never reused across prompts, and
 * never renamed once shipped - changing an existing key would orphan any
 * already-saved answer's prompt_key (it would just stop matching any
 * prompt, degrading gracefully to "not from a guided prompt" rather than
 * erroring, but the connection would be lost).
 */
export interface BQPrompt {
  key: string
  tag: (typeof ANSWER_TAGS)[number]
  question: string
}

export const BQ_PROMPTS: readonly BQPrompt[] = [
  { key: 'leadership', tag: 'Leadership', question: 'Tell me about a time you showed leadership.' },
  { key: 'teamwork', tag: 'Teamwork', question: 'Tell me about a time you worked successfully with a team.' },
  {
    key: 'conflict',
    tag: 'Conflict',
    question: 'Tell me about a time you disagreed with a teammate or stakeholder. How did you handle it?',
  },
  { key: 'failure', tag: 'Failure', question: 'Tell me about a time you made a mistake or failed. What did you learn?' },
  {
    key: 'challenge',
    tag: 'Challenge',
    question: 'Tell me about a difficult challenge you faced and how you handled it.',
  },
  { key: 'ownership', tag: 'Ownership', question: 'Tell me about a time you took ownership of a problem.' },
  {
    key: 'communication',
    tag: 'Communication',
    question: 'Tell me about a time you had to explain something complex or communicate with others clearly.',
  },
  { key: 'problem-solving', tag: 'Problem Solving', question: 'Tell me about a complex problem you solved.' },
  {
    key: 'adaptability',
    tag: 'Adaptability',
    question: 'Tell me about a time you had to adapt to change or ambiguity.',
  },
  {
    key: 'time-management',
    tag: 'Time Management',
    question: 'Tell me about a time you had multiple priorities or worked under a tight deadline.',
  },
] as const

/** Looks up a prompt template by its persisted key - used when an answer's `prompt_key` needs to be resolved back to its question/tag (e.g. to show which prompt an answer came from). Returns undefined for an unknown/legacy key. */
export function findBqPrompt(key: string | null | undefined): BQPrompt | undefined {
  if (!key) return undefined
  return BQ_PROMPTS.find((p) => p.key === key)
}
