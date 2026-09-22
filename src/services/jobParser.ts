import { isValidHttpUrl } from '../lib/utils'
import { supabase } from './supabase'
import type { ParseJobResponse, ParseOutcome, ParsedJobFields } from '../types/job'

/**
 * Parses a job posting URL by calling the parse-job Supabase Edge Function
 * (src/../supabase/functions/parse-job). This replaces the old client-side
 * fetch + public CORS proxy approach: the browser never fetches the target
 * career page directly, which sidesteps CORS entirely and lets the server
 * apply SSRF protections the browser can't enforce. See README.md for the
 * Edge Function's deployment steps and parsing limitations.
 *
 * Never throws for an ordinary parsing failure (network error, blocked
 * page, no extractable fields) - it always resolves to a ParseOutcome so
 * the caller can fall back to manual entry.
 */
export async function parseJobUrl(rawUrl: string): Promise<ParseOutcome> {
  const url = rawUrl.trim()
  if (!isValidHttpUrl(url)) {
    return {
      status: 'failed',
      fields: null,
      message: 'Enter a valid http(s) URL to parse.',
      warnings: [],
    }
  }

  let response: ParseJobResponse
  try {
    const { data, error } = await supabase.functions.invoke<ParseJobResponse>('parse-job', {
      body: { url },
    })
    if (error) throw error
    if (!data) throw new Error('No response from the parser.')
    response = data
  } catch {
    return {
      status: 'failed',
      fields: null,
      message: 'This page could not be accessed. Enter the details manually.',
      warnings: [],
    }
  }

  const fields: ParsedJobFields = {
    company: response.company,
    role: response.role,
    jd: response.jd,
    applied_date: null,
    location: response.location,
    sponsorship: response.sponsorship,
  }

  const hasAnyField = Boolean(fields.company || fields.role || fields.jd || fields.location)
  const allCoreFieldsPresent = Boolean(fields.company && fields.role && fields.jd)

  if (!hasAnyField) {
    return {
      status: 'failed',
      fields: null,
      message: 'This page could not be accessed. Enter the details manually.',
      warnings: response.warnings,
    }
  }

  if (allCoreFieldsPresent) {
    return {
      status: 'success',
      fields,
      message: `Job details extracted (via ${response.source}).`,
      warnings: response.warnings,
    }
  }

  return {
    status: 'partial',
    fields,
    message: 'Some fields could not be extracted.',
    warnings: response.warnings,
  }
}
