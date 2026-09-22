import { useMemo, useState } from 'react'
import { Pencil, Search, Upload, X } from 'lucide-react'
import { JOB_STATUSES, SPONSORSHIP_VALUES } from '../lib/constants'
import type { JobStatus, Sponsorship } from '../lib/constants'
import { formatDate, classNames } from '../lib/utils'
import { applyJobFilters } from '../lib/insightsFilters'
import { StatusBadge } from '../components/jobs/StatusBadge'
import { SponsorshipBadge } from '../components/jobs/SponsorshipBadge'
import { DeleteButton } from '../components/jobs/DeleteButton'
import { ImportJobsModal } from '../components/jobs/ImportJobsModal'
import { ExportCsvButton } from '../components/ui/ExportCsvButton'
import { EmptyState, ErrorState, LoadingState } from '../components/ui/DataStates'
import { DateField } from '../components/ui/DateField'
import type { useJobs } from '../hooks/useJobs'
import type { Job } from '../types/job'

type SortKey = 'applied_date' | 'updated_at'
type SortDir = 'asc' | 'desc'

interface Filters {
  search: string
  company: string
  statuses: Set<JobStatus>
  sponsorships: Set<Sponsorship>
  dateFrom: string
  dateTo: string
}

const EMPTY_FILTERS: Filters = {
  search: '',
  company: '',
  statuses: new Set(),
  sponsorships: new Set(),
  dateFrom: '',
  dateTo: '',
}

function matchesSearch(job: Job, term: string): boolean {
  if (!term) return true
  const haystack = [job.company, job.role, job.jd, job.job_url, job.notes]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
  return haystack.includes(term.toLowerCase())
}

function matchesDateRange(job: Job, from: string, to: string): boolean {
  if (!job.applied_date) return !from && !to
  if (from && job.applied_date < from) return false
  if (to && job.applied_date > to) return false
  return true
}

