import { parseJobUrl } from '../../services/jobParser'
import { mapWithConcurrency } from './concurrency'
import { rowNeedsParseFill } from './mapRows'
import type { ImportRow } from './mapRows'

export interface ParseFillOutcome {
  rows: ImportRow[]
  /** How many rows a parse-job call was actually attempted for. */
  attempted: number
  /** How many of those rows had at least one blank field filled in. */
  filledCount: number
  /** Row numbers where the parse-job call failed or returned nothing usable - these rows are kept as-is (never dropped) and should be reported as needing manual review. */
  failedRowNumbers: Set<number>
}

/**
 * For every 'valid' row that has a job_url and at least one blank
 * parse-fillable field, calls the existing parse-job Edge Function (via
 * parseJobUrl) with at most `concurrency` requests in flight at once, and
 * fills in ONLY the fields that were blank - a value already present in
 * the spreadsheet is never overwritten. A row whose parse call fails is
 * left exactly as it was (not dropped from the import) and its row number
 * is returned in `failedRowNumbers` so the caller can flag it for manual
 * review instead of silently losing it.
 */
export async function fillMissingFieldsFromUrls(rows: ImportRow[], concurrency = 3): Promise<ParseFillOutcome> {
  const targets = rows.filter((row) => row.outcome === 'valid' && rowNeedsParseFill(row))
  const failedRowNumbers = new Set<number>()

  if (targets.length === 0) {
    return { rows, attempted: 0, filledCount: 0, failedRowNumbers }
  }

  const targetRowNumbers = new Set(targets.map((row) => row.rowNumber))

  const outcomes = await mapWithConcurrency(targets, concurrency, async (row) => {
    try {
      const outcome = await parseJobUrl(row.data.job_url as string)
      return { rowNumber: row.rowNumber, fields: outcome.fields }
    } catch {
      return { rowNumber: row.rowNumber, fields: null }
    }
  })
  const byRowNumber = new Map(outcomes.map((o) => [o.rowNumber, o]))

  let filledCount = 0
  const updatedRows = rows.map((row) => {
    if (!targetRowNumbers.has(row.rowNumber)) return row
    const outcome = byRowNumber.get(row.rowNumber)
    if (!outcome?.fields) {
      failedRowNumbers.add(row.rowNumber)
      return row
    }

    const fields = outcome.fields
    const nextData = { ...row.data }
    let didFill = false
    if (!nextData.company && fields.company) {
      nextData.company = fields.company
      didFill = true
    }
    if (!nextData.role && fields.role) {
      nextData.role = fields.role
      didFill = true
    }
    if (!nextData.jd && fields.jd) {
      nextData.jd = fields.jd
      didFill = true
    }
    if (!nextData.location && fields.location) {
      nextData.location = fields.location
      didFill = true
    }
    if (row.missingFillableFields.includes('sponsorship') && fields.sponsorship !== 'Unknown') {
      nextData.sponsorship = fields.sponsorship
      didFill = true
    }
    if (didFill) filledCount += 1
    return { ...row, data: nextData }
  })

  return { rows: updatedRows, attempted: targets.length, filledCount, failedRowNumbers }
}
