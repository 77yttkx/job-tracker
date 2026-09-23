import { Plus, X } from 'lucide-react'
import { classNames } from '../../../lib/utils'
import { ALL_COMPETENCIES, COMPETENCY_DISPLAY_LABELS, type Competency, type DetectedCompetency } from '../../../lib/jdKeywords'

/**
 * Editable competency chips for Prepare for a Job (V3.2 spec section 4B):
 * shows every keyword-detected competency as a removable chip, labels the
 * detection transparently ("JD keyword match", never "AI analysis"), and
 * offers the remaining, non-detected competencies as addable. The
 * currently-selected set (detected minus removed, plus manually added) is
 * the parent's source of truth for recommendations - see
 * PrepareForJobPage.tsx.
 */
export function CompetencyChips({
  detected,
  selected,
  onRemove,
  onAdd,
}: {
  detected: DetectedCompetency[]
  selected: Competency[]
  onRemove: (competency: Competency) => void
  onAdd: (competency: Competency) => void
}) {
  const detectedByCompetency = new Map(detected.map((d) => [d.competency, d]))
  const addable = ALL_COMPETENCIES.filter((c) => !selected.includes(c))

  return (
    <div className="flex flex-col gap-3">
      <div>
        <p className="mb-1.5 text-sm font-medium text-slate-700 dark:text-slate-200">
          Detected competencies <span className="font-normal text-slate-400">(JD keyword match - not AI analysis)</span>
        </p>
        {selected.length === 0 ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">
            No competency keywords were detected in this job description. Add one manually below if it's relevant.
          </p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {selected.map((competency) => {
              const match = detectedByCompetency.get(competency)
              return (
                <span
                  key={competency}
                  className="flex items-center gap-1 rounded-full bg-sky-100 py-0.5 pl-2.5 pr-1 text-xs font-medium text-sky-700 dark:bg-sky-900/40 dark:text-sky-300"
                  title={
                    match
                      ? `JD keyword match: "${match.matchedKeywords[0]}"`
                      : 'Added manually - not detected in the job description text'
                  }
                >
                  {COMPETENCY_DISPLAY_LABELS[competency]}
                  <button
                    type="button"
                    onClick={() => onRemove(competency)}
                    aria-label={`Remove ${COMPETENCY_DISPLAY_LABELS[competency]}`}
                    className="rounded-full p-0.5 hover:bg-sky-200 dark:hover:bg-sky-800"
                  >
                    <X className="h-3 w-3" aria-hidden="true" />
                  </button>
                </span>
              )
            })}
          </div>
        )}
      </div>

      {addable.length > 0 && (
        <div>
          <p className="mb-1.5 text-sm font-medium text-slate-700 dark:text-slate-200">Add another competency</p>
          <div className="flex flex-wrap gap-1.5">
            {addable.map((competency) => (
              <button
                key={competency}
                type="button"
                onClick={() => onAdd(competency)}
                className={classNames(
                  'flex items-center gap-1 rounded-full border border-slate-300 bg-white py-0.5 pl-2.5 pr-2 text-xs font-medium text-slate-600 hover:bg-slate-50',
                  'dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300 dark:hover:bg-slate-800',
                )}
              >
                <Plus className="h-3 w-3" aria-hidden="true" />
                {COMPETENCY_DISPLAY_LABELS[competency]}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
