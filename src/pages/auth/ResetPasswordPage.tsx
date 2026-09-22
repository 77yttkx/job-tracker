import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  AuthCard,
  AuthErrorBanner,
  AuthField,
  AuthSubmitButton,
} from '../../components/auth/AuthCard'
import { MIN_PASSWORD_LENGTH, authInputClass, isValidPassword } from '../../lib/authValidation'
import type { AuthState } from '../../hooks/useAuth'

/**
 * Reached by clicking the link from ForgotPasswordPage's email. Supabase
 * (via `detectSessionInUrl` on the shared client - src/services/supabase.ts)
 * establishes a temporary recovery session before this page ever renders,
 * and `useAuth` flags that as `recoveryMode` so App.tsx routes here
 * instead of into the ordinary signed-in app. Submitting calls
 * `auth.updatePassword`, which clears `recoveryMode` on success and hands
 * the user into the app as a normal signed-in session - no separate
 * sign-in step required.
 */
export function ResetPasswordPage({ auth }: { auth: AuthState }) {
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [fieldErrors, setFieldErrors] = useState<{ password?: string; confirmPassword?: string }>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (submitting) return
    setFormError(null)

    const nextErrors: typeof fieldErrors = {}
    if (!isValidPassword(password)) {
      nextErrors.password = `Use at least ${MIN_PASSWORD_LENGTH} characters.`
    }
    if (confirmPassword !== password) nextErrors.confirmPassword = 'Passwords do not match.'
    setFieldErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) return

    setSubmitting(true)
    const { error } = await auth.updatePassword(password)
    setSubmitting(false)
    if (error) {
      setFormError(error)
      return
    }
    navigate('/insights', { replace: true })
  }

  return (
    <AuthCard title="Choose a new password" subtitle="This will replace your current password.">
      {formError && <AuthErrorBanner message={formError} />}
      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
        <AuthField label="New password" htmlFor="reset-password" error={fieldErrors.password}>
          <input
            id="reset-password"
            type="password"
            autoComplete="new-password"
            autoFocus
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={authInputClass(Boolean(fieldErrors.password))}
          />
        </AuthField>
        <AuthField label="Confirm new password" htmlFor="reset-confirm-password" error={fieldErrors.confirmPassword}>
          <input
            id="reset-confirm-password"
            type="password"
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className={authInputClass(Boolean(fieldErrors.confirmPassword))}
          />
        </AuthField>
        <AuthSubmitButton submitting={submitting}>Set new password</AuthSubmitButton>
      </form>
    </AuthCard>
  )
}
