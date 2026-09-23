import { describe, expect, it } from 'vitest'
import { explainMatch, recommendAnswers, recommendStories } from '../bqRecommendations'
import type { BehaviorAnswer, PersonalStory } from '../../types/interviewPrep'

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

function makeStory(overrides: Partial<PersonalStory>): PersonalStory {
  return {
    story_id: 's1',
    user_id: 'u1',
    title: 'Story',
    raw_story: 'Once upon a time',
    tags: [],
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

describe('recommendAnswers (V3.2 spec section 4C)', () => {
  const exactMatch = makeAnswer({
    answer_id: 'exact',
    tags: ['Ownership', 'Problem Solving'],
    updated_at: '2026-01-01T00:00:00Z',
  })
  const partialMatch = makeAnswer({
    answer_id: 'partial',
    tags: ['Ownership'],
    updated_at: '2026-01-02T00:00:00Z',
  })
  const noMatch = makeAnswer({ answer_id: 'none', tags: ['Communication'] })

  it('returns an empty array when no tags are selected', () => {
    expect(recommendAnswers([exactMatch, partialMatch], [])).toEqual([])
  })

  it('excludes answers with zero matching tags', () => {
    const recs = recommendAnswers([noMatch], ['Ownership', 'Problem Solving'])
    expect(recs).toEqual([])
  })

  it('ranks an exact (full) tag match above a partial match, even when the partial match is more recently updated', () => {
    const recs = recommendAnswers([partialMatch, exactMatch], ['Ownership', 'Problem Solving'])
    expect(recs.map((r) => r.item.answer_id)).toEqual(['exact', 'partial'])
    expect(recs[0].isExactMatch).toBe(true)
    expect(recs[1].isExactMatch).toBe(false)
  })

  it('ties on match count are broken by most-recently-updated first', () => {
    const older = makeAnswer({ answer_id: 'older', tags: ['Leadership'], updated_at: '2026-01-01T00:00:00Z' })
    const newer = makeAnswer({ answer_id: 'newer', tags: ['Leadership'], updated_at: '2026-02-01T00:00:00Z' })
    const recs = recommendAnswers([older, newer], ['Leadership'])
    expect(recs.map((r) => r.item.answer_id)).toEqual(['newer', 'older'])
  })

  it('matchedTags only lists the tags the answer actually carries', () => {
    const recs = recommendAnswers([partialMatch], ['Ownership', 'Problem Solving'])
    expect(recs[0].matchedTags).toEqual(['Ownership'])
  })
})

describe('recommendStories', () => {
  it('ranks and filters stories the same way as answers', () => {
    const matching = makeStory({ story_id: 'match', tags: ['Leadership'] })
    const notMatching = makeStory({ story_id: 'no-match', tags: ['Failure'] })
    const recs = recommendStories([matching, notMatching], ['Leadership'])
    expect(recs.map((r) => r.item.story_id)).toEqual(['match'])
  })

  it('returns an empty array when no tags are selected', () => {
    expect(recommendStories([makeStory({ tags: ['Leadership'] })], [])).toEqual([])
  })
})

describe('explainMatch', () => {
  it('formats a single matched tag', () => {
    expect(explainMatch(['Ownership'])).toBe('Matches Ownership from this job description.')
  })

  it('formats two matched tags with "and", matching the spec\'s example format', () => {
    expect(explainMatch(['Ownership', 'Problem Solving'])).toBe(
      'Matches Ownership and Problem Solving from this job description.',
    )
  })

  it('formats three or more matched tags with a comma list and a trailing "and"', () => {
    expect(explainMatch(['Ownership', 'Problem Solving', 'Leadership'])).toBe(
      'Matches Ownership, Problem Solving and Leadership from this job description.',
    )
  })

  it('returns an empty string for no matched tags', () => {
    expect(explainMatch([])).toBe('')
  })
})
