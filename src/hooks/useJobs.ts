import { useCallback, useEffect, useMemo, useState } from 'react'
import { SupabaseQueryError, createJob, deleteJob, fetchJobs, updateJob } from '../services/jobs'
import type { Job, JobUpdate, NewJob } from '../types/job'

interface UseJobsResult {
  jobs: Job[]
  loading: boolean
  error: string | null
  /** Extra diagnostic detail (Postgres/PostgREST error code + hint) alongside `error`, when the failure carried one - see SupabaseQueryError in services/jobs.ts. */
  errorDetail: string | null
  refresh: () => Promise<void>
  addJob: (input: NewJob) => Promise<Job>
  editJob: (jobId: string, updates: JobUpdate) => Promise<Job>
  removeJob: (jobId: string) => Promise<void>
}

function describeError(err: unknown): { message: string; detail: string | null } {
  if (err instanceof SupabaseQueryError) {
    const parts = [err.code && `code: ${err.code}`, err.hint && `hint: ${err.hint}`, err.details].filter(
      Boolean,
    )
    return { message: err.message, detail: parts.length > 0 ? parts.join(' • ') : null }
  }
  if (err instanceof Error) return { message: err.message, detail: null }
  return { message: 'Failed to load jobs.', detail: null }
}

/**
 * Central data hook: loads all jobs from Supabase and exposes CRUD helpers
 * that keep every view (Insights, Table) in sync from one source of truth.
 * Deletes are applied optimistically and rolled back with an error message
 * if the write fails.
 *
 * `userId` is the current session's user id (src/hooks/useAuth.ts). This
 * hook is only ever mounted while signed in - see the `<AuthenticatedApp>`
 * subtree in src/App.tsx, which unmounts entirely on sign-out - so every
 * fetch/write below runs under RLS as that user, and `addJob` always
 * attaches `userId` to new rows (see createJob in services/jobs.ts).
 */
export function useJobs(userId: string): UseJobsResult {
  const [jobs, setJobs] = useState<Job[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [errorDetail, setErrorDetail] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    setErrorDetail(null)
    try {
      const data = await fetchJobs()
      setJobs(data)
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

  const addJob = useCallback(
    async (input: NewJob) => {
      const created = await createJob(input, userId)
      setJobs((prev) => [created, ...prev])
      return created
    },
    [userId],
  )

  const editJob = useCallback(async (jobId: string, updates: JobUpdate) => {
    const updated = await updateJob(jobId, updates)
    setJobs((prev) => prev.map((job) => (job.job_id === jobId ? updated : job)))
    return updated
  }, [])

  const removeJob = useCallback(
    async (jobId: string) => {
      const previous = jobs
      setJobs((prev) => prev.filter((job) => job.job_id !== jobId))
      try {
        await deleteJob(jobId)
      } catch (err) {
        setJobs(previous)
        throw err
      }
    },
    [jobs],
  )

  return useMemo(
    () => ({ jobs, loading, error, errorDetail, refresh, addJob, editJob, removeJob }),
    [jobs, loading, error, errorDetail, refresh, addJob, editJob, removeJob],
  )
}
