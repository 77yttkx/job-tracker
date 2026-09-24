import { describe, expect, it } from 'vitest'
import { formatAvgDays, formatPeriodLabel, formatWeekLabel } from '../analyticsFormat'

describe('analyticsFormat', () => {
  describe('formatPeriodLabel', () => {
    it('formats a month bucket as "Mon YYYY"', () => {
      expect(formatPeriodLabel('2026-03-01', 'month')).toBe('Mar 2026')
    })

    it('formats a week bucket as "Week of Mon D"', () => {
      expect(formatPeriodLabel('2026-03-02', 'week')).toBe('Week of Mar 2')
    })

    it('parses the ISO date as a local calendar date, never shifting a day off (UTC-midnight bug)', () => {
      // "2026-01-01" must never render as "Dec 2025" due to UTC parsing.
      expect(formatPeriodLabel('2026-01-01', 'month')).toBe('Jan 2026')
    })
  })

  describe('formatWeekLabel', () => {
    it('formats an ISO week-start date', () => {
      expect(formatWeekLabel('2026-06-15')).toBe('Week of Jun 15')
    })
  })

  describe('formatAvgDays', () => {
    it('shows a placeholder when avgDays is null (not enough tracked history)', () => {
      expect(formatAvgDays(null, 0)).toBe('Not enough tracked history yet')
    })

    it('shows a placeholder when sampleSize is 0, even if avgDays is somehow non-null', () => {
      expect(formatAvgDays(5, 0)).toBe('Not enough tracked history yet')
    })

    it('pluralizes "days" for a sample size and value greater than one', () => {
      expect(formatAvgDays(4.5, 3)).toBe('4.5 days (n=3)')
    })

    it('uses the singular "day" when avgDays is exactly 1', () => {
      expect(formatAvgDays(1, 1)).toBe('1 day (n=1)')
    })
  })
})
