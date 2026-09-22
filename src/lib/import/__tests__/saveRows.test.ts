import { afterEach, describe, expect, it, vi } from 'vitest'

const createJobMock = vi.fn()

vi.mock('../../../services/jobs', () => ({
  createJob: createJobMock,
}))

const { saveValidRows } = await import('../saveRows')
const { buildImportRows } = await import('../mapRows')
const { autoMatchHeaders } = await import('../headerMatching')

const MAPPING = autoMatchHeaders(['Company', 'Job Title', 'Job URL'])

afterEach(() => {
  createJobMock.mockReset()
})

describe('saveValidRows', () => {
  it('saves only valid rows, skipping duplicate/invalid/blank ones', async () => {
    const rows = buildImportRows(
      [
        ['Acme', 'Engineer', 'https://acme.example/jobs/1'], // valid
        [null, null, null], // skipped-blank
        [null, null, null].map((v, i) => (i === 0 ? null : v)), // still blank-ish -> skipped
        ['Acme', 'Engineer', 'https://acme.example/jobs/1'], // duplicate of row 1
      ],
      MAPPING,
      [],
    )
    createJobMock.mockResolvedValue({ job_id: '1' })
    const result = await saveValidRows(rows, 'user-1', 2)
    expect(createJobMock).toHaveBeenCalledTimes(1)
    expect(result.importedCount).toBe(1)
  })

  it('attaches the given userId to every saved row (V2.6: imports never create a row owned by someone else)', async () => {
    const rows = buildImportRows(
      [['Acme', 'Engineer', 'https://acme.example/jobs/9']],
      MAPPING,
      [],
    )
    createJobMock.mockResolvedValue({ job_id: '9' })
    await saveValidRows(rows, 'user-42', 2)
    expect(createJobMock).toHaveBeenCalledTimes(1)
    expect(createJobMock.mock.calls[0][1]).toBe('user-42')
  })

  it('keeps saving remaining rows when one insert fails, and reports the failed row number', async () => {
    const rows = buildImportRows(
      [
        ['Acme', 'Engineer', 'https://acme.example/jobs/2'],
        ['Beta', 'Manager', 'https://acme.example/jobs/3'],
      ],
      MAPPING,
      [],
    )
    createJobMock.mockImplementation(async (payload: { job_url: string }) => {
      if (payload.job_url.endsWith('/2')) throw new Error('db error')
      return { job_id: '2' }
    })
    const result = await saveValidRows(rows, 'user-1', 2)
    expect(result.importedCount).toBe(1)
    expect(result.failedRowNumbers.has(1)).toBe(true)
    expect(result.failedRowNumbers.has(2)).toBe(false)
  })
})
