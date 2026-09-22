-- Job Tracker V2.5.1 migration: renames the "Reject" status to "Rejected"
-- on an EXISTING database. Additive/safe - converts data first, then
-- updates the constraint, so existing rows are never left violating it.
--
-- Run this once in the Supabase SQL editor (or via `supabase db push` /
-- migrations) against a database that already has the `jobs` table. If you
-- are setting up a brand-new database, just run supabase-schema.sql instead
-- - it already uses "Rejected".
--
-- Safe to run more than once: step 1 is a no-op once no row still says
-- "Reject", and step 2 drops/recreates the same constraint idempotently.

-- 1. Convert any existing 'Reject' rows to 'Rejected' *before* touching the
--    constraint, so no row is ever left violating it mid-migration.
update public.jobs
set status = 'Rejected'
where status = 'Reject';

-- 2. Replace the status check constraint: 'Reject' -> 'Rejected'. Every
--    other allowed value is unchanged.
alter table public.jobs
  drop constraint if exists jobs_status_check;

alter table public.jobs
  add constraint jobs_status_check check (
    status in (
      'Applied',
      'OA',
      '1st Round',
      '2nd Round',
      'Final Round',
      'Offer',
      'Rejected',
      'Ghosted'
    )
  );

-- Nothing else changes: sponsorship/location columns, the updated_at
-- trigger, indexes, and RLS policies from supabase-schema.sql /
-- supabase-v2-migration.sql are untouched by this migration.
