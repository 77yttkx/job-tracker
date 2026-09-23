import { Pencil } from 'lucide-react'
import { formatDate } from '../../lib/utils'
import { ConfirmDeleteButton } from './ConfirmDeleteButton'
import type { PersonalStory } from '../../types/interviewPrep'

export function StoryCard({
  story,
  onEdit,
  onDelete,
}: {
  story: PersonalStory
  onEdit: () => void
  onDelete: () => Promise<void>
}) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{story.title}</h3>
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            aria-label={`Edit ${story.title}`}
            onClick={onEdit}
            className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
          >
            <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
          <ConfirmDeleteButton label={story.title} onConfirm={onDelete} />
        </div>
      </div>

      {story.tags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {story.tags.map((tag) => (
            <span
              key={tag}
              className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300"
            >
              {tag}
            </span>
          ))}
        </div>
      )}

      <p className="line-clamp-3 text-sm text-slate-500 dark:text-slate-400">{story.raw_story}</p>

      <p className="border-t border-slate-100 pt-3 text-xs text-slate-400 dark:border-slate-800">
        Updated {formatDate(story.updated_at)}
      </p>
    </div>
  )
}
