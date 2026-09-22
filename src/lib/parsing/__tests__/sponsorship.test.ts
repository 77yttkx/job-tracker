import { describe, expect, it } from 'vitest'
import { classifySponsorship } from '../sponsorship'

describe('classifySponsorship', () => {
  it('classifies the exact Moody\'s no-sponsorship language as No', () => {
    const text =
      'Applicants must be authorized to work for any employer in the U.S. We are unable to sponsor or take over sponsorship of employment visas at this time.'
    expect(classifySponsorship(text)).toBe('No')
  })

  it.each([
    'We are unable to sponsor visas for this role.',
    'Unfortunately we will not sponsor candidates requiring a visa.',
    'There is no visa sponsorship available for this position.',
    'You must be authorized to work in the US without sponsorship.',
    'We are unable to sponsor or take over sponsorship at this time.',
    'The company does not provide visa sponsorship for this role.',
  ])('returns No for explicit negative language: %s', (text) => {
    expect(classifySponsorship(text)).toBe('No')
  })

  it.each([
    'Visa sponsorship is available for qualified candidates.',
    'We sponsor H-1B visas for eligible employees.',
    'Employment visa sponsorship provided for this role.',
    'We are open to sponsoring qualified international candidates.',
  ])('returns Yes for explicit positive language: %s', (text) => {
    expect(classifySponsorship(text)).toBe('Yes')
  })

  it.each([
    null,
    undefined,
    '',
    '   ',
    'This is a great opportunity to join our growing team.',
    'Competitive salary and benefits package included.',
  ])('returns Unknown when sponsorship is absent from the text: %s', (text) => {
    expect(classifySponsorship(text)).toBe('Unknown')
  })

  it('returns Unknown for contradictory signals rather than guessing', () => {
    const text =
      'We previously did not sponsor visas, but we sponsor H-1B visas for select roles this year.'
    expect(classifySponsorship(text)).toBe('Unknown')
  })

  it('never infers Yes merely because no restriction is mentioned', () => {
    expect(classifySponsorship('Join our fast-growing analytics team in Charlotte.')).toBe(
      'Unknown',
    )
  })
})
