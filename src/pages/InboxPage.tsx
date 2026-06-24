import { useEffect, useState } from 'react';
import { listPublicSubmissions, updatePublicSubmission } from '@/lib/db';
import type { PublicSubmission, PublicSubmissionStatus } from '@/types';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardBody } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Textarea } from '@/components/ui/Input';
import { fmtDate, fmtDateTime, getSharePointFolderUrl } from '@/lib/utils';
import { Inbox, FileText, ClipboardList, Check, X, Mail, Phone, ExternalLink } from 'lucide-react';

const STATUS_FILTERS: { value: '' | PublicSubmissionStatus; label: string }[] = [
  { value: '', label: 'All' },
  { value: 'new', label: 'New' },
  { value: 'processed', label: 'Processed' },
  { value: 'dismissed', label: 'Dismissed' },
];

const STATUS_COLORS: Record<PublicSubmissionStatus, string> = {
  new: 'bg-blue-100 text-blue-800',
  processed: 'bg-green-100 text-green-800',
  dismissed: 'bg-gray-100 text-gray-600',
};

export function InboxPage() {
  const { appUser } = useAuth();
  const [submissions, setSubmissions] = useState<PublicSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<PublicSubmission | null>(null);
  const [action, setAction] = useState<PublicSubmissionStatus | null>(null);
  const [notes, setNotes] = useState('');
  const [filter, setFilter] = useState<'' | PublicSubmissionStatus>('new');
  const [actionLoading, setActionLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    setSubmissions(await listPublicSubmissions());
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const canReview = appUser?.role === 'admin' || appUser?.role === 'qa' || appUser?.role === 'manager';
  if (!canReview) return <div className="p-6 text-gray-500">Access denied.</div>;

  const filtered = submissions.filter(s => !filter || s.status === filter);
  const newCount = submissions.filter(s => s.status === 'new').length;

  const handleAction = async () => {
    if (!selected || !action || !appUser) return;
    setActionLoading(true);
    await updatePublicSubmission(selected.id, action, appUser.name, notes);
    setSelected(null);
    setAction(null);
    setNotes('');
    load();
    setActionLoading(false);
  };

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Inbox className="w-6 h-6" /> Public Submissions
          </h1>
          <p className="text-gray-500 mt-0.5">{newCount} new · {submissions.length} total</p>
        </div>
      </div>

      <div className="flex gap-1 mb-4">
        {STATUS_FILTERS.map(f => (
          <button key={f.value} onClick={() => setFilter(f.value)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${filter === f.value ? 'bg-blue-600 text-white' : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'}`}>
            {f.label}
          </button>
        ))}
      </div>

      <Card>
        {loading ? (
          <div className="flex items-center justify-center h-40">
            <div className="w-7 h-7 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center text-gray-500 text-sm">No submissions found</div>
        ) : (
          <div className="divide-y divide-gray-100">
            {filtered.map(s => (
              <button
                key={s.id}
                onClick={() => setSelected(s)}
                className="w-full text-left px-6 py-4 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3 min-w-0 flex-1">
                    {s.type === 'complaint'
                      ? <FileText className="w-5 h-5 text-red-500 mt-0.5 shrink-0" />
                      : <ClipboardList className="w-5 h-5 text-blue-500 mt-0.5 shrink-0" />}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-mono font-semibold text-blue-700">{s.referenceNo}</p>
                        <span className={`px-2 py-0.5 text-xs font-medium rounded-full capitalize ${STATUS_COLORS[s.status]}`}>{s.status}</span>
                        <span className="text-xs text-gray-500 capitalize">{s.type}</span>
                      </div>
                      <p className="text-sm text-gray-900 mt-1">{s.submitterName} · {s.submitterCompany}</p>
                      <p className="text-xs text-gray-500 mt-0.5 truncate">{s.description}</p>
                    </div>
                  </div>
                  <p className="text-xs text-gray-500 whitespace-nowrap">{fmtDate(s.createdAt)}</p>
                </div>
              </button>
            ))}
          </div>
        )}
      </Card>

      {/* Detail modal */}
      <Modal open={!!selected} onClose={() => setSelected(null)} title={selected ? `${selected.type === 'complaint' ? 'Complaint' : 'Inspection'} Submission` : ''} size="xl">
        {selected && (
          <>
            <CardBody className="flex flex-col gap-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-2xl font-mono font-bold text-blue-700">{selected.referenceNo}</p>
                  <p className="text-sm text-gray-500">Submitted {fmtDateTime(selected.createdAt)}</p>
                </div>
                <span className={`px-2.5 py-1 text-xs font-medium rounded-full capitalize ${STATUS_COLORS[selected.status]}`}>{selected.status}</span>
              </div>

              <fieldset className="border border-gray-200 rounded-lg p-4">
                <legend className="px-2 text-sm font-semibold text-gray-700">Submitter</legend>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                  <div><dt className="text-xs text-gray-500">Name</dt><dd className="text-gray-900">{selected.submitterName}</dd></div>
                  <div><dt className="text-xs text-gray-500">Company</dt><dd className="text-gray-900">{selected.submitterCompany}</dd></div>
                  <div className="flex items-center gap-2 text-blue-600">
                    <Mail className="w-4 h-4" />
                    <a href={`mailto:${selected.submitterEmail}`} className="hover:underline">{selected.submitterEmail}</a>
                  </div>
                  {selected.submitterPhone && (
                    <div className="flex items-center gap-2 text-blue-600">
                      <Phone className="w-4 h-4" />
                      <a href={`tel:${selected.submitterPhone}`} className="hover:underline">{selected.submitterPhone}</a>
                    </div>
                  )}
                </div>
              </fieldset>

              <fieldset className="border border-gray-200 rounded-lg p-4">
                <legend className="px-2 text-sm font-semibold text-gray-700">Details</legend>
                <dl className="flex flex-col gap-3 text-sm">
                  {selected.type === 'inspection' && (
                    <>
                      {selected.ylCompany && <div><dt className="text-xs text-gray-500">Company (entity)</dt><dd className="text-gray-900">{selected.ylCompany}</dd></div>}
                      {selected.productInfo && <div><dt className="text-xs text-gray-500">Product Info</dt><dd className="text-gray-900">{selected.productInfo}</dd></div>}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div><dt className="text-xs text-gray-500">Customer PI No.</dt><dd className="text-gray-900">{selected.customerPiNo}</dd></div>
                        <div><dt className="text-xs text-gray-500">Factory</dt><dd className="text-gray-900">{selected.factoryLocation}</dd></div>
                        <div><dt className="text-xs text-gray-500">Commit Date</dt><dd className="text-gray-900">{fmtDate(selected.factoryCommitDate)}</dd></div>
                        <div><dt className="text-xs text-gray-500">Qty (Cartons)</dt><dd className="text-gray-900">{selected.totalQtyCartons?.toLocaleString()}</dd></div>
                      </div>
                    </>
                  )}
                  {selected.type === 'complaint' && (
                    <>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div><dt className="text-xs text-gray-500">Factory / Supplier</dt><dd className="text-gray-900">{selected.factorySupplier ?? '—'}</dd></div>
                        <div><dt className="text-xs text-gray-500">Brand Name</dt><dd className="text-gray-900">{selected.brandName ?? '—'}</dd></div>
                        <div className="col-span-2"><dt className="text-xs text-gray-500">Product Name</dt><dd className="text-gray-900">{selected.productName ?? '—'}</dd></div>
                        <div><dt className="text-xs text-gray-500">PI No.</dt><dd className="text-gray-900">{selected.piNo ?? '—'}</dd></div>
                        <div><dt className="text-xs text-gray-500">PO No.</dt><dd className="text-gray-900">{selected.poNo ?? '—'}</dd></div>
                        <div><dt className="text-xs text-gray-500">Lot No.</dt><dd className="text-gray-900">{selected.lotNo ?? '—'}</dd></div>
                        <div><dt className="text-xs text-gray-500">Size</dt><dd className="text-gray-900">{selected.size ?? '—'}</dd></div>
                        <div className="col-span-2"><dt className="text-xs text-gray-500">Quantity Involved</dt><dd className="text-gray-900">{selected.quantityInvolved ?? '—'}</dd></div>
                        <div><dt className="text-xs text-gray-500">Defective Sample Photo</dt><dd className="text-gray-900">{selected.hasDefectiveSamplePhoto ? 'Yes' : 'No'}</dd></div>
                        <div><dt className="text-xs text-gray-500">Defective Sample Return</dt><dd className="text-gray-900">{selected.hasDefectiveSampleReturn ? `Yes (${selected.returnSampleQty ?? '?'})` : 'No'}</dd></div>
                      </div>
                      {selected.natures && selected.natures.length > 0 && (
                        <div>
                          <dt className="text-xs text-gray-500 mb-1">Nature of Complaint</dt>
                          <dd className="flex flex-wrap gap-1">
                            {selected.natures.map(n => (
                              <span key={n} className="px-2 py-0.5 bg-red-50 text-red-700 text-xs rounded-full">{n}</span>
                            ))}
                            {selected.othersDescription && <span className="px-2 py-0.5 bg-orange-50 text-orange-700 text-xs rounded-full">Others: {selected.othersDescription}</span>}
                          </dd>
                        </div>
                      )}
                    </>
                  )}
                  <div><dt className="text-xs text-gray-500 mb-1">Description</dt>
                    <dd className="text-gray-900 whitespace-pre-wrap">{selected.description}</dd></div>
                </dl>
              </fieldset>

              {selected.photos && selected.photos.length > 0 && (
                <fieldset className="border border-gray-200 rounded-lg p-4">
                  <legend className="px-2 text-sm font-semibold text-gray-700">Photos ({selected.photos.length})</legend>
                  {getSharePointFolderUrl(selected.photos[0].downloadUrl) && (
                    <a
                      href={getSharePointFolderUrl(selected.photos[0].downloadUrl)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-sm text-blue-600 hover:underline mb-2"
                    >
                      <ExternalLink className="w-4 h-4" /> Open folder in SharePoint
                    </a>
                  )}
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                    {selected.photos.map((p, i) => (
                      <a key={i} href={p.downloadUrl} target="_blank" rel="noopener noreferrer"
                        className="relative group rounded-lg overflow-hidden border border-gray-200 bg-gray-50 aspect-square block">
                        <img src={p.downloadUrl} alt={p.name} className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                          <ExternalLink className="w-5 h-5 text-white" />
                        </div>
                      </a>
                    ))}
                  </div>
                  <p className="text-xs text-gray-500 mt-3">
                    Stored in Firebase Storage.
                    {selected.photos.some(p => p.syncedToOneDrive)
                      ? ' Mirrored to shared OneDrive.'
                      : ' Will be mirrored to shared OneDrive once the sync backend is active.'}
                  </p>
                </fieldset>
              )}

              {selected.status !== 'new' && selected.processedBy && (
                <div className="bg-gray-50 rounded-lg p-3 text-sm">
                  <p className="text-xs text-gray-500">Processed by {selected.processedBy} on {fmtDateTime(selected.processedAt)}</p>
                  {selected.notes && <p className="text-gray-700 mt-1">{selected.notes}</p>}
                </div>
              )}

              {selected.status === 'new' && action && (
                <Textarea label={`Notes for ${action === 'processed' ? 'processing' : 'dismissal'}`} value={notes} onChange={e => setNotes(e.target.value)} rows={3} />
              )}
            </CardBody>

            {selected.status === 'new' && (
              <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 rounded-b-xl flex justify-end gap-3">
                {!action && (
                  <>
                    <Button variant="outline" onClick={() => setAction('dismissed')}><X className="w-4 h-4" /> Dismiss</Button>
                    <Button onClick={() => setAction('processed')}><Check className="w-4 h-4" /> Mark as Processed</Button>
                  </>
                )}
                {action && (
                  <>
                    <Button variant="outline" onClick={() => { setAction(null); setNotes(''); }}>Cancel</Button>
                    <Button
                      variant={action === 'dismissed' ? 'danger' : 'primary'}
                      loading={actionLoading}
                      onClick={handleAction}
                    >
                      Confirm {action === 'processed' ? 'Process' : 'Dismiss'}
                    </Button>
                  </>
                )}
              </div>
            )}
          </>
        )}
      </Modal>
    </div>
  );
}
