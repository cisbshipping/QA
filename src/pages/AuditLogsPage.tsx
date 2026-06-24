import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { getAuditLogs } from '@/lib/db';
import type { AuditLog } from '@/types';
import { Card } from '@/components/ui/Card';
import { fmtDateTime } from '@/lib/utils';
import { FileSearch, User as UserIcon } from 'lucide-react';

const TYPE_FILTERS: { value: '' | AuditLog['targetType']; label: string }[] = [
  { value: '', label: 'All' },
  { value: 'complaint', label: 'Complaints' },
  { value: 'inspection', label: 'Inspections' },
  { value: 'user', label: 'Users' },
];

const ACTION_COLOR: Record<string, string> = {
  created: 'bg-blue-100 text-blue-800',
  updated: 'bg-gray-100 text-gray-700',
  edited: 'bg-gray-100 text-gray-700',
  accepted: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
  closed: 'bg-purple-100 text-purple-800',
  passed: 'bg-green-100 text-green-800',
  failed: 'bg-red-100 text-red-800',
  deleted: 'bg-red-100 text-red-800',
};

export function AuditLogsPage() {
  const { appUser } = useAuth();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState<'' | AuditLog['targetType']>('');
  const [search, setSearch] = useState('');

  useEffect(() => {
    setLoading(true);
    getAuditLogs(typeFilter || undefined)
      .then(setLogs)
      .finally(() => setLoading(false));
  }, [typeFilter]);

  if (appUser?.role !== 'admin') {
    return <div className="p-6 text-gray-500">Access denied. Admin only.</div>;
  }

  const filtered = logs.filter(l => {
    const q = search.toLowerCase();
    return !q || l.userName.toLowerCase().includes(q) || l.action.toLowerCase().includes(q) || l.targetId.toLowerCase().includes(q);
  });

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <FileSearch className="w-6 h-6" /> Audit Logs
        </h1>
        <p className="text-gray-500 mt-0.5">Every record change is logged here. {logs.length} entries shown.</p>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <input
          type="text"
          placeholder="Search by user, action, or target ID..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="flex-1 max-w-sm px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <div className="flex flex-wrap gap-1">
          {TYPE_FILTERS.map(f => (
            <button
              key={f.value}
              onClick={() => setTypeFilter(f.value)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${typeFilter === f.value ? 'bg-blue-600 text-white' : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'}`}
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
          <div className="py-16 text-center text-gray-500 text-sm">No audit log entries match your filters.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="text-left px-4 py-3 font-medium text-gray-600">When</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Who</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Action</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Target</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map(l => (
                  <tr key={l.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{fmtDateTime(l.timestamp)}</td>
                    <td className="px-4 py-3 text-gray-900">
                      <span className="inline-flex items-center gap-1">
                        <UserIcon className="w-3.5 h-3.5 text-gray-400" />
                        {l.userName}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${ACTION_COLOR[l.action] ?? 'bg-gray-100 text-gray-700'}`}>
                        {l.action}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      <span className="capitalize">{l.targetType}</span> · <span className="font-mono text-xs">{l.targetId.slice(0, 8)}</span>
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs max-w-xs truncate" title={l.details}>{l.details ?? ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
