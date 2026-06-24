import { useEffect, useState } from 'react';
import { getSubmissionByRef, findSubmissionsByPiNo, getInspection, getComplaint } from '@/lib/db';
import type { PublicSubmission, Inspection, Complaint } from '@/types';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { PublicSubmitLayout } from './PublicSubmitLayout';
import { fmtDateTime, fmtDate } from '@/lib/utils';
import { Search, CheckCircle2, XCircle, Clock, AlertCircle } from 'lucide-react';

type Mode = 'ref' | 'pi';

const STATUS_STYLE = {
  new: { label: 'In Review', icon: Clock, color: 'text-blue-700 bg-blue-50 border-blue-200' },
  processed: { label: 'Processed', icon: CheckCircle2, color: 'text-green-700 bg-green-50 border-green-200' },
  dismissed: { label: 'Closed (no action)', icon: XCircle, color: 'text-gray-700 bg-gray-50 border-gray-200' },
};

export function TrackSubmissionPage() {
  const [mode, setMode] = useState<Mode>('ref');
  const [refInput, setRefInput] = useState('');
  const [piInput, setPiInput] = useState('');
  const [results, setResults] = useState<PublicSubmission[] | 'none' | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLookup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setResults(null);
    setLoading(true);
    try {
      if (mode === 'ref') {
        const refNo = refInput.trim().toUpperCase();
        if (!refNo) { setError('Please enter a reference number.'); return; }
        const r = await getSubmissionByRef(refNo);
        setResults(r ? [r] : 'none');
      } else {
        const piNo = piInput.trim();
        if (!piNo) { setError('Please enter a PI number.'); return; }
        const rs = await findSubmissionsByPiNo(piNo);
        setResults(rs.length > 0 ? rs : 'none');
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const currentInput = mode === 'ref' ? refInput : piInput;
  const noneMessage = mode === 'ref'
    ? `No submission matches "${refInput}". Check the reference number for typos.`
    : `No submissions found with PI No. "${piInput}".`;

  return (
    <PublicSubmitLayout
      title="Track Your Submission"
      subtitle="Look up by reference number or by PI number."
    >
      <form onSubmit={handleLookup} className="flex flex-col gap-4">
        {/* Mode toggle */}
        <div className="inline-flex bg-gray-100 rounded-lg p-0.5 w-fit">
          <button
            type="button"
            onClick={() => { setMode('ref'); setResults(null); setError(''); }}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${mode === 'ref' ? 'bg-white shadow text-gray-900' : 'text-gray-500'}`}
          >
            By Reference No.
          </button>
          <button
            type="button"
            onClick={() => { setMode('pi'); setResults(null); setError(''); }}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${mode === 'pi' ? 'bg-white shadow text-gray-900' : 'text-gray-500'}`}
          >
            By PI No.
          </button>
        </div>

        {mode === 'ref' ? (
          <Input
            key="ref"
            label="Reference Number"
            value={refInput}
            onChange={e => setRefInput(e.target.value)}
            placeholder="e.g. PC2606-A3F4Q1"
            autoFocus
          />
        ) : (
          <Input
            key="pi"
            label="PI No."
            value={piInput}
            onChange={e => setPiInput(e.target.value)}
            placeholder="e.g. PIN26040028"
            hint="Match must be exact (case sensitive)"
            autoFocus
          />
        )}

        {error && (
          <div className="flex items-start gap-2 text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <Button type="submit" loading={loading} size="lg" disabled={!currentInput.trim()}>
          <Search className="w-4 h-4" /> Track Submission
        </Button>
      </form>

      {results === 'none' && (
        <div className="mt-6 flex items-start gap-3 bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-sm text-yellow-900">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <div>
            <p className="font-semibold mb-0.5">No results</p>
            <p>{noneMessage}</p>
          </div>
        </div>
      )}

      {Array.isArray(results) && results.length > 0 && (
        <div className="mt-6 flex flex-col gap-4">
          {results.length > 1 && (
            <p className="text-sm text-gray-600">Found {results.length} submissions matching this PI No.</p>
          )}
          {results.map(r => (
            <div key={r.id} className="flex flex-col gap-4">
              <StatusCard submission={r} />
              <DetailsCard submission={r} />
            </div>
          ))}
        </div>
      )}
    </PublicSubmitLayout>
  );
}

function StatusCard({ submission: s }: { submission: PublicSubmission }) {
  const style = STATUS_STYLE[s.status];
  const Icon = style.icon;
  return (
    <div className={`border rounded-lg p-4 ${style.color}`}>
      <div className="flex items-center gap-2 mb-2">
        <Icon className="w-5 h-5" />
        <p className="font-semibold">{style.label}</p>
      </div>
      <p className="text-xs opacity-80">
        Submitted {fmtDateTime(s.createdAt)}
      </p>
      {s.processedAt && (
        <p className="text-xs opacity-80">Last updated {fmtDateTime(s.processedAt)}</p>
      )}
      {s.notes && (
        <div className="mt-3 pt-3 border-t border-current/20 text-sm">
          <p className="font-medium mb-1">Note from our QA team:</p>
          <p className="whitespace-pre-wrap">{s.notes}</p>
        </div>
      )}
    </div>
  );
}

function DetailsCard({ submission: s }: { submission: PublicSubmission }) {
  const [linked, setLinked] = useState<Inspection | Complaint | null>(null);

  useEffect(() => {
    // Fetch the matching record in the main collection so we can show fields QA has populated since
    // (e.g. inspectionDate after the request was accepted).
    if (s.type === 'inspection') {
      getInspection(s.referenceNo).then(r => setLinked(r)).catch(() => {});
    } else if (s.type === 'complaint') {
      getComplaint(s.referenceNo).then(r => setLinked(r)).catch(() => {});
    }
  }, [s.referenceNo, s.type]);

  return (
    <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-sm flex flex-col gap-3">
      <div className="flex items-baseline justify-between">
        <p className="font-mono font-semibold text-blue-700">{s.referenceNo}</p>
        <span className="text-xs text-gray-500 capitalize">{s.type}</span>
      </div>
      <p className="text-gray-700">Submitted by {s.submitterName}</p>

      {s.type === 'inspection' && (
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 text-xs">
          <Field label="PI No." value={s.customerPiNo} />
          <Field label="PO No." value={s.poNo} />
          <Field label="Supplier / Factory" value={s.factoryLocation} />
          <Field label="Customer" value={s.customer} />
          <Field label="Ready Date" value={fmtDate(s.factoryCommitDate)} />
          <Field
            label="Inspection Date"
            value={
              linked && 'rescheduledDate' in linked
                ? fmtDate(linked.rescheduledDate ?? linked.inspectionDate)
                : (s.factoryCommitDate ? '— pending QA review —' : '—')
            }
          />
          {linked && 'status' in linked && linked.status && (
            <Field label="Inspection Status" value={String(linked.status).toUpperCase()} />
          )}
        </dl>
      )}

      {s.type === 'complaint' && (
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 text-xs">
          <Field label="Factory / Supplier" value={s.factorySupplier} />
          <Field label="PI No." value={s.piNo} />
          <Field label="PO No." value={s.poNo} />
          <Field label="Product" value={s.productName} />
        </dl>
      )}
    </div>
  );
}

function Field({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex flex-col">
      <dt className="text-gray-500 uppercase tracking-wide text-[10px] font-semibold">{label}</dt>
      <dd className="text-gray-900 text-sm">{value || '—'}</dd>
    </div>
  );
}
