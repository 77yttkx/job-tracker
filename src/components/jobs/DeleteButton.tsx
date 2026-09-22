import { useState } from 'react'
import { Trash2, Check, X } from 'lucide-react'

export function DeleteButton({ onConfirm, label }: { onConfirm: () => Promise<void>; label: string }) {
  const [confirming, setConfirming] = useState(false)
  const [deleting, setDeleting] = useState(false)

  if (confirming) {
    return (
      <span className="inline-flex items-center gap-1">
        <span className="text-xs text-slate-500 dark:text-slate-400">Delete?</span>
        <button
          type="button"
          aria-label={`Confirm delete ${label}`}
          disabled={deleting}
          onClick={async () => {
            setDeleting(true)
            try {
              await onConfirm()
            } finally {
              setDeleting(false)
              setConfirming(false)
            }
          }}
          className="rounded p-1 text-red-600 hover:bg-red-50 disabled:opacity-50 dark:text-red-400 dark:hover:bg-red-900/30"
        >
          <Check className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
        <button
          type="button"
          aria-label="Cancel delete"
          onClick={() => setConfirming(false)}
          className="rounded p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
        >
          <X className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      </span>
    )
  }

  return (
    <button
      type="button"
      aria-label={`Delete ${label}`}
      onClick={() => setConfirming(true)}
      className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/30 dark:hover:text-red-400"
    >
      <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
    </button>
  )
}
