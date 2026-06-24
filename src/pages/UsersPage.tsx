import { useEffect, useState } from 'react';
import { getUsers, listInvites, createInvite, deleteInvite } from '@/lib/db';
import type { AppUser, Invite, UserRole } from '@/types';
import { ROLE_LABELS } from '@/types';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Input, Select } from '@/components/ui/Input';
import { fmtDate } from '@/lib/utils';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Mail, Plus, Trash2 } from 'lucide-react';

const ROLES: UserRole[] = ['admin', 'manager', 'qa', 'viewer'];

export function UsersPage() {
  const { appUser: me } = useAuth();
  const [users, setUsers] = useState<AppUser[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInvite, setShowInvite] = useState(false);

  const load = async () => {
    setLoading(true);
    const [u, i] = await Promise.all([getUsers(), listInvites()]);
    setUsers(u);
    setInvites(i);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleRoleChange = async (uid: string, role: UserRole) => {
    await updateDoc(doc(db, 'users', uid), { role });
    load();
  };

  const handleDeleteInvite = async (email: string) => {
    if (!confirm(`Revoke invite for ${email}?`)) return;
    await deleteInvite(email);
    load();
  };

  if (me?.role !== 'admin') return <div className="p-6 text-gray-500">Access denied.</div>;

  // Filter out invites for emails that are now active users
  const activeEmails = new Set(users.map(u => u.email.toLowerCase()));
  const pendingInvites = invites.filter(i => !activeEmails.has(i.email.toLowerCase()));

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Users</h1>
          <p className="text-gray-500 mt-0.5">{users.length} active · {pendingInvites.length} pending</p>
        </div>
        <Button onClick={() => setShowInvite(true)} className="self-start sm:self-auto">
          <Plus className="w-4 h-4" /> Invite User
        </Button>
      </div>

      <div className="flex flex-col gap-6">
        {/* Active users */}
        <Card>
          <CardHeader>
            <h2 className="text-base font-semibold text-gray-800">Active Users</h2>
          </CardHeader>
          {loading ? (
            <div className="flex items-center justify-center h-32">
              <div className="w-7 h-7 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : users.length === 0 ? (
            <div className="py-8 text-center text-sm text-gray-500">No active users yet.</div>
          ) : (
            <>
            {/* Mobile: card list */}
            <ul className="sm:hidden divide-y divide-gray-100">
              {users.map(u => (
                <li key={u.uid} className="px-4 py-3 flex flex-col gap-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-medium text-gray-900 truncate">{u.name}</p>
                    {u.uid === me?.uid ? (
                      <span className="px-2.5 py-1 bg-blue-100 text-blue-700 text-xs font-medium rounded-full shrink-0">{ROLE_LABELS[u.role]}</span>
                    ) : (
                      <select
                        value={u.role}
                        onChange={e => handleRoleChange(u.uid, e.target.value as UserRole)}
                        className="text-xs border border-gray-300 rounded px-2 py-1 shrink-0 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      >
                        {ROLES.map(r => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
                      </select>
                    )}
                  </div>
                  <p className="text-xs text-gray-600 truncate">{u.email}</p>
                  <p className="text-xs text-gray-400">Joined {fmtDate(u.createdAt)}</p>
                </li>
              ))}
            </ul>

            {/* Desktop: table */}
            <table className="hidden sm:table w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Name</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Email</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Role</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Joined</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {users.map(u => (
                  <tr key={u.uid} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">{u.name}</td>
                    <td className="px-4 py-3 text-gray-600">{u.email}</td>
                    <td className="px-4 py-3">
                      {u.uid === me?.uid ? (
                        <span className="px-2.5 py-1 bg-blue-100 text-blue-700 text-xs font-medium rounded-full">{ROLE_LABELS[u.role]}</span>
                      ) : (
                        <select
                          value={u.role}
                          onChange={e => handleRoleChange(u.uid, e.target.value as UserRole)}
                          className="text-xs border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        >
                          {ROLES.map(r => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
                        </select>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-500">{fmtDate(u.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            </>
          )}
        </Card>

        {/* Pending invites */}
        <Card>
          <CardHeader className="flex items-center gap-2">
            <Mail className="w-4 h-4 text-gray-500" />
            <h2 className="text-base font-semibold text-gray-800">Pending Invites</h2>
          </CardHeader>
          {pendingInvites.length === 0 ? (
            <div className="py-8 text-center text-sm text-gray-500">No pending invites.</div>
          ) : (
            <>
            {/* Mobile: card list */}
            <ul className="sm:hidden divide-y divide-gray-100">
              {pendingInvites.map(i => (
                <li key={i.email} className="px-4 py-3 flex flex-col gap-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-medium text-gray-900 truncate">{i.email}</p>
                    <div className="flex items-center gap-1 shrink-0">
                      <span className="px-2 py-0.5 bg-gray-100 text-gray-700 text-xs font-medium rounded-full">{ROLE_LABELS[i.role]}</span>
                      <button onClick={() => handleDeleteInvite(i.email)} className="p-1.5 rounded hover:bg-red-50 text-red-500" title="Revoke invite">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  <p className="text-xs text-gray-600 truncate">{i.name || '—'}</p>
                  <p className="text-xs text-gray-400">Invited {fmtDate(i.invitedAt)}</p>
                </li>
              ))}
            </ul>

            {/* Desktop: table */}
            <table className="hidden sm:table w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Email</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Name</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Role</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Invited</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {pendingInvites.map(i => (
                  <tr key={i.email} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-gray-900">{i.email}</td>
                    <td className="px-4 py-3 text-gray-600">{i.name || '—'}</td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 bg-gray-100 text-gray-700 text-xs font-medium rounded-full">{ROLE_LABELS[i.role]}</span>
                    </td>
                    <td className="px-4 py-3 text-gray-500">{fmtDate(i.invitedAt)}</td>
                    <td className="px-4 py-3 text-right">
                      <button onClick={() => handleDeleteInvite(i.email)} className="p-1.5 rounded hover:bg-red-50 text-red-500" title="Revoke invite">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </>
          )}
        </Card>
      </div>

      <Modal open={showInvite} onClose={() => setShowInvite(false)} title="Invite User" size="md">
        <InviteForm onSuccess={() => { setShowInvite(false); load(); }} onCancel={() => setShowInvite(false)} />
      </Modal>
    </div>
  );
}

function InviteForm({ onSuccess, onCancel }: { onSuccess: () => void; onCancel: () => void }) {
  const { appUser } = useAuth();
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState<UserRole>('viewer');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!appUser) return;
    setError('');
    setLoading(true);
    try {
      await createInvite(email.trim(), role, name.trim() || undefined, appUser.name);
      onSuccess();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={submit} className="p-6 flex flex-col gap-4">
      <Input
        label="Microsoft email address *"
        type="email"
        value={email}
        onChange={e => setEmail(e.target.value)}
        placeholder="user@yeelee.com.my"
        required
        autoFocus
      />
      <Input
        label="Display name (optional)"
        value={name}
        onChange={e => setName(e.target.value)}
        placeholder="e.g. Gabriella Lim"
      />
      <Select
        label="Role *"
        value={role}
        onChange={e => setRole(e.target.value as UserRole)}
        options={ROLES.map(r => ({ value: r, label: ROLE_LABELS[r] }))}
      />
      <p className="text-xs text-gray-500">
        The user must sign in with the exact Microsoft email above. Their role is locked in on first sign-in.
      </p>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex justify-end gap-3">
        <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
        <Button type="submit" loading={loading}>Send Invite</Button>
      </div>
    </form>
  );
}
