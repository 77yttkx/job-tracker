import { SPONSORSHIP_VALUES } from '../../lib/constants'
import type { Sponsorship } from '../../lib/constants'
import { EditCell } from './EditCell'
import { SponsorshipBadge } from './SponsorshipBadge'

/**
 * Inline Sponsorship editor for the Table page (V3.6). Previously
 * Sponsorship was only editable via the Add/Edit modal; this makes it
 * directly editable from the Table too, the same way Status already is.
 * Built on the generic `EditCell`, shared with ApplicationSourceEditCell.
 */
export function SponsorshipEditCell({
  sponsorship,
  pending,
  onChange,
}: {
  sponsorship: Sponsorship
  /** True while a sponsorship update for this row is in flight. */
  pending: boolean
  /** Called with the newly selected sponsorship. Never called for a no-op (re)selection of the current value. */
  onChange: (next: Sponsorship) => void
}) {
  return (
    <EditCell
      value={sponsorship}
      options={SPONSORSHIP_VALUES}
      pending={pending}
      onChange={onChange}
      renderBadge={(value) => <SponsorshipBadge sponsorship={value} />}
      ariaLabel={`Change sponsorship, currently ${sponsorship}`}
      listAriaLabel="Select a sponsorship value"
    />
  )
}
