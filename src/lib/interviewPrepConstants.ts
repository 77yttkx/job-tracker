import type { Duration, Tone } from '../types/interviewPrep'

/**
 * Built-in preset tags offered in the Story tag picker (spec section 4,
 * unchanged since V3). Users can also add their own custom tags - see
 * normalizeTags in src/lib/tagValidation.ts for how a custom tag and a
 * preset tag are de-duplicated case-insensitively against each other.
 */
export const PRESET_TAGS = [
  'Leadership',
  'Teamwork',
  'Failure',
  'Conflict',
  'Initiative',
  'Time Management',
  'Problem Solving',
  'Communication',
  'Adaptability',
] as const

/**
 * Preset tags offered on a saved answer (New Answer / Edit Answer form -
 * V3.1). A deliberately separate list from PRESET_TAGS above: the answer
 * tags are the specific behavioral-question categories a user preps for
 * ("Ownership", "Challenge"), which don't map one-to-one onto the Story
 * tags above. src/components/interviewPrep/TagPicker.tsx takes either
 * list via its `presetTags` prop.
 */
export const ANSWER_TAGS = [
  'Leadership',
  'Teamwork',
  'Conflict',
  'Failure',
  'Challenge',
  'Ownership',
  'Communication',
  'Problem Solving',
  'Adaptability',
  'Time Management',
] as const

/**
 * Legacy - only meaningful for an answer saved by the earlier Gemini-based
 * generator (removed in V3.1, see README.md's "Interview Prep" section).
 * Kept so AnswerCard can still show a duration/tone badge on an
 * already-saved generated answer; never set by the New Answer form.
 */
export const DURATION_OPTIONS: Array<{ value: Duration; label: string }> = [
  { value: '30s', label: '30 seconds' },
  { value: '1min', label: '1 minute' },
  { value: '2min', label: '2 minutes' },
]

export const TONE_OPTIONS: Array<{ value: Tone; label: string }> = [
  { value: 'concise', label: 'Concise' },
  { value: 'detailed', label: 'Detailed' },
]

// ---------------------------------------------------------------------------
// Length/count limits. Enforced client-side for fast feedback and mirrored
// in supabase-v3-interview-prep.sql / supabase-v3_1-manual-answers.sql's
// own CHECK constraints, which are the actual boundary.
// ---------------------------------------------------------------------------
export const MAX_STORY_TITLE_LENGTH = 120
export const MAX_STORY_LENGTH = 6000
export const MAX_TAG_LENGTH = 40
export const MAX_TAGS_PER_STORY = 12
export const MAX_QUESTION_LENGTH = 500
export const MAX_NOTES_LENGTH = 2000
export const MAX_ANSWER_LENGTH = 4000
