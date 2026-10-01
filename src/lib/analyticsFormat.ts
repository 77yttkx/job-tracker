import { parseLocalDate } from './timeBuckets'
import type { TrendGranularity } from '../types/analytics'

const MONTH_FORMATTER = new Intl.DateTimeFormat('en-US', { month: 'short', year: 'numeric' })
const DAY_FORMATTER = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' })

/**
 * Formats an RPC-returned period_start ("YYYY-MM-DD") for display. Always
 * parsed as a local calendar date (see src/lib/timeBuckets.ts's
 * parseLocalDate) so the label never shifts a day off from what the
 * database actually returned.
 */
export function formatPeriodLabel(isoDate: string, granularity: TrendGranularity): string {
  const date = parseLocalDate(isoDate)
  return granularity === 'week' ? `Week of ${DAY_FORMATTER.format(date)}` : MONTH_FORMATTER.format(date)
}

/** Renders a whole-day duration for display, with no fractional/sub-day precision (the underlying data is day-granular). */
export function formatDays(days: number | null): string {
  if (days === null) return '—'
  const rounded = Math.round(days)
  return `${rounded} day${rounded === 1 ? '' : 's'}`
}

/**
 * Renders the Time to Response median for display - just the day count
 * (e.g. "2 days"), or a placeholder when there isn't enough data yet.
 * The sample size is shown separately as secondary text - see
 * formatResponseSampleCaption - rather than appended here.
 */
export function formatMedianResponseTime(medianDays: number | null, sampleSize: number): string {
  if (medianDays === null || sampleSize === 0) return 'Not enough responses yet'
  return formatDays(medianDays)
}

/**
 * Secondary caption for the Time to Response median, e.g. "Based on 18
 * applications with a recorded response". Empty string when there's
 * nothing to caption (sampleSize is 0).
 */
export function formatResponseSampleCaption(sampleSize: number): string {
  if (sampleSize === 0) return ''
  return `Based on ${sampleSize} application${sampleSize === 1 ? '' : 's'} with a recorded response`
}

/**
 * Renders `numerator / denominator` as a rounded whole-percent string
 * (e.g. "26%"), or an em dash placeholder when the denominator is zero -
 * used throughout Insights (Application Funnel's stage/overall
 * percentages) wherever a safe, divide-by-zero-proof percentage display
 * is needed. Never throws, never renders "NaN%" or "Infinity%".
 */
export function formatPercent(numerator: number, denominator: number): string {
  if (denominator <= 0) return '—'
  return `${Math.round((numerator / denominator) * 100)}%`
}
