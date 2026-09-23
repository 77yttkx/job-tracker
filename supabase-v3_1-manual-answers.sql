-- Job Tracker V3.1 migration: makes the Interview Prep Answer Library
-- usable WITHOUT the Gemini-based generator (which is being removed from
-- the frontend in this phase - the deployed generate-star-answer Edge
-- Function itself is left untouched, just unused). Users can now write
-- an answer entirely by hand and save it directly, without first
-- selecting or generating from a personal_stories row.
--
-- Run this once in the Supabase SQL editor, after supabase-v3-interview-prep.sql
-- has already been applied. Safe to run more than once (every statement
-- below is idempotent: alter column drop not null when already nullable
-- is a no-op, add column if not exists, drop/create index if not exists).
--
-- NON-DESTRUCTIVE BY DESIGN:
--   - No column is dropped, renamed, or narrowed.
--   - No existing row's data is modified, and no existing row becomes
--     invalid: every AI-generated answer saved before this migration
--     still has its story_id/duration/tone exactly as it did, and simply
--     gets tags = '{}' (an explicit, documented default) until the user
--     tags it themselves.
--   - This migration never touches public.jobs, and never touches
--     public.personal_stories except to leave it completely alone -
--     Story Library keeps working exactly as it did.
--   - RLS is untouched: the same four owner-scoped policies from
--     supabase-v3-interview-prep.sql (select/insert/update/delete,
--     `user_id = auth.uid()`, `to authenticated`) continue to apply to
--     every row in behavior_answers, generated or manual alike. This
--     migration adds no new policy and does not need to - it only
--     relaxes column constraints and adds one new column, neither of
--     which changes who can read or write a row.

-- ---------------------------------------------------------------------------
-- 1. Make story_id optional.
-- ---------------------------------------------------------------------------
-- A manually-written answer has no source personal_stories row at all -
-- the user typed the question and answer themselves. The existing
-- `references public.personal_stories (story_id) on delete restrict`
-- foreign key is left in place and still applies whenever story_id IS
-- set (a generated answer's story can still never be deleted out from
-- under it) - a foreign key constraint simply does not apply to a NULL
-- value, so no change is needed there.
alter table public.behavior_answers
  alter column story_id drop not null;

-- ---------------------------------------------------------------------------
-- 2. Make duration and tone optional.
-- ---------------------------------------------------------------------------
-- Both were only ever meaningful for a Gemini-generated answer (the
-- requested response length/tone). A manually-written answer has neither.
-- The existing check constraints (behavior_answers_duration_check /
-- behavior_answers_tone_check) already tolerate NULL correctly without
-- any change: a Postgres CHECK constraint evaluates to NULL (which counts
-- as "satisfied", not "violated") when any operand is NULL, so `duration
-- in ('30s','1min','2min')` never rejects a NULL duration.
alter table public.behavior_answers
  alter column duration drop not null;

alter table public.behavior_answers
  alter column tone drop not null;

-- ---------------------------------------------------------------------------
-- 3. Add tags.
-- ---------------------------------------------------------------------------
-- A Postgres text[] (matching personal_stories.tags's existing
-- representation exactly, for consistency - see
-- supabase-v3-interview-prep.sql). `not null default '{}'` means this
-- column addition does not rewrite/invalidate any existing row: every
-- answer saved before this migration gets tags = '{}' (an empty array,
-- "no tags yet"), which is a safe, sensible default - it displays as "no
-- tags" in the UI and never blocks that row from being read, edited, or
-- deleted. The app's own client-side validation (never a DB constraint,
-- to avoid retroactively invalidating those pre-existing empty-tag rows)
-- requires at least one tag only when saving a *new* answer from the
-- New Answer form going forward - see src/components/interviewPrep/AnswerModal.tsx.
alter table public.behavior_answers
  add column if not exists tags text[] not null default '{}';

-- Mirrors personal_stories_raw_story_max_length-style belt-and-suspenders
-- limits (supabase-v3-interview-prep.sql): a generous cap, not a UX
-- constraint - the client-side tag picker already caps at the same count
-- (MAX_TAGS_PER_STORY in src/lib/interviewPrepConstants.ts, shared with
-- answer tags).
alter table public.behavior_answers
  drop constraint if exists behavior_answers_tags_max_count;
alter table public.behavior_answers
  add constraint behavior_answers_tags_max_count
    check (array_length(tags, 1) is null or array_length(tags, 1) <= 12);

-- GIN index so a future "filter by tag" query against the database (not
-- required for this MVP, which filters client-side like Story Library
-- does, but cheap and additive) is not a full table scan.
create index if not exists behavior_answers_tags_idx
  on public.behavior_answers using gin (tags);

-- ---------------------------------------------------------------------------
-- Verifying scope
-- ---------------------------------------------------------------------------
-- This migration touches only public.behavior_answers - three `alter
-- column`/`add column` statements plus one index. It adds no table,
-- drops no table, and does not touch public.jobs or
-- public.personal_stories at all. You can confirm this yourself: running
-- `\d public.jobs` and `\d public.personal_stories` in the SQL editor
-- before and after this migration shows identical table definitions for
-- both.
