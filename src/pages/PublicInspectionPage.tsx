import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { createPublicSubmission, generateSubmissionRef, createInspectionFromPublic, listSuppliers } from '@/lib/db';
import { INSPECTION_FOCUS_AREAS, type Supplier, type ProductItem } from '@/types';
import { useCompanies } from '@/hooks/useCompanies';
import { Input, Textarea, Select } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { PublicSubmitLayout } from './PublicSubmitLayout';

const schema = z.object({
  submitterName: z.string().min(1, 'Required'),
  submitterEmail: z.string().email('Invalid email'),
  ylCompany: z.string().min(1, 'Required'),
  customer: z.string().min(1, 'Required'),
  customerPiNo: z.string().min(1, 'Required'),
  poNo: z.string().min(1, 'Required'),
  factoryLocation: z.string().min(1, 'Required'),
  factoryCommitDate: z.string().min(1, 'Required'),
  totalQtyCartons: z.string().min(1, 'Required'),
  productInfo: z.string().min(1, 'Required'),
  productStandard: z.string().optional(),
  productGrade: z.string().optional(),
  aqlLevel: z.string().min(1, 'Required'),
  aqlOther: z.string().optional(),
  focusAreas: z.array(z.string()),
  focusOthers: z.string().optional(),
  needsPsiReport: z.boolean(),
  description: z.string().min(5, 'Required'),
});

type FormData = z.infer<typeof schema>;

const AQL_OPTIONS = [
  { value: 'G1/AQL 1.5', label: 'G1 / AQL 1.5' },
  { value: 'G1/AQL 2.5', label: 'G1 / AQL 2.5' },
  { value: 'G1/AQL 4.0', label: 'G1 / AQL 4.0' },
  { value: 'other', label: 'Other' },
];

