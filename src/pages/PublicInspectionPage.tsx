import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { createPublicSubmission, generateSubmissionRef } from '@/lib/db';
import { Input, Textarea } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { PublicSubmitLayout } from './PublicSubmitLayout';

const schema = z.object({
  submitterName: z.string().min(1, 'Required'),
  submitterEmail: z.string().email('Invalid email'),
  submitterPhone: z.string().optional(),
  submitterCompany: z.string().min(1, 'Required'),
  customerPiNo: z.string().min(1, 'Required'),
  factoryLocation: z.string().min(1, 'Required'),
  factoryCommitDate: z.string().min(1, 'Required'),
  totalQtyCartons: z.string().min(1, 'Required'),
  productInfo: z.string().min(1, 'Required'),
  description: z.string().min(5, 'Required'),
});

type FormData = z.infer<typeof schema>;

export function PublicInspectionPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema) as any,
  });

  const onSubmit = async (data: FormData) => {
    setLoading(true);
    setError('');
    try {
      const refNo = await generateSubmissionRef('inspection');
      await createPublicSubmission({
        type: 'inspection',
        referenceNo: refNo,
        submitterName: data.submitterName,
        submitterEmail: data.submitterEmail,
        submitterPhone: data.submitterPhone,
        submitterCompany: data.submitterCompany,
        customerPiNo: data.customerPiNo,
        factoryLocation: data.factoryLocation,
        factoryCommitDate: new Date(data.factoryCommitDate),
        totalQtyCartons: Number(data.totalQtyCartons),
        productInfo: data.productInfo,
        description: data.description,
      });
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
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5">
        <fieldset className="border border-gray-200 rounded-lg p-4">
          <legend className="px-2 text-sm font-semibold text-gray-700">Your Details</legend>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input label="Your Name *" error={errors.submitterName?.message} {...register('submitterName')} />
            <Input label="Email Address *" type="email" error={errors.submitterEmail?.message} {...register('submitterEmail')} />
            <Input label="Phone (optional)" {...register('submitterPhone')} />
            <Input label="Company / Department *" error={errors.submitterCompany?.message} {...register('submitterCompany')} />
          </div>
        </fieldset>

        <fieldset className="border border-gray-200 rounded-lg p-4">
          <legend className="px-2 text-sm font-semibold text-gray-700">Order Details</legend>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input label="Customer PI No. *" error={errors.customerPiNo?.message} {...register('customerPiNo')} />
            <Input label="Factory / Location *" error={errors.factoryLocation?.message} {...register('factoryLocation')} />
            <Input label="Factory Commit Date *" type="date" error={errors.factoryCommitDate?.message} {...register('factoryCommitDate')}
              hint="Request inspection 2–4 weeks before commit date" />
            <Input label="Total Quantity (Cartons) *" type="number" error={errors.totalQtyCartons?.message} {...register('totalQtyCartons')} />
            <Input label="Product Description *" error={errors.productInfo?.message} {...register('productInfo')} className="sm:col-span-2"
              placeholder="e.g. PFNT 11.4GM (BLUE), USAW, WTT AQL 1.5" />
          </div>
        </fieldset>

        <Textarea label="Reason for Request *" rows={4} error={errors.description?.message} {...register('description')}
          placeholder="Why is this inspection needed? Any focus areas?" />

        {error && <p className="text-sm text-red-600">{error}</p>}

        <Button type="submit" loading={loading} size="lg">Submit Request</Button>
      </form>
    </PublicSubmitLayout>
  );
}
