import { Checkbox, Field, Input, Select, Textarea } from '@/components/ui/Field';
import type { TemplateField } from '@/lib/schemas';

/**
 * Renders a form from a template's field definitions.
 *
 * This is the counterpart to the API's template compiler: the server builds a
 * validation schema from the same definitions this renders from, so the form and
 * the validator cannot disagree about what a template requires.
 *
 * Every field type the schema allows is handled here. A type with no case would
 * previously render nothing, silently dropping the field from the form while the
 * server still expected an answer.
 */

export type FieldValues = Record<string, unknown>;

export function DynamicFormFields({
  fields,
  values,
  errors,
  onChange,
  disabled,
}: {
  fields: TemplateField[];
  values: FieldValues;
  errors: Record<string, string>;
  onChange: (name: string, value: unknown) => void;
  disabled?: boolean;
}) {
  // Managers control presentation order; ties fall back to declaration order.
  const ordered = [...fields].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  return (
    <div className="flex flex-col gap-4">
      {ordered.map((field) => (
        <DynamicField
          key={field.name}
          field={field}
          value={values[field.name]}
          error={errors[field.name]}
          onChange={(value) => onChange(field.name, value)}
          disabled={disabled || field.readOnly}
        />
      ))}
    </div>
  );
}

function DynamicField({
  field,
  value,
  error,
  onChange,
  disabled,
}: {
  field: TemplateField;
  value: unknown;
  error?: string;
  onChange: (value: unknown) => void;
  disabled?: boolean;
}) {
  const hint = describeConstraints(field);
  // Held in a const so the narrowing below survives into the render callback;
  // TypeScript does not carry a property narrowing across a closure boundary.
  const type = field.type;

  // A checkbox carries its own label, so it is not wrapped in a Field label.
  if (type === 'checkbox') {
    return (
      <div className="flex flex-col gap-1">
        <Checkbox
          label={field.label + (field.required ? ' (required)' : '')}
          checked={value === true}
          disabled={disabled}
          onChange={(event) => onChange(event.target.checked)}
        />
        {error && <p className="text-xs font-medium text-danger">{error}</p>}
      </div>
    );
  }

  return (
    <Field label={field.label} required={field.required} error={error} hint={hint}>
      {(props) => {
        switch (type) {
          case 'text':
            return (
              <Input
                {...props}
                type="text"
                value={asString(value)}
                placeholder={field.placeholder}
                disabled={disabled}
                minLength={field.validators?.minLength ?? undefined}
                maxLength={field.validators?.maxLength ?? undefined}
                onChange={(event) => onChange(event.target.value)}
              />
            );

          case 'textarea':
            return (
              <Textarea
                {...props}
                value={asString(value)}
                placeholder={field.placeholder}
                disabled={disabled}
                maxLength={field.validators?.maxLength ?? undefined}
                onChange={(event) => onChange(event.target.value)}
              />
            );

          case 'number':
            return (
              <Input
                {...props}
                type="number"
                value={value === null || value === undefined ? '' : String(value)}
                placeholder={field.placeholder}
                disabled={disabled}
                min={field.validators?.min ?? undefined}
                max={field.validators?.max ?? undefined}
                onChange={(event) =>
                  // An empty box means "no answer", which is different from zero.
                  onChange(event.target.value === '' ? undefined : Number(event.target.value))
                }
              />
            );

          case 'date':
            return (
              <Input
                {...props}
                type="date"
                value={asDateInput(value)}
                disabled={disabled}
                onChange={(event) => onChange(event.target.value || undefined)}
              />
            );

          case 'select':
            return (
              <Select
                {...props}
                value={asString(value)}
                disabled={disabled}
                onChange={(event) => onChange(event.target.value || undefined)}
              >
                <option value="">Select an option</option>
                {field.options.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            );

          case 'yesno':
            return (
              <Select
                {...props}
                value={asString(value)}
                disabled={disabled}
                onChange={(event) => onChange(event.target.value || undefined)}
              >
                <option value="">Select an answer</option>
                <option value="yes">Yes</option>
                <option value="no">No</option>
              </Select>
            );

          case 'file':
            return (
              <Input
                {...props}
                type="file"
                disabled={disabled}
                className="py-1.5"
                onChange={(event) => onChange(event.target.files?.[0] ?? undefined)}
              />
            );

          default: {
            // Adding a field type without handling it here is a compile error,
            // rather than a field that quietly fails to render.
            const exhaustive: never = type;
            throw new Error(`Unhandled field type: ${String(exhaustive)}`);
          }
        }
      }}
    </Field>
  );
}

/** Turns a field's validators into a sentence, so the rules are visible up front. */
function describeConstraints(field: TemplateField): string | undefined {
  const v = field.validators;
  if (!v) return field.placeholder || undefined;

  const parts: string[] = [];

  if (field.type === 'text' || field.type === 'textarea') {
    if (v.minLength && v.maxLength) parts.push(`${v.minLength} to ${v.maxLength} characters`);
    else if (v.minLength) parts.push(`at least ${v.minLength} characters`);
    else if (v.maxLength) parts.push(`up to ${v.maxLength} characters`);
    if (v.pattern) parts.push('must match the required format');
  }

  if (field.type === 'number') {
    if (v.min !== null && v.min !== undefined && v.max !== null && v.max !== undefined) {
      parts.push(`between ${v.min} and ${v.max}`);
    } else if (v.min !== null && v.min !== undefined) parts.push(`at least ${v.min}`);
    else if (v.max !== null && v.max !== undefined) parts.push(`at most ${v.max}`);
  }

  return parts.length > 0 ? capitalise(parts.join(', ')) : undefined;
}

function capitalise(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function asString(value: unknown): string {
  if (value === null || value === undefined) return '';
  return typeof value === 'string' ? value : String(value);
}

/** A date input needs yyyy-mm-dd, whatever form the stored value takes. */
function asDateInput(value: unknown): string {
  if (typeof value === 'string') return value.slice(0, 10);
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return '';
}

/**
 * Builds the multipart body for a submission.
 *
 * File answers are sent as attachments rather than inside templateData: the
 * server assigns the stored name and writes it into the answer, so a client
 * cannot name a file it does not own.
 */
export function buildSubmissionForm(
  templateId: string,
  periodStart: string,
  fields: TemplateField[],
  values: FieldValues,
  revisionOf?: string
): FormData {
  const formData = new FormData();
  formData.append('templateId', templateId);
  formData.append('periodStart', periodStart);
  if (revisionOf) formData.append('revisionOf', revisionOf);

  const answers: FieldValues = {};
  const fileFields = [...fields]
    .filter((field) => field.type === 'file')
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  for (const field of fields) {
    if (field.type === 'file') continue;
    const value = values[field.name];
    if (value === undefined || value === '') continue;
    answers[field.name] = value;
  }

  // Appended in the same order the server assigns them to file fields.
  for (const field of fileFields) {
    const file = values[field.name];
    if (file instanceof File) formData.append('files', file);
  }

  formData.append('templateData', JSON.stringify(answers));
  return formData;
}
