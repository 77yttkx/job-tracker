import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

// Source-level regression guard for the two Table-page UX features (inline
// status editing + default sort by applied_date descending), same
// convention as insightsScope.test.ts / sqlAnalyticsLabWiring.test.ts -
// there is no component-rendering test setup (no @testing-library/react)
// in this project, so UI wiring is verified by reading the component
// source directly. Behavior of the underlying pure sort comparator itself
// is covered separately in src/lib/__tests__/tableSort.test.ts.

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..')
function read(relPath: string): string {
  return readFileSync(join(repoRoot, ...relPath.split('/')), 'utf-8')
}

const tablePageSource = read('src/pages/TablePage.tsx')
const statusEditCellSource = read('src/components/jobs/StatusEditCell.tsx')

describe('Table page: inline status editing', () => {
  it('renders a status control per row driven by the canonical JOB_STATUSES/JobStatus source, never a second hard-coded list', () => {
    expect(statusEditCellSource).toMatch(/import\s*\{\s*JOB_STATUSES\s*\}\s*from\s*'\.\.\/\.\.\/lib\/constants'/)
    expect(statusEditCellSource).toMatch(/import type\s*\{\s*JobStatus\s*\}\s*from\s*'\.\.\/\.\.\/lib\/constants'/)
    expect(statusEditCellSource).toMatch(/JOB_STATUSES\.map\(/)
    // No second, independently-maintained status list anywhere in the cell.
    expect(statusEditCellSource).not.toMatch(/\[\s*'Applied'\s*,/)
  })

  it('TablePage replaces the plain StatusBadge cell with the interactive StatusEditCell', () => {
    expect(tablePageSource).toMatch(/import\s*\{\s*StatusEditCell\s*\}\s*from\s*'\.\.\/components\/jobs\/StatusEditCell'/)
    expect(tablePageSource).toMatch(/<StatusEditCell\b/)
    // The old direct <StatusBadge status={job.status} /> table cell is gone.
    expect(tablePageSource).not.toMatch(/<StatusBadge status=\{job\.status\}\s*\/>/)
  })

  it('the trigger is the existing StatusBadge, wrapped in a real <button> (focusable, Enter/Space-activatable natively)', () => {
    expect(statusEditCellSource).toMatch(/import\s*\{\s*StatusBadge\s*\}\s*from\s*'\.\/StatusBadge'/)
    expect(statusEditCellSource).toMatch(/<button[\s\S]{0,500}<StatusBadge status=\{status\} \/>/)
  })

  it('selecting a status writes through the app\'s existing editJob path, not a new update call', () => {
    expect(tablePageSource).toMatch(/const \{ jobs, loading, error, errorDetail, refresh, editJob, removeJob \} = jobsState/)
    expect(tablePageSource).toMatch(/await editJob\(jobId, \{ status: next \}\)/)
    // No direct Supabase/service call bypassing the hook.
    expect(tablePageSource).not.toMatch(/updateJob\(/)
  })

  it('exactly one write is issued per selection - selecting the current status again is a no-op, not a write', () => {
    expect(statusEditCellSource).toMatch(/if \(next === status\) \{\s*\n\s*setOpen\(false\)\s*\n\s*return\s*\n\s*\}/)
    // The write call (onChange) only appears after that early-return guard.
    const guardIndex = statusEditCellSource.indexOf('if (next === status)')
    const writeIndex = statusEditCellSource.indexOf('onChange(next)')
    expect(guardIndex).toBeGreaterThan(-1)
    expect(writeIndex).toBeGreaterThan(guardIndex)
  })

  it('shows a pending/saving indicator for the row while its update is in flight', () => {
    expect(tablePageSource).toMatch(/statusPendingId/)
    expect(tablePageSource).toMatch(/pending=\{statusPendingId === job\.job_id\}/)
    expect(statusEditCellSource).toMatch(/pending &&/)
  })

  it('on failure, shows the existing user-friendly error banner pattern and never mutates local state itself', () => {
    expect(tablePageSource).toMatch(/setStatusError\(err instanceof Error \? err\.message : 'Failed to update status\.'\)/)
    expect(tablePageSource).toMatch(/role="alert"[\s\S]{0,200}\{statusError\}/)
    // StatusEditCell never tracks its own "optimistic" status - it only
    // reads the `status` prop, so a failed editJob (which does not mutate
    // local state until the server call resolves) leaves it displaying the
    // previous value automatically.
    expect(statusEditCellSource).not.toMatch(/useState\(status\)/)
    expect(statusEditCellSource).not.toMatch(/setStatus\(/)
  })

  it('closes on outside click and Escape without emitting a write', () => {
    expect(statusEditCellSource).toMatch(/document\.addEventListener\('mousedown', handlePointerDown\)/)
    expect(statusEditCellSource).toMatch(/document\.addEventListener\('keydown', handleKeyDown\)/)
    expect(statusEditCellSource).toMatch(/event\.key === 'Escape'/)
  })

  it('exposes the trigger and options with accessible roles/attributes', () => {
    expect(statusEditCellSource).toMatch(/aria-haspopup="listbox"/)
    expect(statusEditCellSource).toMatch(/aria-expanded=\{open\}/)
    expect(statusEditCellSource).toMatch(/role="listbox"/)
    expect(statusEditCellSource).toMatch(/role="option"/)
    expect(statusEditCellSource).toMatch(/aria-selected=\{selected\}/)
  })

  it('does not require opening the full Edit Job modal to change status', () => {
    // The onChange handler goes straight to handleStatusChange, never to onEditJob.
    expect(statusEditCellSource).not.toMatch(/onEditJob/)
  })
})

describe('Table page: default sort by applied_date descending', () => {
  it('defaults sortKey to applied_date (not updated_at)', () => {
    expect(tablePageSource).toMatch(/useState<SortKey>\('applied_date'\)/)
  })

  it('uses the dedicated, updated_at-independent comparator for the applied_date sort key', () => {
    expect(tablePageSource).toMatch(/import\s*\{\s*compareJobsByAppliedDate\s*\}\s*from\s*'\.\.\/lib\/tableSort'/)
    expect(tablePageSource).toMatch(/if \(sortKey === 'applied_date'\) \{[\s\S]{0,500}compareJobsByAppliedDate\(a, b, sortDir\)/)
  })

  it('the "Updated" column toggle still exists and is unchanged, so manual sort-by-updated_at still works', () => {
    expect(tablePageSource).toMatch(/label="Updated"[\s\S]{0,40}active=\{sortKey === 'updated_at'\}/)
  })
})
