import { z } from 'zod';
import { REVIEW_STATUSES } from '../lib/constants';
import { objectIdSchema } from './auth.schema';

/**
 * A report submission.
 *
 * `templateData` is only shape-checked here; its real validation is built from
 * the referenced template's field definitions at request time, because the
 * contract depends on which template was chosen.
 */
export const createReportSchema = z.object({
  templateId: objectIdSchema,
  /**
   * The period the report covers, supplied by the submitter. The legacy schema
   * derived the week from the submission moment, so a report filed on Monday
   * about last week was attributed to the wrong week.
   */
  periodStart: z.coerce.date(),
  templateData: z.record(z.string(), z.unknown()).default({}),
  /** Present when this submission replaces a rejected report. */
  revisionOf: objectIdSchema.optional(),
});

export const updateReportSchema = z.object({
  periodStart: z.coerce.date().optional(),
  templateData: z.record(z.string(), z.unknown()).optional(),
  /** Attachment ids to detach and delete. */
  removeFileIds: z.array(objectIdSchema).optional(),
});

/**
 * A review decision. A rejection must say why, so the submitter has something
 * actionable; the legacy endpoint allowed a bare rejection.
 */
export const reviewReportSchema = z
  .object({
    decision: z.enum(['approved', 'rejected']),
    reviewComments: z.string().trim().max(2000).optional(),
    supervisorComments: z.string().trim().max(2000).optional(),
    rejectionReason: z.string().trim().min(3).max(500).optional(),
  })
  .refine((body) => body.decision !== 'rejected' || Boolean(body.rejectionReason), {
    message: 'A rejection must include a rejectionReason',
    path: ['rejectionReason'],
  });

export const listReportsQuerySchema = z
  .object({
    reviewStatus: z.enum(REVIEW_STATUSES).optional(),
    templateId: objectIdSchema.optional(),
    submittedBy: objectIdSchema.optional(),
    isoYear: z.coerce.number().int().min(2000).max(2100).optional(),
    isoWeek: z.coerce.number().int().min(1).max(53).optional(),
    from: z.coerce.date().optional(),
    to: z.coerce.date().optional(),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    sort: z.enum(['newest', 'oldest']).default('newest'),
  })
  .refine((query) => !(query.from && query.to) || query.from <= query.to, {
    message: 'from must not be after to',
    path: ['from'],
  })
  .refine((query) => (query.isoWeek === undefined) === (query.isoYear === undefined) || query.isoYear !== undefined, {
    message: 'isoWeek requires isoYear',
    path: ['isoWeek'],
  });

export type CreateReportInput = z.infer<typeof createReportSchema>;
export type UpdateReportInput = z.infer<typeof updateReportSchema>;
export type ReviewReportInput = z.infer<typeof reviewReportSchema>;
export type ListReportsQuery = z.infer<typeof listReportsQuerySchema>;

/**
 * Multipart bodies arrive as strings, so JSON-valued parts are parsed before
 * schema validation rather than being coerced field by field.
 */
export function parseJsonField(value: unknown, field: string): unknown {
  if (typeof value !== 'string') return value;
  if (value.trim() === '') return undefined;
  try {
    return JSON.parse(value);
  } catch {
    throw new z.ZodError([
      {
        code: 'custom',
        path: [field],
        message: `${field} must be valid JSON`,
        input: value,
      },
    ]);
  }
}
