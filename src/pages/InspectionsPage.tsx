import { useEffect, useState, useCallback } from 'react';
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
import { Plus, Search, Eye, Pencil } from 'lucide-react';

const STATUS_FILTERS: { value: '' | InspectionStatus; label: string }[] = [
  { value: '', label: 'All' },
  { value: 'pending', label: 'Pending' },
  { value: 'accepted', label: 'Accepted' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'passed', label: 'Passed' },
  { value: 'failed', label: 'Failed' },
  { value: 'rescheduled', label: 'Rescheduled' },
];

export function InspectionsPage() {
  const { appUser } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [inspections, setInspections] = useState<Inspection[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Inspection | undefined>();
  const [search, setSearch] = useState('');
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
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Inspections</h1>
          <p className="text-gray-500 mt-0.5">{inspections.length} total</p>
        </div>
        {canEdit && (
          <Button onClick={() => { setEditing(undefined); setShowForm(true); }}>
            <Plus className="w-4 h-4" /> New Request
          </Button>
        )}
      </div>

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
