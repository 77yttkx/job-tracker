import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

// V3.5 requirement: the event-based Application Funnel's database layer
// must be purely additive on top of public.jobs / public.job_status_events,
// must never alter or drop the existing V3.3 analytics_application_funnel()
// (current-status distribution, deliberately kept in the database, just
// no longer called by the frontend), and must never touch V3.4 at all.
// Source-level regression guard, same convention as
// sqlAnalyticsMigration.test.ts / timeToResponseMigration.test.ts - there
// is no live Supabase project to exercise this against here.

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const migrationSource = readFileSync(join(repoRoot, 'supabase-v3_5-application-funnel.sql'), 'utf-8')
const withoutComments = migrationSource.replace(/--[^\n]*/g, '')

const funnelBlockMatch = migrationSource.match(
  /create or replace function public\.analytics_application_funnel_progression\(\)[\s\S]*?\$\$;/,
)
const funnelBlock = funnelBlockMatch ? funnelBlockMatch[0] : ''

describe('supabase-v3_5-application-funnel.sql (source-level regression guard)', () => {
  it('defines the funnel-progression RPC', () => {
    expect(funnelBlockMatch).not.toBeNull()
  })

  it('never adds, drops, or alters a column on public.jobs or public.job_status_events', () => {
    expect(withoutComments).not.toMatch(/alter table (public\.)?(jobs|job_status_events)\s+(add|drop|alter) column/i)
  })

  it('never creates a table, index, trigger, or RLS policy - an RPC only', () => {
    expect(withoutComments).not.toMatch(/create table/i)
    expect(withoutComments).not.toMatch(/create index/i)
    expect(withoutComments).not.toMatch(/create trigger/i)
    expect(withoutComments).not.toMatch(/create policy/i)
    expect(withoutComments).not.toMatch(/alter table[\s\S]*?(enable|disable|force) row level security/i)
  })

  it('never redefines, drops, or alters the existing V3.3 analytics_application_funnel() RPC - it is kept as-is', () => {
    expect(migrationSource).not.toMatch(/create or replace function public\.analytics_application_funnel\(\)/)
    expect(migrationSource).not.toMatch(/drop function[^;]*analytics_application_funnel\(\)/i)
  })

  it('never touches any V3.4 Time to Response function', () => {
    expect(migrationSource).not.toMatch(/analytics_time_to_response_summary/)
    expect(migrationSource).not.toMatch(/analytics_response_time_distribution/)
    expect(migrationSource).not.toMatch(/analytics_still_waiting/)
  })

  it('is security invoker, stable, and scoped by auth.uid() - never security definer', () => {
    expect(funnelBlock).toMatch(/security invoker/)
    expect(funnelBlock).toMatch(/\bstable\b/)
    expect(funnelBlock).not.toMatch(/security definer/)
    // auth.uid() scoping must appear in both the cohort CTE and the
    // per-job aggregation CTE - every row read is scoped, not just one.
    const uidMatches = funnelBlock.match(/user_id = auth\.uid\(\)/g) ?? []
    expect(uidMatches.length).toBeGreaterThanOrEqual(2)
  })

  it('grants EXECUTE only to authenticated, after revoking the default PUBLIC grant', () => {
    expect(migrationSource).toMatch(
      /revoke execute on function public\.analytics_application_funnel_progression\(\) from public;/,
    )
    expect(migrationSource).toMatch(
      /grant execute on function public\.analytics_application_funnel_progression\(\) to authenticated;/,
    )
  })

  it('the analyzable cohort is defined as jobs with a from_status-is-null job_status_events row - never current status, never all jobs', () => {
    expect(funnelBlock).toMatch(/from public\.job_status_events\s*\n\s*where user_id = auth\.uid\(\)\s*\n\s*and from_status is null/)
    // The funnel must never read public.jobs directly to build its
    // cohort or stage counts - everything comes from recorded events,
    // never from reconstructing history out of jobs.status.
    expect(funnelBlock).not.toMatch(/from public\.jobs\b/)
  })

  it('Employer Response qualifies on OA/1st Round/2nd Round/Final Round/Offer/Rejected - never Applied or Ghosted', () => {
    const responseMatch = funnelBlock.match(/bool_or\(e\.to_status in \(([^)]*)\)\) as got_response/)
    expect(responseMatch).not.toBeNull()
    expect(responseMatch![1]).toBe("'OA', '1st Round', '2nd Round', 'Final Round', 'Offer', 'Rejected'")
  })

  it('Ghosted never counts toward Employer Response (or any other stage)', () => {
    expect(funnelBlock).not.toMatch(/'Ghosted'/)
  })

  it('Applied never counts toward any stage (it is the starting state, not a qualifying event)', () => {
    // 'Applied' must not appear inside any of the four stage qualifying sets.
    const stageSets = funnelBlock.match(/to_status (in \([^)]*\)|= 'Offer')/g) ?? []
    expect(stageSets.length).toBeGreaterThan(0)
    for (const set of stageSets) {
      expect(set).not.toMatch(/'Applied'/)
    }
  })

  it('Interview qualifies on 1st Round/2nd Round/Final Round/Offer only - not OA, not Rejected', () => {
    const interviewMatch = funnelBlock.match(/bool_or\(e\.to_status in \(([^)]*)\)\) as got_interview/)
    expect(interviewMatch).not.toBeNull()
    expect(interviewMatch![1]).toBe("'1st Round', '2nd Round', 'Final Round', 'Offer'")
  })

  it('a job that was Rejected counts as Employer Response but only counts as Interview if it ALSO has a qualifying interview-stage event (bool_or over all its events, not the final/rejected one alone)', () => {
    // bool_or(...) is computed independently per stage over every event
    // row for the job - a job whose only non-Applied event is 'Rejected'
    // satisfies got_response but not got_interview/got_final_round/got_offer,
    // while a job with Rejected AND an earlier '1st Round' event
    // satisfies both, because each bool_or scans the same full event set
    // for that job_id independently.
    expect(funnelBlock).toMatch(/bool_or\(e\.to_status in \('OA', '1st Round', '2nd Round', 'Final Round', 'Offer', 'Rejected'\)\) as got_response/)
    expect(funnelBlock).toMatch(/bool_or\(e\.to_status in \('1st Round', '2nd Round', 'Final Round', 'Offer'\)\) as got_interview/)
    expect(funnelBlock).toMatch(/group by e\.job_id/)
  })

  it('Final Round qualifies on Final Round/Offer only', () => {
    const finalMatch = funnelBlock.match(/bool_or\(e\.to_status in \(([^)]*)\)\) as got_final_round/)
    expect(finalMatch).not.toBeNull()
    expect(finalMatch![1]).toBe("'Final Round', 'Offer'")
  })

  it('Offer qualifies only on an actual Offer event', () => {
    expect(funnelBlock).toMatch(/bool_or\(e\.to_status = 'Offer'\) as got_offer/)
  })

  it('a later-stage event implies every earlier cumulative stage, because stage sets are supersets of one another (Offer < FinalRound-or-Offer < Interview-set < Response-set)', () => {
    // Every status in the Offer set is also in the Final Round set; every
    // status in the Final Round set is also in the Interview set; every
    // status in the Interview set is also in the Employer Response set.
    // This is what guarantees "reached Offer" automatically implies
    // "reached Interview" etc. without a separate historical join.
    const responseSet = ['OA', '1st Round', '2nd Round', 'Final Round', 'Offer', 'Rejected']
    const interviewSet = ['1st Round', '2nd Round', 'Final Round', 'Offer']
    const finalRoundSet = ['Final Round', 'Offer']
    const offerSet = ['Offer']
    for (const s of offerSet) expect(finalRoundSet).toContain(s)
    for (const s of finalRoundSet) expect(interviewSet).toContain(s)
    for (const s of interviewSet) expect(responseSet).toContain(s)
  })

  it('old/partial-history jobs (no from_status-is-null event) never enter the cohort, and their later events are never joined in', () => {
    // The `reached` CTE explicitly inner-joins to `cohort` on job_id, so a
    // job absent from `cohort` contributes no row at all - its other
    // (incomplete, post-migration-only) events are never read.
    expect(funnelBlock).toMatch(/join cohort c on c\.job_id = e\.job_id/)
  })

  it('counts cohort_total independently of the stage aggregation, so every cohort job is counted even if it has no qualifying stage event at all', () => {
    expect(funnelBlock).toMatch(/\(select count\(\*\) from cohort\)::bigint as cohort_total/)
  })

  it('is idempotent - uses CREATE OR REPLACE, never a bare CREATE FUNCTION', () => {
    expect(migrationSource).not.toMatch(/^create function/im)
    expect(migrationSource).toMatch(/create or replace function public\.analytics_application_funnel_progression/)
  })
})
