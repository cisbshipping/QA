import { useEffect, useState, useCallback, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { getInspections } from '@/lib/db';
import { type Inspection, type InspectionStatus } from '@/types';
import { useAuth } from '@/hooks/useAuth';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { StatusBadge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { InspectionForm } from '@/components/forms/InspectionForm';
import { fmtDate } from '@/lib/utils';
import { Plus, Search, Eye, Pencil, List, Calendar as CalIcon, ChevronLeft, ChevronRight } from 'lucide-react';
import {
  startOfMonth, endOfMonth, eachDayOfInterval, getDay, addMonths, subMonths,
  isSameMonth, isSameDay, isToday, format, startOfDay,
} from 'date-fns';

const STATUS_FILTERS: { value: '' | InspectionStatus; label: string }[] = [
  { value: '', label: 'All' },
  { value: 'pending', label: 'Pending' },
  { value: 'accepted', label: 'Accepted' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'passed', label: 'Passed' },
  { value: 'failed', label: 'Failed' },
  { value: 'rescheduled', label: 'Rescheduled' },
];

type View = 'list' | 'calendar';

export function InspectionsPage() {
  const { appUser } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [inspections, setInspections] = useState<Inspection[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Inspection | undefined>();
  const [search, setSearch] = useState('');
  const [view, setView] = useState<View>('list');
  const statusFilter = (searchParams.get('status') ?? '') as '' | InspectionStatus;

  const load = useCallback(async () => {
    setLoading(true);
    const data = await getInspections();
    setInspections(data);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = inspections.filter(i => {
    const matchStatus = !statusFilter || i.status === statusFilter;
    const q = search.toLowerCase();
    const matchSearch = !q || i.customerPiNo.toLowerCase().includes(q) || i.customer.toLowerCase().includes(q)
      || i.factory.toLowerCase().includes(q) || i.supplierPoNo.toLowerCase().includes(q);
    return matchStatus && matchSearch;
  });

  const canEdit = appUser?.role === 'admin' || appUser?.role === 'qa' || appUser?.role === 'manager';

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Inspections</h1>
          <p className="text-gray-500 mt-0.5">{inspections.length} total</p>
        </div>
        <div className="flex items-center gap-2">
          {/* View toggle */}
          <div className="inline-flex bg-gray-100 rounded-lg p-0.5">
            <button
              onClick={() => setView('list')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${view === 'list' ? 'bg-white shadow text-gray-900' : 'text-gray-500'}`}
            >
              <List className="w-4 h-4" /> List
            </button>
            <button
              onClick={() => setView('calendar')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${view === 'calendar' ? 'bg-white shadow text-gray-900' : 'text-gray-500'}`}
            >
              <CalIcon className="w-4 h-4" /> Calendar
            </button>
          </div>

          {canEdit && (
            <Button onClick={() => { setEditing(undefined); setShowForm(true); }}>
              <Plus className="w-4 h-4" /> New Request
            </Button>
          )}
        </div>
      </div>

      {view === 'list' ? (
        <>
          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-3 mb-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text" placeholder="Search by PI no., customer, factory..."
                value={search} onChange={e => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="flex flex-wrap gap-1">
              {STATUS_FILTERS.map(f => (
                <button
                  key={f.value}
                  onClick={() => setSearchParams(f.value ? { status: f.value } : {})}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${statusFilter === f.value ? 'bg-blue-600 text-white' : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'}`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          <Card>
            {loading ? (
              <div className="flex items-center justify-center h-40">
                <div className="w-7 h-7 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : filtered.length === 0 ? (
              <div className="py-16 text-center text-gray-500 text-sm">No inspection requests found</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 bg-gray-50">
                      <th className="text-left px-4 py-3 font-medium text-gray-600">PI No.</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-600">Customer</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-600">Factory</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-600">Commit Date</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-600">Inspection Date</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-600">Qty (Ctns)</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-600">AQL</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
                      <th className="text-right px-4 py-3 font-medium text-gray-600">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filtered.map(i => (
                      <tr key={i.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 font-mono text-blue-700 font-medium">{i.customerPiNo}</td>
                        <td className="px-4 py-3 text-gray-900">{i.customer}</td>
                        <td className="px-4 py-3 text-gray-600">{i.factory}</td>
                        <td className="px-4 py-3 text-gray-500">{fmtDate(i.factoryCommitDate)}</td>
                        <td className="px-4 py-3 text-gray-700 font-medium">{fmtDate(i.rescheduledDate ?? i.inspectionDate)}</td>
                        <td className="px-4 py-3 text-gray-600">{i.totalQtyCartons.toLocaleString()}</td>
                        <td className="px-4 py-3 text-gray-600">{i.aqlLevel}</td>
                        <td className="px-4 py-3"><StatusBadge status={i.status} /></td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1">
                            <Link to={`/inspections/${i.id}`} className="p-1.5 rounded hover:bg-gray-100 text-gray-500" title="View">
                              <Eye className="w-4 h-4" />
                            </Link>
                            {canEdit && i.status === 'pending' && (
                              <button onClick={() => { setEditing(i); setShowForm(true); }} className="p-1.5 rounded hover:bg-gray-100 text-gray-500" title="Edit">
                                <Pencil className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </>
      ) : (
        <InspectionCalendar inspections={inspections} loading={loading} />
      )}

      <Modal open={showForm} onClose={() => setShowForm(false)} title={editing ? 'Edit Inspection Request' : 'New Inspection Request'} size="2xl">
        <InspectionForm
          existing={editing}
          onSuccess={() => { setShowForm(false); load(); }}
          onCancel={() => setShowForm(false)}
        />
      </Modal>
    </div>
  );
}

// ---------------- Calendar ----------------

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const STATUS_DOT: Record<InspectionStatus, string> = {
  pending: 'bg-yellow-400',
  accepted: 'bg-blue-500',
  rejected: 'bg-gray-400',
  passed: 'bg-green-500',
  failed: 'bg-red-500',
  rescheduled: 'bg-orange-500',
};

function InspectionCalendar({ inspections, loading }: { inspections: Inspection[]; loading: boolean }) {
  const [cursor, setCursor] = useState(() => startOfMonth(new Date()));

  // Group inspections by date (use rescheduledDate if present, else inspectionDate, else commit date)
  const byDate = useMemo(() => {
    const map = new Map<string, Inspection[]>();
    for (const i of inspections) {
      const d = i.rescheduledDate ?? i.inspectionDate;
      if (!d) continue;
      const key = format(startOfDay(d), 'yyyy-MM-dd');
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(i);
    }
    return map;
  }, [inspections]);

  const start = startOfMonth(cursor);
  const end = endOfMonth(cursor);
  const leadingBlanks = getDay(start); // 0 = Sunday
  const days = eachDayOfInterval({ start, end });

  // Build 6-row x 7-col grid (max possible)
  const cells: (Date | null)[] = [
    ...Array(leadingBlanks).fill(null),
    ...days,
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const monthLabel = format(cursor, 'MMMM yyyy');
  const upcomingCount = Array.from(byDate.values()).flat().filter(i =>
    isSameMonth(i.rescheduledDate ?? i.inspectionDate!, cursor)
  ).length;

  return (
    <Card>
      {/* Calendar header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
        <div className="flex items-center gap-2">
          <button onClick={() => setCursor(c => subMonths(c, 1))} className="p-1.5 rounded hover:bg-gray-100">
            <ChevronLeft className="w-4 h-4 text-gray-600" />
          </button>
          <h2 className="text-base font-semibold text-gray-900 w-40 text-center">{monthLabel}</h2>
          <button onClick={() => setCursor(c => addMonths(c, 1))} className="p-1.5 rounded hover:bg-gray-100">
            <ChevronRight className="w-4 h-4 text-gray-600" />
          </button>
          <button onClick={() => setCursor(startOfMonth(new Date()))} className="ml-2 px-2 py-1 rounded text-xs text-blue-700 hover:bg-blue-50 font-medium">
            Today
          </button>
        </div>
        <p className="text-xs text-gray-500">{upcomingCount} inspection(s) this month</p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="w-7 h-7 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {/* Day headers */}
          <div className="grid grid-cols-7 border-b border-gray-200 bg-gray-50">
            {DAY_LABELS.map(d => (
              <div key={d} className="px-2 py-2 text-xs font-medium text-gray-500 text-center">{d}</div>
            ))}
          </div>

          {/* Cells */}
          <div className="grid grid-cols-7">
            {cells.map((day, idx) => {
              if (!day) return <div key={idx} className="min-h-28 border-r border-b border-gray-100 bg-gray-50/30" />;
              const key = format(day, 'yyyy-MM-dd');
              const items = byDate.get(key) ?? [];
              const isCurrentMonth = isSameMonth(day, cursor);
              return (
                <div
                  key={idx}
                  className={`min-h-16 sm:min-h-28 border-r border-b border-gray-100 p-1 sm:p-1.5 flex flex-col gap-1 ${!isCurrentMonth ? 'bg-gray-50/40 text-gray-400' : ''}`}
                >
                  <div className={`flex items-center justify-end ${isToday(day) ? '' : ''}`}>
                    <span className={`text-xs font-medium ${isToday(day) ? 'bg-blue-600 text-white rounded-full w-5 h-5 flex items-center justify-center' : 'text-gray-600'}`}>
                      {format(day, 'd')}
                    </span>
                  </div>
                  <div className="flex flex-col gap-0.5 flex-1 overflow-hidden">
                    {items.slice(0, 3).map(i => (
                      <Link
                        key={i.id}
                        to={`/inspections/${i.id}`}
                        className="flex items-center gap-1 px-1.5 py-0.5 rounded text-xs bg-blue-50 hover:bg-blue-100 text-blue-900 truncate"
                        title={`${i.factory} - ${i.customer} · PI ${i.customerPiNo}`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${STATUS_DOT[i.status]}`} />
                        <span className="truncate">{i.factory}-{i.customer}</span>
                      </Link>
                    ))}
                    {items.length > 3 && (
                      <span className="text-[10px] text-gray-500 pl-1">+{items.length - 3} more</span>
                    )}
                  </div>
                  {isSameDay(day, new Date()) && items.length === 0 && (
                    <span className="text-[10px] text-blue-600">Today</span>
                  )}
                </div>
              );
            })}
          </div>

          {/* Legend */}
          <div className="flex items-center justify-center gap-4 px-4 py-3 border-t border-gray-200 text-xs text-gray-600 flex-wrap">
            <LegendDot color="bg-yellow-400" label="Pending" />
            <LegendDot color="bg-blue-500" label="Accepted" />
            <LegendDot color="bg-green-500" label="Passed" />
            <LegendDot color="bg-red-500" label="Failed" />
            <LegendDot color="bg-orange-500" label="Rescheduled" />
          </div>
        </>
      )}
    </Card>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`w-2 h-2 rounded-full ${color}`} />
      {label}
    </span>
  );
}
