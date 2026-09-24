import { useState } from 'react'
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { AnalyticsCard } from './AnalyticsCard'
import { useAnalyticsQuery } from '../../../hooks/useAnalyticsQuery'
import { fetchApplicationTrend } from '../../../services/analytics'
import { SQL_EXAMPLES } from '../../../lib/sqlExamples'
import { formatPeriodLabel } from '../../../lib/analyticsFormat'
import type { TrendGranularity } from '../../../types/analytics'
import { classNames } from '../../../lib/utils'

/**
 * D. Application Trend - applications grouped by week or month, using
 * `applied_date`, from `analytics_application_trend(granularity)`.
 */
export function ApplicationTrendCard() {
  const [granularity, setGranularity] = useState<TrendGranularity>('month')
  const { data, loading, error, errorDetail, refresh } = useAnalyticsQuery(
    () => fetchApplicationTrend(granularity),
    [granularity],
  )
  const rows = (data ?? []).map((row) => ({
    ...row,
    label: formatPeriodLabel(row.period_start, granularity),
  }))

  return (
    <AnalyticsCard
      title="Application Trend"
      explanation="How your applications are spread out over time, using each job's applied date."
      loading={loading}
      error={error}
      errorDetail={errorDetail}
      onRetry={refresh}
      isEmpty={rows.length === 0}
      emptyTitle="No dated applications yet"
      emptyDescription="Applications need an applied date to appear in this trend."
      sql={SQL_EXAMPLES.applicationTrend}
    >
      <div className="mb-3 flex items-center gap-1 text-xs">
        {(['week', 'month'] as const).map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => setGranularity(option)}
            aria-pressed={granularity === option}
            className={classNames(
              'rounded-md border px-2 py-1 font-medium capitalize',
              granularity === option
                ? 'border-sky-500 bg-sky-50 text-sky-700 dark:border-sky-500 dark:bg-sky-900/30 dark:text-sky-300'
                : 'border-slate-200 text-slate-500 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800',
            )}
          >
            By {option}
          </button>
        ))}
      </div>
      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={rows} margin={{ top: 4, right: 16, bottom: 4, left: 4 }}>
            <XAxis dataKey="label" tick={{ fontSize: 11 }} tickLine={false} />
            <YAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} width={32} />
            <Tooltip />
            <Line
              type="monotone"
              dataKey="job_count"
              name="Applications"
              stroke="#0ea5e9"
              strokeWidth={2}
              dot={{ r: 3 }}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </AnalyticsCard>
  )
}
