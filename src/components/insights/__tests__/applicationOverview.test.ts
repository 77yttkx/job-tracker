import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { statusDistribution } from '../../../lib/distributions'
import { JOB_STATUSES } from '../../../lib/constants'
import type { Job } from '../../../types/job'

function makeJob(status: Job['status']): Job {
  return {
    job_id: Math.random().toString(),
    user_id: 'user-1',
    company: 'Acme',
    role: 'Engineer',
    job_url: null,
    jd: null,
    applied_date: null,
    status,
    notes: null,
    location: null,
    sponsorship: 'Unknown',
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
  }
}

/**
 * ApplicationOverview (V2.5.2's replacement for the removed Sankey/funnel
 * panel) is built entirely on statusDistribution() - src/lib/distributions.ts
 * - which counts every job by its *current* status only, with no
 * inference about stages it may have passed through. These tests cover
 * the 4 things the V2.5.2 spec calls out explicitly.
 */
describe('ApplicationOverview data (V2.5.2)', () => {
  it('1. aggregates counts from current status only - never infers earlier stages (unlike the removed Sankey)', () => {
    // A job currently at "2nd Round" must contribute ONLY to the
    // "2nd Round" bar - not to "Applied" or "OA" as the old Sankey's
    // reachedCount()-based inference used to do.
    const jobs = [makeJob('2nd Round'), makeJob('Offer')]
    const rows = statusDistribution(jobs)
    expect(rows.find((r) => r.key === 'Applied')?.count).toBe(0)
    expect(rows.find((r) => r.key === 'OA')?.count).toBe(0)
    expect(rows.find((r) => r.key === '1st Round')?.count).toBe(0)
    expect(rows.find((r) => r.key === '2nd Round')?.count).toBe(1)
    expect(rows.find((r) => r.key === 'Offer')?.count).toBe(1)
  })

  it('2. includes all eight statuses, in the fixed pipeline order, including zero-count ones', () => {
    const rows = statusDistribution([makeJob('Applied')])
    expect(rows.map((r) => r.key)).toEqual([
      'Applied',
      'OA',
      '1st Round',
      '2nd Round',
      'Final Round',
      'Offer',
      'Rejected',
      'Ghosted',
    ])
    expect(rows.map((r) => r.key)).toEqual([...JOB_STATUSES])
    for (const row of rows) {
      if (row.key === 'Applied') continue
      expect(row.count).toBe(0)
      expect(row.percent).toBe(0)
    }
  })

  it('2b. a zero-count status is still reported as an explicit 0 (0%), never omitted', () => {
    const rows = statusDistribution([makeJob('Applied'), makeJob('Applied')])
    const ghosted = rows.find((r) => r.key === 'Ghosted')!
    expect(ghosted).toBeDefined()
    expect(ghosted.count).toBe(0)
    expect(ghosted.percent).toBe(0)
  })

  it('3. total applications equals the exact number of loaded job records', () => {
    const jobs = [
      makeJob('Applied'),
      makeJob('OA'),
      makeJob('Offer'),
      makeJob('Rejected'),
      makeJob('Ghosted'),
    ]
    const rows = statusDistribution(jobs)
    const totalFromRows = rows.reduce((sum, r) => sum + r.count, 0)
    expect(totalFromRows).toBe(jobs.length)
    expect(jobs.length).toBe(5)
  })

  it('computes exact percentages of the total (not rounded pre-division)', () => {
    const jobs = [makeJob('Applied'), makeJob('Applied'), makeJob('Applied'), makeJob('Offer')]
    const rows = statusDistribution(jobs)
    expect(rows.find((r) => r.key === 'Applied')?.percent).toBeCloseTo(75)
    expect(rows.find((r) => r.key === 'Offer')?.percent).toBeCloseTo(25)
  })
})

const overviewSource = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '..', 'ApplicationOverview.tsx'),
  'utf-8',
)

describe('ApplicationOverview component (source-level regression guard)', () => {
  it('4. never imports or references Sankey/funnel machinery, links, flows, or conversion rates', () => {
    const withoutComments = overviewSource.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')
    expect(withoutComments).not.toMatch(/sankey/i)
    expect(withoutComments).not.toMatch(/funnel/i)
    expect(withoutComments).not.toMatch(/conversion rate/i)
    expect(overviewSource).not.toMatch(/from ['"].*\/sankey['"]/)
    expect(overviewSource).not.toMatch(/from ['"].*\/funnel['"]/)
  })

  it('builds every bar label from its own row data (count + percent), so a tooltip/label can never read "undefined"', () => {
    // The bug being fixed: the old SankeyChart tooltip read a *separate*
    // node-name array by numeric index, which could desync and print
    // "undefined -> undefined". This component instead precomputes a
    // "label" string directly on each row it renders, so there is no
    // parallel array/index lookup that could desync.
    expect(overviewSource).toMatch(/label: `\$\{row\.count\} \(\$\{row\.percent\.toFixed\(0\)\}%\)`/)
    expect(overviewSource).toMatch(/dataKey="label"/)
  })

  it('renders a Recharts horizontal (vertical-layout) bar chart', () => {
    expect(overviewSource).toMatch(/BarChart/)
    expect(overviewSource).toMatch(/layout="vertical"/)
  })
})
