import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

function read(relativeToSrc: string): string {
  return readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), '..', relativeToSrc),
    'utf-8',
  )
}

const jobsServiceSource = read('services/jobs.ts')
const useJobsSource = read('hooks/useJobs.ts')
const appSource = read('App.tsx')
const insightsSource = read('pages/InsightsPage.tsx')
const tableSource = read('pages/TablePage.tsx')

/**
 * V2.6 requires Insights, Table, and CSV export to only ever show the
 * signed-in user's jobs. The actual boundary is Postgres RLS (every
 * `supabase-js` call carries the signed-in user's session token, and
 * `supabase-v2_6-multi-user.sql`'s policies filter every read to
 * `user_id = auth.uid()` - see multiUserMigration.test.ts), so
 * `fetchJobs()` already only ever returns that user's rows without any
 * extra filtering in application code. This test guards the wiring that
 * makes that true: there must be exactly one fetch (via useJobs, scoped to
 * a userId), and neither page nor the CSV button may re-fetch or merge in
 * a separate, unscoped dataset.
 */
describe('V2.6 data scoping (source-level regression guard)', () => {
  it('fetchJobs takes no client-side user filter - it relies entirely on RLS, so there is nothing to accidentally get wrong or bypass', () => {
    expect(jobsServiceSource).toMatch(/export async function fetchJobs\(\): Promise<Job\[\]>/)
  })

  it('useJobs requires a userId and is the only place fetchJobs is called', () => {
    expect(useJobsSource).toMatch(/export function useJobs\(userId: string\): UseJobsResult/)
    const fetchCalls = useJobsSource.match(/\bfetchJobs\(\)/g) ?? []
    expect(fetchCalls.length).toBe(1)
  })

  it('App.tsx never calls fetchJobs directly - only through the single useJobs(userId) hook', () => {
    expect(appSource).not.toMatch(/\bfetchJobs\(/)
  })

  it('Insights and Table never call useJobs() or fetchJobs() themselves - they only ever read the jobsState/jobs passed down from App.tsx (typeof useJobs, used only for the prop\'s TypeScript type, and mentions in comments, are fine)', () => {
    const withoutComments = (source: string) =>
      source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')
    const noCallOutsideTypeof = (source: string) => source.replace(/typeof useJobs/g, '')

    expect(noCallOutsideTypeof(withoutComments(insightsSource))).not.toMatch(/\buseJobs\(/)
    expect(withoutComments(insightsSource)).not.toMatch(/\bfetchJobs\(/)
    expect(noCallOutsideTypeof(withoutComments(tableSource))).not.toMatch(/\buseJobs\(/)
    expect(withoutComments(tableSource)).not.toMatch(/\bfetchJobs\(/)
  })

  it('CSV export on both pages is passed the full jobsState.jobs array (the same RLS-scoped dataset), never a separately fetched or hardcoded list', () => {
    expect(insightsSource).toMatch(/<ExportCsvButton\s+jobs=\{jobs\}/)
    expect(tableSource).toMatch(/<ExportCsvButton\s+jobs=\{jobs\}/)
  })
})
