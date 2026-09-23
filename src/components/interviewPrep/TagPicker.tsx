import { useState } from 'react'
import { Plus, X } from 'lucide-react'
import { PRESET_TAGS } from '../../lib/interviewPrepConstants'
import { addTag, hasTag, removeTag } from '../../lib/tagValidation'
import { classNames } from '../../lib/utils'

/**
 * Tag editor used in the Add/Edit Story modal and the New/Edit Answer
 * modal: shows the currently-selected tags as removable chips, preset
 * tags as toggleable suggestions (visually distinguished when already
 * selected), and a free-text input for custom tags. All add/remove
 * operations go through src/lib/tagValidation.ts, so trimming,
 * blank-rejection, the per-item cap, and case-insensitive de-duplication
 * are enforced identically everywhere this is used.
 *
 * `presetTags` defaults to the Story preset list (PRESET_TAGS) for
 * backward compatibility with StoryModal; AnswerModal passes ANSWER_TAGS
 * instead (see src/lib/interviewPrepConstants.ts for why they're two
 * separate lists).
 */
export function TagPicker({
  tags,
  onChange,
  presetTags = PRESET_TAGS,
}: {
  tags: string[]
  onChange: (tags: string[]) => void
  presetTags?: readonly string[]
}) {
  const [draft, setDraft] = useState('')

  function handleAddDraft() {
    if (!draft.trim()) return
    onChange(addTag(tags, draft))
    setDraft('')
  }

  return (
    <div className="flex flex-col gap-2">
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {tags.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center gap-1 rounded-full bg-sky-100 px-2.5 py-1 text-xs font-medium text-sky-700 dark:bg-sky-900/40 dark:text-sky-300"
            >
              {tag}
              <button
                type="button"
                aria-label={`Remove tag ${tag}`}
                onClick={() => onChange(removeTag(tags, tag))}
                className="rounded-full p-0.5 hover:bg-sky-200 dark:hover:bg-sky-800"
              >
                <X className="h-3 w-3" aria-hidden="true" />
              </button>
            </span>
          ))}
        </div>
      )}

      <div className="flex flex-wrap gap-1.5">
        {presetTags.map((preset) => {
          const selected = hasTag(tags, preset)
          return (
            <button
              key={preset}
              type="button"
              aria-pressed={selected}
              onClick={() => onChange(selected ? removeTag(tags, preset) : addTag(tags, preset))}
              className={classNames(
                'rounded-full border px-2.5 py-1 text-xs font-medium transition-colors',
                selected
                  ? 'border-sky-600 bg-sky-600 text-white dark:border-sky-500 dark:bg-sky-500'
                  : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300 dark:hover:bg-slate-800',
              )}
            >
              {preset}
            </button>
          )
        })}
      </div>

      <div className="flex gap-2">
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              handleAddDraft()
            }
          }}
          placeholder="Add a custom tag"
          className="w-full rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-900 shadow-sm transition-colors focus:border-sky-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
        />
        <button
          type="button"
          onClick={handleAddDraft}
          className="flex shrink-0 items-center gap-1 rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
        >
          <Plus className="h-3.5 w-3.5" aria-hidden="true" />
          Add
        </button>
      </div>
    </div>
  )
}
