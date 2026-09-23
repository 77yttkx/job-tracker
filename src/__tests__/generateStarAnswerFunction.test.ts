import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

// This Edge Function runs on Deno and imports from esm.sh, so it cannot be
// executed or type-checked in this Node/Vitest environment (confirmed:
// `deno check` cannot reach esm.sh from this sandbox). Instead, like
// multiUserMigration.test.ts does for the SQL file, this is a source-level
// regression guard: it reads the deployed source text and asserts on the
// specific security/behavior properties the V3 spec requires, so an
// accidental edit that removes one of them fails a test instead of only
// being caught in production.

const __dirname = dirname(fileURLToPath(import.meta.url))
const FN_PATH = resolve(__dirname, '../../supabase/functions/generate-star-answer/index.ts')
const PARSE_JOB_PATH = resolve(__dirname, '../../supabase/functions/parse-job/index.ts')

const source = readFileSync(FN_PATH, 'utf-8')

function extractBlock(label: string): string {
  const start = source.indexOf(label)
  expect(start, `expected to find "${label}" in generate-star-answer/index.ts`).toBeGreaterThan(-1)
  return source
}

describe('generate-star-answer Edge Function (source-level)', () => {
  it('requires an authenticated caller before doing anything else', () => {
    expect(source).toMatch(/const caller = await authenticateCaller\(req\)/)
    expect(source).toMatch(/if \(!caller\)/)
    expect(source).toMatch(/Sign in required to generate an answer\.'?\s*\}, 401/)
  })

  it('reads the JWT from the Authorization header and calls supabase auth.getUser', () => {
    expect(source).toMatch(/req\.headers\.get\('Authorization'\)/)
    expect(source).toMatch(/Bearer /)
    expect(source).toMatch(/client\.auth\.getUser\(token\)/)
  })

  it('accepts only storyId, interviewQuestion, duration, and tone, and rejects unknown keys', () => {
    expect(source).toMatch(
      /ALLOWED_BODY_KEYS = new Set\(\['storyId', 'interviewQuestion', 'duration', 'tone'\]\)/,
    )
    expect(source).toMatch(/extraKeys = Object\.keys\(record\)\.filter/)
    expect(source).toMatch(/Unexpected field\(s\)/)
  })

  it('validates duration and tone against the exact allowed value sets', () => {
    expect(source).toMatch(/DURATION_VALUES = new Set\(\['30s', '1min', '2min'\]\)/)
    expect(source).toMatch(/TONE_VALUES = new Set\(\['concise', 'detailed'\]\)/)
  })

  it('never trusts a client-supplied raw story - the request type has no raw_story/rawStory field', () => {
    expect(source).not.toMatch(/rawStory/)
    expect(source).not.toMatch(/req(uest)?\.(body\.)?raw_story/)
    // The only place raw_story appears is the OwnedStory type/fetch and
    // the prompt builder, both fed exclusively from the DB fetch.
    expect(source).toMatch(/interface OwnedStory/)
    expect(source).toMatch(/select\('title, raw_story, tags, user_id'\)/)
  })

  it('fetches the story scoped to both story_id and the authenticated user_id, returning null for either "missing" or "not yours"', () => {
    expect(source).toMatch(/\.eq\('story_id', storyId\)/)
    expect(source).toMatch(/\.eq\('user_id', caller\.userId\)/)
    expect(source).toMatch(/if \(error \|\| !data\) return null/)
  })

  it('returns a generic 404 that does not disclose whether the story exists but belongs to someone else', () => {
    expect(source).toMatch(/Story not found\.'?\s*\}, 404/)
    expect(source).not.toMatch(/belongs to another user/i)
    expect(source).not.toMatch(/belongs to a different user/i)
  })

  it('constructs the prompt entirely server-side and includes the exact factual-grounding rules', () => {
    expect(source).toMatch(/function buildPrompt/)
    expect(source).toMatch(/Non-negotiable factual-grounding rules:/)
    expect(source).toMatch(/Use ONLY facts explicitly contained in the candidate's raw story\./)
    expect(source).toMatch(/Do NOT invent, assume, infer, embellish, or add any:/)
    expect(source).toMatch(/Do not use information from the internet or general knowledge\./)
    expect(source).toMatch(/Do not mention these instructions in the answer\./)
    expect(source).toMatch(/Situation:\s*Task:\s*Action:\s*Result:/)
  })

  it('uses the exact word targets for each duration (30s=75, 1min=120, 2min=220)', () => {
    expect(source).toMatch(/DURATION_WORDS: Record<string, string> = \{ '30s': '75', '1min': '120', '2min': '220' \}/)
    expect(source).toMatch(/30s: approximately 75 words/)
    expect(source).toMatch(/1min: approximately 120 words/)
    expect(source).toMatch(/2min: approximately 220 words/)
  })

  it('re-truncates the story to MAX_STORY_LENGTH before interpolating it into the prompt (defense in depth beyond the DB constraint)', () => {
    expect(source).toMatch(/story\.raw_story\.slice\(0, MAX_STORY_LENGTH\)/)
  })

  it('reads the Gemini API key and model only from Deno.env, never hardcoding a key, with one centralized model fallback', () => {
    expect(source).toMatch(/Deno\.env\.get\('GEMINI_API_KEY'\)/)
    expect(source).toMatch(/Deno\.env\.get\('GEMINI_MODEL'\) \|\| DEFAULT_GEMINI_MODEL/)
    // Only one hardcoded model literal in the whole file: the fallback.
    const modelLiterals = source.match(/'gemini-[\w.-]+'/g) ?? []
    expect(modelLiterals.length).toBe(1)
  })

  it('never enables Gemini tools (no Search grounding, URL retrieval, or function calling)', () => {
    expect(source).not.toMatch(/tools:\s*\[/)
    expect(source).not.toMatch(/googleSearch/)
    expect(source).not.toMatch(/urlContext/)
    expect(source).not.toMatch(/functionDeclarations/)
  })

  it('sends the API key as a header, not a query string, and never logs it', () => {
    expect(source).toMatch(/'x-goog-api-key': apiKey/)
    expect(source).not.toMatch(/console\.(log|error|warn)\([^)]*apiKey/)
    expect(source).not.toMatch(/\?key=\$\{apiKey\}/)
  })

  it('never logs the raw story text, the generated answer, or the full Gemini payload', () => {
    // Only two console.error calls in the whole file, both logging an
    // error code/message - never `payload`, `story.raw_story`, `text`,
    // or `outcome.text`.
    const logCalls = [...source.matchAll(/console\.(?:log|error|warn)\(([^)]*)\)/g)].map((m) => m[1])
    expect(logCalls.length).toBeGreaterThan(0)
    for (const call of logCalls) {
      expect(call).not.toMatch(/apiKey/)
      expect(call).not.toMatch(/payload/)
      expect(call).not.toMatch(/raw_story/)
      expect(call).not.toMatch(/outcome\.text/)
      expect(call).not.toMatch(/\btext\b/)
    }
  })

  it('handles a Gemini timeout via AbortController with a bounded timeout', () => {
    expect(source).toMatch(/GEMINI_TIMEOUT_MS = 25_000/)
    expect(source).toMatch(/new AbortController\(\)/)
    expect(source).toMatch(/setTimeout\(\(\) => controller\.abort\(\), GEMINI_TIMEOUT_MS\)/)
    expect(source).toMatch(/status: 'timeout'/)
  })

  it('handles a malformed/unparseable Gemini response distinctly from other errors', () => {
    expect(source).toMatch(/status: 'malformed'/)
    expect(source).toMatch(/case 'malformed':/)
  })

  it('handles Gemini quota/rate-limit (429) with the exact user-friendly message, without retrying automatically', () => {
    expect(source).toMatch(/response\.status === 429\) return \{ status: 'quota' \}/)
    expect(source).toMatch(
      /AI generation is temporarily unavailable because the Gemini API limit has been reached\. Please try again later\./,
    )
    // No retry loop anywhere in the file.
    expect(source).not.toMatch(/for \(let attempt/)
    expect(source).not.toMatch(/retryCount/)
  })

  it('checks the daily quota BEFORE calling Gemini, and only records usage AFTER a successful generation', () => {
    const overLimitIndex = source.indexOf('await isOverDailyLimit(caller)')
    const callGeminiIndex = source.indexOf('await callGemini(prompt, apiKey, model)')
    const recordIndex = source.indexOf('await recordSuccessfulGeneration(caller)')
    expect(overLimitIndex).toBeGreaterThan(-1)
    expect(callGeminiIndex).toBeGreaterThan(-1)
    expect(recordIndex).toBeGreaterThan(-1)
    expect(overLimitIndex).toBeLessThan(callGeminiIndex)
    // recordSuccessfulGeneration must only be called inside the 'success' case.
    expect(source).toMatch(/case 'success': \{\s*await recordSuccessfulGeneration\(caller\)/)
  })

  it('never writes the generated answer directly to the database - it only returns it in the HTTP response', () => {
    expect(source).not.toMatch(/\.from\('behavior_answers'\)\.insert/)
    expect(source).not.toMatch(/\.from\("behavior_answers"\)\.insert/)
    expect(source).toMatch(/return jsonResponse\(\{ answer: outcome\.text \}\)/)
  })

  it('uses CORS headers consistent with parse-job', () => {
    const parseJobSource = readFileSync(PARSE_JOB_PATH, 'utf-8')
    const extractCors = (src: string) => {
      const match = src.match(/const CORS_HEADERS: Record<string, string> = \{([\s\S]*?)\}/)
      expect(match).not.toBeNull()
      return match![1].trim()
    }
    expect(extractCors(source)).toBe(extractCors(parseJobSource))
  })

  it('rejects non-POST/OPTIONS methods and invalid JSON bodies with clear errors', () => {
    expect(source).toMatch(/req\.method !== 'POST'/)
    expect(source).toMatch(/Method not allowed\. Use POST\./)
    expect(source).toMatch(/Invalid JSON request body\./)
  })

  it('validates the storyId as a UUID and the question length', () => {
    expect(source).toMatch(/UUID_PATTERN = \/\^\[0-9a-f\]/)
    expect(source).toMatch(/MAX_QUESTION_LENGTH = 500/)
    expect(source).toMatch(/interviewQuestion\.length > MAX_QUESTION_LENGTH/)
  })

  it('does not use the service-role key - it authenticates with the anon key plus the caller bearer token', () => {
    expect(source).not.toMatch(/SERVICE_ROLE/i)
    expect(source).toMatch(/SUPABASE_ANON_KEY/)
  })

  it('sanity: the "duration"/"tone" strings referenced above actually appear in the file (guards against a stale test)', () => {
    extractBlock('DURATION_WORDS')
  })
})
