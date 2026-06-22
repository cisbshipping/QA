import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { format } from 'date-fns';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function fmtDate(date: Date | undefined | null, fmt = 'dd/MM/yyyy'): string {
  if (!date) return '—';
  return format(date, fmt);
}

export function fmtDateTime(date: Date | undefined | null): string {
  return fmtDate(date, 'dd/MM/yyyy HH:mm');
}

export const STATUS_COLORS: Record<string, string> = {
  open: 'bg-blue-100 text-blue-800',
  accepted: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
  closed: 'bg-gray-100 text-gray-800',
  pending: 'bg-yellow-100 text-yellow-800',
  passed: 'bg-green-100 text-green-800',
  failed: 'bg-red-100 text-red-800',
  rescheduled: 'bg-orange-100 text-orange-800',
};

export function statusLabel(status: string): string {
  return status.charAt(0).toUpperCase() + status.slice(1);
}
