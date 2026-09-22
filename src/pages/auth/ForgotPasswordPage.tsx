import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  AuthCard,
  AuthErrorBanner,
  AuthField,
  AuthSubmitButton,
  AuthSuccessBanner,
} from '../../components/auth/AuthCard'
import { authInputClass, isValidEmail } from '../../lib/authValidation'
import type { AuthState } from '../../hooks/useAuth'

export function ForgotPasswordPage({ auth }: { auth: AuthState }) {
  const [email, setEmail] = useState('')
  const [fieldError, setFieldError] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [sent, setSent] = useState(false)

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (submitting) return
    setFormError(null)

    if (!isValidEmail(email)) {
      setFieldError('Enter a valid email address.')
      return
    }
    setFieldError(null)

    setSubmitting(true)
    const { error } = await auth.requestPasswordReset(email.trim())
    setSubmitting(false)
    if (error) {
      setFormError(error)
      return
    }
    setSent(true)
  }

  if (sent) {
    return (
      <AuthCard title="Check your email" subtitle="A reset link is on its way.">
        <AuthSuccessBanner
          message={`If an account exists for ${email.trim()}, we've sent a link to reset your password. It's valid for a limited time.`}
        />
        <Link to="/sign-in" className="text-sm font-medium text-sky-600 hover:underline dark:text-sky-400">
          Back to sign in
        </Link>
      </AuthCard>
    )
  }

  return (
    <AuthCard
      title="Reset your password"
      subtitle="Enter your email and we'll send you a reset link."
      footer={
        <p>
          <Link to="/sign-in" className="font-medium text-sky-600 hover:underline dark:text-sky-400">
            Back to sign in
          </Link>
        </p>
      }
    >
      {formError && <AuthErrorBanner message={formError} />}
      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
        <AuthField label="Email" htmlFor="forgot-email" error={fieldError}>
          <input
            id="forgot-email"
            type="email"
            autoComplete="email"
            autoFocus
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={authInputClass(Boolean(fieldError))}
          />
        </AuthField>
        <AuthSubmitButton submitting={submitting}>Send reset link</AuthSubmitButton>
      </form>
    </AuthCard>
  )
}
