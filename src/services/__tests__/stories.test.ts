import { afterEach, describe, expect, it, vi } from 'vitest'

// Chainable query-builder mock matching how stories.ts calls
// supabase.from(...).{select,insert,update,delete,order,eq,single}(...).
// Each method returns `this` so any chain shape resolves, and the final
// awaited value is controlled per-test via `resolveWith`.
function createQueryBuilderMock() {
  let result: { data: unknown; error: unknown } = { data: null, error: null }
  const builder: Record<string, unknown> = {}
  const chain = (): unknown => builder
  builder.select = vi.fn(chain)
  builder.insert = vi.fn(chain)
  builder.update = vi.fn(chain)
  builder.delete = vi.fn(chain)
  builder.order = vi.fn(chain)
  builder.eq = vi.fn(chain)
  builder.single = vi.fn(() => Promise.resolve(result))
  // `delete().eq(...)` in stories.ts's deleteStory is awaited directly
  // (no .single()), so the eq() call itself must also be awaitable.
  builder.then = (resolve: (value: { data: unknown; error: unknown }) => unknown) => resolve(result)
  return {
    builder,
    resolveWith(next: { data: unknown; error: unknown }) {
      result = next
    },
  }
}

const fromMock = vi.fn()
const { builder, resolveWith } = createQueryBuilderMock()
fromMock.mockReturnValue(builder)

vi.mock('../supabase', () => ({
  supabase: { from: fromMock },
  isSupabaseConfigured: true,
}))

const { createStory, updateStory, deleteStory, fetchStories } = await import('../stories')

afterEach(() => {
  fromMock.mockClear()
  Object.values(builder).forEach((fn) => {
    if (typeof fn === 'function' && 'mockClear' in fn) (fn as { mockClear: () => void }).mockClear()
  })
  resolveWith({ data: null, error: null })
})

describe('stories service', () => {
  it('fetchStories queries the personal_stories table ordered by updated_at desc', async () => {
    resolveWith({ data: [{ story_id: '1' }], error: null })
    // fetchStories awaits the builder itself (no .single()), so it needs
    // the `then` shim above to resolve.
    const rows = await fetchStories()
    expect(fromMock).toHaveBeenCalledWith('personal_stories')
    expect(builder.order).toHaveBeenCalledWith('updated_at', { ascending: false })
    expect(rows).toEqual([{ story_id: '1' }])
  })

  it('createStory trims text fields, normalizes tags, and attaches the given userId', async () => {
    resolveWith({ data: { story_id: 'new-id' }, error: null })
    await createStory(
      { title: '  My Story  ', raw_story: '  Once upon a time  ', tags: ['Leadership', ' leadership ', 'Custom'] },
      'user-123',
    )
    expect(builder.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: 'user-123',
        title: 'My Story',
        raw_story: 'Once upon a time',
        tags: ['Leadership', 'Custom'],
      }),
    )
  })

  it('updateStory only includes fields that were actually provided', async () => {
    resolveWith({ data: { story_id: '1' }, error: null })
    await updateStory('1', { title: 'New Title' })
    expect(builder.update).toHaveBeenCalledWith({ title: 'New Title' })
  })

  it('deleteStory translates a foreign-key-violation (23503) into a specific, actionable message', async () => {
    resolveWith({ data: null, error: { code: '23503', message: 'update or delete violates foreign key constraint' } })
    await expect(deleteStory('story-with-answers')).rejects.toThrow(
      /saved answers linked to it.*Answer Library/s,
    )
  })

  it('deleteStory surfaces any other database error normally, not the FK-specific message', async () => {
    resolveWith({ data: null, error: { code: '42501', message: 'permission denied' } })
    await expect(deleteStory('story-1')).rejects.toThrow()
    await expect(deleteStory('story-1')).rejects.not.toThrow(/saved answers linked to it/)
  })

  it('deleteStory resolves without error when the delete succeeds', async () => {
    resolveWith({ data: null, error: null })
    await expect(deleteStory('story-1')).resolves.toBeUndefined()
  })
})
