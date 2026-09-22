-- Job Tracker V2.6 migration: turns the single-user MVP into a public
-- multi-user app where every signed-in user can only see and modify their
-- own job records. Run this once in the Supabase SQL editor (or via
-- `supabase db push` / migrations) against a database that already has the
-- `public.jobs` table from supabase-schema.sql (+ the V2 / V2.5.1
-- migrations, if applied incrementally).
--
-- This migration REQUIRES that Supabase Auth is enabled on your project
-- (it is, by default, for every Supabase project) and that at least one
-- user account exists before you try to use the app again - see the
-- "After running this migration" section at the bottom.
--
-- Safe to run more than once: every step below is idempotent (add column
-- if not exists, drop/create policy, drop/create constraint).

-- ---------------------------------------------------------------------------
-- 1. Add the ownership column.
-- ---------------------------------------------------------------------------
-- Nullable on purpose: existing rows (if any) have no owner yet, and this
-- migration must not guess one for them - see the "Legacy rows" section
-- below for how to handle them deliberately, by hand, if you have any.
--
-- The `default auth.uid()` is a second, DB-level line of defense: even if a
-- future code change forgot to pass `user_id` on insert, a row created by
-- an authenticated request would still be stamped with that request's own
-- user id automatically, rather than landing as an ownerless/NULL row.
-- (The app's own data-access layer - src/services/jobs.ts - always passes
-- `user_id` explicitly too; this is belt-and-suspenders, not a substitute.)-- Job Tracker V2.6 migration: turns the single-user MVP into a public
-- multi-user app where every signed-in user can only see and modify their
-- own job records. Run this once in the Supabase SQL editor (or via
-- `supabase db push` / migrations) against a database that already has the
-- `public.jobs` table from supabase-schema.sql (+ the V2 / V2.5.1
-- migrations, if applied incrementally).
--
-- This migration REQUIRES that Supabase Auth is enabled on your project
-- (it is, by default, for every Supabase project) and that at least one
-- user account exists before you try to use the app again - see the
-- "After running this migration" section at the bottom.
--
-- Safe to run more than once: every step below is idempotent (add column
-- if not exists, drop/create policy, drop/create constraint).

-- ---------------------------------------------------------------------------
-- 1. Add the ownership column.
-- ---------------------------------------------------------------------------
-- Nullable on purpose: existing rows (if any) have no owner yet, and this
-- migration must not guess one for them - see the "Legacy rows" section
-- below for how to handle them deliberately, by hand, if you have any.
--
-- The `default auth.uid()` is a second, DB-level line of defense: even if a
-- future code change forgot to pass `user_id` on insert, a row created by
-- an authenticated request would still be stamped with that request's own
-- user id automatically, rather than landing as an ownerless/NULL row.
-- (The app's own data-access layer - src/services/jobs.ts - always passes
-- `user_id` explicitly too; this is belt-and-suspenders, not a substitute.)
alter table public.jobs
  add column if not exists user_id uuid references auth.users (id);

alter table public.jobs
  alter column user_id set default auth.uid();

-- Every query in the app filters/joins on user_id (via RLS below), so it
-- needs an index just like applied_date/status already have.
create index if not exists jobs_user_id_idx on public.jobs (user_id);

-- ---------------------------------------------------------------------------
-- 2. Remove the old single-user "anon can do anything" policies.
-- ---------------------------------------------------------------------------
-- These are exactly the policies supabase-schema.sql created for the
-- single-user MVP. They must be dropped, not left alongside the new ones -
-- Postgres RLS grants access if ANY policy on the table allows it, so
-- leaving these in place would silently defeat the per-user policies below.
drop policy if exists "dev anon select" on public.jobs;
drop policy if exists "dev anon insert" on public.jobs;
drop policy if exists "dev anon update" on public.jobs;
drop policy if exists "dev anon delete" on public.jobs;

-- Re-affirm RLS is on (it already was, from supabase-schema.sql - this is
-- just a safe no-op if so).
alter table public.jobs enable row level security;

