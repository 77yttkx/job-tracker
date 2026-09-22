import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const insightsSource = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '..', 'InsightsPage.tsx'),
  'utf-8',
)

describe('InsightsPage scope (source-level regression guard)', () => {
  it('does not import or render an Insights-local filter bar', () => {
    expect(insightsSource).not.toMatch(/InsightsFilterBar/)
  })

  it('does not import Table-filter application logic (applyJobFilters)', () => {
    expect(insightsSource).not.toMatch(/applyJobFilters/)
  })

  it('does not compute or render a Sponsorship distribution panel', () => {
    expect(insightsSource).not.toMatch(/sponsorshipDistribution/i)
    expect(insightsSource).not.toMatch(/Sponsorship distribution/i)
  })

  it('passes the full, unfiltered jobs array to every metric/chart component', () => {
    const propPassing = [...insightsSource.matchAll(/jobs=\{([^}]+)\}/g)].map((m) => m[1].trim())
    expect(propPassing.length).toBeGreaterThan(0)
    for (const expr of propPassing) {
      expect(expr).toBe('jobs')
    }
  })

  it('renders ApplicationOverview first, immediately below the title/subtitle', () => {
    const overviewIdx = insightsSource.indexOf('<ApplicationOverview')
    const timeSummaryIdx = insightsSource.indexOf('<TimeSummary')
    const distributionIdx = insightsSource.indexOf('<DistributionPanel')

    expect(overviewIdx).toBeGreaterThan(-1)
    expect(overviewIdx).toBeLessThan(timeSummaryIdx)
    expect(overviewIdx).toBeLessThan(distributionIdx)
  })

  it('never imports or renders the removed Sankey/funnel components', () => {
    expect(insightsSource).not.toMatch(/SankeyChart/)
    expect(insightsSource).not.toMatch(/FunnelConversionPanel/)
    expect(insightsSource).not.toMatch(/from ['"].*\/sankey['"]/)
    expect(insightsSource).not.toMatch(/from ['"].*\/funnel['"]/)
  })

  it('never renders Sankey/funnel-related visible text (diagram, flow, transition, conversion rate)', () => {
    const withoutComments = insightsSource
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\/\/.*$/gm, '')
    expect(withoutComments).not.toMatch(/sankey/i)
    expect(withoutComments).not.toMatch(/funnel/i)
    expect(withoutComments).not.toMatch(/conversion rate/i)
  })

  it('shows the Retry-capable error state and only shows the empty state on a genuinely successful, zero-row load', () => {
    expect(insightsSource).toMatch(/error \? \(\s*<ErrorState message=\{error\} detail=\{errorDetail\} onRetry=\{refresh\} \/>/)
    expect(insightsSource).toMatch(/jobs\.length === 0 \? \(\s*<EmptyState/)
  })
})
