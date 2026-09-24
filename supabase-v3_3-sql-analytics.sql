-- Job Tracker V3.3 migration: adds a read-only "SQL Analytics Lab" data
-- layer on top of the existing single `public.jobs` table.
--
-- This migration is purely additive:
--   1. Creates one new table, public.job_status_events, that records
--      status changes on public.jobs from this point forward.
--   2. Attaches two triggers to public.jobs (AFTER INSERT, AFTER UPDATE
--      OF status) that are the ONLY writer of that new table.
--   3. Creates a set of read-only, auth.uid()-scoped SQL functions
--      (RPCs) that the frontend calls via supabase.rpc(...) instead of
--      sending any SQL of its own.
--
-- It does NOT alter any existing public.jobs column, does NOT touch any
-- existing public.jobs RLS policy (the four policies from
-- supabase-v2_6-multi-user.sql are untouched), and does NOT delete or
-- modify any existing job row. Safe to run more than once - every
-- statement is idempotent (create table/index/policy/function if not
-- exists, or create-or-replace for functions).
--
-- Run this in the Supabase SQL Editor, once, against a database that
-- already has supabase-v2_6-multi-user.sql applied (multi-user RLS on
-- public.jobs must already be in place).

-- =============================================================================
-- PART 1 - public.job_status_events
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1.1 Table
-- ---------------------------------------------------------------------------
-- `from_status` is nullable (a brand-new job's first event has no "from"),
-- `to_status` is not null (every event, by definition, has a resulting
-- status). Both reference the same status vocabulary as public.jobs.status
-- (src/lib/constants.ts JOB_STATUSES), but are NOT foreign-keyed to a
-- lookup table or CHECK-constrained here on purpose - same reasoning as
-- public.jobs.status itself and behavior_answers.tags: the authoritative
-- set of valid values lives in application code
-- (src/lib/interviewPrepConstants.ts's sibling, src/lib/constants.ts),
-- and this trigger-only-written table can only ever contain values that
-- were already valid on public.jobs at write time (public.jobs.status has
-- its own check constraint - see supabase-schema.sql), so a second,
-- duplicate constraint here would just be one more place to keep in sync.
create table if not exists public.job_status_events (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs (job_id) on delete cascade,
  user_id uuid not null references auth.users (id),
  from_status text,
  to_status text not null,
  changed_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 1.2 Indexes
-- ---------------------------------------------------------------------------
-- Every analytics RPC in Part 3 either filters by (user_id, changed_at)
-- (time-series/weekly aggregates) or joins per (job_id, to_status) to find
-- a job's first arrival at a given stage - both patterns are covered.
create index if not exists job_status_events_user_changed_idx
  on public.job_status_events (user_id, changed_at);

create index if not exists job_status_events_job_changed_idx
  on public.job_status_events (job_id, changed_at);

create index if not exists job_status_events_user_to_status_idx
  on public.job_status_events (user_id, to_status);

-- ---------------------------------------------------------------------------
-- 1.3 Row Level Security
-- ---------------------------------------------------------------------------
alter table public.job_status_events enable row level security;

-- Belt-and-suspenders beyond RLS, same pattern as supabase-v2_6-multi-user.sql:
-- unauthenticated requests are rejected at the grant level, before RLS is
-- even evaluated.
revoke all on public.job_status_events from anon;

-- Users may only ever SELECT their own events. Note there is deliberately
-- NO insert/update/delete grant to `authenticated` here - see the
-- "Why the frontend cannot write to job_status_events" note in Part 2
-- below. This is what makes "Users must not be able to directly insert,
-- edit, or delete their own status events from the frontend" true at the
-- database level, not just by omission in the app's UI.
grant select on public.job_status_events to authenticated;

drop policy if exists "job_status_events select own" on public.job_status_events;
create policy "job_status_events select own" on public.job_status_events
  for select to authenticated
  using (user_id = auth.uid());

-- No insert/update/delete policy is created for `authenticated` at all.
-- With no grant AND no policy for those operations, PostgREST/Supabase
-- rejects any such request before it can reach the table.

-- =============================================================================
-- PART 2 - Trigger: the only writer of job_status_events
-- =============================================================================
--
-- Why the frontend cannot write to job_status_events:
--   `authenticated` has no insert/update/delete grant on this table (Part
--   1.3), so a direct `supabase.from('job_status_events').insert(...)`
--   call from the browser is rejected by Postgres before RLS is even
--   consulted. The ONLY path that can add a row is this trigger function,
--   which is:
--     - `security definer`, so it executes with the privileges of its
--       OWNER (the role that runs this migration in the SQL Editor -
--       typically `postgres`), not the privileges of the `authenticated`
--       user whose insert/update on public.jobs fired it. That owner also
--       owns job_status_events, so its writes are not blocked by RLS
--       (Postgres does not apply RLS to a table's owner unless `FORCE ROW
--       LEVEL SECURITY` is set, which this migration deliberately does
--       NOT set).
--     - `set search_path = public, pg_temp`, pinned explicitly so a
--       malicious search_path cannot make this definer-rights function
--       resolve an attacker-controlled object instead of the real
--       public.job_status_events (the standard Postgres SECURITY DEFINER
--       hardening recommendation).
--     - Never accepts or executes any text supplied by the caller: every
--       value it inserts (job_id, user_id, from_status, to_status) comes
--       only from NEW/OLD, the row Postgres itself is already
--       inserting/updating in public.jobs under that table's own RLS
--       policies - the function has no parameters, and does not run any
--       dynamic/EXECUTE'd SQL. A user who is not allowed (by public.jobs'
--       own RLS) to write a given job row can never cause an event for it
--       to be recorded, because the trigger only fires as a side effect
--       of a write public.jobs' own policies already approved.
--   In short: SECURITY DEFINER here is not "everyone can write" - it is
--   "the one deterministic, parameter-free code path this migration
--   creates can write, and nothing else can."
create or replace function public.record_job_status_event()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'INSERT' then
    -- Initial event for a newly created job: no prior status, so
    -- from_status is left null.
    insert into public.job_status_events (job_id, user_id, from_status, to_status, changed_at)
    values (new.job_id, new.user_id, null, new.status, now());
  elsif tg_op = 'UPDATE' then
    -- `AFTER UPDATE OF status` already limits firing to statements that
    -- assign the status column, but that can still include a no-op
    -- assignment (e.g. `set status = status`) - this guard is what makes
    -- "an event only when the status actually changes" true.
    if new.status is distinct from old.status then
      insert into public.job_status_events (job_id, user_id, from_status, to_status, changed_at)
      values (new.job_id, new.user_id, old.status, new.status, now());
    end if;
  end if;
  return new;
end;
$$;

-- No EXECUTE grant is given to anyone - trigger firing does not require
-- the row-modifying role to hold EXECUTE on the trigger function, and
-- this function is never intended to be called directly (e.g. via an
-- RPC). Revoking the PUBLIC EXECUTE grant that CREATE FUNCTION applies by
-- default closes off that direct-call path entirely.
revoke execute on function public.record_job_status_event() from public;

drop trigger if exists jobs_status_insert_event on public.jobs;
create trigger jobs_status_insert_event
  after insert on public.jobs
  for each row
  execute function public.record_job_status_event();

drop trigger if exists jobs_status_update_event on public.jobs;
create trigger jobs_status_update_event
  after update of status on public.jobs
  for each row
  execute function public.record_job_status_event();

-- IMPORTANT - no backfill: this migration deliberately does not insert a
-- synthetic "initial" event for any job that already existed before it
-- ran. We do not know when those jobs' past status changes actually
-- happened, and inventing timestamps for them would make every duration
-- metric in Part 3 silently wrong. Every job's status-history in this app
-- therefore begins at whichever of these two moments comes later: the job
-- was created, or this migration was run. The SQL Analytics Lab UI states
-- this limitation directly (see src/components/insights/analytics/StatusHistoryCard.tsx).

-- =============================================================================
-- PART 3 - Read-only analytics RPCs
-- =============================================================================
-- Every function below is:
--   - `language sql` (a single query, nothing procedural/dynamic)
--   - `security invoker`, so it runs as the CALLING user (the
--     `authenticated` role, under that user's own session) - it inherits
--     public.jobs/public.job_status_events' existing RLS exactly as any
--     other query that user ran would, rather than bypassing it.
--   - additionally filtered by `where user_id = auth.uid()` in the query
--     body itself, so results are scoped correctly even if RLS were ever
--     misconfigured - belt-and-suspenders, the same principle the rest of
--     this app already follows (see supabase-v2_6-multi-user.sql).
--   - `stable`, since it only reads and returns the same result for the
--     same auth.uid()/arguments within one statement.
--   - granted EXECUTE only to `authenticated` (PUBLIC's default EXECUTE
--     grant is explicitly revoked), and read only - none of them insert,
--     update, or delete anything, and none of them accept or run any
--     caller-supplied SQL text.

-- ---------------------------------------------------------------------------
-- A. Application Funnel - COUNT / GROUP BY / ORDER BY
-- ---------------------------------------------------------------------------
create or replace function public.analytics_application_funnel()
returns table (status text, job_count bigint)
language sql
security invoker
stable
set search_path = public
as $$
  select
    status,
    count(*)::bigint as job_count
  from public.jobs
  where user_id = auth.uid()
  group by status
  order by
    case status
      when 'Applied' then 1
      when 'OA' then 2
      when '1st Round' then 3
      when '2nd Round' then 4
      when 'Final Round' then 5
      when 'Offer' then 6
      when 'Rejected' then 7
      when 'Ghosted' then 8
      else 9
    end;
$$;

revoke execute on function public.analytics_application_funnel() from public;
grant execute on function public.analytics_application_funnel() to authenticated;

-- ---------------------------------------------------------------------------
-- B. Company Outcomes - GROUP BY / CASE WHEN / conditional aggregation
-- ---------------------------------------------------------------------------
create or replace function public.analytics_company_outcomes()
returns table (
  company text,
  total_applications bigint,
  interview_stage_count bigint,
  offer_count bigint,
  rejected_count bigint
)
language sql
security invoker
stable
set search_path = public
as $$
  select
    coalesce(nullif(trim(company), ''), 'Unknown company') as company,
    count(*)::bigint as total_applications,
    count(case when status in ('OA', '1st Round', '2nd Round', 'Final Round') then 1 end)::bigint
      as interview_stage_count,
    count(case when status = 'Offer' then 1 end)::bigint as offer_count,
    count(case when status = 'Rejected' then 1 end)::bigint as rejected_count
  from public.jobs
  where user_id = auth.uid()
  group by coalesce(nullif(trim(company), ''), 'Unknown company')
  order by total_applications desc, company asc;
$$;

revoke execute on function public.analytics_company_outcomes() from public;
grant execute on function public.analytics_company_outcomes() to authenticated;

-- ---------------------------------------------------------------------------
-- C. Sponsorship Analysis - conditional aggregation / null-safe grouping
-- ---------------------------------------------------------------------------
create or replace function public.analytics_sponsorship_outcomes()
returns table (
  sponsorship text,
  total_applications bigint,
  offer_count bigint,
  rejected_count bigint,
  active_count bigint
)
language sql
security invoker
stable
set search_path = public
as $$
  select
    coalesce(sponsorship, 'Unknown') as sponsorship,
    count(*)::bigint as total_applications,
    count(case when status = 'Offer' then 1 end)::bigint as offer_count,
    count(case when status = 'Rejected' then 1 end)::bigint as rejected_count,
    count(case when status not in ('Offer', 'Rejected', 'Ghosted') then 1 end)::bigint as active_count
  from public.jobs
  where user_id = auth.uid()
  group by coalesce(sponsorship, 'Unknown')
  order by total_applications desc;
$$;

revoke execute on function public.analytics_sponsorship_outcomes() from public;
grant execute on function public.analytics_sponsorship_outcomes() to authenticated;

-- ---------------------------------------------------------------------------
-- D. Application Trend - date functions / time grouping / ordered series
-- ---------------------------------------------------------------------------
-- `granularity` is not interpolated into any SQL text (no dynamic SQL / no
-- EXECUTE): the CASE expression below forces it to resolve to exactly the
-- literal 'week' or 'month' before it is ever passed to date_trunc, so an
-- arbitrary caller-supplied string has no way to reach date_trunc as
-- anything other than one of those two fixed values.
create or replace function public.analytics_application_trend(granularity text default 'month')
returns table (period_start date, job_count bigint)
language sql
security invoker
stable
set search_path = public
as $$
  select
    date_trunc(
      case when granularity = 'week' then 'week' else 'month' end,
      applied_date
    )::date as period_start,
    count(*)::bigint as job_count
  from public.jobs
  where user_id = auth.uid()
    and applied_date is not null
  group by period_start
  order by period_start asc;
$$;

revoke execute on function public.analytics_application_trend(text) from public;
grant execute on function public.analytics_application_trend(text) to authenticated;

-- ---------------------------------------------------------------------------
-- E. Status History - built entirely from job_status_events, which only
--    exists from this migration forward (see the "no backfill" note in
--    Part 2). Each function below only ever aggregates events that
--    genuinely exist; none of them invent or estimate a duration for a
--    job that is missing one of the two events a duration needs.
-- ---------------------------------------------------------------------------

-- E1. Status transitions per week (a raw activity timeline).
create or replace function public.analytics_status_transitions_by_week()
returns table (week_start date, transition_count bigint)
language sql
security invoker
stable
set search_path = public
as $$
  select
    date_trunc('week', changed_at)::date as week_start,
    count(*)::bigint as transition_count
  from public.job_status_events
  where user_id = auth.uid()
  group by week_start
  order by week_start asc;
$$;

revoke execute on function public.analytics_status_transitions_by_week() from public;
grant execute on function public.analytics_status_transitions_by_week() to authenticated;

-- E2. Distinct jobs that reached each stage at least once, since tracking
--     began (i.e. have a recorded event, not an inferred one).
create or replace function public.analytics_stage_reach_counts()
returns table (stage text, reached_count bigint)
language sql
security invoker
stable
set search_path = public
as $$
  select
    to_status as stage,
    count(distinct job_id)::bigint as reached_count
  from public.job_status_events
  where user_id = auth.uid()
    and to_status in ('OA', '1st Round', '2nd Round', 'Final Round', 'Offer')
  group by to_status
  order by
    case to_status
      when 'OA' then 1
      when '1st Round' then 2
      when '2nd Round' then 3
      when 'Final Round' then 4
      when 'Offer' then 5
      else 6
    end;
$$;

revoke execute on function public.analytics_stage_reach_counts() from public;
grant execute on function public.analytics_stage_reach_counts() to authenticated;

-- E3. Average time-to-stage, computed ONLY over jobs that have BOTH the
--     "Applied" event and the target event (inner joins below naturally
--     exclude every job missing either one - no duration is ever
--     invented). Applied-to-target arrivals that appear inverted
--     (target recorded before Applied - not possible under normal use,
--     but excluded defensively) are also excluded.
create or replace function public.analytics_avg_stage_durations()
returns table (stage text, avg_days numeric, sample_size bigint)
language sql
security invoker
stable
set search_path = public
as $$
  with applied_events as (
    select job_id, min(changed_at) as applied_at
    from public.job_status_events
    where user_id = auth.uid() and to_status = 'Applied'
    group by job_id
  ),
  oa_events as (
    select job_id, min(changed_at) as reached_at
    from public.job_status_events
    where user_id = auth.uid() and to_status = 'OA'
    group by job_id
  ),
  first_interview_events as (
    select job_id, min(changed_at) as reached_at
    from public.job_status_events
    where user_id = auth.uid() and to_status in ('1st Round', '2nd Round', 'Final Round')
    group by job_id
  ),
  oa_durations as (
    select extract(epoch from (o.reached_at - a.applied_at)) / 86400.0 as days
    from applied_events a
    join oa_events o on o.job_id = a.job_id
    where o.reached_at >= a.applied_at
  ),
  interview_durations as (
    select extract(epoch from (i.reached_at - a.applied_at)) / 86400.0 as days
    from applied_events a
    join first_interview_events i on i.job_id = a.job_id
    where i.reached_at >= a.applied_at
  )
  select 'Applied to OA' as stage, round(avg(days)::numeric, 1) as avg_days, count(*)::bigint as sample_size
  from oa_durations
  union all
  select 'Applied to first interview' as stage, round(avg(days)::numeric, 1) as avg_days, count(*)::bigint as sample_size
  from interview_durations;
$$;

revoke execute on function public.analytics_avg_stage_durations() from public;
grant execute on function public.analytics_avg_stage_durations() to authenticated;

-- =============================================================================
-- Verifying scope
-- =============================================================================
-- This migration adds one new table (job_status_events), two triggers on
-- public.jobs, one trigger function, and seven read-only RPC functions.
-- It does not add, drop, or alter any column on public.jobs, and does not
-- create, drop, or alter any RLS policy on public.jobs. You can confirm
-- this yourself: `\d public.jobs` before and after this migration shows
-- an identical column list, and
-- `select policyname from pg_policies where tablename = 'jobs'` returns
-- the same four policy names ("jobs select own", "jobs insert own",
-- "jobs update own", "jobs delete own") as before.
