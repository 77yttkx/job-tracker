/**
 * Pure validation for the New/Edit Answer form
 * (src/components/interviewPrep/AnswerModal.tsx). Kept separate from the
 * component so it's directly unit-testable, per this codebase's
 * convention of separating logic from JSX (see src/lib/distributions.ts /
 * DistributionPanel.tsx, and src/lib/dateField.ts / DateField.tsx).
 */
export interface AnswerFormInput {
  interview_question: string
  star_answer: string
  tags: string[]
}

export interface AnswerFormErrors {
  question?: string
  answer?: string
  tags?: string
}

/**
 * Validates the three required fields of a manually-written answer: a
 * non-blank question, a non-blank answer, and at least one tag. Notes are
 * always optional and never validated here. Returns an errors object with
 * only the keys that actually failed - an empty object means the form is
 * valid.
 */
export function validateAnswerForm(input: AnswerFormInput): AnswerFormErrors {
  const errors: AnswerFormErrors = {}
  if (!input.interview_question.trim()) errors.question = 'Enter the interview question.'
  if (!input.star_answer.trim()) errors.answer = 'Enter your answer.'
  if (input.tags.length === 0) errors.tags = 'Select at least one tag.'
  return errors
}
