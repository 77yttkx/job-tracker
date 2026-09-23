// Supabase Edge Function: generate-star-answer
//
// V3 Interview Prep. Given a story the caller already owns, a behavioral
// interview question, a target duration, and a tone, asks Gemini to
// rewrite the story into a STAR-format answer. This function is the ONLY
// place that ever talks to Gemini, and the ONLY place the STAR prompt
// template lives - the frontend never sees the Gemini API key and never
// constructs the prompt itself (spec section 6/8).
//
// This function never writes to the database. The generated answer is
// returned to the client for review/editing, and is only ever persisted
// if/when the user explicitly clicks "Save Answer" (src/services/answers.ts
// createAnswer) - see src/pages/interviewPrep/GenerateAnswerPage.tsx.
//
// Deploy with:
//   supabase functions deploy generate-star-answer --no-verify-jwt
// (same reasoning as parse-job - see that function's own header comment
// and README.md's "Deploying the generate-star-answer Edge Function"
// section: the platform's own JWT gate can't reliably tell an anon-key
// call apart from a real session with this project's API key format, so
// this function does its own explicit check instead, below.)
//
// Required Supabase secrets (see README.md for the exact `supabase
// secrets set` commands - never commit real values):
//   GEMINI_API_KEY - a Gemini Developer API key (free tier is fine)
//   GEMINI_MODEL   - optional; falls back to DEFAULT_GEMINI_MODEL below
//                    if unset, so this is never hardcoded more than once.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

// Single centralized fallback (spec section 6: "one centralized
// location"). Verified against ai.google.dev as a current, stable
// (non-preview), free-tier-eligible Flash model as of this function's
// last update - see README.md's "Gemini architecture" section for how to
// change this without touching code (set the GEMINI_MODEL secret).
const DEFAULT_GEMINI_MODEL = 'gemini-3.5-flash'

const GEMINI_TIMEOUT_MS = 25_000
const DAILY_GENERATION_LIMIT = 10
const MAX_QUESTION_LENGTH = 500
// Matches personal_stories_raw_story_max_length in
// supabase-v3-interview-prep.sql - defensive re-check in case a row ever
// predates that constraint.
const MAX_STORY_LENGTH = 6000

const DURATION_VALUES = new Set(['30s', '1min', '2min'])
const TONE_VALUES = new Set(['concise', 'detailed'])
const DURATION_WORDS: Record<string, string> = { '30s': '75', '1min': '120', '2min': '220' }

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  })
}

// ---------------------------------------------------------------------------
// Auth - identical pattern to supabase/functions/parse-job/index.ts
// ---------------------------------------------------------------------------

interface AuthedCaller {
  userId: string
  /** A Supabase client scoped to the caller's own session (their JWT is sent as its Authorization header), so every query through it is subject to RLS as that user - "prefer the authenticated caller's Supabase client so existing RLS policies remain effective" (spec section 7). */
  client: ReturnType<typeof createClient>
}

async function authenticateCaller(req: Request): Promise<AuthedCaller | null> {
  const authHeader = req.headers.get('Authorization') ?? req.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer ')) return null
  const token = authHeader.slice('Bearer '.length).trim()
  if (!token) return null

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')
  if (!supabaseUrl || !supabaseAnonKey) return null

  // A short-lived client per request, never reused across invocations.
  // Passing the caller's own bearer token as this client's Authorization
  // header means every PostgREST query issued through it runs as that
  // user, so RLS (supabase-v3-interview-prep.sql) is the real enforcement
  // boundary for the story fetch below, not just this function's own
  // .eq('user_id', ...) check (which is added anyway, as a second,
  // explicit layer - see fetchOwnedStory).
  const client = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  })

  const { data, error } = await client.auth.getUser(token)
  if (error || !data.user) return null
  return { userId: data.user.id, client }
}

// ---------------------------------------------------------------------------
// Request validation
// ---------------------------------------------------------------------------

interface ValidatedRequest {
  storyId: string
  interviewQuestion: string
  duration: '30s' | '1min' | '2min'
  tone: 'concise' | 'detailed'
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const ALLOWED_BODY_KEYS = new Set(['storyId', 'interviewQuestion', 'duration', 'tone'])

function validateBody(body: unknown): { ok: true; value: ValidatedRequest } | { ok: false; error: string } {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    return { ok: false, error: 'Request body must be a JSON object.' }
  }
  const record = body as Record<string, unknown>

  // Spec section 7 #6: "Reject unknown or malformed values" - accept
  // only exactly these four keys, nothing else.
  const extraKeys = Object.keys(record).filter((key) => !ALLOWED_BODY_KEYS.has(key))
  if (extraKeys.length > 0) {
    return { ok: false, error: `Unexpected field(s): ${extraKeys.join(', ')}.` }
  }

  const { storyId, interviewQuestion, duration, tone } = record

