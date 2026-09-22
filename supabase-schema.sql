-- Job Tracker MVP schema (V2: includes location + sponsorship columns)
-- Run this in the Supabase SQL editor (or via `supabase db push` / migrations).
-- For an existing V1 database, run supabase-v2-migration.sql instead - it is
-- additive and preserves existing rows. This file is for a brand-new setup.

create extension if not exists pgcrypto;

create table if not exists public.jobs (
  job_id uuid primary key default gen_random_uuid(),
  company text,
  role text,
  location text,
  sponsorship text not null default 'Unknown',
  job_url text,
  jd text,
  applied_date date,
  status text not null default 'Applied',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint jobs_status_check check (
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
  ),

  constraint jobs_sponsorship_check check (
    sponsorship in ('Yes', 'No', 'Unknown')
  )
);

-- Keep updated_at current on every row update.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists jobs_set_updated_at on public.jobs;

create trigger jobs_set_updated_at
before update on public.jobs
for each row
execute function public.set_updated_at();

-- Helpful index for the default "sort by applied date" view.
create index if not exists jobs_applied_date_idx on public.jobs (applied_date);
create index if not exists jobs_status_idx on public.jobs (status);

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
-- This is a single-user MVP with NO authentication layer. The policies below
-- allow the anon (public) API key full read/write access to this table so
-- the app works out of the box. This is only appropriate for local/private
-- use with a Supabase project that is not shared publicly.
--
-- SECURITY WARNING: anyone who obtains your VITE_SUPABASE_ANON_KEY and
-- VITE_SUPABASE_URL can read, modify, and delete every row in this table.
-- Do not deploy this app publicly without adding real authentication and
-- scoping these policies to an authenticated user (e.g. a `user_id` column
-- with `auth.uid() = user_id` checks). See README.md for details.

alter table public.jobs enable row level security;

drop policy if exists "dev anon select" on public.jobs;
drop policy if exists "dev anon insert" on public.jobs;
drop policy if exists "dev anon update" on public.jobs;
drop policy if exists "dev anon delete" on public.jobs;

create policy "dev anon select" on public.jobs
  for select to anon using (true);

create policy "dev anon insert" on public.jobs
  for insert to anon with check (true);

create policy "dev anon update" on public.jobs
  for update to anon using (true) with check (true);

create policy "dev anon delete" on public.jobs
  for delete to anon using (true);
