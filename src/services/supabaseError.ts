/**
 * Generic Supabase/PostgREST error wrapper, carrying code/details/hint
 * alongside the message (same shape/purpose as the one already used by
 * src/services/jobs.ts, kept as an independent copy here rather than an
 * import from jobs.ts - see README.md's "Interview Prep" section: V3 is
 * deliberately not coupled to the Job Tracker's own service layer, even
 * for shared-shaped utility code, so Interview Prep can be reasoned about
 * (and, if ever needed, removed) without touching jobs.ts at all).
 */
export class SupabaseQueryError extends Error {
  code?: string
  details?: string
  hint?: string

  constructor(message: string, opts?: { code?: string; details?: string; hint?: string }) {
    super(message)
    this.name = 'SupabaseQueryError'
    this.code = opts?.code
    this.details = opts?.details
    this.hint = opts?.hint
  }
}

export function toQueryError(error: { message: string; code?: string; details?: string; hint?: string }): SupabaseQueryError {
  return new SupabaseQueryError(error.message, { code: error.code, details: error.details, hint: error.hint })
}

/** Postgres foreign-key-violation error code - used to detect "can't delete this story, it still has saved answers" (behavior_answers.story_id references personal_stories with ON DELETE RESTRICT - see supabase-v3-interview-prep.sql) and turn it into a clear, specific message instead of a raw DB error. */
export const FOREIGN_KEY_VIOLATION_CODE = '23503'
