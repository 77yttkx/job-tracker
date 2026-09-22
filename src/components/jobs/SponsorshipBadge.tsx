import { SPONSORSHIP_COLORS } from '../../lib/constants'
import { classNames } from '../../lib/utils'
import type { Sponsorship } from '../../lib/constants'

/**
 * Sponsorship badge. Uses both color and a non-color dot + label so the
 * status is not conveyed by color alone (accessibility requirement).
 */
export function SponsorshipBadge({ sponsorship, className }: { sponsorship: Sponsorship; className?: string }) {
  const colors = SPONSORSHIP_COLORS[sponsorship]
  const label = sponsorship === 'Yes' ? 'Sponsorship: Yes' : sponsorship === 'No' ? 'Sponsorship: No' : 'Sponsorship: Unknown'
  return (
    <span
      title={label}
      className={classNames(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium',
        colors.bg,
        colors.text,
        className,
      )}
    >
      <span aria-hidden="true" className={classNames('h-1.5 w-1.5 rounded-full', colors.dot)} />
      {sponsorship}
    </span>
  )
}
