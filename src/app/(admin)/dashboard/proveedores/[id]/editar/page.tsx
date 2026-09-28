'use client';

import { useRequireAuth } from '@/hooks/useAuth';
import { useState, useEffect, use, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useToast } from '@/components/ui/Toast';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

const supplierSchema = z.object({
  commercial_name: z.string().min(2, 'El nombre comercial requiere al menos 2 caracteres'),
  social_reason: z.string().min(2, 'La razón social requiere al menos 2 caracteres'),
  rfc: z.string().min(3, 'El RFC o identificador temporal es requerido').max(50, 'El RFC no puede exceder 50 caracteres'),
  address: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  clabe: z.string().min(4, 'La CLABE o identificador es requerido').max(30, 'La CLABE no puede exceder 30 caracteres'),
  bank: z.string().min(2, 'El nombre del banco es requerido'),
  contact: z.string().optional().nullable(),
  category: z.string().min(2, 'La categoría es requerida'),
});

type SupplierFormData = z.infer<typeof supplierSchema>;

const COMMON_CATEGORIES = [
  'Materiales',
  'Servicios',
  'Fletes',
  'Maquinaria',
  'Ferretería',
  'Acero',
  'Concreto',
  'Subcontratista',
  'Combustible',
  'Papelería / Oficina',
  'Mantenimiento',
  'Seguridad',
];

