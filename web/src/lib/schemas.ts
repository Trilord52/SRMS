import { z } from 'zod';

/**
 * Response shapes, mirrored from the API's Zod schemas.
 *
 * Parsing rather than casting means a response that drifts from what the client
 * expects fails at the boundary with a readable path, instead of surfacing as
 * `undefined` somewhere inside a component.
 */

export const ROLES = ['staff', 'supervisor', 'manager'] as const;
export type Role = (typeof ROLES)[number];

export const FIELD_TYPES = [
  'text',
  'number',
  'date',
  'select',
  'checkbox',
  'textarea',
  'file',
  'yesno',
] as const;
export type FieldType = (typeof FIELD_TYPES)[number];

export const userSchema = z.object({
  _id: z.string(),
  firstName: z.string(),
  lastName: z.string(),
  userId: z.string(),
  email: z.string(),
  role: z.enum(ROLES),
  accountStatus: z.enum(['pending', 'approved', 'rejected']),
  isApproved: z.boolean().optional(),
  department: z.string().nullable().optional(),
  phoneNumber: z.string().nullable().optional(),
  rejectionReason: z.string().nullable().optional(),
  createdAt: z.string().optional(),
});
export type User = z.infer<typeof userSchema>;

export const templateFieldSchema = z.object({
  _id: z.string().optional(),
  name: z.string(),
  type: z.enum(FIELD_TYPES),
  label: z.string(),
  placeholder: z.string().optional().default(''),
  defaultValue: z.unknown().nullable().optional(),
  required: z.boolean().optional().default(false),
  options: z.array(z.object({ value: z.string(), label: z.string() })).optional().default([]),
  validators: z
    .object({
      minLength: z.number().nullable().optional(),
      maxLength: z.number().nullable().optional(),
      min: z.number().nullable().optional(),
      max: z.number().nullable().optional(),
      pattern: z.string().nullable().optional(),
      customMessage: z.string().nullable().optional(),
    })
    .nullable()
    .optional(),
  order: z.number().optional().default(0),
  readOnly: z.boolean().optional().default(false),
});
export type TemplateField = z.infer<typeof templateFieldSchema>;

