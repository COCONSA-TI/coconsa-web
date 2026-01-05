"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";

// Tipos para las órdenes
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
}

const statusConfig: Record<OrderStatus, { label: string; color: string; bgColor: string }> = {
  pending: { label: "Pendiente", color: "text-yellow-700", bgColor: "bg-yellow-100" },
  approved: { label: "Aprobada", color: "text-green-700", bgColor: "bg-green-100" },
  rejected: { label: "Rechazada", color: "text-red-700", bgColor: "bg-red-100" },
  in_progress: { label: "En Proceso", color: "text-blue-700", bgColor: "bg-blue-100" },
  completed: { label: "Completada", color: "text-gray-700", bgColor: "bg-gray-100" },
};

export default function OrdenesCompraHub() {
  const router = useRouter();
  const { user, isAdmin, hasPermission, loading: authLoading } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<OrderStatus | "all">("all");

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
      console.error("Error al cargar órdenes:", error);
      // Mostrar mensaje de error al usuario
      alert('Error al cargar las órdenes. Por favor, recarga la página.');
    } finally {
      setLoading(false);
    }
  };

  const handleApproveReject = async (orderId: string, action: 'approve' | 'reject') => {
    try {
      const response = await fetch(`/api/v1/orders/${orderId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });

      console.log('Response status:', response.status);

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Error al actualizar orden');
      }

      // Recargar órdenes
      await fetchOrders();
      alert(`Orden ${action === 'approve' ? 'aprobada' : 'rechazada'} exitosamente`);
    } catch (error) {
      console.error('Error al actualizar orden:', error);
      alert('Error al actualizar la orden. Por favor, intenta nuevamente.');
    }
  };

  const filteredOrders = filter === "all" 
    ? orders 
    : orders.filter(order => order.status === filter);

  // Mostrar loading mientras se carga autenticación
  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Cargando...</p>
        </div>
      </div>
    );
  }

  // Verificar permisos de visualización
  if (!hasPermission('orders', 'view')) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Acceso Denegado</h2>
          <p className="text-gray-600">No tienes permisos para ver las órdenes de compra</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-4 sm:py-8">
      {/* Header */}
      <div className="mb-6 sm:mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-1 sm:mb-2">
            Órdenes de Compra
          </h1>
          <p className="text-sm sm:text-base text-gray-600">
            Gestiona y revisa todas las órdenes de compra
          </p>
        </div>
        
        {hasPermission('orders', 'create') && (
          <button
            onClick={() => router.push('/dashboard/ordenes-compra/crear')}
            className="bg-red-600 hover:bg-red-700 text-white px-4 sm:px-6 py-2 sm:py-3 rounded-lg font-medium transition-colors flex items-center justify-center gap-2 shadow-lg w-full sm:w-auto"
          >
            <span className="text-xl">+</span>
            <span>Nueva Orden</span>
          </button>
        )}
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 mb-6 sm:mb-8">
        <div className="bg-white rounded-lg p-4 sm:p-6 shadow-sm border border-gray-200">
          <div className="text-xs sm:text-sm text-gray-600 mb-1">Total Órdenes</div>
          <div className="text-2xl sm:text-3xl font-bold text-gray-900">{orders.length}</div>
        </div>
        
        <div className="bg-yellow-50 rounded-lg p-4 sm:p-6 shadow-sm border border-yellow-200">
          <div className="text-xs sm:text-sm text-yellow-700 mb-1">Pendientes</div>
          <div className="text-2xl sm:text-3xl font-bold text-yellow-900">
            {orders.filter(o => o.status === "pending").length}
          </div>
        </div>
        
        <div className="bg-green-50 rounded-lg p-4 sm:p-6 shadow-sm border border-green-200">
          <div className="text-xs sm:text-sm text-green-700 mb-1">Aprobadas</div>
          <div className="text-2xl sm:text-3xl font-bold text-green-900">
            {orders.filter(o => o.status === "approved").length}
          </div>
        </div>
        
        <div className="bg-blue-50 rounded-lg p-4 sm:p-6 shadow-sm border border-blue-200">
          <div className="text-xs sm:text-sm text-blue-700 mb-1">En Proceso</div>
          <div className="text-2xl sm:text-3xl font-bold text-blue-900">
            {orders.filter(o => o.status === "in_progress").length}
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="mb-4 sm:mb-6 flex gap-2 overflow-x-auto pb-2 scrollbar-thin">
        <button
          onClick={() => setFilter("all")}
          className={`px-3 sm:px-4 py-2 rounded-lg font-medium transition-colors whitespace-nowrap text-sm ${
            filter === "all"
              ? "bg-gray-900 text-white"
              : "bg-white text-gray-700 border border-gray-300 hover:bg-gray-50"
          }`}
        >
          Todas
        </button>
        {Object.entries(statusConfig).map(([status, config]) => (
          <button
            key={status}
            onClick={() => setFilter(status as OrderStatus)}
            className={`px-3 sm:px-4 py-2 rounded-lg font-medium transition-colors whitespace-nowrap text-sm ${
              filter === status
                ? "bg-gray-900 text-white"
                : `bg-white text-gray-700 border border-gray-300 hover:bg-gray-50`
            }`}
          >
            {config.label}
          </button>
        ))}
      </div>

      {/* Orders Table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-gray-300 border-t-blue-600"></div>
            <p className="mt-4 text-gray-600">Cargando órdenes...</p>
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-gray-600 mb-4">No hay órdenes {filter !== "all" && statusConfig[filter]?.label.toLowerCase()}</p>
            <button
              onClick={() => router.push('/dashboard/ordenes-compra/crear')}
              className="text-blue-600 hover:text-blue-700 font-medium"
            >
              Crear primera orden →
            </button>
          </div>
        ) : (
          <>
            {/* Vista de Cards (Móvil) */}
            <div className="md:hidden space-y-4">
              {filteredOrders.map((order) => {
                const statusInfo = statusConfig[order.status] || statusConfig.pending;
                const date = new Date(order.created_at);
                
                return (
                  <div key={order.id} className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <div className="text-sm font-bold text-gray-900 mb-1">Orden #{order.id}</div>
                        <div className="text-xs text-gray-500">
                          {date.toLocaleDateString('es-MX', { month: 'short', day: 'numeric' })} • {date.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${statusInfo.bgColor} ${statusInfo.color}`}>
                        {statusInfo.label}
                      </span>
                    </div>
                    
                    <div className="space-y-2 mb-3 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Solicitante:</span>
                        <span className="text-gray-900 font-medium">{order.applicant_name}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Almacén:</span>
                        <span className="text-gray-900 font-medium">{order.store_name}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Items:</span>
                        <span className="text-gray-900 font-medium">{order.items_count} artículos</span>
                      </div>
                      <div className="flex justify-between border-t border-gray-200 pt-2">
                        <span className="text-gray-600">Total:</span>
                        <span className="text-gray-900 font-bold">${order.total.toLocaleString('es-MX', { maximumFractionDigits: 0 })} {order.currency}</span>
                      </div>
                    </div>
                    
                    <div className="flex gap-2">
                      <button
                        onClick={() => router.push(`/dashboard/ordenes-compra/${order.id}`)}
                        className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                      >
                        Ver Detalles
                      </button>
                      {isAdmin && order.status === "pending" && (
                        <>
                          <button
                            onClick={() => handleApproveReject(order.id, 'approve')}
                            className="px-4 py-2 bg-green-100 text-green-700 rounded-lg text-sm font-medium hover:bg-green-200 transition-colors"
                            title="Aprobar orden"
                          >
                            ✓
                          </button>
                          <button
                            onClick={() => handleApproveReject(order.id, 'reject')}
                            className="px-4 py-2 bg-red-100 text-red-700 rounded-lg text-sm font-medium hover:bg-red-200 transition-colors"
                            title="Rechazar orden"
                          >
                            ✗
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Vista de Tabla (Desktop) */}
            <div className="hidden md:block overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      ID
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Fecha
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Solicitante
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Almacén/Obra
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Items
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Total
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Estado
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Acciones
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredOrders.map((order) => {
                    const statusInfo = statusConfig[order.status] || statusConfig.pending;
                    const date = new Date(order.created_at);
                    
                    return (
                      <tr key={order.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">#{order.id}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">
                            {date.toLocaleDateString('es-MX')}
                          </div>
                          <div className="text-xs text-gray-500">
                            {date.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">{order.applicant_name}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">{order.store_name}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">{order.items_count} items</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">
                            ${order.total.toLocaleString('es-MX', { maximumFractionDigits: 0 })} {order.currency}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${statusInfo.bgColor} ${statusInfo.color}`}>
                            {statusInfo.label}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <button
                            className="text-blue-600 hover:text-blue-900 mr-3"
                            onClick={() => router.push(`/dashboard/ordenes-compra/${order.id}`)}
                          >
                            Ver
                          </button>
                          {isAdmin && order.status === "pending" && (
                            <>
                              <button
                                className="text-green-600 hover:text-green-900 mr-3"
                                onClick={() => handleApproveReject(order.id, 'approve')}
                              >
                                Aprobar
                              </button>
                              <button
                                className="text-red-600 hover:text-red-900"
                                onClick={() => handleApproveReject(order.id, 'reject')}
                              >
                                Rechazar
                              </button>
                            </>
                          )}
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
