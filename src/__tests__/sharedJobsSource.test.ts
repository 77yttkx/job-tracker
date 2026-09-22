import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const appSource = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '..', 'App.tsx'),
  'utf-8',
)

/**
 * V2.5.1 #4 requires "Insights and Table load jobs through the same
 * Supabase data source/hook." App.tsx already satisfies this by calling
 * `useJobs(userId)` exactly once, inside the AuthenticatedApp subtree, and
 * passing that single `jobsState` down to both <InsightsPage> and
 * <TablePage> as a prop - neither page calls its own `useJobs()`, so there
 * is only ever one fetch, one loading/error state, and one `jobs` array
 * for the whole app to read. This is a wiring fact a pure unit test can't
 * otherwise observe, so it's guarded at the source level (see
 * insightsScope.test.ts for the same pattern) against a future regression
 * - e.g. someone giving a page its own independent `useJobs()` call, which
 * would silently desync Insights and Table onto two different
 * fetches/loading states.
 *
 * V2.6: `useJobs` now takes the signed-in user's id (see useJobs.ts) so
 * every fetch/create is scoped to them - this still only ever runs once.
 */
describe('App wiring: Insights and Table share one jobs data source (source-level regression guard)', () => {
  it('calls useJobs(userId) exactly once', () => {
    const calls = appSource.match(/\buseJobs\(userId\)/g) ?? []
    expect(calls).toHaveLength(1)
  })

  it('passes that same jobsState to both InsightsPage and TablePage', () => {
    expect(appSource).toMatch(/<InsightsPage\s+jobsState=\{jobsState\}/)
    expect(appSource).toMatch(/<TablePage\s+jobsState=\{jobsState\}/)
  })
})
