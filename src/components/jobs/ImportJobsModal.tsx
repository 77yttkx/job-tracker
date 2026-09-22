import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { AlertTriangle, Loader2, Upload, X } from 'lucide-react'
import { autoMatchHeaders } from '../../lib/import/headerMatching'
import type { HeaderMapping } from '../../lib/import/headerMatching'
import { IMPORT_FIELDS, IMPORT_FIELD_LABELS, IMPORT_ROW_LIMIT } from '../../lib/import/constants'
import type { ImportField } from '../../lib/import/constants'
import { buildImportRows, rowNeedsParseFill } from '../../lib/import/mapRows'
import type { ImportRow } from '../../lib/import/mapRows'
import { fillMissingFieldsFromUrls } from '../../lib/import/parseFill'
import { saveValidRows } from '../../lib/import/saveRows'
import { buildImportErrorReportCsv } from '../../lib/import/errorReport'
import { downloadCsv } from '../../lib/csv'
import { classNames } from '../../lib/utils'
import type { Job } from '../../types/job'

type Step = 'select-file' | 'select-sheet' | 'mapping' | 'preview' | 'importing' | 'summary'

interface ImportSummary {
  imported: number
  skippedDuplicates: number
  needsManualReview: number
  parsingFailed: number
  invalidRows: number
}

