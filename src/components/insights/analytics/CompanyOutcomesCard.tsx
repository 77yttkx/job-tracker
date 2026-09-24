import { AnalyticsCard } from './AnalyticsCard'
import { useAnalyticsQuery } from '../../../hooks/useAnalyticsQuery'
import { fetchCompanyOutcomes } from '../../../services/analytics'
import { SQL_EXAMPLES } from '../../../lib/sqlExamples'

/**
 * B. Company Outcomes - per-company totals and conditional-aggregation
 * breakdowns (interview-stage / offer / rejected counts), from
 * `analytics_company_outcomes()`.
 */
export function CompanyOutcomesCard() {
  const { data, loading, error, errorDetail, refresh } = useAnalyticsQuery(fetchCompanyOutcomes)
  const rows = data ?? []

  return (
    <AnalyticsCard
      title="Company Outcomes"
      explanation="Applications, interview reach, offers and rejections, broken down by company."
      loading={loading}
      error={error}
      errorDetail={errorDetail}
      onRetry={refresh}
      isEmpty={rows.length === 0}
      emptyTitle="No applications yet"
      emptyDescription="Add a job to see company-level outcomes."
      sql={SQL_EXAMPLES.companyOutcomes}
    >
      <div className="max-h-72 overflow-y-auto">
        <table className="w-full text-left text-xs">
          <thead className="sticky top-0 bg-white text-slate-500 dark:bg-slate-900 dark:text-slate-400">
            <tr>
              <th scope="col" className="py-1.5 pr-2 font-medium">Company</th>
              <th scope="col" className="py-1.5 px-2 text-right font-medium">Total</th>
              <th scope="col" className="py-1.5 px-2 text-right font-medium">Interview stage</th>
              <th scope="col" className="py-1.5 px-2 text-right font-medium">Offers</th>
              <th scope="col" className="py-1.5 pl-2 text-right font-medium">Rejected</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {rows.map((row) => (
              <tr key={row.company}>
                <td className="py-1.5 pr-2 font-medium text-slate-700 dark:text-slate-200">{row.company}</td>
                <td className="py-1.5 px-2 text-right tabular-nums text-slate-600 dark:text-slate-300">
                  {row.total_applications}
                </td>
                <td className="py-1.5 px-2 text-right tabular-nums text-slate-600 dark:text-slate-300">
                  {row.interview_stage_count}
                </td>
                <td className="py-1.5 px-2 text-right tabular-nums text-green-700 dark:text-green-400">
                  {row.offer_count}
                </td>
                <td className="py-1.5 pl-2 text-right tabular-nums text-red-700 dark:text-red-400">
                  {row.rejected_count}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AnalyticsCard>
  )
}
