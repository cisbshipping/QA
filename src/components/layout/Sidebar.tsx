import { NavLink } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { ROLE_LABELS } from '@/types';
import {
  LayoutDashboard, FileText, ClipboardList,
  Settings, LogOut, ShieldCheck, Users, Inbox, Building2, X, FileSearch, Shield,
} from 'lucide-react';

const mainItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
];

const qaItems = [
  { to: '/complaints', icon: FileText, label: 'Complaints', everyone: true },
  { to: '/inspections', icon: ClipboardList, label: 'Inspections', everyone: true },
  { to: '/inbox', icon: Inbox, label: 'Inbox', everyone: false },
];

const dataItems = [
  { to: '/suppliers', icon: Building2, label: 'Suppliers' },
];

const adminItems = [
  { to: '/permissions', icon: Shield, label: 'Permissions' },
  { to: '/audit', icon: FileSearch, label: 'Audit Logs' },
  { to: '/users', icon: Users, label: 'Users' },
  { to: '/settings', icon: Settings, label: 'Settings' },
];

export function Sidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { appUser, logOut } = useAuth();

  return (
    <>
      {/* Mobile overlay */}
      {open && (
        <div
          className="fixed inset-0 bg-black/50 z-30 lg:hidden"
          onClick={onClose}
          aria-hidden
        />
      )}

      <aside className={cn(
        'fixed lg:sticky top-0 z-40 w-60 bg-gray-900 text-white flex flex-col h-screen shrink-0 transition-transform',
        'lg:translate-x-0',
        open ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
      )}>
        <div className="px-4 py-5 border-b border-gray-700 flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center shrink-0">
              <ShieldCheck className="w-4 h-4 text-white" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold leading-tight truncate">QA System</p>
              <p className="text-xs text-gray-400 truncate">Cranberry / ASAP</p>
            </div>
          </div>
          <button onClick={onClose} className="lg:hidden p-1 rounded hover:bg-gray-800" aria-label="Close menu">
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="flex-1 px-3 py-4 overflow-y-auto">
          {/* Main */}
          <div className="flex flex-col gap-0.5">
            {mainItems.map(({ to, icon: Icon, label }) => (
              <NavLink
                key={to}
                to={to}
                end={to === '/'}
                onClick={onClose}
                className={({ isActive }) => cn(
                  'flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors',
                  isActive ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white hover:bg-gray-800',
                )}
              >
                <Icon className="w-4 h-4 shrink-0" />
                {label}
              </NavLink>
            ))}
          </div>

          {/* QA — Complaints + Inspections always visible; Inbox only for QA roles */}
          <div className="mt-6">
            <p className="px-3 mb-1 text-xs font-semibold text-gray-500 uppercase tracking-wider">QA</p>
            <div className="flex flex-col gap-0.5">
              {qaItems
                .filter(item => item.everyone || appUser?.role === 'admin' || appUser?.role === 'qa' || appUser?.role === 'manager')
                .map(({ to, icon: Icon, label }) => (
                  <NavLink
                    key={to}
                    to={to}
                    onClick={onClose}
                    className={({ isActive }) => cn(
                      'flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors',
                      isActive ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white hover:bg-gray-800',
                    )}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    {label}
                  </NavLink>
                ))}
            </div>
          </div>

          {/* Data */}
          <div className="mt-6">
            <p className="px-3 mb-1 text-xs font-semibold text-gray-500 uppercase tracking-wider">Data</p>
            <div className="flex flex-col gap-0.5">
              {dataItems.map(({ to, icon: Icon, label }) => (
                <NavLink
                  key={to}
                  to={to}
                  onClick={onClose}
                  className={({ isActive }) => cn(
                    'flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors',
                    isActive ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white hover:bg-gray-800',
                  )}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  {label}
                </NavLink>
              ))}
            </div>
          </div>

          {/* Admin */}
          {appUser?.role === 'admin' && (
            <div className="mt-6">
              <p className="px-3 mb-1 text-xs font-semibold text-gray-500 uppercase tracking-wider">Admin</p>
              <div className="flex flex-col gap-0.5">
                {adminItems.map(({ to, icon: Icon, label }) => (
                  <NavLink
                    key={to}
                    to={to}
                    onClick={onClose}
                    className={({ isActive }) => cn(
                      'flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors',
                      isActive ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white hover:bg-gray-800',
                    )}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    {label}
                  </NavLink>
                ))}
              </div>
            </div>
          )}
        </nav>

        <div className="px-3 py-4 border-t border-gray-700">
          <div className="flex items-center gap-3 mb-3 px-3">
            <div className="w-7 h-7 bg-gray-600 rounded-full flex items-center justify-center shrink-0">
              <span className="text-xs font-medium">{appUser?.name?.[0]?.toUpperCase() ?? '?'}</span>
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium truncate">{appUser?.name}</p>
              <p className="text-xs text-gray-400 truncate">{appUser?.role ? ROLE_LABELS[appUser.role] : ''}</p>
            </div>
          </div>
          <button
            onClick={logOut}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
          >
            <LogOut className="w-4 h-4 shrink-0" />
            Sign out
          </button>
        </div>
      </aside>
    </>
  );
}
