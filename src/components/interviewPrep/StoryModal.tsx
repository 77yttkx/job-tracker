import { useEffect, useId, useRef, useState } from 'react'
import { Loader2, X } from 'lucide-react'
import { MAX_STORY_LENGTH, MAX_STORY_TITLE_LENGTH } from '../../lib/interviewPrepConstants'
import { TagPicker } from './TagPicker'
import type { NewStory, PersonalStory, StoryUpdate } from '../../types/interviewPrep'

interface StoryModalProps {
  open: boolean
  story: PersonalStory | null
  onClose: () => void
  addStory: (input: NewStory) => Promise<PersonalStory>
  editStory: (storyId: string, updates: StoryUpdate) => Promise<PersonalStory>
}

interface FormState {
  title: string
  raw_story: string
  tags: string[]
}

const EMPTY_FORM: FormState = { title: '', raw_story: '', tags: [] }

function storyToForm(story: PersonalStory): FormState {
  return { title: story.title, raw_story: story.raw_story, tags: story.tags }
}

/**
 * Add/Edit Story modal - the ONLY place a story's own text is created or
 * edited (spec section 4: "The original story must remain editable only
 * in Story Library"). The Generate STAR Answer page displays a selected
 * story read-only and never writes back to personal_stories.
 */
export function StoryModal({ open, story, onClose, addStory, editStory }: StoryModalProps) {
  const isEdit = story !== null
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [errors, setErrors] = useState<Partial<Record<'title' | 'raw_story', string>>>({})
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const firstFieldRef = useRef<HTMLInputElement>(null)
  const titleId = useId()

  useEffect(() => {
    if (!open) return
    setForm(story ? storyToForm(story) : EMPTY_FORM)
    setErrors({})
    setSaveError(null)
  }, [open, story])

  useEffect(() => {
    if (open) firstFieldRef.current?.focus()
  }, [open])

  useEffect(() => {
    if (!open) return
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [open, onClose])

  if (!open) return null

  function validate(): boolean {
    const nextErrors: Partial<Record<'title' | 'raw_story', string>> = {}
    if (!form.title.trim()) nextErrors.title = 'Enter a title for this story.'
    if (!form.raw_story.trim()) nextErrors.raw_story = 'Enter the story itself.'
    setErrors(nextErrors)
    return Object.keys(nextErrors).length === 0
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (saving) return
    if (!validate()) return

    setSaving(true)
    setSaveError(null)
    const payload: NewStory = {
      title: form.title.trim(),
      raw_story: form.raw_story.trim(),
      tags: form.tags,
    }
    try {
      if (isEdit && story) {
        await editStory(story.story_id, payload)
      } else {
        await addStory(payload)
      }
      onClose()
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to save this story.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 p-0 sm:items-center sm:p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-xl bg-white shadow-xl dark:bg-slate-900 sm:rounded-xl"
      >
        <form onSubmit={handleSubmit} noValidate>
          <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-slate-800">
            <h2 id={titleId} className="text-base font-semibold">
              {isEdit ? 'Edit Story' : 'Add Story'}
            </h2>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close dialog"
              className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800"
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>

          <div className="flex flex-col gap-4 px-5 py-4">
            <Field label="Title" htmlFor="story-title" error={errors.title}>
              <input
                ref={firstFieldRef}
                id="story-title"
                type="text"
                maxLength={MAX_STORY_TITLE_LENGTH}
                value={form.title}
                onChange={(e) => {
                  setForm((prev) => ({ ...prev, title: e.target.value }))
                  setErrors((prev) => ({ ...prev, title: undefined }))
                }}
                className={inputClass(Boolean(errors.title))}
              />
            </Field>

            <Field label="Story" htmlFor="story-raw" error={errors.raw_story}>
              <textarea
                id="story-raw"
                rows={8}
                maxLength={MAX_STORY_LENGTH}
                placeholder="Describe what happened, in your own words - who was involved, what you did, and what came of it. You'll write your interview question separately later."
                value={form.raw_story}
                onChange={(e) => {
                  setForm((prev) => ({ ...prev, raw_story: e.target.value }))
                  setErrors((prev) => ({ ...prev, raw_story: undefined }))
                }}
                className={inputClass(Boolean(errors.raw_story))}
              />
              <p className="mt-1 text-right text-xs text-slate-400">
                {form.raw_story.length}/{MAX_STORY_LENGTH}
              </p>
            </Field>

            <Field label="Tags" htmlFor="story-tags">
              <TagPicker tags={form.tags} onChange={(tags) => setForm((prev) => ({ ...prev, tags }))} />
            </Field>

            {saveError && (
              <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-300">
                {saveError}
              </p>
            )}
          </div>

          <div className="flex justify-end gap-2 border-t border-slate-200 px-5 py-4 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-1.5 rounded-md bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-700 disabled:opacity-60"
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
              {isEdit ? 'Save changes' : 'Add story'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function Field({
  label,
  htmlFor,
  error,
  children,
}: {
  label: string
  htmlFor: string
  error?: string
  children: React.ReactNode
}) {
  return (
    <div>
      <label htmlFor={htmlFor} className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">
        {label}
      </label>
      {children}
      {error && (
        <p role="alert" className="mt-1 text-xs text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
    </div>
  )
}

function inputClass(hasError: boolean): string {
  return [
    'w-full rounded-md border bg-white px-3 py-2 text-sm text-slate-900 shadow-sm transition-colors dark:bg-slate-950 dark:text-slate-100',
    hasError
      ? 'border-red-400 focus:border-red-500'
      : 'border-slate-300 focus:border-sky-500 dark:border-slate-700',
  ].join(' ')
}
