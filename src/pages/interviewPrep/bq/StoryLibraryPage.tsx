import { useMemo, useState } from 'react'
import { Plus, Search, X } from 'lucide-react'
import { InterviewPrepShell } from '../../../components/interviewPrep/InterviewPrepShell'
import { StoryCard } from '../../../components/interviewPrep/StoryCard'
import { StoryModal } from '../../../components/interviewPrep/StoryModal'
import { EmptyState, ErrorState, LoadingState } from '../../../components/ui/DataStates'
import { PRESET_TAGS } from '../../../lib/interviewPrepConstants'
import { classNames } from '../../../lib/utils'
import type { useStories } from '../../../hooks/useStories'
import type { PersonalStory } from '../../../types/interviewPrep'

function matchesSearch(story: PersonalStory, term: string): boolean {
  if (!term) return true
  const haystack = [story.title, story.raw_story, ...story.tags].join(' ').toLowerCase()
  return haystack.includes(term.toLowerCase())
}

export function StoryLibraryPage({ storiesState }: { storiesState: ReturnType<typeof useStories> }) {
  const { stories, loading, error, errorDetail, refresh, removeStory } = storiesState

  const [search, setSearch] = useState('')
  const [activeTags, setActiveTags] = useState<Set<string>>(new Set())
  const [modalOpen, setModalOpen] = useState(false)
  const [modalStory, setModalStory] = useState<PersonalStory | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  // Tag filter chips: every preset tag, plus any custom tag actually used
  // by one of this user's stories (spec: "custom tags must work in
  // search and filtering"), de-duplicated case-insensitively and sorted.
  const allTagOptions = useMemo(() => {
    const seen = new Map<string, string>()
    for (const tag of PRESET_TAGS) seen.set(tag.toLowerCase(), tag)
    for (const story of stories) {
      for (const tag of story.tags) {
        if (!seen.has(tag.toLowerCase())) seen.set(tag.toLowerCase(), tag)
      }
    }
    return [...seen.values()].sort((a, b) => a.localeCompare(b))
  }, [stories])

  const filtered = useMemo(() => {
    return stories.filter((story) => {
      if (!matchesSearch(story, search)) return false
      if (activeTags.size === 0) return true
      const storyTagsLower = new Set(story.tags.map((t) => t.toLowerCase()))
      // AND across selected tag filters, consistent with the Table page's
      // multi-filter combination (src/lib/insightsFilters.ts).
      for (const tag of activeTags) {
        if (!storyTagsLower.has(tag.toLowerCase())) return false
      }
      return true
    })
  }, [stories, search, activeTags])

  function toggleTag(tag: string) {
    setActiveTags((prev) => {
      const next = new Set(prev)
      if (next.has(tag)) next.delete(tag)
      else next.add(tag)
      return next
    })
  }

  function openAddModal() {
    setModalStory(null)
    setModalOpen(true)
  }

  function openEditModal(story: PersonalStory) {
    setModalStory(story)
    setModalOpen(true)
  }

  async function handleDelete(storyId: string) {
    setDeleteError(null)
    try {
      await removeStory(storyId)
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Failed to delete this story.')
    }
  }

  return (
    <InterviewPrepShell>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Optional background material - notes on a project, conflict, or achievement you might draw on when
          writing an answer. Private to you.
        </p>
        <button
          type="button"
          onClick={openAddModal}
          className="flex items-center gap-1.5 rounded-md bg-sky-600 px-3 py-2 text-sm font-medium text-white hover:bg-sky-700"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          Add Story
        </button>
      </div>

      <div className="flex flex-col gap-3">
        <div className="relative max-w-sm">
          <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" aria-hidden="true" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search stories..."
            aria-label="Search stories"
            className="w-full rounded-md border border-slate-300 bg-white py-2 pl-8 pr-3 text-sm text-slate-900 shadow-sm focus:border-sky-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
          />
        </div>

        {allTagOptions.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5">
            {allTagOptions.map((tag) => {
              const active = activeTags.has(tag)
              return (
                <button
                  key={tag}
                  type="button"
                  aria-pressed={active}
                  onClick={() => toggleTag(tag)}
                  className={classNames(
                    'rounded-full border px-2.5 py-1 text-xs font-medium transition-colors',
                    active
                      ? 'border-sky-600 bg-sky-600 text-white dark:border-sky-500 dark:bg-sky-500'
                      : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300 dark:hover:bg-slate-800',
                  )}
                >
                  {tag}
                </button>
              )
            })}
            {activeTags.size > 0 && (
              <button
                type="button"
                onClick={() => setActiveTags(new Set())}
                className="flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
              >
                <X className="h-3 w-3" aria-hidden="true" />
                Clear tag filters
              </button>
            )}
          </div>
        )}
      </div>

      {deleteError && (
        <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-300">
          {deleteError}
        </p>
      )}

      {loading && stories.length === 0 ? (
        <LoadingState label="Loading stories..." />
      ) : error ? (
        <ErrorState message={error} detail={errorDetail} onRetry={refresh} />
      ) : stories.length === 0 ? (
        <EmptyState
          title="No stories yet"
          description="Add a story about a time you led, solved a problem, or overcame a challenge - useful background when you're writing an answer."
          action={
            <button
              type="button"
              onClick={openAddModal}
              className="mt-2 flex items-center gap-1.5 rounded-md bg-sky-600 px-3 py-2 text-sm font-medium text-white hover:bg-sky-700"
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              Add Story
            </button>
          }
        />
      ) : filtered.length === 0 ? (
        <EmptyState title="No matching stories" description="Try a different search term or clear your tag filters." />
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((story) => (
            <StoryCard
              key={story.story_id}
              story={story}
              onEdit={() => openEditModal(story)}
              onDelete={() => handleDelete(story.story_id)}
            />
          ))}
        </div>
      )}

      <StoryModal
        open={modalOpen}
        story={modalStory}
        onClose={() => setModalOpen(false)}
        addStory={storiesState.addStory}
        editStory={storiesState.editStory}
      />
    </InterviewPrepShell>
  )
}
