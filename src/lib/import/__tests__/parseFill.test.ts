import { afterEach, describe, expect, it, vi } from 'vitest'

const parseJobUrlMock = vi.fn()

vi.mock('../../../services/jobParser', () => ({
  parseJobUrl: parseJobUrlMock,
}))

const { fillMissingFieldsFromUrls } = await import('../parseFill')
const { buildImportRows } = await import('../mapRows')
const { autoMatchHeaders } = await import('../headerMatching')

const MAPPING = autoMatchHeaders(['Company', 'Job Title', 'Job URL', 'Description', 'Location', 'Sponsorship', 'Applied Date', 'Status', 'Notes'])

afterEach(() => {
  parseJobUrlMock.mockReset()
})

describe('fillMissingFieldsFromUrls', () => {
  it('fills only the blank fields, never overwriting a value already in the spreadsheet', async () => {
    const rows = buildImportRows(
      [['Acme', null, 'https://acme.example/jobs/1', null, null, null, null, null, null]],
      MAPPING,
      [],
    )
    parseJobUrlMock.mockResolvedValue({
      status: 'success',
      fields: { company: 'Should Not Overwrite', role: 'Engineer', jd: 'Full JD text', applied_date: null, location: 'NYC', sponsorship: 'Yes' },
      message: 'Job details extracted.',
      warnings: [],
    })

    const result = await fillMissingFieldsFromUrls(rows, 2)
    expect(result.attempted).toBe(1)
    expect(result.filledCount).toBe(1)
    const updated = result.rows[0].data
    expect(updated.company).toBe('Acme') // untouched - was already set
    expect(updated.role).toBe('Engineer') // filled
    expect(updated.jd).toBe('Full JD text')
    expect(updated.location).toBe('NYC')
    expect(updated.sponsorship).toBe('Yes')
    expect(result.failedRowNumbers.size).toBe(0)
  })

  it('never blocks or drops the row when a parse call fails - it is kept as-is and flagged', async () => {
    const rows = buildImportRows(
      [
        ['Acme', null, 'https://acme.example/jobs/2', null, null, null, null, null, null],
        ['Beta', null, 'https://acme.example/jobs/3', null, null, null, null, null, null],
      ],
      MAPPING,
      [],
    )
    parseJobUrlMock.mockImplementation(async (url: string) => {
      if (url.endsWith('/2')) throw new Error('network error')
      return {
        status: 'success',
        fields: { company: null, role: 'Filled Role', jd: null, applied_date: null, location: null, sponsorship: 'Unknown' },
        message: 'ok',
        warnings: [],
      }
    })

    const result = await fillMissingFieldsFromUrls(rows, 2)
    expect(result.rows).toHaveLength(2) // both rows still present
    expect(result.failedRowNumbers.has(1)).toBe(true)
    expect(result.rows[0].data.company).toBe('Acme') // untouched, not lost
    expect(result.rows[1].data.role).toBe('Filled Role') // second row still filled despite the first failing
  })

  it('treats a "failed" parse outcome (fields: null) the same as a thrown error', async () => {
    const rows = buildImportRows([['Acme', null, 'https://acme.example/jobs/4', null, null, null, null, null, null]], MAPPING, [])
    parseJobUrlMock.mockResolvedValue({ status: 'failed', fields: null, message: 'This page could not be accessed.', warnings: [] })

    const result = await fillMissingFieldsFromUrls(rows, 2)
    expect(result.failedRowNumbers.has(1)).toBe(true)
    expect(result.rows[0].data.role).toBeNull()
  })

  it('does not call parseJobUrl at all when nothing needs filling', async () => {
    const rows = buildImportRows(
      [['Acme', 'Engineer', 'https://acme.example/jobs/5', 'full jd', 'NYC', 'Yes', null, null, null]],
      MAPPING,
      [],
    )
    const result = await fillMissingFieldsFromUrls(rows, 2)
    expect(result.attempted).toBe(0)
    expect(parseJobUrlMock).not.toHaveBeenCalled()
  })

  it('never fills sponsorship with a parsed "Unknown" (that is not new information)', async () => {
    const rows = buildImportRows([['Acme', 'Engineer', 'https://acme.example/jobs/6', 'jd', 'NYC', null, null, null, null]], MAPPING, [])
    parseJobUrlMock.mockResolvedValue({
      status: 'partial',
      fields: { company: 'Acme', role: 'Engineer', jd: 'jd', applied_date: null, location: 'NYC', sponsorship: 'Unknown' },
      message: 'Some fields could not be extracted.',
      warnings: [],
    })
    const result = await fillMissingFieldsFromUrls(rows, 2)
    expect(result.filledCount).toBe(0)
    expect(result.rows[0].data.sponsorship).toBe('Unknown')
  })
})
