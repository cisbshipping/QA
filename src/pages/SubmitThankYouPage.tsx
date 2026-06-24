import { Link, useSearchParams } from 'react-router-dom';
import { CheckCircle2 } from 'lucide-react';
import { PublicSubmitLayout } from './PublicSubmitLayout';

export function SubmitThankYouPage() {
  const [params] = useSearchParams();
  const ref = params.get('ref') ?? '—';

  return (
    <PublicSubmitLayout title="Submission Received" subtitle="Thank you. Your submission has been recorded.">
      <div className="flex flex-col items-center gap-4 py-6 text-center">
        <CheckCircle2 className="w-14 h-14 text-green-500" />
        <div>
          <p className="text-sm text-gray-600">Your reference number is:</p>
          <p className="text-2xl font-mono font-bold text-blue-700 mt-1">{ref}</p>
        </div>
        <p className="text-sm text-gray-600 max-w-md">
          Our QA team will review your submission and contact you by email within 2 business days.
          Please save the reference number for your records.
        </p>
        <div className="flex flex-col items-center gap-2 mt-2">
          <Link to={`/track?ref=${ref}`} className="text-sm text-blue-600 hover:underline">Track this submission later</Link>
          <Link to="/" className="text-sm text-blue-600 hover:underline">Return to sign in</Link>
        </div>
      </div>
    </PublicSubmitLayout>
  );
}
