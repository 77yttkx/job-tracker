import { Pencil, ListChecks } from 'lucide-react'
import { formatDate } from '../../lib/utils'
import { DURATION_OPTIONS, TONE_OPTIONS } from '../../lib/interviewPrepConstants'
import { findBqPrompt } from '../../lib/bqPrompts'
import { ConfirmDeleteButton } from './ConfirmDeleteButton'
import type { BehaviorAnswer } from '../../types/interviewPrep'

const DURATION_LABELS = Object.fromEntries(DURATION_OPTIONS.map((o) => [o.value, o.label]))
const TONE_LABELS = Object.fromEntries(TONE_OPTIONS.map((o) => [o.value, o.label]))

export function AnswerCard({
  answer,
  onEdit,
  onDelete,
}: {
  answer: BehaviorAnswer
  onEdit: () => void
  onDelete: () => Promise<void>
}) {
  // duration/tone are legacy fields from the earlier Gemini-based
  // generator (removed in V3.1 - see README.md's "Interview Prep"
  // section) - null on every answer saved through the New Answer form,
  // so these badges only ever appear on an answer saved before that
  // change.
  const hasLegacyDurationOrTone = Boolean(answer.duration || answer.tone)
  // V3.2: a small provenance note when this answer was created from a
  // guided BQ Questions prompt (src/lib/bqPrompts.ts) - findBqPrompt
  // returns undefined for a null/unknown/legacy key, so this simply
  // doesn't render for a manually-created answer.
  const fromPrompt = findBqPrompt(answer.prompt_key)

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-start justify-between gap-2">
        <p className="min-w-0 truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
          {answer.interview_question}
        </p>
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            aria-label="Edit answer"
            onClick={onEdit}
            className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
          >
            <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
          <ConfirmDeleteButton label="answer" onConfirm={onDelete} />
        </div>
      </div>

      {(answer.tags.length > 0 || hasLegacyDurationOrTone) && (
        <div className="flex flex-wrap gap-1.5">
          {answer.tags.map((tag) => (
            <span
              key={tag}
              className="rounded-full bg-sky-100 px-2 py-0.5 text-xs font-medium text-sky-700 dark:bg-sky-900/40 dark:text-sky-300"
            >
              {tag}
            </span>
          ))}
          {answer.duration && (
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
              {DURATION_LABELS[answer.duration] ?? answer.duration}
            </span>
          )}
          {answer.tone && (
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
              {TONE_LABELS[answer.tone] ?? answer.tone}
            </span>
          )}
        </div>
      )}

      <p className="line-clamp-4 whitespace-pre-wrap text-sm text-slate-600 dark:text-slate-300">{answer.star_answer}</p>

      <p className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-slate-100 pt-3 text-xs text-slate-400 dark:border-slate-800">
        <span>Updated {formatDate(answer.updated_at)}</span>
        {fromPrompt && (
          <span className="flex items-center gap-1 text-slate-400 dark:text-slate-500">
            <ListChecks className="h-3 w-3" aria-hidden="true" />
            From BQ Questions
          </span>
        )}
      </p>
    </div>
  )
}
