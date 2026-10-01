import { isSupabaseConfigured, supabase } from './supabase'
import { toQueryError } from './supabaseError'
import type {
  ApplicationTrendRow,
  CompanyOutcomeRow,
  FunnelProgressionRow,
  ResponseTimeDistributionRow,
  SponsorshipOutcomeRow,
  StillWaitingRow,
  TimeToResponseSummaryRow,
  TrendGranularity,
} from '../types/analytics'

/**
 * Data-access layer for Insights' analytics. Every function here calls a
 * Postgres RPC defined in supabase-v3_3-sql-analytics.sql,
 * supabase-v3_4-time-to-response.sql, or
 * supabase-v3_5-application-funnel.sql via `supabase.rpc(...)` - never a
 * hand-built query, and never any SQL string assembled in the browser.
 * Each RPC is `security invoker` and filters by `auth.uid()` on the
 * server, so these calls only ever return the signed-in user's own data;
 * there is no parameter here (or anywhere in this file) that lets a
 * caller ask for another user's rows.
 */

function assertConfigured(): void {
  if (!isSupabaseConfigured) {
    throw new Error(
      'Supabase is not configured. Copy .env.example to .env, fill in VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY, and restart the dev server.',
    )
  }
}

export async function fetchCompanyOutcomes(): Promise<CompanyOutcomeRow[]> {
  assertConfigured()
  const { data, error } = await supabase.rpc('analytics_company_outcomes')
  if (error) throw toQueryError(error)
  return (data ?? []) as CompanyOutcomeRow[]
}

export async function fetchSponsorshipOutcomes(): Promise<SponsorshipOutcomeRow[]> {
  assertConfigured()
  const { data, error } = await supabase.rpc('analytics_sponsorship_outcomes')
  if (error) throw toQueryError(error)
  return (data ?? []) as SponsorshipOutcomeRow[]
}

export async function fetchApplicationTrend(granularity: TrendGranularity = 'month'): Promise<ApplicationTrendRow[]> {
  assertConfigured()
  const { data, error } = await supabase.rpc('analytics_application_trend', { granularity })
  if (error) throw toQueryError(error)
  return (data ?? []) as ApplicationTrendRow[]
}

/**
 * Time to Response (V3.4). See supabase-v3_4-time-to-response.sql for the
 * full metric definition: anchored on jobs.applied_date, using only the
 * earliest qualifying employer-response event on or after that date.
 */
export async function fetchTimeToResponseSummary(): Promise<TimeToResponseSummaryRow> {
  assertConfigured()
  const { data, error } = await supabase.rpc('analytics_time_to_response_summary')
  if (error) throw toQueryError(error)
  const rows = (data ?? []) as TimeToResponseSummaryRow[]
  return rows[0] ?? { median_days: null, sample_size: 0 }
}

export async function fetchResponseTimeDistribution(): Promise<ResponseTimeDistributionRow[]> {
  assertConfigured()
  const { data, error } = await supabase.rpc('analytics_response_time_distribution')
  if (error) throw toQueryError(error)
  return (data ?? []) as ResponseTimeDistributionRow[]
}

/**
 * Still Waiting is deliberately based on each job's CURRENT status
 * (status = 'Applied'), not on event history - see the RPC's comment in
 * supabase-v3_4-time-to-response.sql for why.
 */
export async function fetchStillWaiting(): Promise<StillWaitingRow> {
  assertConfigured()
  const { data, error } = await supabase.rpc('analytics_still_waiting')
  if (error) throw toQueryError(error)
  const rows = (data ?? []) as StillWaitingRow[]
  return rows[0] ?? { waiting_count: 0, longest_wait_days: null }
}

/**
 * Application Funnel (V3.5) - event-based, cumulative stage progression
 * over the analyzable cohort (jobs with full recorded history). See
 * supabase-v3_5-application-funnel.sql for the full metric definition.
 * This intentionally does NOT call analytics_application_funnel() (the
 * V3.3 current-status distribution) - that RPC is left in the database
 * unused, per product decision, not called from the frontend anymore.
 */
export async function fetchApplicationFunnelProgression(): Promise<FunnelProgressionRow> {
  assertConfigured()
  const { data, error } = await supabase.rpc('analytics_application_funnel_progression')
  if (error) throw toQueryError(error)
  const rows = (data ?? []) as FunnelProgressionRow[]
  return (
    rows[0] ?? { cohort_total: 0, response_count: 0, interview_count: 0, final_round_count: 0, offer_count: 0 }
  )
}
