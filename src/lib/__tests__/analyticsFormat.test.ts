import { describe, expect, it } from 'vitest'
import {
  formatDays,
  formatMedianResponseTime,
  formatPercent,
  formatPeriodLabel,
  formatResponseSampleCaption,
  formatTrackedRate,
  formatTrackedRateCaption,
} from '../analyticsFormat'

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

  describe('formatDays', () => {
    it('shows an em dash placeholder when days is null', () => {
      expect(formatDays(null)).toBe('—')
    })

    it('pluralizes "days" for a value greater than one', () => {
      expect(formatDays(5)).toBe('5 days')
    })

    it('uses the singular "day" when days is exactly 1', () => {
      expect(formatDays(1)).toBe('1 day')
    })

    it('rounds to the nearest whole day (no fractional/sub-day precision)', () => {
      expect(formatDays(4.5)).toBe('5 days')
    })
  })

  describe('formatMedianResponseTime', () => {
    it('shows a placeholder when medianDays is null (not enough responses)', () => {
      expect(formatMedianResponseTime(null, 0)).toBe('Not enough responses yet')
    })

    it('shows a placeholder when sampleSize is 0, even if medianDays is somehow non-null', () => {
      expect(formatMedianResponseTime(5, 0)).toBe('Not enough responses yet')
    })

    it('renders just the formatted day count - the sample size is a separate caption, not appended here', () => {
      expect(formatMedianResponseTime(4, 3)).toBe('4 days')
    })

    it('uses the singular "day" when medianDays rounds to exactly 1', () => {
      expect(formatMedianResponseTime(1, 1)).toBe('1 day')
    })
  })

  describe('formatResponseSampleCaption', () => {
    it('describes the sample size as applications with a recorded response', () => {
      expect(formatResponseSampleCaption(18)).toBe('Based on 18 applications with a recorded response')
    })

    it('uses the singular "application" when sampleSize is exactly 1', () => {
      expect(formatResponseSampleCaption(1)).toBe('Based on 1 application with a recorded response')
    })

    it('returns an empty string when sampleSize is 0 (nothing to caption)', () => {
      expect(formatResponseSampleCaption(0)).toBe('')
    })
  })

  describe('formatPercent', () => {
    it('rounds to the nearest whole percent', () => {
      expect(formatPercent(1, 4)).toBe('25%')
      expect(formatPercent(2, 3)).toBe('67%')
    })

    it('returns an em dash placeholder when the denominator is zero - never divides by zero, never "NaN%" or "Infinity%"', () => {
      expect(formatPercent(0, 0)).toBe('—')
      expect(formatPercent(5, 0)).toBe('—')
    })

    it('returns an em dash placeholder for a negative denominator too (defensive, should never happen with real counts)', () => {
      expect(formatPercent(1, -1)).toBe('—')
    })

    it('handles a numerator of zero over a positive denominator as 0%, not a placeholder', () => {
      expect(formatPercent(0, 10)).toBe('0%')
    })

    it('handles numerator equal to denominator as 100%', () => {
      expect(formatPercent(18, 18)).toBe('100%')
    })
  })

  describe('formatTrackedRate (V3.6 Application Source Performance)', () => {
    it('renders a rounded whole-percent rate over the tracked cohort', () => {
      expect(formatTrackedRate(7, 12)).toBe('58%')
    })

    it('shows an em dash when trackedCount is zero - never a fabricated 0%', () => {
      expect(formatTrackedRate(0, 0)).toBe('—')
    })
  })

  describe('formatTrackedRateCaption (V3.6 Application Source Performance)', () => {
    it('names the fully-tracked subset explicitly, never a bare "N of M applications"', () => {
      expect(formatTrackedRateCaption(7, 12)).toBe('7 of 12 fully tracked applications')
    })

    it('uses the singular "application" when trackedCount is exactly 1', () => {
      expect(formatTrackedRateCaption(1, 1)).toBe('1 of 1 fully tracked application')
    })

    it('returns friendly "No complete history yet" copy when trackedCount is zero, never "0 of 0"', () => {
      expect(formatTrackedRateCaption(0, 0)).toBe('No complete history yet')
    })

    it('never emits forbidden statistical jargon (n=, sample size, denominator, cohort)', () => {
      const captions = [formatTrackedRateCaption(7, 12), formatTrackedRateCaption(0, 0), formatTrackedRateCaption(3, 30)]
      for (const caption of captions) {
        expect(caption).not.toMatch(/n=/i)
        expect(caption).not.toMatch(/sample size/i)
        expect(caption).not.toMatch(/denominator/i)
        expect(caption).not.toMatch(/cohort/i)
      }
    })
  })
})
