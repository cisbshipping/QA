import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input, Textarea } from '@/components/ui/Input';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Building2, Mail, ShieldCheck, Save, Check, AlertCircle, ExternalLink } from 'lucide-react';

interface SettingsDoc {
  orgName: string;
  qaTeamEmail: string;
  notifyOnNewComplaint: boolean;
  notifyOnNewInspection: boolean;
  notifyOnPublicSubmission: boolean;
  complaintAcceptTemplate: string;
  complaintRejectTemplate: string;
  inspectionAcceptTemplate: string;
  inspectionRejectTemplate: string;
  updatedAt?: Date;
  updatedBy?: string;
}

const DEFAULTS: SettingsDoc = {
  orgName: 'Cranberry International Sdn Bhd / ASAP International Sdn Bhd',
  qaTeamEmail: '',
  notifyOnNewComplaint: true,
  notifyOnNewInspection: true,
  notifyOnPublicSubmission: true,
  complaintAcceptTemplate: `Dear {{recordedBy}},

Your complaint {{complaintNo}} has been ACCEPTED for review.

Product: {{productName}}
Factory: {{factory}}

The supplier has been notified and will respond shortly.

— QA Team`,
  complaintRejectTemplate: `Dear {{recordedBy}},

Your complaint {{complaintNo}} has been REJECTED after review.

Reason: {{reviewNotes}}

If you'd like to discuss, please reply to this email.

— QA Team`,
  inspectionAcceptTemplate: `Dear {{requestedByName}},

Your inspection request for PI {{customerPiNo}} has been ACCEPTED.

Scheduled date: {{inspectionDate}}
Factory: {{factory}}

— QA Team`,
  inspectionRejectTemplate: `Dear {{requestedByName}},

Your inspection request for PI {{customerPiNo}} has been REJECTED.

Reason: {{reviewNotes}}

— QA Team`,
};

