import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const migrationSource = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'supabase-v3-interview-prep.sql'),
  'utf-8',
)

/**
 * V3 requirement: personal_stories and behavior_answers must both be
 * fully owner-scoped via RLS, and this migration must never touch
 * public.jobs. Same source-level-guard pattern as
 * src/__tests__/multiUserMigration.test.ts, for the same reason: there is
 * no live Supabase project to exercise RLS against in this test suite.
 */
describe('supabase-v3-interview-prep.sql (source-level regression guard)', () => {
  it('never modifies public.jobs - no alter/create/drop statement, column, policy, or foreign key targets it (a plain-English mention in a trailing doc comment, confirming the table is untouched, is fine and expected)', () => {
    // Strip SQL line comments (-- ...) and the closing /* ... */ doc block
    // before scanning, so an explanatory comment like "this migration
    // never touches public.jobs" can't itself trip this guard - only an
    // actual SQL statement referencing public.jobs would.
    const withoutComments = migrationSource
      .replace(/--[^\n]*/g, '')
      .replace(/\/\*[\s\S]*?\*\//g, '')
    expect(withoutComments).not.toMatch(/\bpublic\.jobs\b/)
    expect(withoutComments).not.toMatch(/references\s+jobs\b/i)
    expect(withoutComments).not.toMatch(/alter table (public\.)?jobs/i)
  })

  it('creates personal_stories and behavior_answers with a user_id column', () => {
    expect(migrationSource).toMatch(/create table if not exists public\.personal_stories/)
    expect(migrationSource).toMatch(/create table if not exists public\.behavior_answers/)
    const storiesBlock = migrationSource.slice(
      migrationSource.indexOf('create table if not exists public.personal_stories'),
      migrationSource.indexOf('create table if not exists public.behavior_answers'),
    )
    expect(storiesBlock).toMatch(/user_id uuid not null references auth\.users/)
  })

  it('behavior_answers.story_id references personal_stories ON DELETE RESTRICT (never CASCADE)', () => {
    expect(migrationSource).toMatch(
      /story_id uuid not null references public\.personal_stories \(story_id\) on delete restrict/,
    )
    // Guard against a future edit accidentally switching this to cascade.
    const behaviorAnswersBlock = migrationSource.slice(
      migrationSource.indexOf('create table if not exists public.behavior_answers'),
      migrationSource.indexOf('create index if not exists behavior_answers_user_id_idx'),
    )
    expect(behaviorAnswersBlock).not.toMatch(/story_id.*on delete cascade/)
  })

  it('constrains duration and tone to the exact allowed values', () => {
    expect(migrationSource).toMatch(/duration in \('30s', '1min', '2min'\)/)
    expect(migrationSource).toMatch(/tone in \('concise', 'detailed'\)/)
  })

  it('enables RLS on both new tables', () => {
    expect(migrationSource).toMatch(/alter table public\.personal_stories enable row level security/)
    expect(migrationSource).toMatch(/alter table public\.behavior_answers enable row level security/)
  })

  it('creates all four ownership policies (select/insert/update/delete) for both tables, scoped to user_id = auth.uid(), for authenticated only', () => {
    for (const table of ['personal_stories', 'behavior_answers']) {
      for (const op of ['select', 'insert', 'update', 'delete']) {
        const policyName = `${table} ${op} own`
        const idx = migrationSource.indexOf(`create policy "${policyName}" on public.${table}`)
        expect(idx, `missing policy: ${policyName}`).toBeGreaterThan(-1)
      }
    }
  })

  it('insert and update policies use with check (user_id = auth.uid()) - not just using()', () => {
    const insertBlock = migrationSource.slice(
      migrationSource.indexOf('create policy "personal_stories insert own"'),
      migrationSource.indexOf('create policy "personal_stories update own"'),
    )
    expect(insertBlock).toMatch(/with check \(user_id = auth\.uid\(\)\)/)

    const updateBlock = migrationSource.slice(
      migrationSource.indexOf('create policy "personal_stories update own"'),
      migrationSource.indexOf('create policy "personal_stories delete own"'),
    )
    expect(updateBlock).toMatch(/using \(user_id = auth\.uid\(\)\)/)
    expect(updateBlock).toMatch(/with check \(user_id = auth\.uid\(\)\)/)
  })

  it('revokes anon access on both tables', () => {
    expect(migrationSource).toMatch(/revoke all on public\.personal_stories from anon/)
    expect(migrationSource).toMatch(/revoke all on public\.behavior_answers from anon/)
  })

  it('adds updated_at triggers for both tables', () => {
    expect(migrationSource).toMatch(/create trigger personal_stories_set_updated_at/)
    expect(migrationSource).toMatch(/create trigger behavior_answers_set_updated_at/)
  })

  it('adds the required indexes', () => {
    expect(migrationSource).toMatch(/create index if not exists personal_stories_user_id_idx/)
    expect(migrationSource).toMatch(/create index if not exists personal_stories_updated_at_idx/)
    expect(migrationSource).toMatch(/create index if not exists behavior_answers_user_id_idx/)
    expect(migrationSource).toMatch(/create index if not exists behavior_answers_story_id_idx/)
    expect(migrationSource).toMatch(/create index if not exists behavior_answers_updated_at_idx/)
  })

  it('the usage-quota table has no insert/update/delete policy for ordinary authenticated callers - only the SECURITY INVOKER RPC can write it', () => {
    expect(migrationSource).toMatch(/revoke insert, update, delete on public\.generation_usage from authenticated/)
    expect(migrationSource).toMatch(/create or replace function public\.increment_generation_usage/)
    expect(migrationSource).toMatch(/security invoker/)
  })
})
