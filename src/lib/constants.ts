/**
 * Single source of truth for application statuses. Reused across the
 * database check constraint (supabase-schema.sql), the data-access layer,
 * the table filters, the Add/Edit modal, and the Insights application
 * overview (src/components/insights/ApplicationOverview.tsx).
 */
export const JOB_STATUSES = [
  'Applied',
  'OA',
  '1st Round',
  '2nd Round',
  'Final Round',
  'Offer',
  'Rejected',
  'Ghosted',
] as const

export type JobStatus = (typeof JOB_STATUSES)[number]

export const DEFAULT_STATUS: JobStatus = 'Applied'

/** Stable colors per status, reused across Insights (application overview, status distribution), Table, and the modal. */
export const STATUS_COLORS: Record<JobStatus, { bg: string; text: string; dot: string; hex: string }> = {
  Applied: { bg: 'bg-slate-100 dark:bg-slate-800', text: 'text-slate-700 dark:text-slate-300', dot: 'bg-slate-500', hex: '#64748b' },
  OA: { bg: 'bg-sky-100 dark:bg-sky-900/40', text: 'text-sky-700 dark:text-sky-300', dot: 'bg-sky-500', hex: '#0ea5e9' },
  '1st Round': { bg: 'bg-indigo-100 dark:bg-indigo-900/40', text: 'text-indigo-700 dark:text-indigo-300', dot: 'bg-indigo-500', hex: '#6366f1' },
  '2nd Round': { bg: 'bg-violet-100 dark:bg-violet-900/40', text: 'text-violet-700 dark:text-violet-300', dot: 'bg-violet-500', hex: '#8b5cf6' },
  'Final Round': { bg: 'bg-fuchsia-100 dark:bg-fuchsia-900/40', text: 'text-fuchsia-700 dark:text-fuchsia-300', dot: 'bg-fuchsia-500', hex: '#d946ef' },
  Offer: { bg: 'bg-green-100 dark:bg-green-900/40', text: 'text-green-700 dark:text-green-300', dot: 'bg-green-600', hex: '#16a34a' },
  Rejected: { bg: 'bg-red-100 dark:bg-red-900/40', text: 'text-red-700 dark:text-red-300', dot: 'bg-red-600', hex: '#dc2626' },
  Ghosted: { bg: 'bg-amber-100 dark:bg-amber-900/40', text: 'text-amber-800 dark:text-amber-300', dot: 'bg-amber-600', hex: '#a16207' },
}

/**
 * Sponsorship classification. Kept intentionally separate from status:
 * always manually editable, and only ever set automatically as a
 * conservative best-effort guess from parsed job description text (see
 * src/lib/parsing/sponsorship.ts).
 */
export const SPONSORSHIP_VALUES = ['Yes', 'No', 'Unknown'] as const
export type Sponsorship = (typeof SPONSORSHIP_VALUES)[number]
export const DEFAULT_SPONSORSHIP: Sponsorship = 'Unknown'

export const SPONSORSHIP_COLORS: Record<Sponsorship, { bg: string; text: string; dot: string }> = {
  Yes: { bg: 'bg-green-100 dark:bg-green-900/40', text: 'text-green-700 dark:text-green-300', dot: 'bg-green-600' },
  No: { bg: 'bg-red-100 dark:bg-red-900/40', text: 'text-red-700 dark:text-red-300', dot: 'bg-red-600' },
  Unknown: { bg: 'bg-slate-100 dark:bg-slate-800', text: 'text-slate-600 dark:text-slate-400', dot: 'bg-slate-400' },
}

export const THEME_STORAGE_KEY = 'job-tracker-theme'
