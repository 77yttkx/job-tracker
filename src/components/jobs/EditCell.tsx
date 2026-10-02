import { useEffect, useRef, useState } from 'react'
import { Check, Loader2 } from 'lucide-react'
import { classNames } from '../../lib/utils'

/**
 * Generic inline-edit popover for a Table cell backed by a small, fixed
 * set of string options. Mirrors StatusEditCell's interaction and
 * accessibility pattern exactly (click the badge -> open an accessible
 * popover listbox -> choose an option -> close), but is parameterized
 * over the option list and the badge renderer so ApplicationSourceEditCell
 * and SponsorshipEditCell (V3.6) don't each duplicate that popover/
 * keyboard/click-outside logic.
 *
 * StatusEditCell itself is deliberately left untouched rather than
 * rewritten on top of this - Status inline editing already has its own
 * passing tests and real users depending on it, and generalizing it
 * retroactively would be pure risk for no behavior change. This
 * component only backs the two NEW inline-edit cells.
 *
 * Like StatusEditCell, this owns no "optimistic value" state of its own
 * - only whether a write is in flight (`pending`) and whether the
 * popover is open. The caller's `onChange` writes through the existing
 * update path (`editJob`), which never mutates local state until the
 * server call resolves, so a failed write simply leaves `value` (the
 * prop) unchanged - the "keep/restore previous value" requirement, for
 * free, with no rollback code needed here.
 */
export function EditCell<T extends string>({
  value,
  options,
  pending,
  onChange,
  renderBadge,
  ariaLabel,
  listAriaLabel,
}: {
  value: T
  /** The fixed set of selectable options, in display order. */
  options: readonly T[]
  /** True while a write for this row/field is in flight. */
  pending: boolean
  /** Called with the newly selected value. Never called for a no-op (re)selection of the current value. */
  onChange: (next: T) => void
  /** Renders the badge shown as the click trigger, for the current `value`. */
  renderBadge: (value: T) => React.ReactNode
  ariaLabel: string
  listAriaLabel: string
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

  function handleSelect(next: T) {
    // Selecting the already-selected value closes the menu without an
    // unnecessary write.
    if (next === value) {
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
        aria-label={ariaLabel}
        disabled={pending}
        onClick={() => setOpen((v) => !v)}
        className={classNames(
          'rounded-full outline-none ring-offset-1 focus-visible:ring-2 focus-visible:ring-sky-500',
          pending ? 'cursor-wait opacity-70' : 'cursor-pointer',
        )}
      >
        {renderBadge(value)}
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
          aria-label={listAriaLabel}
          className="absolute left-0 z-20 mt-1 w-44 rounded-lg border border-slate-200 bg-white p-1 shadow-lg dark:border-slate-700 dark:bg-slate-900"
        >
          {options.map((option) => {
            const selected = option === value
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
