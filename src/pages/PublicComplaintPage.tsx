import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { createPublicSubmission, generateSubmissionRef } from '@/lib/db';
import { COMPLAINT_NATURES, type ComplaintNature, type SubmissionPhoto } from '@/types';
import { Input, Textarea } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { PublicSubmitLayout } from './PublicSubmitLayout';
import { Camera, X, Image as ImageIcon } from 'lucide-react';

const MAX_PHOTOS = 5;
const MAX_FILE_BYTES = 4 * 1024 * 1024; // keep under Vercel's 4.5 MB body limit

const schema = z.object({
  // Submitter
  submitterName: z.string().min(1, 'Required'),
  submitterEmail: z.string().email('Invalid email'),
  submitterPhone: z.string().optional(),
  submitterCompany: z.string().min(1, 'Required'),
  // Product (all required)
  factorySupplier: z.string().min(1, 'Required'),
  brandName: z.string().min(1, 'Required'),
  productName: z.string().min(1, 'Required'),
  piNo: z.string().min(1, 'Required'),
  poNo: z.string().min(1, 'Required'),
  lotNo: z.string().min(1, 'Required'),
  size: z.string().min(1, 'Required'),
  quantityInvolved: z.string().min(1, 'Required'),
  // Defective samples (required Y/N)
  hasDefectiveSamplePhoto: z.enum(['yes', 'no']),
  hasDefectiveSampleReturn: z.enum(['yes', 'no']),
  returnSampleQty: z.string().optional(),
  // Nature & description
  natures: z.array(z.string()).min(1, 'Select at least one'),
  othersDescription: z.string().optional(),
  description: z.string().min(10, 'Please describe the complaint (min 10 chars)'),
}).refine(
  d => d.hasDefectiveSampleReturn === 'no' || (d.returnSampleQty && d.returnSampleQty.length > 0),
  { message: 'Quantity of return samples is required when "Yes" is selected', path: ['returnSampleQty'] },
);

type FormData = z.infer<typeof schema>;

