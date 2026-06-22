import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { getComplaint, updateComplaint } from '@/lib/db';
import { type Complaint } from '@/types';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { StatusBadge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { ComplaintForm } from '@/components/forms/ComplaintForm';
import { Textarea } from '@/components/ui/Input';
import { fmtDate, fmtDateTime } from '@/lib/utils';
import { ArrowLeft, Pencil, CheckCircle, XCircle, Lock } from 'lucide-react';

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

  const handleClose = async () => {
    if (!complaint || !user || !appUser) return;
    if (!confirm('Mark this complaint as closed?')) return;
    await updateComplaint(complaint.id, { status: 'closed', closedAt: new Date() }, user.uid, appUser.name, 'closed');
    load();
  };

  const canReview = appUser?.role === 'admin' || appUser?.role === 'qa';
  const canEdit = appUser?.role === 'admin' || appUser?.role === 'qa' || appUser?.role === 'manager';

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-7 h-7 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" /></div>;
  if (!complaint) return <div className="p-6 text-gray-500">Complaint not found. <Link to="/complaints" className="text-blue-600 hover:underline">Go back</Link></div>;

  return (
    <div className="p-6 max-w-5xl mx-auto">
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
              <dl className="grid grid-cols-2 gap-4">
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
              <dl className="grid grid-cols-2 gap-4">
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

          <Card>
            <CardHeader><h2 className="font-semibold text-gray-800">Timestamps</h2></CardHeader>
            <CardBody>
              <dl className="flex flex-col gap-3">
                <DetailRow label="Created" value={fmtDateTime(complaint.createdAt)} />
                <DetailRow label="Last Updated" value={fmtDateTime(complaint.updatedAt)} />
              </dl>
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
    </div>
  );
}
