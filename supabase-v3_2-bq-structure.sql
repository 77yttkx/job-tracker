-- Job Tracker V3.2 migration: adds a nullable `prompt_key` column to
-- public.behavior_answers so an answer can (optionally) remember which
-- guided "BQ Questions" prompt template it was created from
-- (src/lib/bqPrompts.ts) - purely to avoid creating duplicate answers
-- when a user reopens the same prompt a second time (see
-- src/pages/interviewPrep/bq/BQQuestionsPage.tsx). Additive only, like
-- supabase-v3-interview-prep.sql and supabase-v3_1-manual-answers.sql
-- before it. Safe to run more than once (every statement below is
-- idempotent) and safe to run against a database with existing rows -
-- every existing answer simply gets `prompt_key = null`, which reads as
-- "not created from a guided prompt" (true for every pre-V3.2 row,
-- generated or manual alike).
--
-- Run this AFTER supabase-v3-interview-prep.sql and
-- supabase-v3_1-manual-answers.sql.
--
-- Scope: this migration touches ONLY public.behavior_answers. It does
-- not touch public.jobs, public.personal_stories, or any RLS policy -
-- the four existing behavior_answers policies (select/insert/update/
-- delete, scoped to user_id = auth.uid()) already cover this new column
-- with no changes needed, since RLS is row-scoped, not column-scoped.

-- ---------------------------------------------------------------------------
-- 1. Add the nullable prompt_key column.
-- ---------------------------------------------------------------------------
-- Nullable and unconstrained-in-value on purpose: the actual set of valid
-- keys (one per guided prompt - see BQ_PROMPTS in src/lib/bqPrompts.ts)
-- lives in application code, the same way `tags` values aren't enum-
-- checked either. A CHECK constraint here would just be one more place to
-- keep in sync every time a prompt is added, for a value that's never
-- read or written outside this app's own UI.
alter table public.behavior_answers
  add column if not exists prompt_key text;

-- ---------------------------------------------------------------------------
-- 2. Index it for the "does this user already have an answer for prompt
--    X" lookup (src/pages/interviewPrep/bq/BQQuestionsPage.tsx runs this
--    client-side today against the already-fetched answers array, not a
--    fresh query - see fetchAnswers in src/services/answers.ts - but this
--    index is cheap, additive, and keeps a future server-side lookup fast
--    without requiring another migration).
-- ---------------------------------------------------------------------------
-- Partial index (excludes NULL prompt_key) since most rows - every
-- custom/manual answer, plus every legacy generated answer - will never
-- have one set.
create index if not exists behavior_answers_prompt_key_idx
  on public.behavior_answers (user_id, prompt_key)
  where prompt_key is not null;

-- ---------------------------------------------------------------------------
-- Verifying scope
-- ---------------------------------------------------------------------------
-- This migration touches only public.behavior_answers - one `add column`
-- statement plus one partial index. It adds no table, drops no table, and
-- does not touch public.jobs or public.personal_stories, or any RLS
-- policy, at all. You can confirm this yourself: running `\d public.jobs`
-- and `\d public.personal_stories` in the SQL editor before and after
-- this migration shows identical table definitions for both, and
-- `select policyname from pg_policies where tablename = 'behavior_answers'`
-- returns the same four policy names as before.
