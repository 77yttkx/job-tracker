import { isSupabaseConfigured, supabase } from './supabase'
import { toQueryError } from './supabaseError'
import { normalizeTags } from '../lib/tagValidation'
import type { AnswerUpdate, BehaviorAnswer, NewAnswer } from '../types/interviewPrep'

const TABLE = 'behavior_answers'

function assertConfigured(): void {
  if (!isSupabaseConfigured) {
    throw new Error(
      'Supabase is not configured. Copy .env.example to .env, fill in VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY, and restart the dev server.',
    )
  }
}

/** Fetches every one of the signed-in user's saved answers, most recently updated first. RLS scopes this to the caller's own rows - see fetchStories in src/services/stories.ts for the identical pattern. */
export async function fetchAnswers(): Promise<BehaviorAnswer[]> {
  assertConfigured()
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .order('updated_at', { ascending: false })
  if (error) throw toQueryError(error)
  return (data ?? []) as BehaviorAnswer[]
}

/**
 * Saves an answer - normally written directly by the user via the New
 * Answer form (src/components/interviewPrep/AnswerModal.tsx), with no
 * `story_id`/`duration`/`tone`. Those three fields are kept only for
 * backward compatibility with the earlier Gemini-based generator, which
 * no longer exists in the frontend (see README.md's "Interview Prep"
 * section) - nothing in this app calls createAnswer with them set
 * anymore, but the columns and this optional support stay so already
 * saved rows keep working.
 */
export async function createAnswer(input: NewAnswer, userId: string): Promise<BehaviorAnswer> {
  assertConfigured()
  const payload = {
    user_id: userId,
    story_id: input.story_id ?? null,
    interview_question: input.interview_question.trim(),
    star_answer: input.star_answer.trim(),
    tags: normalizeTags(input.tags),
    notes: input.notes.trim(),
    duration: input.duration ?? null,
    tone: input.tone ?? null,
    prompt_key: input.prompt_key ?? null,
  }
  const { data, error } = await supabase.from(TABLE).insert(payload).select().single()
  if (error) throw toQueryError(error)
  return data as BehaviorAnswer
}

/** Edits an existing saved answer - the interview question, answer text, tags, and/or notes. Never calls any AI provider - Interview Prep has no generation step (see README.md). */
export async function updateAnswer(answerId: string, updates: AnswerUpdate): Promise<BehaviorAnswer> {
  assertConfigured()
  const payload: Record<string, unknown> = {}
  if (updates.interview_question !== undefined) payload.interview_question = updates.interview_question.trim()
  if (updates.star_answer !== undefined) payload.star_answer = updates.star_answer.trim()
  if (updates.tags !== undefined) payload.tags = normalizeTags(updates.tags)
  if (updates.notes !== undefined) payload.notes = updates.notes.trim()

  const { data, error } = await supabase.from(TABLE).update(payload).eq('answer_id', answerId).select().single()
  if (error) throw toQueryError(error)
  return data as BehaviorAnswer
}

export async function deleteAnswer(answerId: string): Promise<void> {
  assertConfigured()
  const { error } = await supabase.from(TABLE).delete().eq('answer_id', answerId)
  if (error) throw toQueryError(error)
}
