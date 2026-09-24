import { afterEach, describe, expect, it, vi } from 'vitest'

// Every SQL Analytics Lab fetch* function must call supabase.rpc(...) with
// a fixed, hard-coded function name - never a hand-built query, never a
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
  fetchApplicationFunnel,
  fetchCompanyOutcomes,
  fetchSponsorshipOutcomes,
  fetchApplicationTrend,
  fetchStatusTransitionsByWeek,
  fetchStageReachCounts,
  fetchAvgStageDurations,
} = await import('../analytics')

afterEach(() => {
  rpcMock.mockReset()
})

describe('analytics service (SQL Analytics Lab data-access layer)', () => {
  it('fetchApplicationFunnel calls the analytics_application_funnel RPC with no arguments', async () => {
    rpcMock.mockResolvedValue({ data: [{ status: 'Applied', job_count: 3 }], error: null })
    const rows = await fetchApplicationFunnel()
    expect(rpcMock).toHaveBeenCalledWith('analytics_application_funnel')
    expect(rows).toEqual([{ status: 'Applied', job_count: 3 }])
  })

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

  it('fetchStatusTransitionsByWeek calls the analytics_status_transitions_by_week RPC', async () => {
    rpcMock.mockResolvedValue({ data: [], error: null })
    await fetchStatusTransitionsByWeek()
    expect(rpcMock).toHaveBeenCalledWith('analytics_status_transitions_by_week')
  })

  it('fetchStageReachCounts calls the analytics_stage_reach_counts RPC', async () => {
    rpcMock.mockResolvedValue({ data: [], error: null })
    await fetchStageReachCounts()
    expect(rpcMock).toHaveBeenCalledWith('analytics_stage_reach_counts')
  })

  it('fetchAvgStageDurations calls the analytics_avg_stage_durations RPC', async () => {
    rpcMock.mockResolvedValue({ data: [], error: null })
    await fetchAvgStageDurations()
    expect(rpcMock).toHaveBeenCalledWith('analytics_avg_stage_durations')
  })

  it('returns an empty array (not null/undefined) when the RPC resolves with null data', async () => {
    rpcMock.mockResolvedValue({ data: null, error: null })
    const rows = await fetchApplicationFunnel()
    expect(rows).toEqual([])
  })

  it('throws a SupabaseQueryError (via toQueryError) when the RPC reports an error, and does not silently swallow it', async () => {
    rpcMock.mockResolvedValue({
      data: null,
      error: { message: 'permission denied for function analytics_application_funnel', code: '42501' },
    })
    await expect(fetchApplicationFunnel()).rejects.toMatchObject({
      name: 'SupabaseQueryError',
      message: 'permission denied for function analytics_application_funnel',
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
