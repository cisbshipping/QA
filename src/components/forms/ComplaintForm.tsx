import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuth } from '@/hooks/useAuth';
import { createComplaint, updateComplaint, generateComplaintNo, listSuppliers } from '@/lib/db';
import { COMPLAINT_NATURES, type Complaint, type ComplaintNature, type Supplier, type SubmissionPhoto } from '@/types';
import { useCompanies } from '@/hooks/useCompanies';
import { Button } from '@/components/ui/Button';
import { Input, Textarea, Select } from '@/components/ui/Input';
import { Camera, X as XIcon, Image as ImageIcon } from 'lucide-react';
import { CardBody, CardFooter } from '@/components/ui/Card';

const schema = z.object({
  ylCompany: z.string().min(1, 'Required'),
  consignee: z.string().min(1, 'Required'),
  contactPerson: z.string().optional(),
  emailAddress: z.string().email('Invalid email').optional().or(z.literal('')),
  factoryId: z.string().min(1, 'Pick a supplier'),
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
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loadingSuppliers, setLoadingSuppliers] = useState(true);
  const companies = useCompanies();

  // ---- Photo upload ----
  const MAX_PHOTOS = 5;
  const MAX_FILE_BYTES = 4 * 1024 * 1024;
  const [photoFiles, setPhotoFiles] = useState<File[]>([]);
  const [photoPreviews, setPhotoPreviews] = useState<string[]>([]);
  const [existingPhotos, setExistingPhotos] = useState<SubmissionPhoto[]>(existing?.photos ?? []);
  const [uploadProgress, setUploadProgress] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFilesSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSubmitError('');
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;
    const remaining = MAX_PHOTOS - (existingPhotos.length + photoFiles.length);
    if (files.length > remaining) { setSubmitError(`Up to ${MAX_PHOTOS} photos total.`); return; }
    const oversize = files.find(f => f.size > MAX_FILE_BYTES);
    if (oversize) { setSubmitError(`${oversize.name} is larger than 4 MB.`); return; }
    const invalid = files.find(f => !f.type.startsWith('image/'));
    if (invalid) { setSubmitError(`${invalid.name} is not an image.`); return; }
    setPhotoFiles(p => [...p, ...files]);
    setPhotoPreviews(p => [...p, ...files.map(f => URL.createObjectURL(f))]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeNewPhoto = (idx: number) => {
    URL.revokeObjectURL(photoPreviews[idx]);
    setPhotoFiles(p => p.filter((_, i) => i !== idx));
    setPhotoPreviews(p => p.filter((_, i) => i !== idx));
  };

  const removeExistingPhoto = (idx: number) => {
    setExistingPhotos(p => p.filter((_, i) => i !== idx));
  };

  const { register, handleSubmit, control, watch, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: existing
      ? {
          ylCompany: existing.ylCompany ?? '',
          consignee: existing.consignee,
          contactPerson: existing.contactPerson ?? '',
          emailAddress: existing.emailAddress ?? '',
          factoryId: existing.factoryId ?? '',
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
        }
      : { hasDefectiveSamplePhoto: false, hasDefectiveSampleReturn: false, natures: [] },
  });

  useEffect(() => {
    if (!existing) {
      generateComplaintNo().then(setComplaintNo);
    }
  }, [existing]);

  useEffect(() => {
    listSuppliers()
      .then(setSuppliers)
      .finally(() => setLoadingSuppliers(false));
  }, []);

  const hasReturn = watch('hasDefectiveSampleReturn');
  const hasPhoto = watch('hasDefectiveSamplePhoto');
  const selectedNatures = watch('natures') as string[];

  const onSubmit = async (data: FormData) => {
    if (!user || !appUser) {
      setSubmitError('You are not signed in. Please refresh and try again.');
      return;
    }
    setLoading(true);
    setSubmitError('');
    try {
      const picked = suppliers.find(s => s.id === data.factoryId);
      // Strip undefined fields — Firestore rejects them.
      const raw = {
        complaintNo,
        ylCompany: data.ylCompany,
        recordedBy: appUser.name,
        recordedByUid: user.uid,
        dateRecorded: existing?.dateRecorded ?? new Date(),
        consignee: data.consignee,
        contactPerson: data.contactPerson,
        emailAddress: data.emailAddress,
        factory: picked?.name ?? existing?.factory ?? '',
        factoryId: data.factoryId,
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
        status: (existing?.status ?? 'open') as Complaint['status'],
      };
      // Upload new photos to SharePoint via the API. Only when "Yes" is selected and there's at least one file.
      const uploaded: SubmissionPhoto[] = [];
      if (data.hasDefectiveSamplePhoto && photoFiles.length > 0) {
        for (let i = 0; i < photoFiles.length; i++) {
          setUploadProgress(`Uploading photo ${i + 1} of ${photoFiles.length} to OneDrive...`);
          const fd = new FormData();
          fd.append('file', photoFiles[i]);
          fd.append('refNo', complaintNo);
          const res = await fetch('/api/upload-photo', { method: 'POST', body: fd });
          if (!res.ok) {
            const text = await res.text();
            throw new Error(`Photo upload failed (${res.status}): ${text.slice(0, 200)}`);
          }
          const result = await res.json() as { id: string; name: string; webUrl: string; size: number };
          uploaded.push({
            name: result.name,
            storagePath: result.id,
            downloadUrl: result.webUrl,
            size: result.size,
            contentType: photoFiles[i].type,
            syncedToOneDrive: true,
            oneDriveUrl: result.webUrl,
          });
        }
        setUploadProgress('Saving complaint...');
      }
      const allPhotos = [...existingPhotos, ...uploaded];

      const payload = Object.fromEntries(
        Object.entries({ ...raw, photos: allPhotos.length > 0 ? allPhotos : undefined })
          .filter(([, v]) => v !== undefined && v !== '')
      ) as typeof raw & { photos?: SubmissionPhoto[] };

      if (existing) {
        await updateComplaint(existing.id, payload, user.uid, appUser.name, 'edited');
      } else {
        await createComplaint(payload as Omit<Complaint, 'id' | 'createdAt' | 'updatedAt'>);
      }
      photoPreviews.forEach(URL.revokeObjectURL);
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
      setUploadProgress('');
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit, () => {
      setTimeout(() => document.querySelector('[data-form-error-summary]')?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 50);
    })}>
      <CardBody className="flex flex-col gap-6">
        {/* Header info */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">Complaint No.</label>
            <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm font-mono text-blue-700 font-semibold">
              {complaintNo || 'Generating...'}
            </div>
          </div>
          <Input label="Recorded by" value={appUser?.name ?? ''} disabled />
        </div>

        {/* Company / letterhead */}
        <Select
          label="Company (letterhead for PDF export) *"
          error={errors.ylCompany?.message}
          options={companies.map(c => ({ value: c, label: c }))}
          placeholder="Select company"
          {...register('ylCompany')}
        />

        {/* Customer details */}
        <fieldset className="border border-gray-200 rounded-lg p-4">
          <legend className="px-2 text-sm font-semibold text-gray-700">Customer Details</legend>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input label="Consignee *" error={errors.consignee?.message} {...register('consignee')} />
            <Input label="Contact Person" {...register('contactPerson')} />
            <Input label="Email Address" type="email" {...register('emailAddress')} error={errors.emailAddress?.message} className="sm:col-span-2" />
          </div>
        </fieldset>

        {/* Complaint info */}
        <fieldset className="border border-gray-200 rounded-lg p-4">
          <legend className="px-2 text-sm font-semibold text-gray-700">Complaint Information</legend>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                  No suppliers yet. <Link to="/suppliers" className="text-blue-600 hover:underline">Add a supplier first</Link> so the system knows where to send the PDF.
                </p>
              )}
            </div>
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

            {/* Photo uploader — only when checkbox is ticked. Posts to /api/upload-photo → SharePoint. */}
            {hasPhoto && (
              <div className="flex flex-col gap-2 bg-blue-50/50 border border-blue-100 rounded-lg p-4 ml-6">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium text-gray-800">Upload photo(s)</p>
                    <p className="text-xs text-gray-500">Up to {MAX_PHOTOS} photos · 4 MB each · saved to OneDrive</p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={(existingPhotos.length + photoFiles.length) >= MAX_PHOTOS}
                  >
                    <Camera className="w-4 h-4" /> Choose
                  </Button>
                </div>
                <input ref={fileInputRef} type="file" accept="image/*" multiple onChange={handleFilesSelected} className="hidden" />

                {(existingPhotos.length > 0 || photoPreviews.length > 0) ? (
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 mt-2">
                    {existingPhotos.map((p, i) => (
                      <div key={`existing-${i}`} className="relative group rounded-lg overflow-hidden border border-gray-200 bg-white aspect-square">
                        <img src={p.downloadUrl} alt={p.name} className="w-full h-full object-cover" />
                        <button type="button" onClick={() => removeExistingPhoto(i)}
                          className="absolute top-1 right-1 bg-black/60 hover:bg-black/80 text-white rounded-full p-1" title="Remove from complaint">
                          <XIcon className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                    {photoPreviews.map((src, i) => (
                      <div key={`new-${i}`} className="relative group rounded-lg overflow-hidden border border-blue-300 bg-white aspect-square">
                        <img src={src} alt={`new ${i + 1}`} className="w-full h-full object-cover" />
                        <span className="absolute bottom-1 left-1 bg-blue-600 text-white text-[10px] px-1 rounded">NEW</span>
                        <button type="button" onClick={() => removeNewPhoto(i)}
                          className="absolute top-1 right-1 bg-black/60 hover:bg-black/80 text-white rounded-full p-1" title="Remove">
                          <XIcon className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-xs text-gray-500 mt-1">
                    <ImageIcon className="w-3.5 h-3.5" /> No photos yet
                  </div>
                )}
              </div>
            )}

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
        <Input label="Date Issued to Factory" type="date" {...register('dateIssuedToFactory')} className="max-w-xs" />

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

        {uploadProgress && (
          <p className="text-sm text-blue-600">{uploadProgress}</p>
        )}
      </CardBody>

      <CardFooter className="flex justify-end gap-3">
        <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
        <Button type="submit" loading={loading}>{existing ? 'Update Complaint' : 'Submit Complaint'}</Button>
      </CardFooter>
    </form>
  );
}
