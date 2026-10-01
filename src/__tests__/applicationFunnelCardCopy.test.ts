import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

// Source-level regression guard for ApplicationFunnelCard's stage-rate
// copy. Employer Response's previous stage is Applications itself, so
// its "from previous" and "overall" percentages are always identical -
// the card collapses that one stage into a single "X% of applications"
// line instead of repeating the same number twice. Interview, Final
// Round, and Offer keep showing both rates, since their previous stage
// is a genuine subset of the cohort.

const cardSource = readFileSync(
  join(
    dirname(fileURLToPath(import.meta.url)),
    '..',
    'components',
    'insights',
    'analytics',
    'ApplicationFunnelCard.tsx',
  ),
  'utf-8',
)

describe('ApplicationFunnelCard stage-rate copy (source-level regression guard)', () => {
  it('marks exactly one stage (Employer Response) to show a single collapsed rate', () => {
    const stagesBlock = cardSource.match(/const stages = \[[\s\S]*?\]/)
    expect(stagesBlock).not.toBeNull()
    const singleRateLines = stagesBlock![0].match(/showSingleRate: (true|false)/g) ?? []
    expect(singleRateLines).toEqual(['showSingleRate: false', 'showSingleRate: true', 'showSingleRate: false', 'showSingleRate: false', 'showSingleRate: false'])

    // The one `true` must belong to Employer Response specifically, not
    // some other stage.
    const employerResponseLine = stagesBlock![0]
      .split('\n')
      .find((line) => line.includes("label: 'Employer Response'"))
    expect(employerResponseLine).toMatch(/showSingleRate: true/)
  })

  it('renders the collapsed "X% of applications" copy for the single-rate case, dynamically computed (never a hard-coded percentage)', () => {
    expect(cardSource).toMatch(/formatPercent\(stage\.count, cohortTotal\)\} of applications/)
    // It must never also render "from previous"/"overall" in that same
    // branch - those stay exclusive to the two-rate branch.
    const singleRateBranch = cardSource.match(/stage\.showSingleRate \? \(([\s\S]*?)\) : \(/)
    expect(singleRateBranch).not.toBeNull()
    expect(singleRateBranch![1]).not.toMatch(/from previous/)
    expect(singleRateBranch![1]).not.toMatch(/overall/)
  })

  it('keeps both "from previous" and "overall" rates for the remaining dependent stages (Interview, Final Round, Offer)', () => {
    const twoRateMatch = cardSource.match(/stage\.count, stage\.previous\)\} from previous ·.*?overall/s)
    expect(twoRateMatch).not.toBeNull()
  })

  it('every percentage is computed dynamically via formatPercent - no hard-coded "%" literal anywhere in the stage rows', () => {
    const renderSection = cardSource.slice(cardSource.indexOf('return ('))
    const percentLiterals = renderSection.match(/\d+%/g) ?? []
    expect(percentLiterals).toEqual([])
  })

  it('the single-rate percentage still uses cohortTotal as its denominator, so it safely renders "—" (via formatPercent) when the cohort is empty - same divide-by-zero guard as every other rate', () => {
    const singleRateBranch = cardSource.match(/stage\.showSingleRate \? \(([\s\S]*?)\) : \(/)
    expect(singleRateBranch![1]).toMatch(/formatPercent\(stage\.count, cohortTotal\)/)
  })
})