export function TablePage({
  jobsState,
  onEditJob,
  userId,
}: {
  jobsState: ReturnType<typeof useJobs>
  onEditJob: (job: Job) => void
  /** The signed-in user's id, threaded through to ImportJobsModal so every imported row is attached to them. */
  userId: string
}) {
  const { jobs, loading, error, errorDetail, refresh, removeJob } = jobsState
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS)
  const [sortKey, setSortKey] = useState<SortKey>('updated_at')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [importOpen, setImportOpen] = useState(false)

  const filtered = useMemo(() => {
    // Company/status/sponsorship AND-filtering is shared with the Insights
    // page via applyJobFilters, so "company contains X AND status is A or B
    // AND sponsorship is C" behaves identically in both places. Free-text
    // search and applied-date range are Table-specific and applied on top.
    const rows = applyJobFilters(jobs, filters).filter(
      (job) => matchesSearch(job, filters.search) && matchesDateRange(job, filters.dateFrom, filters.dateTo),
    )
    const sorted = [...rows].sort((a, b) => {
      const aVal = a[sortKey] ?? ''
      const bVal = b[sortKey] ?? ''
      const cmp = aVal < bVal ? -1 : aVal > bVal ? 1 : 0
      return sortDir === 'asc' ? cmp : -cmp
    })
    return sorted
  }, [jobs, filters, sortKey, sortDir])

  const filtersActive =
    filters.search ||
    filters.company ||
    filters.statuses.size > 0 ||
    filters.sponsorships.size > 0 ||
    filters.dateFrom ||
    filters.dateTo

  function toggleStatus(status: JobStatus) {
    setFilters((prev) => {
      const next = new Set(prev.statuses)
      if (next.has(status)) next.delete(status)
      else next.add(status)
      return { ...prev, statuses: next }
    })
  }

  function toggleSponsorship(sponsorship: Sponsorship) {
    setFilters((prev) => {
      const next = new Set(prev.sponsorships)
      if (next.has(sponsorship)) next.delete(sponsorship)
      else next.add(sponsorship)
      return { ...prev, sponsorships: next }
    })
  }

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir('desc')
    }
  }

  async function handleDelete(jobId: string) {
    setDeleteError(null)
    try {
      await removeJob(jobId)
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Failed to delete this job.')
    }
  }

  if (loading && jobs.length === 0) return <LoadingState />
  if (error) return <ErrorState message={error} detail={errorDetail} onRetry={refresh} />

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Table</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">All tracked applications.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setImportOpen(true)}
            className="flex items-center gap-1.5 rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            <Upload className="h-4 w-4" aria-hidden="true" />
            Import jobs
          </button>
          <ExportCsvButton jobs={jobs} />
        </div>
      </div>

      <ImportJobsModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        jobs={jobs}
        onImported={() => void refresh()}
        userId={userId}
      />

      {jobs.length === 0 ? (
        <EmptyState
          title="No applications yet"
          description="Applications you add will show up here with search, filters, and sorting."
        />
      ) : (
        <>
          <div className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900 sm:flex-row sm:flex-wrap sm:items-end">
            <div className="min-w-[200px] flex-1">
              <label htmlFor="search" className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">
                Search
              </label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" aria-hidden="true" />
                <input
                  id="search"
                  type="text"
                  value={filters.search}
                  onChange={(e) => setFilters((prev) => ({ ...prev, search: e.target.value }))}
                  placeholder="Company, role, JD, URL, notes..."
                  className="w-full rounded-md border border-slate-300 bg-white py-2 pl-8 pr-3 text-sm dark:border-slate-700 dark:bg-slate-950"
                />
              </div>
            </div>

            <div className="min-w-[160px]">
              <label htmlFor="companyFilter" className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">
                Company
              </label>
              <input
                id="companyFilter"
                type="text"
                value={filters.company}
                onChange={(e) => setFilters((prev) => ({ ...prev, company: e.target.value }))}
                placeholder="Filter by company..."
                className="w-full rounded-md border border-slate-300 bg-white px-2 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
              />
            </div>

            <div>
              <span className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">Status</span>
              <div className="flex max-w-xs flex-wrap gap-1">
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
              <div className="flex max-w-xs flex-wrap gap-1">
                {SPONSORSHIP_VALUES.map((sponsorship) => (
                  <button
                    key={sponsorship}
                    type="button"
                    aria-pressed={filters.sponsorships.has(sponsorship)}
                    onClick={() => toggleSponsorship(sponsorship)}
                    className={classNames(
                      'rounded-full border px-2 py-1 text-xs font-medium transition-colors',
                      filters.sponsorships.has(sponsorship)
                        ? 'border-sky-500 bg-sky-50 text-sky-700 dark:border-sky-400 dark:bg-sky-900/40 dark:text-sky-300'
                        : 'border-slate-300 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800',
                    )}
                  >
                    {sponsorship}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-2">
              <div>
                <label htmlFor="dateFrom" className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">
                  Applied from
                </label>
                <DateField
                  id="dateFrom"
                  value={filters.dateFrom}
                  onChange={(value) => setFilters((prev) => ({ ...prev, dateFrom: value }))}
                  className="text-sm"
                />
              </div>
              <div>
                <label htmlFor="dateTo" className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">
                  Applied to
                </label>
                <DateField
                  id="dateTo"
                  value={filters.dateTo}
                  onChange={(value) => setFilters((prev) => ({ ...prev, dateTo: value }))}
                  className="text-sm"
                />
              </div>
            </div>

            {filtersActive && (
              <button
                type="button"
                onClick={() => setFilters(EMPTY_FILTERS)}
                className="flex items-center gap-1 rounded-md px-2 py-2 text-xs font-medium text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
              >
                <X className="h-3.5 w-3.5" aria-hidden="true" />
                Clear filters
              </button>
            )}
          </div>

          <p className="text-sm text-slate-500 dark:text-slate-400" aria-live="polite">
            {filtered.length} of {jobs.length} application{jobs.length === 1 ? '' : 's'}
          </p>

          {deleteError && (
            <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-300">
              {deleteError}
            </p>
          )}

          {filtered.length === 0 ? (
            <EmptyState title="No results" description="Try adjusting or clearing your filters." />
          ) : (
            <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
              <table className="min-w-full divide-y divide-slate-200 text-sm dark:divide-slate-800">
                <thead className="bg-slate-50 dark:bg-slate-900">
                  <tr>
                    <Th>Company</Th>
                    <Th>Role</Th>
                    <Th className="hidden lg:table-cell">Location</Th>
                    <Th>Status</Th>
                    <Th className="hidden md:table-cell">Sponsorship</Th>
                    <SortableTh label="Applied" active={sortKey === 'applied_date'} dir={sortDir} onClick={() => toggleSort('applied_date')} />
                    <Th className="hidden md:table-cell">Job URL</Th>
                    <SortableTh label="Updated" active={sortKey === 'updated_at'} dir={sortDir} onClick={() => toggleSort('updated_at')} className="hidden md:table-cell" />
                    <Th className="text-right">Actions</Th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white dark:divide-slate-800 dark:bg-slate-950">
                  {filtered.map((job) => (
                    <tr key={job.job_id}>
                      <Td className="font-medium">{job.company || <Muted>Unknown</Muted>}</Td>
                      <Td>{job.role || <Muted>-</Muted>}</Td>
                      <Td className="hidden max-w-[10rem] truncate lg:table-cell">{job.location || <Muted>-</Muted>}</Td>
                      <Td>
                        <StatusBadge status={job.status} />
                      </Td>
                      <Td className="hidden md:table-cell">
                        <SponsorshipBadge sponsorship={job.sponsorship} />
                      </Td>
                      <Td>{formatDate(job.applied_date) || <Muted>-</Muted>}</Td>
                      <Td className="hidden max-w-[12rem] truncate md:table-cell">
                        {job.job_url ? (
                          <a
                            href={job.job_url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-sky-600 hover:underline dark:text-sky-400"
                          >
                            {job.job_url}
                          </a>
                        ) : (
                          <Muted>-</Muted>
                        )}
                      </Td>
                      <Td className="hidden md:table-cell">{formatDate(job.updated_at)}</Td>
                      <Td className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            aria-label={`Edit ${job.company || 'job'}`}
                            onClick={() => onEditJob(job)}
                            className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                          >
                            <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                          </button>
                          <DeleteButton label={job.company || 'job'} onConfirm={() => handleDelete(job.job_id)} />
                        </div>
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  )
}

function Th({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <th scope="col" className={classNames('px-3 py-2 text-left text-xs font-semibold text-slate-500 dark:text-slate-400', className)}>
      {children}
    </th>
  )
}

function SortableTh({
  label,
  active,
  dir,
  onClick,
  className,
}: {
  label: string
  active: boolean
  dir: SortDir
  onClick: () => void
  className?: string
}) {
  return (
    <th scope="col" className={classNames('px-3 py-2 text-left text-xs font-semibold text-slate-500 dark:text-slate-400', className)}>
      <button type="button" onClick={onClick} className="flex items-center gap-1 hover:text-slate-700 dark:hover:text-slate-200">
        {label}
        {active && <span aria-hidden="true">{dir === 'asc' ? '↑' : '↓'}</span>}
      </button>
    </th>
  )
}

function Td({ children, className }: { children: React.ReactNode; className?: string }) {
  return <td className={classNames('px-3 py-2.5 align-top text-slate-700 dark:text-slate-200', className)}>{children}</td>
}

function Muted({ children }: { children: React.ReactNode }) {
  return <span className="text-slate-400 dark:text-slate-600">{children}</span>
}
