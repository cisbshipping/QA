import { NavLink } from 'react-router-dom';
import { Home, Inbox, FileText, ClipboardList } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';

interface Tab {
  to: string;
  icon: typeof Home;
  label: string;
  end?: boolean;
  roles?: string[]; // restrict visibility; undefined = everyone
}

const ALL_TABS: Tab[] = [
  { to: '/', icon: Home, label: 'Home', end: true },
  { to: '/inbox', icon: Inbox, label: 'Inbox', roles: ['admin', 'manager', 'qa'] },
  { to: '/complaints', icon: FileText, label: 'Complaints' },
  { to: '/inspections', icon: ClipboardList, label: 'Inspections' },
];

export function MobileBottomNav() {
  const { appUser } = useAuth();
  const tabs = ALL_TABS.filter(t => !t.roles || t.roles.includes(appUser?.role ?? ''));

  return (
    <nav
      className="lg:hidden fixed bottom-0 inset-x-0 z-30 bg-white border-t border-gray-200 shadow-[0_-2px_8px_rgba(0,0,0,0.04)]"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      aria-label="Primary"
    >
      <ul className="flex items-center justify-around gap-1 px-2 py-2">
        {tabs.map(({ to, icon: Icon, label, end }) => (
          <li key={to} className="flex-1">
            <NavLink
              to={to}
              end={end}
              className={({ isActive }) => cn(
                'flex items-center justify-center gap-1.5 rounded-full transition-all',
                'min-h-[44px] px-3 text-sm font-medium',
                isActive
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100',
              )}
              aria-label={label}
            >
              {({ isActive }) => (
                <>
                  <Icon className="w-5 h-5 shrink-0" />
                  {isActive && <span className="whitespace-nowrap">{label}</span>}
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
