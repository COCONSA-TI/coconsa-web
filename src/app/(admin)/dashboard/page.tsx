'use client';

import { useRequireAuth } from '@/hooks/useAuth';
import { useEffect, useState } from 'react';
import Link from 'next/link';

interface Order {
  id: string;
  created_at: string;
  store_name: string;
  total: number;
  currency: string;
  status: string;
  applicant_name: string;
  items_count: number;
  my_department_status: string | null;
}

interface OrderStats {
  pending: number;
  approved: number;
  rejected: number;
  in_progress: number;
  total: number;
}

function getRoleName(role?: string): string {
  const roleNames: Record<string, string> = {
    admin: 'Administrador',
    user: 'Usuario',
    supervisor: 'Supervisor',
    client: 'Cliente',
  };
  return roleNames[role || ''] || 'Usuario';
}

function getStatusBadge(status: string) {
  const statusConfig: Record<string, { label: string; className: string }> = {
    pending: { label: 'Pendiente', className: 'bg-yellow-100 text-yellow-800' },
    approved: { label: 'Aprobada', className: 'bg-green-100 text-green-800' },
    rejected: { label: 'Rechazada', className: 'bg-red-100 text-red-800' },
    in_progress: { label: 'En Proceso', className: 'bg-blue-100 text-blue-800' },
    completed: { label: 'Completada', className: 'bg-gray-100 text-gray-800' },
  };
  const config = statusConfig[status] || statusConfig.pending;
  return (
    <span className={`px-2 py-1 rounded-full text-xs font-medium ${config.className}`}>
      {config.label}
    </span>
  );
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));

  if (hours < 1) return 'Hace unos minutos';
  if (hours < 24) return `Hace ${hours} hora${hours > 1 ? 's' : ''}`;
  if (days === 1) return 'Ayer';
  if (days < 7) return `Hace ${days} días`;
  return date.toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatCurrency(amount: number, currency: string = 'MXN'): string {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: currency,
  }).format(amount);
}

