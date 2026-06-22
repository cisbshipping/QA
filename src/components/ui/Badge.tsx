import { cn, STATUS_COLORS, statusLabel } from '@/lib/utils';

interface BadgeProps {
  status: string;
  className?: string;
}

export function StatusBadge({ status, className }: BadgeProps) {
  return (
    <span className={cn('inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium', STATUS_COLORS[status] ?? 'bg-gray-100 text-gray-800', className)}>
      {statusLabel(status)}
    </span>
  );
}

export function Badge({ children, variant = 'default', className }: { children: React.ReactNode; variant?: 'default' | 'outline'; className?: string }) {
  return (
    <span className={cn(
      'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium',
      variant === 'outline' ? 'border border-gray-300 text-gray-700' : 'bg-gray-100 text-gray-800',
      className,
    )}>
      {children}
    </span>
  );
}
