import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { usePermissions, DEFAULT_PERMISSIONS } from '@/hooks/usePermissions';
import { savePermissionsConfig, type PermissionConfig } from '@/lib/db';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { ROLE_LABELS, type UserRole } from '@/types';
import { ShieldCheck, Check, Minus, AlertTriangle, Save, RotateCcw, Lock } from 'lucide-react';

const ROLES: UserRole[] = ['admin', 'manager', 'qa', 'viewer'];

interface PermissionRow {
  key: string;
  label: string;
  description?: string;
}

interface PermissionGroup {
  title: string;
  rows: PermissionRow[];
}

const GROUPS: PermissionGroup[] = [
  {
    title: 'Complaints',
    rows: [
      { key: 'complaint.view', label: 'View complaints list and details' },
      { key: 'complaint.create', label: 'Create + edit complaints' },
      { key: 'complaint.review', label: 'Accept / Reject / Close complaints' },
      { key: 'complaint.logReply', label: 'Log replies from factory' },
      { key: 'complaint.sendEmail', label: 'Generate and send PDF to factory' },
      { key: 'complaint.delete', label: 'Delete complaints', description: 'Permanent — cannot be undone' },
      { key: 'complaint.bulkClose', label: 'Bulk close complaints' },
      { key: 'complaint.bulkDelete', label: 'Bulk delete complaints' },
      { key: 'complaint.reopen', label: 'Reopen closed/rejected complaints' },
    ],
  },
  {
    title: 'Inspections',
    rows: [
      { key: 'inspection.view', label: 'View inspection requests + calendar' },
      { key: 'inspection.create', label: 'Create + edit inspection requests' },
      { key: 'inspection.review', label: 'Accept / Reject inspection requests' },
      { key: 'inspection.result', label: 'Record Pass / Fail results' },
      { key: 'inspection.reschedule', label: 'Reschedule inspection date' },
      { key: 'inspection.revert', label: 'Revert last attempt', description: 'Undo a recorded pass or fail' },
      { key: 'inspection.reopen', label: 'Reopen passed/failed inspections' },
    ],
  },
  {
    title: 'Suppliers / Factories',
    rows: [
      { key: 'supplier.view', label: 'View suppliers list' },
      { key: 'supplier.edit', label: 'Add and edit suppliers' },
      { key: 'supplier.delete', label: 'Delete suppliers' },
    ],
  },
  {
    title: 'Public Submissions (Inbox)',
    rows: [
      { key: 'inbox.view', label: 'View inbox of public submissions' },
      { key: 'inbox.process', label: 'Process / Dismiss public submissions' },
    ],
  },
  {
    title: 'Users & Roles',
    rows: [
      { key: 'user.view', label: 'View users list' },
      { key: 'user.invite', label: 'Invite new users + assign role' },
      { key: 'user.changeRole', label: 'Change other users\' roles' },
    ],
  },
  {
    title: 'Settings & Audit',
    rows: [
      { key: 'settings.view', label: 'View Settings page' },
      { key: 'settings.editCompanies', label: 'Edit company list (entities)' },
      { key: 'settings.editLetterheads', label: 'Upload / replace letterheads' },
      { key: 'settings.editTemplates', label: 'Edit email templates' },
      { key: 'settings.editPermissions', label: 'Edit role permissions (this page)', description: 'Always restricted to admin' },
      { key: 'audit.view', label: 'View Audit Logs' },
    ],
  },
];

// Keys that should never be unlocked — these are admin-only no matter what.
const LOCKED_KEYS = new Set(['settings.editPermissions', 'user.view', 'user.invite', 'user.changeRole']);

