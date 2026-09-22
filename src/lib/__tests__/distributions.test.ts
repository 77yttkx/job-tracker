import { describe, expect, it } from 'vitest'
import { sponsorshipDistribution, statusDistribution } from '../distributions'
import type { Job } from '../../types/job'

function makeJob(status: Job['status'], sponsorship: Job['sponsorship']): Job {
  return {
    job_id: Math.random().toString(),
    user_id: 'user-1',
    company: 'Acme',
    role: 'Engineer',
    job_url: null,
    jd: null,
    applied_date: null,
    status,
    notes: null,
    location: null,
    sponsorship,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
  }
}

describe('statusDistribution', () => {
  it('computes counts and percentages of the total', () => {
    const jobs = [makeJob('Applied', 'Unknown'), makeJob('Applied', 'Unknown'), makeJob('Offer', 'Yes')]
    const rows = statusDistribution(jobs)
    const applied = rows.find((r) => r.key === 'Applied')!
    const offer = rows.find((r) => r.key === 'Offer')!
    expect(applied.count).toBe(2)
    expect(applied.percent).toBeCloseTo((2 / 3) * 100)
    expect(offer.count).toBe(1)
    expect(offer.percent).toBeCloseTo((1 / 3) * 100)
  })

  it('shows 0% safely for an empty filtered set', () => {
    const rows = statusDistribution([])
    expect(rows.every((r) => r.count === 0 && r.percent === 0)).toBe(true)
  })
})

describe('sponsorshipDistribution', () => {
  it('computes counts and percentages for Yes/No/Unknown', () => {
    const jobs = [
      makeJob('Applied', 'Yes'),
      makeJob('Applied', 'No'),
      makeJob('Applied', 'No'),
      makeJob('Applied', 'Unknown'),
    ]
    const rows = sponsorshipDistribution(jobs)
    expect(rows.find((r) => r.key === 'Yes')?.count).toBe(1)
    expect(rows.find((r) => r.key === 'No')?.count).toBe(2)
    expect(rows.find((r) => r.key === 'Unknown')?.count).toBe(1)
    expect(rows.find((r) => r.key === 'No')?.percent).toBeCloseTo(50)
  })

  it('shows 0% safely when there are no jobs', () => {
    expect(sponsorshipDistribution([]).every((r) => r.percent === 0)).toBe(true)
  })
})
