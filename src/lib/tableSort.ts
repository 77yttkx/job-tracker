import type { Job } from '../types/job'

/**
 * Default/"Applied" column ordering for the Table page: most recently
 * applied first, jobs with no `applied_date` always last (regardless of
 * `direction`), and a stable, deterministic secondary sort for ties -
 * `created_at` descending, then `job_id` - so two jobs that share (or
 * both lack) an `applied_date` always come out in the same relative
 * order. Deliberately never reads `updated_at`: changing a job's status
 * or notes (which touches `updated_at`) must never move it in the Table,
 * unlike the query behind `fetchJobs()`, which is ordered by
 * `updated_at desc` purely as a fetch order, not a display order.
 */
export function compareJobsByAppliedDate(a: Job, b: Job, direction: 'asc' | 'desc' = 'desc'): number {
  const aDate = a.applied_date
  const bDate = b.applied_date

  if (aDate !== bDate) {
    if (aDate === null) return 1
    if (bDate === null) return -1
    const cmp = aDate > bDate ? -1 : 1
    return direction === 'desc' ? cmp : -cmp
  }

  // Tie (including both missing an applied_date): always broken the same
  // way, independent of `direction` and never touching `updated_at`.
  if (a.created_at !== b.created_at) return a.created_at > b.created_at ? -1 : 1
  if (a.job_id !== b.job_id) return a.job_id > b.job_id ? -1 : 1
  return 0
}

/** Convenience wrapper for the Table page's default order (newest applied_date first). */
export function sortJobsByAppliedDateDesc(jobs: Job[]): Job[] {
  return [...jobs].sort((a, b) => compareJobsByAppliedDate(a, b, 'desc'))
}
