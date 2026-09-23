import { describe, expect, it } from 'vitest'
import { ALL_COMPETENCIES, COMPETENCY_KEYWORDS, detectCompetencies } from '../jdKeywords'

describe('detectCompetencies (V3.2 spec section 4B: deterministic JD keyword matching, no AI)', () => {
  it('detects Teamwork from a JD mentioning cross-functional collaboration', () => {
    const results = detectCompetencies('You will collaborate closely with a cross-functional team of engineers.')
    expect(results.map((r) => r.competency)).toContain('Teamwork')
  })

  it('detects Ownership from "end-to-end" and "self-starter" language', () => {
    const results = detectCompetencies('We need a self-starter who can own the roadmap end-to-end.')
    expect(results.map((r) => r.competency)).toContain('Ownership')
  })

  it('detects Problem Solving from "data-driven" and "root cause" language', () => {
    const results = detectCompetencies('Strong analytical skills and experience with root cause analysis.')
    expect(results.map((r) => r.competency)).toContain('Problem Solving')
  })

  it('detects multiple competencies from one JD, each with its own matched keyword', () => {
    const results = detectCompetencies(
      'Lead a team through ambiguity, meet tight deadlines, and communicate clearly with stakeholders.',
    )
    const competencies = results.map((r) => r.competency)
    expect(competencies).toEqual(
      expect.arrayContaining(['Leadership', 'Adaptability', 'Time Management', 'Communication']),
    )
  })

  it('never claims a competency without a real matched keyword recorded', () => {
    const results = detectCompetencies('Collaborate with the team on our roadmap.')
    for (const result of results) {
      expect(result.matchedKeywords.length).toBeGreaterThan(0)
      for (const keyword of result.matchedKeywords) {
        expect('collaborate with the team on our roadmap.'.includes(keyword.toLowerCase())).toBe(true)
      }
    }
  })

  it('matches case-insensitively', () => {
    expect(detectCompetencies('LEADERSHIP experience required.').map((r) => r.competency)).toContain('Leadership')
  })

  it('returns an empty array for null, undefined, or blank text', () => {
    expect(detectCompetencies(null)).toEqual([])
    expect(detectCompetencies(undefined)).toEqual([])
    expect(detectCompetencies('   ')).toEqual([])
  })

  it('returns no competencies for text with none of the keyword phrases', () => {
    expect(detectCompetencies('We sell artisanal candles online.')).toEqual([])
  })

  it('every competency key in COMPETENCY_KEYWORDS has at least one keyword phrase', () => {
    for (const competency of ALL_COMPETENCIES) {
      expect(COMPETENCY_KEYWORDS[competency].length).toBeGreaterThan(0)
    }
  })
})
