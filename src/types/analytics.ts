/**
 * Row shapes returned by Insights' analytics RPCs
 * (supabase-v3_3-sql-analytics.sql, supabase-v3_4-time-to-response.sql,
 * supabase-v3_5-application-funnel.sql, supabase-v3_6-application-source.sql).
 * Every RPC is scoped to the calling user (auth.uid()) server-side, so
 * these types intentionally carry no user_id field - the frontend never
 * needs to (and cannot) request another user's rows.
 */

export interface CompanyOutcomeRow {
  company: string
  total_applications: number
  interview_stage_count: number
  offer_count: number
  rejected_count: number
}

export interface SponsorshipOutcomeRow {
  sponsorship: string
  total_applications: number
  offer_count: number
  rejected_count: number
  active_count: number
}

export interface ApplicationTrendRow {
  period_start: string // ISO date (YYYY-MM-DD), start of the week/month bucket
  job_count: number
}

export type TrendGranularity = 'week' | 'month'

/**
 * Time to Response (V3.4). See supabase-v3_4-time-to-response.sql for the
 * full metric definition. Anchor is jobs.applied_date, never the first
 * job_status_events row - see that migration's header comment for why.
 */
export interface TimeToResponseSummaryRow {
  median_days: number | null
  sample_size: number
}

export interface ResponseTimeDistributionRow {
  bucket: string
  job_count: number
}

export interface StillWaitingRow {
  waiting_count: number
  longest_wait_days: number | null
}

/**
 * Application Funnel (V3.5) - raw cumulative stage counts, scoped to the
 * analyzable cohort (jobs with a from_status-is-null job_status_events
 * row - see supabase-v3_5-application-funnel.sql for the full
 * definition). % of cohort and previous-stage conversion are derived in
 * the frontend from these counts, not returned by the RPC.
 */
export interface FunnelProgressionRow {
  cohort_total: number
  response_count: number
  interview_count: number
  final_round_count: number
  offer_count: number
}

/**
 * Application Source Performance (V3.6) - raw counts per source, scoped
 * to the calling user. `application_count` is EVERY application from
 * that source (ungated); `tracked_count` is the subset with complete
 * recorded event history (the same from_status-is-null cohort as
 * FunnelProgressionRow above); `response_count`/`interview_count` are
 * computed ONLY within that tracked subset. See
 * supabase-v3_6-application-source.sql for the full definition, and
 * ApplicationSourcePerformanceCard.tsx for why application_count and
 * tracked_count must always be shown as visibly distinct numbers.
 */
export interface SourcePerformanceRow {
  application_source: string
  application_count: number
  tracked_count: number
  response_count: number
  interview_count: number
}
