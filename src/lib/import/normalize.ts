import { DEFAULT_STATUS, JOB_STATUSES } from '../constants'
import type { JobStatus, Sponsorship } from '../constants'

/**
 * Legacy spreadsheet values that no longer match a current JOB_STATUSES
 * entry verbatim, but should still be accepted and normalized rather than
 * flagged as invalid. Keyed by the loose (lowercased, alnum-only) form.
 * "Reject" was the status name prior to the V2.5.1 rename to "Rejected" -
 * both an old export of this app's own CSV and a hand-typed "Reject" in a
 * spreadsheet should still land as "Rejected", never as an invalid row.
 */
const LEGACY_STATUS_ALIASES: Record<string, JobStatus> = {
  reject: 'Rejected',
  rejected: 'Rejected',
}

/** Normalizes an imported status cell to one of the 8 allowed values. Blank -> Applied, silently. An unrecognized value also defaults to Applied but is reported (wasInvalid: true) so the preview can flag it. */
export function normalizeStatus(raw: unknown): { status: JobStatus; wasInvalid: boolean } {
  const trimmed = String(raw ?? '').trim()
  if (!trimmed) return { status: DEFAULT_STATUS, wasInvalid: false }

  const exact = JOB_STATUSES.find((s) => s.toLowerCase() === trimmed.toLowerCase())
  if (exact) return { status: exact, wasInvalid: false }

  // Loose match: ignore spacing/punctuation so "1st round", "1st-Round", or
  // "1stround" all still resolve to "1st Round".
  const loose = trimmed.toLowerCase().replace(/[^a-z0-9]/g, '')
  const looseMatch = JOB_STATUSES.find((s) => s.toLowerCase().replace(/[^a-z0-9]/g, '') === loose)
  if (looseMatch) return { status: looseMatch, wasInvalid: false }

  const legacy = LEGACY_STATUS_ALIASES[loose]
  if (legacy) return { status: legacy, wasInvalid: false }

  return { status: DEFAULT_STATUS, wasInvalid: true }
}

const SPONSORSHIP_YES = new Set(['yes', 'y', 'true'])
const SPONSORSHIP_NO = new Set(['no', 'n', 'false'])

/** Normalizes an imported sponsorship cell: Yes/Y/True -> Yes, No/N/False -> No, anything else (including blank) -> Unknown. */
export function normalizeSponsorship(raw: unknown): Sponsorship {
  const trimmed = String(raw ?? '').trim().toLowerCase()
  if (SPONSORSHIP_YES.has(trimmed)) return 'Yes'
  if (SPONSORSHIP_NO.has(trimmed)) return 'No'
  return 'Unknown'
}

function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

/** Formats a JS Date using its *local* calendar fields (never UTC), avoiding the off-by-one shift that `toISOString().slice(0, 10)` can introduce. */
function formatLocalYMD(date: Date): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`
}

/**
 * Converts an Excel date serial number (days since 1899-12-30, per the
 * spreadsheet date system SheetJS/Excel use) to a YYYY-MM-DD string. Built
 * from UTC arithmetic throughout, so there is no local-timezone shift to
 * guard against - the serial number carries no timezone information itself.
 */
function excelSerialToYMD(serial: number): string | null {
  if (!Number.isFinite(serial)) return null
  // 25569 = the Excel serial number for 1970-01-01 (the Unix epoch).
  const utcMs = Math.round((serial - 25569) * 86400 * 1000)
  const date = new Date(utcMs)
  if (Number.isNaN(date.getTime())) return null
  return `${date.getUTCFullYear()}-${pad2(date.getUTCMonth() + 1)}-${pad2(date.getUTCDate())}`
}

export interface ParsedImportDate {
  value: string | null
  /** false only when a non-blank value was present but could not be parsed. A blank cell is `ok: true, value: null`. */
  ok: boolean
}

/**
 * Parses an imported applied_date cell into YYYY-MM-DD. Accepts an Excel
 * date serial number, an already-ISO "YYYY-MM-DD" string (used as-is, no
 * reparsing - avoids any UTC-shift risk), a US-style "M/D/YYYY" string
 * (parsed via local Date field construction, not string-to-UTC parsing),
 * or a free-text date SheetJS/the browser can otherwise parse (e.g. "Sep
 * 21, 2026"). Blank input is not an error. An unparseable non-blank value
 * returns `ok: false` so the caller can flag the row instead of guessing.
 */
export function parseImportDate(raw: unknown): ParsedImportDate {
  if (raw === null || raw === undefined) return { value: null, ok: true }

  if (typeof raw === 'number') {
    const ymd = excelSerialToYMD(raw)
    return ymd ? { value: ymd, ok: true } : { value: null, ok: false }
  }

  const trimmed = String(raw).trim()
  if (!trimmed) return { value: null, ok: true }

  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return { value: trimmed, ok: true }
  }

  const usMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (usMatch) {
    const month = Number(usMatch[1])
    const day = Number(usMatch[2])
    const year = Number(usMatch[3])
    const date = new Date(year, month - 1, day)
    const roundTrips = date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day
    return roundTrips ? { value: formatLocalYMD(date), ok: true } : { value: null, ok: false }
  }

  const parsed = new Date(trimmed)
  if (!Number.isNaN(parsed.getTime())) {
    return { value: formatLocalYMD(parsed), ok: true }
  }

  return { value: null, ok: false }
}
