import { CheckCircle2, Pencil, PlusCircle } from 'lucide-react'
import type { BQPrompt } from '../../lib/bqPrompts'
import type { BehaviorAnswer } from '../../types/interviewPrep'

/**
 * One guided "BQ Questions" prompt card (V3.2 spec section 2). Shows the
 * prompt's question and tag, and clearly distinguishes an already-
 * answered prompt (a saved answer whose `prompt_key` matches this
 * prompt's key - see BQQuestionsPage.tsx) from an unanswered one, with
 * the matching action to write or edit directly.
 */
export function BQQuestionCard({
  prompt,
  existingAnswer,
  onWriteAnswer,
  onEditAnswer,
}: {
  prompt: BQPrompt
  /** The user's existing answer for this prompt, if any (matched by prompt_key). */
  existingAnswer: BehaviorAnswer | null
  onWriteAnswer: () => void
  onEditAnswer: () => void
}) {
  const answered = existingAnswer !== null

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-start justify-between gap-2">
        <span className="rounded-full bg-sky-100 px-2 py-0.5 text-xs font-medium text-sky-700 dark:bg-sky-900/40 dark:text-sky-300">
          {prompt.tag}
        </span>
        {answered && (
          <span className="flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
            Answered
          </span>
        )}
      </div>

      <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{prompt.question}</p>

      {answered && existingAnswer && (
        <p className="line-clamp-2 whitespace-pre-wrap text-sm text-slate-500 dark:text-slate-400">
          {existingAnswer.star_answer}
        </p>
      )}

      <div>
        {answered ? (
          <button
            type="button"
            onClick={onEditAnswer}
            className="flex items-center gap-1.5 rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
            Edit your answer
          </button>
        ) : (
          <button
            type="button"
            onClick={onWriteAnswer}
            className="flex items-center gap-1.5 rounded-md bg-sky-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-sky-700"
          >
            <PlusCircle className="h-3.5 w-3.5" aria-hidden="true" />
            Write an answer
          </button>
        )}
      </div>
    </div>
  )
}
