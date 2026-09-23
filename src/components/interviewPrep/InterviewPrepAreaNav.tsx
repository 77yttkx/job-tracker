import { NavLink } from 'react-router-dom'
import { MessageSquareText, Code2 } from 'lucide-react'
import { classNames } from '../../lib/utils'

/**
 * Interview Prep's top-level sub-navigation (V3.2 spec section 1):
 * "Interview Prep" is now a parent category with "Behavioral (BQ)" as its
 * first, fully-implemented sub-area and "Technical Interview" visible but
 * clearly labeled "Coming soon". Rendered by InterviewPrepShell, above
 * BQTabs (BQ's own third-level tab strip - see BQTabs.tsx), so the two
 * levels never collapse into one flat list.
 */
const AREAS = [
  { to: '/interview-prep/bq', label: 'Behavioral (BQ)', icon: MessageSquareText, comingSoon: false },
  { to: '/interview-prep/technical', label: 'Technical Interview', icon: Code2, comingSoon: true },
] as const

export function InterviewPrepAreaNav() {
  return (
    <nav aria-label="Interview Prep areas" className="flex flex-wrap gap-2">
      {AREAS.map(({ to, label, icon: Icon, comingSoon }) => (
        <NavLink
          key={to}
          to={to}
          className={({ isActive }) =>
            classNames(
              'flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm font-medium transition-colors',
              isActive
                ? 'border-sky-600 bg-sky-50 text-sky-700 dark:border-sky-500 dark:bg-sky-900/30 dark:text-sky-300'
                : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800',
            )
          }
        >
          {({ isActive }) => (
            <>
              <Icon className="h-4 w-4" aria-hidden="true" />
              {label}
              {comingSoon && (
                <span className="rounded-full bg-slate-200 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-600 dark:bg-slate-700 dark:text-slate-300">
                  Coming soon
                </span>
              )}
              {isActive && <span className="sr-only"> (current area)</span>}
            </>
          )}
        </NavLink>
      ))}
    </nav>
  )
}
