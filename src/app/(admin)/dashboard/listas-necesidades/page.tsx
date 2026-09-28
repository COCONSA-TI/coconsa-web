'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import PendingBalancesDashboard from '@/components/needs-lists/PendingBalancesDashboard';
import { getDepartmentBadgeStyle } from '@/lib/approvalFlow';

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

const STATUS_CONFIG: Record<string, { label: string; className: string; iconBg: string }> = {
  pending: { label: 'Nuevo', className: 'bg-yellow-100 text-yellow-800', iconBg: 'bg-yellow-500' },
  in_progress: { label: 'En Proceso', className: 'bg-blue-100 text-blue-800', iconBg: 'bg-blue-500' },
  approved: { label: 'Aprobada', className: 'bg-green-100 text-green-800', iconBg: 'bg-green-500' },
  rejected: { label: 'Rechazada', className: 'bg-red-100 text-red-800', iconBg: 'bg-red-500' },
  paid: { label: 'Pagada', className: 'bg-purple-100 text-purple-800', iconBg: 'bg-purple-500' },
  completed: { label: 'Completada', className: 'bg-gray-100 text-gray-800', iconBg: 'bg-gray-500' },
  verifying: { label: 'En Revisión', className: 'bg-yellow-100 text-yellow-800', iconBg: 'bg-yellow-500' },
  verified: { label: 'Comprobada', className: 'bg-blue-100 text-blue-800', iconBg: 'bg-blue-500' },
};

type FilterKey = 'all' | 'my-approvals' | 'mine' | 'pending' | 'in_progress' | 'approved' | 'rejected' | 'completed';

function formatCurrency(amount: number, currency: string = 'MXN'): string {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: currency === 'USD' ? 'USD' : 'MXN',
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatDate(dateString: string): { date: string; time: string; relative: string } {
  const date = new Date(dateString);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));

  let relative = '';
  if (hours < 1) relative = 'Hace unos minutos';
  else if (hours < 24) relative = `Hace ${hours}h`;
  else if (days === 1) relative = 'Ayer';
  else if (days < 7) relative = `Hace ${days}d`;
  else relative = date.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' });

  return {
    date: date.toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' }),
    time: date.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }),
    relative,
  };
}

