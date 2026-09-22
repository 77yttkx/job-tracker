import type { Job } from '../types/job'

/**
 * Local-date-safe helpers for the Insights time summary. `applied_date` is
 * stored as a date-only string ("YYYY-MM-DD"). Parsing that with `new
 * Date("YYYY-MM-DD")` interprets it as UTC midnight, which then renders as
 * the *previous* day in any timezone behind UTC - a classic off-by-one bug.
 * Every date here is parsed and compared as a local calendar date instead.
 */

export function parseLocalDate(iso: string): Date {
  const [year, month, day] = iso.split('-').map(Number)
  return new Date(year, (month ?? 1) - 1, day ?? 1)
}

export function startOfLocalDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

/** Monday of the calendar week containing `date` (Monday - Sunday weeks). */
export function startOfWeek(date: Date): Date {
  const day = startOfLocalDay(date)
  const weekday = day.getDay() // 0 = Sunday ... 6 = Saturday
  const diffToMonday = weekday === 0 ? -6 : 1 - weekday
  day.setDate(day.getDate() + diffToMonday)
  return day
}

export function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

function sameDay(a: Date, b: Date): boolean {
  return a.getTime() === startOfLocalDay(b).getTime()
}

function sameWeek(a: Date, b: Date): boolean {
  return startOfWeek(a).getTime() === startOfWeek(b).getTime()
}

function sameMonth(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth()
}

/** Jobs with no applied_date are excluded from every time-based metric below. */
function datedJobs(jobs: Job[]): Array<{ job: Job; date: Date }> {
  return jobs
    .filter((job) => Boolean(job.applied_date))
    .map((job) => ({ job, date: parseLocalDate(job.applied_date as string) }))
}

export interface TimeSummaryCounts {
  today: number
  thisWeek: number
  thisMonth: number
}

export function countByTimeWindow(jobs: Job[], now: Date = new Date()): TimeSummaryCounts {
  const dated = datedJobs(jobs)
  const today = startOfLocalDay(now)
  return {
    today: dated.filter(({ date }) => sameDay(date, today)).length,
    thisWeek: dated.filter(({ date }) => sameWeek(date, now)).length,
    thisMonth: dated.filter(({ date }) => sameMonth(date, now)).length,
  }
}

export interface TimeBucket {
  label: string
  count: number
}

/** Last 30 calendar days (inclusive of today), oldest first, zero-filled. */
export function buildDayBuckets(jobs: Job[], now: Date = new Date(), days = 30): TimeBucket[] {
  const dated = datedJobs(jobs)
  const today = startOfLocalDay(now)
  const buckets: TimeBucket[] = []
  for (let i = days - 1; i >= 0; i--) {
    const bucketDate = new Date(today)
    bucketDate.setDate(bucketDate.getDate() - i)
    const count = dated.filter(({ date }) => sameDay(date, bucketDate)).length
    buckets.push({
      label: bucketDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      count,
    })
  }
  return buckets
}

/** Last 12 calendar weeks (Monday - Sunday), oldest first, zero-filled. */
export function buildWeekBuckets(jobs: Job[], now: Date = new Date(), weeks = 12): TimeBucket[] {
  const dated = datedJobs(jobs)
  const currentWeekStart = startOfWeek(now)
  const buckets: TimeBucket[] = []
  for (let i = weeks - 1; i >= 0; i--) {
    const weekStart = new Date(currentWeekStart)
    weekStart.setDate(weekStart.getDate() - i * 7)
    const count = dated.filter(({ date }) => startOfWeek(date).getTime() === weekStart.getTime()).length
    buckets.push({
      label: weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      count,
    })
  }
  return buckets
}

/** Last 12 calendar months, oldest first, zero-filled. */
export function buildMonthBuckets(jobs: Job[], now: Date = new Date(), months = 12): TimeBucket[] {
  const dated = datedJobs(jobs)
  const currentMonthStart = startOfMonth(now)
  const buckets: TimeBucket[] = []
  for (let i = months - 1; i >= 0; i--) {
    const monthStart = new Date(currentMonthStart.getFullYear(), currentMonthStart.getMonth() - i, 1)
    const count = dated.filter(({ date }) => sameMonth(date, monthStart)).length
    buckets.push({
      label: monthStart.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
      count,
    })
  }
  return buckets
}