export default function DashboardPage() {
  const { user, loading } = useRequireAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [stats, setStats] = useState<OrderStats>({ pending: 0, approved: 0, rejected: 0, in_progress: 0, total: 0 });
  const [loadingOrders, setLoadingOrders] = useState(true);

  useEffect(() => {
    async function fetchOrders() {
      try {
        const response = await fetch('/api/v1/orders', { credentials: 'include' });
        if (response.ok) {
          const data = await response.json();
          const ordersList = data.orders || [];
          setOrders(ordersList);
          
          // Calculate stats
          const newStats: OrderStats = {
            pending: ordersList.filter((o: Order) => o.status === 'pending').length,
            approved: ordersList.filter((o: Order) => o.status === 'approved').length,
            rejected: ordersList.filter((o: Order) => o.status === 'rejected').length,
            in_progress: ordersList.filter((o: Order) => o.status === 'in_progress').length,
            total: ordersList.length,
          };
          setStats(newStats);
        }
      } catch (error) {
        console.error('Error fetching orders:', error);
      } finally {
        setLoadingOrders(false);
      }
    }

    if (user) {
      fetchOrders();
    }
  }, [user]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Cargando...</p>
        </div>
      </div>
    );
  }

  const recentOrders = orders.slice(0, 5);
  const pendingOrders = orders.filter(o => o.status === 'pending');

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Welcome Card */}
      <div className="bg-gradient-to-r from-red-600 to-red-700 rounded-xl shadow-lg p-6 text-white">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center text-2xl font-bold backdrop-blur-sm">
            {user?.full_name?.charAt(0).toUpperCase() || user?.email?.charAt(0).toUpperCase()}
          </div>
          <div>
            <h1 className="text-2xl font-bold">
              Bienvenido, {user?.full_name || 'Usuario'}
            </h1>
            <div className="flex items-center gap-2 mt-1">
              <span className="px-3 py-1 bg-white/20 rounded-full text-sm font-medium backdrop-blur-sm">
                {getRoleName(user?.role)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl shadow p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-500 text-sm font-medium">Pendientes</p>
              <p className="text-2xl font-bold text-yellow-600 mt-1">
                {loadingOrders ? '-' : stats.pending}
              </p>
            </div>
            <div className="bg-yellow-100 rounded-full p-3">
              <svg className="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-500 text-sm font-medium">Aprobadas</p>
              <p className="text-2xl font-bold text-green-600 mt-1">
                {loadingOrders ? '-' : stats.approved}
              </p>
            </div>
            <div className="bg-green-100 rounded-full p-3">
              <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-500 text-sm font-medium">Rechazadas</p>
              <p className="text-2xl font-bold text-red-600 mt-1">
                {loadingOrders ? '-' : stats.rejected}
              </p>
            </div>
            <div className="bg-red-100 rounded-full p-3">
              <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-500 text-sm font-medium">Total</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                {loadingOrders ? '-' : stats.total}
              </p>
            </div>
            <div className="bg-gray-100 rounded-full p-3">
              <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pending Approvals / Notifications */}
        <div className="bg-white rounded-xl shadow">
          <div className="p-5 border-b border-gray-100">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">
                Notificaciones
              </h2>
              {pendingOrders.length > 0 && (
                <span className="px-2 py-1 bg-red-100 text-red-600 rounded-full text-xs font-medium">
                  {pendingOrders.length} pendiente{pendingOrders.length > 1 ? 's' : ''}
                </span>
              )}
            </div>
          </div>
          <div className="p-5">
            {loadingOrders ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600"></div>
              </div>
            ) : pendingOrders.length === 0 ? (
              <div className="text-center py-8">
                <div className="bg-green-100 rounded-full w-12 h-12 flex items-center justify-center mx-auto mb-3">
                  <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <p className="text-gray-500 text-sm">No hay órdenes pendientes</p>
                <p className="text-gray-400 text-xs mt-1">Todas las órdenes han sido procesadas</p>
              </div>
            ) : (
              <div className="space-y-3">
                {pendingOrders.slice(0, 4).map((order) => (
                  <Link
                    key={order.id}
                    href={`/dashboard/ordenes-compra/${order.id}`}
                    className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors group"
                  >
                    <div className="bg-yellow-100 rounded-full p-2">
                      <svg className="w-4 h-4 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        Orden #{order.id} - {order.store_name}
                      </p>
                      <p className="text-xs text-gray-500">
                        {formatCurrency(order.total, order.currency)} · {formatDate(order.created_at)}
                      </p>
                    </div>
                    <svg className="w-5 h-5 text-gray-400 group-hover:text-red-600 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </Link>
                ))}
                {pendingOrders.length > 4 && (
                  <Link
                    href="/dashboard/ordenes-compra?status=pending"
                    className="block text-center text-sm text-red-600 hover:text-red-700 font-medium py-2"
                  >
                    Ver todas las pendientes ({pendingOrders.length})
                  </Link>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Recent Orders */}
        <div className="bg-white rounded-xl shadow">
          <div className="p-5 border-b border-gray-100">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">
                Órdenes Recientes
              </h2>
              <Link
                href="/dashboard/ordenes-compra"
                className="text-sm text-red-600 hover:text-red-700 font-medium"
              >
                Ver todas
              </Link>
            </div>
          </div>
          <div className="p-5">
            {loadingOrders ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600"></div>
              </div>
            ) : recentOrders.length === 0 ? (
              <div className="text-center py-8">
                <div className="bg-gray-100 rounded-full w-12 h-12 flex items-center justify-center mx-auto mb-3">
                  <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <p className="text-gray-500 text-sm">No hay órdenes aún</p>
                <Link
                  href="/dashboard/ordenes-compra/crear"
                  className="inline-block mt-3 text-sm text-red-600 hover:text-red-700 font-medium"
                >
                  Crear primera orden
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                {recentOrders.map((order) => (
                  <Link
                    key={order.id}
                    href={`/dashboard/ordenes-compra/${order.id}`}
                    className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors group"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-gray-900">
                          #{order.id}
                        </p>
                        {getStatusBadge(order.status)}
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        {order.store_name} · {formatCurrency(order.total, order.currency)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-gray-400">{formatDate(order.created_at)}</p>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Quick Action */}
      <div className="bg-white rounded-xl shadow p-5">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-gray-900">Crear Nueva Orden de Compra</h3>
            <p className="text-sm text-gray-500 mt-1">Inicia una solicitud de compra con asistencia de IA</p>
          </div>
          <Link
            href="/dashboard/ordenes-compra/crear"
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium text-sm"
          >
            Nueva Orden
          </Link>
        </div>
      </div>
    </div>
  );
}
