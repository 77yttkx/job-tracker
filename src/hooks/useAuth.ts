import { useCallback, useEffect, useMemo, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../services/supabase'

export interface AuthResult {
  error: string | null
}

export interface AuthState {
  /** The current Supabase session, or null when signed out. Persisted across a refresh via supabase-js's own localStorage-backed storage (see src/services/supabase.ts). */
  session: Session | null
  /** True only while the very first session check (on mount) is in flight - never true again after that, even while a sign-in/out request is pending (those track their own local `submitting` state in the auth forms). */
  loading: boolean
  /**
   * True from the moment a password-recovery link is opened until the user
   * either sets a new password or signs out. While true, the app shows the
   * "choose a new password" screen instead of the ordinary signed-in app -
   * even though `session` is technically non-null during this window
   * (Supabase issues a temporary recovery session so `updateUser` can be
   * called), that session should never be treated as an ordinary sign-in.
   */
  recoveryMode: boolean
  signUp: (email: string, password: string) => Promise<AuthResult & { needsEmailConfirmation: boolean }>
  signIn: (email: string, password: string) => Promise<AuthResult>
  signOut: () => Promise<void>
  requestPasswordReset: (email: string) => Promise<AuthResult>
  updatePassword: (password: string) => Promise<AuthResult>
}

function messageFor(error: unknown): string {
  if (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string') {
    return error.message
  }
  return 'Something went wrong. Please try again.'
}

/**
 * Wraps Supabase Auth (email + password) for the whole app. Call this
 * exactly once, at the top of App.tsx - every other component that needs
 * auth state receives it as a prop from there, the same pattern this
 * codebase already uses for `useJobs()`/`jobsState` (see
 * src/__tests__/sharedJobsSource.test.ts for why a single shared instance
 * matters).
 *
 * Session persistence and the password-recovery URL handling are both
 * configured on the shared `supabase` client itself (persistSession,
 * autoRefreshToken, detectSessionInUrl - see src/services/supabase.ts);
 * this hook just surfaces that state to React and adds the small bit of
 * extra bookkeeping (`recoveryMode`) needed to route a recovery link to
 * the right screen instead of straight into the app.
 */
export function useAuth(): AuthState {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [recoveryMode, setRecoveryMode] = useState(false)

  useEffect(() => {
    let cancelled = false

    void supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return
      setSession(data.session)
      setLoading(false)
    })

    const { data: subscription } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (cancelled) return
      setSession(nextSession)
      if (event === 'PASSWORD_RECOVERY') setRecoveryMode(true)
      if (event === 'SIGNED_OUT') setRecoveryMode(false)
      setLoading(false)
    })

    return () => {
      cancelled = true
      subscription.subscription.unsubscribe()
    }
  }, [])

  const signUp = useCallback(async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signUp({ email, password })
    if (error) return { error: messageFor(error), needsEmailConfirmation: false }
    // Supabase returns a user with no session when email confirmation is
    // required (project setting) - the caller uses this to show "check
    // your email" instead of assuming the account is immediately usable.
    const needsEmailConfirmation = Boolean(data.user) && !data.session
    return { error: null, needsEmailConfirmation }
  }, [])

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) return { error: messageFor(error) }
    return { error: null }
  }, [])

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
    // onAuthStateChange's SIGNED_OUT handler above clears `session` and
    // `recoveryMode`; the authenticated app subtree (src/App.tsx) unmounts
    // as a result, which is what actually discards jobs/filters/modal
    // state - see AuthenticatedApp in App.tsx.
  }, [])

  const requestPasswordReset = useCallback(async (email: string) => {
    const redirectTo = `${window.location.origin}/reset-password`
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo })
    if (error) return { error: messageFor(error) }
    return { error: null }
  }, [])

  const updatePassword = useCallback(async (password: string) => {
    const { error } = await supabase.auth.updateUser({ password })
    if (error) return { error: messageFor(error) }
    setRecoveryMode(false)
    return { error: null }
  }, [])

  return useMemo(
    () => ({ session, loading, recoveryMode, signUp, signIn, signOut, requestPasswordReset, updatePassword }),
    [session, loading, recoveryMode, signUp, signIn, signOut, requestPasswordReset, updatePassword],
  )
}
