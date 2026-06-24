import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { getComplaint, updateComplaint, getLetterhead, listSuppliers, setComplaintEmailSent, appendComplaintReply } from '@/lib/db';
import { generateComplaintPdf, pdfFilename } from '@/lib/pdf';
import type { Supplier, Complaint } from '@/types';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { StatusBadge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { ComplaintForm } from '@/components/forms/ComplaintForm';
import { Textarea, Input } from '@/components/ui/Input';
import { fmtDate, fmtDateTime, getSharePointFolderUrl } from '@/lib/utils';
import { ArrowLeft, Pencil, CheckCircle, XCircle, Lock, Download, Eye, Send, Mail, MessageSquare, Plus, ExternalLink } from 'lucide-react';

function DetailRow({ label, value }: { label: string; value?: string | null | boolean }) {
  if (value === undefined || value === null || value === '') return null;
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</dt>
      <dd className="text-sm text-gray-900">{typeof value === 'boolean' ? (value ? 'Yes' : 'No') : value}</dd>
    </div>
  );
}

export function ComplaintDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, appUser } = useAuth();
  const [complaint, setComplaint] = useState<Complaint | null>(null);
  const [loading, setLoading] = useState(true);
  const [showEdit, setShowEdit] = useState(false);
  const [showReview, setShowReview] = useState<'accept' | 'reject' | null>(null);
  const [reviewNote, setReviewNote] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const load = async () => {
    if (!id) return;
    setLoading(true);
    const data = await getComplaint(id);
    setComplaint(data);
    setLoading(false);
  };

  useEffect(() => { load(); }, [id]);

  const handleReview = async (action: 'accept' | 'reject') => {
    if (!complaint || !user || !appUser) return;
    setActionLoading(true);
    await updateComplaint(
      complaint.id,
      {
        status: action === 'accept' ? 'accepted' : 'rejected',
        reviewNotes: reviewNote,
        reviewedBy: appUser.name,
        reviewedAt: new Date(),
      },
      user.uid, appUser.name, action === 'accept' ? 'accepted' : 'rejected',
    );
    setShowReview(null);
    setReviewNote('');
    load();
    setActionLoading(false);
  };

  const [downloading, setDownloading] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [pdfBlob, setPdfBlob] = useState<Blob | null>(null);
  const [showSend, setShowSend] = useState(false);

  const buildPdf = async () => {
    if (!complaint) throw new Error('Complaint not loaded');
    const lh = complaint.ylCompany ? await getLetterhead(complaint.ylCompany) : null;
    const doc = await generateComplaintPdf(complaint, {
      letterheadDataUrl: lh?.dataUrl,
      pic: appUser?.name,
    });
    return doc;
  };

  const handleDownload = async () => {
    if (!complaint) return;
    setDownloading(true);
    try {
      const doc = await buildPdf();
      doc.save(pdfFilename(complaint));
    } catch (err) {
      alert('Failed to generate PDF: ' + (err as Error).message);
    } finally {
      setDownloading(false);
    }
  };

  const handlePreview = async () => {
    if (!complaint) return;
    setPreviewing(true);
    try {
      const doc = await buildPdf();
      const blob = doc.output('blob') as Blob;
      setPdfBlob(blob);
      const url = URL.createObjectURL(blob);
      setPreviewUrl(url);
    } catch (err) {
      alert('Failed to generate PDF: ' + (err as Error).message);
    } finally {
      setPreviewing(false);
    }
  };

  const closePreview = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setPdfBlob(null);
  };

  // Clean up blob URL on unmount to avoid memory leak
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const [showReply, setShowReply] = useState(false);
  const [replyFrom, setReplyFrom] = useState('');
  const [replyDate, setReplyDate] = useState(new Date().toISOString().slice(0, 10));
  const [replyText, setReplyText] = useState('');
  const [replyLoading, setReplyLoading] = useState(false);

  const handleLogReply = async () => {
    if (!complaint || !user || !appUser) return;
    if (!replyFrom.trim() || !replyText.trim()) return;
    setReplyLoading(true);
    await appendComplaintReply(complaint.id, {
      receivedAt: new Date(replyDate).toISOString(),
      from: replyFrom.trim(),
      message: replyText.trim(),
      loggedBy: appUser.name,
      loggedAt: new Date().toISOString(),
    });
    setShowReply(false);
    setReplyFrom(complaint.factory ?? '');
    setReplyText('');
    setReplyLoading(false);
    load();
  };

  const handleClose = async () => {
    if (!complaint || !user || !appUser) return;
    if (!confirm('Mark this complaint as closed?')) return;
    await updateComplaint(complaint.id, { status: 'closed', closedAt: new Date() }, user.uid, appUser.name, 'closed');
    load();
  };

  const canReview = appUser?.role === 'admin' || appUser?.role === 'qa' || appUser?.role === 'manager';
  const canEdit = canReview;
  const isAdmin = appUser?.role === 'admin';

  const handleReopen = async () => {
    if (!complaint || !user || !appUser) return;
    if (!confirm('Reopen this complaint? Status will go back to Open.')) return;
    const payload = Object.fromEntries(Object.entries({
      status: 'open' as const,
      closedAt: undefined,
    }).filter(([, v]) => v !== undefined));
    await updateComplaint(complaint.id, payload, user.uid, appUser.name, 'admin-reopened');
    load();
  };

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-7 h-7 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" /></div>;
  if (!complaint) return <div className="p-6 text-gray-500">Complaint not found. <Link to="/complaints" className="text-blue-600 hover:underline">Go back</Link></div>;

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate(-1)} className="p-2 rounded-lg hover:bg-gray-100">
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-gray-900 font-mono">{complaint.complaintNo}</h1>
            <StatusBadge status={complaint.status} />
          </div>
          <p className="text-sm text-gray-500 mt-0.5">Recorded by {complaint.recordedBy} on {fmtDate(complaint.dateRecorded)}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" loading={previewing} onClick={handlePreview}>
            <Eye className="w-4 h-4" /> Preview PDF
          </Button>
          <Button variant="outline" size="sm" loading={downloading} onClick={handleDownload}>
            <Download className="w-4 h-4" /> Download PDF
          </Button>
          {canEdit && complaint.status === 'open' && (
            <Button variant="outline" size="sm" onClick={() => setShowEdit(true)}>
              <Pencil className="w-4 h-4" /> Edit
            </Button>
          )}
          {canReview && complaint.status === 'open' && (
            <>
              <Button variant="danger" size="sm" onClick={() => setShowReview('reject')}>
                <XCircle className="w-4 h-4" /> Reject
              </Button>
              <Button size="sm" onClick={() => setShowReview('accept')}>
                <CheckCircle className="w-4 h-4" /> Accept
              </Button>
            </>
          )}
          {isAdmin && (complaint.status === 'closed' || complaint.status === 'rejected') && (
            <Button size="sm" variant="outline" onClick={handleReopen} title="Admin: reopen complaint">
              <Pencil className="w-4 h-4" /> Reopen
            </Button>
          )}
          {canReview && complaint.status === 'accepted' && (
            <Button size="sm" variant="secondary" onClick={handleClose}>
              <Lock className="w-4 h-4" /> Close
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 flex flex-col gap-6">
          {/* Customer */}
          <Card>
            <CardHeader><h2 className="font-semibold text-gray-800">Customer Details</h2></CardHeader>
            <CardBody>
              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <DetailRow label="Consignee" value={complaint.consignee} />
                <DetailRow label="Contact Person" value={complaint.contactPerson} />
                <DetailRow label="Phone No." value={complaint.phoneNo} />
                <DetailRow label="Email" value={complaint.emailAddress} />
              </dl>
            </CardBody>
          </Card>

          {/* Product info */}
          <Card>
            <CardHeader><h2 className="font-semibold text-gray-800">Complaint Information</h2></CardHeader>
            <CardBody>
              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <DetailRow label="Factory / Supplier" value={complaint.factory} />
                <DetailRow label="Brand Name" value={complaint.brandName} />
                <DetailRow label="Product Name" value={complaint.productName} />
                <DetailRow label="PI No." value={complaint.piNo} />
                <DetailRow label="PO No." value={complaint.poNo} />
                <DetailRow label="Lot No." value={complaint.lotNo} />
                <DetailRow label="Size" value={complaint.size} />
                <DetailRow label="Quantity Involved" value={complaint.quantityInvolved} />
                <DetailRow label="Defective Sample Photo" value={complaint.hasDefectiveSamplePhoto} />
                <DetailRow label="Defective Sample Return" value={complaint.hasDefectiveSampleReturn} />
                {complaint.returnSampleQty && <DetailRow label="Return Sample Qty" value={complaint.returnSampleQty} />}
              </dl>
            </CardBody>
          </Card>

          {/* Nature & description */}
          <Card>
            <CardHeader><h2 className="font-semibold text-gray-800">Nature of Complaint</h2></CardHeader>
            <CardBody className="flex flex-col gap-4">
              <div className="flex flex-wrap gap-2">
                {complaint.natures.map(n => (
                  <span key={n} className="px-2.5 py-1 bg-red-50 text-red-700 text-xs font-medium rounded-full border border-red-100">{n}</span>
                ))}
                {complaint.othersDescription && (
                  <span className="px-2.5 py-1 bg-orange-50 text-orange-700 text-xs font-medium rounded-full border border-orange-100">Others: {complaint.othersDescription}</span>
                )}
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Description</p>
                <p className="text-sm text-gray-900 whitespace-pre-wrap">{complaint.description}</p>
              </div>
            </CardBody>
          </Card>

          {/* Defective sample photos */}
          {complaint.photos && complaint.photos.length > 0 && (
            <Card>
              <CardHeader className="flex items-center justify-between flex-wrap gap-2">
                <h2 className="font-semibold text-gray-800">Defective Sample Photos ({complaint.photos.length})</h2>
                {getSharePointFolderUrl(complaint.photos[0].downloadUrl) && (
                  <a
                    href={getSharePointFolderUrl(complaint.photos[0].downloadUrl)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-sm text-blue-600 hover:underline"
                  >
                    <ExternalLink className="w-4 h-4" /> Open folder in SharePoint
                  </a>
                )}
              </CardHeader>
              <CardBody>
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                  {complaint.photos.map((p, i) => (
                    <a
                      key={i}
                      href={p.downloadUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="relative group rounded-lg overflow-hidden border border-gray-200 bg-gray-50 aspect-square block"
                      title={p.name}
                    >
                      <img src={p.downloadUrl} alt={p.name} className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                        <ExternalLink className="w-5 h-5 text-white" />
                      </div>
                    </a>
                  ))}
                </div>
                <p className="text-xs text-gray-500 mt-3">
                  Photos stored in shared OneDrive / SharePoint. Click a thumbnail to open the file, or use the link above to open the whole folder.
                </p>
              </CardBody>
            </Card>
          )}
        </div>

        {/* Side panel */}
        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader><h2 className="font-semibold text-gray-800">Workflow</h2></CardHeader>
            <CardBody>
              <dl className="flex flex-col gap-3">
                <DetailRow label="Status" value={complaint.status.charAt(0).toUpperCase() + complaint.status.slice(1)} />
                <DetailRow label="Date Issued to Factory" value={fmtDate(complaint.dateIssuedToFactory)} />
                <DetailRow label="Forwarded By" value={complaint.forwardedBy} />
                <DetailRow label="Reviewed By" value={complaint.reviewedBy} />
                <DetailRow label="Reviewed At" value={fmtDateTime(complaint.reviewedAt)} />
                {complaint.reviewNotes && <DetailRow label="Review Notes" value={complaint.reviewNotes} />}
                <DetailRow label="Closed At" value={fmtDateTime(complaint.closedAt)} />
              </dl>
            </CardBody>
          </Card>

          {/* Email status */}
          <Card>
            <CardHeader className="flex items-center gap-2">
              <Mail className="w-4 h-4 text-gray-500" />
              <h2 className="font-semibold text-gray-800">Email to Factory</h2>
            </CardHeader>
            <CardBody>
              {complaint.emailSentAt ? (
                <dl className="flex flex-col gap-3">
                  <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 px-2.5 py-1.5 rounded-lg w-fit">
                    <CheckCircle className="w-4 h-4" /> Sent
                  </div>
                  <DetailRow label="Sent At" value={fmtDateTime(complaint.emailSentAt)} />
                  <DetailRow label="Sent By" value={complaint.emailSentBy} />
                  {complaint.emailSentTo && complaint.emailSentTo.length > 0 && (
                    <DetailRow label="Recipients" value={complaint.emailSentTo.join(', ')} />
                  )}
                </dl>
              ) : (
                <p className="text-sm text-gray-500">Not sent yet. Use Preview PDF → Send to Factory.</p>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader><h2 className="font-semibold text-gray-800">Timestamps</h2></CardHeader>
            <CardBody>
              <dl className="flex flex-col gap-3">
                <DetailRow label="Created" value={fmtDateTime(complaint.createdAt)} />
                <DetailRow label="Last Updated" value={fmtDateTime(complaint.updatedAt)} />
              </dl>
            </CardBody>
          </Card>

          {/* Replies from factory */}
          <Card>
            <CardHeader className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-gray-500" />
                <h2 className="font-semibold text-gray-800">Replies ({complaint.replies?.length ?? 0})</h2>
              </div>
              {canEdit && (
                <Button size="sm" variant="outline" onClick={() => { setShowReply(true); setReplyFrom(complaint.factory ?? ''); }}>
                  <Plus className="w-4 h-4" /> Log
                </Button>
              )}
            </CardHeader>
            <CardBody>
              {(!complaint.replies || complaint.replies.length === 0) ? (
                <p className="text-sm text-gray-500">No replies logged yet. Log replies you receive from the factory here for history.</p>
              ) : (
                <ul className="flex flex-col gap-3">
                  {complaint.replies.map((r, idx) => (
                    <li key={idx} className="border-l-4 border-blue-200 pl-3">
                      <div className="flex items-baseline justify-between gap-2 flex-wrap">
                        <p className="text-sm font-medium text-gray-900">{r.from}</p>
                        <p className="text-xs text-gray-500">{fmtDate(new Date(r.receivedAt))}</p>
                      </div>
                      <p className="text-sm text-gray-700 whitespace-pre-wrap mt-1">{r.message}</p>
                      <p className="text-xs text-gray-400 mt-1">Logged by {r.loggedBy} on {fmtDateTime(new Date(r.loggedAt))}</p>
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>
        </div>
      </div>

      {/* Edit Modal */}
      <Modal open={showEdit} onClose={() => setShowEdit(false)} title="Edit Complaint" size="2xl">
        <ComplaintForm existing={complaint} onSuccess={() => { setShowEdit(false); load(); }} onCancel={() => setShowEdit(false)} />
      </Modal>

      {/* Review Modal */}
      <Modal open={!!showReview} onClose={() => setShowReview(null)} title={showReview === 'accept' ? 'Accept Complaint' : 'Reject Complaint'} size="md">
        <div className="p-6 flex flex-col gap-4">
          <p className="text-sm text-gray-600">
            {showReview === 'accept'
              ? 'Accepting will notify the requester and flag this for supplier follow-up.'
              : 'Rejecting will notify the requester with your notes.'}
          </p>
          <Textarea label="Notes (optional)" value={reviewNote} onChange={e => setReviewNote(e.target.value)} rows={4} />
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setShowReview(null)}>Cancel</Button>
            <Button
              variant={showReview === 'reject' ? 'danger' : 'primary'}
              loading={actionLoading}
              onClick={() => handleReview(showReview!)}
            >
              {showReview === 'accept' ? 'Confirm Accept' : 'Confirm Reject'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* PDF Preview Modal */}
      <Modal open={!!previewUrl} onClose={closePreview} title={`Preview · ${complaint.complaintNo}`} size="2xl">
        <div className="flex flex-col h-[75vh]">
          <div className="flex-1 bg-gray-100 overflow-hidden">
            {previewUrl && (
              <iframe
                src={previewUrl}
                title="Complaint PDF preview"
                className="w-full h-full border-0"
              />
            )}
          </div>
          <div className="px-6 py-4 border-t border-gray-200 bg-white flex items-center justify-between gap-3">
            <p className="text-xs text-gray-500">
              The PDF is generated client-side. Click <span className="font-medium">Send to Factory</span> to email it.
            </p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={closePreview}>Close</Button>
              <Button size="sm" onClick={() => setShowSend(true)}>
                <Send className="w-4 h-4" /> Send to Factory
              </Button>
            </div>
          </div>
        </div>
      </Modal>

      {/* Log Reply Modal */}
      <Modal open={showReply} onClose={() => setShowReply(false)} title="Log Factory Reply" size="lg">
        <CardBody className="flex flex-col gap-4">
          <Input label="From *" value={replyFrom} onChange={e => setReplyFrom(e.target.value)} placeholder="Factory name / contact person" />
          <Input label="Received On *" type="date" value={replyDate} onChange={e => setReplyDate(e.target.value)} />
          <Textarea label="Message *" rows={6} value={replyText} onChange={e => setReplyText(e.target.value)} placeholder="Paste the factory's response here…" />
          <p className="text-xs text-gray-500">Paste in email replies, phone notes, or any factory response. Goes into the complaint history.</p>
        </CardBody>
        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex justify-end gap-3">
          <Button variant="outline" onClick={() => setShowReply(false)}>Cancel</Button>
          <Button loading={replyLoading} onClick={handleLogReply} disabled={!replyFrom.trim() || !replyText.trim()}>
            Log Reply
          </Button>
        </div>
      </Modal>

      {/* Send Email Modal */}
      {complaint && pdfBlob && (
        <SendComplaintEmailModal
          open={showSend}
          onClose={() => setShowSend(false)}
          complaint={complaint}
          pdfBlob={pdfBlob}
          onSent={() => {
            setShowSend(false);
            closePreview();
            alert('Complaint email sent to factory.');
          }}
        />
      )}
    </div>
  );
}

// ============== Send Email Modal ==============

function SendComplaintEmailModal({ open, onClose, complaint, pdfBlob, onSent }:
  { open: boolean; onClose: () => void; complaint: Complaint; pdfBlob: Blob; onSent: () => void }) {
  const { appUser } = useAuth();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [selected, setSelected] = useState('');
  const [to, setTo] = useState('');
  const [cc, setCc] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    listSuppliers().then(s => {
      setSuppliers(s);
      // Auto-select the supplier this complaint was filed against, if any
      if (complaint.factoryId) {
        const match = s.find(x => x.id === complaint.factoryId);
        if (match) {
          setSelected(match.id);
          setTo(match.email);
        }
      }
    }).catch(() => {});
    setSubject(`Quality Complaint ${complaint.complaintNo} — ${complaint.productName}`);
    setBody(
`Dear ${complaint.factory},

Please find attached our quality complaint ${complaint.complaintNo} regarding:

Product: ${complaint.productName}
PI No.: ${complaint.piNo}
PO No.: ${complaint.poNo ?? '—'}
Lot No.: ${complaint.lotNo ?? '—'}
Quantity Involved: ${complaint.quantityInvolved}

Nature of complaint: ${complaint.natures.join(', ')}

Description:
${complaint.description}

Kindly review the attached form and respond at your earliest convenience.

Regards,
${appUser?.name ?? 'QA Team'}`
    );
  }, [open, complaint, appUser]);

  const handleSelectSupplier = (id: string) => {
    setSelected(id);
    const s = suppliers.find(x => x.id === id);
    if (s) setTo(s.email);
  };

  const handleSend = async () => {
    if (!to) { setError('Recipient email is required'); return; }
    setLoading(true);
    setError('');
    try {
      // Convert blob to base64 for JSON transport
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const dataUrl = reader.result as string;
          resolve(dataUrl.split(',')[1]); // strip "data:application/pdf;base64,"
        };
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(pdfBlob);
      });

      const res = await fetch('/api/send-complaint-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: to.split(',').map(s => s.trim()).filter(Boolean),
          cc: cc.split(',').map(s => s.trim()).filter(Boolean),
          subject,
          bodyText: body,
          pdfBase64: base64,
          filename: `Complaint_${complaint.complaintNo}.pdf`,
          complaintNo: complaint.complaintNo,
        }),
      });

      if (!res.ok) {
        const txt = await res.text();
        throw new Error(`Send failed (${res.status}): ${txt}`);
      }
      const recipients = [...to.split(',').map(s => s.trim()).filter(Boolean), ...cc.split(',').map(s => s.trim()).filter(Boolean)];
      await setComplaintEmailSent(complaint.id, recipients, appUser?.name ?? 'unknown');
      onSent();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Send Complaint to Factory" size="xl">
      <CardBody className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-gray-700">Pick supplier from list (optional)</label>
          <select
            value={selected}
            onChange={e => handleSelectSupplier(e.target.value)}
            className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
          >
            <option value="">— Choose a supplier —</option>
            {suppliers.map(s => (
              <option key={s.id} value={s.id}>{s.name} · {s.email}</option>
            ))}
          </select>
          <p className="text-xs text-gray-500">
            {suppliers.length === 0 ? (
              <Link to="/suppliers" className="text-blue-600 hover:underline inline-flex items-center gap-1">
                <Building2Icon /> Add suppliers first
              </Link>
            ) : 'Selecting one fills the To field.'}
          </p>
        </div>

        <Input
          label="To *"
          type="email"
          value={to}
          onChange={e => setTo(e.target.value)}
          placeholder="factory@example.com"
          hint="Multiple emails: separate with commas"
        />
        <Input label="CC" value={cc} onChange={e => setCc(e.target.value)} placeholder="(optional)" />
        <Input label="Subject *" value={subject} onChange={e => setSubject(e.target.value)} />
        <Textarea label="Message" rows={10} value={body} onChange={e => setBody(e.target.value)} />

        <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700">
          <Mail className="w-4 h-4 text-gray-500" />
          Attachment: <span className="font-mono">Complaint_{complaint.complaintNo}.pdf</span>
          <span className="text-gray-500">({Math.round(pdfBlob.size / 1024)} KB)</span>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">{error}</div>
        )}
      </CardBody>
      <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex justify-end gap-3">
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button loading={loading} onClick={handleSend}>
          <Send className="w-4 h-4" /> Send
        </Button>
      </div>
    </Modal>
  );
}

function Building2Icon() {
  return <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M9 21V9a2 2 0 012-2h2a2 2 0 012 2v12M3 21V7a2 2 0 012-2h2a2 2 0 012 2v14M15 21V11a2 2 0 012-2h2a2 2 0 012 2v10" /></svg>;
}
