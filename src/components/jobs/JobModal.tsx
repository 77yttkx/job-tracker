import { useEffect, useId, useRef, useState } from 'react'
import { Loader2, Sparkles, X } from 'lucide-react'
import { DEFAULT_SPONSORSHIP, DEFAULT_STATUS, JOB_STATUSES, SPONSORSHIP_VALUES } from '../../lib/constants'
import type { JobStatus, Sponsorship } from '../../lib/constants'
import { isValidHttpUrl } from '../../lib/utils'
import { DateField } from '../ui/DateField'
import { parseJobUrl } from '../../services/jobParser'
import type { Job, JobUpdate, NewJob } from '../../types/job'

interface JobModalProps {
  open: boolean
  job: Job | null
  onClose: () => void
  addJob: (input: NewJob) => Promise<Job>
  editJob: (jobId: string, updates: JobUpdate) => Promise<Job>
}

interface FormState {
  job_url: string
  company: string
  role: string
  location: string
  sponsorship: Sponsorship
  jd: string
  applied_date: string
  status: JobStatus
  notes: string
}

const EMPTY_FORM: FormState = {
  job_url: '',
  company: '',
  role: '',
  location: '',
  sponsorship: DEFAULT_SPONSORSHIP,
  jd: '',
  applied_date: '',
  status: DEFAULT_STATUS,
  notes: '',
}

function jobToForm(job: Job): FormState {
  return {
    job_url: job.job_url ?? '',
    company: job.company ?? '',
    role: job.role ?? '',
    location: job.location ?? '',
    sponsorship: job.sponsorship,
    jd: job.jd ?? '',
    applied_date: job.applied_date ?? '',
    status: job.status,
    notes: job.notes ?? '',
  }
}

