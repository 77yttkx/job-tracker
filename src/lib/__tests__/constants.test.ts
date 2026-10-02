import { describe, expect, it } from 'vitest'
import {
  APPLICATION_SOURCES,
  DEFAULT_APPLICATION_SOURCE,
  DEFAULT_STATUS,
  JOB_STATUSES,
  STATUS_COLORS,
} from '../constants'

describe('status constants', () => {
  it('has exactly the eight required statuses, in order', () => {
    expect(JOB_STATUSES).toEqual([
      'Applied',
      'OA',
      '1st Round',
      '2nd Round',
      'Final Round',
      'Offer',
      'Rejected',
      'Ghosted',
    ])
  })

  it('defaults new jobs to Applied', () => {
    expect(DEFAULT_STATUS).toBe('Applied')
  })

  it('defines a color entry for every status', () => {
    for (const status of JOB_STATUSES) {
      expect(STATUS_COLORS[status]).toBeDefined()
    }
  })
})

describe('application source constants (V3.6)', () => {
  it('has exactly the eight required application sources, in order, with Unknown last', () => {
    expect(APPLICATION_SOURCES).toEqual([
      'Company Website',
      'LinkedIn',
      'Referral',
      'Handshake',
      'Career Fair',
      'Recruiter',
      'Other',
      'Unknown',
    ])
  })

  it('defaults new jobs to Unknown - never a guessed value', () => {
    expect(DEFAULT_APPLICATION_SOURCE).toBe('Unknown')
  })

  it('does not invent extra categories beyond the eight specified', () => {
    expect(APPLICATION_SOURCES).toHaveLength(8)
  })
})
