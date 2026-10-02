import { AnalyticsCard } from './AnalyticsCard'
import { useAnalyticsQuery } from '../../../hooks/useAnalyticsQuery'
import { fetchSourcePerformance } from '../../../services/analytics'
import { formatTrackedRate, formatTrackedRateCaption } from '../../../lib/analyticsFormat'
import { DEFAULT_APPLICATION_SOURCE } from '../../../lib/constants'

/**
 * Application Source Performance (V3.6) - "How do my tracked application
 * channels compare, descriptively?" Built from
 * `analytics_source_performance()` (supabase-v3_6-application-source.sql).
 * Strictly descriptive: no causal claims, no significance testing, no
 * confidence intervals, no predictive modeling, no A/B testing, no
 * AI-generated recommendations, and - unlike a typical analytics
 * leaderboard - deliberately NO ranking and NO "Best"/"Worst" labeling.
 * Small groups are never hidden behind a minimum-sample threshold; every
 * row always shows its tracked-count context alongside its rate.
 *
 * Two different counts, kept visibly distinct on purpose:
 *   - Applications: every application ever recorded for that source.
 *   - Response / Interview: percentages computed ONLY over the subset of
 *     that source's applications with COMPLETE recorded event history
 *     (the same from_status-is-null "fully tracked" cohort V3.5's
 *     Application Funnel uses) - a job without full history can't be
 *     safely counted as having responded or not. The card always shows
 *     "<rate>% — <n> of <tracked> fully tracked applications" rather
 *     than collapsing this into "<rate>% (n=<tracked>)", which would
 *     silently suggest a source only ever had <tracked> applications
 *     when it may have had many more.
 *
 * Unknown is always sorted last, regardless of its count - it's a
 * cleanup signal (how much source data still needs fixing, now that
 * Source is inline-editable from the Table) rather than a channel to
 * compare against the others, so it never competes for the top slot.
 */
export function ApplicationSourcePerformanceCard() {
  const { data, loading, error, errorDetail, refresh } = useAnalyticsQuery(fetchSourcePerformance)

  const rows = data ?? []
  // Known sources sorted by total Applications descending; Unknown is
  // always placed last regardless of its count.
  const sorted = [...rows].sort((a, b) => {
    const aUnknown = a.application_source === DEFAULT_APPLICATION_SOURCE
    const bUnknown = b.application_source === DEFAULT_APPLICATION_SOURCE
    if (aUnknown !== bUnknown) return aUnknown ? 1 : -1
    return b.application_count - a.application_count
  })

  return (
    <AnalyticsCard
      title="Application Source Performance"
      explanation="How your tracked application channels compare, purely descriptively."
      loading={loading}
      error={error}
      errorDetail={errorDetail}
      onRetry={refresh}
      isEmpty={sorted.length === 0}
      emptyTitle="No applications yet"
      emptyDescription="Add a job and choose its Application Source (in the Add/Edit modal, or inline from the Table) to start seeing channel performance here."
    >
      <p className="mb-4 text-xs text-slate-500 dark:text-slate-400">
        Applications counts every application recorded for that source. Response and Interview are only computed
        from applications with complete recorded event history, since one without full history can&apos;t be safely
        counted either way.
      </p>
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="text-left text-xs font-semibold text-slate-500 dark:text-slate-400">
              <th scope="col" className="py-1.5 pr-3">
                Source
              </th>
              <th scope="col" className="py-1.5 pr-3 text-right">
                Applications
              </th>
              <th scope="col" className="py-1.5 pr-3 text-right">
                Response
              </th>
              <th scope="col" className="py-1.5 text-right">
                Interview
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {sorted.map((row) => (
              <tr key={row.application_source}>
                <td className="py-2 pr-3 font-medium text-slate-700 dark:text-slate-200">{row.application_source}</td>
                <td className="py-2 pr-3 text-right tabular-nums text-slate-900 dark:text-slate-100">
                  {row.application_count}
                </td>
                <td className="py-2 pr-3 text-right">
                  <div className="tabular-nums text-slate-900 dark:text-slate-100">
                    {formatTrackedRate(row.response_count, row.tracked_count)}
                  </div>
                  <div className="text-[11px] leading-tight text-slate-500 dark:text-slate-400">
                    {formatTrackedRateCaption(row.response_count, row.tracked_count)}
                  </div>
                </td>
                <td className="py-2 text-right">
                  <div className="tabular-nums text-slate-900 dark:text-slate-100">
                    {formatTrackedRate(row.interview_count, row.tracked_count)}
                  </div>
                  <div className="text-[11px] leading-tight text-slate-500 dark:text-slate-400">
                    {formatTrackedRateCaption(row.interview_count, row.tracked_count)}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AnalyticsCard>
  )
}
