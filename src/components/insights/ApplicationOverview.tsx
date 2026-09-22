import { Bar, BarChart, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { STATUS_COLORS } from '../../lib/constants'
import type { JobStatus } from '../../lib/constants'
import { statusDistribution } from '../../lib/distributions'
import type { Job } from '../../types/job'

interface OverviewRow {
  key: JobStatus
  count: number
  percent: number
  label: string
}

interface TooltipPayloadItem {
  payload?: OverviewRow
}

/**
 * The first Insights panel: an accurate snapshot built only from each
 * job's *current* `status` (via statusDistribution - src/lib/distributions.ts),
 * with no inference about prior stages a job might have passed through.
 * This replaced the Sankey/funnel panel (V2.5.2), which inferred that a
 * job in a later stage had passed through every earlier one - something
 * this app cannot actually know, since the database stores no
 * status-transition history.
 */
export function ApplicationOverview({ jobs }: { jobs: Job[] }) {
  const total = jobs.length
  const rows: OverviewRow[] = statusDistribution(jobs).map((row) => ({
    ...row,
    label: `${row.count} (${row.percent.toFixed(0)}%)`,
  }))

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
      <h2 className="mb-4 text-sm font-semibold text-slate-900 dark:text-slate-100">Application overview</h2>

      <div className="mb-5 inline-flex flex-col rounded-md border border-slate-100 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-950">
        <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Total applications</p>
        <p className="mt-1 text-3xl font-semibold tabular-nums">{total}</p>
      </div>

      <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">
        Every application counted once, by its current status only - this is not an inferred history
        of stages a job may have passed through.
      </p>

      <div className="h-80 w-full sm:h-96">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} layout="vertical" margin={{ top: 4, right: 56, bottom: 4, left: 4 }}>
            <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
            <YAxis
              type="category"
              dataKey="key"
              width={92}
              tick={{ fontSize: 12 }}
              tickLine={false}
              axisLine={false}
            />
            <Tooltip
              cursor={{ fill: 'rgba(148, 163, 184, 0.12)' }}
              formatter={(_value: number, _name: string, item: TooltipPayloadItem) => {
                const row = item.payload
                return [row ? row.label : '', row ? row.key : '']
              }}
            />
            <Bar dataKey="count" radius={[0, 4, 4, 0]} barSize={18} isAnimationActive={false}>
              {rows.map((row) => (
                <Cell key={row.key} fill={STATUS_COLORS[row.key].hex} />
              ))}
              <LabelList dataKey="label" position="right" className="fill-slate-600 dark:fill-slate-300" fontSize={11} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
