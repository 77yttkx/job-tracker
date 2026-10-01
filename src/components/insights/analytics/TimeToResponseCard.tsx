import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { AnalyticsCard } from './AnalyticsCard'
import { useAnalyticsQuery } from '../../../hooks/useAnalyticsQuery'
import { fetchResponseTimeDistribution, fetchStillWaiting, fetchTimeToResponseSummary } from '../../../services/analytics'
import { formatDays, formatMedianResponseTime, formatResponseSampleCaption } from '../../../lib/analyticsFormat'

/** Every bucket the backend can return, in display order - zero-filled client-side for a continuous chart (same convention as Application Trend). */
const BUCKET_LABELS = ['0-3 days', '4-7 days', '8-14 days', '15-30 days', '30+ days'] as const

/**
 * Time to Response - how long it takes applications to get a first
 * meaningful employer response, from the three RPCs in
 * supabase-v3_4-time-to-response.sql.
 *
 * The median and distribution are anchored on `jobs.applied_date` (the
 * user's own record of when they applied), using only the earliest
 * qualifying response event on or after that date - never inferred from
 * current status. "Still Waiting" is the deliberate exception: it is
 * based on each job's *current* status (status = 'Applied'), so it also
 * correctly covers jobs with no recorded event history at all (e.g.
 * anything created before this analysis existed). See that migration's
 * header comment for the full reasoning.
 */
export function TimeToResponseCard() {
  const summary = useAnalyticsQuery(fetchTimeToResponseSummary)
  const distribution = useAnalyticsQuery(fetchResponseTimeDistribution)
  const stillWaiting = useAnalyticsQuery(fetchStillWaiting)

  const loading = summary.loading || distribution.loading || stillWaiting.loading
  const error = summary.error ?? distribution.error ?? stillWaiting.error
  const errorDetail = summary.errorDetail ?? distribution.errorDetail ?? stillWaiting.errorDetail

  const refresh = async () => {
    await Promise.all([summary.refresh(), distribution.refresh(), stillWaiting.refresh()])
  }

  const sampleSize = summary.data?.sample_size ?? 0
  const waitingCount = stillWaiting.data?.waiting_count ?? 0
  const isEmpty = !loading && !error && sampleSize === 0 && waitingCount === 0

  const countsByBucket = new Map((distribution.data ?? []).map((row) => [row.bucket, row.job_count]))
  const rows = BUCKET_LABELS.map((bucket) => ({ bucket, job_count: countsByBucket.get(bucket) ?? 0 }))

  return (
    <AnalyticsCard
      title="Time to Response"
      explanation="How long it takes to hear back after applying, measured from each job's applied date to its first employer response."
      loading={loading}
      error={error}
      errorDetail={errorDetail}
      onRetry={refresh}
      isEmpty={isEmpty}
      emptyTitle="No response data yet"
      emptyDescription="Once applications pick up a status like OA or an interview round, response times will appear here."
    >
      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="rounded-md border border-slate-200 p-3 dark:border-slate-700">
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400">Median time to first response</div>
          <div className="mt-1 text-lg font-semibold text-slate-900 dark:text-slate-100">
            {formatMedianResponseTime(summary.data?.median_days ?? null, sampleSize)}
          </div>
          {sampleSize > 0 && (
            <div className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{formatResponseSampleCaption(sampleSize)}</div>
          )}
        </div>
        <div className="rounded-md border border-slate-200 p-3 dark:border-slate-700">
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400">Still waiting</div>
          <div className="mt-1 text-lg font-semibold text-slate-900 dark:text-slate-100">
            {waitingCount} application{waitingCount === 1 ? '' : 's'}
          </div>
          {waitingCount > 0 && (
            <div className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              Longest current wait: {formatDays(stillWaiting.data?.longest_wait_days ?? null)}
            </div>
          )}
        </div>
      </div>

      {sampleSize > 0 && (
        <div className="h-56 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={rows} margin={{ top: 4, right: 8, bottom: 4, left: 4 }}>
              <XAxis dataKey="bucket" tick={{ fontSize: 11 }} tickLine={false} />
              <YAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} width={32} />
              <Tooltip cursor={{ fill: 'rgba(148, 163, 184, 0.12)' }} />
              <Bar dataKey="job_count" name="Applications" fill="#0ea5e9" radius={[3, 3, 0, 0]} isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </AnalyticsCard>
  )
}
