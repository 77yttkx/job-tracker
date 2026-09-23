import { describe, expect, it } from 'vitest'
import { validateAnswerForm } from '../answerValidation'

describe('validateAnswerForm', () => {
  it('returns no errors for a fully valid manual answer', () => {
    expect(
      validateAnswerForm({
        interview_question: 'Tell me about a time you led a team.',
        star_answer: 'Situation: ... Task: ... Action: ... Result: ...',
        tags: ['Leadership'],
      }),
    ).toEqual({})
  })

  it('requires a non-blank interview question', () => {
    const errors = validateAnswerForm({ interview_question: '   ', star_answer: 'Answer.', tags: ['Leadership'] })
    expect(errors.question).toBeDefined()
    expect(errors.answer).toBeUndefined()
    expect(errors.tags).toBeUndefined()
  })

  it('requires a non-blank answer', () => {
    const errors = validateAnswerForm({ interview_question: 'Question?', star_answer: '  ', tags: ['Leadership'] })
    expect(errors.answer).toBeDefined()
  })

  it('requires at least one tag', () => {
    const errors = validateAnswerForm({ interview_question: 'Question?', star_answer: 'Answer.', tags: [] })
    expect(errors.tags).toBeDefined()
  })

  it('reports all three errors at once when everything is missing', () => {
    const errors = validateAnswerForm({ interview_question: '', star_answer: '', tags: [] })
    expect(Object.keys(errors).sort()).toEqual(['answer', 'question', 'tags'])
  })

  it('does not require notes (notes are not part of this validator at all)', () => {
    const errors = validateAnswerForm({ interview_question: 'Q?', star_answer: 'A.', tags: ['Ownership'] })
    expect(errors).toEqual({})
  })
})
