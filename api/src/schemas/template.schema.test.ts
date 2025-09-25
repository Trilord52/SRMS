import { describe, expect, it } from 'vitest';
import { buildTemplateDataSchema, createTemplateSchema, type FieldDefinition } from './template.schema';

/** Minimal field factory so each test states only what it cares about. */
function field(
  overrides: Partial<FieldDefinition> & Pick<FieldDefinition, 'name' | 'type'>
): FieldDefinition {
  return {
    label: overrides.name,
    required: false,
    options: [],
    validators: {},
    ...overrides,
  };
}

describe('buildTemplateDataSchema', () => {
  it('accepts a submission matching every field type', () => {
    const schema = buildTemplateDataSchema([
      field({ name: 'summary', type: 'text', required: true }),
      field({ name: 'notes', type: 'textarea' }),
      field({ name: 'incidents', type: 'number' }),
      field({ name: 'occurredOn', type: 'date' }),
      field({
        name: 'severity',
        type: 'select',
        options: [
          { value: 'low', label: 'Low' },
          { value: 'high', label: 'High' },
        ],
      }),
      field({ name: 'confirmed', type: 'checkbox' }),
      field({ name: 'escalated', type: 'yesno' }),
      field({ name: 'evidence', type: 'file' }),
    ]);

    const parsed = schema.parse({
      summary: 'Week ran clean',
      notes: 'No follow-up needed',
      incidents: '3', // arrives as a string from multipart form data
      occurredOn: '2026-08-08',
      severity: 'high',
      confirmed: true,
      escalated: 'yes',
      evidence: 'a1b2c3.pdf',
    });

    expect(parsed.incidents).toBe(3);
    expect(parsed.occurredOn).toBeInstanceOf(Date);
  });

  it('rejects a value outside a select field options', () => {
    const schema = buildTemplateDataSchema([
      field({ name: 'severity', type: 'select', options: [{ value: 'low', label: 'Low' }] }),
    ]);
    expect(schema.safeParse({ severity: 'critical' }).success).toBe(false);
  });

  it('rejects unknown keys rather than storing them', () => {
    const schema = buildTemplateDataSchema([field({ name: 'summary', type: 'text' })]);
    const result = schema.safeParse({ summary: 'ok', injected: 'should not persist' });
    expect(result.success).toBe(false);
  });

  it('requires a required text field to be non-empty', () => {
    const schema = buildTemplateDataSchema([
      field({ name: 'summary', type: 'text', required: true }),
    ]);
    expect(schema.safeParse({ summary: '' }).success).toBe(false);
    expect(schema.safeParse({ summary: '   ' }).success).toBe(false);
  });

  it('allows an optional field to be omitted or null', () => {
    const schema = buildTemplateDataSchema([field({ name: 'notes', type: 'textarea' })]);
    expect(schema.safeParse({}).success).toBe(true);
    expect(schema.safeParse({ notes: null }).success).toBe(true);
  });

  it('enforces numeric bounds from the field validators', () => {
    const schema = buildTemplateDataSchema([
      field({ name: 'score', type: 'number', validators: { min: 1, max: 10 } }),
    ]);
    expect(schema.safeParse({ score: 5 }).success).toBe(true);
    expect(schema.safeParse({ score: 0 }).success).toBe(false);
    expect(schema.safeParse({ score: 11 }).success).toBe(false);
  });

  it('requires a required checkbox to be ticked', () => {
    const schema = buildTemplateDataSchema([
      field({ name: 'confirmed', type: 'checkbox', required: true }),
    ]);
    expect(schema.safeParse({ confirmed: true }).success).toBe(true);
    expect(schema.safeParse({ confirmed: false }).success).toBe(false);
  });

  it('applies a validator pattern to text', () => {
    const schema = buildTemplateDataSchema([
      field({ name: 'ticket', type: 'text', validators: { pattern: '^INC-\\d{4}$' } }),
    ]);
    expect(schema.safeParse({ ticket: 'INC-1234' }).success).toBe(true);
    expect(schema.safeParse({ ticket: 'nope' }).success).toBe(false);
  });
});

describe('createTemplateSchema', () => {
  const base = { name: 'Weekly', description: 'Weekly report', category: 'weekly' as const };

  it('rejects duplicate field names', () => {
    const result = createTemplateSchema.safeParse({
      ...base,
      fields: [
        { name: 'summary', type: 'text', label: 'Summary' },
        { name: 'summary', type: 'textarea', label: 'Summary again' },
      ],
    });
    expect(result.success).toBe(false);
  });

  it('rejects a select field with no options', () => {
    const result = createTemplateSchema.safeParse({
      ...base,
      fields: [{ name: 'severity', type: 'select', label: 'Severity', options: [] }],
    });
    expect(result.success).toBe(false);
  });

  it('rejects an unparseable validator pattern', () => {
    const result = createTemplateSchema.safeParse({
      ...base,
      fields: [
        { name: 'ticket', type: 'text', label: 'Ticket', validators: { pattern: '([unclosed' } },
      ],
    });
    expect(result.success).toBe(false);
  });

  it('rejects a template with no fields', () => {
    expect(createTemplateSchema.safeParse({ ...base, fields: [] }).success).toBe(false);
  });

  it('accepts a valid template and applies defaults', () => {
    const result = createTemplateSchema.safeParse({
      ...base,
      fields: [{ name: 'summary', type: 'text', label: 'Summary' }],
    });
    expect(result.success).toBe(true);
    if (result.success) {
      const [first] = result.data.fields;
      expect(first?.required).toBe(false);
      expect(first?.order).toBe(0);
    }
  });
});

describe('custom validator messages', () => {
  it('uses the template author message when a text constraint fails', () => {
    const schema = buildTemplateDataSchema([
      {
        name: 'ticket',
        type: 'text',
        label: 'Ticket reference',
        required: true,
        validators: { pattern: '^INC-\\d{4}$', customMessage: 'Use the form INC-0000' },
      },
    ]);

    const result = schema.safeParse({ ticket: 'nope' });
    expect(result.success).toBe(false);
    expect(result.error!.issues[0]!.message).toBe('Use the form INC-0000');
  });

  it('uses the author message when a number is out of range', () => {
    const schema = buildTemplateDataSchema([
      {
        name: 'count',
        type: 'number',
        label: 'Count',
        required: true,
        validators: { min: 0, max: 10, customMessage: 'Count must be between 0 and 10' },
      },
    ]);

    const result = schema.safeParse({ count: 99 });
    expect(result.success).toBe(false);
    expect(result.error!.issues[0]!.message).toBe('Count must be between 0 and 10');
  });

  it('uses the author message when a required checkbox is unticked', () => {
    const schema = buildTemplateDataSchema([
      {
        name: 'agreed',
        type: 'checkbox',
        label: 'Agreed',
        required: true,
        validators: { customMessage: 'You must confirm the checklist' },
      },
    ]);

    const result = schema.safeParse({ agreed: false });
    expect(result.success).toBe(false);
    expect(result.error!.issues[0]!.message).toBe('You must confirm the checklist');
  });
});