export const templateSchema = z.object({
  _id: z.string(),
  name: z.string(),
  description: z.string(),
  category: z.string(),
  fields: z.array(templateFieldSchema),
  isActive: z.boolean(),
  version: z.number(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});
export type Template = z.infer<typeof templateSchema>;

export const reportFileSchema = z.object({
  _id: z.string(),
  storedName: z.string(),
  originalName: z.string(),
  mimeType: z.string(),
  size: z.number(),
  uploadedAt: z.string().optional(),
});
export type ReportFile = z.infer<typeof reportFileSchema>;

/** A referenced document is either an id or the populated document. */
const refOr = <T extends z.ZodTypeAny>(schema: T) => z.union([z.string(), schema]);

export const reportSchema = z.object({
  _id: z.string(),
  templateId: refOr(
    z.object({
      _id: z.string(),
      name: z.string(),
      category: z.string().optional(),
      version: z.number().optional(),
      fields: z.array(templateFieldSchema).optional(),
    })
  ),
  templateVersion: z.number(),
  templateData: z.record(z.string(), z.unknown()),
  revisionOf: z.string().nullable(),
  submittedBy: refOr(
    z.object({
      _id: z.string(),
      firstName: z.string(),
      lastName: z.string(),
      userId: z.string().optional(),
      email: z.string().optional(),
      role: z.enum(ROLES).optional(),
      department: z.string().nullable().optional(),
    })
  ),
  submissionDate: z.string(),
  periodStart: z.string(),
  isoYear: z.number(),
  isoWeek: z.number(),
  reviewStatus: z.enum(['pending', 'approved', 'rejected']),
  reviewedBy: z.string().nullable(),
  reviewedAt: z.string().nullable(),
  reviewComments: z.string().nullable(),
  supervisorComments: z.string().nullable(),
  rejectionReason: z.string().nullable(),
  files: z.array(refOr(reportFileSchema)),
});
export type Report = z.infer<typeof reportSchema>;

export const databaseSchema = z.object({
  _id: z.string(),
  name: z.string(),
  databaseType: z.string(),
  host: z.string(),
  dbVersion: z.string(),
  osVersion: z.string(),
  isActive: z.boolean(),
  customFeatures: z
    .array(
      z.object({
        _id: z.string().optional(),
        name: z.string(),
        type: z.enum(['enum', 'input', 'number', 'date']),
        label: z.string(),
        required: z.boolean().optional().default(false),
        enumOptions: z.array(z.string()).optional().default([]),
        description: z.string().nullable().optional(),
      })
    )
    .optional()
    .default([]),
  createdAt: z.string().optional(),
});
export type DatabaseRecord = z.infer<typeof databaseSchema>;

export const paginationSchema = z.object({
  page: z.number(),
  limit: z.number(),
  totalCount: z.number(),
  totalPages: z.number(),
  hasNextPage: z.boolean(),
  hasPrevPage: z.boolean(),
});
export type Pagination = z.infer<typeof paginationSchema>;

export const loginResponseSchema = z.object({ token: z.string(), user: userSchema });
export const meResponseSchema = z.object({ user: userSchema });
export const usersResponseSchema = z.object({
  users: z.array(userSchema),
  pagination: paginationSchema.optional(),
});
export const templatesResponseSchema = z.object({
  templates: z.array(templateSchema),
  pagination: paginationSchema,
});
export const templateResponseSchema = z.object({ template: templateSchema });
export const reportsResponseSchema = z.object({
  reports: z.array(reportSchema),
  pagination: paginationSchema,
});
export const reportResponseSchema = z.object({ report: reportSchema });
export const databasesResponseSchema = z.object({
  databases: z.array(databaseSchema),
  pagination: paginationSchema,
});
export const databaseResponseSchema = z.object({ database: databaseSchema });

const metricsSchema = z.object({
  reviewedSharePercent: z.number(),
  /** Null when nothing has been decided, which differs from zero approved. */
  approvalRatePercent: z.number().nullable(),
  /** Null when nothing has been reviewed, which differs from an instant review. */
  averageReviewHours: z.number().nullable(),
  performanceScore: z.number(),
});

export const analyticsOverviewSchema = z.object({
  range: z.object({ from: z.string(), to: z.string() }),
  totals: z.object({
    reports: z.number(),
    pending: z.number(),
    approved: z.number(),
    rejected: z.number(),
  }),
  metrics: metricsSchema,
  trend: z.array(
    z.object({ label: z.string(), start: z.string(), end: z.string(), count: z.number() })
  ),
});
export type AnalyticsOverview = z.infer<typeof analyticsOverviewSchema>;

export const analyticsBySubmitterSchema = z.object({
  range: z.object({ from: z.string(), to: z.string() }),
  submitters: z.array(
    z.object({
      submitter: z.object({
        _id: z.string(),
        firstName: z.string(),
        lastName: z.string(),
        department: z.string().nullable().optional(),
      }),
      totals: z.object({
        reports: z.number(),
        pending: z.number(),
        approved: z.number(),
        rejected: z.number(),
      }),
      metrics: metricsSchema,
      lastSubmission: z.string(),
    })
  ),
});

export const analyticsByTemplateSchema = z.object({
  range: z.object({ from: z.string(), to: z.string() }),
  templates: z.array(
    z.object({
      template: z.object({ _id: z.string(), name: z.string(), category: z.string().optional() }),
      totals: z.object({
        reports: z.number(),
        pending: z.number(),
        approved: z.number(),
        rejected: z.number(),
      }),
      metrics: metricsSchema,
    })
  ),
});

/** Reads a reference that may be an id or a populated document. */
export function refId(value: string | { _id: string }): string {
  return typeof value === 'string' ? value : value._id;
}

export function isPopulated<T extends { _id: string }>(value: string | T): value is T {
  return typeof value !== 'string';
}

export function fullName(user: { firstName: string; lastName: string }): string {
  return `${user.firstName} ${user.lastName}`.trim();
}
