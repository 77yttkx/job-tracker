import { Download } from 'lucide-react'
import { downloadCsv, exportFileName, jobsToCsv } from '../../lib/csv'
import type { Job } from '../../types/job'

/** Always exports every job passed in - callers must pass the full dataset, not filtered rows. */
export function ExportCsvButton({ jobs }: { jobs: Job[] }) {
  function handleExport() {
    downloadCsv(jobsToCsv(jobs), exportFileName())
  }

  return (
    <button
      type="button"
      onClick={handleExport}
      disabled={jobs.length === 0}
      className="flex items-center gap-1.5 rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
    >
      <Download className="h-4 w-4" aria-hidden="true" />
      Export CSV
    </button>
  )
}
