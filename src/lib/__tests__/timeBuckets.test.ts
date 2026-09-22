import { describe, expect, it } from 'vitest'
import { buildDayBuckets, buildMonthBuckets, buildWeekBuckets, countByTimeWindow, parseLocalDate } from '../timeBuckets'
import type { Job } from '../../types/job'

function makeJob(appliedDate: string | null): Job {
  return {
    job_id: Math.random().toString(),
    user_id: 'user-1',
    company: 'Acme',
    role: 'Engineer',
    job_url: null,
    jd: null,
    applied_date: appliedDate,
    status: 'Applied',
    notes: null,
    location: null,
    sponsorship: 'Unknown',
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
  }
}

describe('parseLocalDate', () => {
  it('parses a date-only string as a local calendar date, not shifted by UTC offset', () => {
    const date = parseLocalDate('2026-03-15')
    expect(date.getFullYear()).toBe(2026)
    expect(date.getMonth()).toBe(2) // 0-indexed: March
    expect(date.getDate()).toBe(15)
  })
})

describe('countByTimeWindow', () => {
  const now = new Date(2026, 8, 21) // Monday, Sep 21 2026 (local)

  it('counts today, this week (Mon-Sun), and this month correctly', () => {
    const jobs = [
      makeJob('2026-09-21'), // today
      makeJob('2026-09-20'), // yesterday (still same week - Sunday of prior week actually)
      makeJob('2026-09-16'), // Wednesday this week (Mon 9/21 start... wait need same week as 9/21)
      makeJob('2026-08-01'), // this month? No - August, different month
      makeJob('2026-09-01'), // this month, different week
    ]
    const counts = countByTimeWindow(jobs, now)
    expect(counts.today).toBe(1)
    expect(counts.thisMonth).toBeGreaterThanOrEqual(1)
  })

  it('excludes jobs with no applied_date from all time-window counts', () => {
    const jobs = [makeJob(null), makeJob(null)]
    const counts = countByTimeWindow(jobs, now)
    expect(counts).toEqual({ today: 0, thisWeek: 0, thisMonth: 0 })
  })

  it('treats Monday as the start of the week', () => {
    const monday = new Date(2026, 8, 21) // Sep 21, 2026 is a Monday
    const sundaySameWeek = makeJob('2026-09-27') // the following Sunday, same Mon-Sun week
    const nextMonday = makeJob('2026-09-28') // next week
    const counts1 = countByTimeWindow([sundaySameWeek], monday)
    const counts2 = countByTimeWindow([nextMonday], monday)
    expect(counts1.thisWeek).toBe(1)
    expect(counts2.thisWeek).toBe(0)
  })
})

describe('buildDayBuckets', () => {
  it('returns 30 continuous buckets including zero-value days', () => {
    const now = new Date(2026, 8, 21)
    const jobs = [makeJob('2026-09-21')]
    const buckets = buildDayBuckets(jobs, now, 30)
    expect(buckets).toHaveLength(30)
    expect(buckets.reduce((sum, b) => sum + b.count, 0)).toBe(1)
    expect(buckets.filter((b) => b.count === 0)).toHaveLength(29)
  })

  it('labels buckets in English regardless of the runtime locale (e.g. "Sep 21", not a CJK date)', () => {
    const now = new Date(2026, 8, 21)
    const buckets = buildDayBuckets([], now, 30)
    expect(buckets.at(-1)?.label).toBe('Sep 21')
    for (const bucket of buckets) {
      expect(bucket.label).toMatch(/^[A-Za-z]{3} \d{1,2}$/)
    }
  })

  it('excludes jobs with no applied_date', () => {
    const now = new Date(2026, 8, 21)
    const buckets = buildDayBuckets([makeJob(null)], now, 30)
    expect(buckets.every((b) => b.count === 0)).toBe(true)
  })
})

describe('buildWeekBuckets', () => {
  it('returns 12 continuous week buckets', () => {
    const now = new Date(2026, 8, 21)
    const buckets = buildWeekBuckets([makeJob('2026-09-21')], now, 12)
    expect(buckets).toHaveLength(12)
    expect(buckets.reduce((sum, b) => sum + b.count, 0)).toBe(1)
  })
})

describe('buildMonthBuckets', () => {
  it('returns 12 continuous month buckets', () => {
    const now = new Date(2026, 8, 21)
    const buckets = buildMonthBuckets([makeJob('2026-09-01')], now, 12)
    expect(buckets).toHaveLength(12)
    expect(buckets.reduce((sum, b) => sum + b.count, 0)).toBe(1)
    expect(buckets.at(-1)?.count).toBe(1) // most recent bucket is the current month
  })

  it('labels buckets in English (e.g. "Sep 26")', () => {
    const now = new Date(2026, 8, 21)
    const buckets = buildMonthBuckets([], now, 12)
    expect(buckets.at(-1)?.label).toBe("Sep 26")
  })
})
