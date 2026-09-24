import { LayoutDashboard, DatabaseZap } from 'lucide-react'
import { classNames } from '../../lib/utils'

export type InsightsTab = 'overview' | 'sql-lab'

const TABS: { id: InsightsTab; label: string; icon: typeof LayoutDashboard }[] = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'sql-lab', label: 'SQL Analytics Lab', icon: DatabaseZap },
]

/**
 * Local (non-routed) tab strip switching between the existing Insights
 * overview and the new SQL Analytics Lab section. Kept as component
 * state rather than a route, since Insights has no sub-routes today and
 * both sections read from the same already-loaded jobsState/RPC data.
 */
export function InsightsTabs({ active, onChange }: { active: InsightsTab; onChange: (tab: InsightsTab) => void }) {
  return (
    <nav aria-label="Insights sections" className="flex flex-wrap gap-1 border-b border-slate-200 dark:border-slate-800">
      {TABS.map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          type="button"
          onClick={() => onChange(id)}
          aria-current={active === id ? 'page' : undefined}
          className={classNames(
            'flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-500',
            active === id
              ? 'border-sky-600 text-sky-700 dark:border-sky-400 dark:text-sky-300'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200',
          )}
        >
          <Icon className="h-4 w-4" aria-hidden="true" />
          {label}
        </button>
      ))}
    </nav>
  )
}
