/**
 * Pagination foundation for large dataset readiness.
 *
 * Uses offset-based pagination (standard for admin dashboards).
 * Supabase supports cursor-based via .lt('id', cursor) for append-only feeds,
 * but offset is simpler and correct for our current use cases.
 */

export type PaginationParams = {
  page:     number;  // 1-indexed
  pageSize: number;  // items per page
};

export type PageResult<T> = {
  data:       T[];
  total:      number;  // total record count (from Supabase count: 'exact')
  page:       number;
  pageSize:   number;
  totalPages: number;
  hasNext:    boolean;
  hasPrev:    boolean;
};

export const DEFAULT_PAGE_SIZE = 25;
export const MAX_PAGE_SIZE     = 100;

/** Clamp and compute the range for Supabase .range() */
export function toRange(params: PaginationParams): { from: number; to: number } {
  const size = Math.min(Math.max(params.pageSize, 1), MAX_PAGE_SIZE);
  const page = Math.max(params.page, 1);
  const from = (page - 1) * size;
  const to   = from + size - 1;
  return { from, to };
}

/** Build a PageResult from Supabase response data + count */
export function toPageResult<T>(
  data: T[],
  count: number | null,
  params: PaginationParams,
): PageResult<T> {
  const total      = count ?? 0;
  const size       = Math.min(Math.max(params.pageSize, 1), MAX_PAGE_SIZE);
  const page       = Math.max(params.page, 1);
  const totalPages = Math.ceil(total / size);

  return {
    data,
    total,
    page,
    pageSize: size,
    totalPages,
    hasNext: page < totalPages,
    hasPrev: page > 1,
  };
}

/** Parse page/pageSize from URL search params with safe defaults */
export function parsePaginationParams(
  searchParams: Record<string, string | string[] | undefined>,
  defaultSize = DEFAULT_PAGE_SIZE,
): PaginationParams {
  const page     = parseInt(String(searchParams.page     ?? '1'),           10);
  const pageSize = parseInt(String(searchParams.pageSize ?? String(defaultSize)), 10);
  return {
    page:     Number.isNaN(page)     ? 1           : Math.max(page, 1),
    pageSize: Number.isNaN(pageSize) ? defaultSize : Math.min(Math.max(pageSize, 1), MAX_PAGE_SIZE),
  };
}