export function SettingsPage() {
  const { appUser } = useAuth();
  const [data, setData] = useState<SettingsDoc>(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const snap = await getDoc(doc(db, 'settings', 'app'));
        if (snap.exists()) {
          setData({ ...DEFAULTS, ...(snap.data() as Partial<SettingsDoc>) });
        }
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (appUser?.role !== 'admin') {
    return <div className="p-6 text-gray-500">Access denied.</div>;
  }

  const handleSave = async () => {
    if (!appUser) return;
    setSaving(true);
    setError('');
    try {
      await setDoc(doc(db, 'settings', 'app'), {
        ...data,
        updatedAt: serverTimestamp(),
        updatedBy: appUser.name,
      }, { merge: true });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const update = <K extends keyof SettingsDoc>(key: K, value: SettingsDoc[K]) => {
    setData(d => ({ ...d, [key]: value }));
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
          <p className="text-gray-500 mt-0.5">System-wide configuration. Admin only.</p>
        </div>
        <div className="flex items-center gap-3">
          {saved && (
            <span className="flex items-center gap-1.5 text-sm text-green-600">
              <Check className="w-4 h-4" /> Saved
            </span>
          )}
          <Button onClick={handleSave} loading={saving}>
            <Save className="w-4 h-4" /> Save Changes
          </Button>
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-2 text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg mb-4">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-40">
          <div className="w-7 h-7 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          {/* Organization */}
          <Card>
            <CardHeader className="flex items-center gap-2">
              <Building2 className="w-4 h-4 text-gray-500" />
              <h2 className="text-base font-semibold text-gray-800">Organization</h2>
            </CardHeader>
            <CardBody className="flex flex-col gap-4">
              <Input
                label="Organization Name"
                value={data.orgName}
                onChange={e => update('orgName', e.target.value)}
                hint="Shown on the login page and PDF exports."
              />
              <Input
                label="QA Team Email"
                type="email"
                value={data.qaTeamEmail}
                onChange={e => update('qaTeamEmail', e.target.value)}
                placeholder="qa@cranberry.com.my"
                hint="Inbound notifications will be sent here once the email backend is configured."
              />
            </CardBody>
          </Card>

          {/* Notifications */}
          <Card>
            <CardHeader className="flex items-center gap-2">
              <Mail className="w-4 h-4 text-gray-500" />
              <h2 className="text-base font-semibold text-gray-800">Notifications</h2>
            </CardHeader>
            <CardBody className="flex flex-col gap-3">
              <p className="text-xs text-gray-500 -mt-1 mb-1">
                Requires the email backend (Express service) to be running. Toggling here is safe; nothing fires until the backend is connected.
              </p>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={data.notifyOnNewComplaint} onChange={e => update('notifyOnNewComplaint', e.target.checked)}
                  className="w-4 h-4 rounded text-blue-600" />
                <span className="text-sm text-gray-700">Notify QA team when a new internal complaint is recorded</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={data.notifyOnNewInspection} onChange={e => update('notifyOnNewInspection', e.target.checked)}
                  className="w-4 h-4 rounded text-blue-600" />
                <span className="text-sm text-gray-700">Notify QA team when a new internal inspection request is submitted</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={data.notifyOnPublicSubmission} onChange={e => update('notifyOnPublicSubmission', e.target.checked)}
                  className="w-4 h-4 rounded text-blue-600" />
                <span className="text-sm text-gray-700">Notify QA team when a public submission arrives</span>
              </label>
            </CardBody>
          </Card>

          {/* Email templates */}
          <Card>
            <CardHeader className="flex items-center gap-2">
              <Mail className="w-4 h-4 text-gray-500" />
              <h2 className="text-base font-semibold text-gray-800">Email Templates</h2>
            </CardHeader>
            <CardBody className="flex flex-col gap-4">
              <p className="text-xs text-gray-500 -mt-1">
                Use placeholders like <code className="bg-gray-100 px-1 rounded">{'{{complaintNo}}'}</code>,{' '}
                <code className="bg-gray-100 px-1 rounded">{'{{recordedBy}}'}</code>,{' '}
                <code className="bg-gray-100 px-1 rounded">{'{{reviewNotes}}'}</code>,{' '}
                <code className="bg-gray-100 px-1 rounded">{'{{inspectionDate}}'}</code>.
                Replaced by the email backend at send time.
              </p>

              <Textarea label="Complaint — Accepted" rows={6} value={data.complaintAcceptTemplate}
                onChange={e => update('complaintAcceptTemplate', e.target.value)} />
              <Textarea label="Complaint — Rejected" rows={6} value={data.complaintRejectTemplate}
                onChange={e => update('complaintRejectTemplate', e.target.value)} />
              <Textarea label="Inspection — Accepted" rows={6} value={data.inspectionAcceptTemplate}
                onChange={e => update('inspectionAcceptTemplate', e.target.value)} />
              <Textarea label="Inspection — Rejected" rows={6} value={data.inspectionRejectTemplate}
                onChange={e => update('inspectionRejectTemplate', e.target.value)} />
            </CardBody>
          </Card>

          {/* Auth info (read-only) */}
          <Card>
            <CardHeader className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-gray-500" />
              <h2 className="text-base font-semibold text-gray-800">Authentication</h2>
            </CardHeader>
            <CardBody className="flex flex-col gap-3 text-sm">
              <Row label="Provider" value="Microsoft (Entra ID)" />
              <Row label="Tenant ID" value={import.meta.env.VITE_MS_TENANT_ID || 'Not set — any Microsoft account can sign in'} />
              <Row label="Firebase Project" value={import.meta.env.VITE_FIREBASE_PROJECT_ID} />
              <a
                href={`https://console.firebase.google.com/project/${import.meta.env.VITE_FIREBASE_PROJECT_ID}/authentication/providers`}
                target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-blue-600 hover:underline text-xs mt-1"
              >
                Manage providers in Firebase Console <ExternalLink className="w-3 h-3" />
              </a>
              <p className="text-xs text-gray-500 mt-2">
                These values are read from <code className="bg-gray-100 px-1 rounded">.env.local</code> at build time. To change them,
                update the env file and rebuild.
              </p>
            </CardBody>
          </Card>

          {data.updatedBy && data.updatedAt && (
            <p className="text-xs text-gray-400 text-center">
              Last updated by {data.updatedBy}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 py-1.5 border-b border-gray-100 last:border-0">
      <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</span>
      <span className="text-sm text-gray-900 font-mono truncate">{value}</span>
    </div>
  );
}
