import { isSupabaseConfigured, supabase } from './supabase'
import { toQueryError } from './supabaseError'
import type {
  ApplicationFunnelRow,
  ApplicationTrendRow,
  AvgStageDurationRow,
  CompanyOutcomeRow,
  SponsorshipOutcomeRow,
  StageReachRow,
  StatusTransitionWeekRow,
  TrendGranularity,
} from '../types/analytics'

/**
 * Data-access layer for the SQL Analytics Lab (Insights). Every function
 * here calls a Postgres RPC defined in supabase-v3_3-sql-analytics.sql via
 * `supabase.rpc(...)` - never a hand-built query, and never any SQL
 * string assembled in the browser. Each RPC is `security invoker` and
 * filters by `auth.uid()` on the server, so these calls only ever return
 * the signed-in user's own data; there is no parameter here (or anywhere
 * in this file) that lets a caller ask for another user's rows.
 */

function assertConfigured(): void {
  if (!isSupabaseConfigured) {
    throw new Error(
      'Supabase is not configured. Copy .env.example to .env, fill in VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY, and restart the dev server.',
    )
  }
}

export async function fetchApplicationFunnel(): Promise<ApplicationFunnelRow[]> {
  assertConfigured()
  const { data, error } = await supabase.rpc('analytics_application_funnel')
  if (error) throw toQueryError(error)
  return (data ?? []) as ApplicationFunnelRow[]
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

export async function fetchStatusTransitionsByWeek(): Promise<StatusTransitionWeekRow[]> {
  assertConfigured()
  const { data, error } = await supabase.rpc('analytics_status_transitions_by_week')
  if (error) throw toQueryError(error)
  return (data ?? []) as StatusTransitionWeekRow[]
}

export async function fetchStageReachCounts(): Promise<StageReachRow[]> {
  assertConfigured()
  const { data, error } = await supabase.rpc('analytics_stage_reach_counts')
  if (error) throw toQueryError(error)
  return (data ?? []) as StageReachRow[]
}

export async function fetchAvgStageDurations(): Promise<AvgStageDurationRow[]> {
  assertConfigured()
  const { data, error } = await supabase.rpc('analytics_avg_stage_durations')
  if (error) throw toQueryError(error)
  return (data ?? []) as AvgStageDurationRow[]
}
