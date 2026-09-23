import { describe, expect, it } from 'vitest'
import { filterAnswers, matchesAnswerSearch, matchesAnswerTags } from '../answerFilters'

const conflictAnswer = {
  interview_question: 'Tell me about a conflict with a coworker.',
  star_answer: 'Situation: we disagreed on the API design.',
  tags: ['Conflict', 'Communication'],
  notes: '',
}
const leadershipAnswer = {
  interview_question: 'Describe a time you led a project.',
  star_answer: 'Situation: I owned the migration end to end.',
  tags: ['Leadership', 'Ownership'],
  notes: 'Remember to mention the rollback plan.',
}

describe('matchesAnswerSearch', () => {
  it('matches on the interview question, case-insensitively', () => {
    expect(matchesAnswerSearch(conflictAnswer, 'CONFLICT')).toBe(true)
  })

  it('matches on the answer text', () => {
    expect(matchesAnswerSearch(conflictAnswer, 'API design')).toBe(true)
  })

  it('matches on notes (V3.2: search now covers question, answer, and notes)', () => {
    expect(matchesAnswerSearch(leadershipAnswer, 'rollback plan')).toBe(true)
  })

  it('an empty or whitespace-only term always matches', () => {
    expect(matchesAnswerSearch(conflictAnswer, '')).toBe(true)
    expect(matchesAnswerSearch(conflictAnswer, '   ')).toBe(true)
  })

  it('returns false when none of question/answer/notes contain the term', () => {
    expect(matchesAnswerSearch(conflictAnswer, 'salary negotiation')).toBe(false)
  })
})

describe('matchesAnswerTags', () => {
  it('an empty active-tags set always matches', () => {
    expect(matchesAnswerTags(conflictAnswer, new Set())).toBe(true)
  })

  it('matches when the answer has every selected tag (AND, not OR)', () => {
    expect(matchesAnswerTags(conflictAnswer, new Set(['Conflict']))).toBe(true)
    expect(matchesAnswerTags(conflictAnswer, new Set(['Conflict', 'Communication']))).toBe(true)
  })

  it('does not match when the answer is missing even one selected tag', () => {
    expect(matchesAnswerTags(conflictAnswer, new Set(['Conflict', 'Leadership']))).toBe(false)
  })

  it('matches case-insensitively', () => {
    expect(matchesAnswerTags(conflictAnswer, new Set(['conflict']))).toBe(true)
  })
})

describe('filterAnswers', () => {
  const answers = [conflictAnswer, leadershipAnswer]

  it('combines search and tag filters together', () => {
    expect(filterAnswers(answers, 'project', new Set(['Leadership']))).toEqual([leadershipAnswer])
  })

  it('returns everything when search and tags are both empty', () => {
    expect(filterAnswers(answers, '', new Set())).toEqual(answers)
  })

  it('returns nothing when the search matches but the tag filter excludes it', () => {
    expect(filterAnswers(answers, 'conflict', new Set(['Leadership']))).toEqual([])
  })
})
