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
  is_urgent: boolean;
  applicant: {
    full_name: string;
  };
}

const STATUS_CONFIG: Record<string, { label: string; className: string; dotColor: string }> = {
  pending: { label: 'Nuevo', className: 'bg-yellow-100 text-yellow-800', dotColor: 'bg-yellow-500' },
  in_progress: { label: 'En Proceso', className: 'bg-blue-100 text-blue-800', dotColor: 'bg-blue-500' },
  approved: { label: 'Aprobada', className: 'bg-green-100 text-green-800', dotColor: 'bg-green-500' },
  rejected: { label: 'Rechazada', className: 'bg-red-100 text-red-800', dotColor: 'bg-red-500' },
  paid: { label: 'Pagada', className: 'bg-purple-100 text-purple-800', dotColor: 'bg-purple-500' },
  completed: { label: 'Completada', className: 'bg-gray-100 text-gray-800', dotColor: 'bg-gray-500' },
};

type FilterKey = 'all' | 'my-approvals' | 'mine' | 'pending' | 'in_progress' | 'approved' | 'rejected';

export default function NeedsListsPage() {
  const router = useRouter();
  const [needsLists, setNeedsLists] = useState<NeedsList[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<FilterKey>('all');

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
      day: 'numeric',
      month: 'short',
    });
  };

  // Stats
  const stats = {
    total: needsLists.length,
    pending: needsLists.filter(l => l.status === 'pending').length,
    inProgress: needsLists.filter(l => l.status === 'in_progress').length,
    approved: needsLists.filter(l => l.status === 'approved').length,
    toApprove: needsLists.filter(l => l.canApprove).length,
  };

  const getStatusLabel = (list: NeedsList) => {
    const config = STATUS_CONFIG[list.status] || STATUS_CONFIG.pending;
    if ((list.status === 'pending' || list.status === 'in_progress') && list.currentDepartment) {
      return `${config.label} | ${list.currentDepartment}`;
    }
    return config.label;
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="h-8 w-56 bg-gray-200 rounded animate-pulse"></div>
            <div className="h-4 w-72 bg-gray-200 rounded animate-pulse mt-2"></div>
          </div>
          <div className="h-10 w-32 bg-gray-200 rounded-lg animate-pulse"></div>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-white rounded-xl shadow p-5 animate-pulse">
              <div className="h-4 w-20 bg-gray-200 rounded mb-3"></div>
              <div className="h-8 w-12 bg-gray-200 rounded"></div>
            </div>
          ))}
        </div>
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="bg-white rounded-xl shadow p-6 animate-pulse">
              <div className="h-5 w-40 bg-gray-200 rounded mb-3"></div>
              <div className="h-4 w-60 bg-gray-200 rounded"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
        <svg className="w-12 h-12 mx-auto text-red-400 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.072 16.5c-.77.833.192 2.5 1.732 2.5z" />
        </svg>
        <p className="text-red-800 font-medium">{error}</p>
        <button
          onClick={fetchNeedsLists}
          className="mt-3 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm"
        >
          Reintentar
        </button>
      </div>
    );
  }

  const filters: { key: FilterKey; label: string; count: number; icon?: string }[] = [
    { key: 'all', label: 'Todas', count: stats.total },
    { key: 'my-approvals', label: 'Por Aprobar', count: stats.toApprove },
    { key: 'mine', label: 'Mis Listas', count: needsLists.filter(l => l.isOwnList).length },
    { key: 'pending', label: 'Nuevas', count: stats.pending },
    { key: 'in_progress', label: 'En Proceso', count: stats.inProgress },
    { key: 'approved', label: 'Aprobadas', count: stats.approved },
    { key: 'rejected', label: 'Rechazadas', count: needsLists.filter(l => l.status === 'rejected').length },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-red-600 to-red-700 rounded-xl shadow-lg p-6 text-white">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Listas de Necesidades</h1>
            <p className="text-red-100 text-sm mt-1">
              Gestiona las listas de necesidades
            </p>
          </div>
          <Link
            href="/dashboard/listas-necesidades/crear"
            className="inline-flex items-center justify-center gap-2 bg-white text-red-600 px-5 py-2.5 rounded-lg font-medium hover:bg-red-50 transition-colors shadow-sm"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            <span>Nueva Lista</span>
          </Link>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl shadow p-5">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Total</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{stats.total}</p>
        </div>
        <div className="bg-white rounded-xl shadow p-5">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Por Aprobar</p>
          <div className="flex items-center gap-2 mt-1">
            <p className="text-2xl font-bold text-orange-600">{stats.toApprove}</p>
            {stats.toApprove > 0 && (
              <span className="w-2 h-2 bg-orange-500 rounded-full animate-pulse"></span>
            )}
          </div>
        </div>
        <div className="bg-white rounded-xl shadow p-5">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">En Proceso</p>
          <p className="text-2xl font-bold text-blue-600 mt-1">{stats.inProgress}</p>
        </div>
        <div className="bg-white rounded-xl shadow p-5">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Aprobadas</p>
          <p className="text-2xl font-bold text-green-600 mt-1">{stats.approved}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        {filters.map(filter => (
          <button
            key={filter.key}
            onClick={() => setFilterStatus(filter.key)}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full text-sm font-medium transition-all ${
              filterStatus === filter.key
                ? 'bg-red-600 text-white shadow-sm'
                : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-200 hover:border-gray-300'
            }`}
          >
            {filter.label}
            <span className={`text-xs px-1.5 py-0.5 rounded-full ${
              filterStatus === filter.key
                ? 'bg-red-500 text-white'
                : 'bg-gray-100 text-gray-500'
            }`}>
              {filter.count}
            </span>
          </button>
        ))}
      </div>

      {/* List */}
      {filteredLists.length === 0 ? (
        <div className="bg-white rounded-xl shadow p-12 text-center">
          <div className="w-16 h-16 mx-auto bg-gray-100 rounded-full flex items-center justify-center mb-4">
            <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <p className="text-gray-900 font-medium text-lg mb-1">Sin resultados</p>
          <p className="text-gray-500 text-sm">
            {filterStatus !== 'all' 
              ? 'No se encontraron listas con el filtro seleccionado'
              : 'Crea tu primera lista de necesidades para comenzar'
            }
          </p>
          {filterStatus !== 'all' && (
            <button
              onClick={() => setFilterStatus('all')}
              className="mt-4 text-red-600 hover:text-red-700 text-sm font-medium"
            >
              Ver todas las listas
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filteredLists.map((list) => {
            const statusCfg = STATUS_CONFIG[list.status] || STATUS_CONFIG.pending;
            
            return (
              <div
                key={list.id}
                className="bg-white rounded-xl shadow-sm hover:shadow-md transition-all border border-gray-100 cursor-pointer group"
                onClick={() => router.push(`/dashboard/listas-necesidades/${list.id}`)}
              >
                <div className="p-5">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                    {/* Left: Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 flex-wrap mb-1.5">
                        <h3 className="text-base font-semibold text-gray-900 group-hover:text-red-600 transition-colors">
                          {list.folio || `Lista #${list.id}`}
                        </h3>
                        <div className="flex items-center gap-1.5">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${statusCfg.className}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${statusCfg.dotColor}`}></span>
                            {getStatusLabel(list)}
                          </span>
                          {list.is_urgent && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-700">
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                              </svg>
                              Urgente
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-500">
                        <span>{list.applicant?.full_name || 'Desconocido'}</span>
                        <span className="text-gray-300">·</span>
                        <span>{formatDate(list.date)}</span>
                        <span className="text-gray-300">·</span>
                        <span>{list.itemCount} {list.itemCount === 1 ? 'concepto' : 'conceptos'}</span>
                      </div>
                    </div>

                    {/* Right: Amount + Badge */}
                    <div className="flex items-center gap-4 sm:flex-col sm:items-end">
                      <p className="text-lg font-bold text-gray-900">
                        {formatCurrency(list.total, list.currency)}
                      </p>
                      {list.canApprove && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-red-50 text-red-700 text-xs font-medium rounded-lg border border-red-200">
                          <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse"></span>
                          Requiere tu aprobación
                        </span>
                      )}
                      {!list.canApprove && list.my_department_status === 'approved' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-green-50 text-green-700 text-xs font-medium rounded-lg border border-green-200">
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                          Ya aprobaste
                        </span>
                      )}
                      {!list.canApprove && list.my_department_status === 'rejected' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-red-50 text-red-700 text-xs font-medium rounded-lg border border-red-200">
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                          Ya rechazaste
                        </span>
                      )}
                    </div>

                    {/* Chevron */}
                    <svg className="w-5 h-5 text-gray-300 group-hover:text-red-400 transition-colors hidden sm:block flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
