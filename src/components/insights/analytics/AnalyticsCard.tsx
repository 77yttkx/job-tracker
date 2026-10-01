import { LoadingState, ErrorState, EmptyState } from '../../ui/DataStates'

/**
 * Shared shell for every analytics card on Insights: title, one-sentence
 * plain-English explanation, and the analysis body (chart/table, passed
 * as `children`). Loading/error/empty are handled once here so each
 * individual card component only has to decide *which* state it's in.
 *
 * This card used to also render a collapsible "View SQL" section
 * showing the underlying read-only query (`src/lib/sqlExamples.ts`).
 * That was removed: these are now plain, user-facing analytics, not a
 * SQL demonstration, and showing implementation details (raw queries)
 * isn't something end users need. The analyses themselves are unchanged
 * - still real Postgres RPCs, still scoped to the signed-in user - only
 * the "look at the SQL" affordance is gone.
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
  children: React.ReactNode
}) {
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
    </section>
  )
}
