import { AnalyticsCard } from './AnalyticsCard'
import { useAnalyticsQuery } from '../../../hooks/useAnalyticsQuery'
import { fetchApplicationFunnelProgression } from '../../../services/analytics'
import { formatPercent } from '../../../lib/analyticsFormat'

/**
 * Application Funnel (V3.5) - how far applications have EVER
 * historically progressed, not where they sit today (that's Status
 * Distribution, elsewhere on Insights). Built from
 * `analytics_application_funnel_progression()`
 * (supabase-v3_5-application-funnel.sql), which is event-based
 * (`public.job_status_events`) rather than a `jobs.status` snapshot.
 *
 * A job can and should count toward several stages at once - e.g.
 * Applied -> OA -> 1st Round -> Rejected counts as Applications +
 * Employer Response + Interview, even though it's currently Rejected
 * and never reached Final Round or Offer. Stages are cumulative
 * ("reached this stage or later"), never mutually exclusive buckets.
 *
 * The cohort (the "N applications" the percentages are out of) is only
 * jobs with a FULLY recorded event history - see the migration's header
 * comment for why older, partially-tracked applications can't safely be
 * included without risking an understated/misleading conversion rate.
 * This is why the card leads with a plain-language caption naming that
 * cohort instead of silently treating "all applications" as 100%.
 */
export function ApplicationFunnelCard() {
  const { data, loading, error, errorDetail, refresh } = useAnalyticsQuery(fetchApplicationFunnelProgression)

  const cohortTotal = data?.cohort_total ?? 0
  const responseCount = data?.response_count ?? 0
  const interviewCount = data?.interview_count ?? 0
  const finalRoundCount = data?.final_round_count ?? 0
  const offerCount = data?.offer_count ?? 0

  // `previous` is each stage's immediate predecessor, used for the
  // "from previous" conversion rate. Employer Response's previous stage
  // is Applications itself (previous === cohortTotal), which makes its
  // "from previous" and "overall" percentages always identical - showing
  // both would just repeat the same number twice. `showSingleRate` marks
  // that one case so the UI collapses it into a single "X% of
  // applications" line instead. Interview/Final Round/Offer still show
  // both rates, since their previous stage is a strict subset of the
  // cohort and the two percentages are genuinely different numbers.
  const stages = [
    { label: 'Applications', count: cohortTotal, previous: null as number | null, showSingleRate: false },
    { label: 'Employer Response', count: responseCount, previous: cohortTotal, showSingleRate: true },
    { label: 'Interview', count: interviewCount, previous: responseCount, showSingleRate: false },
    { label: 'Final Round', count: finalRoundCount, previous: interviewCount, showSingleRate: false },
    { label: 'Offer', count: offerCount, previous: finalRoundCount, showSingleRate: false },
  ]

  return (
    <AnalyticsCard
      title="Application Funnel"
      explanation="How far your applications have historically progressed through the hiring process - not just where they stand today."
      loading={loading}
      error={error}
      errorDetail={errorDetail}
      onRetry={refresh}
      isEmpty={cohortTotal === 0}
      emptyTitle="No fully-tracked applications yet"
      emptyDescription="This funnel needs applications with complete recorded history. Add a new job, or wait for status changes on existing ones, to start building it."
    >
      <p className="mb-4 text-xs text-slate-500 dark:text-slate-400">
        Based on {cohortTotal} application{cohortTotal === 1 ? '' : 's'} with complete event history. Older
        applications without complete recorded history aren&apos;t included.
      </p>
      <div className="flex flex-col">
        {stages.map((stage, index) => (
          <div key={stage.label}>
            {index > 0 && (
              <div className="py-1 pl-1 text-slate-300 dark:text-slate-600" aria-hidden="true">
                ↓
              </div>
            )}
            <div className="flex items-center justify-between gap-3 rounded-md border border-slate-200 px-3 py-2 dark:border-slate-700">
              <span className="text-sm font-medium text-slate-700 dark:text-slate-200">{stage.label}</span>
              <div className="flex items-baseline gap-2 text-right">
                <span className="text-sm font-semibold tabular-nums text-slate-900 dark:text-slate-100">
                  {stage.count}
                </span>
                {stage.previous === null ? (
                  <span className="text-xs tabular-nums text-slate-500 dark:text-slate-400">
                    {formatPercent(stage.count, cohortTotal)}
                  </span>
                ) : stage.showSingleRate ? (
                  <span className="text-xs tabular-nums text-slate-500 dark:text-slate-400">
                    {formatPercent(stage.count, cohortTotal)} of applications
                  </span>
                ) : (
                  <span className="text-xs tabular-nums text-slate-500 dark:text-slate-400">
                    {formatPercent(stage.count, stage.previous)} from previous · {formatPercent(stage.count, cohortTotal)}{' '}
                    overall
                  </span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </AnalyticsCard>
  )
}
