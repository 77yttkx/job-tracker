import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

// V3.2 requirement: adding prompt_key to behavior_answers must be purely
// additive, must not touch public.jobs or public.personal_stories, and
// must not change any RLS policy (row-scoped RLS already covers a new
// column with no changes needed). Source-level regression guard, same
// convention as multiUserMigration.test.ts / manualAnswersMigration.test.ts
// - there is no live Supabase project to exercise this against here.

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const migrationSource = readFileSync(join(repoRoot, 'supabase-v3_2-bq-structure.sql'), 'utf-8')

describe('supabase-v3_2-bq-structure.sql (source-level regression guard)', () => {
  it('never touches public.jobs or public.personal_stories - only extends behavior_answers', () => {
    const withoutComments = migrationSource.replace(/--[^\n]*/g, '')
    expect(withoutComments).not.toMatch(/\bpublic\.jobs\b/)
    expect(withoutComments).not.toMatch(/alter table (public\.)?personal_stories/i)
    expect(withoutComments).not.toMatch(/create table/i)
    expect(withoutComments).not.toMatch(/drop table/i)
  })

  it('adds prompt_key as a nullable text column (never NOT NULL - no default is required for existing rows)', () => {
    expect(migrationSource).toMatch(/add column if not exists prompt_key text;/)
    expect(migrationSource).not.toMatch(/prompt_key text not null/)
  })

  it('never creates, drops, or alters any RLS policy - the four existing behavior_answers policies already cover the new column', () => {
    const withoutComments = migrationSource.replace(/--[^\n]*/g, '')
    expect(withoutComments).not.toMatch(/create policy/i)
    expect(withoutComments).not.toMatch(/drop policy/i)
    expect(withoutComments).not.toMatch(/alter policy/i)
  })

  it('indexes prompt_key as a partial index (excluding NULL), not a full-column index', () => {
    expect(migrationSource).toMatch(
      /create index if not exists behavior_answers_prompt_key_idx\s*\n\s*on public\.behavior_answers \(user_id, prompt_key\)\s*\n\s*where prompt_key is not null;/,
    )
  })

  it('is idempotent - every DDL "add column"/"create index" statement uses if not exists', () => {
    // Strip comment lines first - the file's own prose (correctly)
    // describes what it does using the words "add column"/"create
    // index" without necessarily repeating "if not exists" in the same
    // sentence; only actual SQL statements are asserted on here.
    const codeLines = migrationSource.split('\n').filter((line) => !line.trim().startsWith('--'))
    const addColumnAndIndexLines = codeLines.filter((line) => /add column|create index/i.test(line))
    expect(addColumnAndIndexLines.length).toBeGreaterThan(0)
    for (const line of addColumnAndIndexLines) {
      expect(line, `expected "if not exists" in: ${line}`).toMatch(/if not exists/i)
    }
  })
})
