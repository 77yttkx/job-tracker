import { Bar, BarChart, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { AnalyticsCard } from './AnalyticsCard'
import { useAnalyticsQuery } from '../../../hooks/useAnalyticsQuery'
import { fetchApplicationFunnel } from '../../../services/analytics'
import { STATUS_COLORS, JOB_STATUSES } from '../../../lib/constants'
import type { JobStatus } from '../../../lib/constants'
import { SQL_EXAMPLES } from '../../../lib/sqlExamples'

const KNOWN_STATUSES = new Set<string>(JOB_STATUSES)

function isJobStatus(status: string): status is JobStatus {
  return KNOWN_STATUSES.has(status)
}

/**
 * A. Application Funnel - count of jobs currently at each status, from
 * `analytics_application_funnel()` (COUNT / GROUP BY / ORDER BY).
 */
export function ApplicationFunnelCard() {
  const { data, loading, error, errorDetail, refresh } = useAnalyticsQuery(fetchApplicationFunnel)
  const rows = (data ?? []).map((row) => ({
    ...row,
    label: `${row.job_count}`,
    color: isJobStatus(row.status) ? STATUS_COLORS[row.status].hex : '#94a3b8',
  }))
  const total = rows.reduce((sum, row) => sum + row.job_count, 0)

  return (
    <AnalyticsCard
      title="Application Funnel"
      explanation="How many of your applications currently sit at each status."
      loading={loading}
      error={error}
      errorDetail={errorDetail}
      onRetry={refresh}
      isEmpty={total === 0}
      emptyTitle="No applications yet"
      emptyDescription="Add a job to see your funnel."
      sql={SQL_EXAMPLES.applicationFunnel}
    >
      <div className="h-72 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} layout="vertical" margin={{ top: 4, right: 40, bottom: 4, left: 4 }}>
            <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
            <YAxis type="category" dataKey="status" width={88} tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
            <Tooltip cursor={{ fill: 'rgba(148, 163, 184, 0.12)' }} />
            <Bar dataKey="job_count" radius={[0, 4, 4, 0]} barSize={16} isAnimationActive={false}>
              {rows.map((row) => (
                <Cell key={row.status} fill={row.color} />
              ))}
              <LabelList dataKey="label" position="right" className="fill-slate-600 dark:fill-slate-300" fontSize={11} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </AnalyticsCard>
  )
}
