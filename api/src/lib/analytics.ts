import type { ReviewStatus } from './constants';

/**
 * Analytics computation, kept apart from the route so the arithmetic can be
 * tested against fixed inputs rather than through HTTP and a database.
 *
 * The legacy implementation had four defects that this replaces:
 *
 * 1. Average review time was accumulated with a running mean divided by the
 *    total number of reports rather than the number actually reviewed, so an
 *    unreviewed report silently pulled the average toward zero.
 * 2. `completionRate` and `reviewApprovalRate` were both approved ÷ total, so
 *    the performance score counted approval twice at 0.4 each and the response
 *    time contributed far less than the weights suggested.
 * 3. The weekly trend built four rolling seven-day buckets while the filter kept
 *    only the last seven days, so three of the four buckets were always empty.
 * 4. `period=custom` without dates produced an empty filter, quietly returning
 *    every report ever submitted instead of a bounded range.
 */

export interface ReportSample {
  reviewStatus: ReviewStatus;
  submissionDate: Date;
  reviewedAt: Date | null;
}

export interface ReviewCounts {
  pending: number;
  approved: number;
  rejected: number;
}

export function countByStatus(reports: readonly ReportSample[]): ReviewCounts {
  const counts: ReviewCounts = { pending: 0, approved: 0, rejected: 0 };
  for (const report of reports) counts[report.reviewStatus] += 1;
  return counts;
}

/**
 * Mean hours between submission and review, over reviewed reports only.
 * Returns null when nothing has been reviewed, which is distinct from zero.
 */
export function averageReviewHours(reports: readonly ReportSample[]): number | null {
  const reviewed = reports.filter(
    (report): report is ReportSample & { reviewedAt: Date } => report.reviewedAt !== null
  );

  if (reviewed.length === 0) return null;

  const totalMs = reviewed.reduce(
    (sum, report) => sum + (report.reviewedAt.getTime() - report.submissionDate.getTime()),
    0
  );

  return round(totalMs / reviewed.length / 3_600_000, 2);
}

/** Share of reports that reached a decision, approved or rejected. */
export function reviewedShare(reports: readonly ReportSample[]): number {
  if (reports.length === 0) return 0;
  const decided = reports.filter((report) => report.reviewStatus !== 'pending').length;
  return round((decided / reports.length) * 100, 2);
}

/** Share of decided reports that were approved. Null when none were decided. */
export function approvalRate(reports: readonly ReportSample[]): number | null {
  const decided = reports.filter((report) => report.reviewStatus !== 'pending');
  if (decided.length === 0) return null;
  const approved = decided.filter((report) => report.reviewStatus === 'approved').length;
  return round((approved / decided.length) * 100, 2);
}

/**
 * Composite score from three independent signals, so no single one is counted
 * twice: how much work reached a decision, how much of it was approved, and how
 * promptly it was reviewed. Null inputs are treated as neutral rather than zero,
 * so a submitter with nothing yet reviewed is not scored as if rejected.
 */
export function performanceScore(reports: readonly ReportSample[]): number {
  if (reports.length === 0) return 0;

  const decided = reviewedShare(reports) / 100;
  const approved = (approvalRate(reports) ?? 50) / 100;
  const hours = averageReviewHours(reports);
  // A review inside 24 hours scores full marks, decaying to zero at 7 days.
  const promptness = hours === null ? 0.5 : clamp(1 - Math.max(0, hours - 24) / (6 * 24), 0, 1);

  return Math.round((decided * 0.4 + approved * 0.4 + promptness * 0.2) * 100);
}

export interface TrendBucket {
  label: string;
  start: string;
  end: string;
  count: number;
}

export type TrendGranularity = 'day' | 'week' | 'month';

/**
 * Buckets submissions across a range. Buckets are derived from the same range
 * the reports were filtered by, so an empty bucket means no submissions rather
 * than a window the filter never included.
 */
export function submissionTrend(
  reports: readonly ReportSample[],
  from: Date,
  to: Date,
  granularity: TrendGranularity
): TrendBucket[] {
  const buckets: TrendBucket[] = [];
  let cursor = startOfBucket(from, granularity);
  let guard = 0;

  while (cursor < to && guard < 400) {
    const next = advance(cursor, granularity);
    const start = cursor;
    const end = next;

    buckets.push({
      label: labelFor(start, granularity),
      start: start.toISOString(),
      end: end.toISOString(),
      count: reports.filter(
        (report) => report.submissionDate >= start && report.submissionDate < end
      ).length,
    });

    cursor = next;
    guard += 1;
  }

  return buckets;
}

function startOfBucket(date: Date, granularity: TrendGranularity): Date {
  const utc = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
  );

  if (granularity === 'month') {
    return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
  }

  if (granularity === 'week') {
    // ISO weeks start Monday.
    const isoDay = utc.getUTCDay() === 0 ? 7 : utc.getUTCDay();
    utc.setUTCDate(utc.getUTCDate() - (isoDay - 1));
  }

  return utc;
}

function advance(date: Date, granularity: TrendGranularity): Date {
  const next = new Date(date);
  if (granularity === 'day') next.setUTCDate(next.getUTCDate() + 1);
  else if (granularity === 'week') next.setUTCDate(next.getUTCDate() + 7);
  else next.setUTCMonth(next.getUTCMonth() + 1);
  return next;
}

function labelFor(date: Date, granularity: TrendGranularity): string {
  const iso = date.toISOString().slice(0, 10);
  if (granularity === 'day') return iso;
  if (granularity === 'month') return iso.slice(0, 7);
  return `week of ${iso}`;
}

function round(value: number, places: number): number {
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
