import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuth } from '@/hooks/useAuth';
import { listSuppliers, createSupplier, updateSupplier, deleteSupplier } from '@/lib/db';
import type { Supplier } from '@/types';
import { Card, CardBody, CardFooter } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input, Textarea } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { fmtDate } from '@/lib/utils';
import { Plus, Pencil, Trash2, Mail, Phone, Search, Building2 } from 'lucide-react';

export function SuppliersPage() {
  const { appUser } = useAuth();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Supplier | undefined>();
  const [search, setSearch] = useState('');

  const load = async () => {
    setLoading(true);
    setSuppliers(await listSuppliers());
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const canEdit = appUser?.role === 'admin' || appUser?.role === 'manager' || appUser?.role === 'qa';

  const filtered = suppliers.filter(s => {
    const q = search.toLowerCase();
    return !q || s.name.toLowerCase().includes(q) || s.email.toLowerCase().includes(q)
      || (s.contactPerson?.toLowerCase().includes(q) ?? false);
  });

  const handleDelete = async (s: Supplier) => {
    if (!confirm(`Delete supplier "${s.name}"?`)) return;
    await deleteSupplier(s.id);
    load();
  };

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Building2 className="w-6 h-6" /> Factories &amp; Suppliers
          </h1>
          <p className="text-gray-500 mt-0.5">{suppliers.length} total · used for complaint emails</p>
        </div>
        {canEdit && (
          <Button onClick={() => { setEditing(undefined); setShowForm(true); }}>
            <Plus className="w-4 h-4" /> New Supplier
          </Button>
        )}
      </div>

      <div className="relative max-w-sm mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text" placeholder="Search by name, email, contact..."
          value={search} onChange={e => setSearch(e.target.value)}
          className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <Card>
        {loading ? (
          <div className="flex items-center justify-center h-40">
            <div className="w-7 h-7 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center text-gray-500 text-sm">No suppliers yet. Click "+ New Supplier" to add the first one.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Name</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Email</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Contact Person</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Phone</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Added</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map(s => (
                  <tr key={s.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">{s.name}</td>
                    <td className="px-4 py-3 text-gray-600">
                      <a href={`mailto:${s.email}`} className="text-blue-600 hover:underline flex items-center gap-1">
                        <Mail className="w-3.5 h-3.5" /> {s.email}
                      </a>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{s.contactPerson || '—'}</td>
                    <td className="px-4 py-3 text-gray-600">
                      {s.phone ? <span className="flex items-center gap-1"><Phone className="w-3.5 h-3.5" />{s.phone}</span> : '—'}
                    </td>
                    <td className="px-4 py-3 text-gray-500">{fmtDate(s.createdAt)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        {canEdit && (
                          <button onClick={() => { setEditing(s); setShowForm(true); }} className="p-1.5 rounded hover:bg-gray-100 text-gray-500" title="Edit">
                            <Pencil className="w-4 h-4" />
                          </button>
                        )}
                        {appUser?.role === 'admin' && (
                          <button onClick={() => handleDelete(s)} className="p-1.5 rounded hover:bg-red-50 text-red-500" title="Delete">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Modal open={showForm} onClose={() => setShowForm(false)} title={editing ? 'Edit Supplier' : 'New Supplier'} size="lg">
        <SupplierForm existing={editing} onSuccess={() => { setShowForm(false); load(); }} onCancel={() => setShowForm(false)} />
      </Modal>
    </div>
  );
}

const schema = z.object({
  name: z.string().min(1, 'Required'),
  email: z.string().email('Invalid email'),
  contactPerson: z.string().optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
  notes: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

function SupplierForm({ existing, onSuccess, onCancel }: { existing?: Supplier; onSuccess: () => void; onCancel: () => void }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema) as any,
    defaultValues: existing
      ? { name: existing.name, email: existing.email, contactPerson: existing.contactPerson ?? '',
          phone: existing.phone ?? '', address: existing.address ?? '', notes: existing.notes ?? '' }
      : {},
  });

  const onSubmit = async (data: FormData) => {
    setLoading(true);
    setError('');
    try {
      if (existing) {
        await updateSupplier(existing.id, data);
      } else {
        await createSupplier(data);
      }
      onSuccess();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <CardBody className="flex flex-col gap-4">
        <Input label="Factory / Supplier Name *" error={errors.name?.message} {...register('name')} />
        <Input label="Email *" type="email" error={errors.email?.message} {...register('email')} hint="Used for sending complaint PDFs" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input label="Contact Person" {...register('contactPerson')} />
          <Input label="Phone" {...register('phone')} />
        </div>
        <Input label="Address" {...register('address')} />
        <Textarea label="Notes" rows={2} {...register('notes')} />
        {error && <p className="text-sm text-red-600">{error}</p>}
      </CardBody>
      <CardFooter className="flex justify-end gap-3">
        <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
        <Button type="submit" loading={loading}>{existing ? 'Update' : 'Create'}</Button>
      </CardFooter>
    </form>
  );
}
