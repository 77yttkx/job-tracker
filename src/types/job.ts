import type { JobStatus, Sponsorship } from '../lib/constants'

/**
 * Row shape as stored in Supabase `public.jobs`. `user_id` is set
 * automatically (by the client on insert, and by the column's
 * `default auth.uid()` as a DB-level safety net - see
 * supabase-v2_6-multi-user.sql) and is never user-editable, so it is
 * intentionally absent from NewJob/JobUpdate below.
 */
export interface Job {
  job_id: string
  user_id: string
  company: string | null
  role: string | null
  job_url: string | null
  jd: string | null
  applied_date: string | null // ISO date (YYYY-MM-DD)
  status: JobStatus
  notes: string | null
  location: string | null
  sponsorship: Sponsorship
  created_at: string
  updated_at: string
}

/** Payload for creating a job. job_id/created_at/updated_at are server-assigned. */
export type NewJob = {
  company?: string | null
  role?: string | null
  job_url?: string | null
  jd?: string | null
  applied_date?: string | null
  status?: JobStatus
  notes?: string | null
  location?: string | null
  sponsorship?: Sponsorship
}

/** Payload for updating a job. */
export type JobUpdate = Partial<NewJob>

/** Result of attempting to parse a job posting URL via the parse-job Edge Function. */
export interface ParsedJobFields {
  company: string | null
  role: string | null
  jd: string | null
  applied_date: string | null
  location: string | null
  sponsorship: Sponsorship
}

/** Response shape returned by the parse-job Supabase Edge Function. */
export interface ParseJobResponse {
  company: string | null
  role: string | null
  jd: string | null
  location: string | null
  sponsorship: Sponsorship
  source: string
  warnings: string[]
}

export type ParseOutcome =
  | { status: 'success'; fields: ParsedJobFields; message: string; warnings: string[] }
  | { status: 'partial'; fields: ParsedJobFields; message: string; warnings: string[] }
  | { status: 'failed'; fields: null; message: string; warnings: string[] }
