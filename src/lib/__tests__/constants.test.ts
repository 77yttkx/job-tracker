import { describe, expect, it } from 'vitest'
import { DEFAULT_STATUS, JOB_STATUSES, STATUS_COLORS } from '../constants'

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
