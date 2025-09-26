import { Router, type Request, type Response } from 'express';
import { Types } from 'mongoose';
import { z } from 'zod';
import { conflict, notFound } from '../lib/errors';
import { buildPagination } from '../lib/pagination';
import { authenticate, requireRole } from '../middleware/auth';
import { validate, validatedQuery } from '../middleware/validate';
import { DatabaseModel } from '../models/Database';
import { objectIdSchema } from '../schemas/auth.schema';
import {
  bulkDatabaseIdsSchema,
  createDatabaseSchema,
  listDatabasesQuerySchema,
  updateDatabaseSchema,
  type CreateDatabaseInput,
  type ListDatabasesQuery,
  type UpdateDatabaseInput,
} from '../schemas/database.schema';

export const databasesRouter = Router();

const idParams = z.object({ id: objectIdSchema });

databasesRouter.use(authenticate);

databasesRouter.get(
  '/',
  validate('query', listDatabasesQuerySchema),
  async (req: Request, res: Response) => {
    const { isActive, databaseType, page, limit } = validatedQuery<ListDatabasesQuery>(req);

    const filter: Record<string, unknown> = {};
    if (databaseType) filter.databaseType = databaseType;
    if (isActive !== undefined) filter.isActive = isActive;

    // Retired records are administrative; everyone else sees the live inventory.
    // The legacy list endpoint returned inactive records to every role.
    if (req.auth!.role !== 'manager') filter.isActive = true;

    const [databases, totalCount] = await Promise.all([
      DatabaseModel.find(filter)
        .sort({ name: 1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate('createdBy', 'firstName lastName userId'),
      DatabaseModel.countDocuments(filter),
    ]);

    res.json({
      databases: databases.map((database) => database.toJSON()),
      pagination: buildPagination(page, limit, totalCount),
    });
  }
);

databasesRouter.get('/:id', validate('params', idParams), async (req: Request, res: Response) => {
  const database = await DatabaseModel.findById(req.params.id).populate(
    'createdBy',
    'firstName lastName userId'
  );

  if (!database) throw notFound('Database');
  if (req.auth!.role !== 'manager' && !database.isActive) throw notFound('Database');

  res.json({ database: database.toJSON() });
});

databasesRouter.post(
  '/',
  requireRole('manager'),
  validate('body', createDatabaseSchema),
  async (req: Request, res: Response) => {
    const input = req.body as CreateDatabaseInput;

    const duplicate = await DatabaseModel.findOne({ name: input.name }).lean();
    if (duplicate) throw conflict(`A database named ${input.name} already exists`);

    const database = await DatabaseModel.create({
      ...input,
      createdBy: new Types.ObjectId(req.auth!.userId),
    });

    res.status(201).json({ database: database.toJSON() });
  }
);

databasesRouter.patch(
  '/:id',
  requireRole('manager'),
  validate('params', idParams),
  validate('body', updateDatabaseSchema),
  async (req: Request, res: Response) => {
    const input = req.body as UpdateDatabaseInput;
    const database = await DatabaseModel.findById(req.params.id);
    if (!database) throw notFound('Database');

    if (input.name && input.name !== database.name) {
      const duplicate = await DatabaseModel.findOne({
        name: input.name,
        _id: { $ne: database._id },
      }).lean();
      if (duplicate) throw conflict(`A database named ${input.name} already exists`);
    }

    Object.assign(database, input);
    await database.save();

    res.json({ database: database.toJSON() });
  }
);

/**
 * Retires a record rather than removing it. Reports reference these by name for
 * reporting history, so the row is kept and marked inactive.
 */
databasesRouter.delete(
  '/:id',
  requireRole('manager'),
  validate('params', idParams),
  async (req: Request, res: Response) => {
    const database = await DatabaseModel.findById(req.params.id);
    if (!database) throw notFound('Database');
    if (!database.isActive) throw conflict('That database is already retired');

    database.isActive = false;
    await database.save();

    res.json({ message: 'Database retired.', database: database.toJSON() });
  }
);

databasesRouter.post(
  '/:id/restore',
  requireRole('manager'),
  validate('params', idParams),
  async (req: Request, res: Response) => {
    const database = await DatabaseModel.findById(req.params.id);
    if (!database) throw notFound('Database');
    if (database.isActive) throw conflict('That database is already active');

    database.isActive = true;
    await database.save();

    res.json({ message: 'Database restored.', database: database.toJSON() });
  }
);

/**
 * Bulk retire. Mounted before the `/:id` routes would otherwise capture it —
 * the legacy router declared `DELETE /bulk-delete` after `DELETE /:id`, so
 * "bulk-delete" was parsed as an id and the endpoint was unreachable.
 */
databasesRouter.post(
  '/bulk-retire',
  requireRole('manager'),
  validate('body', bulkDatabaseIdsSchema),
  async (req: Request, res: Response) => {
    const { databaseIds } = req.body as z.infer<typeof bulkDatabaseIdsSchema>;

    const result = await DatabaseModel.updateMany(
      { _id: { $in: databaseIds.map((id) => new Types.ObjectId(id)) }, isActive: true },
      { isActive: false }
    );

    res.json({
      message: `${result.modifiedCount} database(s) retired.`,
      retiredCount: result.modifiedCount,
      requestedCount: databaseIds.length,
    });
  }
);