export function PublicComplaintPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [photos, setPhotos] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [progress, setProgress] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { register, handleSubmit, control, watch, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema) as any,
    defaultValues: { natures: [] },
  });

  const hasPhoto = watch('hasDefectiveSamplePhoto');
  const hasReturn = watch('hasDefectiveSampleReturn');
  const selectedNatures = (watch('natures') ?? []) as string[];

  const handleFilesSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    setError('');
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;
    const remaining = MAX_PHOTOS - photos.length;
    if (files.length > remaining) { setError(`You can upload at most ${MAX_PHOTOS} photos.`); return; }
    const oversize = files.find(f => f.size > MAX_FILE_BYTES);
    if (oversize) { setError(`${oversize.name} is larger than 4 MB.`); return; }
    const invalid = files.find(f => !f.type.startsWith('image/'));
    if (invalid) { setError(`${invalid.name} is not an image.`); return; }
    setPhotos(p => [...p, ...files]);
    setPreviews(p => [...p, ...files.map(f => URL.createObjectURL(f))]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removePhoto = (idx: number) => {
    URL.revokeObjectURL(previews[idx]);
    setPhotos(p => p.filter((_, i) => i !== idx));
    setPreviews(p => p.filter((_, i) => i !== idx));
  };

  const uploadOne = async (refNo: string, file: File): Promise<SubmissionPhoto> => {
    const fd = new FormData();
    fd.append('file', file);
    fd.append('refNo', refNo);
    const res = await fetch('/api/upload-photo', { method: 'POST', body: fd });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Upload failed (${res.status}): ${text.slice(0, 200)}`);
    }
    const data = (await res.json()) as { id: string; name: string; webUrl: string; size: number };
    return {
      name: data.name,
      storagePath: data.id,
      downloadUrl: data.webUrl,
      size: data.size,
      contentType: file.type,
      syncedToOneDrive: true,
      oneDriveUrl: data.webUrl,
    };
  };

  const onSubmit = async (data: FormData) => {
    setLoading(true);
    setError('');
    try {
      const refNo = await generateSubmissionRef('complaint');

      const uploaded: SubmissionPhoto[] = [];
      if (data.hasDefectiveSamplePhoto === 'yes' && photos.length > 0) {
        for (let i = 0; i < photos.length; i++) {
          setProgress(`Uploading photo ${i + 1} of ${photos.length} to OneDrive...`);
          uploaded.push(await uploadOne(refNo, photos[i]));
        }
        setProgress('Saving submission...');
      }

      await createPublicSubmission({
        type: 'complaint',
        referenceNo: refNo,
        submitterName: data.submitterName,
        submitterEmail: data.submitterEmail,
        submitterPhone: data.submitterPhone,
        submitterCompany: data.submitterCompany,
        factorySupplier: data.factorySupplier,
        brandName: data.brandName,
        productName: data.productName,
        piNo: data.piNo,
        poNo: data.poNo,
        lotNo: data.lotNo,
        size: data.size,
        quantityInvolved: data.quantityInvolved,
        hasDefectiveSamplePhoto: data.hasDefectiveSamplePhoto === 'yes',
        hasDefectiveSampleReturn: data.hasDefectiveSampleReturn === 'yes',
        returnSampleQty: data.hasDefectiveSampleReturn === 'yes' ? data.returnSampleQty : undefined,
        photos: uploaded.length > 0 ? uploaded : undefined,
        natures: data.natures as ComplaintNature[],
        othersDescription: data.othersDescription,
        description: data.description,
      });
      previews.forEach(URL.revokeObjectURL);
      navigate(`/submit/thank-you?ref=${refNo}`);
    } catch (err) {
      setError((err as Error).message || 'Failed to submit. Please try again.');
    } finally {
      setLoading(false);
      setProgress('');
    }
  };

  return (
    <PublicSubmitLayout
      title="Submit a Complaint"
      subtitle="Tell us about a quality issue with one of our products. All fields marked * are required."
    >
      <form onSubmit={handleSubmit(onSubmit, () => {
        // On validation error, scroll bottom of form into view so the error summary is visible.
        setTimeout(() => window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' }), 50);
      })} className="flex flex-col gap-5">
        {/* Submitter */}
        <fieldset className="border border-gray-200 rounded-lg p-4">
          <legend className="px-2 text-sm font-semibold text-gray-700">Your Details</legend>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input label="Your Name *" error={errors.submitterName?.message} {...register('submitterName')} />
            <Input label="Email Address *" type="email" error={errors.submitterEmail?.message} {...register('submitterEmail')} />
            <Input label="Phone (optional)" {...register('submitterPhone')} />
            <Input label="Consignee / Company *" error={errors.submitterCompany?.message} {...register('submitterCompany')} />
          </div>
        </fieldset>

        {/* Product information */}
        <fieldset className="border border-gray-200 rounded-lg p-4">
          <legend className="px-2 text-sm font-semibold text-gray-700">Complaint Information</legend>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input label="Factory / Supplier *" error={errors.factorySupplier?.message} {...register('factorySupplier')} />
            <Input label="Brand Name *" error={errors.brandName?.message} {...register('brandName')} />
            <Input label="Product Name *" error={errors.productName?.message} {...register('productName')} className="sm:col-span-2" />
            <Input label="PI No. *" error={errors.piNo?.message} {...register('piNo')} />
            <Input label="PO No. *" error={errors.poNo?.message} {...register('poNo')} />
            <Input label="Lot No. *" error={errors.lotNo?.message} {...register('lotNo')} />
            <Input label="Size *" error={errors.size?.message} {...register('size')} />
            <Input label="Quantity Involved *" error={errors.quantityInvolved?.message} {...register('quantityInvolved')} className="sm:col-span-2"
              placeholder="e.g. 150 cartons" />
          </div>
        </fieldset>

        {/* Defective samples — Yes/No */}
        <fieldset className="border border-gray-200 rounded-lg p-4">
          <legend className="px-2 text-sm font-semibold text-gray-700">Defective Samples</legend>
          <div className="flex flex-col gap-5">
            <div className="flex flex-col gap-1">
              <p className="text-sm font-medium text-gray-700">Availability of Defective Sample Photo *</p>
              <div className="flex gap-6">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" value="yes" {...register('hasDefectiveSamplePhoto')} className="w-4 h-4 text-blue-600" />
                  <span className="text-sm text-gray-700">Yes</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" value="no" {...register('hasDefectiveSamplePhoto')} className="w-4 h-4 text-blue-600" />
                  <span className="text-sm text-gray-700">No</span>
                </label>
              </div>
              {errors.hasDefectiveSamplePhoto && <p className="text-xs text-red-600">{errors.hasDefectiveSamplePhoto.message as string}</p>}
            </div>

            {/* Photo uploader (visible only when user picks Yes) */}
            {hasPhoto === 'yes' && (
              <div className="flex flex-col gap-2 bg-blue-50/50 border border-blue-100 rounded-lg p-4">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium text-gray-800">Upload photo(s)</p>
                    <p className="text-xs text-gray-500">Up to {MAX_PHOTOS} photos · 4 MB each · JPG, PNG, HEIC, WebP</p>
                    <p className="text-xs text-gray-500">Photos are saved to our shared OneDrive folder.</p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={photos.length >= MAX_PHOTOS}
                  >
                    <Camera className="w-4 h-4" /> Choose
                  </Button>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleFilesSelected}
                  className="hidden"
                />

                {previews.length > 0 && (
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 mt-2">
                    {previews.map((src, i) => (
                      <div key={i} className="relative group rounded-lg overflow-hidden border border-gray-200 bg-white aspect-square">
                        <img src={src} alt={`preview ${i + 1}`} className="w-full h-full object-cover" />
                        <button
                          type="button"
                          onClick={() => removePhoto(i)}
                          className="absolute top-1 right-1 bg-black/60 hover:bg-black/80 text-white rounded-full p-1"
                          title="Remove"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {previews.length === 0 && (
                  <div className="flex items-center gap-2 text-xs text-gray-500 mt-1">
                    <ImageIcon className="w-3.5 h-3.5" /> No photos selected yet
                  </div>
                )}
              </div>
            )}

            <div className="flex flex-col gap-1">
              <p className="text-sm font-medium text-gray-700">Availability of Defective Sample Return *</p>
              <div className="flex gap-6">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" value="yes" {...register('hasDefectiveSampleReturn')} className="w-4 h-4 text-blue-600" />
                  <span className="text-sm text-gray-700">Yes</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" value="no" {...register('hasDefectiveSampleReturn')} className="w-4 h-4 text-blue-600" />
                  <span className="text-sm text-gray-700">No</span>
                </label>
              </div>
              {errors.hasDefectiveSampleReturn && <p className="text-xs text-red-600">{errors.hasDefectiveSampleReturn.message as string}</p>}
            </div>

            {hasReturn === 'yes' && (
              <Input
                label="Quantity of return samples *"
                error={errors.returnSampleQty?.message}
                {...register('returnSampleQty')}
                placeholder="e.g. 5 pcs"
                className="sm:max-w-xs"
              />
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
                        if (e.target.checked) field.onChange([...(field.value ?? []), nature]);
                        else field.onChange((field.value ?? []).filter((n: string) => n !== nature));
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
                      if (e.target.checked) field.onChange([...(field.value ?? []), 'Others']);
                      else field.onChange((field.value ?? []).filter((n: string) => n !== 'Others'));
                    }}
                  />
                  <span className="text-sm text-gray-700">Others</span>
                </label>
              </div>
            )}
          />
          {selectedNatures.includes('Others') && (
            <Input label="Specify others" {...register('othersDescription')} className="mt-3" />
          )}
        </fieldset>

        {/* Description */}
        <Textarea label="Description of Complaint *" rows={5} error={errors.description?.message} {...register('description')} />

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
        {progress && <p className="text-sm text-blue-600">{progress}</p>}

        <Button type="submit" loading={loading} size="lg">Submit Complaint</Button>
      </form>
    </PublicSubmitLayout>
  );
}

