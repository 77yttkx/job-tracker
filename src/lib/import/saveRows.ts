import { createJob } from '../../services/jobs'
import { mapWithConcurrency } from './concurrency'
import { rowToNewJob } from './mapRows'
import type { ImportRow } from './mapRows'

export interface SaveOutcome {
  importedCount: number
  /** Row numbers that were 'valid' but failed to save (e.g. a transient Supabase error) - reported as needing manual review, never silently dropped. */
  failedRowNumbers: Set<number>
}

/**
 * Saves every 'valid' row to Supabase (skipping duplicate/invalid/blank
 * rows, which are never written), with at most `concurrency` inserts in
 * flight at once. One row's failure does not stop or lose the others.
 *
 * `userId` (the signed-in user's id) is attached to every imported row via
 * createJob, exactly like a manually-added job - an import can never
 * create a row owned by anyone else (see services/jobs.ts and the RLS
 * `with check` clauses in supabase-v2_6-multi-user.sql).
 */
export async function saveValidRows(
  rows: ImportRow[],
  userId: string,
  concurrency = 5,
): Promise<SaveOutcome> {
  const targets = rows.filter((row) => row.outcome === 'valid')
  const failedRowNumbers = new Set<number>()
  if (targets.length === 0) return { importedCount: 0, failedRowNumbers }

  const results = await mapWithConcurrency(targets, concurrency, async (row) => {
    try {
      await createJob(rowToNewJob(row), userId)
      return true
    } catch {
      failedRowNumbers.add(row.rowNumber)
      return false
    }
  })

  return { importedCount: results.filter(Boolean).length, failedRowNumbers }
}
