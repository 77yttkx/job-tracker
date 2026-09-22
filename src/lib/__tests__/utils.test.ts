import { describe, expect, it } from 'vitest'
import { formatDate, isValidHttpUrl, sanitizeText, shortenUrl } from '../utils'

describe('isValidHttpUrl', () => {
  it('accepts http and https URLs', () => {
    expect(isValidHttpUrl('https://example.com/job/123')).toBe(true)
    expect(isValidHttpUrl('http://example.com')).toBe(true)
  })

  it('rejects non-http protocols and garbage input', () => {
    expect(isValidHttpUrl('ftp://example.com')).toBe(false)
    expect(isValidHttpUrl('not a url')).toBe(false)
    expect(isValidHttpUrl('')).toBe(false)
    expect(isValidHttpUrl('   ')).toBe(false)
  })
})

describe('shortenUrl', () => {
  it('returns the bare hostname without www', () => {
    expect(shortenUrl('https://www.example.com/jobs/123?x=1')).toBe('example.com')
    expect(shortenUrl('https://boards.greenhouse.io/acme/jobs/5')).toBe('boards.greenhouse.io')
  })

  it('returns empty string for missing input', () => {
    expect(shortenUrl(null)).toBe('')
    expect(shortenUrl(undefined)).toBe('')
  })
})

describe('formatDate', () => {
  it('formats a date-only (YYYY-MM-DD) value in English, regardless of the runtime locale', () => {
    // en-US month/day/year ordering and English month abbreviations, even
    // if the environment's default ICU locale is something else entirely.
    expect(formatDate('2026-09-21')).toBe('Sep 21, 2026')
    expect(formatDate('2026-01-05')).toBe('Jan 5, 2026')
  })

  it('does not UTC-shift a date-only value to the previous day', () => {
    // A naive `new Date('2026-01-01')` is parsed as UTC midnight, which
    // renders as Dec 31 2025 in any timezone behind UTC - formatDate must
    // avoid that by treating date-only input as local midnight.
    expect(formatDate('2026-01-01')).toBe('Jan 1, 2026')
    expect(formatDate('2026-01-01')).not.toContain('Dec 31')
  })

  it('formats a full timestamp too', () => {
    expect(formatDate('2026-09-21T00:00:00.000Z')).toMatch(/Sep (20|21), 2026/)
  })

  it('returns empty string for missing or invalid input', () => {
    expect(formatDate(null)).toBe('')
    expect(formatDate(undefined)).toBe('')
    expect(formatDate('not a date')).toBe('')
  })
})

describe('sanitizeText', () => {
  it('strips HTML tags and collapses whitespace', () => {
    expect(sanitizeText('<p>Hello <b>world</b></p>')).toBe('Hello world')
    expect(sanitizeText('a   b\n\n\n\nc')).toBe('a b\n\nc')
  })

  it('returns null for empty or whitespace-only input', () => {
    expect(sanitizeText('')).toBeNull()
    expect(sanitizeText('   ')).toBeNull()
    expect(sanitizeText(null)).toBeNull()
  })

  it('decodes common HTML entities', () => {
    expect(sanitizeText('Tom &amp; Jerry &mdash;? &quot;fun&quot;')).toContain('Tom & Jerry')
  })
})
