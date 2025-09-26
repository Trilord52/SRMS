import { Router, type Request, type Response } from 'express';
import { Types } from 'mongoose';
import { z } from 'zod';
import {
  approvalRate,
  averageReviewHours,
  countByStatus,
  performanceScore,
  reviewedShare,
  submissionTrend,
  type ReportSample,
  type TrendGranularity,
} from '../lib/analytics';
import { authenticate, requireRole } from '../middleware/auth';
import { validate, validatedQuery } from '../middleware/validate';
import { ReportModel } from '../models/Report';
import { objectIdSchema } from '../schemas/auth.schema';

export const analyticsRouter = Router();

/**
 * Every range is explicit and bounded. The legacy endpoint accepted
 * `period=custom` with no dates and fell through to an empty filter, quietly
 * aggregating every report ever submitted.
 */
const rangeQuerySchema = z
  .object({
    from: z.coerce.date().optional(),
    to: z.coerce.date().optional(),
    granularity: z.enum(['day', 'week', 'month']).optional(),
    submittedBy: objectIdSchema.optional(),
    templateId: objectIdSchema.optional(),
  })
  .transform((query) => {
    // Default to the last 30 days when no range is given.
    const to = query.to ?? new Date();
    const from = query.from ?? new Date(to.getTime() - 30 * 86_400_000);
    return { ...query, from, to };
  })
  .refine((query) => query.from <= query.to, {
    message: 'from must not be after to',
    path: ['from'],
  });

type RangeQuery = z.infer<typeof rangeQuerySchema>;

/** Choose a bucket size that keeps the chart readable over the given span. */
function defaultGranularity(from: Date, to: Date): TrendGranularity {
  const days = (to.getTime() - from.getTime()) / 86_400_000;
  if (days <= 31) return 'day';
  if (days <= 182) return 'week';
  return 'month';
}

analyticsRouter.use(authenticate, requireRole('supervisor', 'manager'));

analyticsRouter.get(
  '/overview',
  validate('query', rangeQuerySchema),
  async (req: Request, res: Response) => {
    const query = validatedQuery<RangeQuery>(req);
    const reports = await loadSamples(query);

    res.json({
      range: { from: query.from.toISOString(), to: query.to.toISOString() },
      totals: {
        reports: reports.length,
        ...countByStatus(reports),
      },
      metrics: {
        reviewedSharePercent: reviewedShare(reports),
        approvalRatePercent: approvalRate(reports),
        averageReviewHours: averageReviewHours(reports),
        performanceScore: performanceScore(reports),
      },
      trend: submissionTrend(
        reports,
        query.from,
        query.to,
        query.granularity ?? defaultGranularity(query.from, query.to)
      ),
    });
  }
);

analyticsRouter.get(
  '/by-submitter',
  validate('query', rangeQuerySchema),
  async (req: Request, res: Response) => {
    const query = validatedQuery<RangeQuery>(req);

    const reports = await ReportModel.find(buildFilter(query))
      .select('reviewStatus submissionDate reviewedAt submittedBy')
      .populate('submittedBy', 'firstName lastName userId email department role')
      .lean();

    const groups = new Map<string, { submitter: unknown; samples: ReportSample[] }>();

    for (const report of reports) {
      const submitter = report.submittedBy as unknown as
        | { _id: Types.ObjectId; firstName: string; lastName: string }
        | null;
      if (!submitter) continue;

      const key = submitter._id.toString();
      if (!groups.has(key)) groups.set(key, { submitter, samples: [] });
      groups.get(key)!.samples.push(toSample(report));
    }

    const submitters = [...groups.values()]
      .map(({ submitter, samples }) => ({
        submitter,
        totals: { reports: samples.length, ...countByStatus(samples) },
        metrics: {
          reviewedSharePercent: reviewedShare(samples),
          approvalRatePercent: approvalRate(samples),
          averageReviewHours: averageReviewHours(samples),
          performanceScore: performanceScore(samples),
        },
        lastSubmission: samples
          .reduce((latest, s) => (s.submissionDate > latest ? s.submissionDate : latest),
            samples[0]!.submissionDate)
          .toISOString(),
      }))
      .sort((a, b) => b.metrics.performanceScore - a.metrics.performanceScore);

    res.json({
      range: { from: query.from.toISOString(), to: query.to.toISOString() },
      submitters,
    });
  }
);

analyticsRouter.get(
  '/by-template',
  validate('query', rangeQuerySchema),
  async (req: Request, res: Response) => {
    const query = validatedQuery<RangeQuery>(req);

    const reports = await ReportModel.find(buildFilter(query))
      .select('reviewStatus submissionDate reviewedAt templateId')
      .populate('templateId', 'name category version')
      .lean();

    const groups = new Map<string, { template: unknown; samples: ReportSample[] }>();

    for (const report of reports) {
      const template = report.templateId as unknown as
        | { _id: Types.ObjectId; name: string }
        | null;
      if (!template) continue;

      const key = template._id.toString();
      if (!groups.has(key)) groups.set(key, { template, samples: [] });
      groups.get(key)!.samples.push(toSample(report));
    }

    // Grouped by template, and named accordingly. The legacy endpoint called
    // this "databasePerformance" while in fact grouping by template name.
    const templates = [...groups.values()]
      .map(({ template, samples }) => ({
        template,
        totals: { reports: samples.length, ...countByStatus(samples) },
        metrics: {
          reviewedSharePercent: reviewedShare(samples),
          approvalRatePercent: approvalRate(samples),
          averageReviewHours: averageReviewHours(samples),
          performanceScore: performanceScore(samples),
        },
      }))
      .sort((a, b) => b.totals.reports - a.totals.reports);

    res.json({
      range: { from: query.from.toISOString(), to: query.to.toISOString() },
      templates,
    });
  }
);

function buildFilter(query: RangeQuery): Record<string, unknown> {
  const filter: Record<string, unknown> = {
    submissionDate: { $gte: query.from, $lte: query.to },
  };
  if (query.submittedBy) filter.submittedBy = new Types.ObjectId(query.submittedBy);
  if (query.templateId) filter.templateId = new Types.ObjectId(query.templateId);
  return filter;
}

async function loadSamples(query: RangeQuery): Promise<ReportSample[]> {
  const reports = await ReportModel.find(buildFilter(query))
    .select('reviewStatus submissionDate reviewedAt')
    .lean();
  return reports.map(toSample);
}

function toSample(report: {
  reviewStatus: string;
  submissionDate: Date;
  reviewedAt?: Date | null;
}): ReportSample {
  return {
    reviewStatus: report.reviewStatus as ReportSample['reviewStatus'],
    submissionDate: new Date(report.submissionDate),
    reviewedAt: report.reviewedAt ? new Date(report.reviewedAt) : null,
  };
}
