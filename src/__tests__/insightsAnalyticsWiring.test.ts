import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

// Replaces the deleted sqlAnalyticsLabWiring.test.ts. V3.4 removed the
// "SQL Analytics Lab" tab entirely: Insights is now one scrollable page,
// with no tab UI, no SqlAnalyticsLab component, and no per-card "View SQL"
// toggle. This is a source-level regression guard against any of that
// framing coming back, plus a check that every kept/added analytics card
// is actually wired into the page.

const here = dirname(fileURLToPath(import.meta.url))
const insightsSource = readFileSync(join(here, '..', 'pages', 'InsightsPage.tsx'), 'utf-8')
const analyticsCardSource = readFileSync(
  join(here, '..', 'components', 'insights', 'analytics', 'AnalyticsCard.tsx'),
  'utf-8',
)

describe('Insights analytics wiring (source-level regression guard)', () => {
  it('does not import or render InsightsTabs, SqlAnalyticsLab, or any tab state', () => {
    expect(insightsSource).not.toMatch(/InsightsTabs/)
    expect(insightsSource).not.toMatch(/SqlAnalyticsLab/)
    expect(insightsSource).not.toMatch(/sql-lab/)
    expect(insightsSource).not.toMatch(/useState<InsightsTab>/)
  })

  it('does not reference sqlExamples or the removed StatusHistoryCard', () => {
    expect(insightsSource).not.toMatch(/sqlExamples/i)
    expect(insightsSource).not.toMatch(/StatusHistoryCard/)
  })

  it('renders every kept and new analytics card, including V3.6 Application Source Performance', () => {
    for (const card of [
      'ApplicationFunnelCard',
      'ApplicationSourcePerformanceCard',
      'CompanyOutcomesCard',
      'SponsorshipAnalysisCard',
      'ApplicationTrendCard',
      'TimeToResponseCard',
    ]) {
      expect(insightsSource).toMatch(new RegExp(`<${card}\\s*/>`))
      expect(insightsSource).toMatch(new RegExp(`import \\{ ${card} \\}`))
    }
  })

  it('AnalyticsCard no longer accepts a sql prop or renders a "View SQL" toggle', () => {
    const codeOnly = analyticsCardSource.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')
    expect(codeOnly).not.toMatch(/\bsql\b\s*[:?]/)
    expect(codeOnly).not.toMatch(/View SQL/i)
    expect(codeOnly).not.toMatch(/<pre/)
  })

  it('Insights reads as a product analytics dashboard, not a SQL demonstration, anywhere in its own page copy', () => {
    const visibleCopy = insightsSource.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')
    expect(visibleCopy).not.toMatch(/view sql/i)
    expect(visibleCopy).not.toMatch(/read-only sql/i)
  })
})
