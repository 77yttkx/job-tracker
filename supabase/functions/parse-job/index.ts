// Supabase Edge Function: parse-job
//
// Server-side job posting parser. The frontend Add/Edit Job modal calls
// this function (via supabase.functions.invoke('parse-job', { body })) so
// that fetching the target career page happens server-side - avoiding
// browser CORS restrictions and any need for a public CORS proxy - and so
// that no service-role or secret keys are ever exposed to the browser.
//
// Reuses the layered extraction logic in ../_shared/parsing/ - the same
// logic covered by the frontend's unit tests (src/lib/parsing/* re-exports
// from that shared location; see src/lib/parsing/parseJobHtml.ts). It lives
// under supabase/functions/ rather than src/ because the Supabase Edge
// Function bundler only includes files inside supabase/functions/ - an
// import reaching outside that directory (e.g. into src/) fails to bundle
// at deploy time.
//
// V2.6: this function now requires a signed-in caller (see
// getAuthenticatedUserId below). Deploy with:
//   supabase functions deploy parse-job --no-verify-jwt
// (--no-verify-jwt, not the platform's own JWT gate, because that gate
// can't reliably tell an anon-key-only call apart from a real user
// session with newer Supabase API key formats - so the check is done
// explicitly in this function instead, against the real Supabase Auth
// service.) See README.md "Supabase Edge Function deployment" for full
// steps, including why this project can't simply rely on
// `verify_jwt = true` in supabase/config.toml.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'
import { parseJobHtml } from '../_shared/parsing/parseJobHtml.ts'
import type { ParseJobHtmlResult } from '../_shared/parsing/parseJobHtml.ts'
import { assertSafeUrl } from './urlSafety.ts'

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

/**
 * Resolves the calling user's id from the request's Authorization header,
 * or null if the request isn't from a signed-in user.
 *
 * `supabase.functions.invoke()` on the frontend automatically sends
 * `Authorization: Bearer <session.access_token>` when the caller has an
 * active Supabase Auth session, and falls back to the anon key otherwise -
 * so no frontend call-site changes are needed for this: once App.tsx only
 * renders the parts of the UI that call this function while `auth.session`
 * is truthy (see src/App.tsx), every real call already carries a session
 * token. This function is the server-side enforcement of that: an
 * anon-key-only Authorization header resolves to no user via
 * `auth.getUser()`, so it's rejected below, whether or not the frontend
 * gating is ever bypassed.
 *
 * A short-lived client is created per request (not reused across
 * invocations) using the caller's own bearer token, scoped with the
 * project's SUPABASE_URL/SUPABASE_ANON_KEY - both auto-provided to every
 * Edge Function by the Supabase platform, no extra configuration needed.
 */
async function getAuthenticatedUserId(req: Request): Promise<string | null> {
  const authHeader = req.headers.get('Authorization') ?? req.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer ')) return null

  const token = authHeader.slice('Bearer '.length).trim()
  if (!token) return null

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')
  if (!supabaseUrl || !supabaseAnonKey) return null

  const client = createClient(supabaseUrl, supabaseAnonKey)
  const { data, error } = await client.auth.getUser(token)
  if (error || !data.user) return null
  return data.user.id
}

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const FETCH_TIMEOUT_MS = 10_000
const MAX_REDIRECTS = 5
const MAX_HTML_BYTES = 5_000_000 // 5 MB cap on response body

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  })
}

function emptyResult(warning: string): ParseJobHtmlResult {
  return {
    company: null,
    role: null,
    jd: null,
    applied_date: null,
    location: null,
    sponsorship: 'Unknown',
    source: 'none',
    warnings: [warning],
  }
}

// ---------------------------------------------------------------------------
// Server-side fetch with manual redirect handling, timeout, and a size cap
// ---------------------------------------------------------------------------

function concatChunks(chunks: Uint8Array[], total: number): Uint8Array {
  const result = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) {
    result.set(chunk, offset)
    offset += chunk.length
  }
  return result
}

async function safeFetchHtml(startUrl: URL): Promise<{ html: string; finalHostname: string }> {
  let currentUrl = startUrl

  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
    let response: Response
    try {
      response = await fetch(currentUrl.toString(), {
        redirect: 'manual',
        signal: controller.signal,
        credentials: 'omit',
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36 JobTrackerParser/1.0',
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
        },
      })
    } finally {
      clearTimeout(timer)
    }

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location')
      if (!location) throw new Error('Redirect response had no Location header.')
      const nextUrl = new URL(location, currentUrl)
      await assertSafeUrl(nextUrl)
      currentUrl = nextUrl
      continue
    }

    if (!response.ok) {
      throw new Error(`The page responded with HTTP ${response.status}.`)
    }

    const reader = response.body?.getReader()
    const chunks: Uint8Array[] = []
    let received = 0
    if (reader) {
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        received += value.byteLength
        if (received > MAX_HTML_BYTES) {
          await reader.cancel()
          throw new Error('The page response was too large to parse.')
        }
        chunks.push(value)
      }
    }
    const html = new TextDecoder('utf-8').decode(concatChunks(chunks, received))
    return { html, finalHostname: currentUrl.hostname }
  }

  throw new Error('Too many redirects.')
}

// ---------------------------------------------------------------------------
// HTTP handler
// ---------------------------------------------------------------------------

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS })
  }
  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed. Use POST with a JSON body of { "url": "..." }.' }, 405)
  }

  // V2.6: reject any caller that isn't a signed-in user before doing any
  // other work (parsing the body, fetching the target page, etc.) - see
  // getAuthenticatedUserId above for why this is checked explicitly here
  // rather than relying on the platform's own JWT gate.
  const userId = await getAuthenticatedUserId(req)
  if (!userId) {
    return jsonResponse({ error: 'Sign in required to parse job URLs.' }, 401)
  }

  let body: { url?: unknown }
  try {
    body = await req.json()
  } catch {
    return jsonResponse({ error: 'Invalid JSON request body.' }, 400)
  }

  const rawUrl = typeof body.url === 'string' ? body.url.trim() : ''
  if (!rawUrl) {
    return jsonResponse({ error: 'Missing "url" in request body.' }, 400)
  }

  let url: URL
  try {
    url = new URL(rawUrl)
  } catch {
    return jsonResponse({ error: 'That is not a valid URL.' }, 400)
  }

  try {
    await assertSafeUrl(url)
  } catch (err) {
    return jsonResponse({ error: err instanceof Error ? err.message : 'This URL is not allowed.' }, 400)
  }

  try {
    const { html, finalHostname } = await safeFetchHtml(url)
    const result = parseJobHtml(html, finalHostname)
    return jsonResponse(result)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error.'
    return jsonResponse(
      emptyResult(`This page could not be accessed (${message}). Enter the details manually.`),
    )
  }
})
