import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { DynamicFormFields, buildSubmissionForm, type FieldValues } from './DynamicForm';
import { FIELD_TYPES, type TemplateField } from '@/lib/schemas';

/**
 * The form is generated from template data, so the risk is a field type that
 * renders nothing: the server would still expect an answer while the person
 * filling the form never sees the question. These tests assert every type the
 * schema allows produces a control.
 */

function field(overrides: Partial<TemplateField> & { name: string; type: TemplateField['type'] }): TemplateField {
  return {
    label: overrides.name,
    placeholder: '',
    required: false,
    options: [],
    order: 0,
    readOnly: false,
    validators: null,
    defaultValue: null,
    ...overrides,
  } as TemplateField;
}

const everyType: TemplateField[] = [
  field({ name: 'aText', type: 'text', label: 'A text' }),
  field({ name: 'aNumber', type: 'number', label: 'A number' }),
  field({ name: 'aDate', type: 'date', label: 'A date' }),
  field({
    name: 'aSelect',
    type: 'select',
    label: 'A select',
    options: [
      { value: 'x', label: 'Option X' },
      { value: 'y', label: 'Option Y' },
    ],
  }),
  field({ name: 'aCheckbox', type: 'checkbox', label: 'A checkbox' }),
  field({ name: 'aTextarea', type: 'textarea', label: 'A textarea' }),
  field({ name: 'aFile', type: 'file', label: 'A file' }),
  field({ name: 'aYesno', type: 'yesno', label: 'A yes or no' }),
];

function Harness({ fields }: { fields: TemplateField[] }) {
  const [values, setValues] = useState<FieldValues>({});
  return (
    <DynamicFormFields
      fields={fields}
      values={values}
      errors={{}}
      onChange={(name, value) => setValues((current) => ({ ...current, [name]: value }))}
    />
  );
}

describe('DynamicFormFields', () => {
  it('covers every field type the schema allows', () => {
    // Guards against a type being added to the schema but not to the renderer.
    expect(everyType.map((f) => f.type).sort()).toEqual([...FIELD_TYPES].sort());
  });

  it('renders a labelled control for each type', () => {
    render(<Harness fields={everyType} />);

    for (const definition of everyType) {
      // Exact match, since a loose pattern for "A text" would also catch
      // "A textarea" and report a false duplicate.
      expect(
        screen.getByLabelText(definition.label, { exact: true }),
        `${definition.type} rendered no labelled control`
      ).toBeInTheDocument();
    }
  });

  it('marks a required field for assistive technology, not just visually', () => {
    render(<Harness fields={[field({ name: 'summary', type: 'text', label: 'Summary', required: true })]} />);

    expect(screen.getByText('(required)')).toBeInTheDocument();
  });

  it('links an error message to its control', () => {
    render(
      <DynamicFormFields
        fields={[field({ name: 'summary', type: 'text', label: 'Summary' })]}
        values={{}}
        errors={{ summary: 'Summary is too short' }}
        onChange={vi.fn()}
      />
    );

    const input = screen.getByLabelText(/summary/i);
    expect(input).toHaveAttribute('aria-invalid', 'true');
    // The message is reachable through aria-describedby, not only shown in red.
    expect(input).toHaveAccessibleDescription('Summary is too short');
  });

  it('respects the order a manager set rather than array order', () => {
    render(
      <Harness
        fields={[
          field({ name: 'second', type: 'text', label: 'Second', order: 2 }),
          field({ name: 'first', type: 'text', label: 'First', order: 1 }),
        ]}
      />
    );

    const labels = screen.getAllByText(/First|Second/).map((node) => node.textContent);
    expect(labels).toEqual(['First', 'Second']);
  });

  it('describes numeric bounds so the rule is visible before submitting', () => {
    render(
      <Harness
        fields={[
          field({
            name: 'count',
            type: 'number',
            label: 'Count',
            validators: { min: 0, max: 10, minLength: null, maxLength: null, pattern: null, customMessage: null },
          }),
        ]}
      />
    );

    expect(screen.getByText('Between 0 and 10')).toBeInTheDocument();
  });

  it('disables a read-only field', () => {
    render(<Harness fields={[field({ name: 'locked', type: 'text', label: 'Locked', readOnly: true })]} />);
    expect(screen.getByLabelText(/locked/i)).toBeDisabled();
  });

  it('treats an emptied number box as no answer rather than zero', async () => {
    const onChange = vi.fn();
    render(
      <DynamicFormFields
        fields={[field({ name: 'count', type: 'number', label: 'Count' })]}
        values={{ count: 5 }}
        errors={{}}
        onChange={onChange}
      />
    );

    await userEvent.clear(screen.getByLabelText(/count/i));
    expect(onChange).toHaveBeenLastCalledWith('count', undefined);
  });
});

describe('buildSubmissionForm', () => {
  it('sends answers as JSON and files as attachments', () => {
    const file = new File(['evidence'], 'evidence.txt', { type: 'text/plain' });
    const form = buildSubmissionForm('template-1', '2026-08-03', everyType, {
      aText: 'hello',
      aNumber: 3,
      aCheckbox: true,
      aFile: file,
    });

    expect(form.get('templateId')).toBe('template-1');
    expect(form.get('periodStart')).toBe('2026-08-03');
    expect(form.get('files')).toBeInstanceOf(File);

    const answers = JSON.parse(String(form.get('templateData')));
    expect(answers).toEqual({ aText: 'hello', aNumber: 3, aCheckbox: true });
    // The file field is not part of templateData: the server assigns the stored
    // name, so a client cannot claim a file it does not own.
    expect(answers).not.toHaveProperty('aFile');
  });

  it('omits fields left blank instead of sending empty strings', () => {
    const form = buildSubmissionForm('template-1', '2026-08-03', everyType, {
      aText: '',
      aNumber: undefined,
    });

    expect(JSON.parse(String(form.get('templateData')))).toEqual({});
  });

  it('includes the revision link when resubmitting', () => {
    const form = buildSubmissionForm('template-1', '2026-08-03', everyType, {}, 'report-9');
    expect(form.get('revisionOf')).toBe('report-9');
  });
});