export default function EditarProveedorPage({ 
  params 
}: { 
  params: Promise<{ id: string }> 
}) {
  const { id } = use(params);
  const { user, isAdmin, isDepartmentHead, loading } = useRequireAuth();
  const { success, error: toastError, warning } = useToast();
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [existingCoverUrl, setExistingCoverUrl] = useState<string | null>(null);
  const [isAnalyzingAI, setIsAnalyzingAI] = useState(false);
  const [aiExtractedFields, setAiExtractedFields] = useState<string[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<SupplierFormData>({
    resolver: zodResolver(supplierSchema),
  });

  const selectedCategory = watch('category');

  useEffect(() => {
    if (user && (isAdmin || isDepartmentHead)) {
      const fetchSupplier = async () => {
        try {
          const response = await fetch(`/api/v1/suppliers/${id}`);
          const data = await response.json();
          if (data.success && data.supplier) {
            const s = data.supplier;
            setValue('commercial_name', s.commercial_name);
            setValue('social_reason', s.social_reason || s.commercial_name);
            setValue('rfc', s.rfc);
            setValue('address', s.address || '');
            setValue('phone', s.phone || '');
            setValue('clabe', s.clabe || 'XXXX');
            setValue('bank', s.bank || 'XXXX');
            setValue('contact', s.contact || '');
            setValue('category', s.category || 'General');
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
  }, [user, isAdmin, isDepartmentHead, id, setValue, router, toastError]);

  // AI Extraction for newly uploaded cover
  const runAiExtraction = async (file: File) => {
    setIsAnalyzingAI(true);
    setAiExtractedFields([]);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('/api/v1/suppliers/parse-cover', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();

      if (res.ok && data.success && data.data) {
        const extracted = data.data;
        const populated: string[] = [];

        if (extracted.commercial_name) {
          setValue('commercial_name', extracted.commercial_name, { shouldValidate: true });
          populated.push('commercial_name');
        }
        if (extracted.social_reason) {
          setValue('social_reason', extracted.social_reason, { shouldValidate: true });
          populated.push('social_reason');
        }
        if (extracted.rfc) {
          setValue('rfc', extracted.rfc, { shouldValidate: true });
          populated.push('rfc');
        }
        if (extracted.address) {
          setValue('address', extracted.address, { shouldValidate: true });
          populated.push('address');
        }
        if (extracted.phone) {
          setValue('phone', extracted.phone, { shouldValidate: true });
          populated.push('phone');
        }
        if (extracted.clabe) {
          setValue('clabe', extracted.clabe, { shouldValidate: true });
          populated.push('clabe');
        }
        if (extracted.bank) {
          setValue('bank', extracted.bank, { shouldValidate: true });
          populated.push('bank');
        }
        if (extracted.contact) {
          setValue('contact', extracted.contact, { shouldValidate: true });
          populated.push('contact');
        }
        if (extracted.category) {
          setValue('category', extracted.category, { shouldValidate: true });
          populated.push('category');
        }

        setAiExtractedFields(populated);
        success('Extracción con IA completada', 'Los campos se han actualizado a partir del documento adjunto.');
      } else {
        warning('Aviso', data.error || 'No se pudieron extraer todos los datos automáticamente.');
      }
    } catch {
      warning('Aviso', 'Error al comunicarse con Gemini IA.');
    } finally {
      setIsAnalyzingAI(false);
    }
  };

  const processSelectedFile = (file: File) => {
    if (file.size > 10 * 1024 * 1024) {
      warning('Archivo muy grande', 'La carátula no puede exceder 10MB');
      return;
    }

    setCoverFile(file);
    setExistingCoverUrl(null);

    const reader = new FileReader();
    reader.onloadend = () => setCoverPreview(reader.result as string);
    reader.readAsDataURL(file);

    runAiExtraction(file);
  };

  const handleCoverFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processSelectedFile(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processSelectedFile(file);
  };

  const onSubmit = async (data: SupplierFormData) => {
    if (!coverFile && !existingCoverUrl) {
      toastError('Campo requerido', 'Debes adjuntar la carátula del proveedor');
      return;
    }

    try {
      setIsSubmitting(true);

      let coverImageUrl = existingCoverUrl;

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

        if (!urlRes.ok) throw new Error('Error al obtener la URL segura de subida');
        const urlData = await urlRes.json();

        const uploadRes = await fetch(urlData.signedUrl, {
          method: 'PUT',
          headers: { 'Content-Type': coverFile.type },
          body: coverFile,
        });

        if (!uploadRes.ok) throw new Error('Error al cargar la carátula');
        coverImageUrl = urlData.publicUrl;
      }

      const response = await fetch(`/api/v1/suppliers/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...data,
          rfc: data.rfc.toUpperCase().trim(),
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

  if (loading || isLoadingData) {
    return (
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="h-28 bg-gray-200 rounded-xl animate-pulse"></div>
        <div className="h-96 bg-gray-200 rounded-xl animate-pulse"></div>
      </div>
    );
  }

  if (!isAdmin && !isDepartmentHead) {
    return (
      <div className="max-w-4xl mx-auto p-8 text-center bg-white rounded-xl shadow">
        <h2 className="text-xl font-bold text-red-600 mb-2">Acceso Denegado</h2>
        <p className="text-gray-500 mb-6">Solo los administradores del sistema y jefes de departamento pueden editar proveedores.</p>
        <Link href="/dashboard/proveedores" className="inline-flex px-5 py-2.5 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition">
          Volver a Proveedores
        </Link>
      </div>
    );
  }

  const inputClass = (hasError: boolean, isAiFilled: boolean) =>
    `w-full px-4 py-2.5 text-gray-900 bg-white rounded-lg border text-sm focus:ring-2 outline-none transition-all ${
      hasError
        ? 'border-red-300 focus:ring-red-200'
        : isAiFilled
        ? 'border-amber-400/80 bg-amber-50/20 focus:ring-amber-200 focus:border-amber-500'
        : 'border-gray-300 focus:ring-red-100 focus:border-red-500'
    }`;

  const hasCover = !!coverFile || !!existingCoverUrl;

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Retorno */}
      <div>
        <Link
          href="/dashboard/proveedores"
          className="text-gray-500 hover:text-gray-700 inline-flex items-center gap-2 text-sm font-medium transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Volver al Directorio de Proveedores
        </Link>
      </div>

      {/* Header Banner Oficial COCONSA */}
      <div className="bg-gradient-to-r from-red-600 to-red-700 rounded-xl shadow-lg p-6 text-white">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Editar Proveedor</h1>
            <p className="text-red-100 text-sm mt-1">
              Modifica los datos fiscales, bancarios o sustituye la carátula oficial
            </p>
          </div>
          <div className="flex items-center gap-2 bg-white/10 backdrop-blur-sm border border-white/20 px-3.5 py-1.5 rounded-lg text-xs font-medium text-white self-start sm:self-auto shadow-sm">
            <svg className="w-4 h-4 text-amber-300" fill="currentColor" viewBox="0 0 20 20">
              <path d="M11 3a1 1 0 10-2 0v1a1 1 0 102 0V3zM15.657 5.757a1 1 0 00-1.414-1.414l-.707.707a1 1 0 001.414 1.414l.707-.707zM18 10a1 1 0 01-1 1h-1a1 1 0 110-2h1a1 1 0 011 1zM5.05 6.464A1 1 0 106.464 5.05l-.707-.707a1 1 0 00-1.414 1.414l.707.707zM5 10a1 1 0 01-1 1H3a1 1 0 110-2h1a1 1 0 011 1zM8 16v-1h4v1a2 2 0 11-4 0zM12 14c.015-.34.208-.646.477-.859a4 4 0 10-4.954 0c.27.213.462.519.477.859h4z" />
            </svg>
            <span>Extracción con Gemini 2.5-flash disponible</span>
          </div>
        </div>
      </div>

      {/* Main Form */}
      <div className="bg-white rounded-xl shadow border border-gray-200 overflow-hidden">
        <form onSubmit={handleSubmit(onSubmit)} className="p-6 sm:p-8 space-y-8">
          
          {/* Seccion 1: Carátula e IA */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2">
                  <span className="flex items-center justify-center w-6 h-6 rounded-full bg-red-100 text-red-700 text-xs font-bold">1</span>
                  Carátula Bancaria o Constancia Fiscal
                  <span className="text-red-500">*</span>
                </h2>
                <p className="text-xs text-gray-500 mt-0.5 ml-8">
                  Puedes conservar la carátula actual o subir una nueva (la IA la analizará automáticamente).
                </p>
              </div>

              {coverFile && !isAnalyzingAI && (
                <button
                  type="button"
                  onClick={() => runAiExtraction(coverFile)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-lg transition-colors"
                >
                  <svg className="w-3.5 h-3.5 text-amber-600" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" />
                  </svg>
                  Re-analizar con IA
                </button>
              )}
            </div>

            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`relative border-2 border-dashed rounded-xl p-6 transition-all duration-200 ${
                isDragging
                  ? 'border-red-500 bg-red-50/50 scale-[1.005]'
                  : hasCover
                  ? 'border-green-300 bg-green-50/30'
                  : 'border-gray-300 hover:border-red-400 bg-gray-50/50 hover:bg-red-50/20'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.jpg,.jpeg,.png,.webp"
                onChange={handleCoverFileChange}
                className="hidden"
                id="cover-upload-edit"
              />

              {isAnalyzingAI ? (
                <div className="flex flex-col items-center justify-center py-6 text-center space-y-3">
                  <div className="w-14 h-14 rounded-full bg-gradient-to-tr from-amber-400 to-red-500 flex items-center justify-center shadow-lg animate-pulse">
                    <svg className="w-7 h-7 text-white animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-gray-900">Gemini 2.5-flash está analizando el documento...</h4>
                    <p className="text-xs text-gray-500 mt-1">Actualizando campos a partir de la nueva carátula.</p>
                  </div>
                </div>
              ) : hasCover ? (
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className="flex items-center gap-4 w-full sm:w-auto">
                    {(coverPreview && coverFile?.type.startsWith('image/')) || (existingCoverUrl && !existingCoverUrl.toLowerCase().endsWith('.pdf') && !coverFile) ? (
                      <img
                        src={coverPreview || existingCoverUrl!}
                        alt="Carátula"
                        className="w-16 h-16 object-cover rounded-lg border border-gray-200 shadow-sm"
                      />
                    ) : (
                      <div className="w-16 h-16 rounded-lg bg-red-100 flex items-center justify-center text-red-600 shadow-sm flex-shrink-0">
                        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                        </svg>
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-gray-900 truncate max-w-xs">
                          {coverFile?.name || 'Carátula cargada previamente'}
                        </p>
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-green-100 text-green-800">
                          {coverFile ? 'Nuevo archivo' : 'Actual'}
                        </span>
                      </div>
                      {coverFile ? (
                        <p className="text-xs text-gray-500 mt-0.5">
                          {((coverFile.size || 0) / (1024 * 1024)).toFixed(2)} MB
                        </p>
                      ) : existingCoverUrl ? (
                        <a
                          href={existingCoverUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-red-600 hover:text-red-700 font-medium hover:underline inline-flex items-center gap-1 mt-0.5"
                        >
                          Ver documento actual en nueva pestaña →
                        </a>
                      ) : null}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                    <label
                      htmlFor="cover-upload-edit"
                      className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-white hover:bg-gray-50 border border-gray-300 rounded-lg cursor-pointer transition shadow-sm"
                    >
                      Sustituir archivo
                    </label>
                  </div>
                </div>
              ) : (
                <label htmlFor="cover-upload-edit" className="flex flex-col items-center cursor-pointer py-4">
                  <div className="w-12 h-12 rounded-full bg-red-50 text-red-600 flex items-center justify-center mb-3">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                  </div>
                  <span className="text-sm font-semibold text-gray-800">Haz clic para subir una carátula</span>
                  <span className="text-xs text-gray-500 mt-1">PDF o imágenes · Máx. 10MB</span>
                </label>
              )}
            </div>
          </div>

          {/* Seccion 2: Datos Fiscales */}
          <div className="space-y-4 pt-4 border-t border-gray-100">
            <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2">
              <span className="flex items-center justify-center w-6 h-6 rounded-full bg-red-100 text-red-700 text-xs font-bold">2</span>
              Identificación y Datos Fiscales
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Nombre Comercial */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
                  Nombre Comercial <span className="text-red-500">*</span>
                  {aiExtractedFields.includes('commercial_name') && (
                    <span className="text-[10px] text-amber-700 bg-amber-100 px-1.5 py-0.2 rounded ml-1.5 font-normal">IA</span>
                  )}
                </label>
                <input
                  type="text"
                  {...register('commercial_name')}
                  placeholder="Ej. COMERCIALIZADORA ESTRELLA"
                  className={inputClass(!!errors.commercial_name, aiExtractedFields.includes('commercial_name'))}
                />
                {errors.commercial_name && <p className="mt-1 text-xs text-red-600">{errors.commercial_name.message}</p>}
              </div>

              {/* Razón Social */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
                  Razón Social <span className="text-red-500">*</span>
                  {aiExtractedFields.includes('social_reason') && (
                    <span className="text-[10px] text-amber-700 bg-amber-100 px-1.5 py-0.2 rounded ml-1.5 font-normal">IA</span>
                  )}
                </label>
                <input
                  type="text"
                  {...register('social_reason')}
                  placeholder="Ej. COMERCIALIZADORA S.A. DE C.V."
                  className={inputClass(!!errors.social_reason, aiExtractedFields.includes('social_reason'))}
                />
                {errors.social_reason && <p className="mt-1 text-xs text-red-600">{errors.social_reason.message}</p>}
              </div>

              {/* RFC */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    RFC o Identificador <span className="text-red-500">*</span>
                    {aiExtractedFields.includes('rfc') && (
                      <span className="text-[10px] text-amber-700 bg-amber-100 px-1.5 py-0.2 rounded ml-1.5 font-normal">IA</span>
                    )}
                  </label>
                  <span className="text-[11px] text-gray-400">Si falta: TEMP-NOMBRE</span>
                </div>
                <input
                  type="text"
                  {...register('rfc')}
                  placeholder="Ej. XAXX010101000 o TEMP-DIEGO-HERRERO"
                  className={`${inputClass(!!errors.rfc, aiExtractedFields.includes('rfc'))} uppercase font-mono`}
                />
                {errors.rfc && <p className="mt-1 text-xs text-red-600">{errors.rfc.message}</p>}
              </div>

              {/* Categoría */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
                  Categoría del Insumo / Servicio <span className="text-red-500">*</span>
                  {aiExtractedFields.includes('category') && (
                    <span className="text-[10px] text-amber-700 bg-amber-100 px-1.5 py-0.2 rounded ml-1.5 font-normal">IA</span>
                  )}
                </label>
                <div className="space-y-2">
                  <input
                    type="text"
                    {...register('category')}
                    placeholder="Ej. Materiales, Servicios, Fletes, XXXX..."
                    className={inputClass(!!errors.category, aiExtractedFields.includes('category'))}
                  />
                  <div className="flex flex-wrap gap-1.5">
                    {COMMON_CATEGORIES.slice(0, 6).map((cat) => (
                      <button
                        type="button"
                        key={cat}
                        onClick={() => setValue('category', cat, { shouldValidate: true })}
                        className={`text-[11px] px-2 py-0.5 rounded border transition-colors ${
                          selectedCategory === cat
                            ? 'bg-red-50 text-red-700 border-red-300 font-semibold'
                            : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'
                        }`}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                </div>
                {errors.category && <p className="mt-1 text-xs text-red-600">{errors.category.message}</p>}
              </div>
            </div>
          </div>

          {/* Seccion 3: Datos Bancarios */}
          <div className="space-y-4 pt-4 border-t border-gray-100">
            <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2">
              <span className="flex items-center justify-center w-6 h-6 rounded-full bg-red-100 text-red-700 text-xs font-bold">3</span>
              Información Bancaria
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Banco */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
                  Banco <span className="text-red-500">*</span>
                  {aiExtractedFields.includes('bank') && (
                    <span className="text-[10px] text-amber-700 bg-amber-100 px-1.5 py-0.2 rounded ml-1.5 font-normal">IA</span>
                  )}
                </label>
                <input
                  type="text"
                  {...register('bank')}
                  placeholder="Ej. BBVA, BANORTE, SANTANDER, XXXX..."
                  className={`${inputClass(!!errors.bank, aiExtractedFields.includes('bank'))} uppercase`}
                />
                {errors.bank && <p className="mt-1 text-xs text-red-600">{errors.bank.message}</p>}
              </div>

              {/* CLABE */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    CLABE Interbancaria <span className="text-red-500">*</span>
                    {aiExtractedFields.includes('clabe') && (
                      <span className="text-[10px] text-amber-700 bg-amber-100 px-1.5 py-0.2 rounded ml-1.5 font-normal">IA</span>
                    )}
                  </label>
                  <span className="text-[11px] text-gray-400">18 dígitos o XXXX</span>
                </div>
                <input
                  type="text"
                  maxLength={30}
                  {...register('clabe')}
                  placeholder="18 dígitos o XXXX"
                  className={`${inputClass(!!errors.clabe, aiExtractedFields.includes('clabe'))} font-mono`}
                />
                {errors.clabe && <p className="mt-1 text-xs text-red-600">{errors.clabe.message}</p>}
              </div>
            </div>
          </div>

          {/* Seccion 4: Contacto y Ubicación */}
          <div className="space-y-4 pt-4 border-t border-gray-100">
            <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2">
              <span className="flex items-center justify-center w-6 h-6 rounded-full bg-red-100 text-red-700 text-xs font-bold">4</span>
              Contacto y Domicilio
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Teléfono */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
                  Teléfono de Contacto
                  {aiExtractedFields.includes('phone') && (
                    <span className="text-[10px] text-amber-700 bg-amber-100 px-1.5 py-0.2 rounded ml-1.5 font-normal">IA</span>
                  )}
                </label>
                <input
                  type="text"
                  {...register('phone')}
                  placeholder="Ej. 871 123 4567 o XXXX"
                  className={inputClass(false, aiExtractedFields.includes('phone'))}
                />
              </div>

              {/* Contacto Directo */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
                  Persona o Representante de Contacto
                  {aiExtractedFields.includes('contact') && (
                    <span className="text-[10px] text-amber-700 bg-amber-100 px-1.5 py-0.2 rounded ml-1.5 font-normal">IA</span>
                  )}
                </label>
                <input
                  type="text"
                  {...register('contact')}
                  placeholder="Ej. ING. JUAN PÉREZ o XXXX"
                  className={inputClass(false, aiExtractedFields.includes('contact'))}
                />
              </div>

              {/* Domicilio Fiscal */}
              <div className="md:col-span-2">
                <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
                  Dirección Fiscal o Comercial
                  {aiExtractedFields.includes('address') && (
                    <span className="text-[10px] text-amber-700 bg-amber-100 px-1.5 py-0.2 rounded ml-1.5 font-normal">IA</span>
                  )}
                </label>
                <textarea
                  {...register('address')}
                  rows={2}
                  placeholder="Ej. C LIENZO CHARRO 114, FRACC VILLAS CENTENARIO, TORREON, COA, MEXICO o XXXX"
                  className={inputClass(false, aiExtractedFields.includes('address'))}
                />
              </div>
            </div>
          </div>

          {/* Action Footer */}
          <div className="pt-6 border-t border-gray-100 flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-xs text-gray-400">
              * Los cambios se aplicarán inmediatamente en el catálogo general.
            </p>

            <div className="flex items-center gap-3 w-full sm:w-auto">
              <Link
                href="/dashboard/proveedores"
                className="w-full sm:w-auto px-5 py-2.5 rounded-lg border border-gray-300 text-gray-700 font-medium hover:bg-gray-50 text-sm text-center transition-colors"
              >
                Cancelar
              </Link>

              <button
                type="submit"
                disabled={isSubmitting || isAnalyzingAI}
                className="w-full sm:w-auto px-6 py-2.5 rounded-lg bg-red-600 text-white font-medium hover:bg-red-700 text-sm transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 min-w-[170px]"
              >
                {isSubmitting ? (
                  <>
                    <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span>Guardando cambios...</span>
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span>Guardar Cambios</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
