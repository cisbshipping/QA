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

/**
 * Given a SharePoint/OneDrive file webUrl returned by Microsoft Graph,
 * derive the URL of its parent folder (the path one level up).
 * SharePoint will redirect that path to the folder view in the browser.
 */
export function getSharePointFolderUrl(fileUrl: string | undefined): string | undefined {
  if (!fileUrl) return undefined;
  try {
    const url = new URL(fileUrl);
    url.search = ''; // strip ?web=1 etc.
    url.hash = '';
    const lastSlash = url.pathname.lastIndexOf('/');
    if (lastSlash <= 0) return undefined;
    url.pathname = url.pathname.substring(0, lastSlash);
    return url.toString();
  } catch {
    return undefined;
  }
}
