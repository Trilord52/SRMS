import { cn } from '@/lib/cn';

/**
 * A table that scrolls inside its own container, so a wide result set never
 * makes the page itself scroll sideways on a narrow screen.
 */
export function TableWrap({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div className={cn('w-full overflow-x-auto rounded-card border border-border', className)}>
      {children}
    </div>
  );
}

export function Table({ className, ...props }: React.TableHTMLAttributes<HTMLTableElement>) {
  return <table className={cn('w-full text-left text-sm', className)} {...props} />;
}

export function Th({ className, ...props }: React.ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      scope="col"
      className={cn('bg-muted px-3 py-2 font-medium text-muted-foreground', className)}
      {...props}
    />
  );
}

export function Td({ className, ...props }: React.TdHTMLAttributes<HTMLTableCellElement>) {
  return <td className={cn('border-t border-border px-3 py-2 align-middle', className)} {...props} />;
}
