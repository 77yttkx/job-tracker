import { afterEach, describe, expect, it, vi } from 'vitest'

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

const { createAnswer, updateAnswer, deleteAnswer, fetchAnswers } = await import('../answers')

afterEach(() => {
  fromMock.mockClear()
  Object.values(builder).forEach((fn) => {
    if (typeof fn === 'function' && 'mockClear' in fn) (fn as { mockClear: () => void }).mockClear()
  })
  resolveWith({ data: null, error: null })
})

describe('answers service', () => {
  it('fetchAnswers queries the behavior_answers table ordered by updated_at desc', async () => {
    resolveWith({ data: [{ answer_id: '1' }], error: null })
    const rows = await fetchAnswers()
    expect(fromMock).toHaveBeenCalledWith('behavior_answers')
    expect(builder.order).toHaveBeenCalledWith('updated_at', { ascending: false })
    expect(rows).toEqual([{ answer_id: '1' }])
  })

  it('createAnswer saves a manually-written answer with no story_id/duration/tone, trimmed text and normalized tags', async () => {
    resolveWith({ data: { answer_id: 'new-id' }, error: null })
    await createAnswer(
      {
        interview_question: '  Tell me about a time you led a team.  ',
        star_answer: '  Situation: ...  ',
        tags: ['Leadership', ' leadership ', 'Ownership'],
        notes: '  practice more  ',
      },
      'user-123',
    )
    expect(builder.insert).toHaveBeenCalledWith({
      user_id: 'user-123',
      story_id: null,
      interview_question: 'Tell me about a time you led a team.',
      star_answer: 'Situation: ...',
      tags: ['Leadership', 'Ownership'],
      notes: 'practice more',
      duration: null,
      tone: null,
      prompt_key: null,
    })
  })

  it('createAnswer carries prompt_key through when creating an answer from a guided BQ Questions prompt (V3.2)', async () => {
    resolveWith({ data: { answer_id: 'new-id' }, error: null })
    await createAnswer(
      {
        interview_question: 'Tell me about a time you showed leadership.',
        star_answer: 'Situation: ...',
        tags: ['Leadership'],
        notes: '',
        prompt_key: 'leadership',
      },
      'user-123',
    )
    expect(builder.insert).toHaveBeenCalledWith(expect.objectContaining({ prompt_key: 'leadership' }))
  })

  it('createAnswer still accepts a legacy story_id/duration/tone when explicitly provided (backward compatibility with the earlier generator)', async () => {
    resolveWith({ data: { answer_id: 'new-id' }, error: null })
    await createAnswer(
      {
        story_id: 'story-1',
        interview_question: 'Question?',
        star_answer: 'Answer.',
        tags: [],
        notes: '',
        duration: '1min',
        tone: 'concise',
      },
      'user-123',
    )
    expect(builder.insert).toHaveBeenCalledWith(
      expect.objectContaining({ story_id: 'story-1', duration: '1min', tone: 'concise' }),
    )
  })

  it('updateAnswer only includes fields that were actually provided, and normalizes tags when given', async () => {
    resolveWith({ data: { answer_id: '1' }, error: null })
    await updateAnswer('1', { star_answer: 'Revised answer text.' })
    expect(builder.update).toHaveBeenCalledWith({ star_answer: 'Revised answer text.' })

    await updateAnswer('1', { tags: ['Conflict', 'conflict', 'Challenge'] })
    expect(builder.update).toHaveBeenCalledWith({ tags: ['Conflict', 'Challenge'] })
  })

  it('updateAnswer can edit the interview question and notes too (full edit support for manual answers)', async () => {
    resolveWith({ data: { answer_id: '1' }, error: null })
    await updateAnswer('1', { interview_question: '  Updated question?  ', notes: '  updated notes  ' })
    expect(builder.update).toHaveBeenCalledWith({
      interview_question: 'Updated question?',
      notes: 'updated notes',
    })
  })

  it('deleteAnswer resolves without error on success and throws on a database error', async () => {
    resolveWith({ data: null, error: null })
    await expect(deleteAnswer('answer-1')).resolves.toBeUndefined()

    resolveWith({ data: null, error: { code: '42501', message: 'permission denied' } })
    await expect(deleteAnswer('answer-1')).rejects.toThrow()
  })
})
