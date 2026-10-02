import { useMemo } from 'react'
import { ApplicationOverview } from '../components/insights/ApplicationOverview'
import { TimeSummary } from '../components/insights/TimeSummary'
import { DistributionPanel } from '../components/insights/DistributionPanel'
import { ApplicationFunnelCard } from '../components/insights/analytics/ApplicationFunnelCard'
import { CompanyOutcomesCard } from '../components/insights/analytics/CompanyOutcomesCard'
import { SponsorshipAnalysisCard } from '../components/insights/analytics/SponsorshipAnalysisCard'
import { ApplicationTrendCard } from '../components/insights/analytics/ApplicationTrendCard'
import { TimeToResponseCard } from '../components/insights/analytics/TimeToResponseCard'
import { ApplicationSourcePerformanceCard } from '../components/insights/analytics/ApplicationSourcePerformanceCard'
import { ExportCsvButton } from '../components/ui/ExportCsvButton'
import { EmptyState, ErrorState, LoadingState } from '../components/ui/DataStates'
import { STATUS_COLORS } from '../lib/constants'
import type { JobStatus } from '../lib/constants'
import { statusDistribution } from '../lib/distributions'
import type { useJobs } from '../hooks/useJobs'

/**
 * Insights is a global, always-on overview: every number and chart here is
 * calculated from *all* jobs in the database, with no filter bar of its
 * own. Filtering only exists on the Table page (src/lib/insightsFilters.ts
 * is reused there); Insights never reacts to Table filter state.
 *
 * jobs/loading/error/errorDetail all come from the single `useJobs()` call
 * made once in App.tsx and passed down as `jobsState` - Table reads from
 * the exact same hook instance, so both pages are always in sync (see
 * src/__tests__/sharedJobsSource.test.ts). "No applications yet" is only
 * ever shown once `loading` is false and `error` is null, i.e. after a
 * query that genuinely succeeded and returned zero rows.
 *
 * V2.5.2: the Sankey/funnel panel that used to lead this page was removed
 * entirely - it inferred that a job in a later stage had passed through
 * every earlier stage, which this app has no data to actually support
 * (no status-transition history is stored), and its Recharts Sankey
 * tooltip had a visible "undefined -> undefined" bug. <ApplicationOverview>
 * replaces it as the first panel: a plain count/percentage of each job's
 * *current* status only, with no stage inference of any kind.
 *
 * V3.3 originally added these as a second "SQL Analytics Lab" tab, each
 * card showing its underlying read-only query via a "View SQL" toggle.
 * V3.4 removes that tab/toggle framing: Insights is one scrollable page,
 * and these are presented as what they are - product analytics, not a
 * SQL demonstration. The Status History card from that tab (weekly
 * transition counts plus average per-stage duration) was dropped
 * entirely rather than just de-SQL-ified: it mainly served to show off
 * the underlying event log, and its "average days in stage" numbers used
 * a different, less accurate anchor than Time to Response below (the
 * first `job_status_events` row instead of `jobs.applied_date`), so
 * keeping both would have shown two contradictory "how long" figures.
 * The other four analyses (Application Funnel, Company Outcomes,
 * Sponsorship Analysis, Application Trend) are real, useful job-search
 * analytics and are kept as-is, just without the SQL toggle. Each still
 * fetches its own data independently via RPC (src/services/analytics.ts)
 * and does not read from jobsState at all.
 *
 * V3.4 adds Time to Response: how long it takes an application to get a
 * first meaningful employer response. See
 * supabase-v3_4-time-to-response.sql for the exact metric definition.
 *
 * V3.6 adds Application Source Performance: how tracked application
 * channels compare, purely descriptively (no causal claims, no ranking,
 * no Best/Worst labels). See supabase-v3_6-application-source.sql and
 * ApplicationSourcePerformanceCard.tsx for the full metric definitions -
 * it is a distinct analysis from every card above, never a duplicate of
 * Status Distribution, Application Funnel, Time to Response, or
 * Sponsorship Analysis under a new name.
 */
export function InsightsPage({ jobsState }: { jobsState: ReturnType<typeof useJobs> }) {
  const { jobs, loading, error, errorDetail, refresh } = jobsState

  const statusRows = useMemo(() => statusDistribution(jobs), [jobs])

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Insights</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            An overview of every application you&apos;re tracking.
          </p>
        </div>
        <ExportCsvButton jobs={jobs} />
      </div>

      {loading && jobs.length === 0 ? (
        <LoadingState />
      ) : error ? (
        <ErrorState message={error} detail={errorDetail} onRetry={refresh} />
      ) : jobs.length === 0 ? (
        <EmptyState
          title="No applications yet"
          description="Use Add Job to track your first application. The application overview and summary stats will appear here once you have data."
        />
      ) : (
        <>
          {/* Application overview first, immediately below the title/subtitle
              (V2.5.2) - an accurate current-status snapshot, not an
              inferred funnel. */}
          <ApplicationOverview jobs={jobs} />

          <TimeSummary jobs={jobs} />

          <DistributionPanel<JobStatus>
            title="Status distribution"
            rows={statusRows}
            colorFor={(status) => STATUS_COLORS[status].dot}
          />

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <TimeToResponseCard />
            <ApplicationFunnelCard />
            <ApplicationSourcePerformanceCard />
            <CompanyOutcomesCard />
            <SponsorshipAnalysisCard />
            <ApplicationTrendCard />
          </div>
        </>
      )}
    </div>
  )
}
