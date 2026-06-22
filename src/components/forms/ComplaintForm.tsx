import { useState, useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuth } from '@/hooks/useAuth';
import { createComplaint, updateComplaint, generateComplaintNo } from '@/lib/db';
import { COMPLAINT_NATURES, type Complaint, type ComplaintNature } from '@/types';
import { Button } from '@/components/ui/Button';
import { Input, Textarea } from '@/components/ui/Input';
import { CardBody, CardFooter } from '@/components/ui/Card';

const schema = z.object({
  consignee: z.string().min(1, 'Required'),
  contactPerson: z.string().optional(),
  phoneNo: z.string().optional(),
  emailAddress: z.string().email('Invalid email').optional().or(z.literal('')),
  factory: z.string().min(1, 'Required'),
  brandName: z.string().min(1, 'Required'),
  productName: z.string().min(1, 'Required'),
  piNo: z.string().min(1, 'Required'),
  poNo: z.string().optional(),
  lotNo: z.string().optional(),
  size: z.string().optional(),
  quantityInvolved: z.string().min(1, 'Required'),
  hasDefectiveSamplePhoto: z.boolean(),
  hasDefectiveSampleReturn: z.boolean(),
  returnSampleQty: z.string().optional(),
  natures: z.array(z.string()).min(1, 'Select at least one nature of complaint'),
  othersDescription: z.string().optional(),
  description: z.string().min(1, 'Required'),
  dateIssuedToFactory: z.string().optional(),
  forwardedBy: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

interface Props {
  existing?: Complaint;
  onSuccess: () => void;
  onCancel: () => void;
}

export function ComplaintForm({ existing, onSuccess, onCancel }: Props) {
  const { user, appUser } = useAuth();
  const [loading, setLoading] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [complaintNo, setComplaintNo] = useState(existing?.complaintNo ?? '');

  const { register, handleSubmit, control, watch, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: existing
      ? {
          consignee: existing.consignee,
          contactPerson: existing.contactPerson ?? '',
          phoneNo: existing.phoneNo ?? '',
          emailAddress: existing.emailAddress ?? '',
          factory: existing.factory,
          brandName: existing.brandName,
          productName: existing.productName,
          piNo: existing.piNo,
          poNo: existing.poNo ?? '',
          lotNo: existing.lotNo ?? '',
          size: existing.size ?? '',
          quantityInvolved: existing.quantityInvolved,
          hasDefectiveSamplePhoto: existing.hasDefectiveSamplePhoto,
          hasDefectiveSampleReturn: existing.hasDefectiveSampleReturn,
          returnSampleQty: existing.returnSampleQty ?? '',
          natures: existing.natures,
          othersDescription: existing.othersDescription ?? '',
          description: existing.description,
          dateIssuedToFactory: existing.dateIssuedToFactory ? existing.dateIssuedToFactory.toISOString().slice(0, 10) : '',
          forwardedBy: existing.forwardedBy ?? '',
        }
      : { hasDefectiveSamplePhoto: false, hasDefectiveSampleReturn: false, natures: [] },
  });

  useEffect(() => {
    if (!existing) {
      generateComplaintNo().then(setComplaintNo);
    }
  }, [existing]);

  const hasReturn = watch('hasDefectiveSampleReturn');
  const selectedNatures = watch('natures') as string[];

  const onSubmit = async (data: FormData) => {
    if (!user || !appUser) {
      setSubmitError('You are not signed in. Please refresh and try again.');
      return;
    }
    setLoading(true);
    setSubmitError('');
    try {
      // Strip undefined fields — Firestore rejects them.
      const raw = {
        complaintNo,
        recordedBy: appUser.name,
        recordedByUid: user.uid,
        dateRecorded: existing?.dateRecorded ?? new Date(),
        consignee: data.consignee,
        contactPerson: data.contactPerson,
        phoneNo: data.phoneNo,
        emailAddress: data.emailAddress,
        factory: data.factory,
        brandName: data.brandName,
        productName: data.productName,
        piNo: data.piNo,
        poNo: data.poNo,
        lotNo: data.lotNo,
        size: data.size,
        quantityInvolved: data.quantityInvolved,
        hasDefectiveSamplePhoto: data.hasDefectiveSamplePhoto,
        hasDefectiveSampleReturn: data.hasDefectiveSampleReturn,
        returnSampleQty: data.returnSampleQty,
        natures: data.natures as ComplaintNature[],
        othersDescription: data.othersDescription,
        description: data.description,
        dateIssuedToFactory: data.dateIssuedToFactory ? new Date(data.dateIssuedToFactory) : undefined,
        forwardedBy: data.forwardedBy,
        status: (existing?.status ?? 'open') as Complaint['status'],
      };
      const payload = Object.fromEntries(
        Object.entries(raw).filter(([, v]) => v !== undefined && v !== '')
      ) as typeof raw;

      if (existing) {
        await updateComplaint(existing.id, payload, user.uid, appUser.name, 'edited');
      } else {
        await createComplaint(payload as Omit<Complaint, 'id' | 'createdAt' | 'updatedAt'>);
      }
      onSuccess();
    } catch (err) {
      const e = err as { code?: string; message?: string };
      if (e.code === 'permission-denied' || e.message?.includes('insufficient permissions')) {
        setSubmitError(`Permission denied. Your role (${appUser.role}) cannot create complaints, or Firestore rules are outdated.`);
      } else {
        setSubmitError(e.message ?? 'Failed to save complaint. Please try again.');
      }
      console.error('Complaint submit error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <CardBody className="flex flex-col gap-6">
        {/* Header info */}
        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">Complaint No.</label>
            <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm font-mono text-blue-700 font-semibold">
              {complaintNo || 'Generating...'}
            </div>
          </div>
          <Input label="Recorded by" value={appUser?.name ?? ''} disabled />
        </div>

        {/* Customer details */}
        <fieldset className="border border-gray-200 rounded-lg p-4">
          <legend className="px-2 text-sm font-semibold text-gray-700">Customer Details</legend>
          <div className="grid grid-cols-2 gap-4">
            <Input label="Consignee *" error={errors.consignee?.message} {...register('consignee')} />
            <Input label="Contact Person" {...register('contactPerson')} />
            <Input label="Phone No." {...register('phoneNo')} />
            <Input label="Email Address" type="email" {...register('emailAddress')} error={errors.emailAddress?.message} />
          </div>
        </fieldset>

        {/* Complaint info */}
        <fieldset className="border border-gray-200 rounded-lg p-4">
          <legend className="px-2 text-sm font-semibold text-gray-700">Complaint Information</legend>
          <div className="grid grid-cols-2 gap-4">
            <Input label="Factory / Supplier *" error={errors.factory?.message} {...register('factory')} />
            <Input label="Brand Name *" error={errors.brandName?.message} {...register('brandName')} />
            <Input label="Product Name *" error={errors.productName?.message} {...register('productName')} className="col-span-2" />
            <Input label="PI No. *" error={errors.piNo?.message} {...register('piNo')} />
            <Input label="PO No." {...register('poNo')} />
            <Input label="Lot No." {...register('lotNo')} />
            <Input label="Size" {...register('size')} />
            <Input label="Quantity Involved *" error={errors.quantityInvolved?.message} {...register('quantityInvolved')} className="col-span-2" />
          </div>
        </fieldset>

        {/* Defective samples */}
        <fieldset className="border border-gray-200 rounded-lg p-4">
          <legend className="px-2 text-sm font-semibold text-gray-700">Defective Samples</legend>
          <div className="flex flex-col gap-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" {...register('hasDefectiveSamplePhoto')} className="w-4 h-4 rounded text-blue-600" />
              <span className="text-sm text-gray-700">Defective sample photo available</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" {...register('hasDefectiveSampleReturn')} className="w-4 h-4 rounded text-blue-600" />
              <span className="text-sm text-gray-700">Defective sample return requested</span>
            </label>
            {hasReturn && (
              <Input label="Quantity of return samples" {...register('returnSampleQty')} className="ml-6 max-w-xs" />
            )}
          </div>
        </fieldset>

        {/* Nature of complaint */}
        <fieldset className="border border-gray-200 rounded-lg p-4">
          <legend className="px-2 text-sm font-semibold text-gray-700">Nature of Complaint *</legend>
          {errors.natures && <p className="text-xs text-red-600 mb-2">{errors.natures.message as string}</p>}
          <Controller
            control={control}
            name="natures"
            render={({ field }) => (
              <div className="grid grid-cols-2 gap-2">
                {COMPLAINT_NATURES.map(nature => (
                  <label key={nature} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      className="w-4 h-4 rounded text-blue-600"
                      checked={field.value?.includes(nature) ?? false}
                      onChange={e => {
                        if (e.target.checked) {
                          field.onChange([...(field.value ?? []), nature]);
                        } else {
                          field.onChange((field.value ?? []).filter((n: string) => n !== nature));
                        }
                      }}
                    />
                    <span className="text-sm text-gray-700">{nature}</span>
                  </label>
                ))}
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    className="w-4 h-4 rounded text-blue-600"
                    checked={field.value?.includes('Others') ?? false}
                    onChange={e => {
                      if (e.target.checked) {
                        field.onChange([...(field.value ?? []), 'Others']);
                      } else {
                        field.onChange((field.value ?? []).filter((n: string) => n !== 'Others'));
                      }
                    }}
                  />
                  <span className="text-sm text-gray-700">Others</span>
                </label>
              </div>
            )}
          />
          {(selectedNatures?.includes('Others')) && (
            <Input label="Specify others" {...register('othersDescription')} className="mt-3" />
          )}
        </fieldset>

        {/* Description */}
        <Textarea label="Description of Complaint *" rows={4} error={errors.description?.message} {...register('description')} />

        {/* Workflow fields */}
        <div className="grid grid-cols-2 gap-4">
          <Input label="Date Issued to Factory" type="date" {...register('dateIssuedToFactory')} />
          <Input label="Forwarded By" {...register('forwardedBy')} />
        </div>

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

        {submitError && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
            {submitError}
          </div>
        )}
      </CardBody>

      <CardFooter className="flex justify-end gap-3">
        <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
        <Button type="submit" loading={loading}>{existing ? 'Update Complaint' : 'Submit Complaint'}</Button>
      </CardFooter>
    </form>
  );
}
