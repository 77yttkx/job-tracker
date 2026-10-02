-- Job Tracker V3.6 migration: Application Source tracking + source-level
-- performance analytics.
--
-- Two independent, purely additive pieces on top of the existing schema:
--
--   1. A new `application_source` column on public.jobs (constrained
--      text, following the exact same pattern as `sponsorship` in
--      supabase-v2-migration.sql), defaulting both existing rows and any
--      future row that omits it to 'Unknown'. Source is only ever set by
--      an explicit user choice (Add/Edit modal, Table inline edit, or a
--      recognized CSV/Excel import column) - it is NEVER inferred from
--      job_url, company, role, jd, notes, or any other field.
--
--   2. A new read-only RPC, analytics_source_performance(), built on the
--      same "fully tracked" cohort principle V3.5's Application Funnel
--      already uses (a job_status_events row with from_status is null -
--      see supabase-v3_5-application-funnel.sql's header comment for the
--      full reasoning). This migration does not alter, recreate, or in
--      any way depend on changing V3.3, V3.4, or V3.5 - it only reads
--      public.jobs and public.job_status_events, which those migrations
--      already created.
--
-- Run this once in the Supabase SQL editor, after
-- supabase-v3_3-sql-analytics.sql (analytics_source_performance() reads
-- public.job_status_events, which that migration creates). Safe to run
-- more than once: the column add uses `if not exists`, the check
-- constraint is dropped and recreated, and the function uses
-- `create or replace`.

-- =============================================================================
-- 1. application_source column
-- =============================================================================

alter table public.jobs
  add column if not exists application_source text not null default 'Unknown';

alter table public.jobs
  drop constraint if exists jobs_application_source_check;

alter table public.jobs
  add constraint jobs_application_source_check check (
    application_source in (
      'Company Website',
      'LinkedIn',
      'Referral',
      'Handshake',
      'Career Fair',
      'Recruiter',
      'Other',
      'Unknown'
    )
  );

-- =============================================================================
-- 2. analytics_source_performance() - descriptive, non-causal
-- =============================================================================
--
-- Answers "how do my tracked application channels compare?" - strictly
-- descriptive. No causal inference, no significance testing, no
-- confidence intervals, no predictive modeling, no A/B testing. Raw
-- counts only; every percentage shown to the user is computed in the
-- frontend (src/components/insights/analytics/ApplicationSourcePerformanceCard.tsx),
-- never in SQL.
--
-- ---------------------------------------------------------------------------
-- Why this RPC returns TWO different denominators per source
-- ---------------------------------------------------------------------------
-- `application_count` is every application ever recorded for that
-- source - a plain count needs no event history, so it is never gated by
-- the cohort below.
--
-- `tracked_count` is the subset of that source's applications with a
-- job_status_events row where from_status is null, i.e. the same
-- "complete recorded history" cohort V3.5 uses. `response_count` and
-- `interview_count` are computed ONLY within that subset, because a job
-- without full history cannot be safely counted as having responded or
-- not - it may genuinely have progressed further than its recorded
-- events show.
--
-- These two counts are NOT the same number, and the UI must never
-- conflate them (see the card's own comment and the README): a source
-- can have 20 total applications but only 12 with complete history, and
-- a response/interview rate is only ever "N of <tracked_count>", never
-- "N of <application_count>".
--
-- ---------------------------------------------------------------------------
-- Response / Interview definitions (identical to V3.4/V3.5)
-- ---------------------------------------------------------------------------
--   Employer Response: 'OA', '1st Round', '2nd Round', 'Final Round', 'Offer', 'Rejected'
--   Interview:          '1st Round', '2nd Round', 'Final Round', 'Offer'
--
-- 'Applied' never qualifies (starting state); 'Ghosted' never counts as
-- an Employer Response (a status the user assigns themselves, not
-- something the employer did) - same reasoning as Time to Response and
-- Application Funnel.

create or replace function public.analytics_source_performance()
returns table (
  application_source text,
  application_count bigint,
  tracked_count bigint,
  response_count bigint,
  interview_count bigint
)
language sql
security invoker
stable
set search_path = public
as $$
  with tracked as (
    -- Every job for this user with a from_status-is-null event, i.e.
    -- the complete-history cohort (see header comment above).
    select distinct job_id
    from public.job_status_events
    where user_id = auth.uid()
      and from_status is null
  ),
  reached as (
    -- One row per tracked job, with a boolean per outcome for whether
    -- ANY of its recorded events qualifies.
    select
      e.job_id,
      bool_or(e.to_status in ('OA', '1st Round', '2nd Round', 'Final Round', 'Offer', 'Rejected')) as got_response,
      bool_or(e.to_status in ('1st Round', '2nd Round', 'Final Round', 'Offer')) as got_interview
    from public.job_status_events e
    join tracked t on t.job_id = e.job_id
    where e.user_id = auth.uid()
    group by e.job_id
  )
  select
    j.application_source,
    count(*)::bigint as application_count,
    count(*) filter (where t.job_id is not null)::bigint as tracked_count,
    count(*) filter (where r.got_response)::bigint as response_count,
    count(*) filter (where r.got_interview)::bigint as interview_count
  from public.jobs j
  left join tracked t on t.job_id = j.job_id
  left join reached r on r.job_id = j.job_id
  where j.user_id = auth.uid()
  group by j.application_source;
$$;

revoke execute on function public.analytics_source_performance() from public;
grant execute on function public.analytics_source_performance() to authenticated;

-- =============================================================================
-- Verifying scope
-- =============================================================================
-- This migration adds exactly one column (+ its check constraint) and
-- one function. It does not create, drop, or alter any table, trigger,
-- RLS policy, or index, and it does not redefine any V3.3/V3.4/V3.5
-- function - `select proname from pg_proc where proname like
-- 'analytics_%'` before and after shows analytics_source_performance
-- added, with every previously-existing function (including
-- analytics_application_funnel_progression from V3.5) completely
-- unchanged.
