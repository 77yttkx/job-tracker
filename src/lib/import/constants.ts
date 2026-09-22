/** Job Tracker fields that a spreadsheet column can be mapped to during import. */
export const IMPORT_FIELDS = [
  'company',
  'role',
  'job_url',
  'jd',
  'location',
  'sponsorship',
  'applied_date',
  'status',
  'notes',
] as const

export type ImportField = (typeof IMPORT_FIELDS)[number]

/** Human-readable label for each field, used in the column-mapping UI. */
export const IMPORT_FIELD_LABELS: Record<ImportField, string> = {
  company: 'Company',
  role: 'Role',
  job_url: 'Job URL',
  jd: 'Job description',
  location: 'Location',
  sponsorship: 'Sponsorship',
  applied_date: 'Applied date',
  status: 'Status',
  notes: 'Notes',
}

/** Reasonable per-import cap, per the product spec. */
export const IMPORT_ROW_LIMIT = 200

/** Fields eligible to be filled in from the job_url via parse-job when left blank in the spreadsheet. */
export const PARSE_FILLABLE_FIELDS: ImportField[] = ['company', 'role', 'jd', 'location', 'sponsorship']
