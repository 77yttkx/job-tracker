import { useEffect, useMemo, useRef, useState } from 'react'
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight } from 'lucide-react'
import { classNames } from '../../lib/utils'
import {
  MONTH_LABELS_EN,
  WEEKDAY_LABELS_EN,
  buildMonthGrid,
  maskDateDigits,
  parseDateDisplay,
  toYmd,
  ymdToDisplay,
} from '../../lib/dateField'

export interface DateFieldProps {
  id: string
  value: string
  onChange: (value: string) => void
  hasError?: boolean
  'aria-label'?: string
  className?: string
}

/**
 * Accessible, English-only replacement for `<input type="date">`. Chrome
 * localizes the native date input's *displayed text* (not just the popup
 * calendar) to the OS locale - on a Chinese-localized macOS that renders as
 * "年/月/日" regardless of the app's own language, which the PRD's V2.5.1
 * spec calls out explicitly. This component always displays/accepts
 * MM/DD/YYYY, independent of OS locale, and converts to/from the
 * database's YYYY-MM-DD via plain string splitting (src/lib/dateField.ts) -
 * never a UTC-parsing `new Date(str)` - so there is no off-by-one shift.
 */
export function DateField({ id, value, onChange, hasError, className, ...aria }: DateFieldProps) {
  const [text, setText] = useState(() => ymdToDisplay(value))
  const [invalid, setInvalid] = useState(false)
  const [pickerOpen, setPickerOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  // Reflect external value changes (form reset on modal open, filters
  // cleared, a calendar pick) into the displayed text.
  useEffect(() => {
    setText(ymdToDisplay(value))
    setInvalid(false)
  }, [value])

  useEffect(() => {
    if (!pickerOpen) return
    function handlePointerDown(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setPickerOpen(false)
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setPickerOpen(false)
    }
    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [pickerOpen])

  function handleTextChange(raw: string) {
    const masked = maskDateDigits(raw)
    setText(masked)
    const parsed = parseDateDisplay(masked)
    if (!parsed.complete) {
      // Still typing - not an error yet, and don't push a partial value up.
      setInvalid(false)
      return
    }
    if (!parsed.valid) {
      setInvalid(true)
      return
    }
    setInvalid(false)
    onChange(parsed.ymd ?? '')
  }

  function handleBlur() {
    const parsed = parseDateDisplay(text)
    if (parsed.complete && parsed.valid) {
      setInvalid(false)
      return
    }
    if (text.trim() === '') {
      setInvalid(false)
      onChange('')
      return
    }
    // Leftover partial/invalid text on blur - flag it rather than silently
    // discarding what the user typed.
    setInvalid(true)
  }

  function handlePick(ymd: string) {
    setText(ymdToDisplay(ymd))
    setInvalid(false)
    onChange(ymd)
    setPickerOpen(false)
  }

  const describedBy = invalid ? `${id}-error` : undefined

  return (
    <div ref={containerRef} className="relative">
      <div
        className={classNames(
          'flex items-center rounded-md border bg-white shadow-sm transition-colors dark:bg-slate-950',
          hasError || invalid
            ? 'border-red-400 focus-within:border-red-500'
            : 'border-slate-300 focus-within:border-sky-500 dark:border-slate-700',
          className,
        )}
      >
        <input
          id={id}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          placeholder="MM/DD/YYYY"
          aria-label={aria['aria-label']}
          aria-invalid={invalid || hasError || undefined}
          aria-describedby={describedBy}
          value={text}
          onChange={(e) => handleTextChange(e.target.value)}
          onBlur={handleBlur}
          className="w-full min-w-0 bg-transparent px-3 py-2 text-sm text-slate-900 outline-none dark:text-slate-100"
        />
        <button
          type="button"
          aria-label="Open calendar"
          aria-expanded={pickerOpen}
          aria-haspopup="dialog"
          onClick={() => setPickerOpen((v) => !v)}
          className="flex shrink-0 items-center justify-center rounded p-1.5 mr-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800"
        >
          <CalendarIcon className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
      {invalid && (
        <p id={`${id}-error`} role="alert" className="mt-1 text-xs text-red-600 dark:text-red-400">
          Enter a valid date as MM/DD/YYYY.
        </p>
      )}
      {pickerOpen && <CalendarPopover value={value} onPick={handlePick} onClose={() => setPickerOpen(false)} />}
    </div>
  )
}

function CalendarPopover({
  value,
  onPick,
  onClose,
}: {
  value: string
  onPick: (ymd: string) => void
  onClose: () => void
}) {
  const initial = useMemo(() => {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
    if (match) return { year: Number(match[1]), month: Number(match[2]) - 1 }
    const now = new Date()
    return { year: now.getFullYear(), month: now.getMonth() }
  }, [value])
  const [cursor, setCursor] = useState(initial)

  const days = useMemo(() => buildMonthGrid(cursor.year, cursor.month), [cursor])
  const label = `${MONTH_LABELS_EN[cursor.month]} ${cursor.year}`

  function goPrevMonth() {
    setCursor((c) => (c.month === 0 ? { year: c.year - 1, month: 11 } : { year: c.year, month: c.month - 1 }))
  }
  function goNextMonth() {
    setCursor((c) => (c.month === 11 ? { year: c.year + 1, month: 0 } : { year: c.year, month: c.month + 1 }))
  }

  return (
    <div
      role="dialog"
      aria-label="Choose a date"
      className="absolute z-20 mt-1 w-64 rounded-lg border border-slate-200 bg-white p-3 shadow-lg dark:border-slate-700 dark:bg-slate-900"
    >
      <div className="mb-2 flex items-center justify-between">
        <button
          type="button"
          aria-label="Previous month"
          onClick={goPrevMonth}
          className="rounded p-1 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
        >
          <ChevronLeft className="h-4 w-4" aria-hidden="true" />
        </button>
        <span className="text-sm font-medium tabular-nums">{label}</span>
        <button
          type="button"
          aria-label="Next month"
          onClick={goNextMonth}
          className="rounded p-1 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
        >
          <ChevronRight className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-medium text-slate-400">
        {WEEKDAY_LABELS_EN.map((w) => (
          <span key={w}>{w}</span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {days.map((day, i) => {
          if (day === null) return <span key={`blank-${i}`} />
          const dayYmd = toYmd(cursor.year, cursor.month, day)
          const isSelected = value === dayYmd
          return (
            <button
              key={dayYmd}
              type="button"
              onClick={() => onPick(dayYmd)}
              aria-pressed={isSelected}
              className={classNames(
                'rounded p-1.5 text-xs tabular-nums hover:bg-sky-100 dark:hover:bg-sky-900/40',
                isSelected
                  ? 'bg-sky-600 text-white hover:bg-sky-600'
                  : 'text-slate-700 dark:text-slate-200',
              )}
            >
              {day}
            </button>
          )
        })}
      </div>
      <button
        type="button"
        onClick={onClose}
        className="mt-2 w-full rounded-md border border-slate-200 py-1 text-xs font-medium text-slate-500 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800"
      >
        Close
      </button>
    </div>
  )
}
