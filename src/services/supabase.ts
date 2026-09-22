import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

if (!supabaseUrl || !supabaseAnonKey) {
  // Do not throw: let the UI render and surface a clear error state instead
  // of a blank screen, per the PRD's "clear error states" requirement.
  // eslint-disable-next-line no-console
  console.error(
    'Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY. Copy .env.example to .env and fill in your Supabase project credentials.',
  )
}

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey)

/**
 * `persistSession`/`autoRefreshToken` keep a signed-in user's session across
 * a page refresh (stored by supabase-js in localStorage, scoped to this
 * project's own key - never shared across Supabase projects/apps).
 * `detectSessionInUrl` is required for the password-reset flow: clicking
 * the email link lands back on this app with a recovery token in the URL,
 * which supabase-js needs to read once to establish a temporary recovery
 * session (see src/hooks/useAuth.ts's handling of the PASSWORD_RECOVERY
 * event).
 */
export const supabase = createClient(supabaseUrl ?? '', supabaseAnonKey ?? '', {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
})
