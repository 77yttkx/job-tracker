/**
 * Pure logic for the custom MM/DD/YYYY date input (src/components/ui/DateField.tsx).
 * Kept separate from the component so it can be unit-tested directly, per
 * this codebase's convention of separating logic from JSX (see
 * src/lib/distributions.ts / DistributionPanel.tsx).
 *
 * Everything here operates on plain YYYY-MM-DD / MM-DD-YYYY strings via
 * string splitting, never `new Date("YYYY-MM-DD")` (which parses as UTC and
 * can shift the displayed day by one near a timezone boundary). Validity is
 * checked with a *local* Date field round-trip (`new Date(y, m - 1, d)`),
 * the same safe pattern used by src/lib/import/normalize.ts.
 */

function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

/** YYYY-MM-DD -> MM/DD/YYYY. Pure string reformat - no Date parsing, no UTC shift. Returns '' for an empty/invalid input. */
export function ymdToDisplay(ymd: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd)
  if (!match) return ''
  const [, year, month, day] = match
  return `${month}/${day}/${year}`
}

/** Formats raw keystrokes into a progressive MM/DD/YYYY mask, keeping only digits and inserting slashes at the right positions. */
export function maskDateDigits(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 8)
  const mm = digits.slice(0, 2)
  const dd = digits.slice(2, 4)
  const yyyy = digits.slice(4, 8)
  let out = mm
  if (digits.length > 2) out += '/' + dd
  if (digits.length > 4) out += '/' + yyyy
  return out
}

export interface ParsedDateDisplay {
  /** YYYY-MM-DD once a full, valid date has been entered; otherwise null. */
  ymd: string | null
  /** True once 8 digits (MMDDYYYY) have been typed, whether or not they form a valid date. */
  complete: boolean
  /** True for an empty field or a complete, real calendar date. False only for a complete-but-impossible date (e.g. 02/30/2026). */
  valid: boolean
}

/**
 * Parses a MM/DD/YYYY display string (slashes optional - only digits are
 * read). Validated via local Date field construction and a round-trip
 * check, so "02/30/2026" is correctly rejected rather than silently
 * rolling over to March.
 */
export function parseDateDisplay(display: string): ParsedDateDisplay {
  const digits = display.replace(/\D/g, '')
  if (digits.length === 0) return { ymd: null, complete: true, valid: true }
  if (digits.length < 8) return { ymd: null, complete: false, valid: false }

  const month = Number(digits.slice(0, 2))
  const day = Number(digits.slice(2, 4))
  const year = Number(digits.slice(4, 8))
  const date = new Date(year, month - 1, day)
  const roundTrips =
    date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day
  if (!roundTrips) return { ymd: null, complete: true, valid: false }

  return { ymd: `${year}-${pad2(month)}-${pad2(day)}`, complete: true, valid: true }
}

export const MONTH_LABELS_EN: readonly string[] = Array.from({ length: 12 }, (_, i) =>
  new Date(2000, i, 1).toLocaleDateString('en-US', { month: 'long' }),
)

export const WEEKDAY_LABELS_EN: readonly string[] = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']

/** Builds a 0-indexed month grid (nulls for the leading blanks before day 1) for the calendar popover. */
export function buildMonthGrid(year: number, month: number): Array<number | null> {
  const firstWeekday = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const cells: Array<number | null> = []
  for (let i = 0; i < firstWeekday; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)
  return cells
}

/** Formats a year/month(0-indexed)/day into YYYY-MM-DD. */
export function toYmd(year: number, month: number, day: number): string {
  return `${year}-${pad2(month + 1)}-${pad2(day)}`
}

/**
 * Today's date as YYYY-MM-DD, in the browser's local timezone - built
 * from `Date`'s own local year/month/day getters (never a UTC-parsing
 * `new Date().toISOString()`, which can be a day off near midnight in a
 * negative-offset timezone), for the calendar popover's "today"
 * indicator (src/components/ui/DateField.tsx). Purely a visual highlight
 * - it never changes what date is selected/filtered.
 */
export function getTodayYmd(): string {
  const now = new Date()
  return toYmd(now.getFullYear(), now.getMonth(), now.getDate())
}
