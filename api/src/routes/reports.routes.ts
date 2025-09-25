import { Router, type Request, type Response } from 'express';
import multer from 'multer';
import { Types } from 'mongoose';
import { z } from 'zod';
import { config } from '../config/env';
import { CAN_REVIEW_REPORTS } from '../lib/constants';
import { badRequest, conflict, forbidden, notFound } from '../lib/errors';
import { periodPartsFor } from '../lib/isoWeek';
import { buildPagination } from '../lib/pagination';
import { deleteFiles, openDownloadStream, storeFile } from '../lib/storage';
import { authenticate, requireRole } from '../middleware/auth';
import { zodDetails } from '../middleware/errorHandler';
import { validate, validatedQuery } from '../middleware/validate';
import { ReportModel, type ReportDocument } from '../models/Report';
import { ReportFileModel } from '../models/ReportFile';
import { TemplateModel, type TemplateDocument } from '../models/Template';
import { objectIdSchema } from '../schemas/auth.schema';
import {
  createReportSchema,
  listReportsQuerySchema,
  parseJsonField,
  reviewReportSchema,
  updateReportSchema,
  type ListReportsQuery,
  type ReviewReportInput,
} from '../schemas/report.schema';
import { buildTemplateDataSchema, type FieldDefinition } from '../schemas/template.schema';

export const reportsRouter = Router();

const idParams = z.object({ id: objectIdSchema });

/**
 * Uploads are buffered in memory and then written to GridFS. Multer's disk
 * storage is deliberately avoided: it needs a writable directory that a hosted
 * platform discards on deploy, and it derives filenames from client input.
 */
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: config.MAX_UPLOAD_BYTES,
    files: 10,
  },
  fileFilter: (_req, file, callback) => {
    // An allowlist, so an uploaded .html or .svg cannot be served back and run
    // in a viewer's browser. The legacy endpoint accepted any type or size.
    const allowed = new Set([
      'image/png',
      'image/jpeg',
      'image/gif',
      'image/webp',
      'application/pdf',
      'text/plain',
      'text/csv',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ]);

    if (allowed.has(file.mimetype)) {
      callback(null, true);
      return;
    }
    callback(new multer.MulterError('LIMIT_UNEXPECTED_FILE', file.fieldname));
  },
});

reportsRouter.use(authenticate);

reportsRouter.get(
  '/',
  validate('query', listReportsQuerySchema),
  async (req: Request, res: Response) => {
    const query = validatedQuery<ListReportsQuery>(req);
    const filter = buildReportFilter(query, req);

    const [reports, totalCount] = await Promise.all([
      ReportModel.find(filter)
        .sort({ submissionDate: query.sort === 'oldest' ? 1 : -1 })
        .skip((query.page - 1) * query.limit)
        .limit(query.limit)
        .populate('submittedBy', 'firstName lastName userId email role department')
        .populate('templateId', 'name category version')
        .populate('files', 'storedName originalName mimeType size uploadedAt'),
      ReportModel.countDocuments(filter),
    ]);

    res.json({
      reports: reports.map((report) => report.toJSON()),
      pagination: buildPagination(query.page, query.limit, totalCount),
    });
  }
);

reportsRouter.get('/:id', validate('params', idParams), async (req: Request, res: Response) => {
  const report = await ReportModel.findById(req.params.id)
    .populate('submittedBy', 'firstName lastName userId email role department')
    .populate('templateId', 'name category version fields')
    .populate('files', 'storedName originalName mimeType size uploadedAt');

  if (!report) throw notFound('Report');
  assertCanViewReport(report, req);

  res.json({ report: report.toJSON() });
});

