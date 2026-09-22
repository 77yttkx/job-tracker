import type { JobStatus, Sponsorship } from './constants'
import type { Job } from '../types/job'

export interface InsightsFilters {
  company: string
  statuses: Set<JobStatus>
  sponsorships: Set<Sponsorship>
}

export function emptyInsightsFilters(): InsightsFilters {
  return { company: '', statuses: new Set(), sponsorships: new Set() }
}

export function hasActiveFilters(filters: InsightsFilters): boolean {
  return Boolean(filters.company.trim()) || filters.statuses.size > 0 || filters.sponsorships.size > 0
}

/**
 * Applies company/status/sponsorship filters with AND logic across
 * criteria (an OR within each multi-select). This is the Table page's
 * filtering logic - Table is the only page with filters (Insights is a
 * global, always-on overview and never reacts to these). Named
 * "insightsFilters" for historical reasons; kept as-is to avoid unrelated
 * churn, but "company contains X AND status is A or B AND sponsorship is
 * C" only ever applies on the Table page.
 */
export function applyJobFilters(jobs: Job[], filters: InsightsFilters): Job[] {
  const company = filters.company.trim().toLowerCase()
  return jobs.filter((job) => {
    if (company && !(job.company ?? '').toLowerCase().includes(company)) return false
    if (filters.statuses.size > 0 && !filters.statuses.has(job.status)) return false
    if (filters.sponsorships.size > 0 && !filters.sponsorships.has(job.sponsorship)) return false
    return true
  })
}