-- Belt-and-suspenders beyond RLS: revoke the table entirely from the
-- unauthenticated `anon` role, and grant only what signed-in users need to
-- `authenticated`. RLS alone is Supabase's recommended enforcement
-- boundary (and is sufficient on its own), but explicitly revoking table
-- privileges from `anon` means an unauthenticated request is rejected at
-- the grant level too, before RLS is even evaluated.
revoke all on public.jobs from anon;
grant select, insert, update, delete on public.jobs to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Per-user policies.
-- ---------------------------------------------------------------------------
-- Four separate policies (not one "for all"), so each operation's
-- intent is explicit and independently auditable, matching how the spec
-- calls them out one by one.
--
-- `using` governs which EXISTING rows a statement can see/touch (SELECT's
-- WHERE, and the "which rows am I allowed to UPDATE/DELETE" check).
-- `with check` governs what a WRITE is allowed to leave behind (INSERT's
-- new row, UPDATE's resulting row) - this is what stops a signed-in user
-- from inserting or re-assigning a row to someone else's user_id: even if
-- the request body says `user_id: <someone-else>`, the write is rejected
-- because the resulting row would fail `user_id = auth.uid()`.
drop policy if exists "jobs select own" on public.jobs;
drop policy if exists "jobs insert own" on public.jobs;
drop policy if exists "jobs update own" on public.jobs;
drop policy if exists "jobs delete own" on public.jobs;

create policy "jobs select own" on public.jobs
  for select to authenticated
  using (user_id = auth.uid());

create policy "jobs insert own" on public.jobs
  for insert to authenticated
  with check (user_id = auth.uid());

create policy "jobs update own" on public.jobs
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "jobs delete own" on public.jobs
  for delete to authenticated
  using (user_id = auth.uid());

-- With only these four policies in place (and no "anon" policy left from
-- step 2), an unauthenticated visitor - who has no `authenticated` role
-- and no `auth.uid()` - matches no policy at all, so Postgres RLS's
-- default-deny applies: they cannot read, insert, update, or delete any
-- row in this table, full stop.

-- ---------------------------------------------------------------------------
-- Legacy rows with user_id IS NULL
-- ---------------------------------------------------------------------------
-- Because `NULL = auth.uid()` is never true in Postgres, any pre-existing
-- row that still has user_id = NULL after this migration becomes
-- invisible/inaccessible to *every* user, including you - not a security
-- hole (nobody can read it), but also not automatically yours again. This
-- migration deliberately does NOT guess an owner for these rows: an
-- automatic "assign every orphaned row to whichever account happens to run
-- this migration" step would be wrong the moment a second person (e.g. a
-- partner or friend) also uses this app, and it isn't reversible.
--
-- If you have legacy rows you want to keep (most people running this
-- migration for the first time have already deleted their old test data,
-- per the V2.6 project plan, and can skip this entirely) and you know
-- which account should own them, run the following AFTER creating your
-- account, replacing the email with your own. This is commented out on
-- purpose - copy it into the SQL editor and run it yourself when you're
-- ready, rather than as part of this migration:
--
-- update public.jobs
-- set user_id = (select id from auth.users where email = 'you@example.com')
-- where user_id is null;

-- ---------------------------------------------------------------------------
-- After running this migration
-- ---------------------------------------------------------------------------
-- 1. Create your account in the app's Sign up screen (this calls Supabase
--    Auth's signUp, which needs no separate dashboard step beyond what's
--    described in README.md's "Supabase Auth dashboard settings" section).
-- 2. Only then re-import/re-create your jobs - every job you add or import
--    while signed in is automatically stamped with your user_id (by the
--    app's data-access layer, and redundantly by this column's
--    `default auth.uid()`), so it will only ever be visible to you.

alter table public.jobs
  add column if not exists user_id uuid references auth.users (id);

alter table public.jobs
  alter column user_id set default auth.uid();

-- Every query in the app filters/joins on user_id (via RLS below), so it
-- needs an index just like applied_date/status already have.
create index if not exists jobs_user_id_idx on public.jobs (user_id);

-- ---------------------------------------------------------------------------
-- 2. Remove the old single-user "anon can do anything" policies.
-- ---------------------------------------------------------------------------
-- These are exactly the policies supabase-schema.sql created for the
-- single-user MVP. They must be dropped, not left alongside the new ones -
-- Postgres RLS grants access if ANY policy on the table allows it, so
-- leaving these in place would silently defeat the per-user policies below.
drop policy if exists "dev anon select" on public.jobs;
drop policy if exists "dev anon insert" on public.jobs;
drop policy if exists "dev anon update" on public.jobs;
drop policy if exists "dev anon delete" on public.jobs;

