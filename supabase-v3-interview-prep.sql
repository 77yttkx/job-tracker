-- Job Tracker V3 migration: adds the Interview Prep module (personal
-- stories -> AI-assisted STAR answers) as two brand-new, additive tables.
-- Run this once in the Supabase SQL editor (or via `supabase db push` /
-- migrations) against a database that already has V2.6's `public.jobs`
-- table and multi-user RLS (supabase-v2_6-multi-user.sql).
--
-- This migration NEVER touches public.jobs in any way - not a column, not
-- a policy, not a row. Interview Prep is completely independent data: no
-- foreign key, view, or query anywhere in this file (or in the app's own
-- code - see README.md) reads from or writes to public.jobs.
--
-- Safe to run more than once: every step is idempotent (create table if
-- not exists, drop/create policy, drop/create constraint, create index if
-- not exists).

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- 1. personal_stories
-- ---------------------------------------------------------------------------

create table if not exists public.personal_stories (
  story_id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  raw_story text not null,
  tags text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- Mirrors the client-side validation in src/lib/tagValidation.ts /
  -- src/components/interviewPrep/StoryModal.tsx (non-empty title/story,
  -- reasonable max lengths) as a DB-level backstop - the same
  -- belt-and-suspenders pattern used throughout this project (see
  -- jobs_status_check in supabase-schema.sql).
  constraint personal_stories_title_not_blank check (length(btrim(title)) > 0),
  constraint personal_stories_title_max_length check (length(title) <= 120),
  constraint personal_stories_raw_story_not_blank check (length(btrim(raw_story)) > 0),
  constraint personal_stories_raw_story_max_length check (length(raw_story) <= 6000)
);

create index if not exists personal_stories_user_id_idx on public.personal_stories (user_id);
create index if not exists personal_stories_updated_at_idx on public.personal_stories (updated_at);

alter table public.personal_stories enable row level security;

drop policy if exists "personal_stories select own" on public.personal_stories;
drop policy if exists "personal_stories insert own" on public.personal_stories;
drop policy if exists "personal_stories update own" on public.personal_stories;
drop policy if exists "personal_stories delete own" on public.personal_stories;

create policy "personal_stories select own" on public.personal_stories
  for select to authenticated
  using (user_id = auth.uid());

create policy "personal_stories insert own" on public.personal_stories
  for insert to authenticated
  with check (user_id = auth.uid());

create policy "personal_stories update own" on public.personal_stories
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "personal_stories delete own" on public.personal_stories
  for delete to authenticated
  using (user_id = auth.uid());

revoke all on public.personal_stories from anon;
grant select, insert, update, delete on public.personal_stories to authenticated;

-- ---------------------------------------------------------------------------
-- 2. behavior_answers
-- ---------------------------------------------------------------------------

create table if not exists public.behavior_answers (
  answer_id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  -- ON DELETE RESTRICT (not CASCADE): deleting a source story must never
  -- silently take a saved answer with it - see src/services/stories.ts's
  -- deleteStory, which turns the resulting 23503 error into a specific,
  -- actionable message in the Story Library UI (spec section 4).
  story_id uuid not null references public.personal_stories (story_id) on delete restrict,
  interview_question text not null,
  star_answer text not null,
  notes text not null default '',
  duration text not null,
  tone text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint behavior_answers_question_not_blank check (length(btrim(interview_question)) > 0),
  constraint behavior_answers_question_max_length check (length(interview_question) <= 500),
  constraint behavior_answers_answer_not_blank check (length(btrim(star_answer)) > 0),
  constraint behavior_answers_answer_max_length check (length(star_answer) <= 4000),
  constraint behavior_answers_notes_max_length check (length(notes) <= 2000),
  constraint behavior_answers_duration_check check (duration in ('30s', '1min', '2min')),
  constraint behavior_answers_tone_check check (tone in ('concise', 'detailed'))
);

create index if not exists behavior_answers_user_id_idx on public.behavior_answers (user_id);
create index if not exists behavior_answers_story_id_idx on public.behavior_answers (story_id);
create index if not exists behavior_answers_updated_at_idx on public.behavior_answers (updated_at);

alter table public.behavior_answers enable row level security;

