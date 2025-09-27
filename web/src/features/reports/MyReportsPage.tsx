import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Field, Select } from '@/components/ui/Field';
import { Spinner } from '@/components/ui/Spinner';
import { StatusBadge } from '@/components/ui/Badge';
import { Table, TableWrap, Td, Th } from '@/components/ui/Table';
import { useReports } from '@/lib/queries';
import { isPopulated, type Report } from '@/lib/schemas';
import { ReportDetail } from './ReportDetail';

/** A staff member's own submissions. The API scopes this regardless of filters. */
export function MyReportsPage() {
  const [status, setStatus] = useState<'' | 'pending' | 'approved' | 'rejected'>('');
  const [selected, setSelected] = useState<Report | null>(null);

  const { data, isLoading, error } = useReports({
    reviewStatus: status || undefined,
    limit: 50,
  });

  const rejected = useMemo(
    () => (data?.reports ?? []).filter((report) => report.reviewStatus === 'rejected'),
    [data]
  );

  if (isLoading) return <Spinner label="Loading your reports" className="p-6" />;
  if (error) return <Alert tone="error">Could not load your reports. Try again.</Alert>;

  const reports = data?.reports ?? [];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-xl font-semibold">My reports</h1>
        <Link
          to="../submit"
          className="inline-flex h-10 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-brand-400"
        >
          Submit a report
        </Link>
      </div>

      {rejected.length > 0 && (
        <Alert tone="error" title={`${rejected.length} report(s) need revision`}>
          A rejected report can be resubmitted with the reviewer's notes addressed.
        </Alert>
      )}

      <Card>
        <CardHeader className="flex-row items-end gap-3">
          <Field label="Status" className="w-48">
            {(props) => (
              <Select
                {...props}
                value={status}
                onChange={(event) => setStatus(event.target.value as typeof status)}
              >
                <option value="">All statuses</option>
                <option value="pending">Pending review</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
              </Select>
            )}
          </Field>
          <p className="ml-auto text-sm text-muted-foreground">
            {data?.pagination.totalCount ?? 0} total
          </p>
        </CardHeader>

        <CardContent>
          {reports.length === 0 ? (
            <EmptyState
              title="No reports yet"
              description="Submitted reports appear here with their review status."
            />
          ) : (
            <TableWrap>
              <Table>
                <caption className="sr-only">Your submitted reports</caption>
                <thead>
                  <tr>
                    <Th>Template</Th>
                    <Th>Period</Th>
                    <Th>Submitted</Th>
                    <Th>Status</Th>
                    <Th>
                      <span className="sr-only">Actions</span>
                    </Th>
                  </tr>
                </thead>
                <tbody>
                  {reports.map((report) => (
                    <tr key={report._id}>
                      <Td>
                        {isPopulated(report.templateId) ? report.templateId.name : 'Template'}
                        <span className="ml-1 text-xs text-muted-foreground">
                          v{report.templateVersion}
                        </span>
                      </Td>
                      <Td>
                        {report.isoYear} week {report.isoWeek}
                      </Td>
                      <Td>{new Date(report.submissionDate).toLocaleDateString()}</Td>
                      <Td>
                        <StatusBadge status={report.reviewStatus} />
                      </Td>
                      <Td>
                        <Button variant="ghost" size="sm" onClick={() => setSelected(report)}>
                          View
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

      {selected && <ReportDetail report={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
