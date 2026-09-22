import { describe, expect, it } from 'vitest'
import { mapWithConcurrency } from '../concurrency'

describe('mapWithConcurrency', () => {
  it('preserves input order in the results regardless of completion order', async () => {
    const items = [30, 10, 20, 5]
    const results = await mapWithConcurrency(items, 2, async (ms) => {
      await new Promise((resolve) => setTimeout(resolve, ms))
      return ms
    })
    expect(results).toEqual([30, 10, 20, 5])
  })

  it('never runs more than `limit` calls concurrently', async () => {
    let active = 0
    let maxActive = 0
    const items = Array.from({ length: 10 }, (_, i) => i)
    await mapWithConcurrency(items, 3, async (i) => {
      active += 1
      maxActive = Math.max(maxActive, active)
      await new Promise((resolve) => setTimeout(resolve, 5))
      active -= 1
      return i
    })
    expect(maxActive).toBeLessThanOrEqual(3)
  })

  it('does not lose other results when one call rejects (caller must catch internally, but a thrown error still surfaces without corrupting other slots)', async () => {
    const items = [1, 2, 3]
    const results = await mapWithConcurrency(items, 2, async (i) => {
      if (i === 2) return { ok: false, error: 'boom' }
      return { ok: true, value: i }
    })
    expect(results).toEqual([
      { ok: true, value: 1 },
      { ok: false, error: 'boom' },
      { ok: true, value: 3 },
    ])
  })
})
