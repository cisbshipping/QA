import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { getPermissionsConfig, type PermissionConfig } from '@/lib/db';
import type { UserRole } from '@/types';

// Default permission config — must match the current operational behavior across the app.
// Admin can override these via /permissions; the overrides live in Firestore at settings/permissions.
export const DEFAULT_PERMISSIONS: PermissionConfig = {
  // Complaints
  'complaint.view': ['admin', 'manager', 'qa', 'viewer'],
  'complaint.create': ['admin', 'manager', 'qa'],
  'complaint.edit': ['admin', 'manager', 'qa'],
  'complaint.review': ['admin', 'manager', 'qa'],
  'complaint.delete': ['admin'],
  'complaint.bulkDelete': ['admin'],
  'complaint.bulkClose': ['admin', 'manager', 'qa'],
  'complaint.reopen': ['admin'],
  'complaint.sendEmail': ['admin', 'manager', 'qa'],
  'complaint.logReply': ['admin', 'manager', 'qa'],
  // Inspections
  'inspection.view': ['admin', 'manager', 'qa', 'viewer'],
  'inspection.create': ['admin', 'manager', 'qa'],
  'inspection.edit': ['admin', 'manager', 'qa'],
  'inspection.review': ['admin', 'manager', 'qa'],
  'inspection.result': ['admin', 'manager', 'qa'],
  'inspection.reschedule': ['admin'],
  'inspection.revert': ['admin'],
  'inspection.reopen': ['admin'],
  // Suppliers
  'supplier.view': ['admin', 'manager', 'qa', 'viewer'],
  'supplier.edit': ['admin', 'manager', 'qa'],
  'supplier.delete': ['admin'],
  // Inbox
  'inbox.view': ['admin', 'manager', 'qa'],
  'inbox.process': ['admin', 'manager', 'qa'],
  // Users
  'user.view': ['admin'],
  'user.invite': ['admin'],
  'user.changeRole': ['admin'],
  // Settings / Audit
  'settings.view': ['admin'],
  'settings.editCompanies': ['admin'],
  'settings.editLetterheads': ['admin'],
  'settings.editTemplates': ['admin'],
  'settings.editPermissions': ['admin'],
  'audit.view': ['admin'],
};

interface PermissionsContextType {
  config: PermissionConfig;
  refresh: () => Promise<void>;
  can: (key: string) => boolean;
  canAs: (key: string, role: UserRole | undefined) => boolean;
  isLoading: boolean;
}

const PermissionsContext = createContext<PermissionsContextType | null>(null);

export function PermissionsProvider({ children }: { children: ReactNode }) {
  const { appUser } = useAuth();
  const [config, setConfig] = useState<PermissionConfig>(DEFAULT_PERMISSIONS);
  const [isLoading, setIsLoading] = useState(true);

  const refresh = async () => {
    try {
      const saved = await getPermissionsConfig();
      // Merge saved overrides over defaults so any new keys not yet in the saved doc still work.
      setConfig({ ...DEFAULT_PERMISSIONS, ...(saved ?? {}) });
    } catch {
      // If load fails (e.g. permission denied for unauthenticated path), keep defaults.
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!appUser) {
      setIsLoading(false);
      return;
    }
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appUser?.uid]);

  const canAs = (key: string, role: UserRole | undefined): boolean => {
    if (!role) return false;
    return config[key]?.includes(role) ?? false;
  };

  const can = (key: string): boolean => canAs(key, appUser?.role);

  return (
    <PermissionsContext.Provider value={{ config, refresh, can, canAs, isLoading }}>
      {children}
    </PermissionsContext.Provider>
  );
}

export function usePermissions() {
  const ctx = useContext(PermissionsContext);
  if (!ctx) throw new Error('usePermissions must be used inside PermissionsProvider');
  return ctx;
}
