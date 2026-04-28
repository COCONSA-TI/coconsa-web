'use client';

import { useRequireAuth } from '@/hooks/useAuth';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useToast } from '@/components/ui/Toast';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

// Reutilizamos la misma validación robusta del backend para el frontend
const supplierSchema = z.object({
  commercial_name: z.string().min(2, 'El nombre comercial requiere al menos 2 caracteres'),
  social_reason: z.string().min(2, 'La razón social requiere al menos 2 caracteres'),
  rfc: z.string().min(12, 'El RFC debe tener al menos 12 caracteres').max(13, 'El RFC no puede exceder 13 caracteres'),
  address: z.string().optional(),
  phone: z.string().optional(),
  clabe: z.string().length(18, 'La CLABE interbancaria debe tener exactamente 18 dígitos numéricos'),
  bank: z.string().min(2, 'El nombre del banco es requerido'),
  contact: z.string().optional(),
  category: z.string().min(2, 'La categoría es requerida'),
});

type SupplierFormData = z.infer<typeof supplierSchema>;

export default function CrearProveedorPage() {
  const { isDepartmentHead, loading } = useRequireAuth();
  const { success, error: toastError, warning } = useToast();
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SupplierFormData>({
    resolver: zodResolver(supplierSchema),
    defaultValues: {
      commercial_name: '',
      social_reason: '',
      rfc: '',
      address: '',
      phone: '',
      clabe: '',
      bank: '',
      contact: '',
      category: '',
    }
  });

  const handleCoverFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    if (file.size > 10 * 1024 * 1024) {
      warning('Archivo muy grande', 'La carátula no puede exceder 10MB');
      return;
    }

    setCoverFile(file);
    // Preview
    const reader = new FileReader();
    reader.onloadend = () => setCoverPreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const onSubmit = async (data: SupplierFormData) => {
    if (!coverFile) {
      toastError('Campo requerido', 'Debes adjuntar la carátula del proveedor');
      return;
    }

    try {
      setIsSubmitting(true);

      // 1. Upload cover via presigned URL
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

      // 2. Create supplier with cover_image_url
      const response = await fetch('/api/v1/suppliers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          ...data, 
          rfc: data.rfc.toUpperCase(),
          cover_image_url: urlData.publicUrl,
        }),
      });

      const result = await response.json();

      if (response.ok) {
        success('Éxito', result.message || 'Proveedor guardado correctamente');
        router.push('/dashboard/proveedores');
        router.refresh();
      } else {
        if (result.details) {
          toastError('Error', result.details.join(', '));
        } else {
          toastError('Error', result.error || 'Error al guardar');
        }
      }
    } catch (error) {
      toastError('Error', error instanceof Error ? error.message : 'Ocurrió un error inesperado');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) return <div className="p-6">Cargando...</div>;

  if (!isDepartmentHead) {
    return (
      <div className="p-6 text-center">
        <h2 className="text-2xl font-bold text-red-600 mb-2">Acceso Denegado</h2>
        <p>Solo los jefes de departamento pueden registrar proveedores.</p>
        <Link href="/dashboard" className="text-blue-600 mt-4 block">Regresar</Link>
      </div>
    );
  }

  const inputClass = (hasError: boolean) =>
    `w-full px-4 py-2 text-gray-900 bg-white rounded-lg border focus:ring-2 outline-none transition-all ${
      hasError ? 'border-red-300 focus:ring-red-200' : 'border-gray-300 focus:ring-red-100 focus:border-red-500'
    }`;

  return (
    <div className="max-w-4xl mx-auto p-6">
      {/* Header */}
      <div className="mb-8">
        <Link href="/dashboard/proveedores" className="text-gray-500 hover:text-gray-700 flex items-center gap-2 mb-4">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Volver a Proveedores
        </Link>
        <h1 className="text-3xl font-bold text-gray-900">Registrar Proveedor</h1>
        <p className="text-gray-500 mt-1">Completa los datos fiscales y de contacto para dar de alta al proveedor</p>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-6">
          
          {/* Carátula */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Carátula del Proveedor *</label>
            <div className={`border-2 border-dashed rounded-xl p-6 transition-colors ${
              coverPreview ? 'border-green-300 bg-green-50' : 'border-gray-300 hover:border-red-400'
            }`}>
              <input
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                onChange={handleCoverFileChange}
                className="hidden"
                id="cover-upload"
              />
              {coverPreview ? (
                <div className="flex items-center gap-4">
                  {coverFile?.type.startsWith('image/') ? (
                    <img src={coverPreview} alt="Carátula" className="w-20 h-20 object-cover rounded-lg border border-gray-200" />
                  ) : (
                    <div className="w-20 h-20 rounded-lg bg-red-100 flex items-center justify-center">
                      <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                      </svg>
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{coverFile?.name}</p>
                    <p className="text-xs text-gray-500">{((coverFile?.size || 0) / 1024).toFixed(1)} KB</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => { setCoverFile(null); setCoverPreview(null); }}
                    className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ) : (
                <label htmlFor="cover-upload" className="flex flex-col items-center cursor-pointer">
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
            
            {/* Nombre Comercial */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nombre Comercial *</label>
              <input 
                type="text" 
                {...register('commercial_name')}
                placeholder="Ej. Comercializadora Estrella"
                className={inputClass(!!errors.commercial_name)}
              />
              {errors.commercial_name && <p className="mt-1 text-sm text-red-600">{errors.commercial_name.message}</p>}
            </div>

            {/* Razón Social */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Razón Social *</label>
              <input 
                type="text" 
                {...register('social_reason')}
                placeholder="Ej. Comercializadora S.A. de C.V."
                className={inputClass(!!errors.social_reason)}
              />
              {errors.social_reason && <p className="mt-1 text-sm text-red-600">{errors.social_reason.message}</p>}
            </div>

            {/* RFC */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">RFC *</label>
              <input 
                type="text" 
                {...register('rfc')}
                placeholder="Ej. XAXX010101000"
                className={`${inputClass(!!errors.rfc)} uppercase`}
              />
              <p className="mt-1 text-xs text-gray-500">Nota: Si el RFC ya existe, este formulario actualizará los datos.</p>
              {errors.rfc && <p className="mt-1 text-sm text-red-600">{errors.rfc.message}</p>}
            </div>

            {/* Categoría */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Categoría *</label>
              <input 
                type="text" 
                {...register('category')}
                placeholder="Ej. Materiales, Mantenimiento..."
                className={inputClass(!!errors.category)}
              />
              {errors.category && <p className="mt-1 text-sm text-red-600">{errors.category.message}</p>}
            </div>

            {/* Banco */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Banco *</label>
              <input 
                type="text" 
                {...register('bank')}
                placeholder="Ej. BBVA"
                className={inputClass(!!errors.bank)}
              />
              {errors.bank && <p className="mt-1 text-sm text-red-600">{errors.bank.message}</p>}
            </div>

            {/* CLABE */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">CLABE Interbancaria *</label>
              <input 
                type="text" 
                maxLength={18}
                {...register('clabe')}
                placeholder="18 dígitos"
                className={inputClass(!!errors.clabe)}
              />
              {errors.clabe && <p className="mt-1 text-sm text-red-600">{errors.clabe.message}</p>}
            </div>

            {/* Teléfono */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Teléfono (Opcional)</label>
              <input 
                type="text" 
                {...register('phone')}
                placeholder="Ej. 55 1234 5678"
                className={inputClass(false)}
              />
            </div>

            {/* Nombre Contacto */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nombre de Contacto (Opcional)</label>
              <input 
                type="text" 
                {...register('contact')}
                placeholder="Ej. Juan Pérez"
                className={inputClass(false)}
              />
            </div>
            
            {/* Dirección Comercial */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Dirección Comercial (Opcional)</label>
              <textarea 
                {...register('address')}
                rows={3}
                placeholder="Ej. Calle Principal #123, Colonia Centro..."
                className={inputClass(false)}
              />
            </div>

          </div>

          <div className="border-t border-gray-100 pt-6 flex justify-end gap-3">
            <Link
              href="/dashboard/proveedores"
              className="px-6 py-2 rounded-lg border border-gray-300 text-gray-700 font-medium hover:bg-gray-50 transition-colors"
            >
              Cancelar
            </Link>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-6 py-2 rounded-lg bg-red-600 text-white font-medium hover:bg-red-700 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center min-w-[150px]"
            >
              {isSubmitting ? (
                <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              ) : (
                'Guardar Proveedor'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
