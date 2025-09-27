import { useState } from 'react';
import { Link } from 'react-router-dom';
import { z } from 'zod';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Field, Input } from '@/components/ui/Field';
import { api, ApiError } from '@/lib/api';

/**
 * Mirrors the API's registration schema so the form catches what it can before a
 * round trip. The API validates again regardless; this is for the person filling
 * it in, not for safety.
 *
 * Note there is no role selector. The legacy form let a registration claim the
 * manager role, and the API auto-approved it, so anyone reaching the page could
 * create themselves an administrator account. Role is assigned on approval.
 */
const registrationSchema = z.object({
  firstName: z.string().trim().min(1, 'Enter your first name').max(60),
  lastName: z.string().trim().min(1, 'Enter your last name').max(60),
  userId: z.string().trim().min(2, 'Enter your staff ID').max(40),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[\w.-]+@bankofabyssinia\.com$/, 'Use your bankofabyssinia.com address'),
  password: z.string().min(12, 'Use at least 12 characters'),
  department: z.string().trim().max(120).optional(),
  phoneNumber: z.string().trim().max(40).optional(),
});

type Values = z.infer<typeof registrationSchema>;

const EMPTY: Record<keyof Values, string> = {
  firstName: '',
  lastName: '',
  userId: '',
  email: '',
  password: '',
  department: '',
  phoneNumber: '',
};

export function RegisterPage() {
  const [values, setValues] = useState<Record<keyof Values, string>>(EMPTY);
  const [errors, setErrors] = useState<Partial<Record<string, string>>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const set = (key: keyof Values) => (event: React.ChangeEvent<HTMLInputElement>) =>
    setValues((current) => ({ ...current, [key]: event.target.value }));

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setFormError(null);

    const parsed = registrationSchema.safeParse(values);
    if (!parsed.success) {
      setErrors(
        Object.fromEntries(
          parsed.error.issues.map((issue) => [issue.path.join('.'), issue.message])
        )
      );
      return;
    }

    setErrors({});
    setSubmitting(true);

    try {
      await api.post('/api/v1/auth/register', {
        ...parsed.data,
        department: parsed.data.department || undefined,
        phoneNumber: parsed.data.phoneNumber || undefined,
      });
      setSubmitted(true);
    } catch (caught) {
      if (caught instanceof ApiError) {
        // The API reports which field collided, so it can be marked in place.
        const fieldErrors = caught.fieldErrors();
        if (Object.keys(fieldErrors).length > 0) setErrors(fieldErrors);
        else setFormError(caught.message);
      } else {
        setFormError('Could not reach the server. Try again.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-muted p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Request submitted</CardTitle>
            <CardDescription>
              A manager will review your request. You will be able to sign in once it is approved.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link
              to="/login"
              className="inline-flex h-10 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-brand-400"
            >
              Back to sign in
            </Link>
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-muted p-4">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle>Request access</CardTitle>
          <CardDescription>
            Staff accounts are approved by a manager before first sign-in.
          </CardDescription>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
            {formError && <Alert tone="error">{formError}</Alert>}

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="First name" required error={errors.firstName}>
                {(p) => <Input {...p} value={values.firstName} onChange={set('firstName')} autoComplete="given-name" />}
              </Field>
              <Field label="Last name" required error={errors.lastName}>
                {(p) => <Input {...p} value={values.lastName} onChange={set('lastName')} autoComplete="family-name" />}
              </Field>
            </div>

            <Field label="Staff ID" required error={errors.userId}>
              {(p) => <Input {...p} value={values.userId} onChange={set('userId')} />}
            </Field>

            <Field
              label="Work email"
              required
              error={errors.email}
              hint="Must be a bankofabyssinia.com address."
            >
              {(p) => (
                <Input {...p} type="email" value={values.email} onChange={set('email')} autoComplete="email" />
              )}
            </Field>

            <Field
              label="Password"
              required
              error={errors.password}
              hint="At least 12 characters."
            >
              {(p) => (
                <Input
                  {...p}
                  type="password"
                  value={values.password}
                  onChange={set('password')}
                  autoComplete="new-password"
                />
              )}
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Department" error={errors.department}>
                {(p) => <Input {...p} value={values.department} onChange={set('department')} />}
              </Field>
              <Field label="Phone number" error={errors.phoneNumber}>
                {(p) => <Input {...p} type="tel" value={values.phoneNumber} onChange={set('phoneNumber')} />}
              </Field>
            </div>

            <Button type="submit" loading={submitting}>
              {submitting ? 'Submitting' : 'Submit request'}
            </Button>

            <p className="text-center text-sm text-muted-foreground">
              Already approved?{' '}
              <Link to="/login" className="font-medium text-foreground underline">
                Sign in
              </Link>
            </p>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
