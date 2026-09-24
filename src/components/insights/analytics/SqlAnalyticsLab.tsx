import { ApplicationFunnelCard } from './ApplicationFunnelCard'
import { CompanyOutcomesCard } from './CompanyOutcomesCard'
import { SponsorshipAnalysisCard } from './SponsorshipAnalysisCard'
import { ApplicationTrendCard } from './ApplicationTrendCard'
import { StatusHistoryCard } from './StatusHistoryCard'

/**
 * SQL Analytics Lab: a read-only set of analyses run as Postgres SQL
 * functions (RPCs), each scoped to the signed-in user via auth.uid() on
 * the server (supabase-v3_3-sql-analytics.sql). Nothing here sends SQL
 * from the browser - every card calls a named RPC through
 * src/services/analytics.ts.
 */
export function SqlAnalyticsLab() {
  return (
    <div className="flex flex-col gap-6">
      <p className="max-w-2xl text-sm text-slate-500 dark:text-slate-400">
        Explore your application data through read-only SQL analyses. Each result is scoped to your
        private workspace.
      </p>
      <div className="grid gap-6 lg:grid-cols-2">
        <ApplicationFunnelCard />
        <CompanyOutcomesCard />
        <SponsorshipAnalysisCard />
        <ApplicationTrendCard />
      </div>
      <StatusHistoryCard />
    </div>
  )
}
