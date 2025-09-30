import { z } from 'zod';
import { FIELD_TYPES, TEMPLATE_CATEGORIES, type FieldType } from '../lib/constants';

/**
 * Structural shape of a template field, independent of Mongoose.
 *
 * Validation is deliberately decoupled from the ORM: a hydrated document
 * satisfies this shape, and so does a plain object from a test or a request
 * body, so the compiler for report answers can be exercised without a database.
 */
export interface FieldDefinition {
  name: string;
  type: FieldType;
  label: string;
  required?: boolean | null;
  options?: readonly { value: string; label: string }[] | null;
  validators?: {
    minLength?: number | null;
    maxLength?: number | null;
    min?: number | null;
    max?: number | null;
    pattern?: string | null;
    customMessage?: string | null;
  } | null;
}

const fieldValidatorsSchema = z
  .object({
    minLength: z.number().int().min(0).nullish(),
    maxLength: z.number().int().min(1).nullish(),
    min: z.number().nullish(),
    max: z.number().nullish(),
    pattern: z.string().max(200).nullish(),
    customMessage: z.string().max(300).nullish(),
  })
  .partial()
  .default({});

export const templateFieldSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1)
      .max(60)
      .regex(/^[A-Za-z][A-Za-z0-9_]*$/, 'Field name must start with a letter and contain only letters, digits, or underscores'),
    type: z.enum(FIELD_TYPES),
    label: z.string().trim().min(1).max(120),
    placeholder: z.string().max(160).default(''),
    defaultValue: z.unknown().nullish(),
    required: z.boolean().default(false),
    options: z
      .array(z.object({ value: z.string().min(1), label: z.string().min(1) }))
      .default([]),
    validators: fieldValidatorsSchema,
    order: z.number().int().min(0).default(0),
    readOnly: z.boolean().default(false),
  })
  .refine((field) => field.type !== 'select' || field.options.length > 0, {
    message: 'A select field must define at least one option',
    path: ['options'],
  })
  .refine(
    (field) => {
      if (!field.validators?.pattern) return true;
      try {
        new RegExp(field.validators.pattern);
        return true;
      } catch {
        return false;
      }
    },
    { message: 'Validator pattern is not a valid regular expression', path: ['validators', 'pattern'] }
  );

export const createTemplateSchema = z.object({
  name: z.string().trim().min(1).max(160),
  description: z.string().trim().min(1).max(1000),
  category: z.enum(TEMPLATE_CATEGORIES),
  fields: z
    .array(templateFieldSchema)
    .min(1, 'A template needs at least one field')
    .max(100)
    .refine(
      (fields) => new Set(fields.map((f) => f.name)).size === fields.length,
      'Field names must be unique within a template'
    ),
});

export const updateTemplateSchema = createTemplateSchema.partial().extend({
  isActive: z.boolean().optional(),
});

export const listTemplatesQuerySchema = z.object({
  category: z.enum(TEMPLATE_CATEGORIES).optional(),
  isActive: z
    .enum(['true', 'false'])
    .transform((value) => value === 'true')
    .optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type CreateTemplateInput = z.infer<typeof createTemplateSchema>;
export type UpdateTemplateInput = z.infer<typeof updateTemplateSchema>;

/**
 * Builds a Zod schema for a report's answers from a template's field
 * definitions.
 *
 * This is the load-bearing part of the rewrite. In the legacy code the contract
 * between form rendering, server validation, and stored data existed only at
 * runtime and nothing checked it, so answers could be stored in any shape. Here
 * the template is compiled into a schema, which means a submission is checked
 * against the same definition the form was rendered from.
 */
export function buildTemplateDataSchema(fields: readonly FieldDefinition[]): z.ZodType<Record<string, unknown>> {
  const shape: Record<string, z.ZodTypeAny> = {};

  for (const field of fields) {
    let schema = baseSchemaFor(field);

    if (field.required) {
      // For a checkbox, "required" means it must actually be ticked; every other
      // type is satisfied by the presence of a valid value.
      if (field.type === 'checkbox') {
        schema = (schema as z.ZodBoolean).refine((value) => value === true, {
          message: field.validators?.customMessage ?? `${field.label} must be checked`,
        }) as unknown as z.ZodTypeAny;
      }
    } else {
      schema = schema.optional().nullable();
    }

    shape[field.name] = schema;
  }

  // Unknown keys are rejected rather than silently stored, so a client cannot
  // smuggle arbitrary data into a Mixed field.
  return z.object(shape).strict();
}

function baseSchemaFor(field: FieldDefinition): z.ZodTypeAny {
  const v = field.validators ?? {};
  // A template author can supply one message to show instead of the default
  // wording for whichever constraint the field carries.
  const custom = v.customMessage ?? undefined;

  switch (field.type) {
    case 'text':
    case 'textarea': {
      let s = z.string().trim();

      // One minimum, not two. Applying the author's minLength and a separate
      // "required" minimum both produced an error for the same field, so a short
      // answer reported two complaints about one box.
      const floor = field.required ? Math.max(1, v.minLength ?? 1) : v.minLength;
      if (typeof floor === 'number' && floor > 0) {
        const message =
          custom ??
          (v.minLength
            ? `${field.label} must be at least ${v.minLength} characters`
            : `${field.label} is required`);
        s = s.min(floor, message);
      }

      if (typeof v.maxLength === 'number') s = s.max(v.maxLength, custom);
      else s = s.max(field.type === 'textarea' ? 10_000 : 1_000);
      if (v.pattern) s = s.regex(new RegExp(v.pattern), custom);
      return s;
    }

    case 'number': {
      let s = z.coerce.number();
      if (typeof v.min === 'number') s = s.min(v.min, custom);
      if (typeof v.max === 'number') s = s.max(v.max, custom);
      return s;
    }

    case 'date':
      return z.coerce.date(custom ? { error: custom } : undefined);

    case 'select': {
      const values = (field.options ?? []).map((option) => option.value);
      if (values.length === 0) return z.string();
      return z.enum(values as [string, ...string[]], custom ? { error: custom } : undefined);
    }

    case 'checkbox':
      return z.boolean(custom ? { error: custom } : undefined);

    case 'yesno':
      return z.enum(['yes', 'no'], custom ? { error: custom } : undefined);

    case 'file':
      // The value is the stored filename produced by the upload step.
      return z.string().min(1, custom);

    default: {
      // Exhaustiveness guard: adding a field type without handling it here is a
      // compile error rather than a silent pass-through.
      const exhaustive: never = field.type as never;
      throw new Error(`Unhandled field type: ${String(exhaustive)}`);
    }
  }
}
