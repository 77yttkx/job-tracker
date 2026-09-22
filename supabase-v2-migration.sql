-- Job Tracker V2 migration: adds sponsorship + location to an EXISTING
-- V1 database. Additive only - does not drop or recreate public.jobs, and
-- does not touch existing rows' company/role/job_url/jd/applied_date/
-- status/notes/created_at/updated_at values.
--
-- Run this once in the Supabase SQL editor (or via `supabase db push` /
-- migrations) against a database that already has the V1 `jobs` table
-- from supabase-schema.sql. If you are setting up a brand-new database,
-- just run supabase-schema.sql instead - it already includes these columns.

-- 1. Add the new columns. Existing rows get sponsorship = 'Unknown' and
--    location = null, exactly as required.
alter table public.jobs
  add column if not exists sponsorship text not null default 'Unknown';

alter table public.jobs
  add column if not exists location text;

-- 2. Constrain sponsorship to the three allowed values.
alter table public.jobs
  drop constraint if exists jobs_sponsorship_check;

alter table public.jobs
  add constraint jobs_sponsorship_check check (
    sponsorship in ('Yes', 'No', 'Unknown')
  );

-- Nothing else changes: the existing jobs_status_check constraint, the
-- updated_at trigger, indexes, and RLS policies from supabase-schema.sql
-- are untouched by this migration.
