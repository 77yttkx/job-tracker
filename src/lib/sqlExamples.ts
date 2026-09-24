/**
 * Human-readable SQL shown in each SQL Analytics Lab card's "View SQL"
 * section. Each string is the real query body from the matching RPC in
 * supabase-v3_3-sql-analytics.sql (Part 3), reformatted for readability
 * as a standalone `select`, not a re-derived approximation - if the
 * migration's query changes, update the matching entry here too, and
 * src/__tests__/sqlAnalyticsMigration.test.ts checks the two stay in
 * sync on the key structural pieces (auth.uid(), table names).
 *
 * These are DISPLAY-ONLY strings. Nothing in this file (or anywhere in
 * the SQL Analytics Lab) sends this text to Supabase or runs it - the
 * actual analysis always comes from calling the read-only RPC via
 * supabase.rpc(...) (see src/services/analytics.ts).
 */

export const SQL_EXAMPLES = {
  applicationFunnel: `select
  status,
  count(*) as job_count
from jobs
where user_id = auth.uid()
group by status
order by /* pipeline order: Applied .. Ghosted */;`,

  companyOutcomes: `select
  coalesce(nullif(trim(company), ''), 'Unknown company') as company,
  count(*) as total_applications,
  count(case when status in ('OA', '1st Round', '2nd Round', 'Final Round') then 1 end)
    as interview_stage_count,
  count(case when status = 'Offer' then 1 end) as offer_count,
  count(case when status = 'Rejected' then 1 end) as rejected_count
from jobs
where user_id = auth.uid()
group by company
order by total_applications desc;`,

  sponsorshipOutcomes: `select
  coalesce(sponsorship, 'Unknown') as sponsorship,
  count(*) as total_applications,
  count(case when status = 'Offer' then 1 end) as offer_count,
  count(case when status = 'Rejected' then 1 end) as rejected_count,
  count(case when status not in ('Offer', 'Rejected', 'Ghosted') then 1 end) as active_count
from jobs
where user_id = auth.uid()
group by sponsorship
order by total_applications desc;`,

  applicationTrend: `select
  date_trunc('month', applied_date) as period_start, -- or 'week'
  count(*) as job_count
from jobs
where user_id = auth.uid()
  and applied_date is not null
group by period_start
order by period_start asc;`,

  statusHistory: `-- Status transitions recorded since tracking began
select date_trunc('week', changed_at) as week_start, count(*) as transition_count
from job_status_events
where user_id = auth.uid()
group by week_start
order by week_start asc;

-- Average days from "Applied" to "OA", only for jobs with both events
with applied as (
  select job_id, min(changed_at) as applied_at
  from job_status_events
  where user_id = auth.uid() and to_status = 'Applied'
  group by job_id
),
oa as (
  select job_id, min(changed_at) as reached_at
  from job_status_events
  where user_id = auth.uid() and to_status = 'OA'
  group by job_id
)
select avg(extract(epoch from (oa.reached_at - applied.applied_at)) / 86400.0) as avg_days
from applied
join oa on oa.job_id = applied.job_id;`,
} as const

export type SqlExampleKey = keyof typeof SQL_EXAMPLES
