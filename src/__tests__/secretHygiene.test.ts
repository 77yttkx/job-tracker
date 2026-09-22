import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const gitignore = readFileSync(join(repoRoot, '.gitignore'), 'utf-8')
const envExample = readFileSync(join(repoRoot, '.env.example'), 'utf-8')

/**
 * V2.6 GitHub-readiness requirement: ".env, .env.*, node_modules, dist,
 * all _to_delete folders, backup folders, .tar.gz files, test output, and
 * local Supabase secrets" must never be committed, and .env.example must
 * only ever contain variable names. This repo has no CI-provisioned git
 * remote to actually push and inspect, so - consistent with every other
 * source-level regression guard in this codebase - this test guards the
 * two artifacts that make that true: .gitignore's patterns, and
 * .env.example's contents.
 */
describe('secret hygiene for GitHub readiness (source-level regression guard)', () => {
  it('.gitignore excludes every env file except the safe, variable-names-only example', () => {
    expect(gitignore).toMatch(/^\.env$/m)
    expect(gitignore).toMatch(/^\.env\.\*$/m)
    expect(gitignore).toMatch(/^!\.env\.example$/m)
  })

  it('.gitignore excludes node_modules, build output, and TS build info', () => {
    expect(gitignore).toMatch(/^node_modules$/m)
    expect(gitignore).toMatch(/^dist$/m)
    expect(gitignore).toMatch(/\*\.tsbuildinfo/)
  })

  it('.gitignore excludes _to_delete folders, backup folders, and .tar.gz archives left over from earlier phases', () => {
    expect(gitignore).toMatch(/^_to_delete$/m)
    expect(gitignore).toMatch(/\*-before-\*/)
    expect(gitignore).toMatch(/\*\.tar\.gz/)
  })

  it('.gitignore excludes local Supabase CLI state (which holds a plaintext DB connection string/project ref)', () => {
    expect(gitignore).toMatch(/supabase\/\.temp/)
    expect(gitignore).toMatch(/^\.supabase$/m)
  })

  it('.gitignore excludes test output', () => {
    expect(gitignore).toMatch(/^coverage$/m)
    expect(gitignore).toMatch(/test-results/)
  })

  it('.env.example contains only variable names, never a real Supabase URL, key, or any other value', () => {
    const declaredVars = [...envExample.matchAll(/^([A-Z0-9_]+)=(.*)$/gm)]
    expect(declaredVars.length).toBeGreaterThan(0)
    for (const [, name, value] of declaredVars) {
      expect(value.trim(), `${name} must be blank in .env.example`).toBe('')
    }
    // Never contains a real-looking project URL, an anon/publishable key,
    // or a JWT (Supabase's older anon-key format).
    expect(envExample).not.toMatch(/https:\/\/[a-z0-9]{15,}\.supabase\.co/)
    expect(envExample).not.toMatch(/sb_(publishable|secret)_/)
    expect(envExample).not.toMatch(/eyJ[A-Za-z0-9_-]{10,}\./)
  })
})
