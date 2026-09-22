import { IMPORT_FIELDS } from './constants'
import type { ImportField } from './constants'

/**
 * Common spreadsheet header spellings that map to each Job Tracker field,
 * matched case-insensitively and with punctuation/whitespace normalized
 * (so "Job Title", "job_title", and "JOB-TITLE" all match "role").
 */
const ALIASES: Record<ImportField, string[]> = {
  company: ['company', 'employer', 'organization', 'organisation'],
  role: ['role', 'job title', 'jobtitle', 'position', 'title'],
  job_url: ['job url', 'url', 'link', 'job link', 'posting url', 'application url', 'application link'],
  jd: ['jd', 'job description', 'description'],
  location: ['location', 'city', 'work location'],
  sponsorship: ['sponsorship', 'visa sponsorship', 'sponsor'],
  applied_date: ['applied date', 'application date', 'date applied', 'date'],
  status: ['status', 'application status'],
  notes: ['notes', 'comments', 'note', 'comment'],
}

function normalizeHeader(value: unknown): string {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
}

export type HeaderMapping = Partial<Record<ImportField, number>>

/**
 * Auto-matches each spreadsheet header (in first-row order) to a Job
 * Tracker field by exact alias match. Returns a field -> column-index map;
 * a field absent from the map has no matching column and stays unmapped
 * until the user assigns one manually.
 */
export function autoMatchHeaders(headerRow: Array<unknown>): HeaderMapping {
  const normalized = headerRow.map(normalizeHeader)
  const mapping: HeaderMapping = {}
  for (const field of IMPORT_FIELDS) {
    const aliases = ALIASES[field]
    const idx = normalized.findIndex((h) => h.length > 0 && aliases.includes(h))
    if (idx !== -1) mapping[field] = idx
  }
  return mapping
}

/** True when every Job Tracker field has been matched to a column. */
export function isMappingComplete(mapping: HeaderMapping): boolean {
  return IMPORT_FIELDS.every((field) => mapping[field] !== undefined)
}
