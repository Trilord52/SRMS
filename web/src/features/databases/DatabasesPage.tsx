import { useState } from 'react';
import { Plus } from 'lucide-react';
import { Alert } from '@/components/ui/Alert';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Field, Input, Select } from '@/components/ui/Field';
import { Spinner } from '@/components/ui/Spinner';
import { Table, TableWrap, Td, Th } from '@/components/ui/Table';
import { ApiError } from '@/lib/api';
import { useDatabases, useRetireDatabase, useSaveDatabase } from '@/lib/queries';
import type { DatabaseRecord } from '@/lib/schemas';

/** Inventory of the database servers the team is responsible for. */
export function DatabasesPage() {
  const [showRetired, setShowRetired] = useState(false);
  const { data, isLoading, error } = useDatabases(
    showRetired ? {} : { isActive: true }
  );
  const retire = useRetireDatabase();
  const [editing, setEditing] = useState<DatabaseRecord | 'new' | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  if (isLoading) return <Spinner label="Loading databases" className="p-6" />;
  if (error) return <Alert tone="error">Could not load databases. Try again.</Alert>;

  const databases = data?.databases ?? [];

  if (editing) {
    return (
      <DatabaseEditor
        record={editing === 'new' ? null : editing}
        onDone={() => setEditing(null)}
      />
    );
  }

  async function toggle(record: DatabaseRecord) {
    setActionError(null);
    try {
      await retire.mutateAsync({ id: record._id, restore: !record.isActive });
    } catch (caught) {
      setActionError(caught instanceof ApiError ? caught.message : 'Could not update the record.');
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">Databases</h1>
        <Button onClick={() => setEditing('new')}>
          <Plus aria-hidden="true" />
          Add database
        </Button>
      </div>

      {actionError && <Alert tone="error">{actionError}</Alert>}

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle className="text-base">{databases.length} record(s)</CardTitle>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setShowRetired((current) => !current)}
          >
            {showRetired ? 'Hide retired' : 'Show retired'}
          </Button>
        </CardHeader>

        <CardContent>
          {databases.length === 0 ? (
            <EmptyState
              title="No databases recorded"
              description="Add the servers this team is responsible for."
              action={<Button onClick={() => setEditing('new')}>Add one</Button>}
            />
          ) : (
            <TableWrap>
              <Table>
                <caption className="sr-only">Database inventory</caption>
                <thead>
                  <tr>
                    <Th>Name</Th>
                    <Th>Type</Th>
                    <Th>Host</Th>
                    <Th>Version</Th>
                    <Th>OS</Th>
                    <Th>State</Th>
                    <Th>
                      <span className="sr-only">Actions</span>
                    </Th>
                  </tr>
                </thead>
                <tbody>
                  {databases.map((record) => (
                    <tr key={record._id}>
                      <Td>{record.name}</Td>
                      <Td>{record.databaseType}</Td>
                      <Td className="font-mono text-xs">{record.host}</Td>
                      <Td>{record.dbVersion}</Td>
                      <Td>{record.osVersion}</Td>
                      <Td>
                        <Badge tone={record.isActive ? 'approved' : 'neutral'}>
                          {record.isActive ? 'Active' : 'Retired'}
                        </Badge>
                      </Td>
                      <Td>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="sm" onClick={() => setEditing(record)}>
                            Edit
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            loading={retire.isPending}
                            onClick={() => void toggle(record)}
                          >
                            {record.isActive ? 'Retire' : 'Restore'}
                          </Button>
                        </div>
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

const DATABASE_TYPES = ['PostgreSQL', 'MySQL', 'Oracle', 'MongoDB', 'SQL Server', 'Other'];

function DatabaseEditor({
  record,
  onDone,
}: {
  record: DatabaseRecord | null;
  onDone: () => void;
}) {
  const save = useSaveDatabase();
  const [values, setValues] = useState({
    name: record?.name ?? '',
    databaseType: record?.databaseType ?? 'PostgreSQL',
    host: record?.host ?? '',
    dbVersion: record?.dbVersion ?? '',
    osVersion: record?.osVersion ?? '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);

  const set = (key: keyof typeof values) => (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setValues((current) => ({ ...current, [key]: event.target.value }));

  async function handleSave() {
    setErrors({});
    setFormError(null);

    try {
      await save.mutateAsync({ id: record?._id, body: values });
      onDone();
    } catch (caught) {
      if (caught instanceof ApiError) {
        const fieldErrors = caught.fieldErrors();
        if (Object.keys(fieldErrors).length > 0) setErrors(fieldErrors);
        else setFormError(caught.message);
      } else {
        setFormError('Could not save the record.');
      }
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">{record ? 'Edit database' : 'Add database'}</h1>

      {formError && <Alert tone="error">{formError}</Alert>}

      <Card>
        <CardContent className="grid gap-4 pt-5 sm:grid-cols-2">
          <Field label="Name" required error={errors.name}>
            {(props) => <Input {...props} value={values.name} onChange={set('name')} />}
          </Field>

          <Field label="Type" required error={errors.databaseType}>
            {(props) => (
              <Select {...props} value={values.databaseType} onChange={set('databaseType')}>
                {DATABASE_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </Select>
            )}
          </Field>

          <Field
            label="Host"
            required
            error={errors.host}
            hint="An IPv4 or IPv6 address, or a hostname."
          >
            {(props) => (
              <Input {...props} value={values.host} onChange={set('host')} className="font-mono" />
            )}
          </Field>

          <Field label="Database version" required error={errors.dbVersion}>
            {(props) => <Input {...props} value={values.dbVersion} onChange={set('dbVersion')} />}
          </Field>

          <Field label="OS version" required error={errors.osVersion}>
            {(props) => <Input {...props} value={values.osVersion} onChange={set('osVersion')} />}
          </Field>
        </CardContent>
      </Card>

      <div className="flex gap-2">
        <Button loading={save.isPending} onClick={() => void handleSave()}>
          {record ? 'Save changes' : 'Add database'}
        </Button>
        <Button variant="secondary" onClick={onDone}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