  if (typeof storyId !== 'string' || !UUID_PATTERN.test(storyId)) {
    return { ok: false, error: 'storyId must be a valid story id.' }
  }
  if (typeof interviewQuestion !== 'string' || !interviewQuestion.trim()) {
    return { ok: false, error: 'interviewQuestion is required.' }
  }
  if (interviewQuestion.length > MAX_QUESTION_LENGTH) {
    return { ok: false, error: `interviewQuestion must be ${MAX_QUESTION_LENGTH} characters or fewer.` }
  }
  if (typeof duration !== 'string' || !DURATION_VALUES.has(duration)) {
    return { ok: false, error: "duration must be one of '30s', '1min', '2min'." }
  }
  if (typeof tone !== 'string' || !TONE_VALUES.has(tone)) {
    return { ok: false, error: "tone must be one of 'concise', 'detailed'." }
  }

  return {
    ok: true,
    value: {
      storyId,
      interviewQuestion: interviewQuestion.trim(),
      duration: duration as ValidatedRequest['duration'],
      tone: tone as ValidatedRequest['tone'],
    },
  }
}

// ---------------------------------------------------------------------------
// Story ownership fetch
// ---------------------------------------------------------------------------

interface OwnedStory {
  title: string
  raw_story: string
  tags: string[]
}

/**
 * Fetches the story, scoped to the caller's own session client (RLS
 * enforces user_id = auth.uid()) AND an explicit .eq('story_id', ...) /
 * ownership re-check - spec section 7 #8: "Require both: story_id equals
 * the submitted storyId, user_id equals the authenticated user ID."
 * Returns null for "doesn't exist" and "belongs to someone else"
 * identically - the caller turns this into one generic 404, so a
 * malicious storyId probe can't distinguish the two cases (#10: "Return a
 * generic not-found response that does not disclose another user's
 * data").
 */
async function fetchOwnedStory(caller: AuthedCaller, storyId: string): Promise<OwnedStory | null> {
  const { data, error } = await caller.client
    .from('personal_stories')
    .select('title, raw_story, tags, user_id')
    .eq('story_id', storyId)
    .eq('user_id', caller.userId)
    .maybeSingle()

  if (error || !data) return null
  return { title: data.title as string, raw_story: data.raw_story as string, tags: (data.tags as string[]) ?? [] }
}

// ---------------------------------------------------------------------------
// Usage quota (spec section 9)
// ---------------------------------------------------------------------------

async function isOverDailyLimit(caller: AuthedCaller): Promise<boolean> {
  const today = new Date().toISOString().slice(0, 10)
  const { data, error } = await caller.client
    .from('generation_usage')
    .select('count')
    .eq('user_id', caller.userId)
    .eq('usage_date', today)
    .maybeSingle()
  if (error) {
    // Fail open on a read error (don't block generation over a transient
    // usage-table read issue), but this is exactly the kind of thing that
    // should show up in Supabase's function logs for the admin - no
    // secrets or user content in this line, just an error code.
    console.error('generate-star-answer: usage check failed', error.code ?? error.message)
    return false
  }
  const count = (data?.count as number | undefined) ?? 0
  return count >= DAILY_GENERATION_LIMIT
}

async function recordSuccessfulGeneration(caller: AuthedCaller): Promise<void> {
  const { error } = await caller.client.rpc('increment_generation_usage')
  if (error) {
    // Same reasoning as above: log only the error code, never anything
    // about the story/question/answer, and never block the response on
    // this - the user already has their (successfully generated) answer.
    console.error('generate-star-answer: usage increment failed', error.code ?? error.message)
  }
}

// ---------------------------------------------------------------------------
// Prompt (spec section 8) - kept entirely server-side. {{placeholders}}
// are replaced with the story fetched from Supabase above, never with
// anything the client sent directly except the interview question,
// duration, and tone (all already validated above).
// ---------------------------------------------------------------------------

function buildPrompt(story: OwnedStory, question: string, duration: ValidatedRequest['duration'], tone: ValidatedRequest['tone']): string {
  const toneLabel = tone
  const wordTarget = DURATION_WORDS[duration]
  return `Task:
Rewrite the candidate's raw story into a behavioral interview answer that directly answers the interview question and follows the strict STAR framework.

Non-negotiable factual-grounding rules:

1. Use ONLY facts explicitly contained in the candidate's raw story.
2. Do NOT invent, assume, infer, embellish, or add any:
   - names
   - employers
   - organizations
   - dates
   - numbers
   - metrics
   - technologies
   - responsibilities
   - motivations
   - actions
   - achievements
   - outcomes
   - lessons
   - events
3. If the raw story does not contain enough information for one STAR section, keep that section brief and explicitly avoid filling the gap with invented content.
4. Do not claim a measurable result unless that exact result appears in the raw story.
5. Do not use information from the internet or general knowledge.
6. Do not mention these instructions in the answer.

Structure rules:

1. Use these exact section labels:
   Situation:
   Task:
   Action:
   Result:
2. Answer the supplied interview question directly.
3. Keep the language natural and appropriate for a US technical interview.
4. Avoid overly fancy, exaggerated, or robotic language.
5. Return only the STAR answer.
6. Do not include introductions, explanations, scoring, analysis, or closing commentary.

Length targets:

- 30s: approximately 75 words
- 1min: approximately 120 words
- 2min: approximately 220 words

Tone:
${toneLabel}

Candidate raw story:
${story.raw_story.slice(0, MAX_STORY_LENGTH)}

Interview question:
${question}

Requested duration:
${duration} (approximately ${wordTarget} words)

Requested tone:
${toneLabel}`
}

