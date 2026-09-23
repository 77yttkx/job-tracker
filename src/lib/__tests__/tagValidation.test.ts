import { describe, expect, it } from 'vitest'
import { addTag, hasTag, normalizeTags, removeTag } from '../tagValidation'
import { MAX_TAGS_PER_STORY, MAX_TAG_LENGTH } from '../interviewPrepConstants'

describe('normalizeTags', () => {
  it('trims whitespace from every tag', () => {
    expect(normalizeTags(['  Leadership  ', ' Teamwork'])).toEqual(['Leadership', 'Teamwork'])
  })

  it('drops blank/whitespace-only tags', () => {
    expect(normalizeTags(['Leadership', '   ', '', '\t'])).toEqual(['Leadership'])
  })

  it('de-duplicates case-insensitively, keeping the first-seen casing', () => {
    expect(normalizeTags(['Leadership', 'leadership', 'LEADERSHIP'])).toEqual(['Leadership'])
  })

  it('treats a custom tag that only differs in case from a preset as a duplicate', () => {
    expect(normalizeTags(['leadership', 'Leadership'])).toEqual(['leadership'])
  })

  it('enforces a maximum tag length, truncating rather than rejecting', () => {
    const long = 'x'.repeat(MAX_TAG_LENGTH + 20)
    const [result] = normalizeTags([long])
    expect(result).toHaveLength(MAX_TAG_LENGTH)
  })

  it('caps the total number of tags per story', () => {
    const many = Array.from({ length: MAX_TAGS_PER_STORY + 10 }, (_, i) => `tag-${i}`)
    expect(normalizeTags(many)).toHaveLength(MAX_TAGS_PER_STORY)
  })
})

describe('addTag', () => {
  it('adds a new, trimmed tag', () => {
    expect(addTag(['Leadership'], '  Conflict  ')).toEqual(['Leadership', 'Conflict'])
  })

  it('is a no-op for a blank tag', () => {
    const tags = ['Leadership']
    expect(addTag(tags, '   ')).toBe(tags)
  })

  it('is a no-op for a case-insensitive duplicate', () => {
    const tags = ['Leadership']
    expect(addTag(tags, 'leadership')).toBe(tags)
  })

  it('is a no-op once the per-story cap is reached', () => {
    const full = Array.from({ length: MAX_TAGS_PER_STORY }, (_, i) => `tag-${i}`)
    expect(addTag(full, 'one-more')).toBe(full)
  })
})

describe('removeTag', () => {
  it('removes a tag case-insensitively', () => {
    expect(removeTag(['Leadership', 'Teamwork'], 'leadership')).toEqual(['Teamwork'])
  })
})

describe('hasTag', () => {
  it('matches case-insensitively', () => {
    expect(hasTag(['Leadership'], 'leadership')).toBe(true)
    expect(hasTag(['Leadership'], 'Conflict')).toBe(false)
  })
})
