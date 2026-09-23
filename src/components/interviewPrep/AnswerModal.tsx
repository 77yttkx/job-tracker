import { useEffect, useId, useRef, useState } from 'react'
import { Loader2, X } from 'lucide-react'
import { ANSWER_TAGS, MAX_ANSWER_LENGTH, MAX_NOTES_LENGTH, MAX_QUESTION_LENGTH } from '../../lib/interviewPrepConstants'
import { validateAnswerForm } from '../../lib/answerValidation'
import { TagPicker } from './TagPicker'
import type { AnswerUpdate, BehaviorAnswer, NewAnswer } from '../../types/interviewPrep'

interface AnswerFormState {
  interview_question: string
  star_answer: string
  tags: string[]
  notes: string
}

const EMPTY_FORM: AnswerFormState = { interview_question: '', star_answer: '', tags: [], notes: '' }

/**
 * Create/edit a saved behavioral-question answer (V3.1: Interview Prep is
 * a manual answer organizer, not an AI generator - see README.md's
 * "Interview Prep" section). Users write the question and answer
 * themselves (typically drafted elsewhere, e.g. ChatGPT/Claude, then
 * pasted in) and choose at least one tag; nothing here ever calls an
 * external AI provider.
 *
 * `answer === null` means "New Answer" (create mode); a non-null answer
 * means "Edit Answer" - both share this one form/validation, per the
 * existing reusable-modal convention in this codebase (see JobModal.tsx
 * for the same add/edit-in-one-component pattern).
 *
 * V3.2: in create mode, an optional `prefill` pre-fills the question and
 * tag(s) from a guided BQ Questions prompt template
 * (src/lib/bqPrompts.ts, src/pages/interviewPrep/bq/BQQuestionsPage.tsx)
 * while leaving every field - including the pre-filled ones - editable
 * before saving (spec section 2). `prefill.prompt_key` is carried through
 * to the created answer's `prompt_key` column so reopening the same
 * prompt edits this answer instead of creating a duplicate; it is never
 * applied in edit mode (an existing answer's prompt_key, if any, is
 * already set and this form never changes it).
 */
export function AnswerModal({
  open,
  answer,
  prefill = null,
  onClose,
  addAnswer,
  editAnswer,
}: {
  open: boolean
  /** null = create a new answer; a BehaviorAnswer = editing that one. */
  answer: BehaviorAnswer | null
  /** Create-mode only: pre-fills the question/tags from a guided BQ prompt. Ignored when `answer` is non-null. */
  prefill?: { interview_question: string; tags: string[]; prompt_key: string } | null
  onClose: () => void
  addAnswer: (input: NewAnswer) => Promise<BehaviorAnswer>
  editAnswer: (answerId: string, updates: AnswerUpdate) => Promise<BehaviorAnswer>
}) {
  const isEdit = answer !== null
  const [form, setForm] = useState<AnswerFormState>(EMPTY_FORM)
  const [errors, setErrors] = useState<{ question?: string; answer?: string; tags?: string }>({})
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const firstFieldRef = useRef<HTMLTextAreaElement>(null)
  const titleId = useId()

  useEffect(() => {
    if (!open) return
    if (answer) {
      setForm({
        interview_question: answer.interview_question,
        star_answer: answer.star_answer,
        tags: answer.tags,
        notes: answer.notes,
      })
    } else if (prefill) {
      setForm({ interview_question: prefill.interview_question, star_answer: '', tags: prefill.tags, notes: '' })
    } else {
      setForm(EMPTY_FORM)
    }
    setErrors({})
    setSubmitError(null)
  }, [open, answer, prefill])

  useEffect(() => {
    if (open) firstFieldRef.current?.focus()
  }, [open])

  useEffect(() => {
    if (!open) return
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [open, onClose])

  if (!open) return null

  function validate(): boolean {
    const next = validateAnswerForm(form)
    setErrors(next)
    return Object.keys(next).length === 0
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (saving) return
    if (!validate()) return
    setSaving(true)
    setSubmitError(null)
    try {
      if (isEdit) {
        await editAnswer(answer!.answer_id, {
          interview_question: form.interview_question,
          star_answer: form.star_answer,
          tags: form.tags,
          notes: form.notes,
        })
      } else {
        await addAnswer({
          interview_question: form.interview_question,
          star_answer: form.star_answer,
          tags: form.tags,
          notes: form.notes,
          prompt_key: prefill?.prompt_key ?? null,
        })
      }
      onClose()
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Failed to save this answer.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 p-0 sm:items-center sm:p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-xl bg-white shadow-xl dark:bg-slate-900 sm:rounded-xl"
      >
        <form onSubmit={handleSubmit} noValidate>
          <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-slate-800">
            <h2 id={titleId} className="text-base font-semibold">
              {isEdit ? 'Edit Answer' : 'New Answer'}
            </h2>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close dialog"
              className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800"
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>

          <div className="flex flex-col gap-4 px-5 py-4">
            <div>
              <label htmlFor="answer-question" className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">
                Interview question
              </label>
              <textarea
                ref={firstFieldRef}
                id="answer-question"
                rows={2}
                maxLength={MAX_QUESTION_LENGTH}
                placeholder="Tell me about a time you had to deal with conflict on a team."
                value={form.interview_question}
                onChange={(e) => setForm((f) => ({ ...f, interview_question: e.target.value }))}
                aria-invalid={Boolean(errors.question) || undefined}
                aria-describedby={errors.question ? 'answer-question-error' : undefined}
                className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-sky-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              />
              {errors.question && (
                <p id="answer-question-error" role="alert" className="mt-1 text-xs text-red-600 dark:text-red-400">
                  {errors.question}
                </p>
              )}
            </div>

            <div>
              <label htmlFor="answer-text" className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">
                Answer
              </label>
              <textarea
                id="answer-text"
                rows={10}
                maxLength={MAX_ANSWER_LENGTH}
                placeholder="Write or paste your answer here - Situation, Task, Action, Result works well, but any structure is fine."
                value={form.star_answer}
                onChange={(e) => setForm((f) => ({ ...f, star_answer: e.target.value }))}
                aria-invalid={Boolean(errors.answer) || undefined}
                aria-describedby={errors.answer ? 'answer-text-error' : undefined}
                className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-sky-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              />
              {errors.answer && (
                <p id="answer-text-error" role="alert" className="mt-1 text-xs text-red-600 dark:text-red-400">
                  {errors.answer}
                </p>
              )}
            </div>

            <div>
              <span className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">
                Tags <span className="font-normal text-slate-400">(select at least one)</span>
              </span>
              <TagPicker
                tags={form.tags}
                onChange={(tags) => setForm((f) => ({ ...f, tags }))}
                presetTags={ANSWER_TAGS}
              />
              {errors.tags && (
                <p role="alert" className="mt-1 text-xs text-red-600 dark:text-red-400">
                  {errors.tags}
                </p>
              )}
            </div>

            <div>
              <label htmlFor="answer-notes" className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">
                Notes <span className="font-normal text-slate-400">(optional)</span>
              </label>
              <textarea
                id="answer-notes"
                rows={3}
                maxLength={MAX_NOTES_LENGTH}
                placeholder="Delivery reminders, follow-up points, anything else you want to remember."
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-sky-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              />
            </div>

            {submitError && (
              <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-300">
                {submitError}
              </p>
            )}
          </div>

          <div className="flex justify-end gap-2 border-t border-slate-200 px-5 py-4 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-1.5 rounded-md bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-700 disabled:opacity-60"
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
              {isEdit ? 'Save changes' : 'Save answer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
