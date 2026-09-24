import { useId, useState } from 'react'
import { ChevronDown, Code2 } from 'lucide-react'
import { LoadingState, ErrorState, EmptyState } from '../../ui/DataStates'

/**
 * Shared shell for every SQL Analytics Lab card: title, one-sentence
 * plain-English explanation, the analysis body (chart/table, passed as
 * `children`), and a collapsible read-only "View SQL" section. Loading/
 * error/empty are handled once here so each individual card component
 * only has to decide *which* state it's in.
 */
export function AnalyticsCard({
  title,
  explanation,
  loading,
  error,
  errorDetail,
  onRetry,
  isEmpty,
  emptyTitle,
  emptyDescription,
  sql,
  children,
}: {
  title: string
  explanation: string
  loading: boolean
  error: string | null
  errorDetail?: string | null
  onRetry: () => void
  isEmpty: boolean
  emptyTitle: string
  emptyDescription: string
  /** Readable, read-only SQL example (see src/lib/sqlExamples.ts). */
  sql: string
  children: React.ReactNode
}) {
  const [sqlOpen, setSqlOpen] = useState(false)
  const sqlPanelId = useId()

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
      <div className="mb-1 flex items-start justify-between gap-3">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{title}</h3>
      </div>
      <p className="mb-4 text-xs text-slate-500 dark:text-slate-400">{explanation}</p>

      {loading ? (
        <LoadingState label="Running analysis..." />
      ) : error ? (
        <ErrorState message={error} detail={errorDetail} onRetry={onRetry} />
      ) : isEmpty ? (
        <EmptyState title={emptyTitle} description={emptyDescription} />
      ) : (
        children
      )}

      <div className="mt-4 border-t border-slate-100 pt-3 dark:border-slate-800">
        <button
          type="button"
          onClick={() => setSqlOpen((open) => !open)}
          aria-expanded={sqlOpen}
          aria-controls={sqlPanelId}
          className="flex items-center gap-1.5 rounded-md px-1 py-1 text-xs font-medium text-slate-500 hover:text-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-500 dark:text-slate-400 dark:hover:text-slate-200"
        >
          <Code2 className="h-3.5 w-3.5" aria-hidden="true" />
          View SQL
          <ChevronDown
            className={`h-3.5 w-3.5 transition-transform ${sqlOpen ? 'rotate-180' : ''}`}
            aria-hidden="true"
          />
        </button>
        {sqlOpen && (
          <div id={sqlPanelId}>
            <p className="mb-2 mt-2 text-[11px] uppercase tracking-wide text-slate-400 dark:text-slate-500">
              Read-only example - scoped to your own data
            </p>
            <pre className="overflow-x-auto rounded-md bg-slate-50 p-3 text-xs text-slate-700 dark:bg-slate-950 dark:text-slate-300">
              <code>{sql}</code>
            </pre>
          </div>
        )}
      </div>
    </section>
  )
}
