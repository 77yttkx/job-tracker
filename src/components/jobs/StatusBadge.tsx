import { STATUS_COLORS } from '../../lib/constants'
import { classNames } from '../../lib/utils'
import type { JobStatus } from '../../lib/constants'

export function StatusBadge({ status, className }: { status: JobStatus; className?: string }) {
  const colors = STATUS_COLORS[status]
  return (
    <span
      className={classNames(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium',
        colors.bg,
        colors.text,
        className,
      )}
    >
      <span aria-hidden="true" className={classNames('h-1.5 w-1.5 rounded-full', colors.dot)} />
      {status}
    </span>
  )
}
