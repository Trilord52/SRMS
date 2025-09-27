import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { StatusBadge } from '@/components/ui/Badge';
import { fullName, isPopulated, type Report, type TemplateField } from '@/lib/schemas';

/**
 * Report detail, shown as a modal dialog.
 *
 * Focus moves into the dialog on open and returns to the trigger on close, and
 * Escape dismisses it, so it is operable without a mouse.
 */
export function ReportDetail({
  report,
  onClose,
  footer,
}: {
  report: Report;
  onClose: () => void;
  footer?: React.ReactNode;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  useEffect(() => {
    previouslyFocused.current = document.activeElement as HTMLElement | null;
    dialogRef.current?.focus();

    function handleKey(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }

    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('keydown', handleKey);
      previouslyFocused.current?.focus();
    };
  }, [onClose]);

  const template = isPopulated(report.templateId) ? report.templateId : null;
  const submitter = isPopulated(report.submittedBy) ? report.submittedBy : null;
  const fields: TemplateField[] = template?.fields ?? [];

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="report-detail-title"
        tabIndex={-1}
        className="my-8 w-full max-w-2xl rounded-card border border-border bg-card p-5 text-card-foreground"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id="report-detail-title" className="text-lg font-semibold">
              {template?.name ?? 'Report'}
            </h2>
            <p className="text-sm text-muted-foreground">
              {report.isoYear} week {report.isoWeek}
              {submitter && ` · ${fullName(submitter)}`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <StatusBadge status={report.reviewStatus} />
            <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close">
              <X aria-hidden="true" />
            </Button>
          </div>
        </div>

        {report.reviewStatus === 'rejected' && report.rejectionReason && (
          <Alert tone="error" title="Rejected" className="mt-4">
            {report.rejectionReason}
          </Alert>
        )}

        {report.reviewComments && (
          <Alert tone="info" title="Reviewer notes" className="mt-4">
            {report.reviewComments}
          </Alert>
        )}

        <dl className="mt-4 grid gap-3 sm:grid-cols-2">
          {fields.length > 0
            ? [...fields]
                .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
                .map((field) => (
                  <div key={field.name} className={field.type === 'textarea' ? 'sm:col-span-2' : ''}>
                    <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      {field.label}
                    </dt>
                    <dd className="mt-0.5 text-sm break-words">
                      {formatAnswer(report.templateData[field.name], field)}
                    </dd>
                  </div>
                ))
            : // Falls back to raw keys when the template was not populated, so a
              // report is never shown as empty just because fields were not sent.
              Object.entries(report.templateData).map(([key, value]) => (
                <div key={key}>
                  <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {key}
                  </dt>
                  <dd className="mt-0.5 text-sm break-words">{formatAnswer(value)}</dd>
                </div>
              ))}
        </dl>

        {report.files.length > 0 && (
          <section className="mt-5">
            <h3 className="text-sm font-medium">Attachments</h3>
            <ul className="mt-2 flex flex-col gap-1">
              {report.files.map((file) =>
                isPopulated(file) ? (
                  <li key={file._id} className="text-sm">
                    <a
                      href={`/api/v1/reports/files/${file._id}`}
                      className="underline"
                      download={file.originalName}
                    >
                      {file.originalName}
                    </a>
                    <span className="ml-2 text-xs text-muted-foreground">
                      {formatBytes(file.size)}
                    </span>
                  </li>
                ) : null
              )}
            </ul>
          </section>
        )}

        {footer && <div className="mt-5 border-t border-border pt-4">{footer}</div>}
      </div>
    </div>
  );
}

function formatAnswer(value: unknown, field?: TemplateField): string {
  if (value === null || value === undefined || value === '') return '—';

  if (typeof value === 'boolean') return value ? 'Yes' : 'No';

  if (field?.type === 'date' && typeof value === 'string') {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleDateString();
  }

  if (field?.type === 'select') {
    const option = field.options.find((candidate) => candidate.value === value);
    return option?.label ?? String(value);
  }

  if (field?.type === 'yesno') return value === 'yes' ? 'Yes' : 'No';

  return String(value);
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
