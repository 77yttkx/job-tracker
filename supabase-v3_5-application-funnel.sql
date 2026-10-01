-- Job Tracker V3.5 migration: adds a read-only, event-based "Application
-- Funnel" RPC on top of the existing public.jobs / public.job_status_events
-- data model (no schema change at all - no new table, no new column, no
-- new trigger, no new or changed RLS policy).
--
-- This migration is purely additive: it only creates one new SQL
-- function (RPC). It does not touch public.jobs, public.job_status_events,
-- or anything created by supabase-v3_3-sql-analytics.sql or
-- supabase-v3_4-time-to-response.sql. Safe to run more than once - the
-- function uses `create or replace`.
--
-- Run this in the Supabase SQL Editor, once, against a database that
-- already has supabase-v3_3-sql-analytics.sql applied (this RPC reads
-- from public.job_status_events, which that migration creates).
--
-- IMPORTANT: this does NOT replace or alter analytics_application_funnel()
-- (the current-status distribution RPC from V3.3). That RPC is left
-- completely untouched in the database - this migration's own
-- "verifying scope" section below confirms it still exists afterward.
-- The frontend simply stops calling it once this migration's RPC is
-- wired in (see InsightsPage.tsx / ApplicationFunnelCard.tsx).

-- =============================================================================
-- Metric definition (product decision - see README "Application Funnel")
-- =============================================================================
--
-- Unlike analytics_application_funnel() (current status only), this is a
-- historical, event-based funnel: "how far did this application ever
-- progress", not "where does it sit today". A job can satisfy several
-- funnel stages at once - e.g. Applied -> OA -> 1st Round -> Rejected
-- counts toward Applications, Employer Response, AND Interview, even
-- though its current status is Rejected and it never reached Final
-- Round or Offer.
--
-- ---------------------------------------------------------------------------
-- The analyzable cohort (denominator) - the hard part
-- ---------------------------------------------------------------------------
-- job_status_events has NO backfill (see supabase-v3_3-sql-analytics.sql):
-- it only ever contains events recorded by its two triggers, from the
-- moment that migration was run forward. A job created before that
-- migration ran has either zero events, or - if it later changed status
-- - only events whose earliest recorded `from_status` is itself some
-- already-in-progress status, not a true "no prior status" start. Either
-- way, that job's full historical path cannot be reliably reconstructed:
-- counting it would risk silently understating conversion (it may have
-- actually reached a stage that was simply never logged step by step).
--
-- The one unambiguous, self-maintaining signal that a job's ENTIRE
-- lifecycle has been captured is a job_status_events row with
-- `from_status is null` for that job. That value is written ONLY by the
-- `after insert` trigger on public.jobs (record_job_status_event()) -
-- i.e. only when the job itself was created after event tracking began.
-- No stored "migration ran at <timestamp>" marker is needed; the data
-- itself proves coverage.
--
-- The analyzable cohort is therefore:
--   every job_id with at least one job_status_events row where
--   from_status is null, scoped to the calling user.
--
-- Consequence (accepted, not a bug): any job created before
-- supabase-v3_3-sql-analytics.sql was run is excluded from this funnel
-- entirely, even if it has since changed status, and even if it is
-- currently sitting at OA/Interview/Offer/Rejected - its earlier history
-- is simply not verifiable. This funnel will under-cover an account
-- whose jobs mostly predate that migration; Status Distribution
-- (current-status based, unaffected by any of this) remains the answer
-- to "where are my applications right now".
--
-- ---------------------------------------------------------------------------
-- Cumulative stage definitions (within the analyzable cohort only)
-- ---------------------------------------------------------------------------
-- A cohort job counts toward a stage if it has AT LEAST ONE
-- job_status_events row whose to_status is in that stage's set:
--
--   Employer Response: 'OA', '1st Round', '2nd Round', 'Final Round', 'Offer', 'Rejected'
--   Interview:          '1st Round', '2nd Round', 'Final Round', 'Offer'
--   Final Round:        'Final Round', 'Offer'
--   Offer:              'Offer'
--
-- 'Applied' never qualifies anything (it's the starting state). 'Ghosted'
-- never qualifies Employer Response (it's a status the user assigns
-- themselves when giving up waiting, not something the employer did) -
-- same reasoning as Time to Response's qualifying-response set.
--
-- This RPC returns only the raw counts below; % of cohort and
-- conversion-from-previous-stage are computed in the frontend
-- (src/components/insights/analytics/ApplicationFunnelCard.tsx), the
-- same split already used by Time to Response and the original
-- Application Funnel's own percentage math.

create or replace function public.analytics_application_funnel_progression()
returns table (
  cohort_total bigint,
  response_count bigint,
  interview_count bigint,
  final_round_count bigint,
  offer_count bigint
)
language sql
security invoker
stable
set search_path = public
as $$
  with cohort as (
    -- Every job for this user with at least one job_status_events row
    -- recorded by the AFTER INSERT trigger (from_status is null) - the
    -- analyzable population described above.
    select distinct job_id
    from public.job_status_events
    where user_id = auth.uid()
      and from_status is null
  ),
  reached as (
    -- One row per cohort job, with a boolean per stage for whether ANY
    -- of its events (not just the insert event) qualifies. Every cohort
    -- job has at least its own insert event, so every cohort job
    -- produces exactly one row here - none are lost to the join/group.
    select
      e.job_id,
      bool_or(e.to_status in ('OA', '1st Round', '2nd Round', 'Final Round', 'Offer', 'Rejected')) as got_response,
      bool_or(e.to_status in ('1st Round', '2nd Round', 'Final Round', 'Offer')) as got_interview,
      bool_or(e.to_status in ('Final Round', 'Offer')) as got_final_round,
      bool_or(e.to_status = 'Offer') as got_offer
    from public.job_status_events e
    join cohort c on c.job_id = e.job_id
    where e.user_id = auth.uid()
    group by e.job_id
  )
  select
    (select count(*) from cohort)::bigint as cohort_total,
    count(*) filter (where got_response)::bigint as response_count,
    count(*) filter (where got_interview)::bigint as interview_count,
    count(*) filter (where got_final_round)::bigint as final_round_count,
    count(*) filter (where got_offer)::bigint as offer_count
  from reached;
$$;

revoke execute on function public.analytics_application_funnel_progression() from public;
grant execute on function public.analytics_application_funnel_progression() to authenticated;

-- =============================================================================
-- Verifying scope
-- =============================================================================
-- This migration adds exactly one function and alters nothing else: no
-- new table, no new column, no new index, no new trigger, no new or
-- changed RLS policy, and no change whatsoever to V3.3's or V3.4's own
-- functions. `select proname from pg_proc where proname like
-- 'analytics_%'` before and after shows
-- analytics_application_funnel_progression added, with
-- analytics_application_funnel() (V3.3's current-status distribution,
-- left in place deliberately per product decision) and every other
-- previously-existing function completely unchanged.
