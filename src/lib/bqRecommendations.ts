import type { BehaviorAnswer, PersonalStory } from '../types/interviewPrep'

/**
 * Ranks a user's saved answers/stories against a set of selected
 * competency tags (V3.2 spec section 4C) - pure, deterministic, no
 * network/model call. "Exact tag matches above weaker/partial matches":
 * an item that carries every selected tag ranks above one that carries
 * only some of them, and among ties, the most recently updated item
 * ranks first (consistent with fetchAnswers/fetchStories already
 * ordering by `updated_at desc` - see src/services/answers.ts /
 * src/services/stories.ts).
 */

export interface Recommendation<T> {
  item: T
  /** The selected tags this item actually carries, in selection order - used to build the "Matches X and Y" explanation (spec section 4C). */
  matchedTags: string[]
  /** True when `matchedTags` covers every selected tag (a full/"exact" match), false for a partial match. */
  isExactMatch: boolean
}

function rank<T extends { tags: string[]; updated_at: string }>(
  items: T[],
  selectedTags: string[],
): Recommendation<T>[] {
  const selectedLower = selectedTags.map((t) => t.toLowerCase())
  const recommendations: Recommendation<T>[] = []

  for (const item of items) {
    const itemTagsLower = new Set(item.tags.map((t) => t.toLowerCase()))
    const matchedTags = selectedTags.filter((_, i) => itemTagsLower.has(selectedLower[i]))
    if (matchedTags.length === 0) continue
    recommendations.push({
      item,
      matchedTags,
      isExactMatch: matchedTags.length === selectedTags.length,
    })
  }

  recommendations.sort((a, b) => {
    if (b.matchedTags.length !== a.matchedTags.length) return b.matchedTags.length - a.matchedTags.length
    return b.item.updated_at.localeCompare(a.item.updated_at)
  })

  return recommendations
}

/** Recommends saved answers whose tags overlap the selected competency tags, ranked exact-match-first (spec section 4C). Returns an empty array if `selectedTags` is empty or nothing matches. */
export function recommendAnswers(
  answers: BehaviorAnswer[],
  selectedTags: string[],
): Recommendation<BehaviorAnswer>[] {
  if (selectedTags.length === 0) return []
  return rank(answers, selectedTags)
}

/** Recommends personal stories whose tags overlap the selected competency tags, ranked the same way as recommendAnswers. */
export function recommendStories(
  stories: PersonalStory[],
  selectedTags: string[],
): Recommendation<PersonalStory>[] {
  if (selectedTags.length === 0) return []
  return rank(stories, selectedTags)
}

/** Builds the plain-language explanation shown under a recommendation, e.g. "Matches Ownership and Problem Solving from this job description." (spec section 4C's exact example format). */
export function explainMatch(matchedTags: string[]): string {
  if (matchedTags.length === 0) return ''
  if (matchedTags.length === 1) return `Matches ${matchedTags[0]} from this job description.`
  const head = matchedTags.slice(0, -1).join(', ')
  const tail = matchedTags[matchedTags.length - 1]
  return `Matches ${head} and ${tail} from this job description.`
}
