'use client';

import { useRequireAuth } from '@/hooks/useAuth';
import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useToast } from '@/components/ui/Toast';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

const supplierSchema = z.object({
  commercial_name: z.string().min(2, 'El nombre comercial requiere al menos 2 caracteres'),
  social_reason: z.string().min(2, 'La razón social requiere al menos 2 caracteres'),
  rfc: z.string().min(12, 'El RFC debe tener al menos 12 caracteres').max(13, 'El RFC no puede exceder 13 caracteres'),
  address: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  clabe: z.string().length(18, 'La CLABE interbancaria debe tener exactamente 18 dígitos numéricos'),
  bank: z.string().min(2, 'El nombre del banco es requerido'),
  contact: z.string().optional().nullable(),
  category: z.string().min(2, 'La categoría es requerida'),
});

type SupplierFormData = z.infer<typeof supplierSchema>;

export default function EditarProveedorPage({ 
  params 
}: { 
  params: Promise<{ id: string }> 
}) {
  const { id } = use(params);
  const { user, isDepartmentHead, loading } = useRequireAuth();
  const { success, error: toastError, warning } = useToast();
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [existingCoverUrl, setExistingCoverUrl] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<SupplierFormData>({
    resolver: zodResolver(supplierSchema),
  });

  useEffect(() => {
    if (user && isDepartmentHead) {
      const fetchSupplier = async () => {
        try {
          const response = await fetch(`/api/v1/suppliers/${id}`);
          const data = await response.json();
          if (data.success && data.supplier) {
            const s = data.supplier;
            setValue('commercial_name', s.commercial_name);
            setValue('social_reason', s.social_reason);
            setValue('rfc', s.rfc);
            setValue('address', s.address || '');
            setValue('phone', s.phone || '');
            setValue('clabe', s.clabe);
            setValue('bank', s.bank);
            setValue('contact', s.contact || '');
            setValue('category', s.category);
            if (s.cover_image_url) {
              setExistingCoverUrl(s.cover_image_url);
            }
          } else {
            toastError('Error', 'Proveedor no encontrado');
            router.push('/dashboard/proveedores');
          }
        } catch {
          toastError('Error', 'Error al cargar datos del proveedor');
        } finally {
          setIsLoadingData(false);
        }
      };
      
      fetchSupplier();
    }
  }, [user, isDepartmentHead, id, setValue, router]);

  const handleCoverFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    if (file.size > 10 * 1024 * 1024) {
      warning('Archivo muy grande', 'La carátula no puede exceder 10MB');
      return;
    }

    setCoverFile(file);
    setExistingCoverUrl(null);
    const reader = new FileReader();
    reader.onloadend = () => setCoverPreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const onSubmit = async (data: SupplierFormData) => {
    // On edit, cover is required only if there's no existing one
    if (!coverFile && !existingCoverUrl) {
      toastError('Campo requerido', 'Debes adjuntar la carátula del proveedor');
      return;
    }

    try {
      setIsSubmitting(true);

      let coverImageUrl = existingCoverUrl;

      // Upload new cover if changed
      if (coverFile) {
        const urlRes = await fetch('/api/v1/storage/signed-url', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fileName: coverFile.name,
            contentType: coverFile.type,
            bucket: 'Coconsa',
            folder: 'suppliers/covers',
          }),
        });

        if (!urlRes.ok) throw new Error('Error obteniendo URL de subida');
        const urlData = await urlRes.json();

        const uploadRes = await fetch(urlData.signedUrl, {
          method: 'PUT',
          headers: { 'Content-Type': coverFile.type },
          body: coverFile,
        });

        if (!uploadRes.ok) throw new Error('Error subiendo la carátula');
        coverImageUrl = urlData.publicUrl;
      }

      const response = await fetch(`/api/v1/suppliers/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          ...data, 
          rfc: data.rfc.toUpperCase(),
          cover_image_url: coverImageUrl,
        }),
      });

      const result = await response.json();

      if (response.ok) {
        success('Éxito', result.message || 'Proveedor actualizado correctamente');
        router.push('/dashboard/proveedores');
        router.refresh(); 
      } else {
        if (result.details) {
          toastError('Error', result.details.join(', '));
        } else {
          toastError('Error', result.error || 'Error al actualizar');
        }
      }
    } catch (error) {
      toastError('Error', error instanceof Error ? error.message : 'Ocurrió un error inesperado');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading || isLoadingData) return <div className="p-6">Preparando editor...</div>;

  if (!isDepartmentHead) {
    return (
      <div className="p-6 text-center">
        <h2 className="text-2xl font-bold text-red-600 mb-2">Acceso Denegado</h2>
        <p>Solo los jefes de departamento pueden editar proveedores.</p>
        <Link href="/dashboard" className="text-blue-600 mt-4 block">Regresar</Link>
      </div>
    );
  }

  const inputClass = (hasError: boolean) =>
    `w-full px-4 py-2 text-gray-900 bg-white rounded-lg border focus:ring-2 outline-none transition-all ${
      hasError ? 'border-red-300 focus:ring-red-200' : 'border-gray-300 focus:ring-red-100 focus:border-red-500'
    }`;

  const hasCover = !!coverFile || !!existingCoverUrl;

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="mb-8">
        <Link href="/dashboard/proveedores" className="text-gray-500 hover:text-gray-700 flex items-center gap-2 mb-4">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Volver a Proveedores
        </Link>
        <h1 className="text-3xl font-bold text-gray-900">Editar Proveedor</h1>
        <p className="text-gray-500 mt-1">Modifica los datos del proveedor seleccionado.</p>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-6">

          {/* Carátula */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Carátula del Proveedor *</label>
            <div className={`border-2 border-dashed rounded-xl p-6 transition-colors ${
              hasCover ? 'border-green-300 bg-green-50' : 'border-gray-300 hover:border-red-400'
            }`}>
              <input
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                onChange={handleCoverFileChange}
                className="hidden"
                id="cover-upload-edit"
              />
              {(coverPreview || existingCoverUrl) ? (
                <div className="flex items-center gap-4">
                  {(coverPreview && coverFile?.type.startsWith('image/')) || (existingCoverUrl && !existingCoverUrl.endsWith('.pdf')) ? (
                    <img src={coverPreview || existingCoverUrl!} alt="Carátula" className="w-20 h-20 object-cover rounded-lg border border-gray-200" />
                  ) : (
                    <div className="w-20 h-20 rounded-lg bg-red-100 flex items-center justify-center">
                      <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                      </svg>
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {coverFile?.name || 'Carátula actual'}
                    </p>
                    {coverFile && <p className="text-xs text-gray-500">{(coverFile.size / 1024).toFixed(1)} KB</p>}
                    {existingCoverUrl && !coverFile && (
                      <a href={existingCoverUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline">
                        Ver archivo actual
                      </a>
                    )}
                  </div>
                  <label
                    htmlFor="cover-upload-edit"
                    className="px-3 py-1.5 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors"
                  >
                    Cambiar
                  </label>
                </div>
              ) : (
                <label htmlFor="cover-upload-edit" className="flex flex-col items-center cursor-pointer">
                  <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mb-3">
                    <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                  </div>
                  <span className="text-sm font-medium text-gray-700">Haz clic para subir la carátula</span>
                  <span className="text-xs text-gray-500 mt-1">PDF o imágenes · Máx. 10MB</span>
                </label>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nombre Comercial *</label>
              <input type="text" {...register('commercial_name')} className={inputClass(!!errors.commercial_name)} />
              {errors.commercial_name && <p className="mt-1 text-sm text-red-600">{errors.commercial_name.message}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Razón Social *</label>
              <input type="text" {...register('social_reason')} className={inputClass(!!errors.social_reason)} />
              {errors.social_reason && <p className="mt-1 text-sm text-red-600">{errors.social_reason.message}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">RFC *</label>
              <input type="text" {...register('rfc')} className={`${inputClass(!!errors.rfc)} uppercase`} />
              {errors.rfc && <p className="mt-1 text-sm text-red-600">{errors.rfc.message}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Categoría *</label>
              <input type="text" {...register('category')} className={inputClass(!!errors.category)} />
              {errors.category && <p className="mt-1 text-sm text-red-600">{errors.category.message}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Banco *</label>
              <input type="text" {...register('bank')} className={inputClass(!!errors.bank)} />
              {errors.bank && <p className="mt-1 text-sm text-red-600">{errors.bank.message}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">CLABE Interbancaria *</label>
              <input type="text" maxLength={18} {...register('clabe')} className={inputClass(!!errors.clabe)} />
              {errors.clabe && <p className="mt-1 text-sm text-red-600">{errors.clabe.message}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Teléfono</label>
              <input type="text" {...register('phone')} className={inputClass(false)} />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nombre de Contacto</label>
              <input type="text" {...register('contact')} className={inputClass(false)} />
            </div>
            
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Dirección Comercial</label>
              <textarea {...register('address')} rows={3} className={inputClass(false)} />
            </div>

          </div>

          <div className="border-t border-gray-100 pt-6 flex justify-end gap-3">
            <Link href="/dashboard/proveedores" className="px-6 py-2 rounded-lg border border-gray-300 text-gray-700 font-medium hover:bg-gray-50">Cancelar</Link>
            <button type="submit" disabled={isSubmitting} className="px-6 py-2 rounded-lg bg-red-600 text-white font-medium hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed">
              {isSubmitting ? 'Guardando...' : 'Actualizar Proveedor'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
