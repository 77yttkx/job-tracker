import { useCallback, useState } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { AppShell } from './components/layout/AppShell'
import { JobModal } from './components/jobs/JobModal'
import { InsightsPage } from './pages/InsightsPage'
import { TablePage } from './pages/TablePage'
import { SignInPage } from './pages/auth/SignInPage'
import { SignUpPage } from './pages/auth/SignUpPage'
import { ForgotPasswordPage } from './pages/auth/ForgotPasswordPage'
import { ResetPasswordPage } from './pages/auth/ResetPasswordPage'
import { useJobs } from './hooks/useJobs'
import { useAuth, type AuthState } from './hooks/useAuth'
import { useTheme } from './hooks/useTheme'
import type { Job } from './types/job'

/**
 * The signed-in app shell + routes. Only ever mounted while `auth.session`
 * is truthy and not in password-recovery mode (see App below), so that
 * signing out unmounts this whole subtree - discarding useJobs' jobs
 * array, any in-flight filters, and modal state - with no separate
 * "clear app state on sign out" logic required anywhere.
 */
function AuthenticatedApp({ auth, userId, userEmail }: { auth: AuthState; userId: string; userEmail: string }) {
  const jobsState = useJobs(userId)
  const { theme, toggleTheme } = useTheme()
  const [modalJob, setModalJob] = useState<Job | null>(null)
  const [modalOpen, setModalOpen] = useState(false)

  const openAddModal = useCallback(() => {
    setModalJob(null)
    setModalOpen(true)
  }, [])

  const openEditModal = useCallback((job: Job) => {
    setModalJob(job)
    setModalOpen(true)
  }, [])

  const closeModal = useCallback(() => setModalOpen(false), [])

  return (
    <>
      <AppShell
        theme={theme}
        onToggleTheme={toggleTheme}
        onAddJob={openAddModal}
        userEmail={userEmail}
        onSignOut={() => void auth.signOut()}
      >
        <Routes>
          <Route path="/" element={<Navigate to="/insights" replace />} />
          <Route path="/insights" element={<InsightsPage jobsState={jobsState} />} />
          <Route
            path="/table"
            element={<TablePage jobsState={jobsState} onEditJob={openEditModal} userId={userId} />}
          />
          <Route path="*" element={<Navigate to="/insights" replace />} />
        </Routes>
      </AppShell>
      <JobModal
        open={modalOpen}
        job={modalJob}
        onClose={closeModal}
        addJob={jobsState.addJob}
        editJob={jobsState.editJob}
      />
    </>
  )
}

/**
 * Auth screens are reachable independently of session state so the
 * recovery-mode flow (clicking the password-reset email link) always
 * lands on /reset-password even though onAuthStateChange also sets a
 * (temporary) session for that flow. Every other auth route redirects
 * away to /insights once a normal session exists.
 */
function UnauthenticatedApp({ auth }: { auth: AuthState }) {
  return (
    <Routes>
      <Route path="/sign-in" element={<SignInPage auth={auth} />} />
      <Route path="/sign-up" element={<SignUpPage auth={auth} />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage auth={auth} />} />
      <Route path="/reset-password" element={<ResetPasswordPage auth={auth} />} />
      <Route path="*" element={<Navigate to="/sign-in" replace />} />
    </Routes>
  )
}

export default function App() {
  const auth = useAuth()

  if (auth.loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-slate-950">
        <div
          className="h-6 w-6 animate-spin rounded-full border-2 border-sky-600 border-t-transparent"
          role="status"
          aria-label="Loading"
        />
      </div>
    )
  }

  // Password recovery always shows the reset-password screen, even though
  // Supabase's PASSWORD_RECOVERY event also establishes a session - the
  // user hasn't "signed in" in the normal sense yet, they're mid-reset.
  if (auth.recoveryMode) {
    return <ResetPasswordPage auth={auth} />
  }

  if (!auth.session) {
    return <UnauthenticatedApp auth={auth} />
  }

  return <AuthenticatedApp auth={auth} userId={auth.session.user.id} userEmail={auth.session.user.email ?? ''} />
}