-- Re-affirm RLS is on (it already was, from supabase-schema.sql - this is
-- just a safe no-op if so).
alter table public.jobs enable row level security;

-- Belt-and-suspenders beyond RLS: revoke the table entirely from the
-- unauthenticated `anon` role, and grant only what signed-in users need to
-- `authenticated`. RLS alone is Supabase's recommended enforcement
-- boundary (and is sufficient on its own), but explicitly revoking table
-- privileges from `anon` means an unauthenticated request is rejected at
-- the grant level too, before RLS is even evaluated.
revoke all on public.jobs from anon;
grant select, insert, update, delete on public.jobs to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Per-user policies.
-- ---------------------------------------------------------------------------
-- Four separate policies (not one "for all"), so each operation's
-- intent is explicit and independently auditable, matching how the spec
-- calls them out one by one.
--
-- `using` governs which EXISTING rows a statement can see/touch (SELECT's
-- WHERE, and the "which rows am I allowed to UPDATE/DELETE" check).
-- `with check` governs what a WRITE is allowed to leave behind (INSERT's
-- new row, UPDATE's resulting row) - this is what stops a signed-in user
-- from inserting or re-assigning a row to someone else's user_id: even if
-- the request body says `user_id: <someone-else>`, the write is rejected
-- because the resulting row would fail `user_id = auth.uid()`.
drop policy if exists "jobs select own" on public.jobs;
drop policy if exists "jobs insert own" on public.jobs;
drop policy if exists "jobs update own" on public.jobs;
drop policy if exists "jobs delete own" on public.jobs;

create policy "jobs select own" on public.jobs
  for select to authenticated
  using (user_id = auth.uid());

create policy "jobs insert own" on public.jobs
  for insert to authenticated
  with check (user_id = auth.uid());

create policy "jobs update own" on public.jobs
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "jobs delete own" on public.jobs
  for delete to authenticated
  using (user_id = auth.uid());

-- With only these four policies in place (and no "anon" policy left from
-- step 2), an unauthenticated visitor - who has no `authenticated` role
-- and no `auth.uid()` - matches no policy at all, so Postgres RLS's
-- default-deny applies: they cannot read, insert, update, or delete any
-- row in this table, full stop.

-- ---------------------------------------------------------------------------
-- Legacy rows with user_id IS NULL
-- ---------------------------------------------------------------------------
-- Because `NULL = auth.uid()` is never true in Postgres, any pre-existing
-- row that still has user_id = NULL after this migration becomes
-- invisible/inaccessible to *every* user, including you - not a security
-- hole (nobody can read it), but also not automatically yours again. This
-- migration deliberately does NOT guess an owner for these rows: an
-- automatic "assign every orphaned row to whichever account happens to run
-- this migration" step would be wrong the moment a second person (e.g. a
-- partner or friend) also uses this app, and it isn't reversible.
--
-- If you have legacy rows you want to keep (most people running this
-- migration for the first time have already deleted their old test data,
-- per the V2.6 project plan, and can skip this entirely) and you know
-- which account should own them, run the following AFTER creating your
-- account, replacing the email with your own. This is commented out on
-- purpose - copy it into the SQL editor and run it yourself when you're
-- ready, rather than as part of this migration:
--
-- update public.jobs
-- set user_id = (select id from auth.users where email = 'you@example.com')
-- where user_id is null;

-- ---------------------------------------------------------------------------
-- After running this migration
-- ---------------------------------------------------------------------------
-- 1. Create your account in the app's Sign up screen (this calls Supabase
--    Auth's signUp, which needs no separate dashboard step beyond what's
--    described in README.md's "Supabase Auth dashboard settings" section).
-- 2. Only then re-import/re-create your jobs - every job you add or import
--    while signed in is automatically stamped with your user_id (by the
--    app's data-access layer, and redundantly by this column's
--    `default auth.uid()`), so it will only ever be visible to you.
