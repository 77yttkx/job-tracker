import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

// V3.3 requirement: the SQL Analytics Lab's database layer must be purely
// additive on top of public.jobs. Source-level regression guard, same
// convention as multiUserMigration.test.ts / bqStructureMigration.test.ts
// - there is no live Supabase project to exercise this against here.

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const migrationSource = readFileSync(join(repoRoot, 'supabase-v3_3-sql-analytics.sql'), 'utf-8')
const withoutComments = migrationSource.replace(/--[^\n]*/g, '')

describe('supabase-v3_3-sql-analytics.sql (source-level regression guard)', () => {
  it('never adds, drops, or alters a column on public.jobs', () => {
    expect(withoutComments).not.toMatch(/alter table (public\.)?jobs\s+add column/i)
    expect(withoutComments).not.toMatch(/alter table (public\.)?jobs\s+drop column/i)
    expect(withoutComments).not.toMatch(/alter table (public\.)?jobs\s+alter column/i)
  })

  it('never creates, drops, or alters an RLS policy on public.jobs (only on job_status_events)', () => {
    const policyStatements = withoutComments.match(/(create|drop|alter) policy[\s\S]*?;/gi) ?? []
    expect(policyStatements.length).toBeGreaterThan(0)
    for (const statement of policyStatements) {
      expect(statement, `expected only job_status_events policy in: ${statement}`).toMatch(/job_status_events/i)
      expect(statement).not.toMatch(/\bon (public\.)?jobs\b/i)
    }
  })

  it('never disables or force-enables RLS on public.jobs', () => {
    expect(withoutComments).not.toMatch(/alter table (public\.)?jobs\s+(disable|force|no force)/i)
  })

  it('creates job_status_events with the required columns and foreign keys, idempotently', () => {
    expect(migrationSource).toMatch(/create table if not exists public\.job_status_events/)
    expect(migrationSource).toMatch(/job_id uuid not null references public\.jobs \(job_id\) on delete cascade/)
    expect(migrationSource).toMatch(/user_id uuid not null references auth\.users \(id\)/)
    expect(migrationSource).toMatch(/from_status text/)
    expect(migrationSource).toMatch(/to_status text not null/)
  })

  it('enables RLS on job_status_events and scopes select to the owning user', () => {
    expect(migrationSource).toMatch(/alter table public\.job_status_events enable row level security/)
    expect(migrationSource).toMatch(/create policy "job_status_events select own" on public\.job_status_events/)
    expect(migrationSource).toMatch(/using \(user_id = auth\.uid\(\)\)/)
  })

  it('grants only SELECT on job_status_events to authenticated - no insert/update/delete grant', () => {
    expect(migrationSource).toMatch(/grant select on public\.job_status_events to authenticated;/)
    expect(migrationSource).not.toMatch(/grant (insert|update|delete)[^;]*job_status_events/i)
    expect(migrationSource).not.toMatch(/grant all[^;]*job_status_events/i)
  })

  it('revokes anon access to job_status_events', () => {
    expect(migrationSource).toMatch(/revoke all on public\.job_status_events from anon;/)
  })

  it('writes job_status_events only through a security definer trigger function with a pinned search_path', () => {
    expect(migrationSource).toMatch(/create or replace function public\.record_job_status_event\(\)/)
    expect(migrationSource).toMatch(/security definer/)
    expect(migrationSource).toMatch(/set search_path = public, pg_temp/)
    // The function body must not execute caller-supplied text.
    const fnMatch = migrationSource.match(/create or replace function public\.record_job_status_event[\s\S]*?\$\$;/)
    expect(fnMatch).not.toBeNull()
    expect(fnMatch![0]).not.toMatch(/execute\s+format/i)
    expect(fnMatch![0]).not.toMatch(/execute\s+'/i)
  })

  it('revokes public EXECUTE on the trigger function so it cannot be called directly', () => {
    expect(migrationSource).toMatch(/revoke execute on function public\.record_job_status_event\(\) from public;/)
  })

  it('attaches exactly an AFTER INSERT and an AFTER UPDATE OF status trigger to public.jobs, idempotently', () => {
    expect(migrationSource).toMatch(/drop trigger if exists jobs_status_insert_event on public\.jobs;/)
    expect(migrationSource).toMatch(/create trigger jobs_status_insert_event\s*\n\s*after insert on public\.jobs/)
    expect(migrationSource).toMatch(/drop trigger if exists jobs_status_update_event on public\.jobs;/)
    expect(migrationSource).toMatch(/create trigger jobs_status_update_event\s*\n\s*after update of status on public\.jobs/)
  })

  it('the trigger function only records an update event when status actually changed', () => {
    expect(migrationSource).toMatch(/if new\.status is distinct from old\.status then/)
  })

  it('never backfills a synthetic status event for jobs that already existed', () => {
    // No INSERT into job_status_events sourced from an existing jobs SELECT.
    expect(withoutComments).not.toMatch(/insert into public\.job_status_events[^;]*?select[^;]*?from public\.jobs/i)
  })

  it('every analytics RPC is security invoker, stable, and scoped by auth.uid() in its own query body', () => {
    const rpcBlocks = migrationSource.match(/create or replace function public\.analytics_\w+\([^)]*\)[\s\S]*?\$\$;/g) ?? []
    expect(rpcBlocks.length).toBeGreaterThanOrEqual(6)
    for (const block of rpcBlocks) {
      expect(block, `expected security invoker in: ${block.slice(0, 80)}`).toMatch(/security invoker/)
      expect(block, `expected stable in: ${block.slice(0, 80)}`).toMatch(/\bstable\b/)
      expect(block, `expected auth.uid() scoping in: ${block.slice(0, 80)}`).toMatch(/user_id = auth\.uid\(\)/)
      expect(block).not.toMatch(/security definer/)
    }
  })

  it('grants EXECUTE on every analytics RPC only to authenticated, after revoking the default PUBLIC grant', () => {
    const fnNames = [
      'analytics_application_funnel()',
      'analytics_company_outcomes()',
      'analytics_sponsorship_outcomes()',
      'analytics_application_trend(text)',
      'analytics_status_transitions_by_week()',
      'analytics_stage_reach_counts()',
      'analytics_avg_stage_durations()',
    ]
    for (const fn of fnNames) {
      const escaped = fn.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      expect(migrationSource, `missing revoke for ${fn}`).toMatch(
        new RegExp(`revoke execute on function public\\.${escaped} from public;`),
      )
      expect(migrationSource, `missing grant for ${fn}`).toMatch(
        new RegExp(`grant execute on function public\\.${escaped} to authenticated;`),
      )
    }
  })

  it('the trend RPC never interpolates the granularity argument into dynamic SQL', () => {
    const trendBlock = migrationSource.match(/create or replace function public\.analytics_application_trend[\s\S]*?\$\$;/)
    expect(trendBlock).not.toBeNull()
    expect(trendBlock![0]).not.toMatch(/execute/i)
    // granularity must be forced through a CASE expression before reaching date_trunc.
    expect(trendBlock![0]).toMatch(/case when granularity = 'week' then 'week' else 'month' end/)
  })

  it('every duration metric excludes jobs missing one of the two events - no invented durations', () => {
    const durationsBlock = migrationSource.match(/create or replace function public\.analytics_avg_stage_durations[\s\S]*?\$\$;/)
    expect(durationsBlock).not.toBeNull()
    // Inner joins (not left joins) between the applied/target CTEs ensure a
    // job missing either event contributes to no row in the average.
    expect(durationsBlock![0]).toMatch(/join oa_events o on o\.job_id = a\.job_id/)
    expect(durationsBlock![0]).toMatch(/join first_interview_events i on i\.job_id = a\.job_id/)
    expect(durationsBlock![0]).not.toMatch(/left join/i)
  })

  it('is idempotent - every create table/index/trigger/policy statement guards against re-running', () => {
    const codeLines = migrationSource.split('\n').filter((line) => !line.trim().startsWith('--'))
    const createTableLines = codeLines.filter((line) => /create table/i.test(line))
    for (const line of createTableLines) expect(line).toMatch(/if not exists/i)

    const createIndexLines = codeLines.filter((line) => /create index/i.test(line))
    for (const line of createIndexLines) expect(line).toMatch(/if not exists/i)

    // Functions use CREATE OR REPLACE (safe to re-run); triggers/policies
    // are dropped first, then recreated.
    expect(migrationSource).not.toMatch(/^create function/im)
  })
})
