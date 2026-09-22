import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { parseJobHtml } from '../parseJobHtml'

const fixturesDir = join(dirname(fileURLToPath(import.meta.url)), 'fixtures')

function loadFixture(name: string): string {
  return readFileSync(join(fixturesDir, name), 'utf-8')
}

describe('parseJobHtml', () => {
  it('extracts all fields from a generic JSON-LD JobPosting', () => {
    const html = loadFixture('generic-json-ld.html')
    const result = parseJobHtml(html, 'jobs.example.com')
    expect(result.company).toBe('Acme Corp')
    expect(result.role).toBe('Senior Software Engineer')
    expect(result.jd).toContain('Visa sponsorship is available')
    expect(result.location).toBe('New York, NY, US')
    expect(result.applied_date).toBe('2026-02-01')
    expect(result.sponsorship).toBe('Yes')
    expect(result.warnings).toHaveLength(0)
  })

  it('uses Greenhouse provider hints and classifies explicit negative sponsorship language', () => {
    const html = loadFixture('greenhouse-like.html')
    const result = parseJobHtml(html, 'boards.greenhouse.io')
    expect(result.role).toBe('Backend Engineer')
    expect(result.company).toBe('Widgets Inc')
    expect(result.jd).toContain('unable to sponsor')
    expect(result.sponsorship).toBe('No')
    expect(result.source).toContain('provider:greenhouse')
  })

  it('uses Lever provider hints for location and JSON-LD for the description', () => {
    const html = loadFixture('lever-like.html')
    const result = parseJobHtml(html, 'jobs.lever.co')
    expect(result.role).toBe('Product Manager')
    expect(result.location).toBe('Remote - United States')
    expect(result.sponsorship).toBe('Yes')
  })

  it('parses a Moody\'s (Phenom, JSON-LD) style page and classifies its sponsorship language as No', () => {
    // Structure mirrors the real careers.moodys.com JobPosting JSON-LD,
    // confirmed by loading the live URL from the spec in the browser: it
    // has exactly one <script type="application/ld+json"> JobPosting block
    // with title/hiringOrganization/jobLocation/description fields.
    const html = loadFixture('moodys-like.html')
    const result = parseJobHtml(html, 'careers.moodys.com')
    expect(result.role).toBe('Data Analyst Summer Intern')
    expect(result.company).toBe('Moody\'s')
    expect(result.location).toBe('Charlotte, NC, United States')
    expect(result.jd).toContain('unable to sponsor or take over sponsorship')
    expect(result.sponsorship).toBe('No')
    expect(result.source).toContain('json-ld')
  })

  it('classifies Unknown for the real live Moody\'s posting, which currently has no sponsorship language at all', () => {
    // Fixture content mirrors the actual live page text (fetched via
    // browser on 2026-09-21): no visa/sponsorship sentence is present, so
    // per spec the correct answer is Unknown, never an inferred Yes.
    const html = loadFixture('moodys-real-no-sponsorship-mention.html')
    const result = parseJobHtml(html, 'careers.moodys.com')
    expect(result.role).toBe('Data Analyst Summer Intern')
    expect(result.location).toBe('Charlotte, United States')
    expect(result.sponsorship).toBe('Unknown')
  })

  it('degrades gracefully on a JS-only shell page: no throw, warns about missing fields', () => {
    const html = loadFixture('js-only-shell.html')
    const result = parseJobHtml(html, 'careers.example.com')
    expect(result.company).toBeNull()
    expect(result.jd).toBeNull()
    expect(result.sponsorship).toBe('Unknown')
    expect(result.warnings.length).toBeGreaterThan(0)
  })

  it('never throws on malformed JSON-LD', () => {
    const html = `<html><head><script type="application/ld+json">{not valid json</script></head><body><title>Careers</title></body></html>`
    expect(() => parseJobHtml(html, 'example.com')).not.toThrow()
  })
})
