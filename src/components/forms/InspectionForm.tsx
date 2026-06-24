import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuth } from '@/hooks/useAuth';
import { createInspection, updateInspection, listSuppliers } from '@/lib/db';
import { INSPECTION_FOCUS_AREAS, type Inspection, type YLCompany, type AqlLevel, type InspectorType, type Supplier } from '@/types';
import { useCompanies } from '@/hooks/useCompanies';
import { Button } from '@/components/ui/Button';
import { Input, Textarea, Select } from '@/components/ui/Input';
import { CardBody, CardFooter } from '@/components/ui/Card';

const schema = z.object({
  department: z.string().min(1, 'Required'),
  company: z.string().min(1, 'Required'),
  customer: z.string().min(1, 'Required'),
  customerCountry: z.string().optional(),
  customerPiNo: z.string().min(1, 'Required'),
  supplierPoNo: z.string().min(1, 'Required'),
  factoryId: z.string().min(1, 'Pick a supplier'),
  factoryCommitDate: z.string().min(1, 'Required'),
  totalQtyCartons: z.string().min(1, 'Required'),
  product: z.string().min(1, 'Required'),
  productStandard: z.string().optional(),
  productGrade: z.string().optional(),
  containerSize: z.string().optional(),
  reasonForRequest: z.string().min(1, 'Required'),
  focusAreas: z.array(z.string()),
  focusOthers: z.string().optional(),
  aqlLevel: z.string().min(1, 'Required'),
  aqlOther: z.string().optional(),
  inspectorTypes: z.array(z.string()).min(1, 'Select at least one inspector type'),
  remarks: z.string().optional(),
  needsPsiReport: z.boolean(),
  requestedByName: z.string().min(1, 'Required'),
  requestedByDate: z.string().min(1, 'Required'),
});

type FormData = z.infer<typeof schema>;

interface Props {
  existing?: Inspection;
  onSuccess: () => void;
  onCancel: () => void;
}

const AQL_OPTIONS = [
  { value: 'G1/AQL 1.5', label: 'G1 / AQL 1.5' },
  { value: 'G1/AQL 2.5', label: 'G1 / AQL 2.5' },
  { value: 'G1/AQL 4.0', label: 'G1 / AQL 4.0' },
  { value: 'other', label: 'Other' },
];

const INSPECTOR_OPTIONS = [
  { value: 'in-house', label: 'In-house QA' },
  { value: 'pic', label: 'PIC' },
  { value: 'third-party', label: 'Third Party Inspector (USD 250/inspection)' },
];

