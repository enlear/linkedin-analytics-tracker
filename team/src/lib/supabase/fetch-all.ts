// PostgREST returns at most 1,000 rows per request on Supabase. Reads that need
// a whole table (the all-time leaderboard, an employee's history) page through
// it with `range` until a short page comes back.

const PAGE_SIZE = 1000;

interface PageResult<T> {
  data: T[] | null;
  error: { message: string } | null;
}

/**
 * Collect every row of a query. `page(from, to)` must apply `.range(from, to)`
 * to a freshly built query with a stable `order`, or rows can repeat or go
 * missing between pages.
 */
export async function fetchAll<T>(
  page: (from: number, to: number) => PromiseLike<PageResult<T>>,
): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await page(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(error.message);
    rows.push(...(data ?? []));
    if (!data || data.length < PAGE_SIZE) return rows;
  }
}
