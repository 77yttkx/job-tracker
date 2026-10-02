import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

// V3.6 requirement: Application Source's database layer (one new column
// + check constraint on public.jobs, plus one new read-only RPC) must be
// purely additive and must never touch V3.3/V3.4/V3.5's own tables,
// triggers, RLS policies, or functions. Source-level regression guard,
// same convention as sqlAnalyticsMigration.test.ts /
// timeToResponseMigration.test.ts / applicationFunnelMigration.test.ts -
// there is no live Supabase project to exercise this against here.

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const migrationSource = readFileSync(join(repoRoot, 'supabase-v3_6-application-source.sql'), 'utf-8')
const withoutComments = migrationSource.replace(/--[^\n]*/g, '')

const rpcBlockMatch = migrationSource.match(
  /create or replace function public\.analytics_source_performance\(\)[\s\S]*?\$\$;/,
)
const rpcBlock = rpcBlockMatch ? rpcBlockMatch[0] : ''

describe('supabase-v3_6-application-source.sql (source-level regression guard)', () => {
  it('adds the application_source column to public.jobs, not null, defaulting to Unknown', () => {
    expect(withoutComments).toMatch(
      /alter table public\.jobs\s+add column if not exists application_source text not null default 'Unknown'/,
    )
  })

  it('constrains application_source to exactly the eight allowed values', () => {
    const constraintMatch = withoutComments.match(
      /add constraint jobs_application_source_check check \(\s*application_source in \(([\s\S]*?)\)\s*\)/,
    )
    expect(constraintMatch).not.toBeNull()
    const values = constraintMatch![1]
      .split(',')
      .map((v) => v.trim().replace(/^'|'$/g, ''))
      .filter(Boolean)
    expect(values).toEqual([
      'Company Website',
      'LinkedIn',
      'Referral',
      'Handshake',
      'Career Fair',
      'Recruiter',
      'Other',
      'Unknown',
    ])
  })

  it('drops the old constraint before recreating it, so re-running is safe', () => {
    expect(withoutComments).toMatch(/drop constraint if exists jobs_application_source_check/)
  })

  it('defines the source-performance RPC', () => {
    expect(rpcBlockMatch).not.toBeNull()
  })

  it('never creates a table, index, trigger, or RLS policy - a column + constraint + RPC only', () => {
    expect(withoutComments).not.toMatch(/create table/i)
    expect(withoutComments).not.toMatch(/create index/i)
    expect(withoutComments).not.toMatch(/create trigger/i)
    expect(withoutComments).not.toMatch(/create policy/i)
    expect(withoutComments).not.toMatch(/alter table[\s\S]*?(enable|disable|force) row level security/i)
  })

  it('never touches public.job_status_events, and never redefines any V3.3/V3.4/V3.5 function', () => {
    expect(migrationSource).not.toMatch(/alter table (public\.)?job_status_events/i)
    expect(migrationSource).not.toMatch(/create or replace function public\.analytics_application_funnel\b/)
    expect(migrationSource).not.toMatch(/create or replace function public\.analytics_application_funnel_progression/)
    expect(migrationSource).not.toMatch(/create or replace function public\.analytics_time_to_response_summary/)
    expect(migrationSource).not.toMatch(/create or replace function public\.analytics_response_time_distribution/)
    expect(migrationSource).not.toMatch(/create or replace function public\.analytics_still_waiting/)
    expect(migrationSource).not.toMatch(/create or replace function public\.analytics_company_outcomes/)
    expect(migrationSource).not.toMatch(/create or replace function public\.analytics_sponsorship_outcomes/)
    expect(migrationSource).not.toMatch(/create or replace function public\.analytics_application_trend/)
  })

  it('is security invoker, stable, and scoped by auth.uid() - never security definer', () => {
    expect(rpcBlock).toMatch(/security invoker/)
    expect(rpcBlock).toMatch(/\bstable\b/)
    expect(rpcBlock).not.toMatch(/security definer/)
    // auth.uid() scoping must appear at least twice - once for the
    // tracked cohort, once for the overall jobs scope (user isolation,
    // not just one filtered subquery).
    const uidMatches = rpcBlock.match(/auth\.uid\(\)/g) ?? []
    expect(uidMatches.length).toBeGreaterThanOrEqual(2)
  })

  it('grants EXECUTE only to authenticated, after revoking the default PUBLIC grant', () => {
    expect(migrationSource).toMatch(/revoke execute on function public\.analytics_source_performance\(\) from public;/)
    expect(migrationSource).toMatch(/grant execute on function public\.analytics_source_performance\(\) to authenticated;/)
  })

  it('application_count is read from public.jobs directly (every application, ungated by the tracked cohort)', () => {
    expect(rpcBlock).toMatch(/from public\.jobs j/)
    expect(rpcBlock).toMatch(/count\(\*\)::bigint as application_count/)
  })

  it('tracked_count/response_count/interview_count are gated by the from_status-is-null cohort, same as the V3.5 funnel', () => {
    expect(rpcBlock).toMatch(/from public\.job_status_events\s*\n\s*where user_id = auth\.uid\(\)\s*\n\s*and from_status is null/)
    expect(rpcBlock).toMatch(/count\(\*\) filter \(where t\.job_id is not null\)::bigint as tracked_count/)
  })

  it('Response qualifies on OA/1st Round/2nd Round/Final Round/Offer/Rejected - never Applied or Ghosted, matching V3.4/V3.5', () => {
    const responseMatch = rpcBlock.match(/bool_or\(e\.to_status in \(([^)]*)\)\) as got_response/)
    expect(responseMatch).not.toBeNull()
    expect(responseMatch![1]).toBe("'OA', '1st Round', '2nd Round', 'Final Round', 'Offer', 'Rejected'")
    expect(rpcBlock).not.toMatch(/'Ghosted'/)
  })

  it('Interview qualifies on 1st Round/2nd Round/Final Round/Offer only, matching V3.4/V3.5', () => {
    const interviewMatch = rpcBlock.match(/bool_or\(e\.to_status in \(([^)]*)\)\) as got_interview/)
    expect(interviewMatch).not.toBeNull()
    expect(interviewMatch![1]).toBe("'1st Round', '2nd Round', 'Final Round', 'Offer'")
  })

  it('groups by application_source, not by any other column', () => {
    expect(rpcBlock).toMatch(/group by j\.application_source/)
  })

  it('is idempotent - uses CREATE OR REPLACE for the function, never a bare CREATE FUNCTION', () => {
    expect(migrationSource).not.toMatch(/^create function/im)
    expect(migrationSource).toMatch(/create or replace function public\.analytics_source_performance/)
  })
})
