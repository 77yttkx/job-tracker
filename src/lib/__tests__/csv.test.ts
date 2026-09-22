import { describe, expect, it } from 'vitest'
import { escapeCsvField, exportFileName, jobsToCsv } from '../csv'
import type { Job } from '../../types/job'

function makeJob(overrides: Partial<Job> = {}): Job {
  return {
    job_id: '11111111-1111-1111-1111-111111111111',
    user_id: 'user-1',
    company: 'Acme',
    role: 'Engineer',
    location: 'Remote — United States',
    sponsorship: 'Unknown',
    job_url: 'https://acme.example/jobs/1',
    jd: 'Build things',
    applied_date: '2026-01-05',
    status: 'Applied',
    notes: null,
    created_at: '2026-01-05T00:00:00.000Z',
    updated_at: '2026-01-06T00:00:00.000Z',
    ...overrides,
  }
}

describe('escapeCsvField', () => {
  it('leaves plain text untouched', () => {
    expect(escapeCsvField('Acme Corp')).toBe('Acme Corp')
  })

  it('quotes fields containing commas', () => {
    expect(escapeCsvField('Acme, Inc.')).toBe('"Acme, Inc."')
  })

  it('escapes embedded quotes by doubling them', () => {
    expect(escapeCsvField('Say "hi"')).toBe('"Say ""hi"""')
  })

  it('quotes fields containing newlines', () => {
    expect(escapeCsvField('line1\nline2')).toBe('"line1\nline2"')
  })

  it('treats null/undefined as empty string', () => {
    expect(escapeCsvField(null)).toBe('')
    expect(escapeCsvField(undefined)).toBe('')
  })
})

describe('jobsToCsv', () => {
  it('emits the header row with columns in the required order', () => {
    const csv = jobsToCsv([])
    expect(csv).toBe(
      'job_id,company,role,location,sponsorship,job_url,jd,applied_date,status,notes,created_at,updated_at',
    )
  })

  it('emits one row per job with escaped fields', () => {
    const csv = jobsToCsv([makeJob({ company: 'Acme, Inc.', notes: 'great "culture"' })])
    const lines = csv.split('\r\n')
    expect(lines).toHaveLength(2)
    expect(lines[1]).toContain('"Acme, Inc."')
    expect(lines[1]).toContain('"great ""culture"""')
  })

  it('preserves unicode text', () => {
    const csv = jobsToCsv([makeJob({ company: '株式会社ACME', role: 'Ingénieur' })])
    expect(csv).toContain('株式会社ACME')
    expect(csv).toContain('Ingénieur')
  })

  it('includes location and sponsorship values in the row', () => {
    const csv = jobsToCsv([makeJob({ location: 'Charlotte, NC, United States', sponsorship: 'No' })])
    const lines = csv.split('\r\n')
    expect(lines[1]).toContain('Charlotte, NC, United States')
    expect(lines[1]).toContain('No')
  })

  it('emits empty field for null location', () => {
    const csv = jobsToCsv([makeJob({ location: null })])
    const lines = csv.split('\r\n')
    const cols = lines[1].split(',')
    // location is column index 3 (0-based): job_id,company,role,location,...
    expect(cols[3]).toBe('')
  })
})

describe('exportFileName', () => {
  it('formats as job-tracker-export-YYYY-MM-DD.csv', () => {
    expect(exportFileName(new Date('2026-09-21T12:00:00.000Z'))).toBe(
      'job-tracker-export-2026-09-21.csv',
    )
  })
})
