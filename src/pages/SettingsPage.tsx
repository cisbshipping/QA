import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input, Textarea } from '@/components/ui/Input';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Building2, Mail, ShieldCheck, Save, Check, AlertCircle, ExternalLink, FileImage, Upload, Trash2 } from 'lucide-react';
import { YL_COMPANIES, type Letterhead } from '@/types';
import { listLetterheads, saveLetterhead, deleteLetterhead, getCompaniesSetting, saveCompaniesSetting } from '@/lib/db';
import { refreshCompaniesCache, useCompanies } from '@/hooks/useCompanies';
import { X as XIcon, Plus } from 'lucide-react';

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
    <div className="p-4 sm:p-6 max-w-4xl mx-auto">
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

          {/* Companies */}
          <CompaniesCard />

          {/* Letterheads */}
          <LetterheadsCard />

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

// -------------------- Companies card --------------------
function CompaniesCard() {
  const [list, setList] = useState<string[]>([]);
  const [newName, setNewName] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const saved = await getCompaniesSetting();
        if (saved && saved.length > 0) setList(saved);
        else setList([...YL_COMPANIES]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const persist = async (next: string[]) => {
    setSaving(true);
    setError('');
    try {
      await saveCompaniesSetting(next);
      setList(next);
      refreshCompaniesCache(next);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const handleAdd = () => {
    const n = newName.trim();
    if (!n || list.includes(n)) return;
    persist([...list, n]);
    setNewName('');
  };

  const handleRemove = (name: string) => {
    if (!confirm(`Remove "${name}" from the company list?`)) return;
    persist(list.filter(x => x !== name));
  };

  return (
    <Card>
      <CardHeader className="flex items-center gap-2">
        <Building2 className="w-4 h-4 text-gray-500" />
        <h2 className="text-base font-semibold text-gray-800">Company Entities</h2>
      </CardHeader>
      <CardBody className="flex flex-col gap-3">
        <p className="text-xs text-gray-500 -mt-1">
          Companies shown in the Company / Letterhead dropdowns on the Complaint and Inspection forms.
        </p>

        {error && <p className="text-sm text-red-600">{error}</p>}

        {loading ? (
          <div className="py-6 flex items-center justify-center">
            <div className="w-6 h-6 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <ul className="flex flex-col gap-1">
            {list.map(name => (
              <li key={name} className="flex items-center justify-between bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
                <span className="text-sm text-gray-900">{name}</span>
                <button
                  onClick={() => handleRemove(name)}
                  disabled={saving}
                  className="p-1 rounded hover:bg-red-50 text-red-500 disabled:opacity-50"
                  title="Remove"
                >
                  <XIcon className="w-4 h-4" />
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="flex gap-2">
          <input
            type="text"
            placeholder="New company name…"
            value={newName}
            onChange={e => setNewName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAdd(); } }}
            className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <Button type="button" size="sm" onClick={handleAdd} disabled={!newName.trim() || saving}>
            <Plus className="w-4 h-4" /> Add
          </Button>
        </div>
      </CardBody>
    </Card>
  );
}

// -------------------- Letterheads card --------------------
const MAX_LETTERHEAD_BYTES = 500 * 1024; // 500 KB

function LetterheadsCard() {
  const { appUser } = useAuth();
  const [letterheads, setLetterheads] = useState<Letterhead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyCompany, setBusyCompany] = useState<string>('');
  const companies = useCompanies();

  const load = async () => {
    setLoading(true);
    try { setLetterheads(await listLetterheads()); }
    catch (e) { setError((e as Error).message); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const byCompany = (c: string) => letterheads.find(l => l.company === c);

  const handleUpload = async (company: string, file: File) => {
    setError('');
    if (!file.type.startsWith('image/')) {
      setError(`${file.name} is not an image.`);
      return;
    }
    if (file.size > MAX_LETTERHEAD_BYTES) {
      setError(`${file.name} is over 500 KB. Compress or resize first.`);
      return;
    }
    setBusyCompany(company);
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(file);
      });
      await saveLetterhead(company, dataUrl, appUser?.name ?? 'admin');
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusyCompany('');
    }
  };

  const handleDelete = async (company: string) => {
    if (!confirm(`Remove letterhead for ${company}?`)) return;
    setBusyCompany(company);
    await deleteLetterhead(company);
    await load();
    setBusyCompany('');
  };

  return (
    <Card>
      <CardHeader className="flex items-center gap-2">
        <FileImage className="w-4 h-4 text-gray-500" />
        <h2 className="text-base font-semibold text-gray-800">Company Letterheads</h2>
      </CardHeader>
      <CardBody className="flex flex-col gap-4">
        <p className="text-xs text-gray-500 -mt-1">
          Upload one letterhead image (PNG / JPG) per company. Used as the header on PDF complaint exports.
          Max 500 KB each. For best results, use a wide horizontal image around 1500 × 300 px.
        </p>

        {error && (
          <div className="flex items-start gap-2 text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="w-7 h-7 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {companies.map(company => (
              <LetterheadRow
                key={company}
                company={company}
                existing={byCompany(company)}
                busy={busyCompany === company}
                onUpload={(file) => handleUpload(company, file)}
                onDelete={() => handleDelete(company)}
              />
            ))}
          </div>
        )}
      </CardBody>
    </Card>
  );
}

function LetterheadRow({ company, existing, busy, onUpload, onDelete }:
  { company: string; existing?: Letterhead; busy: boolean; onUpload: (f: File) => void; onDelete: () => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <div className="flex items-center gap-3 border border-gray-200 rounded-lg p-3">
      <div className="w-32 h-16 bg-gray-50 border border-gray-200 rounded flex items-center justify-center overflow-hidden shrink-0">
        {existing
          ? <img src={existing.dataUrl} alt={company} className="max-w-full max-h-full object-contain" />
          : <span className="text-xs text-gray-400">No letterhead</span>}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 truncate">{company}</p>
        {existing && (
          <p className="text-xs text-gray-500 truncate">Uploaded by {existing.uploadedBy}</p>
        )}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={e => {
            const f = e.target.files?.[0];
            if (f) onUpload(f);
            if (inputRef.current) inputRef.current.value = '';
          }}
        />
        <Button type="button" variant="outline" size="sm" loading={busy} onClick={() => inputRef.current?.click()}>
          <Upload className="w-4 h-4" /> {existing ? 'Replace' : 'Upload'}
        </Button>
        {existing && (
          <button onClick={onDelete} disabled={busy} className="p-1.5 rounded hover:bg-red-50 text-red-500 disabled:opacity-50" title="Remove">
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}
