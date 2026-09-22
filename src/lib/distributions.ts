import { JOB_STATUSES, SPONSORSHIP_VALUES } from './constants'
import type { JobStatus, Sponsorship } from './constants'
import type { Job } from '../types/job'

export interface DistributionRow<T extends string> {
  key: T
  count: number
  percent: number
}

function safePercent(count: number, total: number): number {
  if (total <= 0) return 0
  return (count / total) * 100
}

/** Status counts + percentage of the filtered total. Jobs with no applied_date are still included. */
export function statusDistribution(jobs: Job[]): DistributionRow<JobStatus>[] {
  const total = jobs.length
  const counts = new Map<JobStatus, number>(JOB_STATUSES.map((status) => [status, 0]))
  for (const job of jobs) counts.set(job.status, (counts.get(job.status) ?? 0) + 1)
  return JOB_STATUSES.map((status) => ({
    key: status,
    count: counts.get(status) ?? 0,
    percent: safePercent(counts.get(status) ?? 0, total),
  }))
}

/** Sponsorship counts + percentage of the filtered total. */
export function sponsorshipDistribution(jobs: Job[]): DistributionRow<Sponsorship>[] {
  const total = jobs.length
  const counts = new Map<Sponsorship, number>(SPONSORSHIP_VALUES.map((value) => [value, 0]))
  for (const job of jobs) counts.set(job.sponsorship, (counts.get(job.sponsorship) ?? 0) + 1)
  return SPONSORSHIP_VALUES.map((value) => ({
    key: value,
    count: counts.get(value) ?? 0,
    percent: safePercent(counts.get(value) ?? 0, total),
  }))
}
