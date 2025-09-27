import { useState } from 'react';
import { Alert } from '@/components/ui/Alert';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Field, Input, Select } from '@/components/ui/Field';
import { Spinner } from '@/components/ui/Spinner';
import { Table, TableWrap, Td, Th } from '@/components/ui/Table';
import { api, ApiError } from '@/lib/api';
import { useUsers } from '@/lib/queries';
import { fullName, ROLES, type User } from '@/lib/schemas';

/** All accounts, with an administrative password reset. */
export function UsersPage() {
  const [role, setRole] = useState('');
  const [status, setStatus] = useState('');
  const { data, isLoading, error } = useUsers({
    role: role || undefined,
    accountStatus: status || undefined,
  });

  const [resetting, setResetting] = useState<User | null>(null);

  if (isLoading) return <Spinner label="Loading users" className="p-6" />;
  if (error) return <Alert tone="error">Could not load users. Try again.</Alert>;

  const users = data?.users ?? [];

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">Users</h1>

      <Card>
        <CardHeader>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Role">
              {(props) => (
                <Select {...props} value={role} onChange={(event) => setRole(event.target.value)}>
                  <option value="">All roles</option>
                  {ROLES.map((candidate) => (
                    <option key={candidate} value={candidate}>
                      {candidate}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <Field label="Account status">
              {(props) => (
                <Select
                  {...props}
                  value={status}
                  onChange={(event) => setStatus(event.target.value)}
                >
                  <option value="">All statuses</option>
                  <option value="pending">Pending</option>
                  <option value="approved">Approved</option>
                  <option value="rejected">Rejected</option>
                </Select>
              )}
            </Field>
          </div>
        </CardHeader>

        <CardContent>
          {users.length === 0 ? (
            <EmptyState title="No users match these filters" />
          ) : (
            <TableWrap>
              <Table>
                <caption className="sr-only">User accounts</caption>
                <thead>
                  <tr>
                    <Th>Name</Th>
                    <Th>Email</Th>
                    <Th>Role</Th>
                    <Th>Status</Th>
                    <Th>
                      <span className="sr-only">Actions</span>
                    </Th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => (
                    <tr key={user._id}>
                      <Td>{fullName(user)}</Td>
                      <Td className="break-all">{user.email}</Td>
                      <Td>{user.role}</Td>
                      <Td>
                        <Badge
                          tone={
                            user.accountStatus === 'approved'
                              ? 'approved'
                              : user.accountStatus === 'rejected'
                                ? 'rejected'
                                : 'pending'
                          }
                        >
                          {user.accountStatus}
                        </Badge>
                      </Td>
                      <Td>
                        <Button variant="ghost" size="sm" onClick={() => setResetting(user)}>
                          Reset password
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

      {resetting && (
        <ResetPasswordCard user={resetting} onClose={() => setResetting(null)} />
      )}
    </div>
  );
}

function ResetPasswordCard({ user, onClose }: { user: User; onClose: () => void }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [saving, setSaving] = useState(false);

  async function handleReset() {
    setError(null);

    if (password.length < 8) {
      setError('Use at least 8 characters.');
      return;
    }

    setSaving(true);
    try {
      await api.post('/api/v1/auth/reset-password', {
        targetUserId: user._id,
        newPassword: password,
      });
      setDone(true);
    } catch (caught) {
      // A supervisor may only reset staff, and nobody may reset a peer of equal
      // rank; the API decides and the message explains the refusal.
      setError(caught instanceof ApiError ? caught.message : 'Could not reset the password.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <h2 className="font-semibold">Reset password for {fullName(user)}</h2>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {error && <Alert tone="error">{error}</Alert>}
        {done ? (
          <>
            <Alert tone="success">
              Password reset. Share the new password with them directly and ask them to change it.
            </Alert>
            <Button variant="secondary" onClick={onClose}>
              Close
            </Button>
          </>
        ) : (
          <>
            <Field label="New password" required hint="At least 8 characters.">
              {(props) => (
                <Input
                  {...props}
                  type="text"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  autoComplete="off"
                />
              )}
            </Field>
            <div className="flex gap-2">
              <Button loading={saving} onClick={() => void handleReset()}>
                Reset password
              </Button>
              <Button variant="secondary" onClick={onClose}>
                Cancel
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
