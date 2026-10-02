import { APPLICATION_SOURCES } from '../../lib/constants'
import type { ApplicationSource } from '../../lib/constants'
import { EditCell } from './EditCell'
import { ApplicationSourceBadge } from './ApplicationSourceBadge'

/**
 * Inline Application Source editor for the Table page (V3.6). Same
 * interaction as StatusEditCell: click the badge, choose a value from
 * `APPLICATION_SOURCES` (the one canonical list - never a second,
 * hard-coded copy), done. Built on the generic `EditCell` so it shares
 * the popover/accessibility/pending logic with SponsorshipEditCell
 * rather than re-implementing it.
 */
export function ApplicationSourceEditCell({
  source,
  pending,
  onChange,
}: {
  source: ApplicationSource
  /** True while an application_source update for this row is in flight. */
  pending: boolean
  /** Called with the newly selected source. Never called for a no-op (re)selection of the current source. */
  onChange: (next: ApplicationSource) => void
}) {
  return (
    <EditCell
      value={source}
      options={APPLICATION_SOURCES}
      pending={pending}
      onChange={onChange}
      renderBadge={(value) => <ApplicationSourceBadge source={value} />}
      ariaLabel={`Change application source, currently ${source}`}
      listAriaLabel="Select an application source"
    />
  )
}
