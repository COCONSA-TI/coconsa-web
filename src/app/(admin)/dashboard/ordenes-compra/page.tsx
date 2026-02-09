"use client";

import { useState, useEffect, useMemo, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import Link from "next/link";

type OrderStatus = "pending" | "approved" | "rejected" | "in_progress" | "completed";

interface Order {
  id: string;
  created_at: string;
  store_name: string;
  total: number;
  currency: string;
  status: OrderStatus;
  applicant_name: string;
  items_count: number;
  my_department_status?: 'pending' | 'approved' | 'rejected' | null;
}

const statusConfig: Record<OrderStatus, { label: string; className: string; iconBg: string }> = {
  pending: { label: "Pendiente", className: "bg-yellow-100 text-yellow-800", iconBg: "bg-yellow-500" },
  approved: { label: "Aprobada", className: "bg-green-100 text-green-800", iconBg: "bg-green-500" },
  rejected: { label: "Rechazada", className: "bg-red-100 text-red-800", iconBg: "bg-red-500" },
  in_progress: { label: "En Proceso", className: "bg-blue-100 text-blue-800", iconBg: "bg-blue-500" },
  completed: { label: "Completada", className: "bg-gray-100 text-gray-800", iconBg: "bg-gray-500" },
};

function formatCurrency(amount: number, currency: string = 'MXN'): string {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: currency,
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

function OrdenesCompraContent() {
  const searchParams = useSearchParams();
  const { hasPermission, loading: authLoading } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Filtros
  const [statusFilter, setStatusFilter] = useState<OrderStatus | "all">("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [storeFilter, setStoreFilter] = useState<string>("all");
  const [applicantFilter, setApplicantFilter] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");
  const [showFilters, setShowFilters] = useState(false);

  // Leer filtro de URL al cargar
  useEffect(() => {
    const statusParam = searchParams.get('status');
    if (statusParam && Object.keys(statusConfig).includes(statusParam)) {
      setStatusFilter(statusParam as OrderStatus);
    }
  }, [searchParams]);

  useEffect(() => {
    if (!authLoading) {
      fetchOrders();
    }
  }, [authLoading]);

  const fetchOrders = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/v1/orders');
      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || 'Error al cargar órdenes');
      }
      
      setOrders(data.orders);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  // Obtener listas únicas para filtros
  const stores = useMemo(() => {
    const uniqueStores = [...new Set(orders.map(o => o.store_name))];
    return uniqueStores.sort();
  }, [orders]);

  const applicants = useMemo(() => {
    const uniqueApplicants = [...new Set(orders.map(o => o.applicant_name))];
    return uniqueApplicants.sort();
  }, [orders]);

  // Aplicar todos los filtros
  const filteredOrders = useMemo(() => {
    return orders.filter(order => {
      // Filtro por estado
      if (statusFilter !== "all" && order.status !== statusFilter) {
        return false;
      }

      // Filtro por búsqueda (ID, solicitante, almacén)
      if (searchTerm) {
        const search = searchTerm.toLowerCase();
        const matchesId = order.id.toString().toLowerCase().includes(search);
        const matchesApplicant = order.applicant_name.toLowerCase().includes(search);
        const matchesStore = order.store_name.toLowerCase().includes(search);
        if (!matchesId && !matchesApplicant && !matchesStore) {
          return false;
        }
      }

      // Filtro por almacén
      if (storeFilter !== "all" && order.store_name !== storeFilter) {
        return false;
      }

      // Filtro por solicitante
      if (applicantFilter !== "all" && order.applicant_name !== applicantFilter) {
        return false;
      }

      // Filtro por fecha desde
      if (dateFrom) {
        const orderDate = new Date(order.created_at);
        const fromDate = new Date(dateFrom);
        fromDate.setHours(0, 0, 0, 0);
        if (orderDate < fromDate) {
          return false;
        }
      }

      // Filtro por fecha hasta
      if (dateTo) {
        const orderDate = new Date(order.created_at);
        const toDate = new Date(dateTo);
        toDate.setHours(23, 59, 59, 999);
        if (orderDate > toDate) {
          return false;
        }
      }

      return true;
    });
  }, [orders, statusFilter, searchTerm, storeFilter, applicantFilter, dateFrom, dateTo]);

  const stats = {
    total: orders.length,
    pending: orders.filter(o => o.status === "pending").length,
    approved: orders.filter(o => o.status === "approved").length,
    in_progress: orders.filter(o => o.status === "in_progress").length,
    rejected: orders.filter(o => o.status === "rejected").length,
  };

  const hasActiveFilters = searchTerm || storeFilter !== "all" || applicantFilter !== "all" || dateFrom || dateTo;

  const clearAllFilters = () => {
    setStatusFilter("all");
    setSearchTerm("");
    setStoreFilter("all");
    setApplicantFilter("all");
    setDateFrom("");
    setDateTo("");
  };

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Cargando...</p>
        </div>
      </div>
    );
  }

  if (!hasPermission('orders', 'view')) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="bg-red-100 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Acceso Denegado</h2>
          <p className="text-gray-600">No tienes permisos para ver las órdenes de compra</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-red-600 to-red-700 rounded-xl shadow-lg p-6 text-white">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Órdenes de Compra</h1>
            <p className="text-red-100 text-sm mt-1">
              Gestiona y revisa todas las solicitudes
            </p>
          </div>
          
          {hasPermission('orders', 'create') && (
            <Link
              href="/dashboard/ordenes-compra/crear"
              className="inline-flex items-center justify-center gap-2 bg-white text-red-600 px-5 py-2.5 rounded-lg font-medium hover:bg-red-50 transition-colors shadow-sm"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              <span>Nueva Orden</span>
            </Link>
          )}
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <button
          onClick={() => setStatusFilter("all")}
          className={`bg-white rounded-xl shadow p-4 text-left transition-all ${
            statusFilter === "all" ? "ring-2 ring-red-500 ring-offset-2" : "hover:shadow-md"
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

        <button
          onClick={() => setStatusFilter("pending")}
          className={`bg-white rounded-xl shadow p-4 text-left transition-all ${
            statusFilter === "pending" ? "ring-2 ring-yellow-500 ring-offset-2" : "hover:shadow-md"
          }`}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-500 text-xs font-medium uppercase tracking-wide">Pendientes</p>
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
          onClick={() => setStatusFilter("approved")}
          className={`bg-white rounded-xl shadow p-4 text-left transition-all ${
            statusFilter === "approved" ? "ring-2 ring-green-500 ring-offset-2" : "hover:shadow-md"
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
          onClick={() => setStatusFilter("in_progress")}
          className={`bg-white rounded-xl shadow p-4 text-left transition-all ${
            statusFilter === "in_progress" ? "ring-2 ring-blue-500 ring-offset-2" : "hover:shadow-md"
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
          onClick={() => setStatusFilter("rejected")}
          className={`bg-white rounded-xl shadow p-4 text-left transition-all ${
            statusFilter === "rejected" ? "ring-2 ring-red-500 ring-offset-2" : "hover:shadow-md"
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
      </div>

      {/* Search and Filters */}
      <div className="bg-white rounded-xl shadow p-4">
        <div className="flex flex-col sm:flex-row gap-3">
          {/* Search Input */}
          <div className="relative flex-1">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Buscar por ID, solicitante o almacén..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-900 placeholder-gray-500 focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>

          {/* Filter Toggle Button */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
              showFilters || hasActiveFilters
                ? "bg-red-100 text-red-700"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
            </svg>
            <span>Filtros</span>
            {hasActiveFilters && (
              <span className="w-2 h-2 bg-red-500 rounded-full"></span>
            )}
          </button>
        </div>

        {/* Expanded Filters */}
        {showFilters && (
          <div className="mt-4 pt-4 border-t border-gray-100">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Almacén Filter */}
              <div>
                <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5">
                  Almacén
                </label>
                <select
                  value={storeFilter}
                  onChange={(e) => setStoreFilter(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-red-500 focus:border-transparent"
                >
                  <option value="all">Todos los almacenes</option>
                  {stores.map(store => (
                    <option key={store} value={store}>{store}</option>
                  ))}
                </select>
              </div>

              {/* Solicitante Filter */}
              <div>
                <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5">
                  Solicitante
                </label>
                <select
                  value={applicantFilter}
                  onChange={(e) => setApplicantFilter(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-red-500 focus:border-transparent"
                >
                  <option value="all">Todos los solicitantes</option>
                  {applicants.map(applicant => (
                    <option key={applicant} value={applicant}>{applicant}</option>
                  ))}
                </select>
              </div>

              {/* Date From */}
              <div>
                <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5">
                  Desde
                </label>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-red-500 focus:border-transparent"
                />
              </div>

              {/* Date To */}
              <div>
                <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5">
                  Hasta
                </label>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-red-500 focus:border-transparent"
                />
              </div>
            </div>

            {/* Clear Filters */}
            {hasActiveFilters && (
              <div className="mt-4 flex justify-end">
                <button
                  onClick={clearAllFilters}
                  className="text-sm text-red-600 hover:text-red-700 font-medium"
                >
                  Limpiar todos los filtros
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Active Filters Summary */}
      {(statusFilter !== "all" || hasActiveFilters) && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-gray-500">Filtros activos:</span>
          
          {statusFilter !== "all" && (
            <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium ${statusConfig[statusFilter].className}`}>
              {statusConfig[statusFilter].label}
              <button onClick={() => setStatusFilter("all")} className="hover:opacity-70">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </span>
          )}
          
          {searchTerm && (
            <span className="inline-flex items-center gap-1 px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-sm font-medium">
              Búsqueda: {searchTerm}
              <button onClick={() => setSearchTerm("")} className="hover:opacity-70">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </span>
          )}
          
          {storeFilter !== "all" && (
            <span className="inline-flex items-center gap-1 px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-sm font-medium">
              Almacén: {storeFilter}
              <button onClick={() => setStoreFilter("all")} className="hover:opacity-70">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </span>
          )}
          
          {applicantFilter !== "all" && (
            <span className="inline-flex items-center gap-1 px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-sm font-medium">
              Solicitante: {applicantFilter}
              <button onClick={() => setApplicantFilter("all")} className="hover:opacity-70">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </span>
          )}
          
          {(dateFrom || dateTo) && (
            <span className="inline-flex items-center gap-1 px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-sm font-medium">
              Fecha: {dateFrom || '...'} - {dateTo || '...'}
              <button onClick={() => { setDateFrom(""); setDateTo(""); }} className="hover:opacity-70">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </span>
          )}

          <span className="text-sm text-gray-400">
            ({filteredOrders.length} resultado{filteredOrders.length !== 1 ? 's' : ''})
          </span>
        </div>
      )}

      {/* Orders List */}
      <div className="bg-white rounded-xl shadow">
        {filteredOrders.length === 0 ? (
          <div className="p-12 text-center">
            <div className="bg-gray-100 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <p className="text-gray-600 mb-2">
              {hasActiveFilters || statusFilter !== "all"
                ? "No se encontraron órdenes con los filtros aplicados"
                : "No hay órdenes aún"
              }
            </p>
            {(hasActiveFilters || statusFilter !== "all") ? (
              <button
                onClick={clearAllFilters}
                className="text-red-600 hover:text-red-700 font-medium text-sm"
              >
                Limpiar filtros
              </button>
            ) : hasPermission('orders', 'create') && (
              <Link
                href="/dashboard/ordenes-compra/crear"
                className="text-red-600 hover:text-red-700 font-medium text-sm"
              >
                Crear primera orden
              </Link>
            )}
          </div>
        ) : (
          <>
            {/* Mobile View - Cards */}
            <div className="lg:hidden divide-y divide-gray-100">
              {filteredOrders.map((order) => {
                const status = statusConfig[order.status] || statusConfig.pending;
                const dateInfo = formatDate(order.created_at);
                
                return (
                  <Link
                    key={order.id}
                    href={`/dashboard/ordenes-compra/${order.id}`}
                    className="block p-4 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="flex items-center gap-3">
                        <div className={`w-2 h-2 rounded-full ${status.iconBg}`}></div>
                        <div>
                          <span className="font-semibold text-gray-900">#{order.id}</span>
                          <span className="text-gray-400 mx-2">·</span>
                          <span className="text-sm text-gray-500">{dateInfo.relative}</span>
                        </div>
                      </div>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${status.className}`}>
                        {status.label}
                      </span>
                    </div>
                    
                    <div className="ml-5 space-y-1.5">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-500">Solicitante</span>
                        <span className="text-gray-900 font-medium">{order.applicant_name}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-500">Almacén</span>
                        <span className="text-gray-900">{order.store_name}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-500">Items</span>
                        <span className="text-gray-900">{order.items_count} artículos</span>
                      </div>
                      <div className="flex items-center justify-between text-sm pt-2 border-t border-gray-100">
                        <span className="text-gray-500">Total</span>
                        <span className="text-gray-900 font-bold">{formatCurrency(order.total, order.currency)}</span>
                      </div>
                    </div>

                    {order.my_department_status === 'pending' && order.status === 'pending' && (
                      <div className="mt-3 ml-5">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-orange-100 text-orange-700 rounded-full text-xs font-medium">
                          <span className="w-1.5 h-1.5 bg-orange-500 rounded-full animate-pulse"></span>
                          Requiere tu aprobación
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
                  <tr className="border-b border-gray-100">
                    <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-4">
                      Orden
                    </th>
                    <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-4">
                      Fecha
                    </th>
                    <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-4">
                      Solicitante
                    </th>
                    <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-4">
                      Almacén
                    </th>
                    <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-4">
                      Items
                    </th>
                    <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-4">
                      Total
                    </th>
                    <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-4">
                      Estado
                    </th>
                    <th className="text-right text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-4">
                      
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredOrders.map((order) => {
                    const status = statusConfig[order.status] || statusConfig.pending;
                    const dateInfo = formatDate(order.created_at);
                    
                    return (
                      <tr key={order.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <div className={`w-2 h-2 rounded-full ${status.iconBg}`}></div>
                            <span className="font-semibold text-gray-900">#{order.id}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm text-gray-900">{dateInfo.date}</div>
                          <div className="text-xs text-gray-500">{dateInfo.time}</div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-sm text-gray-900">{order.applicant_name}</span>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-sm text-gray-900">{order.store_name}</span>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-sm text-gray-600">{order.items_count}</span>
                        </td>
                        <td className="px-6 py-4">
                          <span className="font-semibold text-gray-900">{formatCurrency(order.total, order.currency)}</span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex flex-col gap-1">
                            <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium ${status.className} w-fit`}>
                              {status.label}
                            </span>
                            {order.my_department_status === 'pending' && order.status === 'pending' && (
                              <span className="inline-flex items-center gap-1 text-xs text-orange-600 font-medium">
                                <span className="w-1.5 h-1.5 bg-orange-500 rounded-full animate-pulse"></span>
                                Requiere aprobación
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <Link
                            href={`/dashboard/ordenes-compra/${order.id}`}
                            className="inline-flex items-center gap-1 text-red-600 hover:text-red-700 font-medium text-sm transition-colors"
                          >
                            Ver
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                          </Link>
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
    </div>
  );
}

// Loading fallback component
function OrdersLoading() {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600 mx-auto"></div>
        <p className="mt-4 text-gray-600">Cargando órdenes...</p>
      </div>
    </div>
  );
}

// Main export wrapped in Suspense for useSearchParams
export default function OrdenesCompraHub() {
  return (
    <Suspense fallback={<OrdersLoading />}>
      <OrdenesCompraContent />
    </Suspense>
  );
}
