// src/lib/fetchAll.ts
// Supabase/PostgREST caps a single request at 1000 rows by default.
// Any query that needs "all of a user's rows" (financial totals, reports,
// admin metrics) must page through results or it will silently and
// arbitrarily truncate once a user crosses that row count.
//
// Usage:
//   const { data, error } = await fetchAll(() =>
//     supabase.from('attendance').select('wage,advance,attendance_type').eq('user_id', userId)
//   )
//
// The callback must return a fresh query each call (so we can call
// .range() on it) — that's why it's a function, not a built query.

const PAGE_SIZE = 1000

type RangeableQuery<T> = {
  range: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>
}

export async function fetchAll<T>(
  buildQuery: () => RangeableQuery<T>
): Promise<{ data: T[] | null; error: { message: string } | null }> {
  const allRows: T[] = []
  let from = 0

  while (true) {
    const { data, error } = await buildQuery().range(from, from + PAGE_SIZE - 1)
    if (error) return { data: null, error }
    if (!data || data.length === 0) break
    allRows.push(...data)
    if (data.length < PAGE_SIZE) break
    from += PAGE_SIZE
  }

  return { data: allRows, error: null }
}
