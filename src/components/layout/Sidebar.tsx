import { NavLink } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { ROLE_LABELS } from '@/types';
import {
  LayoutDashboard, FileText, ClipboardList,
  Settings, LogOut, ShieldCheck, Users, Inbox,
} from 'lucide-react';

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/complaints', icon: FileText, label: 'Complaints' },
  { to: '/inspections', icon: ClipboardList, label: 'Inspections' },
];

const qaItems = [
  { to: '/inbox', icon: Inbox, label: 'Inbox' },
];

const adminItems = [
  { to: '/users', icon: Users, label: 'Users' },
  { to: '/settings', icon: Settings, label: 'Settings' },
];

export function Sidebar() {
  const { appUser, logOut } = useAuth();

  return (
    <aside className="w-60 bg-gray-900 text-white flex flex-col h-screen sticky top-0 shrink-0">
      <div className="px-4 py-5 border-b border-gray-700">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center shrink-0">
            <ShieldCheck className="w-4 h-4 text-white" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold leading-tight truncate">QA System</p>
            <p className="text-xs text-gray-400 truncate">Cranberry / ASAP</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 px-3 py-4 overflow-y-auto">
        <div className="flex flex-col gap-0.5">
          {navItems.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
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

        {(appUser?.role === 'admin' || appUser?.role === 'qa') && (
          <div className="mt-6">
            <p className="px-3 mb-1 text-xs font-semibold text-gray-500 uppercase tracking-wider">QA</p>
            <div className="flex flex-col gap-0.5">
              {qaItems.map(({ to, icon: Icon, label }) => (
                <NavLink
                  key={to}
                  to={to}
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

        {(appUser?.role === 'admin') && (
          <div className="mt-6">
            <p className="px-3 mb-1 text-xs font-semibold text-gray-500 uppercase tracking-wider">Admin</p>
            <div className="flex flex-col gap-0.5">
              {adminItems.map(({ to, icon: Icon, label }) => (
                <NavLink
                  key={to}
                  to={to}
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
  );
}
