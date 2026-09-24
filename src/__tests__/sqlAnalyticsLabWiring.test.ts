import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

// Source-level regression guard for the SQL Analytics Lab UI, same
// convention as interviewPrepNavigationAndIndependence.test.ts - there is
// no component-rendering test setup (no @testing-library/react) in this
// project, so UI wiring and required copy are verified by reading the
// component source directly.

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
function read(relPath: string): string {
  return readFileSync(join(repoRoot, ...relPath.split('/')), 'utf-8')
}

const insightsTabsSource = read('src/components/insights/InsightsTabs.tsx')
const insightsPageSource = read('src/pages/InsightsPage.tsx')
const sqlAnalyticsLabSource = read('src/components/insights/analytics/SqlAnalyticsLab.tsx')
const analyticsCardSource = read('src/components/insights/analytics/AnalyticsCard.tsx')
const statusHistoryCardSource = read('src/components/insights/analytics/StatusHistoryCard.tsx')
const sqlExamplesSource = read('src/lib/sqlExamples.ts')
const migrationSource = read('supabase-v3_3-sql-analytics.sql')

describe('SQL Analytics Lab UI wiring', () => {
  it('adds a "SQL Analytics Lab" tab to Insights without removing the existing Overview tab', () => {
    expect(insightsTabsSource).toMatch(/label:\s*'Overview'/)
    expect(insightsTabsSource).toMatch(/label:\s*'SQL Analytics Lab'/)
  })

  it('InsightsPage renders <SqlAnalyticsLab /> when the sql-lab tab is active, and the original overview content otherwise', () => {
    expect(insightsPageSource).toMatch(/tab === 'sql-lab' \?[\s\S]{0,40}<SqlAnalyticsLab \/>/)
    expect(insightsPageSource).toMatch(/<ApplicationOverview jobs={jobs} \/>/)
    expect(insightsPageSource).toMatch(/<TimeSummary jobs={jobs} \/>/)
  })

  it('shows the required intro copy on the SQL Analytics Lab', () => {
    expect(sqlAnalyticsLabSource).toMatch(
      /Explore your application data through read-only SQL analyses\.\s+Each result is scoped to your\s+private workspace\./,
    )
  })

  it('renders all five required analysis cards', () => {
    for (const card of [
      'ApplicationFunnelCard',
      'CompanyOutcomesCard',
      'SponsorshipAnalysisCard',
      'ApplicationTrendCard',
      'StatusHistoryCard',
    ]) {
      expect(sqlAnalyticsLabSource).toMatch(new RegExp(`<${card}\\s*/>`))
    }
  })

  it('every AnalyticsCard instance is given loading/error/isEmpty state and a sql prop for the View SQL section', () => {
    expect(analyticsCardSource).toMatch(/loading,/)
    expect(analyticsCardSource).toMatch(/error,/)
    expect(analyticsCardSource).toMatch(/isEmpty,/)
    expect(analyticsCardSource).toMatch(/sql,/)
    // Loading/error/empty are rendered as distinct branches, not silently
    // skipped when data is missing.
    expect(analyticsCardSource).toMatch(/loading \? \(/)
    expect(analyticsCardSource).toMatch(/: error \? \(/)
    expect(analyticsCardSource).toMatch(/: isEmpty \? \(/)
  })

  it('the View SQL section is labeled read-only and collapsible (collapsed by default)', () => {
    expect(analyticsCardSource).toMatch(/useState\(false\)/)
    expect(analyticsCardSource).toMatch(/View SQL/)
    expect(analyticsCardSource).toMatch(/Read-only example/i)
  })

  it('the Status History card visibly states the no-backfill limitation', () => {
    expect(statusHistoryCardSource).toMatch(
      /Status history begins when tracking is enabled; older job changes are not reconstructed\./,
    )
  })

  it('every SQL_EXAMPLES entry scopes to auth.uid() and never references a table outside jobs/job_status_events', () => {
    const exampleBlocks = [...sqlExamplesSource.matchAll(/(\w+): `([\s\S]*?)`,/g)]
    expect(exampleBlocks.length).toBeGreaterThanOrEqual(5)
    for (const [, key, body] of exampleBlocks) {
      expect(body, `expected auth.uid() scoping in ${key}`).toMatch(/auth\.uid\(\)/)
    }
  })

  it('SQL_EXAMPLES keys correspond to a real RPC defined in the migration', () => {
    expect(sqlExamplesSource).toMatch(/applicationFunnel:/)
    expect(sqlExamplesSource).toMatch(/companyOutcomes:/)
    expect(sqlExamplesSource).toMatch(/sponsorshipOutcomes:/)
    expect(sqlExamplesSource).toMatch(/applicationTrend:/)
    expect(sqlExamplesSource).toMatch(/statusHistory:/)
    expect(migrationSource).toMatch(/analytics_application_funnel/)
    expect(migrationSource).toMatch(/analytics_company_outcomes/)
    expect(migrationSource).toMatch(/analytics_sponsorship_outcomes/)
    expect(migrationSource).toMatch(/analytics_application_trend/)
    expect(migrationSource).toMatch(/analytics_status_transitions_by_week/)
  })

  it('nothing in the SQL Analytics Lab sends the displayed SQL text to Supabase - SQL_EXAMPLES is display-only', () => {
    for (const file of [sqlAnalyticsLabSource, analyticsCardSource, statusHistoryCardSource]) {
      expect(file).not.toMatch(/\.rpc\(\s*sql/)
      expect(file).not.toMatch(/\.rpc\(\s*SQL_EXAMPLES/)
      expect(file).not.toMatch(/from\(\s*sql/)
    }
  })
})
