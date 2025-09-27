import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Field, Input } from '@/components/ui/Field';
import { describeLoginError, homePathFor, useAuth } from './AuthContext';

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const user = await login(email.trim(), password);
      // Return them to wherever the guard interrupted, or their own area.
      const from = (location.state as { from?: string } | null)?.from;
      navigate(from ?? homePathFor(user.role), { replace: true });
    } catch (caught) {
      setError(describeLoginError(caught));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-muted p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="items-center text-center">
          <img src="/logo.png" alt="Bank of Abyssinia" className="mb-2 h-12 w-auto" />
          <CardTitle className="text-lg">Staff Report Management</CardTitle>
          <CardDescription>Sign in to submit or review reports.</CardDescription>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
            {error && <Alert tone="error">{error}</Alert>}

            <Field label="Email" required>
              {(fieldProps) => (
                <Input
                  {...fieldProps}
                  type="email"
                  name="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="you@bankofabyssinia.com"
                />
              )}
            </Field>

            <Field label="Password" required>
              {(fieldProps) => (
                <Input
                  {...fieldProps}
                  type="password"
                  name="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
              )}
            </Field>

            <Button type="submit" loading={submitting} className="mt-1">
              {submitting ? 'Signing in' : 'Sign in'}
            </Button>

            <p className="text-center text-sm text-muted-foreground">
              No account yet?{' '}
              <Link to="/register" className="font-medium text-foreground underline">
                Request access
              </Link>
            </p>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
