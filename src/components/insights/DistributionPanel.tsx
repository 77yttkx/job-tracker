import type { DistributionRow } from '../../lib/distributions'

interface DistributionPanelProps<T extends string> {
  title: string
  rows: DistributionRow<T>[]
  colorFor: (key: T) => string
}

export function DistributionPanel<T extends string>({ title, rows, colorFor }: DistributionPanelProps<T>) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
      <h2 className="mb-3 text-sm font-semibold text-slate-900 dark:text-slate-100">{title}</h2>
      <ul className="flex flex-col gap-2">
        {rows.map((row) => (
          <li key={row.key} className="flex items-center gap-3">
            <span className="w-24 shrink-0 truncate text-xs font-medium text-slate-600 dark:text-slate-300">
              {row.key}
            </span>
            <span className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
              <span
                className={`block h-full rounded-full ${colorFor(row.key)}`}
                style={{ width: `${Math.min(100, row.percent)}%` }}
              />
            </span>
            <span className="w-16 shrink-0 text-right text-xs tabular-nums text-slate-500 dark:text-slate-400">
              {row.count} ({row.percent.toFixed(0)}%)
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
