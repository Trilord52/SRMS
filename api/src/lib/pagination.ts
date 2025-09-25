export interface Pagination {
  page: number;
  limit: number;
  totalCount: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

/** One pagination envelope for every list endpoint. */
export function buildPagination(page: number, limit: number, totalCount: number): Pagination {
  const totalPages = Math.max(1, Math.ceil(totalCount / limit));
  return {
    page,
    limit,
    totalCount,
    totalPages,
    hasNextPage: page < totalPages,
    hasPrevPage: page > 1,
  };
}
