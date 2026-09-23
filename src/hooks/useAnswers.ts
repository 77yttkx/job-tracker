import { useCallback, useEffect, useMemo, useState } from 'react'
import { SupabaseQueryError } from '../services/supabaseError'
import { createAnswer, deleteAnswer, fetchAnswers, updateAnswer } from '../services/answers'
import type { AnswerUpdate, BehaviorAnswer, NewAnswer } from '../types/interviewPrep'

interface UseAnswersResult {
  answers: BehaviorAnswer[]
  loading: boolean
  error: string | null
  errorDetail: string | null
  refresh: () => Promise<void>
  addAnswer: (input: NewAnswer) => Promise<BehaviorAnswer>
  editAnswer: (answerId: string, updates: AnswerUpdate) => Promise<BehaviorAnswer>
  removeAnswer: (answerId: string) => Promise<void>
}

function describeError(err: unknown): { message: string; detail: string | null } {
  if (err instanceof SupabaseQueryError) {
    const parts = [err.code && `code: ${err.code}`, err.hint && `hint: ${err.hint}`, err.details].filter(
      Boolean,
    )
    return { message: err.message, detail: parts.length > 0 ? parts.join(' • ') : null }
  }
  if (err instanceof Error) return { message: err.message, detail: null }
  return { message: 'Failed to load answers.', detail: null }
}

/** Central Interview Prep answer data hook - same pattern as useStories/useJobs. See useStories.ts's doc comment for why this is an independent implementation rather than a shared generalization with useJobs. */
export function useAnswers(userId: string): UseAnswersResult {
  const [answers, setAnswers] = useState<BehaviorAnswer[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [errorDetail, setErrorDetail] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    setErrorDetail(null)
    try {
      const data = await fetchAnswers()
      setAnswers(data)
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

  const addAnswer = useCallback(
    async (input: NewAnswer) => {
      const created = await createAnswer(input, userId)
      setAnswers((prev) => [created, ...prev])
      return created
    },
    [userId],
  )

  const editAnswer = useCallback(async (answerId: string, updates: AnswerUpdate) => {
    const updated = await updateAnswer(answerId, updates)
    setAnswers((prev) => prev.map((answer) => (answer.answer_id === answerId ? updated : answer)))
    return updated
  }, [])

  const removeAnswer = useCallback(
    async (answerId: string) => {
      const previous = answers
      setAnswers((prev) => prev.filter((answer) => answer.answer_id !== answerId))
      try {
        await deleteAnswer(answerId)
      } catch (err) {
        setAnswers(previous)
        throw err
      }
    },
    [answers],
  )

  return useMemo(
    () => ({ answers, loading, error, errorDetail, refresh, addAnswer, editAnswer, removeAnswer }),
    [answers, loading, error, errorDetail, refresh, addAnswer, editAnswer, removeAnswer],
  )
}
