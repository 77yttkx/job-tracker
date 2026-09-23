import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

// V3.1 requirement: manual (non-generated) answers must be possible
// without breaking existing generated rows or requiring a destructive
// migration. Source-level regression guard, same convention as
// interviewPrepMigration.test.ts and multiUserMigration.test.ts - there
// is no live Supabase project to exercise this against in this suite.

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const migrationSource = readFileSync(join(repoRoot, 'supabase-v3_1-manual-answers.sql'), 'utf-8')

describe('supabase-v3_1-manual-answers.sql (source-level regression guard)', () => {
  it('never touches public.jobs or public.personal_stories - only alters/extends behavior_answers', () => {
    const withoutComments = migrationSource.replace(/--[^\n]*/g, '')
    expect(withoutComments).not.toMatch(/\bpublic\.jobs\b/)
    expect(withoutComments).not.toMatch(/alter table (public\.)?personal_stories/i)
    expect(withoutComments).not.toMatch(/create table/i)
    expect(withoutComments).not.toMatch(/drop table/i)
  })

  it('makes story_id nullable (manual answers have no source story) without dropping or recreating the foreign key', () => {
    expect(migrationSource).toMatch(/alter table public\.behavior_answers\s+alter column story_id drop not null/)
    expect(migrationSource).not.toMatch(/drop constraint.*story_id.*fkey/i)
  })

  it('makes duration and tone nullable (legacy, generator-only fields)', () => {
    expect(migrationSource).toMatch(/alter column duration drop not null/)
    expect(migrationSource).toMatch(/alter column tone drop not null/)
  })

  it('adds a tags column with a safe, non-destructive default for existing rows', () => {
    expect(migrationSource).toMatch(
      /add column if not exists tags text\[\] not null default '\{\}'/,
    )
  })

  it('caps the tags array length rather than leaving it unbounded', () => {
    expect(migrationSource).toMatch(/behavior_answers_tags_max_count/)
    expect(migrationSource).toMatch(/array_length\(tags, 1\) <= 12/)
  })

  it('adds a GIN index on tags for future tag-filtered queries', () => {
    expect(migrationSource).toMatch(/create index if not exists behavior_answers_tags_idx\s+on public\.behavior_answers using gin \(tags\)/)
  })

  it('does not drop, alter, or add any RLS policy - the four owner-scoped policies from supabase-v3-interview-prep.sql are left untouched', () => {
    expect(migrationSource).not.toMatch(/create policy/i)
    expect(migrationSource).not.toMatch(/drop policy/i)
    expect(migrationSource).not.toMatch(/enable row level security/i)
  })

  it('is idempotent - every statement uses if not exists / if exists / drop-then-add so re-running it is safe', () => {
    expect(migrationSource).toMatch(/add column if not exists/)
    expect(migrationSource).toMatch(/create index if not exists/)
    expect(migrationSource).toMatch(/drop constraint if exists behavior_answers_tags_max_count/)
  })
})
