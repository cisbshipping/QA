import { useAuth } from '@/hooks/useAuth';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { ROLE_LABELS, type UserRole } from '@/types';
import { ShieldCheck, Check, Minus, AlertTriangle } from 'lucide-react';

const ROLES: UserRole[] = ['admin', 'manager', 'qa', 'viewer'];

interface PermissionRow {
  label: string;
  description?: string;
  perms: Record<UserRole, 'yes' | 'no' | 'partial'>;
}

interface PermissionGroup {
  title: string;
  rows: PermissionRow[];
}

const Y = 'yes' as const;
const N = 'no' as const;
const P = 'partial' as const;

const GROUPS: PermissionGroup[] = [
  {
    title: 'Complaints',
    rows: [
      { label: 'View complaints list and details', perms: { admin: Y, manager: Y, qa: Y, viewer: Y } },
      { label: 'Create + edit complaints', perms: { admin: Y, manager: Y, qa: Y, viewer: N } },
      { label: 'Accept / Reject / Close complaints', perms: { admin: Y, manager: Y, qa: Y, viewer: N } },
      { label: 'Log replies from factory', perms: { admin: Y, manager: Y, qa: Y, viewer: N } },
      { label: 'Generate and send PDF to factory', perms: { admin: Y, manager: Y, qa: Y, viewer: N } },
      { label: 'Delete complaints', description: 'Permanent — cannot be undone', perms: { admin: Y, manager: N, qa: N, viewer: N } },
      { label: 'Bulk close / bulk delete', perms: { admin: Y, manager: P, qa: P, viewer: N } },
      { label: 'Reopen closed/rejected complaints', perms: { admin: Y, manager: N, qa: N, viewer: N } },
    ],
  },
  {
    title: 'Inspections',
    rows: [
      { label: 'View inspection requests + calendar', perms: { admin: Y, manager: Y, qa: Y, viewer: Y } },
      { label: 'Create + edit inspection requests', perms: { admin: Y, manager: Y, qa: Y, viewer: N } },
      { label: 'Accept / Reject inspection requests', perms: { admin: Y, manager: Y, qa: Y, viewer: N } },
      { label: 'Record Pass / Fail results', perms: { admin: Y, manager: Y, qa: Y, viewer: N } },
      { label: 'Reschedule inspection date', perms: { admin: Y, manager: N, qa: N, viewer: N } },
      { label: 'Revert last attempt', description: 'Undo a recorded pass or fail', perms: { admin: Y, manager: N, qa: N, viewer: N } },
      { label: 'Reopen passed/failed inspections', perms: { admin: Y, manager: N, qa: N, viewer: N } },
    ],
  },
  {
    title: 'Suppliers / Factories',
    rows: [
      { label: 'View suppliers list', perms: { admin: Y, manager: Y, qa: Y, viewer: Y } },
      { label: 'Add and edit suppliers', perms: { admin: Y, manager: Y, qa: Y, viewer: N } },
      { label: 'Delete suppliers', perms: { admin: Y, manager: N, qa: N, viewer: N } },
    ],
  },
  {
    title: 'Public Submissions (Inbox)',
    rows: [
      { label: 'View inbox of public submissions', perms: { admin: Y, manager: Y, qa: Y, viewer: N } },
      { label: 'Process / Dismiss public submissions', perms: { admin: Y, manager: Y, qa: Y, viewer: N } },
    ],
  },
  {
    title: 'Users & Roles',
    rows: [
      { label: 'View users list', perms: { admin: Y, manager: N, qa: N, viewer: N } },
      { label: 'Invite new users + assign role', perms: { admin: Y, manager: N, qa: N, viewer: N } },
      { label: 'Change other users\' roles', perms: { admin: Y, manager: N, qa: N, viewer: N } },
      { label: 'Revoke pending invites', perms: { admin: Y, manager: N, qa: N, viewer: N } },
    ],
  },
  {
    title: 'Settings & Audit',
    rows: [
      { label: 'View Settings page', perms: { admin: Y, manager: N, qa: N, viewer: N } },
      { label: 'Edit company list (entities)', perms: { admin: Y, manager: N, qa: N, viewer: N } },
      { label: 'Upload / replace letterheads', perms: { admin: Y, manager: N, qa: N, viewer: N } },
      { label: 'Edit email templates', perms: { admin: Y, manager: N, qa: N, viewer: N } },
      { label: 'View Audit Logs', perms: { admin: Y, manager: N, qa: N, viewer: N } },
    ],
  },
];

export function PermissionsPage() {
  const { appUser } = useAuth();
  const myRole = appUser?.role;

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <ShieldCheck className="w-6 h-6" /> User Permissions
        </h1>
        <p className="text-gray-500 mt-0.5">
          What each role can do in the system. {myRole && (
            <>You are signed in as <span className="font-semibold text-blue-700">{ROLE_LABELS[myRole]}</span>.</>
          )}
        </p>
      </div>

      {/* Role description card */}
      <Card className="mb-6">
        <CardHeader>
          <h2 className="font-semibold text-gray-800">Role Overview</h2>
        </CardHeader>
        <CardBody>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <RoleCard
              role="admin"
              isMe={myRole === 'admin'}
              summary="Full control of the system — operational work plus user management, settings, audit logs, and the ability to undo any action."
            />
            <RoleCard
              role="manager"
              isMe={myRole === 'manager'}
              summary="Operational lead. Same as QA, but typically has broader oversight. Cannot manage users or system settings."
            />
            <RoleCard
              role="qa"
              isMe={myRole === 'qa'}
              summary="Day-to-day quality work. Creates and reviews complaints + inspections, processes the public inbox, manages suppliers."
            />
            <RoleCard
              role="viewer"
              isMe={myRole === 'viewer'}
              summary="Read-only access. Useful for stakeholders who need to see status without editing anything."
            />
          </div>
        </CardBody>
      </Card>

      {/* Permission matrix */}
      <div className="flex flex-col gap-6">
        {GROUPS.map(group => (
          <Card key={group.title}>
            <CardHeader>
              <h2 className="font-semibold text-gray-800">{group.title}</h2>
            </CardHeader>
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
                  {group.rows.map((row, i) => (
                    <tr key={i} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-gray-900">
                        <p>{row.label}</p>
                        {row.description && <p className="text-xs text-gray-500 mt-0.5">{row.description}</p>}
                      </td>
                      {ROLES.map(r => (
                        <td key={r} className={`px-4 py-3 text-center ${myRole === r ? 'bg-blue-50/30' : ''}`}>
                          <PermIcon value={row.perms[r]} />
                        </td>
                      ))}
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
          <span className="inline-flex items-center gap-1"><AlertTriangle className="w-4 h-4 text-amber-500" /> Partial (some actions restricted)</span>
          <span className="inline-flex items-center gap-1"><Minus className="w-4 h-4 text-gray-300" /> Not allowed</span>
        </div>
      </div>

      <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-900">
        <p className="font-semibold mb-1">Need a different role?</p>
        <p>Contact an admin. They can adjust your role from <span className="font-medium">Settings → Users</span>. Audit logs record every role change for accountability.</p>
      </div>
    </div>
  );
}

function PermIcon({ value }: { value: 'yes' | 'no' | 'partial' }) {
  if (value === 'yes') return <Check className="w-4 h-4 text-green-600 mx-auto" />;
  if (value === 'partial') return <AlertTriangle className="w-4 h-4 text-amber-500 mx-auto" />;
  return <Minus className="w-4 h-4 text-gray-300 mx-auto" />;
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
