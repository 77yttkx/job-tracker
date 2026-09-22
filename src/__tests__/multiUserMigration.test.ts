import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const migrationSource = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'supabase-v2_6-multi-user.sql'),
  'utf-8',
)

/**
 * V2.6 requirement: "two users cannot read or modify each other's jobs."
 * The actual enforcement boundary is Postgres RLS in Supabase, which this
 * repo has no way to exercise against a live database in CI (no test
 * Supabase project is provisioned here - see README's Testing section).
 * So, consistent with every other source-level regression guard in this
 * codebase (insightsScope.test.ts, sharedJobsSource.test.ts, etc.), this
 * test guards the migration file itself: the four required
 * `user_id = auth.uid()` policies must exist, with no leftover
 * anon-accessible policy that would silently defeat them.
 */
describe('supabase-v2_6-multi-user.sql (source-level regression guard)', () => {
  it('adds a user_id column referencing auth.users', () => {
    expect(migrationSource).toMatch(
      /add column if not exists user_id uuid references auth\.users/,
    )
  })

  it('drops every old anon-accessible policy from the single-user MVP', () => {
    expect(migrationSource).toMatch(/drop policy if exists "dev anon select" on public\.jobs/)
    expect(migrationSource).toMatch(/drop policy if exists "dev anon insert" on public\.jobs/)
    expect(migrationSource).toMatch(/drop policy if exists "dev anon update" on public\.jobs/)
    expect(migrationSource).toMatch(/drop policy if exists "dev anon delete" on public\.jobs/)
  })

  it('revokes table access from anon and grants it only to authenticated', () => {
    expect(migrationSource).toMatch(/revoke all on public\.jobs from anon/)
    expect(migrationSource).toMatch(
      /grant select, insert, update, delete on public\.jobs to authenticated/,
    )
  })

  it('creates a select/insert/update/delete policy, each scoped to user_id = auth.uid(), for the authenticated role only', () => {
    const requiredPolicies: Array<{ name: string; clause: RegExp }> = [
      { name: 'jobs select own', clause: /using \(user_id = auth\.uid\(\)\)/ },
      { name: 'jobs insert own', clause: /with check \(user_id = auth\.uid\(\)\)/ },
      { name: 'jobs update own', clause: /using \(user_id = auth\.uid\(\)\)\s*\n\s*with check \(user_id = auth\.uid\(\)\)/ },
      { name: 'jobs delete own', clause: /using \(user_id = auth\.uid\(\)\)/ },
    ]

    for (const { name } of requiredPolicies) {
      const createIdx = migrationSource.indexOf(`create policy "${name}" on public.jobs`)
      expect(createIdx, `create policy "${name}" not found`).toBeGreaterThan(-1)
    }

    // insert/update must both carry a `with check` - this is what stops a
    // user from creating or re-pointing a row to someone else's user_id,
    // even if the request body claims a different owner.
    const insertBlock = migrationSource.slice(
      migrationSource.indexOf('create policy "jobs insert own"'),
      migrationSource.indexOf('create policy "jobs update own"'),
    )
    expect(insertBlock).toMatch(/with check \(user_id = auth\.uid\(\)\)/)

    const updateBlock = migrationSource.slice(
      migrationSource.indexOf('create policy "jobs update own"'),
      migrationSource.indexOf('create policy "jobs delete own"'),
    )
    expect(updateBlock).toMatch(/using \(user_id = auth\.uid\(\)\)/)
    expect(updateBlock).toMatch(/with check \(user_id = auth\.uid\(\)\)/)
  })

  it('scopes every one of the four policies to the authenticated role, never anon or public', () => {
    const policyBlocks = [...migrationSource.matchAll(/create policy "jobs [a-z]+ own" on public\.jobs[\s\S]*?;/g)]
    expect(policyBlocks.length).toBe(4)
    for (const [block] of policyBlocks) {
      expect(block).toMatch(/for (select|insert|update|delete) to authenticated/)
    }
  })

  it('does not automatically assign legacy (user_id IS NULL) rows to any account', () => {
    // The only UPDATE ... SET user_id = ... in the file must be inside a
    // commented-out, opt-in snippet - never live SQL that runs as part of
    // the migration itself.
    const liveSql = migrationSource
      .split('\n')
      .filter((line) => !line.trim().startsWith('--'))
      .join('\n')
    expect(liveSql).not.toMatch(/update public\.jobs\s*\n\s*set user_id/i)
  })

  it('re-enables row level security on the table', () => {
    expect(migrationSource).toMatch(/alter table public\.jobs enable row level security/)
  })
})
