import { normalizeSponsorship, normalizeStatus, parseImportDate } from './normalize'
import { PARSE_FILLABLE_FIELDS } from './constants'
import type { ImportField } from './constants'
import type { HeaderMapping } from './headerMatching'
import type { JobStatus, Sponsorship } from '../constants'
import type { NewJob } from '../../types/job'

export interface ImportRowData {
  company: string | null
  role: string | null
  job_url: string | null
  jd: string | null
  location: string | null
  sponsorship: Sponsorship
  applied_date: string | null
  status: JobStatus
  notes: string | null
}

export type ImportRowOutcome = 'valid' | 'duplicate' | 'invalid' | 'skipped-blank'

export interface ImportRow {
  /** 1-based row number as it appears in the spreadsheet, excluding the header row. */
  rowNumber: number
  data: ImportRowData
  outcome: ImportRowOutcome
  /** Why `outcome` is 'invalid' or 'duplicate', for the preview and the error-report CSV. */
  reasons: string[]
  /** True once the row's job_url was already seen in an *earlier* row of this same file. */
  duplicateInFile: boolean
  /** True when the job_url already exists among the jobs already in the database. */
  duplicateInDb: boolean
  /** The original applied_date cell text, kept only when it failed to parse (for the preview/error report). */
  invalidDateRaw: string | null
  /** True when the status cell held text that isn't one of the 8 allowed statuses (defaulted to Applied). */
  statusWasInvalid: boolean
  /** Which parse-fillable fields (company/role/jd/location/sponsorship) came back blank/Unknown and could be filled from job_url. */
  missingFillableFields: ImportField[]
}

function cellAt(row: unknown[], mapping: HeaderMapping, field: ImportField): unknown {
  const idx = mapping[field]
  return idx === undefined ? undefined : row[idx]
}

function trimmedOrNull(value: unknown): string | null {
  const str = String(value ?? '').trim()
  return str ? str : null
}

function isRowBlank(row: unknown[]): boolean {
  return row.every((cell) => String(cell ?? '').trim() === '')
}

function normalizeUrlKey(url: string): string {
  return url.trim().toLowerCase().replace(/\/+$/, '')
}

/**
 * Builds structured, validated ImportRow entries from raw spreadsheet rows
 * (as SheetJS's `sheet_to_json(sheet, { header: 1 })` returns them - an
 * array of arrays, header row already excluded) using the field -> column
 * mapping the user confirmed. Pure and synchronous: it does not touch the
 * network or Supabase, so the whole preview (valid/invalid/duplicate
 * counts) can be computed and shown before anything is saved.
 */
export function buildImportRows(
  rawRows: unknown[][],
  mapping: HeaderMapping,
  existingJobUrls: Iterable<string>,
): ImportRow[] {
  const existing = new Set(Array.from(existingJobUrls, normalizeUrlKey))
  const seenInFile = new Set<string>()

  return rawRows.map((row, index) => {
    const rowNumber = index + 1
    const reasons: string[] = []

    if (isRowBlank(row)) {
      return {
        rowNumber,
        data: emptyRowData(),
        outcome: 'skipped-blank',
        reasons: ['Blank row'],
        duplicateInFile: false,
        duplicateInDb: false,
        invalidDateRaw: null,
        statusWasInvalid: false,
        missingFillableFields: [],
      }
    }

    const company = trimmedOrNull(cellAt(row, mapping, 'company'))
    const role = trimmedOrNull(cellAt(row, mapping, 'role'))
    const jobUrlRaw = trimmedOrNull(cellAt(row, mapping, 'job_url'))
    const jd = trimmedOrNull(cellAt(row, mapping, 'jd'))
    const location = trimmedOrNull(cellAt(row, mapping, 'location'))
    const notes = trimmedOrNull(cellAt(row, mapping, 'notes'))
    const sponsorshipRaw = cellAt(row, mapping, 'sponsorship')
    const sponsorship = normalizeSponsorship(sponsorshipRaw)
    const sponsorshipWasBlank = trimmedOrNull(sponsorshipRaw) === null
    const { status, wasInvalid: statusWasInvalid } = normalizeStatus(cellAt(row, mapping, 'status'))
    const dateResult = parseImportDate(cellAt(row, mapping, 'applied_date'))

    if (statusWasInvalid) {
      reasons.push(`Unrecognized status - defaulted to "${status}"`)
    }
    if (!dateResult.ok) {
      reasons.push('Applied date could not be parsed - left blank')
    }

    const data: ImportRowData = {
      company,
      role,
      job_url: jobUrlRaw,
      jd,
      location,
      sponsorship,
      applied_date: dateResult.value,
      status,
      notes,
    }

    const missingFillableFields: ImportField[] = []
    if (jobUrlRaw) {
      if (!company) missingFillableFields.push('company')
      if (!role) missingFillableFields.push('role')
      if (!jd) missingFillableFields.push('jd')
      if (!location) missingFillableFields.push('location')
      if (sponsorshipWasBlank) missingFillableFields.push('sponsorship')
    }

    const unusable = !company && !role && !jobUrlRaw
    if (unusable) {
      reasons.push('No company, role, or job URL - nothing to identify this row by')
      return {
        rowNumber,
        data,
        outcome: 'invalid',
        reasons,
        duplicateInFile: false,
        duplicateInDb: false,
        invalidDateRaw: dateResult.ok ? null : String(cellAt(row, mapping, 'applied_date') ?? ''),
        statusWasInvalid,
        missingFillableFields,
      }
    }

    let duplicateInFile = false
    let duplicateInDb = false
    if (jobUrlRaw) {
      const key = normalizeUrlKey(jobUrlRaw)
      if (seenInFile.has(key)) {
        duplicateInFile = true
        reasons.push('Duplicate job URL within this file')
      } else {
        seenInFile.add(key)
      }
      if (existing.has(key)) {
        duplicateInDb = true
        reasons.push('A job with this URL already exists')
      }
    }

    const outcome: ImportRowOutcome = duplicateInFile || duplicateInDb ? 'duplicate' : 'valid'

    return {
      rowNumber,
      data,
      outcome,
      reasons,
      duplicateInFile,
      duplicateInDb,
      invalidDateRaw: dateResult.ok ? null : String(cellAt(row, mapping, 'applied_date') ?? ''),
      statusWasInvalid,
      missingFillableFields,
    }
  })
}

function emptyRowData(): ImportRowData {
  return {
    company: null,
    role: null,
    job_url: null,
    jd: null,
    location: null,
    sponsorship: 'Unknown',
    applied_date: null,
    status: 'Applied',
    notes: null,
  }
}

export interface ImportSummaryCounts {
  imported: number
  skippedDuplicates: number
  needsManualReview: number
  parsingFailed: number
  invalidRows: number
}

/** Converts a valid ImportRow into the payload createJob expects. */
export function rowToNewJob(row: ImportRow): NewJob {
  return { ...row.data }
}

/** Only the fields eligible for parse-fill, used to decide which rows need a parse-job call at all. */
export function rowNeedsParseFill(row: ImportRow): boolean {
  return Boolean(row.data.job_url) && row.missingFillableFields.some((f) => PARSE_FILLABLE_FIELDS.includes(f))
}
