import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Field, Input, Select } from '@/components/ui/Field';
import { Spinner } from '@/components/ui/Spinner';
import { ApiError } from '@/lib/api';
import { useSubmitReport, useTemplates } from '@/lib/queries';
import { buildSubmissionForm, DynamicFormFields, type FieldValues } from './DynamicForm';

/**
 * Report submission.
 *
 * The reporting period is chosen by the submitter. The legacy schema derived the
 * week from the moment of submission, so a report filed on Monday about the
 * previous week was recorded against the wrong week with no way to correct it.
 */
export function SubmitReportPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const revisionOf = searchParams.get('revisionOf') ?? undefined;

  const { data, isLoading } = useTemplates({ isActive: true });
  const submit = useSubmitReport();

  const [templateId, setTemplateId] = useState('');
  const [periodStart, setPeriodStart] = useState(() => defaultPeriodStart());
  const [values, setValues] = useState<FieldValues>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);

  const templates = data?.templates ?? [];
  const template = useMemo(
    () => templates.find((candidate) => candidate._id === templateId) ?? null,
    [templates, templateId]
  );

  function handleTemplateChange(nextId: string) {
    setTemplateId(nextId);
    // Answers belong to a template, so switching clears them rather than
    // carrying values across to fields that may not exist.
    setValues({});
    setErrors({});
    setFormError(null);
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!template) return;

    setErrors({});
    setFormError(null);

    const formData = buildSubmissionForm(
      template._id,
      periodStart,
      template.fields,
      values,
      revisionOf
    );

    try {
      await submit.mutateAsync(formData);
      navigate('..', { replace: true });
    } catch (caught) {
      if (caught instanceof ApiError) {
        // The API reports which answer failed, keyed by field name, so each one
        // is marked in place rather than shown as one opaque message.
        const fieldErrors = caught.fieldErrors();
        const answerErrors = Object.fromEntries(
          Object.entries(fieldErrors).map(([path, message]) => [
            path.replace(/^templateData\./, ''),
            message,
          ])
        );

        if (Object.keys(answerErrors).length > 0) setErrors(answerErrors);
        else setFormError(caught.message);
      } else {
        setFormError('Could not reach the server. Try again.');
      }
    }
  }

  if (isLoading) return <Spinner label="Loading templates" className="p-6" />;

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
      <h1 className="text-xl font-semibold">
        {revisionOf ? 'Resubmit report' : 'Submit a report'}
      </h1>

      {revisionOf && (
        <Alert tone="info" title="Revising a rejected report">
          This submission will be linked to the report it replaces.
        </Alert>
      )}

      {formError && <Alert tone="error">{formError}</Alert>}

      <Card>
        <CardHeader>
          <CardTitle>Report details</CardTitle>
          <CardDescription>
            Choose the template and the period this report covers.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field label="Template" required>
            {(props) => (
              <Select
                {...props}
                required
                value={templateId}
                onChange={(event) => handleTemplateChange(event.target.value)}
              >
                <option value="">Select a template</option>
                {templates.map((candidate) => (
                  <option key={candidate._id} value={candidate._id}>
                    {candidate.name}
                  </option>
                ))}
              </Select>
            )}
          </Field>

          <Field
            label="Period start"
            required
            hint="The Monday of the week this report covers."
          >
            {(props) => (
              <Input
                {...props}
                type="date"
                required
                value={periodStart}
                onChange={(event) => setPeriodStart(event.target.value)}
              />
            )}
          </Field>
        </CardContent>
      </Card>

      {template && (
        <Card>
          <CardHeader>
            <CardTitle>{template.name}</CardTitle>
            <CardDescription>{template.description}</CardDescription>
          </CardHeader>
          <CardContent>
            <DynamicFormFields
              fields={template.fields}
              values={values}
              errors={errors}
              disabled={submit.isPending}
              onChange={(name, value) =>
                setValues((current) => ({ ...current, [name]: value }))
              }
            />
          </CardContent>
        </Card>
      )}

      <div className="flex gap-2">
        <Button type="submit" loading={submit.isPending} disabled={!template}>
          {submit.isPending ? 'Submitting' : 'Submit report'}
        </Button>
        <Button type="button" variant="secondary" onClick={() => navigate('..')}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

/** The Monday of the current week, which is the period most submissions cover. */
function defaultPeriodStart(): string {
  const now = new Date();
  const isoDay = now.getUTCDay() === 0 ? 7 : now.getUTCDay();
  const monday = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - (isoDay - 1))
  );
  return monday.toISOString().slice(0, 10);
}
