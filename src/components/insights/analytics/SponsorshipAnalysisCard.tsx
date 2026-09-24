import { Bar, BarChart, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { AnalyticsCard } from './AnalyticsCard'
import { useAnalyticsQuery } from '../../../hooks/useAnalyticsQuery'
import { fetchSponsorshipOutcomes } from '../../../services/analytics'
import { SQL_EXAMPLES } from '../../../lib/sqlExamples'

/**
 * C. Sponsorship Analysis - current outcomes grouped by sponsorship
 * status, from `analytics_sponsorship_outcomes()`.
 */
export function SponsorshipAnalysisCard() {
  const { data, loading, error, errorDetail, refresh } = useAnalyticsQuery(fetchSponsorshipOutcomes)
  const rows = data ?? []
  const total = rows.reduce((sum, row) => sum + row.total_applications, 0)

  return (
    <AnalyticsCard
      title="Sponsorship Analysis"
      explanation="Application counts and current outcomes grouped by sponsorship status."
      loading={loading}
      error={error}
      errorDetail={errorDetail}
      onRetry={refresh}
      isEmpty={total === 0}
      emptyTitle="No applications yet"
      emptyDescription="Add a job to see sponsorship breakdowns."
      sql={SQL_EXAMPLES.sponsorshipOutcomes}
    >
      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} margin={{ top: 4, right: 8, bottom: 4, left: 4 }}>
            <XAxis dataKey="sponsorship" tick={{ fontSize: 12 }} tickLine={false} />
            <YAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} width={32} />
            <Tooltip cursor={{ fill: 'rgba(148, 163, 184, 0.12)' }} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Bar dataKey="offer_count" name="Offers" fill="#16a34a" radius={[3, 3, 0, 0]} isAnimationActive={false} />
            <Bar dataKey="rejected_count" name="Rejected" fill="#dc2626" radius={[3, 3, 0, 0]} isAnimationActive={false} />
            <Bar dataKey="active_count" name="Active" fill="#0ea5e9" radius={[3, 3, 0, 0]} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </AnalyticsCard>
  )
}
