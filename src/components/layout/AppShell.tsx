import type { ReactNode } from 'react'
import { NavLink } from 'react-router-dom'
import { LineChart, Table2, MessagesSquare, Plus, Moon, Sun, Briefcase, LogOut } from 'lucide-react'
import { classNames } from '../../lib/utils'
import type { Theme } from '../../hooks/useTheme'

// V3: "Interview Prep" is a separate, independent module (Story Library /
// Generate STAR Answer / Answer Library - see src/pages/interviewPrep/)
// reached via a single sidebar entry directly below Table, per spec. It
// links to /interview-prep (which redirects to /interview-prep/stories -
// see src/App.tsx), and stays highlighted for any /interview-prep/* page
// since `end: false` matches on the path prefix.
const NAV_ITEMS = [
  { to: '/insights', label: 'Insights', icon: LineChart, end: false },
  { to: '/table', label: 'Table', icon: Table2, end: false },
  { to: '/interview-prep', label: 'Interview Prep', icon: MessagesSquare, end: false },
] as const

interface AppShellProps {
  theme: Theme
  onToggleTheme: () => void
  onAddJob: () => void
  /** The signed-in user's email, shown in the sidebar/mobile menu so it's always clear whose workspace this is. */
  userEmail: string
  /** Signs the current user out. AppShell only renders the control; App.tsx owns what happens after (see AuthenticatedApp unmounting). */
  onSignOut: () => void
  children: ReactNode
}

export function AppShell({ theme, onToggleTheme, onAddJob, userEmail, onSignOut, children }: AppShellProps) {
  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      {/* Desktop sidebar: sticky to the viewport (100vh) so it stays fully
          visible while the main column scrolls a long Table list. Only the
          nav links scroll internally (overflow-y-auto) if they ever
          overflow; the Add Job / Dark mode buttons stay pinned at the
          bottom via flex layout, never sticky/fixed themselves. Mobile
          keeps its own bottom nav below and never uses this sidebar
          (hidden ... md:flex). */}
      <aside className="hidden w-56 shrink-0 flex-col border-r border-slate-200 bg-white px-3 py-4 dark:border-slate-800 dark:bg-slate-900 md:sticky md:top-0 md:flex md:h-screen">
        <div className="mb-6 flex items-center gap-2 px-2">
          <Briefcase className="h-5 w-5 text-sky-600 dark:text-sky-400" aria-hidden="true" />
          <span className="text-sm font-semibold tracking-tight">Job Tracker</span>
        </div>
        <nav className="flex flex-1 flex-col gap-1 overflow-y-auto" aria-label="Primary">
          {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                classNames(
                  'flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-sky-50 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white',
                )
              }
            >
              {({ isActive }) => (
                <>
                  <Icon className="h-4 w-4" aria-hidden="true" />
                  {label}
                  {isActive && <span className="sr-only"> (current page)</span>}
                </>
              )}
            </NavLink>
          ))}
        </nav>
        <div className="flex shrink-0 flex-col gap-2 border-t border-slate-200 pt-3 dark:border-slate-800">
          <button
            type="button"
            onClick={onAddJob}
            className="flex items-center justify-center gap-1.5 rounded-md bg-sky-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-sky-700 focus-visible:outline-offset-2"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            Add Job
          </button>
          <ThemeToggle theme={theme} onToggle={onToggleTheme} />
          <div className="mt-1 flex items-center justify-between gap-2 border-t border-slate-200 pt-3 dark:border-slate-800">
            <span
              className="min-w-0 flex-1 truncate text-xs text-slate-500 dark:text-slate-400"
              title={userEmail}
            >
              {userEmail}
            </span>
            <button
              type="button"
              onClick={onSignOut}
              aria-label="Sign out"
              title="Sign out"
              className="flex shrink-0 items-center justify-center rounded-md p-1.5 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white"
            >
              <LogOut className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-900 md:hidden">
        <div className="flex items-center gap-2">
          <Briefcase className="h-5 w-5 text-sky-600 dark:text-sky-400" aria-hidden="true" />
          <span className="text-sm font-semibold tracking-tight">Job Tracker</span>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle theme={theme} onToggle={onToggleTheme} iconOnly />
          <button
            type="button"
            onClick={onAddJob}
            aria-label="Add job"
            className="flex items-center justify-center gap-1.5 rounded-md bg-sky-600 px-3 py-2 text-sm font-medium text-white hover:bg-sky-700"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            Add
          </button>
          <button
            type="button"
            onClick={onSignOut}
            aria-label="Sign out"
            title={userEmail}
            className="flex items-center justify-center rounded-md p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white"
          >
            <LogOut className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </header>

      <main className="flex-1 pb-16 md:pb-0">
        <div className="mx-auto w-full max-w-7xl px-4 py-6 md:px-8">{children}</div>
      </main>

      {/* Mobile bottom nav */}
      <nav
        aria-label="Primary"
        className="fixed inset-x-0 bottom-0 z-10 flex border-t border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 md:hidden"
      >
        {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              classNames(
                'flex flex-1 flex-col items-center gap-0.5 py-2 text-xs font-medium',
                isActive
                  ? 'text-sky-700 dark:text-sky-300'
                  : 'text-slate-500 dark:text-slate-400',
              )
            }
          >
            {({ isActive }) => (
              <>
                <Icon className="h-5 w-5" aria-hidden="true" />
                {label}
                {isActive && <span className="sr-only"> (current page)</span>}
              </>
            )}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}

function ThemeToggle({
  theme,
  onToggle,
  iconOnly = false,
}: {
  theme: Theme
  onToggle: () => void
  iconOnly?: boolean
}) {
  const Icon = theme === 'dark' ? Sun : Moon
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
      className={classNames(
        'flex items-center justify-center gap-1.5 rounded-md border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800',
        iconOnly && 'px-2',
      )}
    >
      <Icon className="h-4 w-4" aria-hidden="true" />
      {!iconOnly && (theme === 'dark' ? 'Light mode' : 'Dark mode')}
    </button>
  )
}
