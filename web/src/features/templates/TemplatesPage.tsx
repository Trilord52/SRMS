import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Alert } from '@/components/ui/Alert';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Checkbox, Field, Input, Select, Textarea } from '@/components/ui/Field';
import { Spinner } from '@/components/ui/Spinner';
import { Table, TableWrap, Td, Th } from '@/components/ui/Table';
import { ApiError } from '@/lib/api';
import { useRetireTemplate, useSaveTemplate, useTemplates } from '@/lib/queries';
import { FIELD_TYPES, type FieldType, type Template } from '@/lib/schemas';

/** Template management: the field definitions reports are built and validated from. */
export function TemplatesPage() {
  const { data, isLoading, error } = useTemplates();
  const [editing, setEditing] = useState<Template | 'new' | null>(null);

  if (isLoading) return <Spinner label="Loading templates" className="p-6" />;
  if (error) return <Alert tone="error">Could not load templates. Try again.</Alert>;

  const templates = data?.templates ?? [];

  if (editing) {
    return (
      <TemplateEditor
        template={editing === 'new' ? null : editing}
        onDone={() => setEditing(null)}
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">Templates</h1>
        <Button onClick={() => setEditing('new')}>
          <Plus aria-hidden="true" />
          New template
        </Button>
      </div>

      <Card>
        <CardContent className="pt-5">
          {templates.length === 0 ? (
            <EmptyState
              title="No templates yet"
              description="A template defines the fields a report asks for."
              action={<Button onClick={() => setEditing('new')}>Create one</Button>}
            />
          ) : (
            <TableWrap>
              <Table>
                <caption className="sr-only">Report templates</caption>
                <thead>
                  <tr>
                    <Th>Name</Th>
                    <Th>Category</Th>
                    <Th>Fields</Th>
                    <Th>Version</Th>
                    <Th>State</Th>
                    <Th>
                      <span className="sr-only">Actions</span>
                    </Th>
                  </tr>
                </thead>
                <tbody>
                  {templates.map((template) => (
                    <tr key={template._id}>
                      <Td>{template.name}</Td>
                      <Td>{template.category}</Td>
                      <Td>{template.fields.length}</Td>
                      <Td>v{template.version}</Td>
                      <Td>
                        <Badge tone={template.isActive ? 'approved' : 'neutral'}>
                          {template.isActive ? 'Active' : 'Retired'}
                        </Badge>
                      </Td>
                      <Td>
                        <Button variant="ghost" size="sm" onClick={() => setEditing(template)}>
                          Edit
                        </Button>
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </TableWrap>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

interface DraftField {
  name: string;
  type: FieldType;
  label: string;
  required: boolean;
  order: number;
  options: string;
  minLength?: string;
  maxLength?: string;
  min?: string;
  max?: string;
  pattern?: string;
  customMessage?: string;
}

const CATEGORIES = [
  'weekly',
  'weekly-report',
  'incident',
  'incident-report',
  'maintenance',
  'maintenance-report',
  'database-report',
  'health-check',
  'custom',
] as const;

function TemplateEditor({ template, onDone }: { template: Template | null; onDone: () => void }) {
  const save = useSaveTemplate();
  const retire = useRetireTemplate();

  const [name, setName] = useState(template?.name ?? '');
  const [description, setDescription] = useState(template?.description ?? '');
  const [category, setCategory] = useState(template?.category ?? 'weekly');
  const [fields, setFields] = useState<DraftField[]>(() =>
    (template?.fields ?? []).map((field, index) => ({
      name: field.name,
      type: field.type,
      label: field.label,
      required: field.required ?? false,
      order: field.order ?? index + 1,
      options: field.options.map((option) => option.value).join(', '),
      minLength: field.validators?.minLength?.toString() ?? '',
      maxLength: field.validators?.maxLength?.toString() ?? '',
      min: field.validators?.min?.toString() ?? '',
      max: field.validators?.max?.toString() ?? '',
      pattern: field.validators?.pattern ?? '',
      customMessage: field.validators?.customMessage ?? '',
    }))
  );
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  function addField() {
    setFields((current) => [
      ...current,
      {
        name: '',
        type: 'text',
        label: '',
        required: false,
        order: current.length + 1,
        options: '',
      },
    ]);
  }

  function updateField(index: number, patch: Partial<DraftField>) {
    setFields((current) =>
      current.map((field, position) => (position === index ? { ...field, ...patch } : field))
    );
  }

  async function handleSave() {
    setError(null);
    setNotice(null);

    const body = {
      name,
      description,
      category,
      fields: fields.map((field) => ({
        name: field.name,
        type: field.type,
        label: field.label,
        required: field.required,
        order: field.order,
        options:
          field.type === 'select'
            ? field.options
                .split(',')
                .map((value) => value.trim())
                .filter(Boolean)
                .map((value) => ({ value, label: value }))
            : [],
        validators: {
          minLength: toNumber(field.minLength),
          maxLength: toNumber(field.maxLength),
          min: toNumber(field.min),
          max: toNumber(field.max),
          pattern: field.pattern || null,
          customMessage: field.customMessage || null,
        },
      })),
    };

    try {
      const result = await save.mutateAsync({ id: template?._id, body });
      if ('versionBumped' in result && result.versionBumped) {
        // Existing reports keep the version they were submitted against, so a
        // field change does not reinterpret past answers.
        setNotice(`Saved as version ${result.template.version}. Existing reports keep their version.`);
      } else {
        onDone();
      }
    } catch (caught) {
      if (caught instanceof ApiError) {
        const details = caught.details.map((detail) => `${detail.path}: ${detail.message}`);
        setError(details.length > 0 ? details.join('; ') : caught.message);
      } else {
        setError('Could not save the template.');
      }
    }
  }

  async function handleRetire() {
    if (!template) return;
    setError(null);
    try {
      const result = (await retire.mutateAsync(template._id)) as { retired?: boolean };
      setNotice(
        result.retired
          ? 'Template retired because reports reference it. It is no longer offered for new reports.'
          : 'Template deleted.'
      );
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Could not retire the template.');
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">{template ? 'Edit template' : 'New template'}</h1>

      {error && <Alert tone="error">{error}</Alert>}
      {notice && <Alert tone="success">{notice}</Alert>}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Details</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field label="Name" required>
            {(props) => (
              <Input {...props} value={name} onChange={(event) => setName(event.target.value)} />
            )}
          </Field>
          <Field label="Category" required>
            {(props) => (
              <Select
                {...props}
                value={category}
                onChange={(event) => setCategory(event.target.value)}
              >
                {CATEGORIES.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Description" required className="sm:col-span-2">
            {(props) => (
              <Textarea
                {...props}
                rows={2}
                value={description}
                onChange={(event) => setDescription(event.target.value)}
              />
            )}
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base">Fields</CardTitle>
            <CardDescription>
              These definitions drive both the form and the server-side validation.
            </CardDescription>
          </div>
          <Button variant="secondary" size="sm" onClick={addField}>
            <Plus aria-hidden="true" />
            Add field
          </Button>
        </CardHeader>

        <CardContent className="flex flex-col gap-4">
          {fields.length === 0 && (
            <EmptyState title="No fields yet" description="A template needs at least one field." />
          )}

          {fields.map((field, index) => (
            <div key={index} className="rounded-md border border-border p-3">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <Field label="Field name" required hint="Letters, digits, underscore.">
                  {(props) => (
                    <Input
                      {...props}
                      value={field.name}
                      onChange={(event) => updateField(index, { name: event.target.value })}
                    />
                  )}
                </Field>
                <Field label="Label" required>
                  {(props) => (
                    <Input
                      {...props}
                      value={field.label}
                      onChange={(event) => updateField(index, { label: event.target.value })}
                    />
                  )}
                </Field>
                <Field label="Type" required>
                  {(props) => (
                    <Select
                      {...props}
                      value={field.type}
                      onChange={(event) =>
                        updateField(index, { type: event.target.value as FieldType })
                      }
                    >
                      {FIELD_TYPES.map((type) => (
                        <option key={type} value={type}>
                          {type}
                        </option>
                      ))}
                    </Select>
                  )}
                </Field>
                <Field label="Order">
                  {(props) => (
                    <Input
                      {...props}
                      type="number"
                      value={field.order}
                      onChange={(event) =>
                        updateField(index, { order: Number(event.target.value) })
                      }
                    />
                  )}
                </Field>

                {field.type === 'select' && (
                  <Field
                    label="Options"
                    required
                    className="sm:col-span-2 lg:col-span-4"
                    hint="Comma separated."
                  >
                    {(props) => (
                      <Input
                        {...props}
                        value={field.options}
                        onChange={(event) => updateField(index, { options: event.target.value })}
                      />
                    )}
                  </Field>
                )}

                {(field.type === 'text' || field.type === 'textarea') && (
                  <>
                    <Field label="Min length">
                      {(props) => (
                        <Input
                          {...props}
                          type="number"
                          value={field.minLength ?? ''}
                          onChange={(event) =>
                            updateField(index, { minLength: event.target.value })
                          }
                        />
                      )}
                    </Field>
                    <Field label="Max length">
                      {(props) => (
                        <Input
                          {...props}
                          type="number"
                          value={field.maxLength ?? ''}
                          onChange={(event) =>
                            updateField(index, { maxLength: event.target.value })
                          }
                        />
                      )}
                    </Field>
                    <Field label="Pattern" hint="Regular expression, optional.">
                      {(props) => (
                        <Input
                          {...props}
                          value={field.pattern ?? ''}
                          onChange={(event) => updateField(index, { pattern: event.target.value })}
                        />
                      )}
                    </Field>
                  </>
                )}

                {field.type === 'number' && (
                  <>
                    <Field label="Minimum">
                      {(props) => (
                        <Input
                          {...props}
                          type="number"
                          value={field.min ?? ''}
                          onChange={(event) => updateField(index, { min: event.target.value })}
                        />
                      )}
                    </Field>
                    <Field label="Maximum">
                      {(props) => (
                        <Input
                          {...props}
                          type="number"
                          value={field.max ?? ''}
                          onChange={(event) => updateField(index, { max: event.target.value })}
                        />
                      )}
                    </Field>
                  </>
                )}

                <Field
                  label="Custom error message"
                  className="sm:col-span-2"
                  hint="Shown instead of the default wording."
                >
                  {(props) => (
                    <Input
                      {...props}
                      value={field.customMessage ?? ''}
                      onChange={(event) =>
                        updateField(index, { customMessage: event.target.value })
                      }
                    />
                  )}
                </Field>
              </div>

              <div className="mt-3 flex items-center justify-between">
                <Checkbox
                  label="Required"
                  checked={field.required}
                  onChange={(event) => updateField(index, { required: event.target.checked })}
                />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setFields((current) => current.filter((_, i) => i !== index))}
                >
                  <Trash2 aria-hidden="true" />
                  Remove
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-2">
        <Button loading={save.isPending} onClick={() => void handleSave()}>
          {template ? 'Save changes' : 'Create template'}
        </Button>
        <Button variant="secondary" onClick={onDone}>
          {notice ? 'Back to templates' : 'Cancel'}
        </Button>
        {template && template.isActive && (
          <Button
            variant="danger"
            className="ml-auto"
            loading={retire.isPending}
            onClick={() => void handleRetire()}
          >
            Retire template
          </Button>
        )}
      </div>
    </div>
  );
}

function toNumber(value: string | undefined): number | null {
  if (!value || value.trim() === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}
