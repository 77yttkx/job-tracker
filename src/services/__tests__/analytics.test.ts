import { afterEach, describe, expect, it, vi } from 'vitest'

// Every analytics fetch* function must call supabase.rpc(...) with a
// fixed, hard-coded function name - never a hand-built query, never a
// caller-supplied string as the function name, and never any arbitrary SQL
// text sent from the browser. This test mocks supabase.rpc and asserts on
// exactly what each service function calls it with, same convention as
// src/services/__tests__/answers.test.ts (which mocks supabase.from).

const rpcMock = vi.fn()

vi.mock('../supabase', () => ({
  supabase: { rpc: rpcMock },
  isSupabaseConfigured: true,
}))

const {
  fetchCompanyOutcomes,
  fetchSponsorshipOutcomes,
  fetchApplicationTrend,
  fetchTimeToResponseSummary,
  fetchResponseTimeDistribution,
  fetchStillWaiting,
  fetchApplicationFunnelProgression,
} = await import('../analytics')

afterEach(() => {
  rpcMock.mockReset()
})

describe('analytics service (Insights data-access layer)', () => {
  it('fetchCompanyOutcomes calls the analytics_company_outcomes RPC', async () => {
    rpcMock.mockResolvedValue({ data: [], error: null })
    await fetchCompanyOutcomes()
    expect(rpcMock).toHaveBeenCalledWith('analytics_company_outcomes')
  })

  it('fetchSponsorshipOutcomes calls the analytics_sponsorship_outcomes RPC', async () => {
    rpcMock.mockResolvedValue({ data: [], error: null })
    await fetchSponsorshipOutcomes()
    expect(rpcMock).toHaveBeenCalledWith('analytics_sponsorship_outcomes')
  })

  it('fetchApplicationTrend defaults to month granularity and passes it through as a plain argument', async () => {
    rpcMock.mockResolvedValue({ data: [], error: null })
    await fetchApplicationTrend()
    expect(rpcMock).toHaveBeenCalledWith('analytics_application_trend', { granularity: 'month' })
  })

  it('fetchApplicationTrend passes week granularity through unchanged', async () => {
    rpcMock.mockResolvedValue({ data: [], error: null })
    await fetchApplicationTrend('week')
    expect(rpcMock).toHaveBeenCalledWith('analytics_application_trend', { granularity: 'week' })
  })

  it('fetchTimeToResponseSummary calls the analytics_time_to_response_summary RPC and returns the first row', async () => {
    rpcMock.mockResolvedValue({ data: [{ median_days: 5, sample_size: 12 }], error: null })
    const row = await fetchTimeToResponseSummary()
    expect(rpcMock).toHaveBeenCalledWith('analytics_time_to_response_summary')
    expect(row).toEqual({ median_days: 5, sample_size: 12 })
  })

  it('fetchTimeToResponseSummary falls back to a zero/null row when the RPC returns no rows', async () => {
    rpcMock.mockResolvedValue({ data: [], error: null })
    const row = await fetchTimeToResponseSummary()
    expect(row).toEqual({ median_days: null, sample_size: 0 })
  })

  it('fetchResponseTimeDistribution calls the analytics_response_time_distribution RPC', async () => {
    rpcMock.mockResolvedValue({ data: [{ bucket: '0-3 days', job_count: 4 }], error: null })
    const rows = await fetchResponseTimeDistribution()
    expect(rpcMock).toHaveBeenCalledWith('analytics_response_time_distribution')
    expect(rows).toEqual([{ bucket: '0-3 days', job_count: 4 }])
  })

  it('fetchStillWaiting calls the analytics_still_waiting RPC and returns the first row', async () => {
    rpcMock.mockResolvedValue({ data: [{ waiting_count: 2, longest_wait_days: 9 }], error: null })
    const row = await fetchStillWaiting()
    expect(rpcMock).toHaveBeenCalledWith('analytics_still_waiting')
    expect(row).toEqual({ waiting_count: 2, longest_wait_days: 9 })
  })

  it('fetchStillWaiting falls back to a zero/null row when the RPC returns no rows', async () => {
    rpcMock.mockResolvedValue({ data: [], error: null })
    const row = await fetchStillWaiting()
    expect(row).toEqual({ waiting_count: 0, longest_wait_days: null })
  })

  it('fetchApplicationFunnelProgression calls the analytics_application_funnel_progression RPC (not the old current-status analytics_application_funnel RPC) and returns the first row', async () => {
    rpcMock.mockResolvedValue({
      data: [{ cohort_total: 68, response_count: 18, interview_count: 8, final_round_count: 3, offer_count: 1 }],
      error: null,
    })
    const row = await fetchApplicationFunnelProgression()
    expect(rpcMock).toHaveBeenCalledWith('analytics_application_funnel_progression')
    expect(rpcMock).not.toHaveBeenCalledWith('analytics_application_funnel')
    expect(row).toEqual({ cohort_total: 68, response_count: 18, interview_count: 8, final_round_count: 3, offer_count: 1 })
  })

  it('fetchApplicationFunnelProgression falls back to an all-zero row when the RPC returns no rows', async () => {
    rpcMock.mockResolvedValue({ data: [], error: null })
    const row = await fetchApplicationFunnelProgression()
    expect(row).toEqual({ cohort_total: 0, response_count: 0, interview_count: 0, final_round_count: 0, offer_count: 0 })
  })

  it('returns an empty array (not null/undefined) when the RPC resolves with null data', async () => {
    rpcMock.mockResolvedValue({ data: null, error: null })
    const rows = await fetchCompanyOutcomes()
    expect(rows).toEqual([])
  })

  it('throws a SupabaseQueryError (via toQueryError) when the RPC reports an error, and does not silently swallow it', async () => {
    rpcMock.mockResolvedValue({
      data: null,
      error: { message: 'permission denied for function analytics_company_outcomes', code: '42501' },
    })
    await expect(fetchCompanyOutcomes()).rejects.toMatchObject({
      name: 'SupabaseQueryError',
      message: 'permission denied for function analytics_company_outcomes',
      code: '42501',
    })
  })

  it('every analytics RPC call name is a fixed string literal, never built from a variable at the call site', async () => {
    // Source-level check on this same module: guards against a future edit
    // reintroducing a caller-influenced RPC name or a supabase.from(...)
    // write path into this read-only service file.
    const { readFileSync } = await import('node:fs')
    const { dirname, join } = await import('node:path')
    const { fileURLToPath } = await import('node:url')
    const source = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'analytics.ts'), 'utf-8')
    const codeOnly = source
      .split('\n')
      .filter((line) => !line.trim().startsWith('*') && !line.trim().startsWith('//') && !line.trim().startsWith('/**'))
      .join('\n')
    const rpcCalls = [...codeOnly.matchAll(/supabase\.rpc\(([^,)]+)/g)].map((m) => m[1].trim())
    expect(rpcCalls.length).toBeGreaterThanOrEqual(7)
    for (const arg of rpcCalls) {
      expect(arg, `expected a string literal RPC name, got: ${arg}`).toMatch(/^'[\w]+'$/)
    }
    expect(source).not.toMatch(/supabase\.from\(/)
  })
})
