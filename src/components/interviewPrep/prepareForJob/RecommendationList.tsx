import { Sparkles } from 'lucide-react'
import { explainMatch, type Recommendation } from '../../../lib/bqRecommendations'
import type { BehaviorAnswer, PersonalStory } from '../../../types/interviewPrep'

/**
 * Recommended answers/stories for the currently-selected competency tags
 * (V3.2 spec section 4C). Purely a read of already-saved data, ranked by
 * recommendAnswers/recommendStories (bqRecommendations.ts) - never
 * fabricates or modifies an answer. `onStartAnswer` is only used by the
 * empty state's suggested-prompt action (see PrepareForJobPage.tsx).
 */
export function RecommendationList({
  answerRecs,
  storyRecs,
  onEditAnswer,
  emptyStateAction,
}: {
  answerRecs: Recommendation<BehaviorAnswer>[]
  storyRecs: Recommendation<PersonalStory>[]
  onEditAnswer: (answer: BehaviorAnswer) => void
  emptyStateAction: React.ReactNode
}) {
  if (answerRecs.length === 0 && storyRecs.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-slate-300 px-4 py-10 text-center dark:border-slate-700">
        <p className="text-sm font-medium text-slate-700 dark:text-slate-200">No matching answers or stories yet</p>
        <p className="max-w-sm text-sm text-slate-500 dark:text-slate-400">
          None of your saved answers or stories carry these competency tags yet.
        </p>
        {emptyStateAction}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {answerRecs.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">Recommended answers</p>
          {answerRecs.map(({ item, matchedTags, isExactMatch }) => (
            <button
              key={item.answer_id}
              type="button"
              onClick={() => onEditAnswer(item)}
              className="flex flex-col gap-1 rounded-lg border border-slate-200 bg-white p-3 text-left text-sm shadow-sm hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:hover:bg-slate-800"
            >
              <span className="flex items-center gap-1.5 font-medium text-slate-900 dark:text-slate-100">
                {isExactMatch && <Sparkles className="h-3.5 w-3.5 text-sky-500" aria-hidden="true" />}
                {item.interview_question}
              </span>
              <span className="text-xs text-slate-500 dark:text-slate-400">{explainMatch(matchedTags)}</span>
            </button>
          ))}
        </div>
      )}

      {storyRecs.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">Related stories</p>
          {storyRecs.map(({ item, matchedTags, isExactMatch }) => (
            <div
              key={item.story_id}
              className="flex flex-col gap-1 rounded-lg border border-slate-200 bg-white p-3 text-sm dark:border-slate-800 dark:bg-slate-900"
            >
              <span className="flex items-center gap-1.5 font-medium text-slate-900 dark:text-slate-100">
                {isExactMatch && <Sparkles className="h-3.5 w-3.5 text-sky-500" aria-hidden="true" />}
                {item.title}
              </span>
              <span className="text-xs text-slate-500 dark:text-slate-400">{explainMatch(matchedTags)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