export function ImportJobsModal({
  open,
  onClose,
  jobs,
  onImported,
  userId,
}: {
  open: boolean
  onClose: () => void
  jobs: Job[]
  onImported: () => void
  /** The signed-in user's id - every imported row is attached to them (see saveValidRows in lib/import/saveRows.ts). */
  userId: string
}) {
  const [step, setStep] = useState<Step>('select-file')
  const [fileName, setFileName] = useState('')
  const [sheetNames, setSheetNames] = useState<string[]>([])
  const [selectedSheet, setSelectedSheet] = useState('')
  const [getRows, setGetRows] = useState<((sheet: string) => unknown[][]) | null>(null)
  const [headerRow, setHeaderRow] = useState<unknown[]>([])
  const [dataRows, setDataRows] = useState<unknown[][]>([])
  const [mapping, setMapping] = useState<HeaderMapping>({})
  const [rows, setRows] = useState<ImportRow[]>([])
  const [parseFillEnabled, setParseFillEnabled] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [progressLabel, setProgressLabel] = useState('')
  const [summary, setSummary] = useState<ImportSummary | null>(null)
  const [errorReportCsv, setErrorReportCsv] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const titleId = useId()

  useEffect(() => {
    if (!open) return
    setStep('select-file')
    setFileName('')
    setSheetNames([])
    setSelectedSheet('')
    setGetRows(null)
    setHeaderRow([])
    setDataRows([])
    setMapping({})
    setRows([])
    setParseFillEnabled(false)
    setLoadError(null)
    setSummary(null)
    setErrorReportCsv(null)
  }, [open])

  useEffect(() => {
    if (!open) return
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [open, onClose])

  const existingJobUrls = useMemo(() => jobs.map((j) => j.job_url).filter((u): u is string => Boolean(u)), [jobs])

  if (!open) return null

  async function handleFileSelected(file: File) {
    setLoadError(null)
    setFileName(file.name)
    try {
      // Lazily loaded: xlsx (SheetJS) is a sizeable dependency that only
      // this modal needs, so it should not bloat the main app bundle for
      // people who never import a spreadsheet.
      const { parseSpreadsheetFile } = await import('../../lib/import/spreadsheet')
      const workbook = await parseSpreadsheetFile(file)
      if (workbook.sheetNames.length === 0) {
        setLoadError('This file has no worksheets to import from.')
        return
      }
      setGetRows(() => workbook.getRows)
      if (workbook.sheetNames.length > 1) {
        setSheetNames(workbook.sheetNames)
        setStep('select-sheet')
      } else {
        loadSheet(workbook.getRows, workbook.sheetNames[0])
      }
    } catch {
      setLoadError('This file could not be read. Make sure it is a valid .csv, .xlsx, or .xls file.')
    }
  }

  function loadSheet(rowsFn: (sheet: string) => unknown[][], sheet: string) {
    const allRows = rowsFn(sheet)
    if (allRows.length === 0) {
      setLoadError(`The "${sheet}" worksheet is empty.`)
      return
    }
    const [header, ...body] = allRows
    if (body.length > IMPORT_ROW_LIMIT) {
      setLoadError(
        `This worksheet has ${body.length} rows; the per-import limit is ${IMPORT_ROW_LIMIT}. Split it into smaller files and import them separately.`,
      )
      return
    }
    setSelectedSheet(sheet)
    setHeaderRow(header)
    setDataRows(body)
    setMapping(autoMatchHeaders(header))
    setStep('mapping')
  }

  function handleMappingContinue() {
    const built = buildImportRows(dataRows, mapping, existingJobUrls)
    setRows(built)
    setStep('preview')
  }

  async function handleConfirmImport() {
    setStep('importing')
    let workingRows = rows

    if (parseFillEnabled && workingRows.some(rowNeedsParseFill)) {
      setProgressLabel('Parsing job links for missing details...')
      const fillOutcome = await fillMissingFieldsFromUrls(workingRows, 3)
      workingRows = fillOutcome.rows
      setRows(workingRows)

      setProgressLabel('Saving imported jobs...')
      const saveOutcome = await saveValidRows(workingRows, userId, 5)

      const needsManualReview = new Set([...fillOutcome.failedRowNumbers, ...saveOutcome.failedRowNumbers])
      finishImport(workingRows, saveOutcome.importedCount, needsManualReview, fillOutcome.failedRowNumbers)
      return
    }

    setProgressLabel('Saving imported jobs...')
    const saveOutcome = await saveValidRows(workingRows, userId, 5)
    finishImport(workingRows, saveOutcome.importedCount, saveOutcome.failedRowNumbers, new Set())
  }

  function finishImport(
    finalRows: ImportRow[],
    imported: number,
    needsManualReviewRowNumbers: Set<number>,
    parsingFailedRowNumbers: Set<number>,
  ) {
    const skippedDuplicates = finalRows.filter((r) => r.outcome === 'duplicate').length
    const invalidRows = finalRows.filter((r) => r.outcome === 'invalid').length

    setSummary({
      imported,
      skippedDuplicates,
      needsManualReview: needsManualReviewRowNumbers.size,
      parsingFailed: parsingFailedRowNumbers.size,
      invalidRows,
    })
    setErrorReportCsv(buildImportErrorReportCsv(finalRows, parsingFailedRowNumbers))
    setStep('summary')
    onImported()
  }

  function handleDownloadErrorReport() {
    if (!errorReportCsv) return
    const iso = new Date().toISOString().slice(0, 10)
    downloadCsv(errorReportCsv, `job-tracker-import-errors-${iso}.csv`)
  }

  const validCount = rows.filter((r) => r.outcome === 'valid').length
  const duplicateCount = rows.filter((r) => r.outcome === 'duplicate').length
  const invalidCount = rows.filter((r) => r.outcome === 'invalid').length
  const skippedBlankCount = rows.filter((r) => r.outcome === 'skipped-blank').length
  const fillableCount = rows.filter(rowNeedsParseFill).length

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 p-0 sm:items-center sm:p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && step !== 'importing') onClose()
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-xl bg-white shadow-xl dark:bg-slate-900 sm:rounded-xl"
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-slate-800">
          <h2 id={titleId} className="text-base font-semibold">
            Import jobs
          </h2>
          {step !== 'importing' && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Close dialog"
              className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800"
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {step === 'select-file' && (
            <div className="flex flex-col gap-4">
              <p className="text-sm text-slate-600 dark:text-slate-300">
                Import applications from a .csv, .xlsx, or .xls file. Nothing is saved until you review a
                preview and confirm.
              </p>
              <label
                htmlFor="import-file-input"
                className="flex cursor-pointer flex-col items-center gap-2 rounded-lg border-2 border-dashed border-slate-300 px-4 py-10 text-center hover:border-sky-400 hover:bg-sky-50/50 dark:border-slate-700 dark:hover:border-sky-500 dark:hover:bg-sky-900/10"
              >
                <Upload className="h-6 w-6 text-slate-400" aria-hidden="true" />
                <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
                  Click to choose a file
                </span>
                <span className="text-xs text-slate-400">.csv, .xlsx, or .xls - up to {IMPORT_ROW_LIMIT} rows</span>
              </label>
              <input
                ref={fileInputRef}
                id="import-file-input"
                type="file"
                accept=".csv,.xlsx,.xls"
                className="sr-only"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) void handleFileSelected(file)
                }}
              />
              {loadError && (
                <p role="alert" className="flex items-start gap-2 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-300">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                  {loadError}
                </p>
              )}
            </div>
          )}

          {step === 'select-sheet' && getRows && (
            <div className="flex flex-col gap-4">
              <p className="text-sm text-slate-600 dark:text-slate-300">
                <span className="font-medium">{fileName}</span> has multiple worksheets. Choose the one to
                import from.
              </p>
              <div className="flex flex-col gap-2">
                {sheetNames.map((sheet) => (
                  <button
                    key={sheet}
                    type="button"
                    onClick={() => loadSheet(getRows, sheet)}
                    className="rounded-md border border-slate-300 px-3 py-2 text-left text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                  >
                    {sheet}
                  </button>
                ))}
              </div>
              {loadError && (
                <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-300">
                  {loadError}
                </p>
              )}
            </div>
          )}

          {step === 'mapping' && (
            <div className="flex flex-col gap-4">
              <p className="text-sm text-slate-600 dark:text-slate-300">
                We matched spreadsheet columns to Job Tracker fields automatically. Correct any that look
                wrong before continuing - {dataRows.length} row{dataRows.length === 1 ? '' : 's'} found
                {selectedSheet && sheetNames.length > 1 ? ` in "${selectedSheet}"` : ''}.
              </p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {IMPORT_FIELDS.map((field) => (
                  <MappingRow
                    key={field}
                    field={field}
                    headerRow={headerRow}
                    value={mapping[field]}
                    onChange={(colIndex) => setMapping((prev) => ({ ...prev, [field]: colIndex }))}
                  />
                ))}
              </div>
            </div>
          )}

          {step === 'preview' && (
            <div className="flex flex-col gap-4">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <PreviewStat label="Valid" value={validCount} tone="positive" />
                <PreviewStat label="Duplicates" value={duplicateCount} tone="neutral" />
                <PreviewStat label="Invalid" value={invalidCount} tone="negative" />
                <PreviewStat label="Blank (skipped)" value={skippedBlankCount} tone="neutral" />
              </div>

              {fillableCount > 0 && (
                <label className="flex items-start gap-2 rounded-md border border-slate-200 p-3 text-sm dark:border-slate-800">
                  <input
                    type="checkbox"
                    checked={parseFillEnabled}
                    onChange={(e) => setParseFillEnabled(e.target.checked)}
                    className="mt-0.5"
                  />
                  <span>
                    <span className="font-medium text-slate-700 dark:text-slate-200">
                      Parse missing fields from job links after import
                    </span>
                    <span className="block text-xs text-slate-500 dark:text-slate-400">
                      {fillableCount} row{fillableCount === 1 ? '' : 's'} ha{fillableCount === 1 ? 's' : 've'} a job
                      URL but blank company/role/description/location/sponsorship. Only blank fields are
                      filled - values from your file are never overwritten. Failed lookups are kept and
                      flagged for manual review, never dropped.
                    </span>
                  </span>
                </label>
              )}

              <div className="max-h-72 overflow-auto rounded-lg border border-slate-200 dark:border-slate-800">
                <table className="min-w-full divide-y divide-slate-200 text-xs dark:divide-slate-800">
                  <thead className="sticky top-0 bg-slate-50 dark:bg-slate-900">
                    <tr>
                      <th className="px-2 py-1.5 text-left font-semibold text-slate-500 dark:text-slate-400">Row</th>
                      <th className="px-2 py-1.5 text-left font-semibold text-slate-500 dark:text-slate-400">Outcome</th>
                      <th className="px-2 py-1.5 text-left font-semibold text-slate-500 dark:text-slate-400">Company</th>
                      <th className="px-2 py-1.5 text-left font-semibold text-slate-500 dark:text-slate-400">Role</th>
                      <th className="px-2 py-1.5 text-left font-semibold text-slate-500 dark:text-slate-400">Notes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {rows
                      .filter((r) => r.outcome !== 'skipped-blank')
                      .map((row) => (
                        <tr key={row.rowNumber}>
                          <td className="px-2 py-1.5 tabular-nums text-slate-500 dark:text-slate-400">{row.rowNumber}</td>
                          <td className="px-2 py-1.5">
                            <OutcomeBadge outcome={row.outcome} />
                          </td>
                          <td className="max-w-[8rem] truncate px-2 py-1.5 text-slate-700 dark:text-slate-200">
                            {row.data.company ?? <span className="text-slate-400">-</span>}
                          </td>
                          <td className="max-w-[8rem] truncate px-2 py-1.5 text-slate-700 dark:text-slate-200">
                            {row.data.role ?? <span className="text-slate-400">-</span>}
                          </td>
                          <td className="max-w-[14rem] truncate px-2 py-1.5 text-slate-500 dark:text-slate-400">
                            {row.reasons.join('; ') || '-'}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {step === 'importing' && (
            <div className="flex flex-col items-center justify-center gap-3 py-16 text-sm text-slate-500 dark:text-slate-400">
              <Loader2 className="h-6 w-6 animate-spin" aria-hidden="true" />
              {progressLabel || 'Importing...'}
            </div>
          )}

          {step === 'summary' && summary && (
            <div className="flex flex-col gap-4">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                <PreviewStat label="Imported" value={summary.imported} tone="positive" />
                <PreviewStat label="Skipped duplicates" value={summary.skippedDuplicates} tone="neutral" />
                <PreviewStat label="Needs manual review" value={summary.needsManualReview} tone="warning" />
                <PreviewStat label="Parsing failed" value={summary.parsingFailed} tone="warning" />
                <PreviewStat label="Invalid rows" value={summary.invalidRows} tone="negative" />
              </div>
              {errorReportCsv && (
                <button
                  type="button"
                  onClick={handleDownloadErrorReport}
                  className="self-start rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  Download error report (CSV)
                </button>
              )}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-200 px-5 py-4 dark:border-slate-800">
          {step === 'mapping' && (
            <button
              type="button"
              onClick={handleMappingContinue}
              className="rounded-md bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-700"
            >
              Continue to preview
            </button>
          )}
          {step === 'preview' && (
            <>
              <button
                type="button"
                onClick={() => setStep('mapping')}
                className="rounded-md px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                Back
              </button>
              <button
                type="button"
                onClick={() => void handleConfirmImport()}
                disabled={validCount === 0}
                className="rounded-md bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Confirm import ({validCount})
              </button>
            </>
          )}
          {step === 'summary' && (
            <button
              type="button"
              onClick={onClose}
              className="rounded-md bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-700"
            >
              Done
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

function MappingRow({
  field,
  headerRow,
  value,
  onChange,
}: {
  field: ImportField
  headerRow: unknown[]
  value: number | undefined
  onChange: (colIndex: number | undefined) => void
}) {
  const selectId = `mapping-${field}`
  return (
    <div>
      <label htmlFor={selectId} className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">
        {IMPORT_FIELD_LABELS[field]}
      </label>
      <select
        id={selectId}
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value === '' ? undefined : Number(e.target.value))}
        className="w-full rounded-md border border-slate-300 bg-white px-2 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
      >
        <option value="">-- not in file --</option>
        {headerRow.map((header, idx) => (
          <option key={idx} value={idx}>
            {String(header ?? `Column ${idx + 1}`)}
          </option>
        ))}
      </select>
    </div>
  )
}

function PreviewStat({ label, value, tone }: { label: string; value: number; tone: 'positive' | 'negative' | 'warning' | 'neutral' }) {
  const toneClass = {
    positive: 'text-green-700 dark:text-green-300',
    negative: 'text-red-700 dark:text-red-300',
    warning: 'text-amber-700 dark:text-amber-300',
    neutral: 'text-slate-700 dark:text-slate-300',
  }[tone]
  return (
    <div className="rounded-md bg-slate-50 px-3 py-2.5 dark:bg-slate-800/60">
      <p className="text-xs font-medium text-slate-500 dark:text-slate-400">{label}</p>
      <p className={classNames('mt-0.5 text-lg font-semibold tabular-nums', toneClass)}>{value}</p>
    </div>
  )
}

function OutcomeBadge({ outcome }: { outcome: ImportRow['outcome'] }) {
  const config = {
    valid: { label: 'Valid', className: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300' },
    duplicate: { label: 'Duplicate', className: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300' },
    invalid: { label: 'Invalid', className: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300' },
    'skipped-blank': { label: 'Blank', className: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400' },
  }[outcome]
  return (
    <span className={classNames('inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium', config.className)}>
      {config.label}
    </span>
  )
}
