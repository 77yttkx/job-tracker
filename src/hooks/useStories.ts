import { useCallback, useEffect, useMemo, useState } from 'react'
import { SupabaseQueryError } from '../services/supabaseError'
import { createStory, deleteStory, fetchStories, updateStory } from '../services/stories'
import type { NewStory, PersonalStory, StoryUpdate } from '../types/interviewPrep'

interface UseStoriesResult {
  stories: PersonalStory[]
  loading: boolean
  error: string | null
  errorDetail: string | null
  refresh: () => Promise<void>
  addStory: (input: NewStory) => Promise<PersonalStory>
  editStory: (storyId: string, updates: StoryUpdate) => Promise<PersonalStory>
  removeStory: (storyId: string) => Promise<void>
}

function describeError(err: unknown): { message: string; detail: string | null } {
  if (err instanceof SupabaseQueryError) {
    const parts = [err.code && `code: ${err.code}`, err.hint && `hint: ${err.hint}`, err.details].filter(
      Boolean,
    )
    return { message: err.message, detail: parts.length > 0 ? parts.join(' • ') : null }
  }
  if (err instanceof Error) return { message: err.message, detail: null }
  return { message: 'Failed to load stories.', detail: null }
}

/**
 * Central Interview Prep story data hook - the same shape/pattern as
 * src/hooks/useJobs.ts, kept as an independent implementation (not a
 * generalization shared with useJobs) so Interview Prep has zero import
 * dependency on the Job Tracker's own data layer (see README.md).
 *
 * `userId` is the current session's user id. This hook is only ever
 * mounted while signed in, inside the same `<AuthenticatedApp>` subtree
 * that mounts useJobs - see src/App.tsx.
 */
export function useStories(userId: string): UseStoriesResult {
  const [stories, setStories] = useState<PersonalStory[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [errorDetail, setErrorDetail] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    setErrorDetail(null)
    try {
      const data = await fetchStories()
      setStories(data)
    } catch (err) {
      const { message, detail } = describeError(err)
      setError(message)
      setErrorDetail(detail)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const addStory = useCallback(
    async (input: NewStory) => {
      const created = await createStory(input, userId)
      setStories((prev) => [created, ...prev])
      return created
    },
    [userId],
  )

  const editStory = useCallback(async (storyId: string, updates: StoryUpdate) => {
    const updated = await updateStory(storyId, updates)
    setStories((prev) => prev.map((story) => (story.story_id === storyId ? updated : story)))
    return updated
  }, [])

  const removeStory = useCallback(
    async (storyId: string) => {
      // Not applied optimistically, unlike removeJob in useJobs: a delete
      // here can legitimately be rejected by the DB (ON DELETE RESTRICT
      // when saved answers still reference this story - see
      // src/services/stories.ts), which is an expected, common outcome
      // here, not just a rare network failure - so the list only changes
      // once the delete has actually succeeded.
      await deleteStory(storyId)
      setStories((prev) => prev.filter((story) => story.story_id !== storyId))
    },
    [],
  )

  return useMemo(
    () => ({ stories, loading, error, errorDetail, refresh, addStory, editStory, removeStory }),
    [stories, loading, error, errorDetail, refresh, addStory, editStory, removeStory],
  )
}