export function PublicInspectionPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const companies = useCompanies();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loadingSuppliers, setLoadingSuppliers] = useState(true);
  const [additionalProducts, setAdditionalProducts] = useState<ProductItem[]>([]);

  useEffect(() => {
    listSuppliers()
      .then(setSuppliers)
      .catch(() => {})
      .finally(() => setLoadingSuppliers(false));
  }, []);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { register, handleSubmit, control, watch, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema) as any,
    defaultValues: { focusAreas: [], needsPsiReport: false },
  });

  const aqlLevel = watch('aqlLevel');
  const focusAreas = watch('focusAreas') as string[];

  const addProduct = () => setAdditionalProducts(p => [...p, { product: '', standard: '', grade: '' }]);
  const updateProduct = (i: number, field: keyof ProductItem, value: string) =>
    setAdditionalProducts(p => p.map((row, idx) => idx === i ? { ...row, [field]: value } : row));
  const removeProduct = (i: number) => setAdditionalProducts(p => p.filter((_, idx) => idx !== i));

  const onSubmit = async (data: FormData) => {
    setLoading(true);
    setError('');
    try {
      const refNo = await generateSubmissionRef('inspection');
      const submissionPayload = {
        type: 'inspection' as const,
        referenceNo: refNo,
        submitterName: data.submitterName,
        submitterEmail: data.submitterEmail,
        ylCompany: data.ylCompany,
        customer: data.customer,
        customerPiNo: data.customerPiNo,
        poNo: data.poNo,
        factoryLocation: data.factoryLocation,
        factoryCommitDate: new Date(data.factoryCommitDate),
        totalQtyCartons: Number(data.totalQtyCartons),
        productInfo: data.productInfo,
        productStandard: data.productStandard,
        productGrade: data.productGrade,
        additionalProducts: additionalProducts.filter(p => p.product.trim() !== ''),
        aqlLevel: data.aqlLevel === 'other' ? (data.aqlOther || 'Other') : data.aqlLevel,
        focusAreas: data.focusAreas,
        focusOthers: data.focusOthers,
        needsPsiReport: data.needsPsiReport,
        description: data.description,
      };
      await createPublicSubmission(submissionPayload);
      try {
        const fakeSubmission = { ...submissionPayload, id: refNo, status: 'new' as const, createdAt: new Date() };
        await createInspectionFromPublic(refNo, fakeSubmission);
      } catch (e) {
        console.error('Failed to mirror to inspections collection:', e);
      }
      navigate(`/submit/thank-you?ref=${refNo}`);
    } catch (err) {
      setError((err as Error).message || 'Failed to submit. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <PublicSubmitLayout
      title="Request an Inspection"
      subtitle="Submit a new inspection requisition. Our QA team will review and contact you."
    >
      <form onSubmit={handleSubmit(onSubmit, () => {
        setTimeout(() => window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' }), 50);
      })} className="flex flex-col gap-5">
        <fieldset className="border border-gray-200 rounded-lg p-4">
          <legend className="px-2 text-sm font-semibold text-gray-700">Your Details</legend>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input label="Your Name *" error={errors.submitterName?.message} {...register('submitterName')} />
            <Input label="Email Address *" type="email" error={errors.submitterEmail?.message} {...register('submitterEmail')} />
          </div>
        </fieldset>

        <fieldset className="border border-gray-200 rounded-lg p-4">
          <legend className="px-2 text-sm font-semibold text-gray-700">Order Details</legend>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Select
              label="Company (which entity is requesting) *"
              error={errors.ylCompany?.message}
              options={companies.map(c => ({ value: c, label: c }))}
              placeholder="Select company"
              className="sm:col-span-2"
              {...register('ylCompany')}
            />
            <Input label="Customer *" error={errors.customer?.message} {...register('customer')} />
            <Input label="PI No. *" error={errors.customerPiNo?.message} {...register('customerPiNo')} />
            <Input label="PO No. *" error={errors.poNo?.message} {...register('poNo')} />

            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700">Factory / Location *</label>
              <select
                {...register('factoryLocation')}
                disabled={loadingSuppliers}
                className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">{loadingSuppliers ? 'Loading...' : 'Select factory'}</option>
                {suppliers.map(s => (
                  <option key={s.id} value={s.name}>{s.name}</option>
                ))}
              </select>
              {errors.factoryLocation && <p className="text-xs text-red-600">{errors.factoryLocation.message as string}</p>}
            </div>

            <Input label="Factory Commit Date *" type="date" error={errors.factoryCommitDate?.message} {...register('factoryCommitDate')}
              hint="Request inspection 2–4 weeks before commit date" />
            <Input label="Total Quantity (Cartons) *" type="number" error={errors.totalQtyCartons?.message} {...register('totalQtyCartons')}
              placeholder="Type carton count manually" className="sm:col-span-2" />
          </div>
        </fieldset>

        {/* Product Description */}
        <fieldset className="border border-gray-200 rounded-lg p-4">
          <legend className="px-2 text-sm font-semibold text-gray-700">Product Description</legend>
          <div className="flex flex-col gap-4">
            <Textarea label="Product *" rows={3} error={errors.productInfo?.message} {...register('productInfo')}
              placeholder="Type product details manually. e.g. PFNT 11.4GM (BLUE)" />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input label="Standard (optional)" {...register('productStandard')} placeholder="e.g. USAW" />
              <Input label="Grade (optional)" {...register('productGrade')} placeholder="e.g. WTT AQL 1.5" />
            </div>

            {additionalProducts.map((row, i) => (
              <div key={i} className="border border-dashed border-gray-300 rounded-lg p-3 flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-gray-500 uppercase">Additional Product {i + 1}</span>
                  <button type="button" onClick={() => removeProduct(i)} className="p-1 rounded hover:bg-red-50 text-red-500" title="Remove">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
                  </button>
                </div>
                <Textarea label="Product *" rows={2} value={row.product} onChange={e => updateProduct(i, 'product', e.target.value)} placeholder="Product description" />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Input label="Standard (optional)" value={row.standard ?? ''} onChange={e => updateProduct(i, 'standard', e.target.value)} />
                  <Input label="Grade (optional)" value={row.grade ?? ''} onChange={e => updateProduct(i, 'grade', e.target.value)} />
                </div>
              </div>
            ))}

            <button type="button" onClick={addProduct}
              className="inline-flex items-center justify-center gap-1 text-sm text-blue-600 hover:text-blue-700 hover:bg-blue-50 font-medium px-3 py-2 rounded border border-dashed border-blue-300 hover:border-blue-500 transition-colors w-fit">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4"/></svg>
              Add another product
            </button>
          </div>
        </fieldset>

        {/* AQL */}
        <fieldset className="border border-gray-200 rounded-lg p-4">
          <legend className="px-2 text-sm font-semibold text-gray-700">AQL Purchase from Supplier *</legend>
          <Controller
            control={control}
            name="aqlLevel"
            render={({ field }) => (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
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

        {/* Focus areas */}
        <fieldset className="border border-gray-200 rounded-lg p-4">
          <legend className="px-2 text-sm font-semibold text-gray-700">Area to Focus in Inspection</legend>
          <p className="text-xs text-gray-500 mb-3">For normal inspection, QA checks Visual, Dimension &amp; Weight. Tick additional requests below.</p>
          <Controller
            control={control}
            name="focusAreas"
            render={({ field }) => (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {[...INSPECTION_FOCUS_AREAS, 'Others', 'NA'].map(area => (
                  <label key={area} className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" className="w-4 h-4 rounded text-blue-600"
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

        {/* PSI report */}
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" {...register('needsPsiReport')} className="w-4 h-4 rounded text-blue-600" />
          <span className="text-sm font-medium text-gray-700">Pre-Shipment Inspection (PSI) Report required</span>
        </label>

        <Textarea label="Reason for Request *" rows={4} error={errors.description?.message} {...register('description')}
          placeholder="Why is this inspection needed? Any focus areas?" />

        {Object.keys(errors).length > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
            <p className="font-semibold mb-1">Please fix the following before submitting:</p>
            <ul className="list-disc list-inside text-xs flex flex-col gap-0.5">
              {Object.entries(errors).map(([key, err]) => (
                <li key={key}><span className="font-medium">{key}</span>: {(err as { message?: string }).message ?? 'Required'}</li>
              ))}
            </ul>
          </div>
        )}

        {error && <p className="text-sm text-red-600">{error}</p>}

        <Button type="submit" loading={loading} size="lg">Submit Request</Button>
      </form>
    </PublicSubmitLayout>
  );
}
