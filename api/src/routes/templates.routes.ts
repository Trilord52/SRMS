import { Router, type Request, type Response } from 'express';
import { Types } from 'mongoose';
import { z } from 'zod';
import { conflict, forbidden, notFound } from '../lib/errors';
import { authenticate, requireRole } from '../middleware/auth';
import { validate, validatedQuery } from '../middleware/validate';
import { ReportModel } from '../models/Report';
import { TemplateModel } from '../models/Template';
import { objectIdSchema } from '../schemas/auth.schema';
import {
  createTemplateSchema,
  listTemplatesQuerySchema,
  updateTemplateSchema,
  type CreateTemplateInput,
  type UpdateTemplateInput,
} from '../schemas/template.schema';
import { buildPagination } from '../lib/pagination';

export const templatesRouter = Router();

const idParams = z.object({ id: objectIdSchema });

templatesRouter.use(authenticate);

templatesRouter.get(
  '/',
  validate('query', listTemplatesQuerySchema),
  async (req: Request, res: Response) => {
    const { category, isActive, page, limit } = validatedQuery<
      z.infer<typeof listTemplatesQuerySchema>
    >(req);

    const filter: Record<string, unknown> = {};
    if (category) filter.category = category;
    if (isActive !== undefined) filter.isActive = isActive;

    // Staff choose from active templates only; the full list is administrative.
    if (req.auth!.role === 'staff') filter.isActive = true;

    const [templates, totalCount] = await Promise.all([
      TemplateModel.find(filter)
        .sort({ updatedAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      TemplateModel.countDocuments(filter),
    ]);

    res.json({
      templates: templates.map((template) => template.toJSON()),
      pagination: buildPagination(page, limit, totalCount),
    });
  }
);

templatesRouter.get('/:id', validate('params', idParams), async (req: Request, res: Response) => {
  const template = await TemplateModel.findById(req.params.id);
  if (!template) throw notFound('Template');

  if (req.auth!.role === 'staff' && !template.isActive) throw notFound('Template');

  res.json({ template: template.toJSON() });
});

templatesRouter.post(
  '/',
  requireRole('manager'),
  validate('body', createTemplateSchema),
  async (req: Request, res: Response) => {
    const input = req.body as CreateTemplateInput;

    const template = await TemplateModel.create({
      ...input,
      version: 1,
      createdBy: new Types.ObjectId(req.auth!.userId),
    });

    res.status(201).json({ template: template.toJSON() });
  }
);

templatesRouter.patch(
  '/:id',
  requireRole('manager'),
  validate('params', idParams),
  validate('body', updateTemplateSchema),
  async (req: Request, res: Response) => {
    const input = req.body as UpdateTemplateInput;
    const template = await TemplateModel.findById(req.params.id);
    if (!template) throw notFound('Template');

    // Changing the field set changes how existing answers should be read, so the
    // version is bumped. Reports record the version they were submitted against,
    // which is what keeps historic submissions interpretable.
    const fieldsChanged =
      input.fields !== undefined &&
      JSON.stringify(input.fields.map(summariseField)) !==
        JSON.stringify(template.fields.map(summariseField));

    if (input.name !== undefined) template.name = input.name;
    if (input.description !== undefined) template.description = input.description;
    if (input.category !== undefined) template.category = input.category;
    if (input.isActive !== undefined) template.isActive = input.isActive;
    if (input.fields !== undefined) template.set('fields', input.fields);
    if (fieldsChanged) template.version += 1;

    template.lastModifiedBy = new Types.ObjectId(req.auth!.userId);
    await template.save();

    res.json({ template: template.toJSON(), versionBumped: fieldsChanged });
  }
);

templatesRouter.delete(
  '/:id',
  requireRole('manager'),
  validate('params', idParams),
  async (req: Request, res: Response) => {
    const template = await TemplateModel.findById(req.params.id);
    if (!template) throw notFound('Template');

    const reportCount = await ReportModel.countDocuments({ templateId: template._id });

    // A template that reports point at is retired rather than removed, so those
    // reports keep the definition needed to interpret their answers.
    if (reportCount > 0) {
      if (!template.isActive) {
        throw conflict(`This template is already retired and is used by ${reportCount} report(s)`);
      }

      template.isActive = false;
      template.lastModifiedBy = new Types.ObjectId(req.auth!.userId);
      await template.save();

      res.json({
        message: `Template retired because ${reportCount} report(s) reference it.`,
        retired: true,
        template: template.toJSON(),
      });
      return;
    }

    await template.deleteOne();
    res.json({ message: 'Template deleted.', retired: false });
  }
);

/** Only the parts of a field that affect how answers are validated or read. */
function summariseField(field: {
  name: string;
  type: string;
  required?: boolean | null;
  options?: readonly { value: string }[] | null;
  validators?: Record<string, unknown> | null;
}) {
  return {
    name: field.name,
    type: field.type,
    required: field.required ?? false,
    options: (field.options ?? []).map((option) => option.value),
    validators: field.validators ?? {},
  };
}
