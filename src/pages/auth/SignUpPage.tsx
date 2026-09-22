import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  AuthCard,
  AuthErrorBanner,
  AuthField,
  AuthSubmitButton,
  AuthSuccessBanner,
} from '../../components/auth/AuthCard'
import { MIN_PASSWORD_LENGTH, authInputClass, isValidEmail, isValidPassword } from '../../lib/authValidation'
import type { AuthState } from '../../hooks/useAuth'

export function SignUpPage({ auth }: { auth: AuthState }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string; confirmPassword?: string }>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [confirmationSent, setConfirmationSent] = useState(false)

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (submitting) return
    setFormError(null)

    const nextErrors: typeof fieldErrors = {}
    if (!isValidEmail(email)) nextErrors.email = 'Enter a valid email address.'
    if (!isValidPassword(password)) {
      nextErrors.password = `Use at least ${MIN_PASSWORD_LENGTH} characters.`
    }
    if (confirmPassword !== password) nextErrors.confirmPassword = 'Passwords do not match.'
    setFieldErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) return

    setSubmitting(true)
    const { error, needsEmailConfirmation } = await auth.signUp(email.trim(), password)
    setSubmitting(false)
    if (error) {
      setFormError(error)
      return
    }
    if (needsEmailConfirmation) {
      setConfirmationSent(true)
      return
    }
    // No confirmation required (project setting) - the auth state
    // listener in useAuth picks up the new session and App.tsx routes
    // into the app automatically; nothing else to do here.
  }

  if (confirmationSent) {
    return (
      <AuthCard title="Check your email" subtitle="One more step before your workspace is ready.">
        <AuthSuccessBanner
          message={`We sent a confirmation link to ${email.trim()}. Open it to finish creating your account, then come back and sign in.`}
        />
        <Link to="/sign-in" className="text-sm font-medium text-sky-600 hover:underline dark:text-sky-400">
          Back to sign in
        </Link>
      </AuthCard>
    )
  }

  return (
    <AuthCard
      title="Create your account"
      subtitle="Your own private workspace - only you can see your applications."
      footer={
        <p>
          Already have an account?{' '}
          <Link to="/sign-in" className="font-medium text-sky-600 hover:underline dark:text-sky-400">
            Sign in
          </Link>
        </p>
      }
    >
      {formError && <AuthErrorBanner message={formError} />}
      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
        <AuthField label="Email" htmlFor="signup-email" error={fieldErrors.email}>
          <input
            id="signup-email"
            type="email"
            autoComplete="email"
            autoFocus
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={authInputClass(Boolean(fieldErrors.email))}
          />
        </AuthField>
        <AuthField label="Password" htmlFor="signup-password" error={fieldErrors.password}>
          <input
            id="signup-password"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={authInputClass(Boolean(fieldErrors.password))}
          />
        </AuthField>
        <AuthField label="Confirm password" htmlFor="signup-confirm-password" error={fieldErrors.confirmPassword}>
          <input
            id="signup-confirm-password"
            type="password"
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className={authInputClass(Boolean(fieldErrors.confirmPassword))}
          />
        </AuthField>
        <AuthSubmitButton submitting={submitting}>Create account</AuthSubmitButton>
      </form>
    </AuthCard>
  )
}
