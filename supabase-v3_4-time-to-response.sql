-- Job Tracker V3.4 migration: adds read-only "Time to Response" analytics
-- RPCs on top of the existing public.jobs / public.job_status_events data
-- model (no schema change at all - no new table, no new column).
--
-- This migration is purely additive: it only creates three new SQL
-- functions (RPCs). It does not touch public.jobs or
-- public.job_status_events themselves, their columns, or any existing RLS
-- policy, trigger, or function from supabase-v2_6-multi-user.sql or
-- supabase-v3_3-sql-analytics.sql. Safe to run more than once - every
-- function uses `create or replace`.
--
-- Run this in the Supabase SQL Editor, once, against a database that
-- already has supabase-v3_3-sql-analytics.sql applied (these RPCs read
-- from public.job_status_events, which that migration creates).

-- =============================================================================
-- Metric definition (product decision - see README "Time to Response")
-- =============================================================================
--
-- time_to_first_response(job) =
--   (first qualifying employer-response event's changed_at)::date
--   - jobs.applied_date
--
-- Where "qualifying employer-response event" means the earliest row in
-- job_status_events for that job whose to_status is one of:
--   'OA', '1st Round', '2nd Round', 'Final Round', 'Offer', 'Rejected'
-- and whose changed_at is on or after jobs.applied_date.
--
-- Deliberately excluded from the response set:
--   - 'Applied' - the starting state, never a response.
--   - 'Ghosted' - this is a status the USER manually assigns when they've
--     given up waiting; it is not something the employer did, so it must
--     never be counted as if the employer responded.
--
-- Anchor point is `jobs.applied_date` (the user's own record of when they
-- applied), NOT the first `job_status_events` row's `changed_at`. That
-- event timestamp only records when the job was added to this tracker,
-- which is frequently later than the real application date (e.g. the user
-- applied last week and is logging it today, or bulk-imported a job
-- that's already mid-pipeline). `jobs.applied_date` is the correct
-- product-level "when did I actually apply" anchor; `changed_at` on the
-- Applied event is a tracker bookkeeping timestamp, not that date, and
-- using it would understate or fabricate response times for exactly the
-- jobs where accuracy matters most (anything not entered on day one).
--
-- A job contributes to this metric only if ALL of the following hold:
--   1. jobs.applied_date is not null.
--   2. It has at least one job_status_events row with to_status in the
--      qualifying set AND changed_at >= applied_date (cast to a
--      timestamp at midnight) - i.e. a response recorded on or after the
--      applied date. A qualifying event that is somehow timestamped
--      *before* applied_date is not used as the response (the job is
--      excluded rather than reporting a negative/nonsensical duration).
--   3. The *earliest* such qualifying event is used - never the most
--      recent, and never today's current status alone.
--
-- Consequence (accepted, not a bug): a job whose entire event history
-- predates this migration, or whose only events are earlier than
-- applied_date, contributes nothing here. No historical response
-- timestamp is ever fabricated from current status to work around this.

-- ---------------------------------------------------------------------------
-- A. Time to Response - summary (median days + sample size)
-- ---------------------------------------------------------------------------
-- `percentile_cont(0.5)` (true median, interpolated) is preferred over
-- avg/mean per the product requirement, since response-time distributions
-- are typically right-skewed (a handful of very slow responses would pull
-- a mean upward in a way that's misleading for "how long should I expect
-- to wait").
create or replace function public.analytics_time_to_response_summary()
returns table (median_days numeric, sample_size bigint)
language sql
security invoker
stable
set search_path = public
as $$
  with responses as (
    select
      (first_response.changed_at::date - j.applied_date) as days
    from public.jobs j
    join lateral (
      select min(e.changed_at) as changed_at
      from public.job_status_events e
      where e.job_id = j.job_id
        and e.user_id = auth.uid()
        and e.to_status in ('OA', '1st Round', '2nd Round', 'Final Round', 'Offer', 'Rejected')
        and e.changed_at >= j.applied_date::timestamptz
    ) first_response on first_response.changed_at is not null
    where j.user_id = auth.uid()
      and j.applied_date is not null
  )
  select
    percentile_cont(0.5) within group (order by days) as median_days,
    count(*)::bigint as sample_size
  from responses
  where days >= 0;
$$;

revoke execute on function public.analytics_time_to_response_summary() from public;
grant execute on function public.analytics_time_to_response_summary() to authenticated;

-- ---------------------------------------------------------------------------
-- B. Time to Response - distribution across fixed day buckets
-- ---------------------------------------------------------------------------
-- Same "responses" population as (A) above. Only buckets with at least
-- one job are returned - the frontend fills in zero-value buckets for a
-- continuous chart (same convention as the existing Application Trend /
-- time-summary charts), so it can also render all five bucket labels even
-- when some are empty.
create or replace function public.analytics_response_time_distribution()
returns table (bucket text, job_count bigint)
language sql
security invoker
stable
set search_path = public
as $$
  with responses as (
    select
      (first_response.changed_at::date - j.applied_date) as days
    from public.jobs j
    join lateral (
      select min(e.changed_at) as changed_at
      from public.job_status_events e
      where e.job_id = j.job_id
        and e.user_id = auth.uid()
        and e.to_status in ('OA', '1st Round', '2nd Round', 'Final Round', 'Offer', 'Rejected')
        and e.changed_at >= j.applied_date::timestamptz
    ) first_response on first_response.changed_at is not null
    where j.user_id = auth.uid()
      and j.applied_date is not null
  ),
  bucketed as (
    select
      case
        when days <= 3 then '0-3 days'
        when days <= 7 then '4-7 days'
        when days <= 14 then '8-14 days'
        when days <= 30 then '15-30 days'
        else '30+ days'
      end as bucket
    from responses
    where days >= 0
  )
  select bucket, count(*)::bigint as job_count
  from bucketed
  group by bucket
  order by
    case bucket
      when '0-3 days' then 1
      when '4-7 days' then 2
      when '8-14 days' then 3
      when '15-30 days' then 4
      else 5
    end;
$$;

revoke execute on function public.analytics_response_time_distribution() from public;
grant execute on function public.analytics_response_time_distribution() to authenticated;

-- ---------------------------------------------------------------------------
-- C. Still Waiting - current-state metric, deliberately NOT event-based
-- ---------------------------------------------------------------------------
-- "Still waiting" is defined entirely from each job's CURRENT status
-- (status = 'Applied'), not from the absence of a qualifying event in
-- job_status_events. This is a deliberate exception to the "prefer event
-- history over current status" rule used in (A)/(B) above: the question
-- here is "which of my applications are, right now, still waiting on a
-- response", and current status answers that correctly for every job
-- regardless of when it was created - including jobs that predate
-- supabase-v3_3-sql-analytics.sql entirely and have no event history at
-- all. Relying on "no qualifying event exists" instead would incorrectly
-- flag plenty of old, already-resolved pre-migration jobs as "still
-- waiting" just because their real history was never recorded.
--
-- `waiting_count` includes every status='Applied' job for this user, even
-- one with a null applied_date (it still counts as waiting - it just
-- cannot contribute a wait-duration). `longest_wait_days` is computed
-- only over the subset that has an applied_date; it is null if none do.
create or replace function public.analytics_still_waiting()
returns table (waiting_count bigint, longest_wait_days integer)
language sql
security invoker
stable
set search_path = public
as $$
  select
    count(*)::bigint as waiting_count,
    max(case when applied_date is not null then (current_date - applied_date) end)::integer as longest_wait_days
  from public.jobs
  where user_id = auth.uid()
    and status = 'Applied';
$$;

revoke execute on function public.analytics_still_waiting() from public;
grant execute on function public.analytics_still_waiting() to authenticated;

-- =============================================================================
-- Verifying scope
-- =============================================================================
-- This migration adds exactly three functions and alters nothing else:
-- no new table, no new column, no new index, no new trigger, no new or
-- changed RLS policy. `select proname from pg_proc where proname like
-- 'analytics_%'` before and after shows the three new names
-- (analytics_time_to_response_summary, analytics_response_time_distribution,
-- analytics_still_waiting) added, with every previously-existing function
-- unchanged.
