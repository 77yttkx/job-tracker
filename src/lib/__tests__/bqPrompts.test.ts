import { describe, expect, it } from 'vitest'
import { BQ_PROMPTS, findBqPrompt } from '../bqPrompts'
import { ANSWER_TAGS } from '../interviewPrepConstants'

describe('BQ_PROMPTS (V3.2 spec section 2: ten guided prompts)', () => {
  it('has exactly ten prompts', () => {
    expect(BQ_PROMPTS).toHaveLength(10)
  })

  it('every prompt key is unique', () => {
    const keys = BQ_PROMPTS.map((p) => p.key)
    expect(new Set(keys).size).toBe(keys.length)
  })

  it('every prompt question is non-empty', () => {
    for (const prompt of BQ_PROMPTS) {
      expect(prompt.question.trim().length).toBeGreaterThan(0)
    }
  })

  it('every prompt tag is one of the existing ANSWER_TAGS values, so a prompt and a saved answer always share the same tag vocabulary', () => {
    for (const prompt of BQ_PROMPTS) {
      expect(ANSWER_TAGS as readonly string[]).toContain(prompt.tag)
    }
  })

  it('every ANSWER_TAGS value has exactly one matching prompt (one prompt per behavioral category, per the spec\'s list)', () => {
    for (const tag of ANSWER_TAGS) {
      const matching = BQ_PROMPTS.filter((p) => p.tag === tag)
      expect(matching, `expected exactly one prompt for tag "${tag}"`).toHaveLength(1)
    }
  })

  it('covers the exact ten questions from the spec, mapped to the exact tags given', () => {
    const byKey = Object.fromEntries(BQ_PROMPTS.map((p) => [p.key, p]))
    expect(byKey.leadership).toMatchObject({ tag: 'Leadership', question: 'Tell me about a time you showed leadership.' })
    expect(byKey.teamwork).toMatchObject({ tag: 'Teamwork' })
    expect(byKey.conflict).toMatchObject({ tag: 'Conflict' })
    expect(byKey.failure).toMatchObject({ tag: 'Failure' })
    expect(byKey.challenge).toMatchObject({ tag: 'Challenge' })
    expect(byKey.ownership).toMatchObject({ tag: 'Ownership' })
    expect(byKey.communication).toMatchObject({ tag: 'Communication' })
    expect(byKey['problem-solving']).toMatchObject({ tag: 'Problem Solving' })
    expect(byKey.adaptability).toMatchObject({ tag: 'Adaptability' })
    expect(byKey['time-management']).toMatchObject({ tag: 'Time Management' })
  })
})

describe('findBqPrompt', () => {
  it('finds a prompt by its key', () => {
    expect(findBqPrompt('leadership')?.question).toBe('Tell me about a time you showed leadership.')
  })

  it('returns undefined for null, undefined, or an unknown key', () => {
    expect(findBqPrompt(null)).toBeUndefined()
    expect(findBqPrompt(undefined)).toBeUndefined()
    expect(findBqPrompt('not-a-real-key')).toBeUndefined()
  })
})
