/**
 * Types for the Interview Prep module (personal_stories,
 * behavior_answers - see supabase-v3-interview-prep.sql,
 * supabase-v3_1-manual-answers.sql, and supabase-v3_2-bq-structure.sql).
 * Deliberately independent of src/types/job.ts: Interview Prep's data
 * model (this file) never references a job's shape or id at all. The one
 * V3.2 exception - "Prepare for a Job" reading a user-selected job's `jd`
 * text - lives entirely in src/pages/interviewPrep/bq/PrepareForJobPage.tsx
 * and src/lib/jdKeywords.ts, which import Job from src/types/job.ts
 * directly; nothing here or in behavior_answers/personal_stories changes
 * to accommodate it (see README.md's "Interview Prep" section).
 *
 * As of V3.1, Interview Prep is a manual BQ (behavioral question) answer
 * organizer - there is no AI generation step. Users write an answer
 * elsewhere and paste it in, or write it directly here. `story_id`,
 * `duration`, and `tone` are all optional/nullable on BehaviorAnswer:
 * they're populated only on answers saved by the earlier Gemini-based
 * generator (kept purely for backward compatibility with already-saved
 * data - see README.md's "Interview Prep" section for why that feature
 * was removed), and are always null/absent on a manually-created answer.
 */

/** Row shape as stored in Supabase `public.personal_stories`. */
export interface PersonalStory {
  story_id: string
  user_id: string
  title: string
  raw_story: string
  tags: string[]
  created_at: string
  updated_at: string
}

/** Fields the client sends when creating a story. `user_id` is attached by the service layer, never by the caller - see src/services/stories.ts. */
export interface NewStory {
  title: string
  raw_story: string
  tags: string[]
}

export type StoryUpdate = Partial<NewStory>

/**
 * Legacy fields, kept only so an answer saved by the earlier Gemini-based
 * generator still displays and edits correctly. Never set by the New
 * Answer form (src/components/interviewPrep/AnswerModal.tsx) - a
 * manually-created answer's `duration`/`tone` are always null.
 */
export const DURATION_VALUES = ['30s', '1min', '2min'] as const
export type Duration = (typeof DURATION_VALUES)[number]

export const TONE_VALUES = ['concise', 'detailed'] as const
export type Tone = (typeof TONE_VALUES)[number]

/** Row shape as stored in Supabase `public.behavior_answers`. */
export interface BehaviorAnswer {
  answer_id: string
  user_id: string
  /** Null for a manually-created answer. Set only on an answer saved by the earlier Gemini-based generator, whose source story - see PersonalStory - can never be deleted while this reference exists (ON DELETE RESTRICT). */
  story_id: string | null
  interview_question: string
  star_answer: string
  /** Required (at least one) when creating a new answer via the New Answer form - see src/components/interviewPrep/AnswerModal.tsx's client-side validation. May be empty on an answer saved before tags existed (V3.1's migration backfills those to `[]`, never invalidating them). */
  tags: string[]
  notes: string
  /** Legacy - see the module doc comment above. Always null on a manually-created answer. */
  duration: Duration | null
  /** Legacy - see the module doc comment above. Always null on a manually-created answer. */
  tone: Tone | null
  /**
   * V3.2: set when this answer was created from one of the guided "BQ
   * Questions" prompt templates (src/lib/bqPrompts.ts), so reopening the
   * same prompt edits this answer instead of creating a duplicate - see
   * src/pages/interviewPrep/bq/BQQuestionsPage.tsx. Null for every answer
   * created via the plain "New Answer" form (My Answers), and for every
   * pre-V3.2 row (supabase-v3_2-bq-structure.sql backfills existing rows
   * to null, never invalidating them).
   */
  prompt_key: string | null
  created_at: string
  updated_at: string
}

/** Fields the client sends when creating an answer - either by hand (New Answer form), from a guided BQ prompt, or, historically, after reviewing a generated draft. `user_id` is attached by the service layer. */
export interface NewAnswer {
  /** Omit or pass null for a manually-created answer. */
  story_id?: string | null
  interview_question: string
  star_answer: string
  tags: string[]
  notes: string
  duration?: Duration | null
  tone?: Tone | null
  /** Omit or pass null unless this answer is being created from a guided BQ prompt template - see BehaviorAnswer.prompt_key above. */
  prompt_key?: string | null
}

export type AnswerUpdate = Partial<
  Pick<NewAnswer, 'interview_question' | 'star_answer' | 'tags' | 'notes'>
>
