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
  const { user, isAdmin, loading } = useRequireAuth();
  const { success, error: toastError } = useToast();
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingData, setIsLoadingData] = useState(true);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<SupplierFormData>({
    resolver: zodResolver(supplierSchema),
  });

  useEffect(() => {
    if (user && isAdmin) {
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
  }, [user, isAdmin, id, setValue, router]);

  const onSubmit = async (data: SupplierFormData) => {
    try {
      setIsSubmitting(true);
      
      const response = await fetch(`/api/v1/suppliers/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, rfc: data.rfc.toUpperCase() }),
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
      toastError('Error', 'Ocurrió un error inesperado de conexión');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading || isLoadingData) return <div className="p-6">Preparando editor...</div>;

  if (!isAdmin) {
    return (
      <div className="p-6 text-center">
        <h2 className="text-2xl font-bold text-red-600 mb-2">Acceso Denegado</h2>
        <p>Solo los administradores pueden editar proveedores.</p>
        <Link href="/dashboard" className="text-blue-600 mt-4 block">Regresar</Link>
      </div>
    );
  }

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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Campos idem al crear */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nombre Comercial *</label>
              <input type="text" {...register('commercial_name')} className={`w-full px-4 py-2 text-gray-900 bg-white rounded-lg border focus:ring-2 outline-none ${errors.commercial_name ? 'border-red-300' : 'border-gray-300 focus:border-red-500'}`} />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Razón Social *</label>
              <input type="text" {...register('social_reason')} className={`w-full px-4 py-2 text-gray-900 bg-white rounded-lg border focus:ring-2 outline-none ${errors.social_reason ? 'border-red-300' : 'border-gray-300 focus:border-red-500'}`} />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">RFC *</label>
              <input type="text" {...register('rfc')} className={`w-full px-4 py-2 text-gray-900 bg-white rounded-lg border focus:ring-2 outline-none uppercase ${errors.rfc ? 'border-red-300' : 'border-gray-300 focus:border-red-500'}`} />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Categoría *</label>
              <input type="text" {...register('category')} className={`w-full px-4 py-2 rounded-lg border focus:ring-2 outline-none ${errors.category ? 'border-red-300' : 'border-gray-300 focus:border-red-500'}`} />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Banco *</label>
              <input type="text" {...register('bank')} className={`w-full px-4 py-2 rounded-lg border focus:ring-2 outline-none ${errors.bank ? 'border-red-300' : 'border-gray-300 focus:border-red-500'}`} />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">CLABE Interbancaria *</label>
              <input type="text" maxLength={18} {...register('clabe')} className={`w-full px-4 py-2 rounded-lg border focus:ring-2 outline-none ${errors.clabe ? 'border-red-300' : 'border-gray-300 focus:border-red-500'}`} />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Teléfono</label>
              <input type="text" {...register('phone')} className="w-full px-4 py-2 text-gray-900 bg-white rounded-lg border border-gray-300 focus:border-red-500 outline-none" />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nombre de Contacto</label>
              <input type="text" {...register('contact')} className="w-full px-4 py-2 text-gray-900 bg-white rounded-lg border border-gray-300 focus:border-red-500 outline-none" />
            </div>
            
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Dirección Comercial</label>
              <textarea {...register('address')} rows={3} className="w-full px-4 py-2 text-gray-900 bg-white rounded-lg border border-gray-300 focus:border-red-500 outline-none" />
            </div>

          </div>

          <div className="border-t border-gray-100 pt-6 flex justify-end gap-3">
            <Link href="/dashboard/proveedores" className="px-6 py-2 rounded-lg border border-gray-300 text-gray-700 font-medium hover:bg-gray-50">Cancelar</Link>
            <button type="submit" disabled={isSubmitting} className="px-6 py-2 rounded-lg bg-red-600 text-white font-medium hover:bg-red-700">
              {isSubmitting ? 'Guardando...' : 'Actualizar Proveedor'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
