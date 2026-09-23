import { useMemo, useState } from 'react'
import { InterviewPrepShell } from '../../../components/interviewPrep/InterviewPrepShell'
import { BQQuestionCard } from '../../../components/interviewPrep/BQQuestionCard'
import { AnswerModal } from '../../../components/interviewPrep/AnswerModal'
import { ErrorState, LoadingState } from '../../../components/ui/DataStates'
import { BQ_PROMPTS, type BQPrompt } from '../../../lib/bqPrompts'
import { buildAnswerByPromptKey } from '../../../lib/bqPromptMatching'
import type { useAnswers } from '../../../hooks/useAnswers'
import type { BehaviorAnswer } from '../../../types/interviewPrep'

/**
 * "BQ Questions" - a guided collection of the ten common behavioral
 * interview prompts (V3.2 spec section 2). Each prompt maps to one
 * ANSWER_TAGS value; clicking an unanswered prompt opens the same
 * AnswerModal used everywhere else in Interview Prep, pre-filled with
 * that question and tag (still fully editable before saving), and
 * clicking an already-answered prompt opens that same saved answer for
 * editing - matched by `prompt_key`, never by re-matching question text,
 * so editing the question later doesn't break the link and a user's own
 * custom-worded answer to the same topic (created via My Answers,
 * prompt_key null) never gets treated as "answering" this prompt.
 */
export function BQQuestionsPage({ answersState }: { answersState: ReturnType<typeof useAnswers> }) {
  const { answers, loading, error, errorDetail, refresh, addAnswer, editAnswer } = answersState

  const [modalOpen, setModalOpen] = useState(false)
  const [modalPrompt, setModalPrompt] = useState<BQPrompt | null>(null)
  const [modalAnswer, setModalAnswer] = useState<BehaviorAnswer | null>(null)

  // Most recently updated answer per prompt_key - see
  // buildAnswerByPromptKey's own doc comment (src/lib/bqPromptMatching.ts)
  // for why this stays correct even if a duplicate ever exists.
  const answerByPromptKey = useMemo(() => buildAnswerByPromptKey(answers), [answers])

  function openForPrompt(prompt: BQPrompt) {
    const existing = answerByPromptKey.get(prompt.key) ?? null
    setModalPrompt(prompt)
    setModalAnswer(existing)
    setModalOpen(true)
  }

  return (
    <InterviewPrepShell>
      <p className="text-sm text-slate-500 dark:text-slate-400">
        Ten common behavioral interview questions. Write your own answer for each - reopening a prompt you've
        already answered edits that same answer, it never creates a duplicate.
      </p>

      {loading && answers.length === 0 ? (
        <LoadingState label="Loading your answers..." />
      ) : error ? (
        <ErrorState message={error} detail={errorDetail} onRetry={refresh} />
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {BQ_PROMPTS.map((prompt) => (
            <BQQuestionCard
              key={prompt.key}
              prompt={prompt}
              existingAnswer={answerByPromptKey.get(prompt.key) ?? null}
              onWriteAnswer={() => openForPrompt(prompt)}
              onEditAnswer={() => openForPrompt(prompt)}
            />
          ))}
        </div>
      )}

      <AnswerModal
        open={modalOpen}
        answer={modalAnswer}
        prefill={
          modalPrompt && !modalAnswer
            ? { interview_question: modalPrompt.question, tags: [modalPrompt.tag], prompt_key: modalPrompt.key }
            : null
        }
        onClose={() => setModalOpen(false)}
        addAnswer={addAnswer}
        editAnswer={editAnswer}
      />
    </InterviewPrepShell>
  )
}
