import { parseLocalDate } from './timeBuckets'
import type { TrendGranularity } from '../types/analytics'

const MONTH_FORMATTER = new Intl.DateTimeFormat('en-US', { month: 'short', year: 'numeric' })
const DAY_FORMATTER = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' })

/**
 * Formats an RPC-returned period_start/week_start ("YYYY-MM-DD") for
 * display. Always parsed as a local calendar date (see
 * src/lib/timeBuckets.ts's parseLocalDate) so the label never shifts a
 * day off from what the database actually returned.
 */
export function formatPeriodLabel(isoDate: string, granularity: TrendGranularity): string {
  const date = parseLocalDate(isoDate)
  return granularity === 'week' ? `Week of ${DAY_FORMATTER.format(date)}` : MONTH_FORMATTER.format(date)
}

export function formatWeekLabel(isoDate: string): string {
  return `Week of ${DAY_FORMATTER.format(parseLocalDate(isoDate))}`
}

/** Renders an average-days metric for display, or a placeholder when there isn't enough tracked history yet. */
export function formatAvgDays(avgDays: number | null, sampleSize: number): string {
  if (avgDays === null || sampleSize === 0) return 'Not enough tracked history yet'
  return `${avgDays} day${avgDays === 1 ? '' : 's'} (n=${sampleSize})`
}
