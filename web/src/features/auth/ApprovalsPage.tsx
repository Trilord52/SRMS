import { useState } from 'react';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Field, Select, Textarea } from '@/components/ui/Field';
import { Spinner } from '@/components/ui/Spinner';
import { Table, TableWrap, Td, Th } from '@/components/ui/Table';
import { ApiError } from '@/lib/api';
import { useDecideRegistration, usePendingRegistrations } from '@/lib/queries';
import { fullName, ROLES, type Role } from '@/lib/schemas';

/**
 * Pending registrations.
 *
 * Role is assigned here, at approval, rather than claimed by the applicant. The
 * legacy form let a registration ask for the manager role and the API granted it
 * without review.
 */
export function ApprovalsPage() {
  const { data, isLoading, error } = usePendingRegistrations();
  const decide = useDecideRegistration();

  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [roles, setRoles] = useState<Record<string, Role>>({});
  const [actionError, setActionError] = useState<string | null>(null);

  if (isLoading) return <Spinner label="Loading pending registrations" className="p-6" />;
  if (error) return <Alert tone="error">Could not load registrations. Try again.</Alert>;

  const users = data?.users ?? [];

  async function handleDecision(userId: string, decision: 'approved' | 'rejected') {
    setActionError(null);

    if (decision === 'rejected' && reason.trim().length < 3) {
      setActionError('Give a reason so the applicant knows why.');
      return;
    }

    try {
      await decide.mutateAsync({
        userId,
        decision,
        rejectionReason: decision === 'rejected' ? reason : undefined,
      });
      setRejectingId(null);
      setReason('');
    } catch (caught) {
      setActionError(
        caught instanceof ApiError ? caught.message : 'Could not save the decision. Try again.'
      );
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">Pending approvals</h1>

      {actionError && <Alert tone="error">{actionError}</Alert>}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {users.length} request{users.length === 1 ? '' : 's'} waiting
          </CardTitle>
          <CardDescription>
            An account cannot sign in until it is approved. The role is set here.
          </CardDescription>
        </CardHeader>

        <CardContent>
          {users.length === 0 ? (
            <EmptyState
              title="No pending requests"
              description="New access requests appear here for review."
            />
          ) : (
            <TableWrap>
              <Table>
                <caption className="sr-only">Registrations awaiting a decision</caption>
                <thead>
                  <tr>
                    <Th>Name</Th>
                    <Th>Email</Th>
                    <Th>Staff ID</Th>
                    <Th>Department</Th>
                    <Th>Role to assign</Th>
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
                      <Td>{user.userId}</Td>
                      <Td>{user.department ?? '—'}</Td>
                      <Td>
                        <Select
                          aria-label={`Role for ${fullName(user)}`}
                          value={roles[user._id] ?? 'staff'}
                          onChange={(event) =>
                            setRoles((current) => ({
                              ...current,
                              [user._id]: event.target.value as Role,
                            }))
                          }
                          className="h-8 w-36"
                        >
                          {ROLES.map((role) => (
                            <option key={role} value={role}>
                              {role}
                            </option>
                          ))}
                        </Select>
                      </Td>
                      <Td>
                        <div className="flex gap-1">
                          <Button
                            size="sm"
                            variant="success"
                            loading={decide.isPending}
                            onClick={() => void handleDecision(user._id, 'approved')}
                          >
                            Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() =>
                              setRejectingId(rejectingId === user._id ? null : user._id)
                            }
                          >
                            Reject
                          </Button>
                        </div>

                        {rejectingId === user._id && (
                          <div className="mt-2 flex flex-col gap-2">
                            <Field label="Reason" required>
                              {(props) => (
                                <Textarea
                                  {...props}
                                  rows={2}
                                  value={reason}
                                  onChange={(event) => setReason(event.target.value)}
                                  placeholder="Why is this request being declined?"
                                />
                              )}
                            </Field>
                            <Button
                              size="sm"
                              variant="danger"
                              loading={decide.isPending}
                              onClick={() => void handleDecision(user._id, 'rejected')}
                            >
                              Confirm rejection
                            </Button>
                          </div>
                        )}
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
