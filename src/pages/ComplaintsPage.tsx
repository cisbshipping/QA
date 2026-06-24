import { useEffect, useState, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { getComplaintsPage, deleteComplaint, updateComplaint } from '@/lib/db';
import type { QueryDocumentSnapshot, DocumentData } from 'firebase/firestore';
import { type Complaint, type ComplaintStatus } from '@/types';
import { useAuth } from '@/hooks/useAuth';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { StatusBadge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { ComplaintForm } from '@/components/forms/ComplaintForm';
import { fmtDate } from '@/lib/utils';
import { Plus, Search, Trash2, Eye, Pencil, Lock, X } from 'lucide-react';

const STATUS_FILTERS: { value: '' | ComplaintStatus; label: string }[] = [
  { value: '', label: 'All' },
  { value: 'open', label: 'Open' },
  { value: 'accepted', label: 'Accepted' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'closed', label: 'Closed' },
];

export function ComplaintsPage() {
  const { user, appUser } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [cursor, setCursor] = useState<QueryDocumentSnapshot<DocumentData> | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Complaint | undefined>();
  const [search, setSearch] = useState('');
  const statusFilter = (searchParams.get('status') ?? '') as '' | ComplaintStatus;
  const PAGE_SIZE = 50;
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkLoading, setBulkLoading] = useState(false);

  const toggle = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelected(next);
  };

  const toggleAll = (ids: string[]) => {
    if (ids.every(id => selected.has(id))) setSelected(new Set());
    else setSelected(new Set(ids));
  };

  const load = useCallback(async () => {
    setLoading(true);
    const res = await getComplaintsPage(PAGE_SIZE);
    setComplaints(res.items);
    setCursor(res.cursor);
    setHasMore(res.hasMore);
    setLoading(false);
  }, []);

  const loadMore = async () => {
    if (!cursor || loadingMore) return;
    setLoadingMore(true);
    const res = await getComplaintsPage(PAGE_SIZE, cursor);
    setComplaints(prev => [...prev, ...res.items]);
    setCursor(res.cursor);
    setHasMore(res.hasMore);
    setLoadingMore(false);
  };

  useEffect(() => { load(); }, [load]);

  const filtered = complaints.filter(c => {
    const matchStatus = !statusFilter || c.status === statusFilter;
    const q = search.toLowerCase();
    const matchSearch = !q || c.complaintNo.toLowerCase().includes(q) || c.consignee.toLowerCase().includes(q)
      || c.piNo.toLowerCase().includes(q) || c.factory.toLowerCase().includes(q) || c.productName.toLowerCase().includes(q);
    return matchStatus && matchSearch;
  });

  const handleDelete = async (c: Complaint) => {
    if (!user || !appUser) return;
    if (!confirm(`Delete complaint ${c.complaintNo}? This cannot be undone.`)) return;
    await deleteComplaint(c.id, user.uid, appUser.name);
    load();
  };

  const canEdit = appUser?.role === 'admin' || appUser?.role === 'qa' || appUser?.role === 'manager';
  const canDelete = appUser?.role === 'admin';

  const bulkClose = async () => {
    if (!user || !appUser) return;
    if (!confirm(`Mark ${selected.size} complaint(s) as closed?`)) return;
    setBulkLoading(true);
    for (const id of selected) {
      await updateComplaint(id, { status: 'closed', closedAt: new Date() }, user.uid, appUser.name, 'closed');
    }
    setSelected(new Set());
    setBulkLoading(false);
    load();
  };

  const bulkDelete = async () => {
    if (!user || !appUser) return;
    if (!confirm(`PERMANENTLY DELETE ${selected.size} complaint(s)? This cannot be undone.`)) return;
    setBulkLoading(true);
    for (const id of selected) {
      await deleteComplaint(id, user.uid, appUser.name);
    }
    setSelected(new Set());
    setBulkLoading(false);
    load();
  };

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Complaints</h1>
          <p className="text-gray-500 mt-0.5">{complaints.length} total</p>
        </div>
        {canEdit && (
          <Button onClick={() => { setEditing(undefined); setShowForm(true); }} className="gap-2">
            <Plus className="w-4 h-4" /> New Complaint
          </Button>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text" placeholder="Search by complaint no., consignee, PI no..."
            value={search} onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div className="flex gap-1">
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

      {/* Bulk actions */}
      {selected.size > 0 && (
        <div className="flex flex-wrap items-center gap-2 mb-3 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 text-sm">
          <span className="text-blue-900 font-medium">{selected.size} selected</span>
          <button onClick={() => setSelected(new Set())} className="text-xs text-blue-700 hover:underline flex items-center gap-1">
            <X className="w-3 h-3" /> clear
          </button>
          <div className="ml-auto flex gap-2">
            {canEdit && (
              <Button variant="outline" size="sm" loading={bulkLoading} onClick={bulkClose}>
                <Lock className="w-4 h-4" /> Close all
              </Button>
            )}
            {canDelete && (
              <Button variant="danger" size="sm" loading={bulkLoading} onClick={bulkDelete}>
                <Trash2 className="w-4 h-4" /> Delete all
              </Button>
            )}
          </div>
        </div>
      )}

      <Card>
        {loading ? (
          <div className="flex items-center justify-center h-40">
            <div className="w-7 h-7 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center text-gray-500">
            <FileTextIcon />
            <p className="mt-2 text-sm">No complaints found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  {canEdit && (
                    <th className="w-10 px-3">
                      <input
                        type="checkbox"
                        className="w-4 h-4 rounded text-blue-600"
                        checked={filtered.length > 0 && filtered.every(c => selected.has(c.id))}
                        onChange={() => toggleAll(filtered.map(c => c.id))}
                        aria-label="Select all"
                      />
                    </th>
                  )}
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Complaint No.</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Consignee</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">PI No.</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Factory</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Date</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map(c => (
                  <tr key={c.id} className="hover:bg-gray-50">
                    {canEdit && (
                      <td className="px-3">
                        <input
                          type="checkbox"
                          className="w-4 h-4 rounded text-blue-600"
                          checked={selected.has(c.id)}
                          onChange={() => toggle(c.id)}
                          aria-label={`Select ${c.complaintNo}`}
                        />
                      </td>
                    )}
                    <td className="px-4 py-3 font-mono text-blue-700 font-medium">{c.complaintNo}</td>
                    <td className="px-4 py-3 text-gray-900">{c.consignee}</td>
                    <td className="px-4 py-3 text-gray-600">{c.piNo}</td>
                    <td className="px-4 py-3 text-gray-600">{c.factory}</td>
                    <td className="px-4 py-3 text-gray-500">{fmtDate(c.dateRecorded)}</td>
                    <td className="px-4 py-3"><StatusBadge status={c.status} /></td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <Link to={`/complaints/${c.id}`} className="p-1.5 rounded hover:bg-gray-100 text-gray-500" title="View">
                          <Eye className="w-4 h-4" />
                        </Link>
                        {canEdit && (
                          <button onClick={() => { setEditing(c); setShowForm(true); }} className="p-1.5 rounded hover:bg-gray-100 text-gray-500" title="Edit">
                            <Pencil className="w-4 h-4" />
                          </button>
                        )}
                        {canDelete && (
                          <button onClick={() => handleDelete(c)} className="p-1.5 rounded hover:bg-red-50 text-red-500" title="Delete">
                            <Trash2 className="w-4 h-4" />
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

      {hasMore && (
        <div className="flex justify-center mt-4">
          <Button variant="outline" loading={loadingMore} onClick={loadMore}>
            Load more
          </Button>
        </div>
      )}


      <Modal open={showForm} onClose={() => setShowForm(false)} title={editing ? 'Edit Complaint' : 'New Complaint'} size="2xl">
        <ComplaintForm
          existing={editing}
          onSuccess={() => { setShowForm(false); load(); }}
          onCancel={() => setShowForm(false)}
        />
      </Modal>
    </div>
  );
}

function FileTextIcon() {
  return (
    <div className="flex justify-center">
      <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center">
        <svg className="w-6 h-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      </div>
    </div>
  );
}
