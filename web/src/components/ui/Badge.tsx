import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/cn';

const badgeStyles = cva(
  'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
  {
    variants: {
      tone: {
        neutral: 'bg-muted text-muted-foreground',
        pending: 'bg-warning text-warning-foreground',
        approved: 'bg-success text-success-foreground',
        rejected: 'bg-danger text-danger-foreground',
        info: 'bg-info text-info-foreground',
      },
    },
    defaultVariants: { tone: 'neutral' },
  }
);

export function Badge({
  className,
  tone,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeStyles>) {
  return <span className={cn(badgeStyles({ tone }), className)} {...props} />;
}

/**
 * Status is conveyed by the label as well as the colour, so the meaning does not
 * depend on distinguishing green from red.
 */
export function StatusBadge({ status }: { status: 'pending' | 'approved' | 'rejected' }) {
  const label = { pending: 'Pending review', approved: 'Approved', rejected: 'Rejected' }[status];
  return <Badge tone={status}>{label}</Badge>;
}
