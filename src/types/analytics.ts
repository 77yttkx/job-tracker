/**
 * Row shapes returned by the SQL Analytics Lab's RPCs
 * (supabase-v3_3-sql-analytics.sql, Part 3). Every RPC is scoped to the
 * calling user (auth.uid()) server-side, so these types intentionally
 * carry no user_id field - the frontend never needs to (and cannot)
 * request another user's rows.
 */

export interface ApplicationFunnelRow {
  status: string
  job_count: number
}

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

export interface StatusTransitionWeekRow {
  week_start: string // ISO date
  transition_count: number
}

export interface StageReachRow {
  stage: string
  reached_count: number
}

export interface AvgStageDurationRow {
  stage: string
  avg_days: number | null
  sample_size: number
}
