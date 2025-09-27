import { useState } from 'react';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Field, Textarea } from '@/components/ui/Field';
import { Spinner } from '@/components/ui/Spinner';
import { Table, TableWrap, Td, Th } from '@/components/ui/Table';
import { useAuth } from '@/features/auth/AuthContext';
import { ApiError } from '@/lib/api';
import { useReports, useReviewReport } from '@/lib/queries';
import { fullName, isPopulated, type Report } from '@/lib/schemas';
import { ReportDetail } from './ReportDetail';

/** Reports awaiting a decision, with the review action attached to each. */
export function ReviewQueuePage() {
  const { user } = useAuth();
  const { data, isLoading, error } = useReports({ reviewStatus: 'pending', limit: 50 });
  const [selected, setSelected] = useState<Report | null>(null);

  if (isLoading) return <Spinner label="Loading the review queue" className="p-6" />;
  if (error) return <Alert tone="error">Could not load the review queue. Try again.</Alert>;

  const reports = data?.reports ?? [];

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">Review queue</h1>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {reports.length} report{reports.length === 1 ? '' : 's'} awaiting review
          </CardTitle>
        </CardHeader>
        <CardContent>
          {reports.length === 0 ? (
            <EmptyState
              title="Nothing to review"
              description="Submitted reports appear here until a decision is recorded."
            />
          ) : (
            <TableWrap>
              <Table>
                <caption className="sr-only">Reports awaiting review</caption>
                <thead>
                  <tr>
                    <Th>Submitter</Th>
                    <Th>Template</Th>
                    <Th>Period</Th>
                    <Th>Submitted</Th>
                    <Th>
                      <span className="sr-only">Actions</span>
                    </Th>
                  </tr>
                </thead>
                <tbody>
                  {reports.map((report) => {
                    const submitter = isPopulated(report.submittedBy) ? report.submittedBy : null;
                    const isOwn = submitter?._id === user?._id;

                    return (
                      <tr key={report._id}>
                        <Td>
                          {submitter ? fullName(submitter) : 'Unknown'}
                          {isOwn && (
                            <span className="ml-2 text-xs text-muted-foreground">
                              your submission
                            </span>
                          )}
                        </Td>
                        <Td>
                          {isPopulated(report.templateId) ? report.templateId.name : 'Template'}
                        </Td>
                        <Td>
                          {report.isoYear} week {report.isoWeek}
                        </Td>
                        <Td>{new Date(report.submissionDate).toLocaleDateString()}</Td>
                        <Td>
                          <Button variant="ghost" size="sm" onClick={() => setSelected(report)}>
                            Review
                          </Button>
                        </Td>
                      </tr>
                    );
                  })}
                </tbody>
              </Table>
            </TableWrap>
          )}
        </CardContent>
      </Card>

      {selected && (
        <ReportDetail
          report={selected}
          onClose={() => setSelected(null)}
          footer={
            <ReviewActions
              report={selected}
              isOwnReport={
                isPopulated(selected.submittedBy) && selected.submittedBy._id === user?._id
              }
              onDone={() => setSelected(null)}
            />
          }
        />
      )}
    </div>
  );
}

function ReviewActions({
  report,
  isOwnReport,
  onDone,
}: {
  report: Report;
  isOwnReport: boolean;
  onDone: () => void;
}) {
  const review = useReviewReport();
  const [comments, setComments] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState(false);

  // A reviewer cannot rule on their own submission. The API enforces this; the
  // interface says so rather than offering a button that will be refused.
  if (isOwnReport) {
    return (
      <Alert tone="info">
        You submitted this report, so another reviewer has to decide on it.
      </Alert>
    );
  }

  async function decide(decision: 'approved' | 'rejected') {
    setError(null);

    if (decision === 'rejected' && rejectionReason.trim().length < 3) {
      setError('Give a reason so the submitter knows what to change.');
      setRejecting(true);
      return;
    }

    try {
      await review.mutateAsync({
        reportId: report._id,
        decision,
        reviewComments: comments,
        rejectionReason: decision === 'rejected' ? rejectionReason : undefined,
      });
      onDone();
    } catch (caught) {
      setError(
        caught instanceof ApiError ? caught.message : 'Could not record the decision. Try again.'
      );
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {error && <Alert tone="error">{error}</Alert>}

      <Field label="Notes for the submitter" hint="Optional, shown with either decision.">
        {(props) => (
          <Textarea
            {...props}
            value={comments}
            onChange={(event) => setComments(event.target.value)}
            rows={2}
          />
        )}
      </Field>

      {rejecting && (
        <Field label="Reason for rejection" required>
          {(props) => (
            <Textarea
              {...props}
              value={rejectionReason}
              onChange={(event) => setRejectionReason(event.target.value)}
              rows={2}
              placeholder="What needs to change before resubmitting?"
            />
          )}
        </Field>
      )}

      <div className="flex flex-wrap gap-2">
        <Button
          variant="success"
          loading={review.isPending && !rejecting}
          onClick={() => void decide('approved')}
        >
          Approve
        </Button>

        {rejecting ? (
          <>
            <Button
              variant="danger"
              loading={review.isPending}
              onClick={() => void decide('rejected')}
            >
              Confirm rejection
            </Button>
            <Button variant="ghost" onClick={() => setRejecting(false)}>
              Cancel
            </Button>
          </>
        ) : (
          <Button variant="secondary" onClick={() => setRejecting(true)}>
            Reject
          </Button>
        )}
      </div>
    </div>
  );
}
