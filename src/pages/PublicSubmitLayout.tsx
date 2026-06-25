import { type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Logo } from '@/components/ui/Logo';

export function PublicSubmitLayout({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <Logo className="w-10 h-10" />
          <div>
            <h1 className="text-base font-semibold text-gray-900">QA Inspection System</h1>
            <p className="text-xs text-gray-500 leading-tight">Cranberry International Sdn Bhd / ASAP International Sdn Bhd</p>
          </div>
        </div>

        <Link to="/" className="inline-flex items-center gap-1 text-sm text-blue-600 hover:underline mb-4">
          <ArrowLeft className="w-4 h-4" /> Back to sign in
        </Link>

        <div className="bg-white rounded-2xl shadow-lg p-6 sm:p-8">
          <div className="mb-6">
            <h2 className="text-xl font-bold text-gray-900">{title}</h2>
            <p className="text-sm text-gray-500 mt-1">{subtitle}</p>
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}
