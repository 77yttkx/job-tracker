import { describe, expect, it } from 'vitest'
import { compareJobsByAppliedDate, sortJobsByAppliedDateDesc } from '../tableSort'
import type { Job } from '../../types/job'

function makeJob(overrides: Partial<Job> & { job_id: string }): Job {
  return {
    user_id: 'user-1',
    company: null,
    role: null,
    job_url: null,
    jd: null,
    applied_date: null,
    status: 'Applied',
    notes: null,
    location: null,
    sponsorship: 'Unknown',
    application_source: 'Unknown',
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

describe('compareJobsByAppliedDate / sortJobsByAppliedDateDesc', () => {
  it('orders by applied_date descending by default - most recently applied first', () => {
    const older = makeJob({ job_id: 'a', applied_date: '2026-01-01' })
    const newer = makeJob({ job_id: 'b', applied_date: '2026-03-01' })
    const sorted = sortJobsByAppliedDateDesc([older, newer])
    expect(sorted.map((j) => j.job_id)).toEqual(['b', 'a'])
  })

  it('puts jobs with no applied_date after every job that has one, regardless of direction', () => {
    const noDate = makeJob({ job_id: 'no-date', applied_date: null })
    const withDate = makeJob({ job_id: 'has-date', applied_date: '2026-01-01' })
    expect(sortJobsByAppliedDateDesc([noDate, withDate]).map((j) => j.job_id)).toEqual(['has-date', 'no-date'])
    // Ascending direction still keeps missing-date jobs last, not first.
    const ascSorted = [noDate, withDate].sort((a, b) => compareJobsByAppliedDate(a, b, 'asc'))
    expect(ascSorted.map((j) => j.job_id)).toEqual(['has-date', 'no-date'])
  })

  it('breaks ties in applied_date using created_at descending', () => {
    const olderCreated = makeJob({ job_id: 'a', applied_date: '2026-02-01', created_at: '2026-01-01T00:00:00.000Z' })
    const newerCreated = makeJob({ job_id: 'b', applied_date: '2026-02-01', created_at: '2026-02-15T00:00:00.000Z' })
    expect(sortJobsByAppliedDateDesc([olderCreated, newerCreated]).map((j) => j.job_id)).toEqual(['b', 'a'])
  })

  it('breaks ties in both applied_date and created_at using job_id, deterministically', () => {
    const a = makeJob({ job_id: 'aaaa', applied_date: '2026-02-01', created_at: '2026-01-01T00:00:00.000Z' })
    const b = makeJob({ job_id: 'bbbb', applied_date: '2026-02-01', created_at: '2026-01-01T00:00:00.000Z' })
    const result1 = sortJobsByAppliedDateDesc([a, b]).map((j) => j.job_id)
    const result2 = sortJobsByAppliedDateDesc([b, a]).map((j) => j.job_id)
    expect(result1).toEqual(result2)
    expect(result1).toEqual(['bbbb', 'aaaa'])
  })

  it('two jobs that both lack applied_date still come out in a stable, deterministic order', () => {
    const a = makeJob({ job_id: 'aaaa', applied_date: null, created_at: '2026-01-01T00:00:00.000Z' })
    const b = makeJob({ job_id: 'bbbb', applied_date: null, created_at: '2026-01-01T00:00:00.000Z' })
    const result1 = sortJobsByAppliedDateDesc([a, b]).map((j) => j.job_id)
    const result2 = sortJobsByAppliedDateDesc([b, a]).map((j) => j.job_id)
    expect(result1).toEqual(result2)
  })

  it('changing updated_at (or any field other than applied_date/created_at/job_id) never changes relative order', () => {
    const a = makeJob({ job_id: 'a', applied_date: '2026-02-01', created_at: '2026-01-01T00:00:00.000Z', updated_at: '2026-01-01T00:00:00.000Z' })
    const b = makeJob({ job_id: 'b', applied_date: '2026-02-01', created_at: '2026-01-02T00:00:00.000Z', updated_at: '2026-01-02T00:00:00.000Z' })
    const before = sortJobsByAppliedDateDesc([a, b]).map((j) => j.job_id)

    // Simulate an inline status change (or a notes edit) bumping updated_at
    // on the older-created job, without touching applied_date/created_at.
    const aAfterEdit = { ...a, status: 'OA' as const, updated_at: '2099-01-01T00:00:00.000Z' }
    const after = sortJobsByAppliedDateDesc([aAfterEdit, b]).map((j) => j.job_id)

    expect(after).toEqual(before)
  })

  it('never reads updated_at at all - the comparator result is identical no matter what updated_at holds', () => {
    const a = makeJob({ job_id: 'a', applied_date: '2026-02-01' })
    const bWithOldUpdate = makeJob({ job_id: 'b', applied_date: '2026-01-01', updated_at: '2026-06-01T00:00:00.000Z' })
    const bWithNewUpdate = { ...bWithOldUpdate, updated_at: '2099-01-01T00:00:00.000Z' }
    expect(compareJobsByAppliedDate(a, bWithOldUpdate)).toBe(compareJobsByAppliedDate(a, bWithNewUpdate))
  })
})
