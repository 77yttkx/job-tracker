import { describe, expect, it } from 'vitest'
import { buildAnswerByPromptKey } from '../bqPromptMatching'
import type { BehaviorAnswer } from '../../types/interviewPrep'

function makeAnswer(overrides: Partial<BehaviorAnswer>): BehaviorAnswer {
  return {
    answer_id: 'a1',
    user_id: 'u1',
    story_id: null,
    interview_question: 'Question',
    star_answer: 'Answer',
    tags: [],
    notes: '',
    duration: null,
    tone: null,
    prompt_key: null,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

describe('buildAnswerByPromptKey (V3.2 spec section 2: avoid duplicate answers when reopening a prompt)', () => {
  it('maps a prompt_key to its answer', () => {
    const answer = makeAnswer({ answer_id: 'a1', prompt_key: 'leadership' })
    const map = buildAnswerByPromptKey([answer])
    expect(map.get('leadership')).toBe(answer)
  })

  it('excludes answers with a null prompt_key - a manual/custom answer never counts as answering a guided prompt', () => {
    const manual = makeAnswer({ answer_id: 'manual', prompt_key: null })
    const map = buildAnswerByPromptKey([manual])
    expect(map.size).toBe(0)
  })

  it('when two answers share a prompt_key (e.g. legacy/imported data), keeps only the most recently updated one', () => {
    const older = makeAnswer({ answer_id: 'older', prompt_key: 'teamwork', updated_at: '2026-01-01T00:00:00Z' })
    const newer = makeAnswer({ answer_id: 'newer', prompt_key: 'teamwork', updated_at: '2026-02-01T00:00:00Z' })
    const map = buildAnswerByPromptKey([older, newer])
    expect(map.get('teamwork')?.answer_id).toBe('newer')
  })

  it('a custom answer (prompt_key null) coexists with a guided-prompt answer for a similar topic without colliding', () => {
    const guided = makeAnswer({ answer_id: 'guided', prompt_key: 'ownership', tags: ['Ownership'] })
    const custom = makeAnswer({ answer_id: 'custom', prompt_key: null, tags: ['Ownership'] })
    const map = buildAnswerByPromptKey([guided, custom])
    expect(map.size).toBe(1)
    expect(map.get('ownership')?.answer_id).toBe('guided')
  })

  it('returns an empty map for no answers', () => {
    expect(buildAnswerByPromptKey([]).size).toBe(0)
  })
})
