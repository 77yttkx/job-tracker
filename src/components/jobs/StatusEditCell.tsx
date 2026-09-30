import { useEffect, useRef, useState } from 'react'
import { Check, Loader2 } from 'lucide-react'
import { JOB_STATUSES } from '../../lib/constants'
import type { JobStatus } from '../../lib/constants'
import { classNames } from '../../lib/utils'
import { StatusBadge } from './StatusBadge'

/**
 * Inline status editor for the Table page: the existing `StatusBadge` is
 * the click trigger for a small accessible popover listing all
 * `JOB_STATUSES` (the one canonical status list/type - never a second,
 * hard-coded copy). Selecting a different status writes through the
 * caller's own update path (`onChange`, wired to `useJobs().editJob` by
 * `TablePage`) rather than any new update logic here, so this component
 * owns no "optimistic status" state of its own - only whether a write is
 * in flight (`pending`) and whether the popover is open. Because
 * `editJob` never mutates local state until the server call resolves,
 * a failed write simply leaves `status` (the prop) unchanged, which is
 * exactly the "keep/restore previous status" requirement, for free.
 */
export function StatusEditCell({
  status,
  pending,
  onChange,
}: {
  status: JobStatus
  /** True while a status update for this row is in flight. */
  pending: boolean
  /** Called with the newly selected status. Never called for a no-op (re)selection of the current status. */
  onChange: (next: JobStatus) => void
}) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function handlePointerDown(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [open])

  function handleSelect(next: JobStatus) {
    // Selecting the already-selected status closes the menu without an
    // unnecessary write.
    if (next === status) {
      setOpen(false)
      return
    }
    setOpen(false)
    onChange(next)
  }

  return (
    <div ref={containerRef} className="relative inline-block">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`Change status, currently ${status}`}
        disabled={pending}
        onClick={() => setOpen((v) => !v)}
        className={classNames(
          'rounded-full outline-none ring-offset-1 focus-visible:ring-2 focus-visible:ring-sky-500',
          pending ? 'cursor-wait opacity-70' : 'cursor-pointer',
        )}
      >
        <StatusBadge status={status} />
      </button>
      {pending && (
        <Loader2
          aria-hidden="true"
          className="ml-1.5 inline h-3 w-3 animate-spin align-middle text-slate-400"
        />
      )}
      {open && (
        <ul
          role="listbox"
          aria-label="Select a status"
          className="absolute left-0 z-20 mt-1 w-40 rounded-lg border border-slate-200 bg-white p-1 shadow-lg dark:border-slate-700 dark:bg-slate-900"
        >
          {JOB_STATUSES.map((option) => {
            const selected = option === status
            return (
              <li key={option} role="presentation">
                <button
                  type="button"
                  role="option"
                  aria-selected={selected}
                  onClick={() => handleSelect(option)}
                  className={classNames(
                    'flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-xs font-medium hover:bg-slate-100 dark:hover:bg-slate-800',
                    selected ? 'text-slate-900 dark:text-slate-100' : 'text-slate-600 dark:text-slate-300',
                  )}
                >
                  {option}
                  {selected && <Check className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />}
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
