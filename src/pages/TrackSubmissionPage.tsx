import { useState } from 'react';
import { getSubmissionByRef } from '@/lib/db';
import type { PublicSubmission } from '@/types';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { PublicSubmitLayout } from './PublicSubmitLayout';
import { fmtDateTime, fmtDate } from '@/lib/utils';
import { Search, CheckCircle2, XCircle, Clock, AlertCircle } from 'lucide-react';

const STATUS_STYLE = {
  new: { label: 'In Review', icon: Clock, color: 'text-blue-700 bg-blue-50 border-blue-200' },
  processed: { label: 'Processed', icon: CheckCircle2, color: 'text-green-700 bg-green-50 border-green-200' },
  dismissed: { label: 'Closed (no action)', icon: XCircle, color: 'text-gray-700 bg-gray-50 border-gray-200' },
};

export function TrackSubmissionPage() {
  const [ref, setRef] = useState('');
  const [result, setResult] = useState<PublicSubmission | null | 'not-found'>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLookup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setResult(null);
    setLoading(true);
    try {
      const r = await getSubmissionByRef(ref.trim().toUpperCase());
      setResult(r ?? 'not-found');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <PublicSubmitLayout
      title="Track Your Submission"
      subtitle="Enter the reference number you received after submitting."
    >
      <form onSubmit={handleLookup} className="flex flex-col gap-4">
        <Input
          label="Reference Number"
          value={ref}
          onChange={e => setRef(e.target.value)}
          placeholder="e.g. PC2606-A3F4Q1"
          required
          autoFocus
        />
        {error && (
          <div className="flex items-start gap-2 text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}
        <Button type="submit" loading={loading} size="lg">
          <Search className="w-4 h-4" /> Track Submission
        </Button>
      </form>

      {result === 'not-found' && (
        <div className="mt-6 flex items-start gap-3 bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-sm text-yellow-900">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <div>
            <p className="font-semibold mb-0.5">Not found</p>
            <p>No submission matches "{ref}". Check the reference number for typos.</p>
          </div>
        </div>
      )}

      {result && result !== 'not-found' && (
        <div className="mt-6 flex flex-col gap-4">
          <StatusCard submission={result} />
          <DetailsCard submission={result} />
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
  return (
    <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-sm flex flex-col gap-2">
      <div className="flex items-baseline justify-between">
        <p className="font-mono font-semibold text-blue-700">{s.referenceNo}</p>
        <span className="text-xs text-gray-500 capitalize">{s.type}</span>
      </div>
      <p className="text-gray-700">{s.submitterName} · {s.submitterCompany}</p>
      {s.type === 'inspection' && s.customerPiNo && <p className="text-xs text-gray-600">PI No. {s.customerPiNo} · {s.factoryLocation} · {fmtDate(s.factoryCommitDate)}</p>}
      {s.type === 'complaint' && s.factorySupplier && <p className="text-xs text-gray-600">Factory: {s.factorySupplier} · PI {s.piNo}</p>}
    </div>
  );
}
