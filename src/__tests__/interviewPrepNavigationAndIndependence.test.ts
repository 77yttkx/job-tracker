import { readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

// V3 spec sections 1 and 11, relaxed by V3.2's explicit product decision:
// "Interview Prep" must sit directly below "Table" in the sidebar (never
// above it), and every Interview Prep route must exist. Interview Prep
// may only share generic, jobs-agnostic infrastructure (auth, layout,
// theme, DataStates, lib/utils, the single Supabase client) - with ONE
// narrow, deliberate exception as of V3.2: "Prepare for a Job"
// (src/pages/interviewPrep/bq/PrepareForJobPage.tsx and its own
// src/components/interviewPrep/prepareForJob/* subcomponents) may read a
// user-selected job's own fields (via the same RLS-scoped jobsState prop
// InsightsPage/TablePage already receive - never its own fetch, never
// another user's data, and never a write to public.jobs). Every other
// Interview Prep file remains fully isolated from the Job Tracker's jobs
// data layer, which this test still enforces. This is a source-level
// regression guard, consistent with the rest of this codebase's
// Deno/SQL/Edge-Function tests.

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const appShellSource = readFileSync(join(repoRoot, 'src', 'components', 'layout', 'AppShell.tsx'), 'utf-8')
const appSource = readFileSync(join(repoRoot, 'src', 'App.tsx'), 'utf-8')

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

describe('Interview Prep navigation position and route wiring', () => {
  it('NAV_ITEMS has Interview Prep directly after Table, and Table directly after Insights', () => {
    const match = appShellSource.match(/const NAV_ITEMS = \[([\s\S]*?)\] as const/)
    expect(match).not.toBeNull()
    const itemsBlock = match![1]
    const toValues = [...itemsBlock.matchAll(/to:\s*'([^']+)'/g)].map((m) => m[1])
    expect(toValues).toEqual(['/insights', '/table', '/interview-prep'])
  })

  it('Interview Prep uses a real lucide-react icon, not a placeholder', () => {
    expect(appShellSource).toMatch(/MessagesSquare/)
    expect(appShellSource).toMatch(/from 'lucide-react'/)
  })

  it('App.tsx redirects /interview-prep to /interview-prep/bq, and /interview-prep/bq to /interview-prep/bq/questions (the primary page - V3.2), defines every BQ subpage route plus the Technical Interview placeholder, with no AI-generation route left over', () => {
    expect(appSource).toMatch(/path="\/interview-prep"\s+element=\{<Navigate to="\/interview-prep\/bq" replace \/>\}/)
    expect(appSource).toMatch(/path="\/interview-prep\/bq"\s+element=\{<Navigate to="\/interview-prep\/bq\/questions" replace \/>\}/)
    expect(appSource).toMatch(/path="\/interview-prep\/bq\/questions"/)
    expect(appSource).toMatch(/path="\/interview-prep\/bq\/answers"/)
    expect(appSource).toMatch(/path="\/interview-prep\/bq\/prepare"/)
    expect(appSource).toMatch(/path="\/interview-prep\/bq\/stories"/)
    expect(appSource).toMatch(/path="\/interview-prep\/technical"/)
    expect(appSource).toMatch(/TechnicalComingSoonPage/)
    expect(appSource).not.toMatch(/path="\/interview-prep\/generate"/)
    expect(appSource).not.toMatch(/GenerateAnswerPage/)
  })

  it('the old V3.1 routes redirect forward rather than 404ing', () => {
    expect(appSource).toMatch(/path="\/interview-prep\/answers"\s+element=\{<Navigate to="\/interview-prep\/bq\/answers" replace \/>\}/)
    expect(appSource).toMatch(/path="\/interview-prep\/stories"\s+element=\{<Navigate to="\/interview-prep\/bq\/stories" replace \/>\}/)
  })

  it('App.tsx mounts useStories and useAnswers independently of the jobs hook state', () => {
    expect(appSource).toMatch(/useStories\(userId\)/)
    expect(appSource).toMatch(/useAnswers\(userId\)/)
  })
})

describe('Interview Prep independence from the Job Tracker jobs data layer (V3.2: one narrow, explicit exception)', () => {
  const interviewPrepDirs = [
    join(repoRoot, 'src', 'pages', 'interviewPrep'),
    join(repoRoot, 'src', 'components', 'interviewPrep'),
  ]

  // The ONLY files permitted to read job data as of V3.2 - the "Prepare
  // for a Job" page and its own private subcomponents (JobPicker, which
  // renders the job list; CompetencyChips and RecommendationList do NOT
  // import job data and are listed here only because they live in the
  // same folder). Every other file under interviewPrepDirs, plus the
  // shared hooks/services/lib/types files below, must still have zero
  // import of the jobs data layer.
  const jobsAwareFiles = [
    join(repoRoot, 'src', 'pages', 'interviewPrep', 'bq', 'PrepareForJobPage.tsx'),
    join(repoRoot, 'src', 'components', 'interviewPrep', 'prepareForJob', 'JobPicker.tsx'),
  ]

  const interviewPrepFiles = [
    ...interviewPrepDirs.flatMap((d) => listFilesRecursive(d)),
    join(repoRoot, 'src', 'hooks', 'useStories.ts'),
    join(repoRoot, 'src', 'hooks', 'useAnswers.ts'),
    join(repoRoot, 'src', 'services', 'stories.ts'),
    join(repoRoot, 'src', 'services', 'answers.ts'),
    join(repoRoot, 'src', 'services', 'supabaseError.ts'),
    join(repoRoot, 'src', 'lib', 'interviewPrepConstants.ts'),
    join(repoRoot, 'src', 'lib', 'tagValidation.ts'),
    join(repoRoot, 'src', 'lib', 'bqPrompts.ts'),
    join(repoRoot, 'src', 'lib', 'jdKeywords.ts'),
    join(repoRoot, 'src', 'lib', 'bqRecommendations.ts'),
    join(repoRoot, 'src', 'types', 'interviewPrep.ts'),
  ].filter((f) => f.endsWith('.ts') || f.endsWith('.tsx'))

  const isolatedFiles = interviewPrepFiles.filter((f) => !jobsAwareFiles.includes(f))

  it('found the expected set of Interview Prep source files (guards against an empty/stale file list)', () => {
    expect(interviewPrepFiles.length).toBeGreaterThan(10)
  })

  it('jobsAwareFiles actually exist (guards against a stale exception list after a future rename)', () => {
    for (const file of jobsAwareFiles) {
      expect(() => readFileSync(file, 'utf-8'), `expected ${file} to exist`).not.toThrow()
    }
  })

  it('no Interview Prep file OTHER THAN the Prepare-for-a-Job exception has an import statement referencing useJobs, services/jobs, or components/jobs', () => {
    const importLine = /^import\b[^\n]*$/gm
    for (const file of isolatedFiles) {
      const content = readFileSync(file, 'utf-8')
      const imports = content.match(importLine) ?? []
      for (const line of imports) {
        expect(line, `${file} must not import from the jobs data layer`).not.toMatch(/useJobs/)
        expect(line, `${file} must not import from services\\/jobs`).not.toMatch(/services\/jobs['"]/)
        expect(line, `${file} must not import from components\\/jobs`).not.toMatch(/components\/jobs\//)
      }
    }
  })

  it('no Interview Prep file OTHER THAN the Prepare-for-a-Job exception calls useJobs(...) or queries the jobs table directly', () => {
    for (const file of isolatedFiles) {
      const content = readFileSync(file, 'utf-8')
      expect(content, `${file} must not call useJobs(`).not.toMatch(/\buseJobs\(/)
      expect(content, `${file} must not query the jobs table`).not.toMatch(/\.from\(['"]jobs['"]\)/)
    }
  })

  it('PrepareForJobPage never calls useJobs() or queries the jobs table itself - it only ever reads the jobsState prop passed down from App.tsx, the same RLS-scoped source Insights/Table already use', () => {
    const raw = readFileSync(join(repoRoot, 'src', 'pages', 'interviewPrep', 'bq', 'PrepareForJobPage.tsx'), 'utf-8')
    // Strip comments first - the doc comment above legitimately mentions
    // App.tsx's own `useJobs(userId)` call in prose; this test is about
    // actual calls in code, not about the file never naming the hook.
    const code = raw.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')
    expect(code).not.toMatch(/\buseJobs\(/)
    expect(code).not.toMatch(/\.from\(['"]jobs['"]\)/)
    expect(raw).toMatch(/jobsState: ReturnType<typeof useJobs>/)
  })

  it('PrepareForJobPage never writes to public.jobs - it has no addJob/editJob/removeJob/updateJob/createJob/deleteJob call anywhere', () => {
    const content = readFileSync(join(repoRoot, 'src', 'pages', 'interviewPrep', 'bq', 'PrepareForJobPage.tsx'), 'utf-8')
    expect(content).not.toMatch(/\b(addJob|editJob|removeJob|updateJob|createJob|deleteJob)\(/)
  })

  it('Interview Prep is free to import genuinely shared, jobs-agnostic infrastructure (sanity check the allowance itself is exercised)', () => {
    const storyLibrary = readFileSync(
      join(repoRoot, 'src', 'pages', 'interviewPrep', 'bq', 'StoryLibraryPage.tsx'),
      'utf-8',
    )
    // Shared Supabase client and generic UI primitives ARE allowed and
    // used - this is not a blanket "zero imports outside the folder"
    // rule, only "zero imports of jobs *data*" (except the one named
    // exception above).
    expect(storyLibrary).toMatch(/from '\.\.\/\.\.\/\.\.\/components\/ui\/DataStates'|DataStates/)
  })
})