export function PermissionsPage() {
  const { appUser } = useAuth();
  const { config: liveConfig, refresh, isLoading } = usePermissions();
  const [draft, setDraft] = useState<PermissionConfig>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  const myRole = appUser?.role;
  const isAdmin = myRole === 'admin';

  // Sync draft with live config whenever it loads/refreshes.
  useEffect(() => {
    if (!isLoading) setDraft({ ...liveConfig });
  }, [liveConfig, isLoading]);

  const isAllowed = (key: string, role: UserRole): boolean => draft[key]?.includes(role) ?? false;

  const toggle = (key: string, role: UserRole) => {
    if (!isAdmin) return;
    if (LOCKED_KEYS.has(key) && role !== 'admin') return; // can't unlock or remove locked-admin keys
    if (key === 'settings.editPermissions' && role === 'admin') return; // admin can never lose access here
    setDraft(d => {
      const current = d[key] ?? [];
      const next = current.includes(role) ? current.filter(r => r !== role) : [...current, role];
      return { ...d, [key]: next };
    });
    setSaved(false);
  };

  const hasChanges = JSON.stringify(draft) !== JSON.stringify(liveConfig);

  const handleSave = async () => {
    if (!appUser) return;
    setSaving(true);
    setError('');
    try {
      await savePermissionsConfig(draft, appUser.name);
      await refresh();
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const handleResetToDefaults = () => {
    if (!confirm('Reset all permissions to the system defaults? Your changes will be lost.')) return;
    setDraft({ ...DEFAULT_PERMISSIONS });
  };

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <ShieldCheck className="w-6 h-6" /> User Permissions
          </h1>
          <p className="text-gray-500 mt-0.5">
            {isAdmin
              ? 'Click any cell to toggle who can perform that action.'
              : 'What each role can do in the system.'}
            {myRole && <> You are signed in as <span className="font-semibold text-blue-700">{ROLE_LABELS[myRole]}</span>.</>}
          </p>
        </div>
        {isAdmin && (
          <div className="flex items-center gap-2">
            {saved && (
              <span className="flex items-center gap-1 text-sm text-green-600">
                <Check className="w-4 h-4" /> Saved
              </span>
            )}
            <Button variant="outline" size="sm" onClick={handleResetToDefaults} disabled={saving}>
              <RotateCcw className="w-4 h-4" /> Defaults
            </Button>
            <Button size="sm" loading={saving} onClick={handleSave} disabled={!hasChanges}>
              <Save className="w-4 h-4" /> Save
            </Button>
          </div>
        )}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700 mb-4">{error}</div>
      )}

      {hasChanges && isAdmin && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-900 mb-4">
          You have unsaved changes. Click <span className="font-semibold">Save</span> to apply them.
        </div>
      )}

      {/* Role overview */}
      <Card className="mb-6">
        <CardHeader><h2 className="font-semibold text-gray-800">Role Overview</h2></CardHeader>
        <CardBody>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <RoleCard role="admin" isMe={myRole === 'admin'} summary="Full control — operational work plus user management, settings, audit logs, and the ability to undo any action." />
            <RoleCard role="manager" isMe={myRole === 'manager'} summary="Operational lead. Same as QA but typically broader oversight. Cannot manage users or system settings." />
            <RoleCard role="qa" isMe={myRole === 'qa'} summary="Day-to-day quality work. Creates and reviews complaints + inspections, processes the public inbox, manages suppliers." />
            <RoleCard role="viewer" isMe={myRole === 'viewer'} summary="Read-only access. For stakeholders who need to see status without editing." />
          </div>
        </CardBody>
      </Card>

      {/* Permission matrix */}
      <div className="flex flex-col gap-6">
        {GROUPS.map(group => (
          <Card key={group.title}>
            <CardHeader><h2 className="font-semibold text-gray-800">{group.title}</h2></CardHeader>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50">
                    <th className="text-left px-4 py-3 font-medium text-gray-600 w-1/2">Action</th>
                    {ROLES.map(r => (
                      <th key={r} className={`text-center px-4 py-3 font-medium ${myRole === r ? 'text-blue-700' : 'text-gray-600'}`}>
                        {ROLE_LABELS[r]}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {group.rows.map(row => (
                    <tr key={row.key} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-gray-900">
                        <p>{row.label}</p>
                        {row.description && <p className="text-xs text-gray-500 mt-0.5">{row.description}</p>}
                      </td>
                      {ROLES.map(r => {
                        const allowed = isAllowed(row.key, r);
                        const locked = LOCKED_KEYS.has(row.key) && r !== 'admin';
                        const lockedSelf = row.key === 'settings.editPermissions' && r === 'admin';
                        return (
                          <td key={r} className={`px-4 py-3 text-center ${myRole === r ? 'bg-blue-50/30' : ''}`}>
                            {isAdmin && !locked && !lockedSelf ? (
                              <button
                                type="button"
                                onClick={() => toggle(row.key, r)}
                                className={`inline-flex items-center justify-center w-7 h-7 rounded transition-colors ${allowed ? 'bg-green-100 hover:bg-green-200 text-green-700' : 'bg-gray-100 hover:bg-gray-200 text-gray-400'}`}
                                title={allowed ? 'Click to deny' : 'Click to allow'}
                              >
                                {allowed ? <Check className="w-4 h-4" /> : <Minus className="w-4 h-4" />}
                              </button>
                            ) : (
                              <span className="inline-flex items-center justify-center w-7 h-7 rounded text-gray-400" title={locked || lockedSelf ? 'Locked: admin-only' : ''}>
                                {allowed
                                  ? <Check className="w-4 h-4 text-green-600" />
                                  : <Minus className="w-4 h-4 text-gray-300" />}
                                {(locked || lockedSelf) && <Lock className="w-3 h-3 ml-0.5 text-gray-400" />}
                              </span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        ))}

        {/* Legend */}
        <div className="text-xs text-gray-500 flex items-center gap-4 flex-wrap pl-1">
          <span className="inline-flex items-center gap-1"><Check className="w-4 h-4 text-green-600" /> Allowed</span>
          <span className="inline-flex items-center gap-1"><Minus className="w-4 h-4 text-gray-300" /> Not allowed</span>
          <span className="inline-flex items-center gap-1"><Lock className="w-3 h-3 text-gray-400" /> Locked to admin only</span>
          {isAdmin && <span className="inline-flex items-center gap-1 ml-2"><AlertTriangle className="w-3.5 h-3.5 text-amber-500" /> Click cells to toggle</span>}
        </div>
      </div>

      <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-900">
        <p className="font-semibold mb-1">Important notes</p>
        <ul className="list-disc list-inside text-sm flex flex-col gap-1">
          <li>Changes affect <span className="font-semibold">UI controls</span> immediately. Users may need to refresh.</li>
          <li>Firestore security rules (server-side) remain the final security boundary — the matrix relaxes/restricts what users see, not what the database accepts.</li>
          <li>User management actions (View / Invite / Change Role) and editing this Permissions page are always admin-only and can't be unlocked.</li>
          <li>Every change is recorded in the audit log under the admin who saved it.</li>
        </ul>
      </div>
    </div>
  );
}

function RoleCard({ role, isMe, summary }: { role: UserRole; isMe: boolean; summary: string }) {
  return (
    <div className={`border rounded-lg p-3 ${isMe ? 'border-blue-300 bg-blue-50/30' : 'border-gray-200 bg-white'}`}>
      <div className="flex items-center justify-between mb-1">
        <span className="font-semibold text-gray-900">{ROLE_LABELS[role]}</span>
        {isMe && <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full font-medium">You</span>}
      </div>
      <p className="text-xs text-gray-600 leading-relaxed">{summary}</p>
    </div>
  );
}
