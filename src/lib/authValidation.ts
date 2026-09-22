/**
 * Pure validation helpers for the auth forms (src/pages/auth/*), kept
 * separate from the JSX so they're directly unit-testable - same
 * separation-of-concerns convention as src/lib/dateField.ts /
 * src/components/ui/DateField.tsx.
 */

/** A pragmatic email shape check - not a full RFC 5322 validator, just enough to catch an obviously incomplete/malformed address before it round-trips to Supabase. */
export function isValidEmail(value: string): boolean {
  const trimmed = value.trim()
  if (!trimmed) return false
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)
}

/** Supabase Auth's own default minimum password length. Kept as a named constant so the sign-up form's client-side check and its helper text can never drift apart. */
export const MIN_PASSWORD_LENGTH = 6

export function isValidPassword(value: string): boolean {
  return value.length >= MIN_PASSWORD_LENGTH
}

/** Shared input className for every auth form field, so focus/error styling stays identical across sign-in, sign-up, forgot- and reset-password. */
export function authInputClass(hasError = false): string {
  return [
    'w-full rounded-md border bg-white px-3 py-2 text-sm text-slate-900 shadow-sm transition-colors dark:bg-slate-950 dark:text-slate-100',
    hasError
      ? 'border-red-400 focus:border-red-500'
      : 'border-slate-300 focus:border-sky-500 dark:border-slate-700',
  ].join(' ')
}
