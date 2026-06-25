import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { getInspection, updateInspection, appendInspectionComment } from '@/lib/db';
import { type Inspection } from '@/types';
import { useAuth } from '@/hooks/useAuth';
import { usePermissions } from '@/hooks/usePermissions';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { StatusBadge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { InspectionForm } from '@/components/forms/InspectionForm';
import { Input, Textarea } from '@/components/ui/Input';
import { fmtDate, fmtDateTime } from '@/lib/utils';
import { ArrowLeft, Pencil, CheckCircle, XCircle, CheckSquare, XSquare, MessageSquare, Send } from 'lucide-react';

function DetailRow({ label, value }: { label: string; value?: string | null | boolean | number }) {
  if (value === undefined || value === null || value === '') return null;
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</dt>
      <dd className="text-sm text-gray-900">{typeof value === 'boolean' ? (value ? 'Yes' : 'No') : String(value)}</dd>
    </div>
  );
}

function CheckItem({ checked, label }: { checked: boolean; label: string }) {
  return (
    <div className="flex items-center gap-2">
      {checked
        ? <CheckSquare className="w-4 h-4 text-green-600 shrink-0" />
        : <XSquare className="w-4 h-4 text-gray-300 shrink-0" />}
      <span className="text-sm text-gray-700">{label}</span>
    </div>
  );
}

