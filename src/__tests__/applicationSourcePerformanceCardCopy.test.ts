import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

// Source-level regression guard for ApplicationSourcePerformanceCard's
// (V3.6) copy and sorting rules - the product spec is explicit and
// prescriptive about what this card must and must never say, so this
// locks that in the same way applicationFunnelCardCopy.test.ts does for
// the V3.5 funnel card.

const cardSource = readFileSync(
  join(
    dirname(fileURLToPath(import.meta.url)),
    '..',
    'components',
    'insights',
    'analytics',
    'ApplicationSourcePerformanceCard.tsx',
  ),
  'utf-8',
)

// Dev comments are allowed to explain what the UI deliberately avoids
// (e.g. "deliberately no ranking"); what must never appear is that
// language in the rendered, user-visible copy. Strip block/line
// comments before checking the visible-copy rules below - the same
// approach insightsAnalyticsWiring.test.ts uses.
const visibleSource = cardSource.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')

describe('ApplicationSourcePerformanceCard copy and sorting (source-level regression guard)', () => {
  it('never emits forbidden statistical/implementation jargon in the rendered copy', () => {
    for (const forbidden of [/\bn=\d/i, /sample size/i, /\bdenominator\b/i, /\bcohort\b/i, /\bRPC\b/, /\bmigration\b/i]) {
      expect(visibleSource).not.toMatch(forbidden)
    }
  })

  it('never uses Best/Worst/ranking language in the rendered copy', () => {
    expect(visibleSource).not.toMatch(/\bbest\b/i)
    expect(visibleSource).not.toMatch(/\bworst\b/i)
    expect(visibleSource).not.toMatch(/\brank/i)
  })

  it('never claims causation in the rendered copy - no causal-inference vocabulary', () => {
    expect(visibleSource).not.toMatch(/\bcauses?\b/i)
    expect(visibleSource).not.toMatch(/\bcausal/i)
    expect(visibleSource).not.toMatch(/significant/i)
    expect(visibleSource).not.toMatch(/confidence interval/i)
    expect(visibleSource).not.toMatch(/\brecommend/i)
  })

  it('renders rate captions via formatTrackedRateCaption (never a hand-written "N of M" string)', () => {
    expect(cardSource).toMatch(/formatTrackedRateCaption\(row\.response_count, row\.tracked_count\)/)
    expect(cardSource).toMatch(/formatTrackedRateCaption\(row\.interview_count, row\.tracked_count\)/)
  })

  it('renders rates via formatTrackedRate, keyed to tracked_count - never to application_count', () => {
    expect(cardSource).toMatch(/formatTrackedRate\(row\.response_count, row\.tracked_count\)/)
    expect(cardSource).toMatch(/formatTrackedRate\(row\.interview_count, row\.tracked_count\)/)
    // The rate functions must never be called with application_count as
    // their denominator - that would be exactly the forbidden
    // "58% (n=12)"-style conflation the spec calls out.
    expect(cardSource).not.toMatch(/formatTrackedRate\([^)]*application_count\)/)
  })

  it('shows application_count as its own distinct number, never substituted for tracked_count', () => {
    expect(cardSource).toMatch(/row\.application_count/)
  })

  it('sorts known sources by application_count descending, with Unknown always placed last regardless of count', () => {
    const sortBlock = cardSource.match(/const sorted = \[\.\.\.rows\]\.sort\(\(a, b\) => \{([\s\S]*?)\}\)/)
    expect(sortBlock).not.toBeNull()
    expect(sortBlock![1]).toMatch(/DEFAULT_APPLICATION_SOURCE/)
    expect(sortBlock![1]).toMatch(/b\.application_count - a\.application_count/)
  })

  it('never hides a source behind a minimum-sample threshold - every row in `rows`/`sorted` is rendered', () => {
    expect(cardSource).not.toMatch(/\.filter\(/)
  })

  it('computes percentages in the frontend, not by reading a pre-formatted percent field off the row', () => {
    expect(cardSource).not.toMatch(/row\.response_rate/)
    expect(cardSource).not.toMatch(/row\.interview_rate/)
  })
})
