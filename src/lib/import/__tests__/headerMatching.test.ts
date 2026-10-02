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
      'Source',
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
      application_source: 6,
      applied_date: 7,
      status: 8,
      notes: 9,
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

  it('matches Application Source aliases (Application Source, Channel)', () => {
    const mapping = autoMatchHeaders(['Application Source', 'Channel'])
    expect(mapping.application_source).toBe(0)
    // Only the first alias match is kept per field - "Channel" here maps
    // to nothing else, confirming both aliases are recognized.
    const channelOnly = autoMatchHeaders(['Channel'])
    expect(channelOnly.application_source).toBe(0)
  })

  it('normalizes punctuation/casing before matching (job_title, JOB-URL, application_source)', () => {
    const mapping = autoMatchHeaders(['job_title', 'JOB-URL', 'APPLICATION_SOURCE'])
    expect(mapping.role).toBe(0)
    expect(mapping.job_url).toBe(1)
    expect(mapping.application_source).toBe(2)
  })

  it('leaves unmatched fields out of the mapping (incomplete match)', () => {
    const mapping = autoMatchHeaders(['Company', 'Role'])
    expect(mapping.company).toBe(0)
    expect(mapping.role).toBe(1)
    expect(mapping.job_url).toBeUndefined()
    expect(mapping.application_source).toBeUndefined()
    expect(isMappingComplete(mapping)).toBe(false)
  })

  it('a spreadsheet with no Application Source column simply leaves it unmapped - never an error, never blocking import', () => {
    const headers = ['Company', 'Job Title', 'Job URL', 'Description', 'Location', 'Sponsorship', 'Date Applied', 'Status', 'Notes']
    const mapping = autoMatchHeaders(headers)
    expect(mapping.application_source).toBeUndefined()
    // Every other field still matches - old files without the new
    // column keep working exactly as before.
    expect(mapping.company).toBe(0)
    expect(mapping.notes).toBe(8)
  })

  it('ignores blank header cells', () => {
    const mapping = autoMatchHeaders(['Company', '', null, undefined])
    expect(mapping.company).toBe(0)
    expect(Object.keys(mapping)).toEqual(['company'])
  })
})
