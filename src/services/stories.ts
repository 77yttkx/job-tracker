import { isSupabaseConfigured, supabase } from './supabase'
import { FOREIGN_KEY_VIOLATION_CODE, SupabaseQueryError, toQueryError } from './supabaseError'
import { normalizeTags } from '../lib/tagValidation'
import type { NewStory, PersonalStory, StoryUpdate } from '../types/interviewPrep'

const TABLE = 'personal_stories'

function assertConfigured(): void {
  if (!isSupabaseConfigured) {
    throw new Error(
      'Supabase is not configured. Copy .env.example to .env, fill in VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY, and restart the dev server.',
    )
  }
}

/**
 * Fetches every one of the signed-in user's stories, most recently
 * updated first. No client-side user filter is applied - as with
 * src/services/jobs.ts's fetchJobs, RLS (supabase-v3-interview-prep.sql)
 * is the actual boundary: this query can only ever return rows where
 * `user_id = auth.uid()` for the caller's own session.
 */
export async function fetchStories(): Promise<PersonalStory[]> {
  assertConfigured()
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .order('updated_at', { ascending: false })
  if (error) throw toQueryError(error)
  return (data ?? []) as PersonalStory[]
}

/**
 * Creates a story, always attaching the given `userId` explicitly (see
 * createJob in src/services/jobs.ts for the identical pattern) - belt-
 * and-suspenders with the DB's own `default auth.uid()` and the RLS
 * insert policy's `with check (user_id = auth.uid())`.
 */
export async function createStory(input: NewStory, userId: string): Promise<PersonalStory> {
  assertConfigured()
  const payload = {
    user_id: userId,
    title: input.title.trim(),
    raw_story: input.raw_story.trim(),
    tags: normalizeTags(input.tags),
  }
  const { data, error } = await supabase.from(TABLE).insert(payload).select().single()
  if (error) throw toQueryError(error)
  return data as PersonalStory
}

export async function updateStory(storyId: string, updates: StoryUpdate): Promise<PersonalStory> {
  assertConfigured()
  const payload: Record<string, unknown> = {}
  if (updates.title !== undefined) payload.title = updates.title.trim()
  if (updates.raw_story !== undefined) payload.raw_story = updates.raw_story.trim()
  if (updates.tags !== undefined) payload.tags = normalizeTags(updates.tags)

  const { data, error } = await supabase.from(TABLE).update(payload).eq('story_id', storyId).select().single()
  if (error) throw toQueryError(error)
  return data as PersonalStory
}

/**
 * Deletes a story. `behavior_answers.story_id` references this table with
 * ON DELETE RESTRICT (supabase-v3-interview-prep.sql), so Postgres
 * rejects the delete with a foreign-key-violation (23503) if any saved
 * answer still points at this story - rather than letting a story
 * disappear out from under answers that quote it. That DB error is
 * turned into a specific, actionable message here so the Story Library
 * page doesn't need to know the Postgres error code itself.
 */
export async function deleteStory(storyId: string): Promise<void> {
  assertConfigured()
  const { error } = await supabase.from(TABLE).delete().eq('story_id', storyId)
  if (error) {
    if (error.code === FOREIGN_KEY_VIOLATION_CODE) {
      throw new SupabaseQueryError(
        'This story has saved answers linked to it. Delete those answers first (in Answer Library), then delete this story.',
        { code: error.code, details: error.details, hint: error.hint },
      )
    }
    throw toQueryError(error)
  }
}
