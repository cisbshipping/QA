import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { AlertCircle, ChevronDown, ClipboardList, FileText, Loader2 } from 'lucide-react';
import { Logo } from '@/components/ui/Logo';

function MicrosoftLogo() {
  return (
    <svg width="20" height="20" viewBox="0 0 23 23" xmlns="http://www.w3.org/2000/svg">
      <rect x="1" y="1" width="10" height="10" fill="#F25022" />
      <rect x="12" y="1" width="10" height="10" fill="#7FBA00" />
      <rect x="1" y="12" width="10" height="10" fill="#00A4EF" />
      <rect x="12" y="12" width="10" height="10" fill="#FFB900" />
    </svg>
  );
}

export function LoginCard() {
  const { signInWithMicrosoft, authError } = useAuth();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showGuide, setShowGuide] = useState(false);

  const displayError = error || authError || '';

  const handleLogin = async () => {
    setError('');
    setLoading(true);
    try {
      await signInWithMicrosoft();
    } catch (err) {
      const e = err as { code?: string; message?: string };
      if (e.code === 'auth/popup-closed-by-user') {
        setError('Sign-in cancelled.');
      } else if (e.code === 'auth/account-exists-with-different-credential') {
        setError('An account with this email already exists with a different sign-in method.');
      } else {
        setError(e.message ?? 'Sign-in failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4 py-8">
      <div className="bg-white w-full max-w-md rounded-2xl shadow-lg p-8">
        <div className="flex flex-col items-center gap-3 mb-8">
          <div className="w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center text-gray-700">
            <Logo className="w-8 h-8" />
          </div>
          <div className="text-center">
            <h1 className="text-xl font-bold text-gray-900">QA Inspection System</h1>
            <p className="text-sm text-gray-500 mt-0.5 text-center leading-tight">Cranberry International Sdn Bhd<br />ASAP International Sdn Bhd</p>
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <p className="text-sm text-gray-600 text-center">
            Sign in with your company Microsoft account.
          </p>

          <button
            onClick={handleLogin}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 px-4 py-2.5 border border-gray-300 rounded-lg bg-white hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin text-gray-500" /> : <MicrosoftLogo />}
            <span className="text-sm font-medium text-gray-800">
              {loading ? 'Signing in...' : 'Sign in with Microsoft'}
            </span>
          </button>

          {displayError && (
            <div className="flex items-start gap-2 text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{displayError}</span>
            </div>
          )}

          <p className="text-xs text-gray-400 text-center mt-2">
            By signing in, you agree to access internal QA records under your assigned role.
          </p>

          <div className="relative my-2">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-200" /></div>
            <div className="relative flex justify-center"><span className="bg-white px-2 text-xs text-gray-400">or submit without signing in</span></div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Link to="/submit/complaint" className="flex flex-col items-center gap-1 px-3 py-3 border border-gray-200 rounded-lg hover:bg-gray-50 hover:border-gray-300 transition-colors">
              <FileText className="w-5 h-5 text-red-500" />
              <span className="text-xs font-medium text-gray-700">Submit Complaint</span>
            </Link>
            <Link to="/submit/inspection" className="flex flex-col items-center gap-1 px-3 py-3 border border-gray-200 rounded-lg hover:bg-gray-50 hover:border-gray-300 transition-colors">
              <ClipboardList className="w-5 h-5 text-blue-500" />
              <span className="text-xs font-medium text-gray-700">Inspection Request</span>
            </Link>
          </div>

          <Link to="/track" className="text-xs text-blue-600 hover:underline text-center">
            Track an existing submission →
          </Link>

          {/* "How to use" guide */}
          <div className="border border-gray-200 rounded-lg overflow-hidden">
            <button
              type="button"
              onClick={() => setShowGuide(v => !v)}
              className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-gray-50 transition-colors"
            >
              <span className="text-sm font-medium text-gray-700">How to use these forms</span>
              <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${showGuide ? 'rotate-180' : ''}`} />
            </button>

            {showGuide && (
              <div className="px-4 py-3 border-t border-gray-100 bg-gray-50 flex flex-col gap-4 text-xs text-gray-700 leading-relaxed">
                <div>
                  <p className="font-semibold text-gray-900 mb-1 flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-red-500" /> Submit Complaint
                  </p>
                  <p className="text-gray-600">Use this if you received a product with a quality issue (holes, tears, dirt, packaging defect, wrong labeling, etc.).</p>
                  <p className="mt-1.5 text-gray-600"><span className="font-medium">You'll need to provide:</span> your contact details, the product info (brand, PI number, lot number if available), the type of defect, and a clear description.</p>
                </div>

                <div>
                  <p className="font-semibold text-gray-900 mb-1 flex items-center gap-1.5">
                    <ClipboardList className="w-3.5 h-3.5 text-blue-500" /> Inspection Request
                  </p>
                  <p className="text-gray-600">Use this to request a pre-shipment quality inspection at the factory before goods are dispatched.</p>
                  <p className="mt-1.5 text-gray-600"><span className="font-medium">You'll need to provide:</span> the Customer PI number, factory location, factory commit date (submit at least 2 weeks ahead), total carton quantity, and the product description.</p>
                </div>

                <div>
                  <p className="font-semibold text-gray-900 mb-1">What happens next</p>
                  <ol className="list-decimal list-inside text-gray-600 space-y-1">
                    <li>You'll get a reference number on screen — <span className="font-medium">save it</span>.</li>
                    <li>Our QA team is notified and will review the submission.</li>
                    <li>We'll contact you by email within 2 business days, usually sooner.</li>
                    <li>For complaints: you may be asked to send sample photos or return goods.</li>
                    <li>For inspections: we'll confirm the scheduled inspection date.</li>
                  </ol>
                </div>

                <div className="bg-amber-50 border border-amber-200 rounded p-2 text-amber-900">
                  <p className="font-medium">Tip</p>
                  <p>The more accurate your product info (PI no., PO no., lot no.) the faster we can locate the order and respond.</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
