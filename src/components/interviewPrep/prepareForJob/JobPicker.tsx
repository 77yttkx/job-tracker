import { useMemo, useState } from 'react'
import { Search } from 'lucide-react'
import { classNames, formatDate } from '../../../lib/utils'
import { STATUS_COLORS } from '../../../lib/constants'
import type { Job } from '../../../types/job'

/**
 * "Select a job" step of Prepare for a Job (V3.2 spec section 4A).
 * `jobs` is always the signed-in user's own RLS-scoped jobs array,
 * passed down from the same single `useJobs(userId)` call App.tsx
 * already makes for Insights/Table (see PrepareForJobPage.tsx) - this
 * component fetches nothing itself and never sees another user's data.
 * Company search/filter narrows a long list; selecting a job hands its
 * full record back to the parent, which reads only its `jd` field for
 * keyword analysis (see jdKeywords.ts).
 */
export function JobPicker({
  jobs,
  selectedJobId,
  onSelect,
}: {
  jobs: Job[]
  selectedJobId: string | null
  onSelect: (job: Job) => void
}) {
  const [companyFilter, setCompanyFilter] = useState('')

  const filtered = useMemo(() => {
    const term = companyFilter.trim().toLowerCase()
    if (!term) return jobs
    return jobs.filter((job) => (job.company ?? '').toLowerCase().includes(term))
  }, [jobs, companyFilter])

  return (
    <div className="flex flex-col gap-3">
      <div className="relative max-w-sm">
        <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" aria-hidden="true" />
        <input
          type="text"
          value={companyFilter}
          onChange={(e) => setCompanyFilter(e.target.value)}
          placeholder="Filter by company..."
          aria-label="Filter your jobs by company"
          className="w-full rounded-md border border-slate-300 bg-white py-2 pl-8 pr-3 text-sm text-slate-900 shadow-sm focus:border-sky-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
        />
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-slate-500 dark:text-slate-400">
          {jobs.length === 0
            ? 'You have no saved job applications yet - add one in the Job Tracker first.'
            : 'No jobs match that company filter.'}
        </p>
      ) : (
        <ul className="flex max-h-72 flex-col gap-1 overflow-y-auto rounded-md border border-slate-200 p-1 dark:border-slate-800">
          {filtered.map((job) => {
            const selected = job.job_id === selectedJobId
            const statusColor = STATUS_COLORS[job.status]
            return (
              <li key={job.job_id}>
                <button
                  type="button"
                  onClick={() => onSelect(job)}
                  aria-pressed={selected}
                  className={classNames(
                    'flex w-full items-center justify-between gap-3 rounded-md px-3 py-2 text-left text-sm transition-colors',
                    selected
                      ? 'bg-sky-50 dark:bg-sky-900/30'
                      : 'hover:bg-slate-50 dark:hover:bg-slate-800',
                  )}
                >
                  <span className="min-w-0">
                    <span className="block truncate font-medium text-slate-900 dark:text-slate-100">
                      {job.company || 'Unknown company'}
                      {job.role ? ` - ${job.role}` : ''}
                    </span>
                    <span className="block truncate text-xs text-slate-500 dark:text-slate-400">
                      {job.applied_date ? formatDate(job.applied_date) : 'No applied date'}
                      {job.jd ? '' : ' - no job description saved'}
                    </span>
                  </span>
                  <span
                    className={classNames(
                      'shrink-0 rounded-full px-2 py-0.5 text-xs font-medium',
                      statusColor.bg,
                      statusColor.text,
                    )}
                  >
                    {job.status}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
