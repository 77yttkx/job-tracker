/**
 * Runs `fn` over `items` with at most `limit` calls in flight at once,
 * preserving input order in the result array. A single item's rejection
 * never aborts the others - `fn` is expected to catch its own errors and
 * encode failure in its return value (used for both the batch parse-fill
 * step and the batch import-save step, where one bad row must never lose
 * the rest of the batch).
 */
export async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length)
  let nextIndex = 0

  async function worker(): Promise<void> {
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const current = nextIndex
      nextIndex += 1
      if (current >= items.length) return
      results[current] = await fn(items[current], current)
    }
  }

  const workerCount = Math.max(1, Math.min(limit, items.length))
  await Promise.all(Array.from({ length: workerCount }, () => worker()))
  return results
}
