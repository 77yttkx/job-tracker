import { useMemo, useState } from 'react'
import { ApplicationOverview } from '../components/insights/ApplicationOverview'
import { TimeSummary } from '../components/insights/TimeSummary'
import { DistributionPanel } from '../components/insights/DistributionPanel'
import { InsightsTabs } from '../components/insights/InsightsTabs'
import type { InsightsTab } from '../components/insights/InsightsTabs'
import { SqlAnalyticsLab } from '../components/insights/analytics/SqlAnalyticsLab'
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
 * V3.3: a second tab, "SQL Analytics Lab" (<SqlAnalyticsLab>), was added
 * alongside this original view (now "Overview"). Unlike the removed
 * Sankey panel, the Lab's Status History card is built from real
 * recorded events (public.job_status_events, populated by a trigger from
 * supabase-v3_3-sql-analytics.sql forward) - it is honest, not inferred,
 * about which history it does and does not have. The Lab fetches its own
 * data independently via RPC (src/services/analytics.ts) and does not
 * read from jobsState at all, so switching tabs never re-fetches jobs.
 */
export function InsightsPage({ jobsState }: { jobsState: ReturnType<typeof useJobs> }) {
  const { jobs, loading, error, errorDetail, refresh } = jobsState
  const [tab, setTab] = useState<InsightsTab>('overview')

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
        {tab === 'overview' && <ExportCsvButton jobs={jobs} />}
      </div>

      <InsightsTabs active={tab} onChange={setTab} />

      {tab === 'sql-lab' ? (
        <SqlAnalyticsLab />
      ) : loading && jobs.length === 0 ? (
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
        </>
      )}
    </div>
  )
}
