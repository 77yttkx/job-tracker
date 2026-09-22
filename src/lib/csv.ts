import type { Job } from '../types/job'

const CSV_COLUMNS = [
  'job_id',
  'company',
  'role',
  'location',
  'sponsorship',
  'job_url',
  'jd',
  'applied_date',
  'status',
  'notes',
  'created_at',
  'updated_at',
] as const

/** Escapes a single CSV field per RFC 4180: quote if it contains a comma, quote, or newline. */
export function escapeCsvField(value: string | null | undefined): string {
  const str = value ?? ''
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

/** Builds a full CSV document (header + rows) for the given jobs, columns in the required order. */
export function jobsToCsv(jobs: Job[]): string {
  const header = CSV_COLUMNS.join(',')
  const rows = jobs.map((job) =>
    CSV_COLUMNS.map((col) => escapeCsvField(job[col] as string | null)).join(','),
  )
  // CRLF per RFC 4180; also keeps Excel happy.
  return [header, ...rows].join('\r\n')
}

/** Filename for a CSV export dated today, e.g. job-tracker-export-2026-09-21.csv */
export function exportFileName(date: Date = new Date()): string {
  const iso = date.toISOString().slice(0, 10)
  return `job-tracker-export-${iso}.csv`
}

/** Triggers a browser download of `content` as a UTF-8 CSV file named `filename`. */
export function downloadCsv(content: string, filename: string): void {
  // Prepend a BOM so Excel opens Unicode content correctly.
  const blob = new Blob(['﻿', content], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