export function InspectionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, appUser } = useAuth();
  const [inspection, setInspection] = useState<Inspection | null>(null);
  const [loading, setLoading] = useState(true);
  const [showEdit, setShowEdit] = useState(false);
  const [showReview, setShowReview] = useState<'accept' | 'reject' | null>(null);
  const [showResult, setShowResult] = useState<'pass' | 'fail' | null>(null);
  const [reviewNote, setReviewNote] = useState('');
  const [inspectionDate, setInspectionDate] = useState('');
  const [resultNote, setResultNote] = useState('');
  const [reschedDate, setReschedDate] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState('');
  const [commentDraft, setCommentDraft] = useState('');
  const [commentSubmitting, setCommentSubmitting] = useState(false);

  const handleAddComment = async () => {
    if (!inspection || !user || !appUser) return;
    if (!commentDraft.trim()) return;
    setCommentSubmitting(true);
    try {
      await appendInspectionComment(inspection.id, {
        message: commentDraft.trim(),
        author: appUser.name,
        authorUid: user.uid,
        createdAt: new Date().toISOString(),
      });
      setCommentDraft('');
      await load();
    } catch (err) {
      setActionError((err as Error).message);
    } finally {
      setCommentSubmitting(false);
    }
  };

  const load = async () => {
    if (!id) return;
    setLoading(true);
    const data = await getInspection(id);
    setInspection(data);
    setLoading(false);
  };

  useEffect(() => { load(); }, [id]);

  const handleReview = async (action: 'accept' | 'reject') => {
    if (!inspection || !user || !appUser) return;
    setActionLoading(true);
    setActionError('');
    try {
      const raw = {
        status: (action === 'accept' ? 'accepted' : 'rejected') as 'accepted' | 'rejected',
        inspectionDate: action === 'accept' && inspectionDate ? new Date(inspectionDate) : undefined,
        reviewNotes: reviewNote,
        reviewedBy: appUser.name,
        reviewedAt: new Date(),
      };
      const payload = Object.fromEntries(
        Object.entries(raw).filter(([, v]) => v !== undefined && v !== '')
      ) as typeof raw;
      await updateInspection(inspection.id, payload, user.uid, appUser.name, action);
      setShowReview(null);
      setReviewNote('');
      setInspectionDate('');
      load();
    } catch (err) {
      const e = err as { code?: string; message?: string };
      setActionError(e.code === 'permission-denied'
        ? `Permission denied. Your role (${appUser.role}) cannot review inspections, or Firestore rules are outdated.`
        : (e.message ?? 'Failed to update inspection.'));
      console.error('Inspection review error:', err);
    } finally {
      setActionLoading(false);
    }
  };

  const handleResult = async (result: 'pass' | 'fail') => {
    if (!inspection || !user || !appUser) return;
    setActionLoading(true);
    setActionError('');
    try {
      // Build an attempt record for the inspection that just happened.
      const attempts = inspection.inspectionAttempts ?? [];
      const newAttempt: import('@/types').InspectionAttempt = {
        attemptNo: attempts.length + 1,
        scheduledDate: (inspection.rescheduledDate ?? inspection.inspectionDate ?? new Date()).toISOString(),
        result,
        recordedBy: appUser.name,
        recordedAt: new Date().toISOString(),
      };
      // Only include notes if non-empty — Firestore rejects undefined values, even nested in arrays.
      if (resultNote.trim()) newAttempt.notes = resultNote.trim();

      // Pass → close. Fail + reschedule date → status 'rescheduled' so Pass/Fail can run again. Fail with no
      // reschedule date → terminal 'failed'.
      const failsWithReschedule = result === 'fail' && Boolean(reschedDate);
      const newStatus: 'passed' | 'failed' | 'rescheduled' =
        result === 'pass' ? 'passed' : failsWithReschedule ? 'rescheduled' : 'failed';

      const raw = {
        status: newStatus,
        inspectionResult: result,
        resultNotes: resultNote,
        rescheduledDate: failsWithReschedule ? new Date(reschedDate) : undefined,
        // When rescheduled, the new inspectionDate becomes the rescheduled date so the calendar/list reflects it.
        inspectionDate: failsWithReschedule ? new Date(reschedDate) : inspection.inspectionDate,
        closedAt: result === 'pass' ? new Date() : undefined,
        inspectionAttempts: [...attempts, newAttempt],
      };
      const payload = Object.fromEntries(
        Object.entries(raw).filter(([, v]) => v !== undefined && v !== '')
      ) as typeof raw;
      await updateInspection(inspection.id, payload, user.uid, appUser.name,
        result === 'pass' ? 'passed' : failsWithReschedule ? 'rescheduled' : 'failed');
      setShowResult(null);
      setResultNote('');
      setReschedDate('');
      load();
    } catch (err) {
      const e = err as { code?: string; message?: string };
      setActionError(e.code === 'permission-denied'
        ? `Permission denied. Your role (${appUser.role}) cannot record inspection results, or Firestore rules are outdated.`
        : (e.message ?? 'Failed to update inspection.'));
      console.error('Inspection result error:', err);
    } finally {
      setActionLoading(false);
    }
  };

  const { can } = usePermissions();
  const canReview = can('inspection.review');
  const canEdit = can('inspection.edit');
  const canRecordResult = can('inspection.result');
  const canReschedule = can('inspection.reschedule');
  const canRevert = can('inspection.revert');
  const canReopen = can('inspection.reopen');
  const canComment = can('inspection.comment');

  // ---- Admin override actions ----
  const [showResched, setShowResched] = useState(false);
  const [newScheduleDate, setNewScheduleDate] = useState('');

  const handleAdminReschedule = async () => {
    if (!inspection || !user || !appUser || !newScheduleDate) return;
    setActionLoading(true);
    setActionError('');
    try {
      const d = new Date(newScheduleDate);
      await updateInspection(inspection.id,
        { inspectionDate: d, rescheduledDate: d, status: 'rescheduled' },
        user.uid, appUser.name, 'admin-rescheduled');
      setShowResched(false);
      setNewScheduleDate('');
      load();
    } catch (err) {
      setActionError((err as Error).message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleRevertLast = async () => {
    if (!inspection || !user || !appUser) return;
    if (!confirm('Revert the last inspection attempt? This removes the latest pass/fail and reopens the inspection.')) return;
    setActionLoading(true);
    setActionError('');
    try {
      const attempts = [...(inspection.inspectionAttempts ?? [])];
      attempts.pop();
      // If any attempts remain, keep status as rescheduled. Otherwise go back to accepted.
      const nextStatus: 'accepted' | 'rescheduled' = attempts.length > 0 ? 'rescheduled' : 'accepted';
      const payload: Partial<typeof inspection> = {
        status: nextStatus,
        inspectionAttempts: attempts,
      };
      // Clear closed timestamp if we're reopening
      if (inspection.closedAt) payload.closedAt = undefined;
      const cleaned = Object.fromEntries(Object.entries(payload).filter(([, v]) => v !== undefined && v !== ''));
      await updateInspection(inspection.id, cleaned, user.uid, appUser.name, 'admin-reverted');
      load();
    } catch (err) {
      setActionError((err as Error).message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleReopen = async () => {
    if (!inspection || !user || !appUser) return;
    if (!confirm('Reopen this inspection? Status will go back to Accepted.')) return;
    setActionLoading(true);
    setActionError('');
    try {
      const payload = Object.fromEntries(Object.entries({
        status: 'accepted' as const,
        closedAt: undefined,
        inspectionResult: undefined,
      }).filter(([, v]) => v !== undefined));
      await updateInspection(inspection.id, payload, user.uid, appUser.name, 'admin-reopened');
      load();
    } catch (err) {
      setActionError((err as Error).message);
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-7 h-7 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" /></div>;
  if (!inspection) return <div className="p-6 text-gray-500">Inspection not found. <Link to="/inspections" className="text-blue-600 hover:underline">Go back</Link></div>;

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto">
      <div className="flex flex-col lg:flex-row lg:items-center gap-3 mb-6">
        <div className="flex items-start gap-2 flex-1 min-w-0">
          <button onClick={() => navigate(-1)} className="p-2 -ml-2 rounded-lg hover:bg-gray-100 shrink-0">
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-bold text-gray-900 font-mono break-all">{inspection.inspectionNo ?? '—'}</h1>
              <StatusBadge status={inspection.status} />
            </div>
            <p className="text-sm text-gray-500 mt-0.5">
              PI <span className="font-mono">{inspection.customerPiNo}</span> · Requested by {inspection.picName} on {fmtDate(inspection.dateRequested)}
            </p>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          {canEdit && inspection.status === 'pending' && (
            <Button variant="outline" size="sm" onClick={() => setShowEdit(true)}>
              <Pencil className="w-4 h-4" /> Edit
            </Button>
          )}
          {canReview && inspection.status === 'pending' && (
            <>
              <Button variant="danger" size="sm" onClick={() => setShowReview('reject')}>
                <XCircle className="w-4 h-4" /> Reject
              </Button>
              <Button size="sm" onClick={() => setShowReview('accept')}>
                <CheckCircle className="w-4 h-4" /> Accept
              </Button>
            </>
          )}
          {canRecordResult && (inspection.status === 'accepted' || inspection.status === 'rescheduled') && (
            <>
              <Button variant="danger" size="sm" onClick={() => setShowResult('fail')}>
                <XCircle className="w-4 h-4" /> Fail
              </Button>
              <Button size="sm" onClick={() => setShowResult('pass')}>
                <CheckCircle className="w-4 h-4" /> Pass
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 flex flex-col gap-6">
          {/* Order info */}
          <Card>
            <CardHeader><h2 className="font-semibold text-gray-800">Order Information</h2></CardHeader>
            <CardBody>
              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <DetailRow label="Company" value={inspection.company} />
                <DetailRow label="Customer" value={inspection.customer} />
                <DetailRow label="Customer Country" value={inspection.customerCountry} />
                <DetailRow label="Customer PI No." value={inspection.customerPiNo} />
                <DetailRow label="Supplier PO No." value={inspection.supplierPoNo} />
                <DetailRow label="Factory / Location" value={inspection.factory} />
                <DetailRow label="Factory Commit Date" value={fmtDate(inspection.factoryCommitDate)} />
                <DetailRow label="Total Qty (Cartons)" value={inspection.totalQtyCartons.toLocaleString()} />
                <DetailRow label="Container Size" value={inspection.containerSize} />
              </dl>
            </CardBody>
          </Card>

          {/* Product */}
          <Card>
            <CardHeader><h2 className="font-semibold text-gray-800">Product Description</h2></CardHeader>
            <CardBody>
              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <DetailRow label="Product" value={inspection.product} />
                <DetailRow label="Standard" value={inspection.productStandard} />
                <DetailRow label="Grade" value={inspection.productGrade} />
              </dl>
            </CardBody>
          </Card>

          {/* Inspection details */}
          <Card>
            <CardHeader><h2 className="font-semibold text-gray-800">Inspection Details</h2></CardHeader>
            <CardBody className="flex flex-col gap-4">
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Criteria Acknowledgement</p>
                <div className="flex flex-col gap-1.5">
                  <CheckItem checked={inspection.criteriaNotIndustrial} label="Not industrial & stock gloves" />
                  <CheckItem checked={inspection.criteriaUnderstandOutsideKV} label="Understands outside KV = third party" />
                  <CheckItem checked={inspection.criteriaCostBelow020} label="Inspection cost below USD 0.20/carton" />
                </div>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Reason for Request</p>
                <p className="text-sm text-gray-900">{inspection.reasonForRequest}</p>
              </div>
              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <dt className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Focus Areas</dt>
                  <dd className="flex flex-wrap gap-1">
                    {inspection.focusAreas.map(a => (
                      <span key={a} className="px-2 py-0.5 bg-blue-50 text-blue-700 text-xs rounded-full">{a}</span>
                    ))}
                    {inspection.focusOthers && <span className="px-2 py-0.5 bg-blue-50 text-blue-700 text-xs rounded-full">{inspection.focusOthers}</span>}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Inspector Type</dt>
                  <dd className="flex flex-wrap gap-1">
                    {inspection.inspectorTypes.map(t => (
                      <span key={t} className="px-2 py-0.5 bg-gray-100 text-gray-700 text-xs rounded-full capitalize">{t}</span>
                    ))}
                  </dd>
                </div>
                <DetailRow label="AQL Level" value={inspection.aqlLevel + (inspection.aqlOther ? ` (${inspection.aqlOther})` : '')} />
                <DetailRow label="PSI Report Required" value={inspection.needsPsiReport} />
              </dl>
              {inspection.remarks && (
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Remarks</p>
                  <p className="text-sm text-gray-900">{inspection.remarks}</p>
                </div>
              )}
            </CardBody>
          </Card>
        </div>

        {/* Side panel */}
        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader><h2 className="font-semibold text-gray-800">Approval</h2></CardHeader>
            <CardBody>
              <dl className="flex flex-col gap-3">
                <DetailRow label="Requested By" value={inspection.requestedByName} />
                <DetailRow label="Request Date" value={fmtDate(inspection.requestedByDate)} />
                <DetailRow label="Reviewed By (HOD)" value={inspection.hodName} />
              </dl>
            </CardBody>
          </Card>

          <Card>
            <CardHeader><h2 className="font-semibold text-gray-800">Workflow</h2></CardHeader>
            <CardBody>
              <dl className="flex flex-col gap-3">
                <DetailRow label="Status" value={inspection.status.charAt(0).toUpperCase() + inspection.status.slice(1)} />
                <DetailRow label="Scheduled Inspection Date" value={fmtDate(inspection.inspectionDate)} />
                <DetailRow label="Inspection Result" value={inspection.inspectionResult?.toUpperCase()} />
                {inspection.resultNotes && <DetailRow label="Result Notes" value={inspection.resultNotes} />}
                <DetailRow label="Rescheduled Date" value={fmtDate(inspection.rescheduledDate)} />
                <DetailRow label="Reviewed By" value={inspection.reviewedBy} />
                <DetailRow label="Reviewed At" value={fmtDateTime(inspection.reviewedAt)} />
                {inspection.reviewNotes && <DetailRow label="Review Notes" value={inspection.reviewNotes} />}
                <DetailRow label="Closed At" value={fmtDateTime(inspection.closedAt)} />
              </dl>
            </CardBody>
          </Card>

          {/* Admin Override panel — admin-only controls to reschedule or backtrack */}
          {(canReschedule || canRevert || canReopen) && inspection.status !== 'pending' && inspection.status !== 'rejected' && (
            <Card className="border-amber-200">
              <CardHeader className="bg-amber-50 border-amber-200">
                <h2 className="font-semibold text-amber-900 flex items-center gap-2">
                  <Pencil className="w-4 h-4" /> Admin Override
                </h2>
              </CardHeader>
              <CardBody className="flex flex-col gap-2">
                <p className="text-xs text-gray-600 -mt-1">All actions are logged in the audit trail.</p>
                {canReschedule && (
                  <Button variant="outline" size="sm" loading={actionLoading} onClick={() => setShowResched(true)}>
                    Reschedule inspection date
                  </Button>
                )}
                {canRevert && inspection.inspectionAttempts && inspection.inspectionAttempts.length > 0 && (
                  <Button variant="outline" size="sm" loading={actionLoading} onClick={handleRevertLast}>
                    Revert last attempt
                  </Button>
                )}
                {canReopen && (inspection.status === 'passed' || inspection.status === 'failed') && (
                  <Button variant="outline" size="sm" loading={actionLoading} onClick={handleReopen}>
                    Reopen inspection
                  </Button>
                )}
                {actionError && <p className="text-xs text-red-600">{actionError}</p>}
              </CardBody>
            </Card>
          )}

          {/* Inspection attempts history */}
          {/* Internal comments / remarks */}
          <Card>
            <CardHeader className="flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-gray-500" />
              <h2 className="font-semibold text-gray-800">Remarks ({inspection.inspectionComments?.length ?? 0})</h2>
            </CardHeader>
            <CardBody className="flex flex-col gap-3">
              {(!inspection.inspectionComments || inspection.inspectionComments.length === 0) ? (
                <p className="text-sm text-gray-500">No remarks yet. Add a note for your QA team below.</p>
              ) : (
                <ul className="flex flex-col gap-3">
                  {inspection.inspectionComments.map((c, idx) => (
                    <li key={idx} className="border-l-4 border-blue-200 pl-3">
                      <div className="flex items-baseline justify-between gap-2 flex-wrap">
                        <p className="text-sm font-medium text-gray-900">{c.author}</p>
                        <p className="text-xs text-gray-500">{fmtDateTime(new Date(c.createdAt))}</p>
                      </div>
                      <p className="text-sm text-gray-700 whitespace-pre-wrap mt-1">{c.message}</p>
                    </li>
                  ))}
                </ul>
              )}

              {/* Add new comment */}
              {canComment && (
                <div className="flex flex-col gap-2 pt-2 border-t border-gray-100">
                  <Textarea
                    label="Add a remark"
                    rows={3}
                    value={commentDraft}
                    onChange={e => setCommentDraft(e.target.value)}
                    placeholder="Notes for your QA team — visible to all internal users."
                  />
                  <div className="flex justify-end">
                    <Button size="sm" loading={commentSubmitting} onClick={handleAddComment} disabled={!commentDraft.trim()}>
                      <Send className="w-4 h-4" /> Post
                    </Button>
                  </div>
                </div>
              )}
            </CardBody>
          </Card>

          {inspection.inspectionAttempts && inspection.inspectionAttempts.length > 0 && (
            <Card>
              <CardHeader><h2 className="font-semibold text-gray-800">Inspection Attempts ({inspection.inspectionAttempts.length})</h2></CardHeader>
              <CardBody>
                <ul className="flex flex-col gap-3">
                  {inspection.inspectionAttempts.map(a => (
                    <li key={a.attemptNo} className={`border-l-4 pl-3 ${a.result === 'pass' ? 'border-green-300' : 'border-red-300'}`}>
                      <div className="flex items-baseline justify-between gap-2 flex-wrap">
                        <p className="text-sm font-medium text-gray-900">
                          Attempt #{a.attemptNo}{' '}
                          <span className={`ml-1 px-1.5 py-0.5 rounded text-xs font-semibold ${a.result === 'pass' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                            {a.result.toUpperCase()}
                          </span>
                        </p>
                        <p className="text-xs text-gray-500">{fmtDate(new Date(a.scheduledDate))}</p>
                      </div>
                      {a.notes && <p className="text-sm text-gray-700 whitespace-pre-wrap mt-1">{a.notes}</p>}
                      <p className="text-xs text-gray-400 mt-1">Recorded by {a.recordedBy} on {fmtDateTime(new Date(a.recordedAt))}</p>
                    </li>
                  ))}
                </ul>
              </CardBody>
            </Card>
          )}
        </div>
      </div>

      {/* Edit Modal */}
      <Modal open={showEdit} onClose={() => setShowEdit(false)} title="Edit Inspection Request" size="2xl">
        <InspectionForm existing={inspection} onSuccess={() => { setShowEdit(false); load(); }} onCancel={() => setShowEdit(false)} />
      </Modal>

      {/* Review Modal */}
      <Modal open={!!showReview} onClose={() => setShowReview(null)} title={showReview === 'accept' ? 'Accept Inspection Request' : 'Reject Inspection Request'} size="md">
        <div className="p-6 flex flex-col gap-4">
          {showReview === 'accept' && (
            <Input label="Scheduled Inspection Date" type="date" value={inspectionDate} onChange={e => setInspectionDate(e.target.value)} />
          )}
          <Textarea label="Notes (optional)" value={reviewNote} onChange={e => setReviewNote(e.target.value)} rows={4} />
          {actionError && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">{actionError}</div>
          )}
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

      {/* Admin Reschedule Modal */}
      <Modal open={showResched} onClose={() => setShowResched(false)} title="Reschedule Inspection Date" size="md">
        <div className="p-6 flex flex-col gap-4">
          <p className="text-sm text-gray-600">
            Pick the new inspection date. Status will be set to <span className="font-medium">Rescheduled</span> so Pass/Fail can be recorded on this date.
          </p>
          <Input label="New Inspection Date *" type="date" value={newScheduleDate} onChange={e => setNewScheduleDate(e.target.value)} />
          {actionError && <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">{actionError}</div>}
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setShowResched(false)}>Cancel</Button>
            <Button loading={actionLoading} onClick={handleAdminReschedule} disabled={!newScheduleDate}>
              Update Date
            </Button>
          </div>
        </div>
      </Modal>

      {/* Result Modal */}
      <Modal open={!!showResult} onClose={() => setShowResult(null)} title={showResult === 'pass' ? 'Record Pass Result' : 'Record Fail Result'} size="md">
        <div className="p-6 flex flex-col gap-4">
          {showResult === 'fail' && (
            <Input label="Rescheduled Inspection Date" type="date" value={reschedDate} onChange={e => setReschedDate(e.target.value)} />
          )}
          <Textarea label="Result Notes" value={resultNote} onChange={e => setResultNote(e.target.value)} rows={4} />
          {actionError && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">{actionError}</div>
          )}
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setShowResult(null)}>Cancel</Button>
            <Button
              variant={showResult === 'fail' ? 'danger' : 'primary'}
              loading={actionLoading}
              onClick={() => handleResult(showResult!)}
            >
              {showResult === 'pass' ? 'Record Pass' : 'Record Fail & Reschedule'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
