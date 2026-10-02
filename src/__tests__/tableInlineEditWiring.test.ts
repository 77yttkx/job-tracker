import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

// V3.6 source-level regression guard: Application Source + Sponsorship
// inline editing on the Table, and the Add/Edit modal's new Application
// Source select. There is no React component-render testing
// infrastructure in this project (no @testing-library/react), so - same
// convention as sqlAnalyticsMigration.test.ts / insightsAnalyticsWiring.test.ts
// - this reads the component source directly and asserts on it.

const here = dirname(fileURLToPath(import.meta.url))
const tableSource = readFileSync(join(here, '..', 'pages', 'TablePage.tsx'), 'utf-8')
const modalSource = readFileSync(join(here, '..', 'components', 'jobs', 'JobModal.tsx'), 'utf-8')
const jobsServiceSource = readFileSync(join(here, '..', 'services', 'jobs.ts'), 'utf-8')

describe('TablePage inline editing wiring (V3.6)', () => {
  it('imports and renders ApplicationSourceEditCell and SponsorshipEditCell', () => {
    expect(tableSource).toMatch(/import \{ ApplicationSourceEditCell \} from '..\/components\/jobs\/ApplicationSourceEditCell'/)
    expect(tableSource).toMatch(/import \{ SponsorshipEditCell \} from '..\/components\/jobs\/SponsorshipEditCell'/)
    expect(tableSource).toMatch(/<ApplicationSourceEditCell/)
    expect(tableSource).toMatch(/<SponsorshipEditCell/)
  })

  it('still imports and renders StatusEditCell unchanged (Status regression)', () => {
    expect(tableSource).toMatch(/import \{ StatusEditCell \} from '..\/components\/jobs\/StatusEditCell'/)
    expect(tableSource).toMatch(/<StatusEditCell/)
  })

  it('no longer renders a plain, non-editable SponsorshipBadge directly in the table body (it is now inline-editable)', () => {
    const tbodySection = tableSource.slice(tableSource.indexOf('<tbody'), tableSource.indexOf('</tbody>'))
    expect(tbodySection).not.toMatch(/<SponsorshipBadge/)
  })

  it('wires Source and Sponsorship changes through editJob with ONLY their own field - never bundled with status or other fields', () => {
    const sourceHandlerMatch = tableSource.match(/async function handleSourceChange\([\s\S]*?\n {2}\}/)
    expect(sourceHandlerMatch).not.toBeNull()
    expect(sourceHandlerMatch![0]).toMatch(/editJob\(jobId, \{ application_source: next \}\)/)

    const sponsorshipHandlerMatch = tableSource.match(/async function handleSponsorshipChange\([\s\S]*?\n {2}\}/)
    expect(sponsorshipHandlerMatch).not.toBeNull()
    expect(sponsorshipHandlerMatch![0]).toMatch(/editJob\(jobId, \{ sponsorship: next \}\)/)
  })

  it('tracks pending/error state for Source and Sponsorship independently of Status and of each other', () => {
    expect(tableSource).toMatch(/sourcePendingId/)
    expect(tableSource).toMatch(/sourceError/)
    expect(tableSource).toMatch(/sponsorshipPendingId/)
    expect(tableSource).toMatch(/sponsorshipError/)
    // Three distinct pending-id state variables - Status's own is never
    // reused for Source/Sponsorship.
    const pendingIdDeclarations = tableSource.match(/const \[\w*PendingId\w*,/g) ?? []
    expect(pendingIdDeclarations.length).toBeGreaterThanOrEqual(3)
  })

  it('a failed Source/Sponsorship update never pre-applies the new value - editJob is awaited before any local state changes, and the catch block never sets an optimistic success value', () => {
    const sourceHandlerMatch = tableSource.match(/async function handleSourceChange\([\s\S]*?\n {2}\}/)
    expect(sourceHandlerMatch![0]).toMatch(/catch \(err\)/)
    expect(sourceHandlerMatch![0]).not.toMatch(/setJobs/)

    const sponsorshipHandlerMatch = tableSource.match(/async function handleSponsorshipChange\([\s\S]*?\n {2}\}/)
    expect(sponsorshipHandlerMatch![0]).toMatch(/catch \(err\)/)
    expect(sponsorshipHandlerMatch![0]).not.toMatch(/setJobs/)
  })

  it('adds Source and Sponsorship columns near Status without removing any existing column', () => {
    const theadSection = tableSource.slice(tableSource.indexOf('<thead'), tableSource.indexOf('</thead>'))
    // Plain <Th> columns render their label as JSX text (">Label<");
    // Applied/Updated are sortable headers whose label is passed as a
    // `label="..."` prop instead - both forms are checked for below.
    for (const col of ['Company', 'Role', 'Location', 'Status', 'Source', 'Sponsorship', 'Job URL', 'Actions']) {
      expect(theadSection).toMatch(new RegExp(`>${col}<`))
    }
    expect(theadSection).toMatch(/label="Applied"/)
    expect(theadSection).toMatch(/label="Updated"/)
  })
})

describe('JobModal Application Source field (V3.6)', () => {
  it('imports APPLICATION_SOURCES/DEFAULT_APPLICATION_SOURCE from the shared constants module - never a second hard-coded list', () => {
    expect(modalSource).toMatch(/APPLICATION_SOURCES/)
    expect(modalSource).toMatch(/DEFAULT_APPLICATION_SOURCE/)
    expect(modalSource).toMatch(/from '\.\.\/\.\.\/lib\/constants'/)
  })

  it('defaults a new job\'s application_source to DEFAULT_APPLICATION_SOURCE', () => {
    expect(modalSource).toMatch(/application_source: DEFAULT_APPLICATION_SOURCE/)
  })

  it('renders a <select> for application_source populated by mapping over APPLICATION_SOURCES', () => {
    expect(modalSource).toMatch(/id="application_source"/)
    expect(modalSource).toMatch(/APPLICATION_SOURCES\.map/)
  })

  it('loads the existing job\'s application_source on edit (jobToForm) and includes it in the save payload for both add and edit', () => {
    expect(modalSource).toMatch(/application_source: job\.application_source/)
    expect(modalSource).toMatch(/application_source: form\.application_source/)
  })

  it('never writes application_source from parse-fill - URL parsing must never set/guess it', () => {
    const parseFillBlock = modalSource.match(/setForm\(\(prev\) => \(\{[\s\S]*?outcome\.fields!\.applied_date[\s\S]*?\}\)\)/)
    expect(parseFillBlock).not.toBeNull()
    // Checks for an actual assignment (`application_source:`), not just
    // the word appearing anywhere - this code intentionally documents
    // the omission in a comment, which mentions the field name without
    // assigning it.
    expect(parseFillBlock![0]).not.toMatch(/application_source\s*:/)
  })
})

describe('services/jobs.ts createJob (V3.6)', () => {
  it('includes application_source in the insert payload, defaulting to DEFAULT_APPLICATION_SOURCE when not provided', () => {
    expect(jobsServiceSource).toMatch(/application_source: input\.application_source \?\? DEFAULT_APPLICATION_SOURCE/)
  })

  it('imports DEFAULT_APPLICATION_SOURCE from the shared constants module', () => {
    expect(jobsServiceSource).toMatch(/DEFAULT_APPLICATION_SOURCE/)
  })

  it('updateJob remains a generic field-update (no application_source-specific carve-out needed, and none added)', () => {
    expect(jobsServiceSource).toMatch(/export async function updateJob\(jobId: string, updates: JobUpdate\)/)
    const updateJobBody = jobsServiceSource.match(/export async function updateJob\([\s\S]*?\n\}/)
    expect(updateJobBody).not.toBeNull()
    // The function BODY itself (not a preceding doc comment that merely
    // mentions the field) must contain no application_source-specific
    // branch - it stays the same generic `.update(updates)` call used
    // for every field.
    expect(updateJobBody![0]).not.toMatch(/application_source/)
  })
})
