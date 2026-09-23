import { useMemo, useState } from 'react'
import { Plus } from 'lucide-react'
import { InterviewPrepShell } from '../../../components/interviewPrep/InterviewPrepShell'
import { JobPicker } from '../../../components/interviewPrep/prepareForJob/JobPicker'
import { CompetencyChips } from '../../../components/interviewPrep/prepareForJob/CompetencyChips'
import { RecommendationList } from '../../../components/interviewPrep/prepareForJob/RecommendationList'
import { AnswerModal } from '../../../components/interviewPrep/AnswerModal'
import { EmptyState } from '../../../components/ui/DataStates'
import { detectCompetencies, type Competency } from '../../../lib/jdKeywords'
import { recommendAnswers, recommendStories } from '../../../lib/bqRecommendations'
import { BQ_PROMPTS } from '../../../lib/bqPrompts'
import type { useJobs } from '../../../hooks/useJobs'
import type { useAnswers } from '../../../hooks/useAnswers'
import type { useStories } from '../../../hooks/useStories'
import type { Job } from '../../../types/job'
import type { BehaviorAnswer } from '../../../types/interviewPrep'

/**
 * "Prepare for a Job" (V3.2 spec section 4). The one deliberate, narrow
 * exception to Interview Prep's earlier "never reads public.jobs" rule:
 * a user explicitly picks one of their own Job Tracker entries here, and
 * this page reads only that job's `jd` text to suggest BQ-relevant
 * competencies via local keyword matching (jdKeywords.ts) - never an AI
 * call. See README.md's "Interview Prep" section for the full security
 * rationale.
 *
 * `jobs` is the same RLS-scoped array Insights/Table already read from
 * the single `useJobs(userId)` call in App.tsx - this page receives it as
 * a prop (same pattern as InsightsPage/TablePage) rather than fetching
 * its own copy, so there is still only ever one jobs fetch in the whole
 * app (see src/__tests__/sharedJobsSource.test.ts /
 * dataScopingV26.test.ts) and no job is ever read until the user
 * explicitly selects one here.
 */
export function PrepareForJobPage({
  jobsState,
  answersState,
  storiesState,
}: {
  jobsState: ReturnType<typeof useJobs>
  answersState: ReturnType<typeof useAnswers>
  storiesState: ReturnType<typeof useStories>
}) {
  const { jobs } = jobsState
  const { answers, addAnswer, editAnswer } = answersState
  const { stories } = storiesState

  const [selectedJob, setSelectedJob] = useState<Job | null>(null)
  const [selectedCompetencies, setSelectedCompetencies] = useState<Competency[]>([])
  const [modalOpen, setModalOpen] = useState(false)
  const [modalAnswer, setModalAnswer] = useState<BehaviorAnswer | null>(null)

  const detected = useMemo(() => detectCompetencies(selectedJob?.jd), [selectedJob])

  function handleSelectJob(job: Job) {
    setSelectedJob(job)
    setSelectedCompetencies(detectCompetencies(job.jd).map((d) => d.competency))
  }

  function removeCompetency(competency: Competency) {
    setSelectedCompetencies((prev) => prev.filter((c) => c !== competency))
  }

  function addCompetency(competency: Competency) {
    setSelectedCompetencies((prev) => (prev.includes(competency) ? prev : [...prev, competency]))
  }

  const answerRecs = useMemo(() => recommendAnswers(answers, selectedCompetencies), [answers, selectedCompetencies])
  const storyRecs = useMemo(() => recommendStories(stories, selectedCompetencies), [stories, selectedCompetencies])

  function openEditAnswer(answer: BehaviorAnswer) {
    setModalAnswer(answer)
    setModalOpen(true)
  }

  // Empty-state CTA (spec 4C): suggest a BQ Questions prompt matching the
  // first selected competency, preselecting that prompt's tag. Never
  // fabricates a STAR response - just opens the same blank New Answer
  // form used everywhere else, pre-filled with a question and tag.
  const suggestedPrompt = useMemo(() => {
    const firstTag = selectedCompetencies[0]
    if (!firstTag) return null
    return BQ_PROMPTS.find((p) => p.tag === firstTag) ?? null
  }, [selectedCompetencies])

  function openSuggestedAnswer() {
    if (!suggestedPrompt) return
    setModalAnswer(null)
    setModalOpen(true)
  }

  return (
    <InterviewPrepShell>
      <p className="text-sm text-slate-500 dark:text-slate-400">
        Pick one of your own job applications. This page reads only that job's saved description, matches it
        against a fixed list of BQ-relevant keywords locally, and suggests your saved answers/stories that fit -
        nothing is sent anywhere, and no AI model is used.
      </p>

      <div className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200">1. Select a job</h2>
        <JobPicker jobs={jobs} selectedJobId={selectedJob?.job_id ?? null} onSelect={handleSelectJob} />
      </div>

      {selectedJob && (
        <div className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200">2. Review detected competencies</h2>
          {selectedJob.jd ? (
            <CompetencyChips
              detected={detected}
              selected={selectedCompetencies}
              onRemove={removeCompetency}
              onAdd={addCompetency}
            />
          ) : (
            <EmptyState
              title="This job has no saved description"
              description="Add a job description to it in the Job Tracker, or add a competency manually below."
            />
          )}
        </div>
      )}

      {selectedJob && (
        <div className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200">3. Recommended prep</h2>
          {selectedCompetencies.length === 0 ? (
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Select at least one competency above to see matching answers and stories.
            </p>
          ) : (
            <RecommendationList
              answerRecs={answerRecs}
              storyRecs={storyRecs}
              onEditAnswer={openEditAnswer}
              emptyStateAction={
                suggestedPrompt && (
                  <button
                    type="button"
                    onClick={openSuggestedAnswer}
                    className="mt-2 flex items-center gap-1.5 rounded-md bg-sky-600 px-3 py-2 text-sm font-medium text-white hover:bg-sky-700"
                  >
                    <Plus className="h-4 w-4" aria-hidden="true" />
                    Write an answer for "{suggestedPrompt.question}"
                  </button>
                )
              }
            />
          )}
        </div>
      )}

      <AnswerModal
        open={modalOpen}
        answer={modalAnswer}
        prefill={
          !modalAnswer && suggestedPrompt
            ? { interview_question: suggestedPrompt.question, tags: [suggestedPrompt.tag], prompt_key: suggestedPrompt.key }
            : null
        }
        onClose={() => setModalOpen(false)}
        addAnswer={addAnswer}
        editAnswer={editAnswer}
      />
    </InterviewPrepShell>
  )
}
