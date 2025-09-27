import { cn } from '@/lib/cn';

/**
 * A loading indicator that announces itself. The visible label is optional but
 * the accessible one is not, so a screen reader is not left with a bare graphic.
 */
export function Spinner({
  label = 'Loading',
  showLabel = true,
  className,
}: {
  label?: string;
  showLabel?: boolean;
  className?: string;
}) {
  return (
    <div className={cn('flex items-center gap-3', className)} role="status">
      <span
        aria-hidden="true"
        className="size-5 shrink-0 animate-spin rounded-full border-2 border-border border-t-primary"
      />
      <span className={showLabel ? 'text-sm text-muted-foreground' : 'sr-only'}>{label}</span>
    </div>
  );
}
