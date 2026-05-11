'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useToast } from '@/components/ui/Toast';
import { TableSkeleton } from '@/components/ui/Skeletons';

interface NeedsList {
  id: number;
  folio: string;
  created_at: string;
  total: number;
  currency: string;
  status: string;
  applicant?: {
    full_name: string;
  };
  store?: {
    name: string;
  };
}

export default function ComprobacionesPage() {
  const [lists, setLists] = useState<NeedsList[]>([]);
  const [loading, setLoading] = useState(true);
  const toast = useToast();

  const fetchLists = async () => {
    try {
      setLoading(true);
      // Fetch completed, verifying, and verified lists
      const response = await fetch('/api/v1/needs-lists?status=completed,verifying,verified');
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Error al cargar las listas');
      }

      setLists(data.data || []);
    } catch (error) {
      toast.error('Error', error instanceof Error ? error.message : 'Error al cargar los datos');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLists();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const formatCurrency = (amount: number, currency: string = 'MXN') => {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: currency,
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('es-MX', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Comprobación de Gastos</h1>
          <p className="text-gray-500 mt-1">
            Gestiona la comprobación de gastos de las listas de necesidades ya pagadas.
          </p>
        </div>
      </div>

      {/* Lists */}
      <div className="bg-white rounded-xl shadow border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="p-6">
            <TableSkeleton rows={5} cols={6} />
          </div>
        ) : lists.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-1">No hay gastos pendientes</h3>
            <p className="text-gray-500 max-w-sm mx-auto">
              No hay listas de necesidades completadas pendientes de comprobación.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Folio / Fecha</th>
                  <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Solicitante</th>
                  <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Sucursal</th>
                  <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Total Entregado</th>
                  <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Estado</th>
                  <th className="px-6 py-4 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {lists.map((list) => (
                  <tr key={list.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="font-medium text-gray-900">{list.folio || `NL-${list.id.toString().padStart(4, '0')}`}</span>
                        <span className="text-sm text-gray-500">{formatDate(list.created_at)}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-gray-900">{list.applicant?.full_name || 'Sin asignar'}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-gray-600">{list.store?.name || 'N/A'}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="font-medium text-gray-900">{formatCurrency(list.total, list.currency)}</span>
                    </td>
                    <td className="px-6 py-4">
                      {list.status === 'verified' ? (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                          <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                          Comprobada
                        </span>
                      ) : list.status === 'verifying' ? (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                          <span className="w-1.5 h-1.5 rounded-full bg-yellow-500"></span>
                          En Revisión
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                          <span className="w-1.5 h-1.5 rounded-full bg-gray-500"></span>
                          Pendiente Subir
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Link
                        href={`/dashboard/comprobaciones/${list.id}`}
                        className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-emerald-700 bg-emerald-50 rounded-lg hover:bg-emerald-100 transition-colors"
                      >
                        {list.status === 'verified' ? 'Ver Detalles' : 'Comprobar Gastos'}
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
