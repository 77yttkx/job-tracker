import { useMemo, useState } from 'react'
import { Plus, Search, X } from 'lucide-react'
import { InterviewPrepShell } from '../../../components/interviewPrep/InterviewPrepShell'
import { AnswerCard } from '../../../components/interviewPrep/AnswerCard'
import { AnswerModal } from '../../../components/interviewPrep/AnswerModal'
import { EmptyState, ErrorState, LoadingState } from '../../../components/ui/DataStates'
import { ANSWER_TAGS } from '../../../lib/interviewPrepConstants'
import { filterAnswers } from '../../../lib/answerFilters'
import { classNames } from '../../../lib/utils'
import type { useAnswers } from '../../../hooks/useAnswers'
import type { BehaviorAnswer } from '../../../types/interviewPrep'

/**
 * "My Answers" (V3.2 - renamed/relocated from the V3.1 top-level "Answer
 * Library", now nested under Behavioral (BQ) alongside BQ Questions and
 * Prepare for a Job - see BQTabs.tsx). Still a manual BQ answer
 * organizer: users write their own answers (elsewhere, or directly here,
 * or via a BQ Questions prompt - see BQQuestionsPage.tsx) and save, tag,
 * search, and review them. No AI generation step; never calls any
 * external AI provider.
 */
export function MyAnswersPage({ answersState }: { answersState: ReturnType<typeof useAnswers> }) {
  const { answers, loading, error, errorDetail, refresh, addAnswer, editAnswer, removeAnswer } = answersState

  const [search, setSearch] = useState('')
  const [activeTags, setActiveTags] = useState<Set<string>>(new Set())
  const [modalOpen, setModalOpen] = useState(false)
  const [modalAnswer, setModalAnswer] = useState<BehaviorAnswer | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  // Tag filter chips: every preset answer tag, plus any custom tag
  // actually used by one of this user's saved answers - same pattern as
  // Story Library's tag filter (StoryLibraryPage.tsx).
  const allTagOptions = useMemo(() => {
    const seen = new Map<string, string>()
    for (const tag of ANSWER_TAGS) seen.set(tag.toLowerCase(), tag)
    for (const answer of answers) {
      for (const tag of answer.tags) {
        if (!seen.has(tag.toLowerCase())) seen.set(tag.toLowerCase(), tag)
      }
    }
    return [...seen.values()].sort((a, b) => a.localeCompare(b))
  }, [answers])

  const filtered = useMemo(() => filterAnswers(answers, search, activeTags), [answers, search, activeTags])

  function toggleTag(tag: string) {
    setActiveTags((prev) => {
      const next = new Set(prev)
      if (next.has(tag)) next.delete(tag)
      else next.add(tag)
      return next
    })
  }

  function openNewAnswerModal() {
    setModalAnswer(null)
    setModalOpen(true)
  }

  function openEditModal(answer: BehaviorAnswer) {
    setModalAnswer(answer)
    setModalOpen(true)
  }

  async function handleDelete(answerId: string) {
    setDeleteError(null)
    try {
      await removeAnswer(answerId)
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Failed to delete this answer.')
    }
  }

  return (
    <InterviewPrepShell>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Your saved behavioral interview answers - private to you.
        </p>
        <button
          type="button"
          onClick={openNewAnswerModal}
          className="flex items-center gap-1.5 rounded-md bg-sky-600 px-3 py-2 text-sm font-medium text-white hover:bg-sky-700"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          New Answer
        </button>
      </div>

      <div className="flex flex-col gap-3">
        <div className="relative max-w-sm">
          <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" aria-hidden="true" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by question, answer, or notes..."
            aria-label="Search saved answers"
            className="w-full rounded-md border border-slate-300 bg-white py-2 pl-8 pr-3 text-sm text-slate-900 shadow-sm focus:border-sky-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
          />
        </div>

        {allTagOptions.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5">
            {allTagOptions.map((tag) => {
              const active = activeTags.has(tag)
              return (
                <button
                  key={tag}
                  type="button"
                  aria-pressed={active}
                  onClick={() => toggleTag(tag)}
                  className={classNames(
                    'rounded-full border px-2.5 py-1 text-xs font-medium transition-colors',
                    active
                      ? 'border-sky-600 bg-sky-600 text-white dark:border-sky-500 dark:bg-sky-500'
                      : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300 dark:hover:bg-slate-800',
                  )}
                >
                  {tag}
                </button>
              )
            })}
            {activeTags.size > 0 && (
              <button
                type="button"
                onClick={() => setActiveTags(new Set())}
                className="flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
              >
                <X className="h-3 w-3" aria-hidden="true" />
                Clear tag filters
              </button>
            )}
          </div>
        )}
      </div>

      {deleteError && (
        <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-300">
          {deleteError}
        </p>
      )}

      {loading && answers.length === 0 ? (
        <LoadingState label="Loading answers..." />
      ) : error ? (
        <ErrorState message={error} detail={errorDetail} onRetry={refresh} />
      ) : answers.length === 0 ? (
        <EmptyState
          title="No saved answers yet"
          description="Write a behavioral interview answer - your own, or one you drafted elsewhere - and save it here, or start from a BQ Questions prompt."
          action={
            <button
              type="button"
              onClick={openNewAnswerModal}
              className="mt-2 flex items-center gap-1.5 rounded-md bg-sky-600 px-3 py-2 text-sm font-medium text-white hover:bg-sky-700"
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              New Answer
            </button>
          }
        />
      ) : filtered.length === 0 ? (
        <EmptyState title="No matching answers" description="Try a different search term or clear your tag filters." />
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((answer) => (
            <AnswerCard
              key={answer.answer_id}
              answer={answer}
              onEdit={() => openEditModal(answer)}
              onDelete={() => handleDelete(answer.answer_id)}
            />
          ))}
        </div>
      )}

      <AnswerModal
        open={modalOpen}
        answer={modalAnswer}
        onClose={() => setModalOpen(false)}
        addAnswer={addAnswer}
        editAnswer={editAnswer}
      />
    </InterviewPrepShell>
  )
}
