import { z } from 'zod';
import { CUSTOM_FEATURE_TYPES } from '../lib/constants';
import { objectIdSchema } from './auth.schema';

/**
 * A record of a database server the team is responsible for.
 *
 * `ipAddress` was a free-text string in the legacy schema, so anything at all
 * could be stored in a field the UI presents as an address.
 */
const customFeatureSchema = z
  .object({
    name: z.string().trim().min(1).max(60),
    type: z.enum(CUSTOM_FEATURE_TYPES),
    label: z.string().trim().min(1).max(120),
    required: z.boolean().default(false),
    enumOptions: z.array(z.string().min(1)).default([]),
    defaultValue: z.string().max(200).nullish(),
    description: z.string().max(500).nullish(),
  })
  .refine((feature) => feature.type !== 'enum' || feature.enumOptions.length > 0, {
    message: 'An enum feature must define at least one option',
    path: ['enumOptions'],
  });

const hostSchema = z
  .string()
  .trim()
  .min(1)
  .max(255)
  .refine(
    (value) => z.union([z.ipv4(), z.ipv6()]).safeParse(value).success || isHostname(value),
    'Must be a valid IPv4 address, IPv6 address, or hostname'
  );

function isHostname(value: string): boolean {
  return /^(?=.{1,253}$)([a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)*[a-zA-Z]{2,63}$/.test(value);
}

export const createDatabaseSchema = z.object({
  name: z.string().trim().min(1).max(120),
  databaseType: z.string().trim().min(1).max(60),
  host: hostSchema,
  dbVersion: z.string().trim().min(1).max(60),
  osVersion: z.string().trim().min(1).max(120),
  customFeatures: z.array(customFeatureSchema).max(50).default([]),
});

export const updateDatabaseSchema = createDatabaseSchema.partial().extend({
  isActive: z.boolean().optional(),
});

export const listDatabasesQuerySchema = z.object({
  isActive: z
    .enum(['true', 'false'])
    .transform((value) => value === 'true')
    .optional(),
  databaseType: z.string().trim().max(60).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const bulkDatabaseIdsSchema = z.object({
  databaseIds: z.array(objectIdSchema).min(1).max(100),
});

export type CreateDatabaseInput = z.infer<typeof createDatabaseSchema>;
export type UpdateDatabaseInput = z.infer<typeof updateDatabaseSchema>;
export type ListDatabasesQuery = z.infer<typeof listDatabasesQuerySchema>;