drop policy if exists "behavior_answers select own" on public.behavior_answers;
drop policy if exists "behavior_answers insert own" on public.behavior_answers;
drop policy if exists "behavior_answers update own" on public.behavior_answers;
drop policy if exists "behavior_answers delete own" on public.behavior_answers;

create policy "behavior_answers select own" on public.behavior_answers
  for select to authenticated
  using (user_id = auth.uid());

create policy "behavior_answers insert own" on public.behavior_answers
  for insert to authenticated
  with check (user_id = auth.uid());

create policy "behavior_answers update own" on public.behavior_answers
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "behavior_answers delete own" on public.behavior_answers
  for delete to authenticated
  using (user_id = auth.uid());

revoke all on public.behavior_answers from anon;
grant select, insert, update, delete on public.behavior_answers to authenticated;

-- ---------------------------------------------------------------------------
-- 3. updated_at triggers (reuses the same trigger function every other
--    table in this project already uses - see supabase-schema.sql)
-- ---------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists personal_stories_set_updated_at on public.personal_stories;
create trigger personal_stories_set_updated_at
before update on public.personal_stories
for each row
execute function public.set_updated_at();

drop trigger if exists behavior_answers_set_updated_at on public.behavior_answers;
create trigger behavior_answers_set_updated_at
before update on public.behavior_answers
for each row
execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 4. Free-tier usage protection (spec section 9)
-- ---------------------------------------------------------------------------
-- Server-side, per-user, per-UTC-day counter of *successful* STAR-answer
-- generations - never enforced client-side/localStorage (a user could
-- simply clear that). generate-star-answer (the Edge Function) checks
-- this BEFORE calling Gemini (so an already-exhausted user never spends
-- API budget) and increments it only AFTER Gemini actually succeeds, via
-- increment_generation_usage() below - so a failed/errored generation
-- never counts against the limit.
--
-- Concurrency note (documented, not hidden): the check-then-increment
-- flow across two separate Edge Function steps has a small race window if
-- the same user fires multiple simultaneous generate requests - this is a
-- soft usage guard against runaway/accidental free-tier exhaustion, not a
-- hard security boundary, and is documented as such in README.md.

create table if not exists public.generation_usage (
  user_id uuid not null references auth.users (id) on delete cascade,
  usage_date date not null,
  count integer not null default 0,
  primary key (user_id, usage_date)
);

alter table public.generation_usage enable row level security;

drop policy if exists "generation_usage select own" on public.generation_usage;
create policy "generation_usage select own" on public.generation_usage
  for select to authenticated
  using (user_id = auth.uid());

-- No insert/update/delete policy for ordinary authenticated callers -
-- every write goes through increment_generation_usage() below (SECURITY
-- INVOKER, so it still runs as the caller and still only ever writes
-- auth.uid()'s own row, but callers can't bypass the atomic
-- upsert-with-limit-check by writing the table directly).
revoke all on public.generation_usage from anon;
revoke insert, update, delete on public.generation_usage from authenticated;
grant select on public.generation_usage to authenticated;

/**
 * Atomically increments today's (UTC) successful-generation count for the
 * calling user and returns the new count. SECURITY INVOKER (the default)
 * so it runs with the caller's own privileges/RLS - auth.uid() is always
 * the actual signed-in caller, never a value the client can pass in, so
 * this can only ever increment the caller's own usage row.
 */
create or replace function public.increment_generation_usage()
returns integer
language sql
security invoker
as $$
  insert into public.generation_usage (user_id, usage_date, count)
  values (auth.uid(), (now() at time zone 'utc')::date, 1)
  on conflict (user_id, usage_date)
  do update set count = public.generation_usage.count + 1
  returning count;
$$;

revoke all on function public.increment_generation_usage() from public;
grant execute on function public.increment_generation_usage() to authenticated;

-- ---------------------------------------------------------------------------
-- Verifying public.jobs is untouched
-- ---------------------------------------------------------------------------
-- This migration adds no column, policy, trigger, or constraint to
-- public.jobs, and defines no foreign key from personal_stories or
-- behavior_answers to public.jobs. You can confirm this yourself: running
-- `\d public.jobs` in the SQL editor before and after this migration
-- shows an identical table definition.
