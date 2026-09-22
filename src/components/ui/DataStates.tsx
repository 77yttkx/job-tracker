import { AlertTriangle, Loader2 } from 'lucide-react'

export function LoadingState({ label = 'Loading jobs...' }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-16 text-sm text-slate-500 dark:text-slate-400">
      <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
      {label}
    </div>
  )
}

export function ErrorState({
  message,
  detail,
  onRetry,
}: {
  message: string
  /** Optional extra diagnostic detail (e.g. a Postgres/PostgREST error code + hint) shown in smaller text beneath the main message - helps tell a genuine "no data" apart from a misconfigured/denied query. */
  detail?: string | null
  onRetry?: () => void
}) {
  return (
    <div
      role="alert"
      className="flex flex-col items-center gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-10 text-center dark:border-red-900/50 dark:bg-red-900/20"
    >
      <AlertTriangle className="h-6 w-6 text-red-500" aria-hidden="true" />
      <p className="text-sm text-red-700 dark:text-red-300">{message}</p>
      {detail && <p className="max-w-md text-xs text-red-600/80 dark:text-red-400/80">{detail}</p>}
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="rounded-md border border-red-300 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-100 dark:border-red-800 dark:text-red-300 dark:hover:bg-red-900/40"
        >
          Try again
        </button>
      )}
    </div>
  )
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string
  description?: string
  action?: React.ReactNode
}) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-slate-300 px-4 py-14 text-center dark:border-slate-700">
      <p className="text-sm font-medium text-slate-700 dark:text-slate-200">{title}</p>
      {description && <p className="max-w-sm text-sm text-slate-500 dark:text-slate-400">{description}</p>}
      {action}
    </div>
  )
}
