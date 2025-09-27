import { AlertCircle, CheckCircle2, Info } from 'lucide-react';
import { cn } from '@/lib/cn';

const tones = {
  error: { border: 'border-danger', icon: AlertCircle, iconClass: 'text-danger', role: 'alert' },
  success: { border: 'border-success', icon: CheckCircle2, iconClass: 'text-success', role: 'status' },
  info: { border: 'border-info', icon: Info, iconClass: 'text-info', role: 'status' },
} as const;

/**
 * A message that assistive technology is told about: errors announce
 * immediately, confirmations announce politely.
 */
export function Alert({
  tone = 'info',
  title,
  children,
  className,
}: {
  tone?: keyof typeof tones;
  title?: string;
  children?: React.ReactNode;
  className?: string;
}) {
  const { border, icon: Icon, iconClass, role } = tones[tone];

  return (
    <div
      role={role}
      className={cn('flex gap-3 rounded-md border-l-4 bg-muted p-3', border, className)}
    >
      <Icon className={cn('mt-0.5 size-4 shrink-0', iconClass)} aria-hidden="true" />
      <div className="text-sm">
        {title && <p className="font-medium">{title}</p>}
        {children && <div className={cn(title && 'mt-0.5 text-muted-foreground')}>{children}</div>}
      </div>
    </div>
  );
}
