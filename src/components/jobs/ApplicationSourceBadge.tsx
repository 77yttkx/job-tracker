import { classNames } from '../../lib/utils'
import type { ApplicationSource } from '../../lib/constants'

/**
 * Application Source badge (V3.6). Deliberately neutral/single-color
 * (unlike Status/Sponsorship) - the product spec calls for a restrained
 * design with limited accent colors, and source is a tracking label
 * rather than a progress/outcome signal that benefits from color coding.
 */
export function ApplicationSourceBadge({ source, className }: { source: ApplicationSource; className?: string }) {
  return (
    <span
      title={`Application source: ${source}`}
      className={classNames(
        'inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-300',
        className,
      )}
    >
      <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-slate-400 dark:bg-slate-500" />
      {source}
    </span>
  )
}
