import { describe, expect, it } from 'vitest'
import { normalizeSponsorship, normalizeStatus, parseImportDate } from '../normalize'

describe('normalizeStatus', () => {
  it('passes through an exact status match', () => {
    expect(normalizeStatus('1st Round').status).toBe('1st Round')
    expect(normalizeStatus('1st Round').wasInvalid).toBe(false)
  })

  it('matches case-insensitively', () => {
    expect(normalizeStatus('applied').status).toBe('Applied')
    expect(normalizeStatus('OFFER').status).toBe('Offer')
  })

  it('matches loosely, ignoring spacing/punctuation', () => {
    expect(normalizeStatus('1st-round').status).toBe('1st Round')
    expect(normalizeStatus('finalround').status).toBe('Final Round')
  })

  it('defaults a blank cell to Applied without flagging it invalid', () => {
    const result = normalizeStatus('')
    expect(result.status).toBe('Applied')
    expect(result.wasInvalid).toBe(false)
  })

  it('accepts the legacy pre-V2.5.1 "Reject" status value and normalizes it to "Rejected"', () => {
    const result = normalizeStatus('Reject')
    expect(result.status).toBe('Rejected')
    expect(result.wasInvalid).toBe(false)
  })

  it('accepts "Reject" case-insensitively and with surrounding whitespace', () => {
    expect(normalizeStatus('  reject  ').status).toBe('Rejected')
    expect(normalizeStatus('REJECT').status).toBe('Rejected')
  })

  it('defaults an unrecognized value to Applied and flags it invalid', () => {
    const result = normalizeStatus('Interviewing')
    expect(result.status).toBe('Applied')
    expect(result.wasInvalid).toBe(true)
  })
})

describe('normalizeSponsorship', () => {
  it('recognizes Yes/Y/True variants', () => {
    for (const v of ['Yes', 'yes', 'Y', 'y', 'True', 'TRUE']) {
      expect(normalizeSponsorship(v)).toBe('Yes')
    }
  })

  it('recognizes No/N/False variants', () => {
    for (const v of ['No', 'no', 'N', 'n', 'False', 'FALSE']) {
      expect(normalizeSponsorship(v)).toBe('No')
    }
  })

  it('defaults blank or unrecognized text to Unknown', () => {
    expect(normalizeSponsorship('')).toBe('Unknown')
    expect(normalizeSponsorship(null)).toBe('Unknown')
    expect(normalizeSponsorship('Maybe')).toBe('Unknown')
  })
})

describe('parseImportDate', () => {
  it('passes an already-ISO date through unchanged (no reparsing)', () => {
    expect(parseImportDate('2026-09-21')).toEqual({ value: '2026-09-21', ok: true })
  })

  it('parses a US-style M/D/YYYY string', () => {
    expect(parseImportDate('9/21/2026')).toEqual({ value: '2026-09-21', ok: true })
    expect(parseImportDate('12/1/2025')).toEqual({ value: '2025-12-01', ok: true })
  })

  it('parses a free-text date like "Sep 21, 2026"', () => {
    expect(parseImportDate('Sep 21, 2026')).toEqual({ value: '2026-09-21', ok: true })
  })

  it('converts an Excel date serial number to the correct calendar date', () => {
    // Excel serial 46000 == 2025-12-09 (verified via the same UTC-day arithmetic the implementation uses).
    expect(parseImportDate(46000)).toEqual({ value: '2025-12-09', ok: true })
  })

  it('treats a blank cell as ok (not an error) with a null value', () => {
    expect(parseImportDate(null)).toEqual({ value: null, ok: true })
    expect(parseImportDate(undefined)).toEqual({ value: null, ok: true })
    expect(parseImportDate('   ')).toEqual({ value: null, ok: true })
  })

  it('flags a genuinely unparseable value instead of guessing', () => {
    const result = parseImportDate('not a date')
    expect(result.ok).toBe(false)
    expect(result.value).toBeNull()
  })

  it('flags an impossible US-style date (e.g. 13/40/2026) rather than silently rolling over', () => {
    const result = parseImportDate('13/40/2026')
    expect(result.ok).toBe(false)
  })
})
