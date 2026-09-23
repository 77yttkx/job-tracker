import { MAX_TAGS_PER_STORY, MAX_TAG_LENGTH } from './interviewPrepConstants'

/**
 * Normalizes a list of raw tag strings for storage: trims whitespace,
 * drops anything that's blank after trimming, enforces a max length per
 * tag, de-duplicates case-insensitively (so "Leadership" and "leadership"
 * collapse to one - the FIRST-seen casing wins, so a preset tag's casing
 * is preserved when a user's custom entry only differs by case), and caps
 * the total count. Pure/no side effects, so it's directly unit-testable
 * and shared between the Story modal's tag picker and the story-library
 * search/filter logic.
 */
export function normalizeTags(rawTags: string[]): string[] {
  const seen = new Set<string>()
  const result: string[] = []
  for (const raw of rawTags) {
    const trimmed = raw.trim().slice(0, MAX_TAG_LENGTH)
    if (!trimmed) continue
    const key = trimmed.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    result.push(trimmed)
    if (result.length >= MAX_TAGS_PER_STORY) break
  }
  return result
}

/** Adds a single tag to an existing (already-normalized) list, applying the same trim/blank/case-insensitive-duplicate/length rules. Returns the same array reference (no-op) if the tag is blank, already present, or the list is already at the cap. */
export function addTag(existingTags: string[], rawTag: string): string[] {
  const trimmed = rawTag.trim().slice(0, MAX_TAG_LENGTH)
  if (!trimmed) return existingTags
  if (existingTags.length >= MAX_TAGS_PER_STORY) return existingTags
  const alreadyPresent = existingTags.some((tag) => tag.toLowerCase() === trimmed.toLowerCase())
  if (alreadyPresent) return existingTags
  return [...existingTags, trimmed]
}

export function removeTag(existingTags: string[], tagToRemove: string): string[] {
  return existingTags.filter((tag) => tag.toLowerCase() !== tagToRemove.toLowerCase())
}

/** True if `tag` is already present in `tags`, compared case-insensitively (used to visually distinguish selected preset tags - spec section 4). */
export function hasTag(tags: string[], tag: string): boolean {
  return tags.some((t) => t.toLowerCase() === tag.toLowerCase())
}