export function JobModal({ open, job, onClose, addJob, editJob }: JobModalProps) {
  const isEdit = job !== null
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({})
  const [parseStatus, setParseStatus] = useState<'idle' | 'loading' | 'done'>('idle')
  const [parseMessage, setParseMessage] = useState<string | null>(null)
  const [parseWarnings, setParseWarnings] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const dialogRef = useRef<HTMLDivElement>(null)
  const firstFieldRef = useRef<HTMLInputElement>(null)
  const titleId = useId()

  useEffect(() => {
    if (!open) return
    setForm(job ? jobToForm(job) : EMPTY_FORM)
    setErrors({})
    setParseStatus('idle')
    setParseMessage(null)
    setParseWarnings([])
    setSaveError(null)
  }, [open, job])

  useEffect(() => {
    if (open) firstFieldRef.current?.focus()
  }, [open])

  useEffect(() => {
    if (!open) return
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [open, onClose])

  if (!open) return null

  function updateField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
    setErrors((prev) => ({ ...prev, [key]: undefined }))
  }

  async function handleParse() {
    if (!form.job_url.trim()) {
      setErrors((prev) => ({ ...prev, job_url: 'Enter a URL to parse.' }))
      return
    }
    if (!isValidHttpUrl(form.job_url)) {
      setErrors((prev) => ({ ...prev, job_url: 'Enter a valid http(s) URL.' }))
      return
    }
    setParseStatus('loading')
    setParseMessage(null)
    setParseWarnings([])
    const outcome = await parseJobUrl(form.job_url)
    setParseStatus('done')
    setParseMessage(outcome.message)
    setParseWarnings(outcome.warnings ?? [])
    if (outcome.fields) {
      setForm((prev) => ({
        ...prev,
        company: prev.company || outcome.fields!.company || '',
        role: prev.role || outcome.fields!.role || '',
        location: prev.location || outcome.fields!.location || '',
        sponsorship: prev.sponsorship !== DEFAULT_SPONSORSHIP ? prev.sponsorship : outcome.fields!.sponsorship,
        jd: prev.jd || outcome.fields!.jd || '',
        applied_date: prev.applied_date || outcome.fields!.applied_date || '',
      }))
    }
  }

  function validate(): boolean {
    const nextErrors: Partial<Record<keyof FormState, string>> = {}
    if (form.job_url.trim() && !isValidHttpUrl(form.job_url)) {
      nextErrors.job_url = 'Enter a valid http(s) URL, or leave this blank.'
    }
    if (!JOB_STATUSES.includes(form.status)) {
      nextErrors.status = 'Choose a valid status.'
    }
    setErrors(nextErrors)
    return Object.keys(nextErrors).length === 0
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (saving) return
    if (!validate()) return

    setSaving(true)
    setSaveError(null)
    const payload: NewJob = {
      job_url: form.job_url.trim() || null,
      company: form.company.trim() || null,
      role: form.role.trim() || null,
      location: form.location.trim() || null,
      sponsorship: form.sponsorship,
      jd: form.jd.trim() || null,
      applied_date: form.applied_date || null,
      status: form.status,
      notes: form.notes.trim() || null,
    }
    try {
      if (isEdit && job) {
        await editJob(job.job_id, payload)
      } else {
        await addJob(payload)
      }
      onClose()
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to save this job.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 p-0 sm:items-center sm:p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-xl bg-white shadow-xl dark:bg-slate-900 sm:rounded-xl"
      >
        <form onSubmit={handleSubmit} noValidate>
          <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-slate-800">
            <h2 id={titleId} className="text-base font-semibold">
              {isEdit ? 'Edit Job' : 'Add Job'}
            </h2>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close dialog"
              className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800"
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>

          <div className="flex flex-col gap-4 px-5 py-4">
            <Field label="Job URL" htmlFor="job_url" error={errors.job_url}>
              <div className="flex gap-2">
                <input
                  ref={firstFieldRef}
                  id="job_url"
                  type="text"
                  inputMode="url"
                  placeholder="https://company.com/careers/job/123"
                  value={form.job_url}
                  onChange={(e) => updateField('job_url', e.target.value)}
                  className={inputClass(Boolean(errors.job_url))}
                />
                <button
                  type="button"
                  onClick={handleParse}
                  disabled={parseStatus === 'loading'}
                  className="flex shrink-0 items-center gap-1.5 rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  {parseStatus === 'loading' ? (
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  ) : (
                    <Sparkles className="h-4 w-4" aria-hidden="true" />
                  )}
                  Parse URL
                </button>
              </div>
              {parseMessage && (
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400" role="status">
                  {parseMessage}
                </p>
              )}
              {parseWarnings.length > 0 && (
                <ul className="mt-1 list-inside list-disc text-xs text-amber-700 dark:text-amber-400">
                  {parseWarnings.map((warning) => (
                    <li key={warning}>{warning}</li>
                  ))}
                </ul>
              )}
            </Field>

            <Field label="Company" htmlFor="company">
              <input
                id="company"
                type="text"
                value={form.company}
                onChange={(e) => updateField('company', e.target.value)}
                className={inputClass(false)}
              />
            </Field>

            <Field label="Role" htmlFor="role">
              <input
                id="role"
                type="text"
                value={form.role}
                onChange={(e) => updateField('role', e.target.value)}
                className={inputClass(false)}
              />
            </Field>

            <div className="grid grid-cols-2 gap-4">
              <Field label="Location" htmlFor="location">
                <input
                  id="location"
                  type="text"
                  placeholder="Charlotte, NC, United States"
                  value={form.location}
                  onChange={(e) => updateField('location', e.target.value)}
                  className={inputClass(false)}
                />
              </Field>

              <Field label="Sponsorship" htmlFor="sponsorship">
                <select
                  id="sponsorship"
                  value={form.sponsorship}
                  onChange={(e) => updateField('sponsorship', e.target.value as Sponsorship)}
                  className={inputClass(false)}
                >
                  {SPONSORSHIP_VALUES.map((value) => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  ))}
                </select>
              </Field>
            </div>

            <Field label="Job description" htmlFor="jd">
              <textarea
                id="jd"
                rows={4}
                value={form.jd}
                onChange={(e) => updateField('jd', e.target.value)}
                className={inputClass(false)}
              />
            </Field>

            <div className="grid grid-cols-2 gap-4">
              <Field label="Applied date" htmlFor="applied_date">
                <DateField
                  id="applied_date"
                  value={form.applied_date}
                  onChange={(value) => updateField('applied_date', value)}
                />
              </Field>

              <Field label="Status" htmlFor="status" error={errors.status}>
                <select
                  id="status"
                  value={form.status}
                  onChange={(e) => updateField('status', e.target.value as JobStatus)}
                  className={inputClass(Boolean(errors.status))}
                >
                  {JOB_STATUSES.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
              </Field>
            </div>

            <Field label="Notes" htmlFor="notes">
              <textarea
                id="notes"
                rows={3}
                value={form.notes}
                onChange={(e) => updateField('notes', e.target.value)}
                className={inputClass(false)}
              />
            </Field>

            {saveError && (
              <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-300">
                {saveError}
              </p>
            )}
          </div>

          <div className="flex justify-end gap-2 border-t border-slate-200 px-5 py-4 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-1.5 rounded-md bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-700 disabled:opacity-60"
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
              {isEdit ? 'Save changes' : 'Add job'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function Field({
  label,
  htmlFor,
  error,
  children,
}: {
  label: string
  htmlFor: string
  error?: string
  children: React.ReactNode
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

function inputClass(hasError: boolean): string {
  return [
    'w-full rounded-md border bg-white px-3 py-2 text-sm text-slate-900 shadow-sm transition-colors dark:bg-slate-950 dark:text-slate-100',
    hasError
      ? 'border-red-400 focus:border-red-500'
      : 'border-slate-300 focus:border-sky-500 dark:border-slate-700',
  ].join(' ')
}
