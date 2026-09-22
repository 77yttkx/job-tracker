import { X } from 'lucide-react'
import { JOB_STATUSES, SPONSORSHIP_VALUES } from '../../lib/constants'
import type { JobStatus, Sponsorship } from '../../lib/constants'
import { classNames } from '../../lib/utils'
import { emptyInsightsFilters, hasActiveFilters } from '../../lib/insightsFilters'
import type { InsightsFilters } from '../../lib/insightsFilters'

export function InsightsFilterBar({
  filters,
  onChange,
}: {
  filters: InsightsFilters
  onChange: (filters: InsightsFilters) => void
}) {
  function toggleStatus(status: JobStatus) {
    const next = new Set(filters.statuses)
    if (next.has(status)) next.delete(status)
    else next.add(status)
    onChange({ ...filters, statuses: next })
  }

  function toggleSponsorship(sponsorship: Sponsorship) {
    const next = new Set(filters.sponsorships)
    if (next.has(sponsorship)) next.delete(sponsorship)
    else next.add(sponsorship)
    onChange({ ...filters, sponsorships: next })
  }

  const active = hasActiveFilters(filters)

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900 sm:flex-row sm:flex-wrap sm:items-end">
      <div className="min-w-[180px] flex-1">
        <label htmlFor="insights-company" className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">
          Company
        </label>
        <input
          id="insights-company"
          type="text"
          value={filters.company}
          onChange={(e) => onChange({ ...filters, company: e.target.value })}
          placeholder="Filter by company..."
          className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
        />
      </div>

      <div>
        <span className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">Status</span>
        <div className="flex max-w-md flex-wrap gap-1">
          {JOB_STATUSES.map((status) => (
            <button
              key={status}
              type="button"
              aria-pressed={filters.statuses.has(status)}
              onClick={() => toggleStatus(status)}
              className={classNames(
                'rounded-full border px-2 py-1 text-xs font-medium transition-colors',
                filters.statuses.has(status)
                  ? 'border-sky-500 bg-sky-50 text-sky-700 dark:border-sky-400 dark:bg-sky-900/40 dark:text-sky-300'
                  : 'border-slate-300 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800',
              )}
            >
              {status}
            </button>
          ))}
        </div>
      </div>

      <div>
        <span className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">Sponsorship</span>
        <div className="flex flex-wrap gap-1">
          {SPONSORSHIP_VALUES.map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={filters.sponsorships.has(value)}
              onClick={() => toggleSponsorship(value)}
              className={classNames(
                'rounded-full border px-2 py-1 text-xs font-medium transition-colors',
                filters.sponsorships.has(value)
                  ? 'border-sky-500 bg-sky-50 text-sky-700 dark:border-sky-400 dark:bg-sky-900/40 dark:text-sky-300'
                  : 'border-slate-300 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800',
              )}
            >
              {value}
            </button>
          ))}
        </div>
      </div>

      {active && (
        <button
          type="button"
          onClick={() => onChange(emptyInsightsFilters())}
          className="flex items-center gap-1 rounded-md px-2 py-2 text-xs font-medium text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
        >
          <X className="h-3.5 w-3.5" aria-hidden="true" />
          Clear filters
        </button>
      )}
    </div>
  )
}
