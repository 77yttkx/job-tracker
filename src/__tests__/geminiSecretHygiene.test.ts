import { readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

// V3 spec section 6/14: the Gemini API key must never be reachable from
// the frontend - no VITE_GEMINI_API_KEY anywhere, no real key value
// committed anywhere, and .env.example must not gain a Gemini variable
// (since Vite only ever exposes VITE_-prefixed vars to client code, and
// the key belongs exclusively in Supabase secrets, read via Deno.env in
// the Edge Function). This is a source-level regression guard, same
// convention as secretHygiene.test.ts.

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const envExample = readFileSync(join(repoRoot, '.env.example'), 'utf-8')
const srcDir = join(repoRoot, 'src')

function listFilesRecursive(dir: string): string[] {
  const entries = readdirSync(dir)
  const files: string[] = []
  for (const entry of entries) {
    const full = join(dir, entry)
    const stat = statSync(full)
    if (stat.isDirectory()) {
      files.push(...listFilesRecursive(full))
    } else {
      files.push(full)
    }
  }
  return files
}

describe('Gemini secret hygiene (source-level regression guard)', () => {
  it('.env.example never declares a Gemini variable - the key is a Supabase secret, not a frontend env var', () => {
    expect(envExample).not.toMatch(/GEMINI/i)
    expect(envExample).not.toMatch(/VITE_GEMINI_API_KEY/)
  })

  it('no file under src/ references VITE_GEMINI_API_KEY or import.meta.env.GEMINI', () => {
    const files = listFilesRecursive(srcDir).filter(
      (f) => /\.(ts|tsx)$/.test(f) && !f.endsWith('geminiSecretHygiene.test.ts'),
    )
    for (const file of files) {
      const content = readFileSync(file, 'utf-8')
      expect(content, `${file} must not reference VITE_GEMINI_API_KEY`).not.toMatch(/VITE_GEMINI_API_KEY/)
      expect(content, `${file} must not read import.meta.env.GEMINI*`).not.toMatch(/import\.meta\.env\.GEMINI/)
    }
  })

  it('no file under src/ (the frontend) references GEMINI_API_KEY at all - only the Edge Function may', () => {
    const files = listFilesRecursive(srcDir).filter(
      (f) => /\.(ts|tsx)$/.test(f) && !f.endsWith('geminiSecretHygiene.test.ts') && !f.endsWith('generateStarAnswerFunction.test.ts'),
    )
    for (const file of files) {
      const content = readFileSync(file, 'utf-8')
      expect(content, `${file} must not reference GEMINI_API_KEY`).not.toMatch(/GEMINI_API_KEY/)
    }
  })

  it('V3.1: the frontend no longer invokes generate-star-answer at all - Interview Prep is a manual answer organizer (see README.md)', () => {
    // Exclude this file itself (it legitimately mentions the string being
    // banned, as part of the regex it checks other files against) and
    // generateStarAnswerFunction.test.ts (a source-level guard over the
    // still-deployed-but-now-unused Edge Function, which legitimately
    // references its own name).
    const files = listFilesRecursive(srcDir).filter(
      (f) =>
        /\.(ts|tsx)$/.test(f) &&
        !f.endsWith('geminiSecretHygiene.test.ts') &&
        !f.endsWith('generateStarAnswerFunction.test.ts'),
    )
    for (const file of files) {
      const content = readFileSync(file, 'utf-8')
      expect(content, `${file} must not invoke generate-star-answer`).not.toMatch(/generate-star-answer/)
      expect(content, `${file} must not fetch Gemini directly`).not.toMatch(/generativelanguage\.googleapis\.com/)
    }
    // The generator service module itself is gone, not just unused.
    expect(() => readFileSync(join(srcDir, 'services', 'interviewPrepGenerator.ts'), 'utf-8')).toThrow()
  })

  it('no real-looking Gemini API key (AIza... format) is committed anywhere under src/ or supabase/', () => {
    const files = [
      ...listFilesRecursive(srcDir),
      ...listFilesRecursive(join(repoRoot, 'supabase')),
    ].filter((f) => /\.(ts|tsx|sql|md|json)$/.test(f))
    for (const file of files) {
      const content = readFileSync(file, 'utf-8')
      expect(content, `${file} must not contain a real-looking Gemini API key`).not.toMatch(/AIza[0-9A-Za-z_-]{35}/)
    }
  })

  it('the Edge Function reads GEMINI_API_KEY only via Deno.env.get, never a hardcoded fallback string', () => {
    const fnPath = join(repoRoot, 'supabase', 'functions', 'generate-star-answer', 'index.ts')
    const content = readFileSync(fnPath, 'utf-8')
    expect(content).toMatch(/Deno\.env\.get\('GEMINI_API_KEY'\)/)
    // The only place "GEMINI_API_KEY" is assigned a literal string is never -
    // it's always read from the environment.
    expect(content).not.toMatch(/GEMINI_API_KEY\s*=\s*['"]AIza/)
  })
})
