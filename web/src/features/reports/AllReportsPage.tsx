import { useState } from 'react';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Field, Input, Select } from '@/components/ui/Field';
import { Spinner } from '@/components/ui/Spinner';
import { StatusBadge } from '@/components/ui/Badge';
import { Table, TableWrap, Td, Th } from '@/components/ui/Table';
import { useReports, useTemplates, type ReportFilters } from '@/lib/queries';
import { fullName, isPopulated, type Report } from '@/lib/schemas';
import { ReportDetail } from './ReportDetail';

/** Every report, with the filters the API supports. */
export function AllReportsPage() {
  const [filters, setFilters] = useState<ReportFilters>({ page: 1, limit: 20 });
  const [selected, setSelected] = useState<Report | null>(null);

  const { data, isLoading, error } = useReports(filters);
  const { data: templateData } = useTemplates();

  const set = <K extends keyof ReportFilters>(key: K, value: ReportFilters[K]) =>
    // Any filter change resets to the first page, so the view is never an empty
    // page of a shorter result set.
    setFilters((current) => ({ ...current, [key]: value || undefined, page: 1 }));

  const reports = data?.reports ?? [];
  const pagination = data?.pagination;

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">All reports</h1>

      <Card>
        <CardHeader>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="Status">
              {(props) => (
                <Select
                  {...props}
                  value={filters.reviewStatus ?? ''}
                  onChange={(event) =>
                    set('reviewStatus', event.target.value as ReportFilters['reviewStatus'])
                  }
                >
                  <option value="">All statuses</option>
                  <option value="pending">Pending review</option>
                  <option value="approved">Approved</option>
                  <option value="rejected">Rejected</option>
                </Select>
              )}
            </Field>

            <Field label="Template">
              {(props) => (
                <Select
                  {...props}
                  value={filters.templateId ?? ''}
                  onChange={(event) => set('templateId', event.target.value)}
                >
                  <option value="">All templates</option>
                  {(templateData?.templates ?? []).map((template) => (
                    <option key={template._id} value={template._id}>
                      {template.name}
                    </option>
                  ))}
                </Select>
              )}
            </Field>

            <Field label="Period from">
              {(props) => (
                <Input
                  {...props}
                  type="date"
                  value={filters.from ?? ''}
                  onChange={(event) => set('from', event.target.value)}
                />
              )}
            </Field>

            <Field label="Period to">
              {(props) => (
                <Input
                  {...props}
                  type="date"
                  value={filters.to ?? ''}
                  onChange={(event) => set('to', event.target.value)}
                />
              )}
            </Field>
          </div>
        </CardHeader>

        <CardContent>
          {isLoading ? (
            <Spinner label="Loading reports" />
          ) : error ? (
            <Alert tone="error">Could not load reports. Try again.</Alert>
          ) : reports.length === 0 ? (
            <EmptyState
              title="No reports match these filters"
              description="Widen the date range or clear a filter."
            />
          ) : (
            <>
              <TableWrap>
                <Table>
                  <caption className="sr-only">All reports matching the current filters</caption>
                  <thead>
                    <tr>
                      <Th>Submitter</Th>
                      <Th>Template</Th>
                      <Th>Period</Th>
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
                          {isPopulated(report.submittedBy)
                            ? fullName(report.submittedBy)
                            : 'Unknown'}
                        </Td>
                        <Td>
                          {isPopulated(report.templateId) ? report.templateId.name : 'Template'}
                        </Td>
                        <Td>
                          {report.isoYear} week {report.isoWeek}
                        </Td>
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

              {pagination && pagination.totalPages > 1 && (
                <nav
                  aria-label="Pagination"
                  className="mt-3 flex items-center justify-between gap-3"
                >
                  <p className="text-sm text-muted-foreground">
                    Page {pagination.page} of {pagination.totalPages} · {pagination.totalCount}{' '}
                    reports
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={!pagination.hasPrevPage}
                      onClick={() =>
                        setFilters((current) => ({ ...current, page: (current.page ?? 1) - 1 }))
                      }
                    >
                      Previous
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={!pagination.hasNextPage}
                      onClick={() =>
                        setFilters((current) => ({ ...current, page: (current.page ?? 1) + 1 }))
                      }
                    >
                      Next
                    </Button>
                  </div>
                </nav>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {selected && <ReportDetail report={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
