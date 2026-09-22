import { describe, expect, it } from 'vitest'
import { buildImportErrorReportCsv } from '../errorReport'
import { buildImportRows } from '../mapRows'
import { autoMatchHeaders } from '../headerMatching'

const MAPPING = autoMatchHeaders(['Company', 'Job Title', 'Job URL', 'Description', 'Location', 'Sponsorship', 'Applied Date', 'Status', 'Notes'])

describe('buildImportErrorReportCsv', () => {
  it('includes invalid, duplicate, and skipped-blank rows but not clean valid rows', () => {
    const rows = buildImportRows(
      [
        ['Acme', 'Engineer', 'https://acme.example/jobs/1', null, null, null, null, null, null], // valid
        [null, null, null, null, null, null, null, null, null], // skipped-blank
        [null, null, null, 'only a description', null, null, null, null, null], // invalid
        ['Acme', 'Engineer', 'https://acme.example/jobs/1', null, null, null, null, null, null], // duplicate
      ],
      MAPPING,
      [],
    )
    const csv = buildImportErrorReportCsv(rows)
    const lines = csv.split('\r\n')
    expect(lines[0]).toBe('row,outcome,reasons,company,role,job_url')
    // 1 valid row excluded, 3 flagged rows included
    expect(lines).toHaveLength(4)
    expect(csv).toContain('skipped-blank')
    expect(csv).toContain('invalid')
    expect(csv).toContain('duplicate')
    expect(csv).not.toMatch(/^1,valid/m)
  })

  it('reports rows whose parse-fill failed even if they were otherwise valid', () => {
    const rows = buildImportRows(
      [['Acme', null, 'https://acme.example/jobs/2', null, null, null, null, null, null]],
      MAPPING,
      [],
    )
    const csv = buildImportErrorReportCsv(rows, new Set([1]))
    expect(csv).toContain('needs manual completion')
  })
})
