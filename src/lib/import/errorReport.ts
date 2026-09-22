import { escapeCsvField } from '../csv'
import type { ImportRow } from './mapRows'

const COLUMNS = ['row', 'outcome', 'reasons', 'company', 'role', 'job_url'] as const

/**
 * Builds a downloadable CSV covering every row that was NOT imported
 * cleanly (invalid, duplicate, skipped-blank) plus any row that needed
 * manual review after an attempted parse-fill, so the user can see exactly
 * what to fix in their source spreadsheet without hunting through the
 * on-screen preview.
 */
export function buildImportErrorReportCsv(rows: ImportRow[], parseFillFailedRowNumbers: Set<number> = new Set()): string {
  const flagged = rows.filter(
    (row) => row.outcome !== 'valid' || row.reasons.length > 0 || parseFillFailedRowNumbers.has(row.rowNumber),
  )
  const header = COLUMNS.join(',')
  const dataRows = flagged.map((row) => {
    const reasons = [...row.reasons]
    if (parseFillFailedRowNumbers.has(row.rowNumber)) {
      reasons.push('Could not parse the job link - needs manual completion')
    }
    return [
      String(row.rowNumber),
      row.outcome,
      reasons.join('; '),
      row.data.company ?? '',
      row.data.role ?? '',
      row.data.job_url ?? '',
    ]
      .map(escapeCsvField)
      .join(',')
  })
  return [header, ...dataRows].join('\r\n')
}
