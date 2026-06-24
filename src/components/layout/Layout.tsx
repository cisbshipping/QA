import { useEffect, useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { MobileBottomNav } from './MobileBottomNav';
import { Menu } from 'lucide-react';
import { format } from 'date-fns';
import { Logo } from '@/components/ui/Logo';

export function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex-1 min-w-0 flex flex-col">
        {/* Mobile top bar */}
        <header className="lg:hidden sticky top-0 z-20 flex items-center gap-3 px-4 py-2.5 bg-white border-b border-gray-200">
          <button onClick={() => setSidebarOpen(true)} className="p-1.5 -ml-1 rounded hover:bg-gray-100" aria-label="Open menu">
            <Menu className="w-5 h-5 text-gray-700" />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-gray-100 rounded-lg flex items-center justify-center text-gray-700">
              <Logo className="w-5 h-5" />
            </div>
            <p className="text-sm font-semibold text-gray-900">QA System</p>
          </div>
          <div className="ml-auto"><HeaderClock /></div>
        </header>

        {/* Main content — pad bottom on mobile so it isn't hidden behind the bottom nav */}
        <main className="flex-1 min-w-0 overflow-auto pb-20 lg:pb-0">
          <Outlet />
        </main>
      </div>

      <MobileBottomNav />
    </div>
  );
}

function HeaderClock() {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    // Update every second so it visibly ticks. Light-weight — only renders the time text.
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="text-right leading-tight" aria-live="off">
      <p className="text-sm font-semibold text-gray-900 tabular-nums">{format(now, 'h:mm:ss a')}</p>
      <p className="text-[11px] text-gray-500 tabular-nums">{format(now, 'EEE, d MMM yyyy')}</p>
    </div>
  );
}
