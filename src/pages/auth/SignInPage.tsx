import { useState } from 'react'
import { Link } from 'react-router-dom'
import { AuthCard, AuthErrorBanner, AuthField, AuthSubmitButton } from '../../components/auth/AuthCard'
import { authInputClass, isValidEmail } from '../../lib/authValidation'
import type { AuthState } from '../../hooks/useAuth'

export function SignInPage({ auth }: { auth: AuthState }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (submitting) return
    setFormError(null)

    const nextErrors: typeof fieldErrors = {}
    if (!isValidEmail(email)) nextErrors.email = 'Enter a valid email address.'
    if (!password) nextErrors.password = 'Enter your password.'
    setFieldErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) return

    setSubmitting(true)
    const { error } = await auth.signIn(email.trim(), password)
    setSubmitting(false)
    if (error) setFormError(error)
  }

  return (
    <AuthCard
      title="Sign in"
      subtitle="Sign in to your Job Tracker workspace."
      footer={
        <>
          <p>
            No account yet?{' '}
            <Link to="/sign-up" className="font-medium text-sky-600 hover:underline dark:text-sky-400">
              Sign up
            </Link>
          </p>
          <p className="mt-1">
            <Link to="/forgot-password" className="font-medium text-sky-600 hover:underline dark:text-sky-400">
              Forgot your password?
            </Link>
          </p>
        </>
      }
    >
      {formError && <AuthErrorBanner message={formError} />}
      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
        <AuthField label="Email" htmlFor="email" error={fieldErrors.email}>
          <input
            id="email"
            type="email"
            autoComplete="email"
            autoFocus
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={authInputClass(Boolean(fieldErrors.email))}
          />
        </AuthField>
        <AuthField label="Password" htmlFor="password" error={fieldErrors.password}>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={authInputClass(Boolean(fieldErrors.password))}
          />
        </AuthField>
        <AuthSubmitButton submitting={submitting}>Sign in</AuthSubmitButton>
      </form>
    </AuthCard>
  )
}
