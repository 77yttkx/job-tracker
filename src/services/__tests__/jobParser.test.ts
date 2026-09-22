import { afterEach, describe, expect, it, vi } from 'vitest'

const invokeMock = vi.fn()

vi.mock('../supabase', () => ({
  supabase: { functions: { invoke: invokeMock } },
  isSupabaseConfigured: true,
}))

const { parseJobUrl } = await import('../jobParser')

afterEach(() => {
  invokeMock.mockReset()
})

describe('parseJobUrl', () => {
  it('rejects an invalid URL without calling the Edge Function', async () => {
    const result = await parseJobUrl('not a url')
    expect(result.status).toBe('failed')
    expect(invokeMock).not.toHaveBeenCalled()
  })

  it('calls the parse-job Edge Function with the URL and returns success when all core fields are present', async () => {
    invokeMock.mockResolvedValue({
      data: {
        company: 'Acme Corp',
        role: 'Senior Engineer',
        jd: 'Build great things. We sponsor H-1B visas.',
        location: 'New York, NY',
        sponsorship: 'Yes',
        source: 'json-ld',
        warnings: [],
      },
      error: null,
    })

    const result = await parseJobUrl('https://example.com/jobs/1')

    expect(invokeMock).toHaveBeenCalledWith('parse-job', { body: { url: 'https://example.com/jobs/1' } })
    expect(result.status).toBe('success')
    if (result.status !== 'failed') {
      expect(result.fields.company).toBe('Acme Corp')
      expect(result.fields.sponsorship).toBe('Yes')
      expect(result.fields.location).toBe('New York, NY')
    }
  })

  it('returns partial when only some fields are found', async () => {
    invokeMock.mockResolvedValue({
      data: {
        company: null,
        role: 'Backend Engineer',
        jd: null,
        location: null,
        sponsorship: 'Unknown',
        source: 'semantic-fallback',
        warnings: ['Could not extract: company, description, location. Enter these fields manually.'],
      },
      error: null,
    })

    const result = await parseJobUrl('https://example.com/jobs/2')
    expect(result.status).toBe('partial')
  })

  it('returns failed with a helpful message when the Edge Function call errors', async () => {
    invokeMock.mockResolvedValue({ data: null, error: new Error('network error') })
    const result = await parseJobUrl('https://example.com/jobs/3')
    expect(result.status).toBe('failed')
    expect(result.message).toMatch(/could not be accessed/i)
  })

  it('returns failed (never throws) when no fields could be extracted at all', async () => {
    invokeMock.mockResolvedValue({
      data: {
        company: null,
        role: null,
        jd: null,
        location: null,
        sponsorship: 'Unknown',
        source: 'none',
        warnings: ['This page could not be accessed (HTTP 403). Enter the details manually.'],
      },
      error: null,
    })
    const result = await parseJobUrl('https://example.com/jobs/4')
    expect(result.status).toBe('failed')
  })
})
