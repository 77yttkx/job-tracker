import { describe, expect, it } from 'vitest'
import { applyJobFilters, emptyInsightsFilters, hasActiveFilters } from '../insightsFilters'
import type { Job } from '../../types/job'

function makeJob(overrides: Partial<Job> = {}): Job {
  return {
    job_id: Math.random().toString(),
    user_id: 'user-1',
    company: 'Acme',
    role: 'Engineer',
    job_url: null,
    jd: null,
    applied_date: null,
    status: 'Applied',
    notes: null,
    location: null,
    sponsorship: 'Unknown',
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

describe('applyJobFilters', () => {
  const jobs = [
    makeJob({ company: 'Moody\'s Corp', status: 'Applied', sponsorship: 'No' }),
    makeJob({ company: 'Moody\'s Corp', status: 'OA', sponsorship: 'No' }),
    makeJob({ company: 'Acme Inc', status: 'Applied', sponsorship: 'Yes' }),
    makeJob({ company: 'Widgets', status: 'Offer', sponsorship: 'Unknown' }),
  ]

  it('returns everything when no filters are active', () => {
    expect(applyJobFilters(jobs, emptyInsightsFilters())).toHaveLength(4)
    expect(hasActiveFilters(emptyInsightsFilters())).toBe(false)
  })

  it('filters by company, case-insensitively', () => {
    const result = applyJobFilters(jobs, { ...emptyInsightsFilters(), company: 'moody' })
    expect(result).toHaveLength(2)
    expect(result.every((j) => j.company?.includes('Moody'))).toBe(true)
  })

  it('filters by status with OR semantics within the multi-select', () => {
    const result = applyJobFilters(jobs, {
      ...emptyInsightsFilters(),
      statuses: new Set(['Applied', 'OA']),
    })
    expect(result).toHaveLength(3)
  })

  it('filters by sponsorship multi-select', () => {
    const result = applyJobFilters(jobs, { ...emptyInsightsFilters(), sponsorships: new Set(['No']) })
    expect(result).toHaveLength(2)
  })

  it('combines company + status + sponsorship with AND logic', () => {
    // company contains "Moody" AND status is Applied or OA AND sponsorship is No
    const result = applyJobFilters(jobs, {
      company: 'Moody',
      statuses: new Set(['Applied', 'OA']),
      sponsorships: new Set(['No']),
    })
    expect(result).toHaveLength(2)
    expect(result.every((j) => j.company?.includes('Moody') && j.sponsorship === 'No')).toBe(true)
  })

  it('reports active filters correctly', () => {
    expect(hasActiveFilters({ company: 'x', statuses: new Set(), sponsorships: new Set() })).toBe(true)
    expect(hasActiveFilters({ company: '', statuses: new Set(['Applied']), sponsorships: new Set() })).toBe(true)
  })
})
