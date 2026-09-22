import { useMemo, useState } from 'react'
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { classNames } from '../../lib/utils'
import { buildDayBuckets, buildMonthBuckets, buildWeekBuckets, countByTimeWindow } from '../../lib/timeBuckets'
import type { Job } from '../../types/job'

type Granularity = 'day' | 'week' | 'month'

const GRANULARITY_OPTIONS: Array<{ value: Granularity; label: string }> = [
  { value: 'day', label: 'Day' },
  { value: 'week', label: 'Week' },
  { value: 'month', label: 'Month' },
]

export function TimeSummary({ jobs }: { jobs: Job[] }) {
  const [granularity, setGranularity] = useState<Granularity>('day')
  const now = useMemo(() => new Date(), [])
  const counts = useMemo(() => countByTimeWindow(jobs, now), [jobs, now])

  const chartData = useMemo(() => {
    const buckets =
      granularity === 'day'
        ? buildDayBuckets(jobs, now, 30)
        : granularity === 'week'
          ? buildWeekBuckets(jobs, now, 12)
          : buildMonthBuckets(jobs, now, 12)
    return buckets.map((b) => ({ label: b.label, applications: b.count }))
  }, [jobs, now, granularity])

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Application activity</h2>
        <div className="flex rounded-md border border-slate-300 p-0.5 dark:border-slate-700" role="group" aria-label="Chart granularity">
          {GRANULARITY_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              aria-pressed={granularity === opt.value}
              onClick={() => setGranularity(opt.value)}
              className={classNames(
                'rounded px-2.5 py-1 text-xs font-medium transition-colors',
                granularity === opt.value
                  ? 'bg-sky-600 text-white'
                  : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800',
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mb-4 grid grid-cols-3 gap-3">
        <StatTile label="Today" value={counts.today} />
        <StatTile label="This week" value={counts.thisWeek} />
        <StatTile label="This month" value={counts.thisMonth} />
      </div>

      <p className="mb-2 text-xs text-slate-500 dark:text-slate-400">
        Based on applied date. Jobs with no applied date are excluded from this chart and the counts above.
      </p>

      <div className="h-56 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 8, right: 12, bottom: 0, left: -20 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-slate-200 dark:stroke-slate-800" />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 11 }}
              interval="preserveStartEnd"
              className="fill-slate-500 dark:fill-slate-400"
            />
            <YAxis allowDecimals={false} tick={{ fontSize: 11 }} className="fill-slate-500 dark:fill-slate-400" width={32} />
            <Tooltip formatter={(value: number) => [`${value} application${value === 1 ? '' : 's'}`, '']} />
            <Line type="monotone" dataKey="applications" stroke="#0ea5e9" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

function StatTile({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md bg-slate-50 px-3 py-2.5 dark:bg-slate-800/60">
      <p className="text-xs font-medium text-slate-500 dark:text-slate-400">{label}</p>
      <p className="mt-0.5 text-lg font-semibold tabular-nums">{value}</p>
    </div>
  )
}
