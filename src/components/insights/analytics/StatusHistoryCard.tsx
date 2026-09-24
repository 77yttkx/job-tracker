import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Info } from 'lucide-react'
import { AnalyticsCard } from './AnalyticsCard'
import { useAnalyticsQuery } from '../../../hooks/useAnalyticsQuery'
import {
  fetchAvgStageDurations,
  fetchStageReachCounts,
  fetchStatusTransitionsByWeek,
} from '../../../services/analytics'
import { SQL_EXAMPLES } from '../../../lib/sqlExamples'
import { formatAvgDays, formatWeekLabel } from '../../../lib/analyticsFormat'

/**
 * E. Status History - built entirely from job_status_events, which only
 * exists from supabase-v3_3-sql-analytics.sql forward. This card
 * combines three RPCs (weekly transition activity, stage-reach counts,
 * and average time-to-stage) and is explicit, everywhere it shows a
 * number, that the underlying history is real recorded events - not an
 * inferred/reconstructed past.
 */
export function StatusHistoryCard() {
  const transitions = useAnalyticsQuery(fetchStatusTransitionsByWeek)
  const reach = useAnalyticsQuery(fetchStageReachCounts)
  const durations = useAnalyticsQuery(fetchAvgStageDurations)

  const loading = transitions.loading || reach.loading || durations.loading
  const error = transitions.error ?? reach.error ?? durations.error
  const errorDetail = transitions.errorDetail ?? reach.errorDetail ?? durations.errorDetail

  function retryAll() {
    void transitions.refresh()
    void reach.refresh()
    void durations.refresh()
  }

  const transitionRows = (transitions.data ?? []).map((row) => ({
    ...row,
    label: formatWeekLabel(row.week_start),
  }))
  const hasAnyHistory = transitionRows.length > 0

  return (
    <AnalyticsCard
      title="Status History"
      explanation="How your applications have moved between stages, tracked from real recorded status changes."
      loading={loading}
      error={error}
      errorDetail={errorDetail}
      onRetry={retryAll}
      isEmpty={!hasAnyHistory}
      emptyTitle="No tracked status changes yet"
      emptyDescription="Status history begins when tracking is enabled - create or update a job to start building this timeline."
      sql={SQL_EXAMPLES.statusHistory}
    >
      <div className="mb-3 flex items-start gap-2 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-900/20 dark:text-amber-300">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        <p>Status history begins when tracking is enabled; older job changes are not reconstructed.</p>
      </div>

      <div className="mb-4 h-56 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={transitionRows} margin={{ top: 4, right: 8, bottom: 4, left: 4 }}>
            <XAxis dataKey="label" tick={{ fontSize: 10 }} tickLine={false} />
            <YAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} width={28} />
            <Tooltip />
            <Bar dataKey="transition_count" name="Transitions" fill="#8b5cf6" radius={[3, 3, 0, 0]} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-md border border-slate-100 p-3 dark:border-slate-800">
          <p className="mb-2 text-xs font-medium text-slate-600 dark:text-slate-300">Jobs that reached each stage</p>
          <ul className="flex flex-col gap-1">
            {(reach.data ?? []).map((row) => (
              <li key={row.stage} className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                <span>{row.stage}</span>
                <span className="tabular-nums text-slate-700 dark:text-slate-200">{row.reached_count}</span>
              </li>
            ))}
            {(reach.data ?? []).length === 0 && (
              <li className="text-xs text-slate-400 dark:text-slate-500">Not enough tracked history yet</li>
            )}
          </ul>
        </div>
        <div className="rounded-md border border-slate-100 p-3 dark:border-slate-800">
          <p className="mb-2 text-xs font-medium text-slate-600 dark:text-slate-300">Average time to reach a stage</p>
          <ul className="flex flex-col gap-1">
            {(durations.data ?? []).map((row) => (
              <li key={row.stage} className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                <span>{row.stage}</span>
                <span className="tabular-nums text-slate-700 dark:text-slate-200">
                  {formatAvgDays(row.avg_days, row.sample_size)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </AnalyticsCard>
  )
}
