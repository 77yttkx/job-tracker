import { Briefcase, Loader2 } from 'lucide-react'
import type { ReactNode } from 'react'

/**
 * Shared centered-card shell for every auth screen (sign in/up, forgot
 * password, reset password), so they read as one polished flow rather
 * than four disconnected forms.
 */
export function AuthCard({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string
  subtitle?: string
  children: ReactNode
  footer?: ReactNode
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-12 dark:bg-slate-950">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center gap-2 text-center">
          <div className="flex items-center gap-2">
            <Briefcase className="h-6 w-6 text-sky-600 dark:text-sky-400" aria-hidden="true" />
            <span className="text-base font-semibold tracking-tight text-slate-900 dark:text-slate-100">
              Job Tracker
            </span>
          </div>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <h1 className="text-lg font-semibold tracking-tight text-slate-900 dark:text-slate-100">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{subtitle}</p>}
          <div className="mt-5">{children}</div>
        </div>
        {footer && <div className="mt-4 text-center text-sm text-slate-500 dark:text-slate-400">{footer}</div>}
      </div>
    </div>
  )
}

export function AuthField({
  label,
  htmlFor,
  error,
  children,
}: {
  label: string
  htmlFor: string
  error?: string | null
  children: ReactNode
}) {
  return (
    <div>
      <label htmlFor={htmlFor} className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">
        {label}
      </label>
      {children}
      {error && (
        <p role="alert" className="mt-1 text-xs text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
    </div>
  )
}

export function AuthSubmitButton({
  submitting,
  children,
}: {
  submitting: boolean
  children: ReactNode
}) {
  return (
    <button
      type="submit"
      disabled={submitting}
      className="flex w-full items-center justify-center gap-1.5 rounded-md bg-sky-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-sky-700 disabled:opacity-60"
    >
      {submitting && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
      {children}
    </button>
  )
}

export function AuthErrorBanner({ message }: { message: string }) {
  return (
    <p
      role="alert"
      className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-900/20 dark:text-red-300"
    >
      {message}
    </p>
  )
}

export function AuthSuccessBanner({ message }: { message: string }) {
  return (
    <p
      role="status"
      className="mb-4 rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700 dark:border-green-900/50 dark:bg-green-900/20 dark:text-green-300"
    >
      {message}
    </p>
  )
}
