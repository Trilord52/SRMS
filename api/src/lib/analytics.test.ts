import { describe, expect, it } from 'vitest';
import {
  approvalRate,
  averageReviewHours,
  countByStatus,
  performanceScore,
  reviewedShare,
  submissionTrend,
  type ReportSample,
} from './analytics';

const at = (iso: string) => new Date(`${iso}T00:00:00Z`);

const sample = (
  reviewStatus: ReportSample['reviewStatus'],
  submitted: string,
  reviewed?: string
): ReportSample => ({
  reviewStatus,
  submissionDate: at(submitted),
  reviewedAt: reviewed ? at(reviewed) : null,
});

describe('countByStatus', () => {
  it('counts each status', () => {
    expect(
      countByStatus([
        sample('approved', '2026-03-02', '2026-03-03'),
        sample('approved', '2026-03-02', '2026-03-03'),
        sample('rejected', '2026-03-02', '2026-03-04'),
        sample('pending', '2026-03-02'),
      ])
    ).toEqual({ pending: 1, approved: 2, rejected: 1 });
  });

  it('returns zeros for no reports', () => {
    expect(countByStatus([])).toEqual({ pending: 0, approved: 0, rejected: 0 });
  });
});

describe('averageReviewHours', () => {
  it('averages over reviewed reports only', () => {
    const reports = [
      // Reviewed after exactly one day.
      sample('approved', '2026-03-02', '2026-03-03'),
      // Reviewed after exactly three days.
      sample('rejected', '2026-03-02', '2026-03-05'),
      // Never reviewed. The legacy running mean divided by the total count, so
      // this report dragged the average down as if it had been reviewed instantly.
      sample('pending', '2026-03-02'),
    ];

    expect(averageReviewHours(reports)).toBe(48);
  });

  it('is null when nothing has been reviewed', () => {
    // Distinct from zero, which would read as "reviewed immediately".
    expect(averageReviewHours([sample('pending', '2026-03-02')])).toBeNull();
  });
});

describe('reviewedShare and approvalRate', () => {
  it('measures different things', () => {
    const reports = [
      sample('approved', '2026-03-02', '2026-03-03'),
      sample('rejected', '2026-03-02', '2026-03-03'),
      sample('pending', '2026-03-02'),
    ];

    // Two of three reached a decision.
    expect(reviewedShare(reports)).toBeCloseTo(66.67, 1);
    // One of those two was approved. The legacy code computed both as
    // approved ÷ total, making them the same number.
    expect(approvalRate(reports)).toBe(50);
  });

  it('reports a null approval rate when nothing is decided', () => {
    const reports = [sample('pending', '2026-03-02')];
    expect(reviewedShare(reports)).toBe(0);
    expect(approvalRate(reports)).toBeNull();
  });
});

describe('performanceScore', () => {
  it('is zero with no reports', () => {
    expect(performanceScore([])).toBe(0);
  });

  it('gives full marks for prompt approvals', () => {
    const reports = [
      sample('approved', '2026-03-02', '2026-03-03'),
      sample('approved', '2026-03-03', '2026-03-04'),
    ];
    expect(performanceScore(reports)).toBe(100);
  });

  it('scores an all-pending backlog below an all-approved set', () => {
    const pending = [sample('pending', '2026-03-02'), sample('pending', '2026-03-03')];
    const approved = [
      sample('approved', '2026-03-02', '2026-03-03'),
      sample('approved', '2026-03-03', '2026-03-04'),
    ];

    expect(performanceScore(pending)).toBeLessThan(performanceScore(approved));
  });

  it('does not punish an unreviewed submitter as if rejected', () => {
    const unreviewed = [sample('pending', '2026-03-02')];
    const rejected = [sample('rejected', '2026-03-02', '2026-03-03')];

    // Nothing decided yet is neutral, not worse than an outright rejection.
    expect(performanceScore(unreviewed)).toBeGreaterThan(0);
    expect(performanceScore(rejected)).toBeGreaterThan(performanceScore(unreviewed));
  });

  it('penalises slow reviews', () => {
    const prompt = [sample('approved', '2026-03-02', '2026-03-03')];
    const slow = [sample('approved', '2026-03-02', '2026-03-20')];

    expect(performanceScore(slow)).toBeLessThan(performanceScore(prompt));
  });
});

describe('submissionTrend', () => {
  it('covers the whole range with daily buckets', () => {
    const reports = [
      sample('approved', '2026-03-02', '2026-03-03'),
      sample('approved', '2026-03-02', '2026-03-03'),
      sample('pending', '2026-03-04'),
    ];

    const trend = submissionTrend(reports, at('2026-03-02'), at('2026-03-05'), 'day');

    expect(trend.map((bucket) => bucket.count)).toEqual([2, 0, 1]);
    expect(trend.map((bucket) => bucket.label)).toEqual([
      '2026-03-02',
      '2026-03-03',
      '2026-03-04',
    ]);
  });

  it('starts weekly buckets on Monday', () => {
    // 2026-03-04 is a Wednesday; its bucket starts Monday 2026-03-02. The range
    // ends on the following Monday, so exactly one week is covered.
    const trend = submissionTrend(
      [sample('pending', '2026-03-04')],
      at('2026-03-04'),
      at('2026-03-09'),
      'week'
    );

    expect(trend).toHaveLength(1);
    expect(trend[0]!.start).toBe('2026-03-02T00:00:00.000Z');
    expect(trend[0]!.count).toBe(1);
  });

  it('emits a bucket per week when the range spans more than one', () => {
    const trend = submissionTrend(
      [sample('pending', '2026-03-04'), sample('pending', '2026-03-10')],
      at('2026-03-04'),
      at('2026-03-16'),
      'week'
    );

    expect(trend.map((bucket) => bucket.count)).toEqual([1, 1]);
  });

  it('buckets by calendar month', () => {
    const reports = [
      sample('pending', '2026-01-15'),
      sample('pending', '2026-02-02'),
      sample('pending', '2026-02-20'),
    ];

    const trend = submissionTrend(reports, at('2026-01-01'), at('2026-03-01'), 'month');

    expect(trend.map((b) => [b.label, b.count])).toEqual([
      ['2026-01', 1],
      ['2026-02', 2],
    ]);
  });

  it('derives buckets from the requested range, so none are structurally empty', () => {
    // The legacy weekly trend always emitted four rolling seven-day buckets
    // while filtering to the last seven days, so three could never be filled.
    const trend = submissionTrend([], at('2026-03-02'), at('2026-03-09'), 'week');
    expect(trend).toHaveLength(1);
  });

  it('produces no buckets for an empty range', () => {
    expect(submissionTrend([], at('2026-03-02'), at('2026-03-02'), 'day')).toEqual([]);
  });
});