export default function NeedsListsPage() {
  const router = useRouter();
  const { user, isDepartmentHead, isAdmin } = useAuth();
  const [needsLists, setNeedsLists] = useState<NeedsList[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<FilterKey>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'lists' | 'balances'>('lists');

  useEffect(() => {
    fetchNeedsLists();
  }, []);

  const canViewAllBalances = Boolean(
    isAdmin || (isDepartmentHead && (user?.department_code || '').toLowerCase() === 'contabilidad')
  );
  const canViewBalances = true;

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

  // Stats calculation
  const stats = {
    total: needsLists.length,
    pending: needsLists.filter(l => l.status === 'pending').length,
    in_progress: needsLists.filter(l => l.status === 'in_progress').length,
    approved: needsLists.filter(l => l.status === 'approved').length,
    rejected: needsLists.filter(l => l.status === 'rejected').length,
    toApprove: needsLists.filter(l => l.canApprove).length,
    mine: needsLists.filter(l => l.isOwnList).length,
    completed: needsLists.filter(l => l.status === 'completed' || l.status === 'verifying' || l.status === 'verified').length,
  };

  const filteredLists = needsLists.filter(list => {
    if (filterStatus === 'my-approvals' && !list.canApprove) return false;
    if (filterStatus === 'mine' && !list.isOwnList) return false;
    if (filterStatus === 'completed' && !(list.status === 'completed' || list.status === 'verifying' || list.status === 'verified')) return false;
    if (
      filterStatus !== 'all' &&
      filterStatus !== 'my-approvals' &&
      filterStatus !== 'mine' &&
      filterStatus !== 'completed' &&
      list.status !== filterStatus
    ) {
      return false;
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const folioMatch = (list.folio || `lista #${list.id}`).toLowerCase().includes(q);
      const applicantMatch = (list.applicant?.full_name || '').toLowerCase().includes(q);
      const firstItemMatch = (list.firstItem?.nombre || '').toLowerCase().includes(q);
      const deptMatch = (list.currentDepartment || '').toLowerCase().includes(q);
      if (!folioMatch && !applicantMatch && !firstItemMatch && !deptMatch) {
        return false;
      }
    }

    return true;
  });

  const filters: { key: FilterKey; label: string; count: number }[] = [
    { key: 'all', label: 'Todas', count: stats.total },
    { key: 'my-approvals', label: 'Por Aprobar', count: stats.toApprove },
    { key: 'mine', label: 'Mis Listas', count: stats.mine },
    { key: 'pending', label: 'Nuevas', count: stats.pending },
    { key: 'in_progress', label: 'En Proceso', count: stats.in_progress },
    { key: 'approved', label: 'Aprobadas', count: stats.approved },
    { key: 'rejected', label: 'Rechazadas', count: stats.rejected },
    { key: 'completed', label: 'Completadas', count: stats.completed },
  ];

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="bg-gradient-to-r from-red-600 to-red-700 rounded-xl shadow-lg p-6 text-white animate-pulse">
          <div className="h-8 w-56 bg-white/20 rounded"></div>
          <div className="h-4 w-72 bg-white/10 rounded mt-2"></div>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="bg-white rounded-xl shadow p-4 animate-pulse">
              <div className="h-3 w-16 bg-gray-200 rounded mb-2"></div>
              <div className="h-7 w-12 bg-gray-200 rounded"></div>
            </div>
          ))}
        </div>
        <div className="bg-white rounded-xl shadow p-12 text-center animate-pulse">
          <div className="h-6 w-48 bg-gray-200 rounded mx-auto mb-3"></div>
          <div className="h-4 w-72 bg-gray-100 rounded mx-auto"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="bg-red-50 border border-red-200 rounded-xl p-8 text-center">
          <svg className="w-12 h-12 mx-auto text-red-500 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.072 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
          <p className="text-red-900 font-semibold text-lg">{error}</p>
          <button
            onClick={fetchNeedsLists}
            className="mt-4 px-5 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm font-medium shadow-sm"
          >
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header Banner - Diseño Oficial COCONSA */}
      <div className="bg-gradient-to-r from-red-600 to-red-700 rounded-xl shadow-lg p-6 text-white">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Listas de Necesidades</h1>
            <p className="text-red-100 text-sm mt-1">
              Gestiona las solicitudes de compras menores y reembolsos
            </p>
          </div>
          <Link
            href="/dashboard/listas-necesidades/crear"
            className="inline-flex items-center justify-center gap-2 bg-white text-red-600 px-5 py-2.5 rounded-lg font-medium hover:bg-red-50 transition-colors shadow-sm self-start sm:self-auto"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            <span>Nueva Lista</span>
          </Link>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('lists')}
            className={`whitespace-nowrap pb-4 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === 'lists'
                ? 'border-red-500 text-red-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Listas de Necesidades
          </button>
          <button
            onClick={() => setActiveTab('balances')}
            className={`whitespace-nowrap pb-4 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === 'balances'
                ? 'border-red-500 text-red-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Saldos Pendientes
          </button>
        </nav>
      </div>

      {activeTab === 'lists' && (
        <>
          {/* Stats Grid - Exactamente igual a Órdenes de Compra */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
            <button
              onClick={() => setFilterStatus(filterStatus === 'pending' ? 'all' : 'pending')}
              className={`bg-white rounded-xl shadow p-4 text-left transition-all ${
                filterStatus === 'pending' ? 'ring-2 ring-yellow-500 ring-offset-2' : 'hover:shadow-md'
              }`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-500 text-xs font-medium uppercase tracking-wide">Nuevas</p>
                  <p className="text-2xl font-bold text-yellow-600 mt-1">{stats.pending}</p>
                </div>
                <div className="bg-yellow-100 rounded-full p-2.5">
                  <svg className="w-5 h-5 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              </div>
            </button>

            <button
              onClick={() => setFilterStatus(filterStatus === 'in_progress' ? 'all' : 'in_progress')}
              className={`bg-white rounded-xl shadow p-4 text-left transition-all ${
                filterStatus === 'in_progress' ? 'ring-2 ring-blue-500 ring-offset-2' : 'hover:shadow-md'
              }`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-500 text-xs font-medium uppercase tracking-wide">En Proceso</p>
                  <p className="text-2xl font-bold text-blue-600 mt-1">{stats.in_progress}</p>
                </div>
                <div className="bg-blue-100 rounded-full p-2.5">
                  <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                </div>
              </div>
            </button>

            <button
              onClick={() => setFilterStatus(filterStatus === 'approved' ? 'all' : 'approved')}
              className={`bg-white rounded-xl shadow p-4 text-left transition-all ${
                filterStatus === 'approved' ? 'ring-2 ring-green-500 ring-offset-2' : 'hover:shadow-md'
              }`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-500 text-xs font-medium uppercase tracking-wide">Aprobadas</p>
                  <p className="text-2xl font-bold text-green-600 mt-1">{stats.approved}</p>
                </div>
                <div className="bg-green-100 rounded-full p-2.5">
                  <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              </div>
            </button>

            <button
              onClick={() => setFilterStatus(filterStatus === 'rejected' ? 'all' : 'rejected')}
              className={`bg-white rounded-xl shadow p-4 text-left transition-all ${
                filterStatus === 'rejected' ? 'ring-2 ring-red-500 ring-offset-2' : 'hover:shadow-md'
              }`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-500 text-xs font-medium uppercase tracking-wide">Rechazadas</p>
                  <p className="text-2xl font-bold text-red-600 mt-1">{stats.rejected}</p>
                </div>
                <div className="bg-red-100 rounded-full p-2.5">
                  <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              </div>
            </button>

            <button
              onClick={() => setFilterStatus('all')}
              className={`bg-white rounded-xl shadow p-4 text-left transition-all ${
                filterStatus === 'all' ? 'ring-2 ring-gray-900 ring-offset-2' : 'hover:shadow-md'
              }`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-500 text-xs font-medium uppercase tracking-wide">Total</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">{stats.total}</p>
                </div>
                <div className="bg-gray-100 rounded-full p-2.5">
                  <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
              </div>
            </button>
          </div>

          {/* Search & Filters Card */}
          <div className="bg-white rounded-xl shadow p-4 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="relative flex-1 max-w-md">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  type="text"
                  placeholder="Buscar por folio, solicitante, concepto..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-red-500 focus:bg-white transition-all"
                />
              </div>
              <span className="text-xs text-gray-400 self-center">
                ({filteredLists.length} resultado{filteredLists.length !== 1 ? 's' : ''})
              </span>
            </div>

            <div className="flex flex-wrap gap-2 pt-2 border-t border-gray-100">
              {filters.map(filter => (
                <button
                  key={filter.key}
                  onClick={() => setFilterStatus(filter.key)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                    filterStatus === filter.key
                      ? 'bg-red-600 text-white shadow-sm'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {filter.label}
                  <span className={`text-[11px] px-1.5 py-0.2 rounded-full ${
                    filterStatus === filter.key
                      ? 'bg-red-500 text-white'
                      : 'bg-white text-gray-600'
                  }`}>
                    {filter.count}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Lists Container - Estructura Desktop Tabla + Mobile Cards */}
          <div className="bg-white rounded-xl shadow overflow-hidden">
            {filteredLists.length === 0 ? (
              <div className="p-12 text-center">
                <div className="bg-gray-100 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <p className="text-gray-900 font-medium text-lg mb-1">Sin resultados</p>
                <p className="text-gray-500 text-sm mb-4">
                  {filterStatus !== 'all' || searchQuery
                    ? 'No se encontraron listas con los filtros aplicados'
                    : 'Crea tu primera lista de necesidades para comenzar'}
                </p>
                {(filterStatus !== 'all' || searchQuery) ? (
                  <button
                    onClick={() => {
                      setFilterStatus('all');
                      setSearchQuery('');
                    }}
                    className="text-red-600 hover:text-red-700 text-sm font-medium"
                  >
                    Limpiar filtros
                  </button>
                ) : (
                  <Link
                    href="/dashboard/listas-necesidades/crear"
                    className="text-red-600 hover:text-red-700 font-medium text-sm"
                  >
                    Crear primera lista
                  </Link>
                )}
              </div>
            ) : (
              <>
                {/* Mobile View - Cards */}
                <div className="lg:hidden divide-y divide-gray-100">
                  {filteredLists.map((list) => {
                    const statusCfg = STATUS_CONFIG[list.status] || STATUS_CONFIG.pending;
                    const dateInfo = formatDate(list.date);
                    const deptStyle = getDepartmentBadgeStyle(list.currentDepartment);

                    return (
                      <Link
                        key={list.id}
                        href={`/dashboard/listas-necesidades/${list.id}`}
                        className="block p-4 hover:bg-gray-50 transition-colors"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2.5 mb-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <div className={`w-2 h-2 flex-shrink-0 rounded-full ${statusCfg.iconBg}`}></div>
                            <span className="font-semibold text-gray-900">{list.folio || `Lista #${list.id}`}</span>
                            {list.is_urgent && (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-orange-100 text-orange-700 rounded text-xs font-medium">
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                                </svg>
                                Urgente
                              </span>
                            )}
                            <span className="text-gray-400">·</span>
                            <span className="text-xs text-gray-500">{dateInfo.relative}</span>
                          </div>
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${statusCfg.className}`}>
                              {statusCfg.label}
                            </span>
                            {(list.status === 'pending' || list.status === 'in_progress') && list.currentDepartment && (
                              <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium border ${deptStyle.badge}`}>
                                <span className={`w-1.5 h-1.5 rounded-full ${deptStyle.dot}`}></span>
                                {list.currentDepartment}
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="ml-4 space-y-1.5">
                          <div className="flex items-start justify-between text-sm gap-2">
                            <span className="text-gray-500 flex-shrink-0">Conceptos</span>
                            <div className="text-right">
                              <span className="text-gray-900 font-medium block truncate max-w-[200px] sm:max-w-xs">
                                {list.firstItem?.nombre || 'Sin conceptos'}
                              </span>
                              <span className="text-xs text-gray-500">
                                {list.itemCount === 1 ? '1 concepto' : `${list.itemCount} conceptos`}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center justify-between text-sm">
                            <span className="text-gray-500">Solicitante</span>
                            <span className="text-gray-900 font-medium">{list.applicant?.full_name || 'Desconocido'}</span>
                          </div>

                          <div className="flex items-center justify-between text-sm pt-2 border-t border-gray-100">
                            <span className="text-gray-500">Total</span>
                            <span className="text-gray-900 font-bold">{formatCurrency(list.total, list.currency)}</span>
                          </div>
                        </div>

                        {/* Badges de aprobación */}
                        {list.canApprove && (
                          <div className="mt-3 ml-4">
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-orange-100 text-orange-700 rounded-full text-xs font-medium">
                              <span className="w-1.5 h-1.5 bg-orange-500 rounded-full animate-pulse"></span>
                              Requiere tu aprobación
                            </span>
                          </div>
                        )}
                        {!list.canApprove && list.my_department_status === 'approved' && (
                          <div className="mt-3 ml-4">
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                              Ya aprobaste
                            </span>
                          </div>
                        )}
                        {!list.canApprove && list.my_department_status === 'rejected' && (
                          <div className="mt-3 ml-4">
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-red-100 text-red-700 rounded-full text-xs font-medium">
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                              Ya rechazaste
                            </span>
                          </div>
                        )}
                      </Link>
                    );
                  })}
                </div>

                {/* Desktop View - Table */}
                <div className="hidden lg:block overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-100 bg-gray-50/50">
                        <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-4">
                          Lista / Folio
                        </th>
                        <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-4">
                          Fecha
                        </th>
                        <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-4">
                          Solicitante
                        </th>
                        <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-4 max-w-[260px]">
                          Conceptos
                        </th>
                        <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-4">
                          Total
                        </th>
                        <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-4">
                          Estado
                        </th>
                        <th className="text-right text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-4">
                          Acción
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {filteredLists.map((list) => {
                        const statusCfg = STATUS_CONFIG[list.status] || STATUS_CONFIG.pending;
                        const dateInfo = formatDate(list.date);
                        const deptStyle = getDepartmentBadgeStyle(list.currentDepartment);

                        return (
                          <tr
                            key={list.id}
                            onClick={() => router.push(`/dashboard/listas-necesidades/${list.id}`)}
                            className="hover:bg-gray-50 cursor-pointer transition-colors group"
                          >
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="flex items-center gap-2">
                                <div className={`w-2 h-2 rounded-full ${statusCfg.iconBg}`}></div>
                                <span className="font-semibold text-gray-900 group-hover:text-red-600 transition-colors">
                                  {list.folio || `Lista #${list.id}`}
                                </span>
                                {list.is_urgent && (
                                  <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-orange-100 text-orange-700 rounded text-xs font-medium">
                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                                    </svg>
                                    Urgente
                                  </span>
                                )}
                              </div>
                            </td>

                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              <div>{dateInfo.date}</div>
                              <div className="text-xs text-gray-400">{dateInfo.relative}</div>
                            </td>

                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                              {list.applicant?.full_name || 'Desconocido'}
                            </td>

                            <td className="px-6 py-4 text-sm text-gray-500 max-w-[260px]">
                              <div className="font-medium text-gray-900 truncate" title={list.firstItem?.nombre || 'Sin conceptos'}>
                                {list.firstItem?.nombre || 'Sin conceptos'}
                              </div>
                              <div className="text-xs text-gray-400">
                                {list.itemCount === 1 ? '1 concepto' : `${list.itemCount} conceptos`}
                              </div>
                            </td>

                            <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900">
                              {formatCurrency(list.total, list.currency)}
                            </td>

                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="flex flex-col gap-1 items-start">
                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusCfg.className}`}>
                                  {statusCfg.label}
                                </span>
                                {(list.status === 'pending' || list.status === 'in_progress') && list.currentDepartment && (
                                  <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium border ${deptStyle.badge}`}>
                                    <span className={`w-1.5 h-1.5 rounded-full ${deptStyle.dot}`}></span>
                                    {list.currentDepartment}
                                  </span>
                                )}
                                {list.canApprove && (
                                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-orange-600">
                                    <span className="w-1.5 h-1.5 bg-orange-500 rounded-full animate-pulse"></span>
                                    Requiere tu firma
                                  </span>
                                )}
                              </div>
                            </td>

                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                              <span className="text-gray-400 group-hover:text-red-600 transition-colors inline-flex items-center gap-1 font-medium text-xs">
                                Ver detalle
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                </svg>
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        </>
      )}

      {canViewBalances && activeTab === 'balances' && (
        <PendingBalancesDashboard
          userId={canViewAllBalances ? undefined : user?.id}
          isOwnBalance={!canViewAllBalances}
        />
      )}
    </div>
  );
}
