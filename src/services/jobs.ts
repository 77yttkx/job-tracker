import { isSupabaseConfigured, supabase } from './supabase'
import { DEFAULT_SPONSORSHIP, DEFAULT_STATUS } from '../lib/constants'
import type { Job, JobUpdate, NewJob } from '../types/job'

const TABLE = 'jobs'

/**
 * Carries a PostgREST/Supabase error's code/details/hint alongside its
 * message, instead of collapsing everything down to `message` alone. A
 * silently-empty `select` caused by an RLS policy mismatch, an RLS-denied
 * write, or a missing table all show up here with enough detail (e.g.
 * PostgREST code 42501 = insufficient_privilege, PGRST205 = table not
 * found in a stale schema cache) to tell "the query genuinely returned
 * zero rows" apart from "the query was rejected/misconfigured" - see the
 * Troubleshooting section in README.md.
 */
export class SupabaseQueryError extends Error {
  code?: string
  details?: string
  hint?: string

  constructor(message: string, opts?: { code?: string; details?: string; hint?: string }) {
    super(message)
    this.name = 'SupabaseQueryError'
    this.code = opts?.code
    this.details = opts?.details
    this.hint = opts?.hint
  }
}

function toQueryError(error: { message: string; code?: string; details?: string; hint?: string }): SupabaseQueryError {
  return new SupabaseQueryError(error.message, { code: error.code, details: error.details, hint: error.hint })
}

function assertConfigured(): void {
  if (!isSupabaseConfigured) {
    throw new Error(
      'Supabase is not configured. Copy .env.example to .env, fill in VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY, and restart the dev server.',
    )
  }
}

/** Fetches every job, most recently updated first. */
export async function fetchJobs(): Promise<Job[]> {
  assertConfigured()
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .order('updated_at', { ascending: false })
  if (error) throw toQueryError(error)
  return (data ?? []) as Job[]
}

/**
 * Creates a job, always attaching the given `userId` (the current
 * session's user id from useAuth - see src/App.tsx and
 * src/lib/import/saveRows.ts) so it is only ever visible to its owner.
 * This is belt-and-suspenders with the DB itself: `jobs.user_id` also
 * `default`s to `auth.uid()` and every RLS policy's `with check` rejects
 * an insert/update that tries to set a different owner (see
 * supabase-v2_6-multi-user.sql) - so even a client bug that forgot to
 * pass `userId`, or a tampered request that passed someone else's id,
 * cannot create or reassign a row to another user.
 *
 * Missing/unparsed fields are simply omitted (left null in the DB).
 */
export async function createJob(input: NewJob, userId: string): Promise<Job> {
  assertConfigured()
  const payload = {
    user_id: userId,
    company: input.company ?? null,
    role: input.role ?? null,
    job_url: input.job_url ?? null,
    jd: input.jd ?? null,
    applied_date: input.applied_date ?? null,
    status: input.status ?? DEFAULT_STATUS,
    notes: input.notes ?? null,
    location: input.location ?? null,
    sponsorship: input.sponsorship ?? DEFAULT_SPONSORSHIP,
  }
  const { data, error } = await supabase.from(TABLE).insert(payload).select().single()
  if (error) throw toQueryError(error)
  return data as Job
}

/** Updates arbitrary fields on a job (including status, location, sponsorship). */
export async function updateJob(jobId: string, updates: JobUpdate): Promise<Job> {
  assertConfigured()
  const { data, error } = await supabase
    .from(TABLE)
    .update(updates)
    .eq('job_id', jobId)
    .select()
    .single()
  if (error) throw toQueryError(error)
  return data as Job
}

export async function deleteJob(jobId: string): Promise<void> {
  assertConfigured()
  const { error } = await supabase.from(TABLE).delete().eq('job_id', jobId)
  if (error) throw toQueryError(error)
}
