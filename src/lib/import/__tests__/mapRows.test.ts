import { describe, expect, it } from 'vitest'
import { buildImportRows, rowNeedsParseFill } from '../mapRows'
import { autoMatchHeaders } from '../headerMatching'

const HEADER = ['Company', 'Job Title', 'Job URL', 'Description', 'Location', 'Sponsorship', 'Applied Date', 'Status', 'Notes']
const MAPPING = autoMatchHeaders(HEADER)

const HEADER_WITH_SOURCE = [
  'Company',
  'Job Title',
  'Job URL',
  'Description',
  'Location',
  'Sponsorship',
  'Application Source',
  'Applied Date',
  'Status',
  'Notes',
]
const MAPPING_WITH_SOURCE = autoMatchHeaders(HEADER_WITH_SOURCE)

describe('buildImportRows', () => {
  it('imports a fully-populated row as valid', () => {
    const rows = buildImportRows(
      [['Acme', 'Engineer', 'https://acme.example/jobs/1', 'Build things', 'NYC', 'Yes', '2026-09-21', 'Applied', 'referred']],
      MAPPING,
      [],
    )
    expect(rows).toHaveLength(1)
    expect(rows[0].outcome).toBe('valid')
    expect(rows[0].data).toMatchObject({
      company: 'Acme',
      role: 'Engineer',
      job_url: 'https://acme.example/jobs/1',
      location: 'NYC',
      sponsorship: 'Yes',
      applied_date: '2026-09-21',
      status: 'Applied',
      notes: 'referred',
    })
  })

  it('allows a row with only a job URL to be imported', () => {
    const rows = buildImportRows([[null, null, 'https://acme.example/jobs/2', null, null, null, null, null, null]], MAPPING, [])
    expect(rows[0].outcome).toBe('valid')
    expect(rows[0].data.job_url).toBe('https://acme.example/jobs/2')
  })

  it('marks a row with no company, role, or job URL as invalid', () => {
    const rows = buildImportRows([[null, null, null, 'some description', null, null, null, null, 'a note']], MAPPING, [])
    expect(rows[0].outcome).toBe('invalid')
    expect(rows[0].reasons.join(' ')).toMatch(/no company, role, or job url/i)
  })

  it('skips a completely blank row', () => {
    const rows = buildImportRows([new Array(HEADER.length).fill(null)], MAPPING, [])
    expect(rows[0].outcome).toBe('skipped-blank')
  })

  it('flags an unrecognized status but still imports the row, defaulted to Applied', () => {
    const rows = buildImportRows(
      [['Acme', 'Engineer', 'https://acme.example/jobs/3', null, null, null, null, 'Interviewing', null]],
      MAPPING,
      [],
    )
    expect(rows[0].outcome).toBe('valid')
    expect(rows[0].data.status).toBe('Applied')
    expect(rows[0].statusWasInvalid).toBe(true)
  })

  it('flags an unparseable applied_date but still imports the row with a blank date', () => {
    const rows = buildImportRows(
      [['Acme', 'Engineer', 'https://acme.example/jobs/4', null, null, null, 'not a date', null, null]],
      MAPPING,
      [],
    )
    expect(rows[0].outcome).toBe('valid')
    expect(rows[0].data.applied_date).toBeNull()
    expect(rows[0].invalidDateRaw).toBe('not a date')
  })

  it('detects a duplicate job_url within the same file (first occurrence stays valid)', () => {
    const rows = buildImportRows(
      [
        ['Acme', 'Engineer', 'https://acme.example/jobs/5', null, null, null, null, null, null],
        ['Acme', 'Engineer II', 'https://acme.example/jobs/5', null, null, null, null, null, null],
      ],
      MAPPING,
      [],
    )
    expect(rows[0].outcome).toBe('valid')
    expect(rows[1].outcome).toBe('duplicate')
    expect(rows[1].duplicateInFile).toBe(true)
  })

  it('is case-insensitive and trailing-slash-insensitive when detecting file duplicates', () => {
    const rows = buildImportRows(
      [
        ['Acme', 'Engineer', 'https://acme.example/jobs/6/', null, null, null, null, null, null],
        ['Acme', 'Engineer', 'HTTPS://ACME.EXAMPLE/jobs/6', null, null, null, null, null, null],
      ],
      MAPPING,
      [],
    )
    expect(rows[1].outcome).toBe('duplicate')
  })

  it('detects a duplicate against an existing database job_url', () => {
    const rows = buildImportRows(
      [['Acme', 'Engineer', 'https://acme.example/jobs/7', null, null, null, null, null, null]],
      MAPPING,
      ['https://acme.example/jobs/7'],
    )
    expect(rows[0].outcome).toBe('duplicate')
    expect(rows[0].duplicateInDb).toBe(true)
  })

  it('lists which parse-fillable fields are missing when a job_url is present', () => {
    const rows = buildImportRows(
      [['Acme', null, 'https://acme.example/jobs/8', null, null, null, null, null, null]],
      MAPPING,
      [],
    )
    expect(rows[0].missingFillableFields).toEqual(expect.arrayContaining(['role', 'jd', 'location', 'sponsorship']))
    expect(rows[0].missingFillableFields).not.toContain('company')
  })

  it('does not suggest parse-fill for a row with no job_url', () => {
    const rows = buildImportRows([['Acme', null, null, null, null, null, null, null, null]], MAPPING, [])
    expect(rows[0].missingFillableFields).toEqual([])
    expect(rowNeedsParseFill(rows[0])).toBe(false)
  })

  it('rowNeedsParseFill is true only when job_url is present and something fillable is missing', () => {
    const rows = buildImportRows(
      [
        ['Acme', 'Engineer', 'https://acme.example/jobs/9', 'full jd', 'NYC', 'Yes', null, null, null],
        ['Beta', null, 'https://acme.example/jobs/10', null, null, null, null, null, null],
      ],
      MAPPING,
      [],
    )
    expect(rowNeedsParseFill(rows[0])).toBe(false) // nothing missing
    expect(rowNeedsParseFill(rows[1])).toBe(true)
  })

  describe('application_source (V3.6)', () => {
    it('defaults application_source to Unknown when the spreadsheet has no matching column - old files without it keep working', () => {
      const rows = buildImportRows(
        [['Acme', 'Engineer', 'https://acme.example/jobs/11', null, null, null, null, null, null]],
        MAPPING,
        [],
      )
      expect(rows[0].outcome).toBe('valid')
      expect(rows[0].data.application_source).toBe('Unknown')
    })

    it('never lists application_source as a missing/fillable field, even with a job_url present - it is never parse-fillable', () => {
      const rows = buildImportRows(
        [['Acme', null, 'https://acme.example/jobs/12', null, null, null, null, null, null]],
        MAPPING,
        [],
      )
      expect(rows[0].missingFillableFields).not.toContain('application_source')
    })

    it('imports a recognized application_source value from a matched column', () => {
      const rows = buildImportRows(
        [['Acme', 'Engineer', 'https://acme.example/jobs/13', null, null, 'Yes', 'Referral', '2026-09-21', 'Applied', null]],
        MAPPING_WITH_SOURCE,
        [],
      )
      expect(rows[0].outcome).toBe('valid')
      expect(rows[0].data.application_source).toBe('Referral')
      // Importing a source must never change any other field's normal
      // value - sponsorship, status, dates are exactly as if the source
      // column weren't there.
      expect(rows[0].data.sponsorship).toBe('Yes')
      expect(rows[0].data.status).toBe('Applied')
    })

    it('defaults a blank application_source cell to Unknown even when the column exists', () => {
      const rows = buildImportRows(
        [['Acme', 'Engineer', 'https://acme.example/jobs/14', null, null, null, '', null, null, null]],
        MAPPING_WITH_SOURCE,
        [],
      )
      expect(rows[0].data.application_source).toBe('Unknown')
    })

    it('defaults an unrecognized application_source value to Unknown rather than failing the row', () => {
      const rows = buildImportRows(
        [['Acme', 'Engineer', 'https://acme.example/jobs/15', null, null, null, 'Indeed', null, null, null]],
        MAPPING_WITH_SOURCE,
        [],
      )
      expect(rows[0].outcome).toBe('valid')
      expect(rows[0].data.application_source).toBe('Unknown')
    })
  })
})