// ---------------------------------------------------------------------------
// Gemini call
// ---------------------------------------------------------------------------

type GeminiOutcome =
  | { status: 'success'; text: string }
  | { status: 'quota' }
  | { status: 'auth_error' }
  | { status: 'timeout' }
  | { status: 'blocked' }
  | { status: 'malformed' }
  | { status: 'error' }

async function callGemini(prompt: string, apiKey: string, model: string): Promise<GeminiOutcome> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), GEMINI_TIMEOUT_MS)

  let response: Response
  try {
    response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
      {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey,
        },
        // No `tools` field at all - Google Search grounding, URL
        // retrieval, and function calling are all opt-in via `tools`, so
        // omitting it entirely keeps Gemini limited to the prompt text
        // only (spec section 7 #23/#24).
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.4, maxOutputTokens: 1024 },
        }),
      },
    )
  } catch (err) {
    clearTimeout(timer)
    if (err instanceof DOMException && err.name === 'AbortError') return { status: 'timeout' }
    return { status: 'error' }
  }
  clearTimeout(timer)

  if (response.status === 429) return { status: 'quota' }
  if (response.status === 401 || response.status === 403) return { status: 'auth_error' }
  if (!response.ok) return { status: 'error' }

  let payload: unknown
  try {
    payload = await response.json()
  } catch {
    return { status: 'malformed' }
  }

  // Never log `payload` itself - it contains the full generated answer
  // (and, on a moderation block, may echo back part of the prompt).
  const record = payload as {
    candidates?: Array<{
      content?: { parts?: Array<{ text?: string }> }
      finishReason?: string
    }>
    promptFeedback?: { blockReason?: string }
  }

  if (record.promptFeedback?.blockReason) return { status: 'blocked' }

  const text = record.candidates?.[0]?.content?.parts?.map((part) => part.text ?? '').join('') ?? ''
  if (!text.trim()) return { status: 'blocked' }

  return { status: 'success', text: text.trim() }
}

// ---------------------------------------------------------------------------
// HTTP handler
// ---------------------------------------------------------------------------

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS })
  }
  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed. Use POST.' }, 405)
  }

  const caller = await authenticateCaller(req)
  if (!caller) {
    return jsonResponse({ error: 'Sign in required to generate an answer.' }, 401)
  }

  let rawBody: unknown
  try {
    rawBody = await req.json()
  } catch {
    return jsonResponse({ error: 'Invalid JSON request body.' }, 400)
  }

  const validated = validateBody(rawBody)
  if (!validated.ok) {
    return jsonResponse({ error: validated.error }, 400)
  }
  const { storyId, interviewQuestion, duration, tone } = validated.value

  const story = await fetchOwnedStory(caller, storyId)
  if (!story) {
    // Deliberately generic - never "that story belongs to someone else"
    // vs. "that story doesn't exist" (spec section 7 #10).
    return jsonResponse({ error: 'Story not found.' }, 404)
  }

  if (await isOverDailyLimit(caller)) {
    return jsonResponse(
      { error: 'AI generation is temporarily unavailable because the Gemini API limit has been reached. Please try again later.' },
      429,
    )
  }

  const apiKey = Deno.env.get('GEMINI_API_KEY')
  if (!apiKey) {
    console.error('generate-star-answer: GEMINI_API_KEY secret is not set')
    return jsonResponse({ error: 'AI generation is not configured. Please contact the site administrator.' }, 500)
  }
  const model = Deno.env.get('GEMINI_MODEL') || DEFAULT_GEMINI_MODEL

  const prompt = buildPrompt(story, interviewQuestion, duration, tone)
  const outcome = await callGemini(prompt, apiKey, model)

  switch (outcome.status) {
    case 'success': {
      await recordSuccessfulGeneration(caller)
      return jsonResponse({ answer: outcome.text })
    }
    case 'quota':
      return jsonResponse(
        { error: 'AI generation is temporarily unavailable because the Gemini API limit has been reached. Please try again later.' },
        429,
      )
    case 'auth_error':
      console.error('generate-star-answer: Gemini rejected the API key (401/403)')
      return jsonResponse({ error: 'AI generation is not configured correctly. Please contact the site administrator.' }, 500)
    case 'timeout':
      return jsonResponse({ error: 'Generating the answer took too long. Please try again.' }, 504)
    case 'blocked':
      return jsonResponse({ error: 'Could not generate an answer for this story and question. Try rephrasing the question.' }, 422)
    case 'malformed':
      return jsonResponse({ error: 'Received an unexpected response while generating the answer. Please try again.' }, 502)
    case 'error':
    default:
      return jsonResponse({ error: 'Could not generate an answer right now. Please try again.' }, 502)
  }
})