reportsRouter.post(
  '/',
  upload.array('files', 10),
  async (req: Request, res: Response) => {
    // Multipart values arrive as strings, so JSON parts are parsed before the
    // schema runs rather than being coerced piecemeal.
    const parsed = createReportSchema.safeParse({
      ...req.body,
      templateData: parseJsonField(req.body.templateData, 'templateData'),
    });

    if (!parsed.success) throw badRequest('Invalid report submission', zodDetails(parsed.error));
    const input = parsed.data;

    const template = await TemplateModel.findById(input.templateId);
    if (!template) throw notFound('Template');
    if (!template.isActive) throw conflict('That template has been retired');

    const revisionOf = input.revisionOf
      ? await loadRevisionTarget(input.revisionOf, req)
      : null;

    const uploads = (req.files as Express.Multer.File[] | undefined) ?? [];
    const storedFiles = await Promise.all(
      uploads.map((file) => storeFile(file, req.auth!.userId))
    );

    try {
      // Answers are validated against the template they were submitted for, and
      // any `file` answers are resolved to the names the server assigned.
      const answers = withResolvedFileAnswers(input.templateData, template, storedFiles);
      const dataSchema = buildTemplateDataSchema(template.fields as unknown as FieldDefinition[]);
      const validated = dataSchema.safeParse(answers);

      if (!validated.success) {
        throw badRequest('Report answers do not match the template', zodDetails(validated.error));
      }

      const period = periodPartsFor(input.periodStart);

      const report = await ReportModel.create({
        templateId: template._id,
        templateVersion: template.version,
        templateData: validated.data,
        revisionOf: revisionOf?._id ?? null,
        submittedBy: new Types.ObjectId(req.auth!.userId),
        submissionDate: new Date(),
        periodStart: input.periodStart,
        ...period,
        files: storedFiles.map((file) => file._id),
      });

      await ReportFileModel.updateMany(
        { _id: { $in: storedFiles.map((file) => file._id) } },
        { reportId: report._id }
      );

      res.status(201).json({ report: report.toJSON() });
    } catch (error) {
      // A rejected submission must not leave orphaned bytes in GridFS.
      await deleteFiles(storedFiles.map((file) => file._id));
      throw error;
    }
  }
);

reportsRouter.patch(
  '/:id',
  validate('params', idParams),
  upload.array('files', 10),
  async (req: Request, res: Response) => {
    const report = await ReportModel.findById(req.params.id);
    if (!report) throw notFound('Report');

    // Only the author may edit, and only while the report is still unreviewed.
    if (report.submittedBy.toString() !== req.auth!.userId) {
      throw forbidden('Only the submitter can edit a report');
    }
    if (report.reviewStatus !== 'pending') {
      throw conflict(`This report was already ${report.reviewStatus} and cannot be edited`);
    }

    const parsed = updateReportSchema.safeParse({
      ...req.body,
      templateData: parseJsonField(req.body.templateData, 'templateData'),
      removeFileIds: parseJsonField(req.body.removeFileIds, 'removeFileIds'),
    });
    if (!parsed.success) throw badRequest('Invalid report update', zodDetails(parsed.error));
    const input = parsed.data;

    const template = await TemplateModel.findById(report.templateId);
    if (!template) throw notFound('Template');

    const uploads = (req.files as Express.Multer.File[] | undefined) ?? [];
    const storedFiles = await Promise.all(
      uploads.map((file) => storeFile(file, req.auth!.userId))
    );

    try {
      if (input.templateData) {
        const answers = withResolvedFileAnswers(input.templateData, template, storedFiles);
        const dataSchema = buildTemplateDataSchema(template.fields as unknown as FieldDefinition[]);
        const validated = dataSchema.safeParse(answers);
        if (!validated.success) {
          throw badRequest('Report answers do not match the template', zodDetails(validated.error));
        }
        report.templateData = validated.data;
      }

      if (input.periodStart) {
        report.periodStart = input.periodStart;
        Object.assign(report, periodPartsFor(input.periodStart));
      }

      if (input.removeFileIds?.length) {
        const removable = new Set(report.files.map((id) => id.toString()));
        const toRemove = input.removeFileIds.filter((id) => removable.has(id));
        report.files = report.files.filter((id) => !toRemove.includes(id.toString()));
        await deleteFiles(toRemove.map((id) => new Types.ObjectId(id)));
      }

      if (storedFiles.length) {
        report.files.push(...storedFiles.map((file) => file._id));
        await ReportFileModel.updateMany(
          { _id: { $in: storedFiles.map((file) => file._id) } },
          { reportId: report._id }
        );
      }

      await report.save();
      res.json({ report: report.toJSON() });
    } catch (error) {
      await deleteFiles(storedFiles.map((file) => file._id));
      throw error;
    }
  }
);

reportsRouter.post(
  '/:id/review',
  requireRole('supervisor', 'manager'),
  validate('params', idParams),
  validate('body', reviewReportSchema),
  async (req: Request, res: Response) => {
    const input = req.body as ReviewReportInput;
    const report = await ReportModel.findById(req.params.id);
    if (!report) throw notFound('Report');

    if (report.reviewStatus !== 'pending') {
      throw conflict(`This report was already ${report.reviewStatus}`);
    }

    // A reviewer cannot rule on their own submission.
    if (report.submittedBy.toString() === req.auth!.userId) {
      throw forbidden('You cannot review your own report');
    }

    report.reviewStatus = input.decision;
    report.reviewedBy = new Types.ObjectId(req.auth!.userId);
    report.reviewedAt = new Date();
    report.reviewComments = input.reviewComments ?? null;
    report.supervisorComments = input.supervisorComments ?? null;
    report.rejectionReason = input.decision === 'rejected' ? input.rejectionReason! : null;
    await report.save();

    res.json({ report: report.toJSON() });
  }
);

