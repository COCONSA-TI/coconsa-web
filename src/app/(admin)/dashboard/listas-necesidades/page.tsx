'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface NeedsList {
  id: number;
  folio: string;
  date: string;
  status: string;
  total: number;
  currency: string;
  itemCount: number;
  firstItem: any;
  currentDepartment: string | null;
  canApprove: boolean;
  isOwnList: boolean;
  my_department_status: string | null;
  applicant: {
    full_name: string;
  };
}

const STATUS_COLORS = {
  pending: 'bg-yellow-100 text-yellow-800',
  in_progress: 'bg-blue-100 text-blue-800',
  approved: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
  paid: 'bg-purple-100 text-purple-800',
  completed: 'bg-gray-100 text-gray-800',
};

const STATUS_LABELS = {
  pending: 'Pendiente',
  in_progress: 'En Proceso',
  approved: 'Aprobada',
  rejected: 'Rechazada',
  paid: 'Pagada',
  completed: 'Completada',
};

export default function NeedsListsPage() {
  const router = useRouter();
  const [needsLists, setNeedsLists] = useState<NeedsList[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('all');

  useEffect(() => {
    fetchNeedsLists();
  }, []);

  const fetchNeedsLists = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/v1/needs-lists');
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Error al cargar las listas');
      }

      setNeedsLists(data.data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setLoading(false);
    }
  };

  const filteredLists = needsLists.filter(list => {
    if (filterStatus === 'all') return true;
    if (filterStatus === 'my-approvals') return list.canApprove;
    if (filterStatus === 'mine') return list.isOwnList;
    return list.status === filterStatus;
  });

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: currency === 'USD' ? 'USD' : 'MXN',
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('es-MX', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Cargando listas de necesidades...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <p className="text-red-800">{error}</p>
        <button
          onClick={fetchNeedsLists}
          className="mt-2 text-red-600 hover:text-red-800 underline"
        >
          Reintentar
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Listas de Necesidades</h1>
          <p className="mt-1 text-sm text-gray-600">
            Gestiona tus solicitudes de reembolsos y anticipos
          </p>
        </div>
        <Link
          href="/dashboard/listas-necesidades/crear"
          className="inline-flex items-center justify-center px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
        >
          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Nueva Lista
        </Link>
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setFilterStatus('all')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              filterStatus === 'all'
                ? 'bg-red-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Todas ({needsLists.length})
          </button>
          <button
            onClick={() => setFilterStatus('mine')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              filterStatus === 'mine'
                ? 'bg-red-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Mis Listas ({needsLists.filter(l => l.isOwnList).length})
          </button>
          <button
            onClick={() => setFilterStatus('my-approvals')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              filterStatus === 'my-approvals'
                ? 'bg-red-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Por Aprobar ({needsLists.filter(l => l.canApprove).length})
          </button>
          <button
            onClick={() => setFilterStatus('pending')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              filterStatus === 'pending'
                ? 'bg-red-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Pendientes
          </button>
          <button
            onClick={() => setFilterStatus('approved')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              filterStatus === 'approved'
                ? 'bg-red-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Aprobadas
          </button>
          <button
            onClick={() => setFilterStatus('in_progress')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              filterStatus === 'in_progress'
                ? 'bg-red-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            En Proceso
          </button>
          <button
            onClick={() => setFilterStatus('rejected')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              filterStatus === 'rejected'
                ? 'bg-red-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Rechazadas
          </button>
        </div>
      </div>

      {/* Lista de necesidades */}
      {filteredLists.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <svg
            className="w-16 h-16 mx-auto text-gray-400 mb-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
          <p className="text-gray-600 text-lg mb-2">No hay listas de necesidades</p>
          <p className="text-gray-500 text-sm">
            {filterStatus !== 'all' 
              ? 'No se encontraron listas con los filtros seleccionados'
              : 'Crea tu primera lista de necesidades para comenzar'
            }
          </p>
        </div>
      ) : (
        <div className="grid gap-4">
          {filteredLists.map((list) => (
            <div
              key={list.id}
              className="bg-white rounded-lg shadow hover:shadow-md transition-shadow p-6 cursor-pointer"
              onClick={() => router.push(`/dashboard/listas-necesidades/${list.id}`)}
            >
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">
                        {list.folio || `Lista #${list.id}`}
                      </h3>
                      <p className="text-sm text-gray-600 mt-1">
                        Solicitante: {list.applicant?.full_name || 'Desconocido'}
                      </p>
                    </div>
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-medium ${
                        STATUS_COLORS[list.status as keyof typeof STATUS_COLORS] || STATUS_COLORS.pending
                      }`}
                    >
                      {(list.status === 'pending' || list.status === 'in_progress') && list.currentDepartment
                        ? `${STATUS_LABELS[list.status as keyof typeof STATUS_LABELS] || list.status} | ${list.currentDepartment}`
                        : STATUS_LABELS[list.status as keyof typeof STATUS_LABELS] || list.status}
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-4 text-sm text-gray-600 mt-3">
                    <div className="flex items-center">
                      <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      {formatDate(list.date)}
                    </div>
                    <div className="flex items-center">
                      <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                      </svg>
                      {list.itemCount} {list.itemCount === 1 ? 'item' : 'items'}
                    </div>
                    {list.currentDepartment && (
                      <div className="flex items-center">
                        <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                        </svg>
                        {list.currentDepartment}
                      </div>
                    )}
                  </div>

                  {list.firstItem && (
                    <p className="text-sm text-gray-500 mt-2">
                      Primer item: {list.firstItem.nombre}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="text-2xl font-bold text-gray-900">
                      {formatCurrency(list.total, list.currency)}
                    </p>
                    {list.canApprove && (
                      <span className="inline-flex items-center gap-1 mt-1 px-2 py-1 bg-orange-100 text-orange-700 text-xs font-medium rounded">
                        <span className="w-1.5 h-1.5 bg-orange-500 rounded-full animate-pulse"></span>
                        Requiere tu aprobación
                      </span>
                    )}
                    {!list.canApprove && list.my_department_status === 'approved' && (
                      <span className="inline-flex items-center gap-1 mt-1 px-2 py-1 bg-green-100 text-green-700 text-xs font-medium rounded">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        Ya aprobaste
                      </span>
                    )}
                    {!list.canApprove && list.my_department_status === 'rejected' && (
                      <span className="inline-flex items-center gap-1 mt-1 px-2 py-1 bg-red-100 text-red-700 text-xs font-medium rounded">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                        Ya rechazaste
                      </span>
                    )}
                  </div>
                  <svg
                    className="w-6 h-6 text-gray-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 5l7 7-7 7"
                    />
                  </svg>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