export function InspectionForm({ existing, onSuccess, onCancel }: Props) {
  const { user, appUser } = useAuth();
  const [loading, setLoading] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loadingSuppliers, setLoadingSuppliers] = useState(true);
  const companies = useCompanies();

  useEffect(() => {
    listSuppliers()
      .then(setSuppliers)
      .finally(() => setLoadingSuppliers(false));
  }, []);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { register, handleSubmit, control, watch, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema) as any,
    defaultValues: existing
      ? {
          department: existing.department,
          company: existing.company,
          customer: existing.customer,
          customerCountry: existing.customerCountry ?? '',
          customerPiNo: existing.customerPiNo,
          supplierPoNo: existing.supplierPoNo,
          factoryId: existing.factoryId ?? '',
          factoryCommitDate: existing.factoryCommitDate.toISOString().slice(0, 10),
          totalQtyCartons: String(existing.totalQtyCartons),
          product: existing.product,
          productStandard: existing.productStandard ?? '',
          productGrade: existing.productGrade ?? '',
          containerSize: existing.containerSize ?? '',
          reasonForRequest: existing.reasonForRequest,
          focusAreas: existing.focusAreas,
          focusOthers: existing.focusOthers ?? '',
          aqlLevel: existing.aqlLevel,
          aqlOther: existing.aqlOther ?? '',
          inspectorTypes: existing.inspectorTypes,
          remarks: existing.remarks ?? '',
          needsPsiReport: existing.needsPsiReport,
          requestedByName: existing.requestedByName,
          requestedByDate: existing.requestedByDate.toISOString().slice(0, 10),
        }
      : {
          department: appUser?.department ?? '',
          requestedByName: appUser?.name ?? '',
          requestedByDate: new Date().toISOString().slice(0, 10),
          needsPsiReport: false,
          focusAreas: [],
          inspectorTypes: [],
        },
  });

  const aqlLevel = watch('aqlLevel');
  const focusAreas = watch('focusAreas') as string[];

  const onSubmit = async (data: FormData) => {
    if (!user || !appUser) {
      setSubmitError('You are not signed in. Please refresh and try again.');
      return;
    }
    setLoading(true);
    setSubmitError('');
    try {
      const raw = {
        picName: appUser.name,
        picUid: user.uid,
        department: data.department,
        dateRequested: existing?.dateRequested ?? new Date(),
        company: data.company as YLCompany,
        customer: data.customer,
        customerCountry: data.customerCountry,
        customerPiNo: data.customerPiNo,
        supplierPoNo: data.supplierPoNo,
        factory: suppliers.find(s => s.id === data.factoryId)?.name ?? existing?.factory ?? '',
        factoryId: data.factoryId,
        factoryCommitDate: new Date(data.factoryCommitDate),
        totalQtyCartons: Number(data.totalQtyCartons),
        product: data.product,
        productStandard: data.productStandard,
        productGrade: data.productGrade,
        containerSize: data.containerSize,
        reasonForRequest: data.reasonForRequest,
        focusAreas: data.focusAreas,
        focusOthers: data.focusOthers,
        aqlLevel: data.aqlLevel as AqlLevel,
        aqlOther: data.aqlOther,
        inspectorTypes: data.inspectorTypes as InspectorType[],
        remarks: data.remarks,
        needsPsiReport: data.needsPsiReport,
        requestedByName: data.requestedByName,
        requestedByDate: new Date(data.requestedByDate),
        status: (existing?.status ?? 'pending') as Inspection['status'],
      };

      const payload = Object.fromEntries(
        Object.entries(raw).filter(([, v]) => v !== undefined && v !== '')
      ) as typeof raw;

      if (existing) {
        await updateInspection(existing.id, payload, user.uid, appUser.name, 'edited');
      } else {
        await createInspection(payload as Omit<Inspection, 'id' | 'createdAt' | 'updatedAt'>);
      }
      onSuccess();
    } catch (err) {
      const e = err as { code?: string; message?: string };
      if (e.code === 'permission-denied' || e.message?.includes('insufficient permissions')) {
        setSubmitError(`Permission denied. Your role (${appUser.role}) cannot create inspection requests, or Firestore rules are outdated.`);
      } else {
        setSubmitError(e.message ?? 'Failed to save inspection request. Please try again.');
      }
      console.error('Inspection submit error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    <form onSubmit={handleSubmit(onSubmit as any, () => {
      setTimeout(() => document.querySelector('[data-form-error-summary]')?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 50);
    })}>
      <CardBody className="flex flex-col gap-6">
        {/* Header */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input label="PIC Name" value={appUser?.name ?? ''} disabled />
          <Input label="Department" error={errors.department?.message} {...register('department')} />
        </div>

        {/* Company & customer */}
        <fieldset className="border border-gray-200 rounded-lg p-4">
          <legend className="px-2 text-sm font-semibold text-gray-700">Order Information</legend>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Controller
              control={control}
              name="company"
              render={({ field }) => (
                <Select
                  label="Company *"
                  error={errors.company?.message}
                  options={companies.map(c => ({ value: c, label: c }))}
                  placeholder="Select company"
                  {...field}
                />
              )}
            />
            <div className="grid grid-cols-2 gap-2 col-span-1">
              <Input label="Customer *" error={errors.customer?.message} {...register('customer')} />
              <Input label="Country" {...register('customerCountry')} />
            </div>
            <Input label="Customer PI No. *" error={errors.customerPiNo?.message} {...register('customerPiNo')} />
            <Input label="Supplier PO No. *" error={errors.supplierPoNo?.message} {...register('supplierPoNo')} />
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700">Factory / Supplier *</label>
              <select
                {...register('factoryId')}
                disabled={loadingSuppliers}
                className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">{loadingSuppliers ? 'Loading...' : 'Select supplier'}</option>
                {suppliers.map(s => (
                  <option key={s.id} value={s.id}>{s.name}{s.email ? ` (${s.email})` : ''}</option>
                ))}
              </select>
              {errors.factoryId && <p className="text-xs text-red-600">{errors.factoryId.message as string}</p>}
              {!loadingSuppliers && suppliers.length === 0 && (
                <p className="text-xs text-gray-500">
                  No suppliers yet. <Link to="/suppliers" className="text-blue-600 hover:underline">Add a supplier first</Link>.
                </p>
              )}
            </div>
            <Input label="Factory Commit Date *" type="date" error={errors.factoryCommitDate?.message} {...register('factoryCommitDate')} hint="Request inspection 2–4 weeks before commit date" />
            <Input label="Total Quantity (Cartons) *" type="number" error={errors.totalQtyCartons?.message} {...register('totalQtyCartons')} />
            <Input label="Container Size" {...register('containerSize')} placeholder="e.g. 40HC" />
          </div>
        </fieldset>

        {/* Product */}
        <fieldset className="border border-gray-200 rounded-lg p-4">
          <legend className="px-2 text-sm font-semibold text-gray-700">Product Description</legend>
          <div className="flex flex-col gap-4">
            <Textarea
              label="Product *"
              rows={3}
              error={errors.product?.message}
              {...register('product')}
              placeholder="Describe the product. Include name, brand, grammage, standard, AQL grade, etc. — multi-line allowed."
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input label="Standard (optional)" {...register('productStandard')} placeholder="e.g. USAW" />
              <Input label="Grade (optional)" {...register('productGrade')} placeholder="e.g. WTT AQL 1.5" />
            </div>
          </div>
        </fieldset>

        {/* Reason */}
        <Textarea label="Reason for Request *" rows={3} error={errors.reasonForRequest?.message} {...register('reasonForRequest')} />

        {/* Focus areas */}
        <fieldset className="border border-gray-200 rounded-lg p-4">
          <legend className="px-2 text-sm font-semibold text-gray-700">Area to Focus in Inspection</legend>
          <p className="text-xs text-gray-500 mb-3">For normal inspection, QA checks Visual, Dimension &amp; Weight. Tick additional requests below.</p>
          <Controller
            control={control}
            name="focusAreas"
            render={({ field }) => (
              <div className="grid grid-cols-2 gap-2">
                {[...INSPECTION_FOCUS_AREAS, 'Others', 'NA'].map(area => (
                  <label key={area} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      className="w-4 h-4 rounded text-blue-600"
                      checked={field.value?.includes(area) ?? false}
                      onChange={e => {
                        if (e.target.checked) field.onChange([...(field.value ?? []), area]);
                        else field.onChange((field.value ?? []).filter((a: string) => a !== area));
                      }}
                    />
                    <span className="text-sm text-gray-700">{area}</span>
                  </label>
                ))}
              </div>
            )}
          />
          {focusAreas?.includes('Others') && (
            <Input label="Specify others" {...register('focusOthers')} className="mt-3" />
          )}
        </fieldset>

        {/* AQL */}
        <fieldset className="border border-gray-200 rounded-lg p-4">
          <legend className="px-2 text-sm font-semibold text-gray-700">AQL Purchase from Supplier</legend>
          <Controller
            control={control}
            name="aqlLevel"
            render={({ field }) => (
              <div className="grid grid-cols-2 gap-2">
                {AQL_OPTIONS.map(opt => (
                  <label key={opt.value} className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" name="aqlLevel" value={opt.value} checked={field.value === opt.value}
                      onChange={() => field.onChange(opt.value)} className="w-4 h-4 text-blue-600" />
                    <span className="text-sm text-gray-700">{opt.label}</span>
                  </label>
                ))}
              </div>
            )}
          />
          {errors.aqlLevel && <p className="text-xs text-red-600 mt-1">{errors.aqlLevel.message as string}</p>}
          {aqlLevel === 'other' && <Input label="Specify AQL" {...register('aqlOther')} className="mt-3 max-w-xs" />}
        </fieldset>

        {/* Inspector */}
        <fieldset className="border border-gray-200 rounded-lg p-4">
          <legend className="px-2 text-sm font-semibold text-gray-700">Inspector Type</legend>
          {errors.inspectorTypes && <p className="text-xs text-red-600 mb-2">{errors.inspectorTypes.message as string}</p>}
          <Controller
            control={control}
            name="inspectorTypes"
            render={({ field }) => (
              <div className="flex flex-col gap-2">
                {INSPECTOR_OPTIONS.map(opt => (
                  <label key={opt.value} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      className="w-4 h-4 rounded text-blue-600"
                      checked={field.value?.includes(opt.value) ?? false}
                      onChange={e => {
                        if (e.target.checked) field.onChange([...(field.value ?? []), opt.value]);
                        else field.onChange((field.value ?? []).filter((v: string) => v !== opt.value));
                      }}
                    />
                    <span className="text-sm text-gray-700">{opt.label}</span>
                  </label>
                ))}
              </div>
            )}
          />
        </fieldset>

        <Textarea label="Remarks" {...register('remarks')} />

        {/* PSI Report */}
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" {...register('needsPsiReport')} className="w-4 h-4 rounded text-blue-600" />
          <span className="text-sm font-medium text-gray-700">Pre-Shipment Inspection (PSI) Report required</span>
        </label>

        {/* Approval signatures */}
        <fieldset className="border border-gray-200 rounded-lg p-4">
          <legend className="px-2 text-sm font-semibold text-gray-700">Approvals</legend>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input label="Requested By *" error={errors.requestedByName?.message} {...register('requestedByName')} />
            <Input label="Date *" type="date" error={errors.requestedByDate?.message} {...register('requestedByDate')} />
          </div>
        </fieldset>
        {Object.keys(errors).length > 0 && (
          <div data-form-error-summary className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
            <p className="font-semibold mb-1">Please fix the following before submitting:</p>
            <ul className="list-disc list-inside text-xs flex flex-col gap-0.5">
              {Object.entries(errors).map(([key, err]) => (
                <li key={key}><span className="font-medium">{key}</span>: {(err as { message?: string }).message ?? 'Required'}</li>
              ))}
            </ul>
          </div>
        )}

        {submitError && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
            {submitError}
          </div>
        )}
      </CardBody>

      <CardFooter className="flex justify-end gap-3">
        <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
        <Button type="submit" loading={loading}>{existing ? 'Update Request' : 'Submit Request'}</Button>
      </CardFooter>
    </form>
  );
}