reportsRouter.get(
  '/files/:fileId',
  validate('params', z.object({ fileId: objectIdSchema })),
  async (req: Request, res: Response) => {
    const file = await ReportFileModel.findById(req.params.fileId);
    if (!file) throw notFound('File');

    // Attachments are reached by their own id, and access is decided by the
    // report that owns them. There is no filesystem path involved at any point,
    // so the traversal that the legacy download endpoint allowed cannot arise.
    if (!file.reportId) throw notFound('File');

    const report = await ReportModel.findById(file.reportId);
    if (!report) throw notFound('File');
    assertCanViewReport(report, req);

    res.setHeader('Content-Type', file.mimeType);
    res.setHeader('Content-Length', String(file.size));
    // `attachment` plus a quoted, sanitised name so the browser downloads rather
    // than renders, and the header cannot be split by a crafted filename.
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${file.originalName.replace(/[^\w.\- ]/g, '_')}"`
    );
    res.setHeader('X-Content-Type-Options', 'nosniff');

    openDownloadStream(file.gridFsId)
      .on('error', () => {
        if (!res.headersSent) res.status(404).end();
        else res.end();
      })
      .pipe(res);
  }
);

reportsRouter.delete(
  '/:id',
  requireRole('manager'),
  validate('params', idParams),
  async (req: Request, res: Response) => {
    const report = await ReportModel.findById(req.params.id);
    if (!report) throw notFound('Report');

    await deleteFiles(report.files);
    await report.deleteOne();

    res.json({ message: 'Report deleted.' });
  }
);

/** Scope a list query to what the caller is allowed to see. */
function buildReportFilter(query: ListReportsQuery, req: Request): Record<string, unknown> {
  const filter: Record<string, unknown> = {};

  if (query.reviewStatus) filter.reviewStatus = query.reviewStatus;
  if (query.templateId) filter.templateId = new Types.ObjectId(query.templateId);
  if (query.isoYear) filter.isoYear = query.isoYear;
  if (query.isoWeek) filter.isoWeek = query.isoWeek;

  if (query.from || query.to) {
    const range: Record<string, Date> = {};
    if (query.from) range.$gte = query.from;
    if (query.to) range.$lte = query.to;
    filter.periodStart = range;
  }

  // Staff see only their own reports, whatever the query asks for.
  if (req.auth!.role === 'staff') {
    filter.submittedBy = new Types.ObjectId(req.auth!.userId);
  } else if (query.submittedBy) {
    filter.submittedBy = new Types.ObjectId(query.submittedBy);
  }

  return filter;
}

function assertCanViewReport(report: ReportDocument, req: Request): void {
  const isOwner = report.submittedBy.toString() === req.auth!.userId;
  const isReviewer = CAN_REVIEW_REPORTS.includes(req.auth!.role);

  if (!isOwner && !isReviewer) {
    // 404 rather than 403: a staff member should not learn that a report they
    // cannot see exists.
    throw notFound('Report');
  }
}

async function loadRevisionTarget(revisionOf: string, req: Request): Promise<ReportDocument> {
  const original = await ReportModel.findById(revisionOf);
  if (!original) throw notFound('Report being revised');

  if (original.submittedBy.toString() !== req.auth!.userId) {
    throw forbidden('You can only revise your own report');
  }
  if (original.reviewStatus !== 'rejected') {
    throw conflict('Only a rejected report can be revised');
  }

  const existing = await ReportModel.countDocuments({ revisionOf: original._id });
  if (existing > 0) throw conflict('That report has already been revised');

  return original;
}

/**
 * Replaces `file`-typed answers with the storage names the server generated.
 *
 * A client cannot name an existing file here: the value it sends is discarded
 * and the attachments uploaded with the request are assigned in field order.
 */
function withResolvedFileAnswers(
  answers: Record<string, unknown>,
  template: TemplateDocument,
  storedFiles: readonly { storedName: string }[]
): Record<string, unknown> {
  const fileFields = template.fields
    .filter((field) => field.type === 'file')
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  if (fileFields.length === 0) return answers;

  const resolved = { ...answers };
  fileFields.forEach((field, index) => {
    const stored = storedFiles[index];
    if (stored) resolved[field.name] = stored.storedName;
    else delete resolved[field.name];
  });

  return resolved;
}
