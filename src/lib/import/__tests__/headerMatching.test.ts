import { describe, expect, it } from 'vitest'
import { autoMatchHeaders, isMappingComplete } from '../headerMatching'

describe('autoMatchHeaders', () => {
  it('matches common header spellings case-insensitively', () => {
    const headers = [
      'Company',
      'Job Title',
      'Job URL',
      'Description',
      'Location',
      'Visa Sponsorship',
      'Date Applied',
      'Status',
      'Comments',
    ]
    const mapping = autoMatchHeaders(headers)
    expect(mapping).toEqual({
      company: 0,
      role: 1,
      job_url: 2,
      jd: 3,
      location: 4,
      sponsorship: 5,
      applied_date: 6,
      status: 7,
      notes: 8,
    })
    expect(isMappingComplete(mapping)).toBe(true)
  })

  it('matches alternate aliases (Employer, Position, Link, Sponsor)', () => {
    const mapping = autoMatchHeaders(['Employer', 'Position', 'Link', 'Sponsor'])
    expect(mapping.company).toBe(0)
    expect(mapping.role).toBe(1)
    expect(mapping.job_url).toBe(2)
    expect(mapping.sponsorship).toBe(3)
  })

  it('normalizes punctuation/casing before matching (job_title, JOB-URL)', () => {
    const mapping = autoMatchHeaders(['job_title', 'JOB-URL'])
    expect(mapping.role).toBe(0)
    expect(mapping.job_url).toBe(1)
  })

  it('leaves unmatched fields out of the mapping (incomplete match)', () => {
    const mapping = autoMatchHeaders(['Company', 'Role'])
    expect(mapping.company).toBe(0)
    expect(mapping.role).toBe(1)
    expect(mapping.job_url).toBeUndefined()
    expect(isMappingComplete(mapping)).toBe(false)
  })

  it('ignores blank header cells', () => {
    const mapping = autoMatchHeaders(['Company', '', null, undefined])
    expect(mapping.company).toBe(0)
    expect(Object.keys(mapping)).toEqual(['company'])
  })
})
