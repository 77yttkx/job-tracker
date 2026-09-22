import { describe, expect, it } from 'vitest'
import {
  buildMonthGrid,
  maskDateDigits,
  parseDateDisplay,
  toYmd,
  ymdToDisplay,
} from '../dateField'

describe('ymdToDisplay', () => {
  it('formats YYYY-MM-DD as MM/DD/YYYY via pure string reformat', () => {
    expect(ymdToDisplay('2026-09-21')).toBe('09/21/2026')
    expect(ymdToDisplay('2026-01-05')).toBe('01/05/2026')
  })

  it('never shifts the day (no Date parsing involved)', () => {
    // A UTC-parsing bug would show this as 12/31/2025 in negative-offset
    // timezones. Pure string splitting can never do that.
    expect(ymdToDisplay('2026-01-01')).toBe('01/01/2026')
  })

  it('returns an empty string for empty/invalid input', () => {
    expect(ymdToDisplay('')).toBe('')
    expect(ymdToDisplay('not-a-date')).toBe('')
  })
})

describe('maskDateDigits', () => {
  it('inserts slashes progressively as digits are typed', () => {
    expect(maskDateDigits('0')).toBe('0')
    expect(maskDateDigits('09')).toBe('09')
    expect(maskDateDigits('092')).toBe('09/2')
    expect(maskDateDigits('0921')).toBe('09/21')
    expect(maskDateDigits('09212')).toBe('09/21/2')
    expect(maskDateDigits('09212026')).toBe('09/21/2026')
  })

  it('strips non-digit characters (e.g. a pasted date with slashes)', () => {
    expect(maskDateDigits('09/21/2026')).toBe('09/21/2026')
  })

  it('caps input at 8 digits', () => {
    expect(maskDateDigits('092120269999')).toBe('09/21/2026')
  })
})

describe('parseDateDisplay', () => {
  it('treats an empty string as a valid, cleared value', () => {
    expect(parseDateDisplay('')).toEqual({ ymd: null, complete: true, valid: true })
  })

  it('treats a partially-typed date as incomplete, not invalid', () => {
    const result = parseDateDisplay('09/2')
    expect(result.complete).toBe(false)
    expect(result.valid).toBe(false)
    expect(result.ymd).toBeNull()
  })

  it('parses a complete, valid MM/DD/YYYY into YYYY-MM-DD', () => {
    expect(parseDateDisplay('09/21/2026')).toEqual({
      ymd: '2026-09-21',
      complete: true,
      valid: true,
    })
  })

  it('rejects an impossible calendar date instead of rolling over (02/30 -> March)', () => {
    const result = parseDateDisplay('02/30/2026')
    expect(result.complete).toBe(true)
    expect(result.valid).toBe(false)
    expect(result.ymd).toBeNull()
  })

  it('rejects month 13 and day 0', () => {
    expect(parseDateDisplay('13/01/2026').valid).toBe(false)
    expect(parseDateDisplay('01/00/2026').valid).toBe(false)
  })

  it('round-trips through ymdToDisplay for every day of a 31-day and a 28-day month', () => {
    for (const ymd of ['2026-01-31', '2026-02-28', '2026-12-25']) {
      expect(parseDateDisplay(ymdToDisplay(ymd)).ymd).toBe(ymd)
    }
  })
})

describe('buildMonthGrid', () => {
  it('produces exactly 30 day cells (plus leading blanks) for April', () => {
    const cells = buildMonthGrid(2026, 3) // April 2026, 0-indexed month
    const dayCells = cells.filter((c) => c !== null)
    expect(dayCells).toEqual(Array.from({ length: 30 }, (_, i) => i + 1))
  })

  it('produces exactly 29 day cells for a leap-year February', () => {
    const cells = buildMonthGrid(2028, 1) // Feb 2028 is a leap year
    expect(cells.filter((c) => c !== null)).toHaveLength(29)
  })

  it('produces exactly 28 day cells for a non-leap-year February', () => {
    const cells = buildMonthGrid(2026, 1)
    expect(cells.filter((c) => c !== null)).toHaveLength(28)
  })
})

describe('toYmd', () => {
  it('formats and zero-pads a year/month(0-indexed)/day into YYYY-MM-DD', () => {
    expect(toYmd(2026, 0, 5)).toBe('2026-01-05')
    expect(toYmd(2026, 11, 25)).toBe('2026-12-25')
  })
})
