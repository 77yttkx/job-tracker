import { NavLink } from 'react-router-dom'
import { ListChecks, Library, Briefcase, BookOpen } from 'lucide-react'
import { classNames } from '../../lib/utils'

/**
 * Behavioral (BQ)'s own third-level tab strip (V3.2 spec section 1's
 * suggested internal sections, plus the pre-existing, now-nested, Story
 * Library). Rendered only on /interview-prep/bq/* pages, below
 * InterviewPrepAreaNav - see InterviewPrepShell.tsx.
 */
const TABS = [
  { to: '/interview-prep/bq/questions', label: 'BQ Questions', icon: ListChecks },
  { to: '/interview-prep/bq/answers', label: 'My Answers', icon: Library },
  { to: '/interview-prep/bq/prepare', label: 'Prepare for a Job', icon: Briefcase },
  { to: '/interview-prep/bq/stories', label: 'Story Library', icon: BookOpen },
] as const

export function BQTabs() {
  return (
    <nav aria-label="Behavioral (BQ) sections" className="flex flex-wrap gap-1 border-b border-slate-200 dark:border-slate-800">
      {TABS.map(({ to, label, icon: Icon }) => (
        <NavLink
          key={to}
          to={to}
          className={({ isActive }) =>
            classNames(
              'flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-medium transition-colors',
              isActive
                ? 'border-sky-600 text-sky-700 dark:border-sky-400 dark:text-sky-300'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200',
            )
          }
        >
          {({ isActive }) => (
            <>
              <Icon className="h-4 w-4" aria-hidden="true" />
              {label}
              {isActive && <span className="sr-only"> (current section)</span>}
            </>
          )}
        </NavLink>
      ))}
    </nav>
  )
}
