import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

// V3.4 requirement: Time to Response's database layer must be purely
// additive on top of public.jobs / public.job_status_events, anchored on
// jobs.applied_date (not event history), and must treat "Still Waiting"
// as a deliberate current-status exception. Source-level regression
// guard, same convention as sqlAnalyticsMigration.test.ts - there is no
// live Supabase project to exercise this against here.

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const migrationSource = readFileSync(join(repoRoot, 'supabase-v3_4-time-to-response.sql'), 'utf-8')
const withoutComments = migrationSource.replace(/--[^\n]*/g, '')

describe('supabase-v3_4-time-to-response.sql (source-level regression guard)', () => {
  it('never adds, drops, or alters a column on public.jobs or public.job_status_events', () => {
    expect(withoutComments).not.toMatch(/alter table (public\.)?(jobs|job_status_events)\s+(add|drop|alter) column/i)
  })

  it('never creates a table, index, trigger, or RLS policy - RPCs only', () => {
    expect(withoutComments).not.toMatch(/create table/i)
    expect(withoutComments).not.toMatch(/create index/i)
    expect(withoutComments).not.toMatch(/create trigger/i)
    expect(withoutComments).not.toMatch(/create policy/i)
    expect(withoutComments).not.toMatch(/alter table[\s\S]*?(enable|disable|force) row level security/i)
  })

  it('defines exactly the three documented RPCs', () => {
    for (const fn of [
      'analytics_time_to_response_summary',
      'analytics_response_time_distribution',
      'analytics_still_waiting',
    ]) {
      expect(migrationSource).toMatch(new RegExp(`create or replace function public\\.${fn}\\(`))
    }
  })

  it('every RPC is security invoker, stable, and scoped by auth.uid() in its own query body', () => {
    const rpcBlocks =
      migrationSource.match(/create or replace function public\.analytics_\w+\([^)]*\)[\s\S]*?\$\$;/g) ?? []
    expect(rpcBlocks.length).toBe(3)
    for (const block of rpcBlocks) {
      expect(block, `expected security invoker in: ${block.slice(0, 80)}`).toMatch(/security invoker/)
      expect(block, `expected stable in: ${block.slice(0, 80)}`).toMatch(/\bstable\b/)
      expect(block, `expected auth.uid() scoping in: ${block.slice(0, 80)}`).toMatch(/auth\.uid\(\)/)
      expect(block).not.toMatch(/security definer/)
    }
  })

  it('grants EXECUTE on every RPC only to authenticated, after revoking the default PUBLIC grant', () => {
    for (const fn of [
      'analytics_time_to_response_summary()',
      'analytics_response_time_distribution()',
      'analytics_still_waiting()',
    ]) {
      const escaped = fn.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      expect(migrationSource, `missing revoke for ${fn}`).toMatch(
        new RegExp(`revoke execute on function public\\.${escaped} from public;`),
      )
      expect(migrationSource, `missing grant for ${fn}`).toMatch(
        new RegExp(`grant execute on function public\\.${escaped} to authenticated;`),
      )
    }
  })

  it('anchors the response-time calculation on jobs.applied_date, never on the first job_status_events row', () => {
    const summaryBlock = migrationSource.match(
      /create or replace function public\.analytics_time_to_response_summary[\s\S]*?\$\$;/,
    )
    expect(summaryBlock).not.toBeNull()
    expect(summaryBlock![0]).toMatch(/first_response\.changed_at::date - j\.applied_date/)
    expect(summaryBlock![0]).toMatch(/j\.applied_date is not null/)
  })

  it('the qualifying response status set is exactly OA, 1st Round, 2nd Round, Final Round, Offer, Rejected - never Applied or Ghosted', () => {
    const summaryBlock = migrationSource.match(
      /create or replace function public\.analytics_time_to_response_summary[\s\S]*?\$\$;/,
    )
    expect(summaryBlock).not.toBeNull()
    expect(summaryBlock![0]).toMatch(
      /to_status in \('OA', '1st Round', '2nd Round', 'Final Round', 'Offer', 'Rejected'\)/,
    )
    expect(summaryBlock![0]).not.toMatch(/'Applied'/)
    expect(summaryBlock![0]).not.toMatch(/'Ghosted'/)
  })

  it('only ever uses the earliest qualifying event on or after applied_date (min(), never max() or current status)', () => {
    const summaryBlock = migrationSource.match(
      /create or replace function public\.analytics_time_to_response_summary[\s\S]*?\$\$;/,
    )
    expect(summaryBlock).not.toBeNull()
    expect(summaryBlock![0]).toMatch(/select min\(e\.changed_at\) as changed_at/)
    expect(summaryBlock![0]).toMatch(/e\.changed_at >= j\.applied_date::timestamptz/)
  })

  it('excludes a job from the response calculation (never reports a negative duration) when the qualifying event predates applied_date', () => {
    const summaryBlock = migrationSource.match(
      /create or replace function public\.analytics_time_to_response_summary[\s\S]*?\$\$;/,
    )
    expect(summaryBlock![0]).toMatch(/where days >= 0/)
  })

  it('uses the true median (percentile_cont), not an average, for the summary metric', () => {
    const summaryBlock = migrationSource.match(
      /create or replace function public\.analytics_time_to_response_summary[\s\S]*?\$\$;/,
    )
    expect(summaryBlock![0]).toMatch(/percentile_cont\(0\.5\) within group \(order by days\)/)
    expect(summaryBlock![0]).not.toMatch(/\bavg\(/)
  })

  it('the distribution RPC buckets into exactly the five documented day ranges', () => {
    const distBlock = migrationSource.match(
      /create or replace function public\.analytics_response_time_distribution[\s\S]*?\$\$;/,
    )
    expect(distBlock).not.toBeNull()
    for (const bucket of ['0-3 days', '4-7 days', '8-14 days', '15-30 days', '30+ days']) {
      expect(distBlock![0]).toMatch(new RegExp(bucket.replace(/[+]/, '\\+')))
    }
  })

  it('Still Waiting is deliberately based on CURRENT status, not event history', () => {
    const waitingBlock = migrationSource.match(/create or replace function public\.analytics_still_waiting[\s\S]*?\$\$;/)
    expect(waitingBlock).not.toBeNull()
    expect(waitingBlock![0]).toMatch(/where user_id = auth\.uid\(\)\s*\n\s*and status = 'Applied'/)
    // It must not derive "waiting" from an absence of job_status_events rows.
    expect(waitingBlock![0]).not.toMatch(/job_status_events/)
  })

  it('never classifies a Still-Waiting job as Ghosted, and never auto-updates any job row', () => {
    expect(withoutComments).not.toMatch(/update public\.jobs/i)
    expect(withoutComments).not.toMatch(/set status = 'Ghosted'/i)
  })

  it('longest_wait_days is computed only over jobs with a non-null applied_date', () => {
    const waitingBlock = migrationSource.match(/create or replace function public\.analytics_still_waiting[\s\S]*?\$\$;/)
    expect(waitingBlock![0]).toMatch(/case when applied_date is not null then \(current_date - applied_date\) end/)
  })

  it('every function uses CREATE OR REPLACE, so the migration is safe to re-run', () => {
    expect(migrationSource).not.toMatch(/^create function/im)
  })
})
