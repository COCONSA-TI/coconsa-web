"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";

type OrderStatus = "pending" | "approved" | "rejected" | "in_progress" | "completed";

interface OrderItem {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  unit_price: number;
  subtotal: number;
  supplier_name: string;
}

interface OrderDetail {
  id: string;
  created_at: string;
  store_name: string;
  supplier_name: string;
  total: number;
  currency: string;
  status: OrderStatus;
  applicant_name: string;
  applicant_email: string;
  justification: string;
  retention: number | null;
  items: OrderItem[];
}

const statusConfig: Record<OrderStatus, { label: string; color: string; bgColor: string }> = {
  pending: { label: "Pendiente", color: "text-yellow-700", bgColor: "bg-yellow-100" },
  approved: { label: "Aprobada", color: "text-green-700", bgColor: "bg-green-100" },
  rejected: { label: "Rechazada", color: "text-red-700", bgColor: "bg-red-100" },
  in_progress: { label: "En Proceso", color: "text-blue-700", bgColor: "bg-blue-100" },
  completed: { label: "Completada", color: "text-gray-700", bgColor: "bg-gray-100" },
};

export default function OrdenDetallesPage() {
  const router = useRouter();
  const params = useParams();
  const orderId = params.id as string;
  
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [downloadingPdf, setDownloadingPdf] = useState(false);

  useEffect(() => {
    fetchOrderDetails();
  }, [orderId]);

  const fetchOrderDetails = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/v1/orders/${orderId}`);
      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || 'Error al cargar la orden');
      }
      
      setOrder(data.order);
    } catch (error) {
      console.error("Error al cargar orden:", error);
      alert('Error al cargar los detalles de la orden.');
      router.push('/dashboard/ordenes-compra');
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadPdf = async () => {
    try {
      setDownloadingPdf(true);
      const response = await fetch(`/api/v1/orders/${orderId}/pdf`);
      
      if (!response.ok) {
        throw new Error('Error al generar el PDF');
      }
      
      // Crear un blob con el PDF
      const blob = await response.blob();
      
      // Crear un enlace temporal y hacer clic en él para descargar
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `orden-compra-${orderId}.pdf`;
      document.body.appendChild(a);
      a.click();
      
      // Limpiar
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Error descargando PDF:', error);
      alert('Error al descargar el PDF. Por favor, intenta nuevamente.');
    } finally {
      setDownloadingPdf(false);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center h-64">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-gray-300 border-t-blue-600"></div>
        </div>
      </div>
    );
  }

  if (!order) {
    return null;
  }

  const statusInfo = statusConfig[order.status] || statusConfig.pending;
  const date = new Date(order.created_at);
  const subtotalItems = order.items.reduce((sum, item) => sum + item.subtotal, 0);
  const retentionAmount = order.retention ? (subtotalItems * order.retention / 100) : 0;

  return (
    <div className="container mx-auto px-4 py-4 sm:py-8">
      {/* Header */}
      <div className="mb-6 sm:mb-8">
        <button
          onClick={() => router.push('/dashboard/ordenes-compra')}
          className="mb-3 sm:mb-4 text-sm sm:text-base text-gray-600 hover:text-gray-900 flex items-center gap-2 transition-colors"
        >
          <span>←</span>
          <span>Volver a Órdenes</span>
        </button>
        
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div className="flex-1">
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-1 sm:mb-2">
              Orden #{order.id}
            </h1>
            <p className="text-xs sm:text-sm text-gray-600">
              {date.toLocaleDateString('es-MX', { 
                year: 'numeric', 
                month: 'short', 
                day: 'numeric'
              })} {date.toLocaleTimeString('es-MX', {
                hour: '2-digit',
                minute: '2-digit'
              })}
            </p>
          </div>
          
          <span className={`inline-flex px-3 sm:px-4 py-1 sm:py-2 text-xs sm:text-sm font-semibold rounded-full ${statusInfo.bgColor} ${statusInfo.color} self-start`}>
            {statusInfo.label}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        {/* Información General */}
        <div className="lg:col-span-2 space-y-4 sm:space-y-6">
          {/* Detalles de la Orden */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 sm:p-6">
            <h2 className="text-lg sm:text-xl font-bold text-gray-900 mb-3 sm:mb-4">Información General</h2>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <div>
                <label className="text-xs sm:text-sm font-medium text-gray-500">Solicitante</label>
                <p className="text-sm sm:text-base text-gray-900 font-medium">{order.applicant_name}</p>
                <p className="text-xs sm:text-sm text-gray-600">{order.applicant_email}</p>
              </div>
              
              <div>
                <label className="text-xs sm:text-sm font-medium text-gray-500">Almacén/Obra</label>
                <p className="text-sm sm:text-base text-gray-900 font-medium">{order.store_name}</p>
              </div>
              
              <div>
                <label className="text-xs sm:text-sm font-medium text-gray-500">Proveedor</label>
                <p className="text-sm sm:text-base text-gray-900 font-medium">{order.supplier_name}</p>
              </div>
              
              <div className="sm:col-span-2">
                <label className="text-xs sm:text-sm font-medium text-gray-500">Justificación</label>
                <p className="text-sm sm:text-base text-gray-900">{order.justification}</p>
              </div>
            </div>
          </div>

          {/* Items */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 sm:p-6">
            <h2 className="text-lg sm:text-xl font-bold text-gray-900 mb-3 sm:mb-4">Artículos ({order.items.length})</h2>
            
            {/* Vista de Cards (Móvil) */}
            <div className="md:hidden space-y-3">
              {order.items.map((item) => (
                <div key={item.id} className="border border-gray-200 rounded-lg p-3 bg-gray-50">
                  <div className="font-medium text-gray-900 mb-2">{item.name}</div>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Proveedor:</span>
                      <span className="text-gray-900">{item.supplier_name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Cantidad:</span>
                      <span className="text-gray-900">{item.quantity} {item.unit}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Precio Unit.:</span>
                      <span className="text-gray-900">${item.unit_price.toLocaleString('es-MX')}</span>
                    </div>
                    <div className="flex justify-between border-t border-gray-300 pt-1 mt-1">
                      <span className="text-gray-600 font-medium">Subtotal:</span>
                      <span className="text-gray-900 font-bold">${item.subtotal.toLocaleString('es-MX')}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Vista de Tabla (Desktop) */}
            <div className="hidden md:block overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Artículo</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Proveedor</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Cantidad</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">P. Unitario</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Subtotal</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {order.items.map((item) => (
                    <tr key={item.id}>
                      <td className="px-4 py-3">
                        <div className="text-sm font-medium text-gray-900">{item.name}</div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-sm text-gray-600">{item.supplier_name}</div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="text-sm text-gray-900">{item.quantity} {item.unit}</div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="text-sm text-gray-900">
                          ${item.unit_price.toLocaleString('es-MX')}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="text-sm font-medium text-gray-900">
                          ${item.subtotal.toLocaleString('es-MX')}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Resumen */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 sm:p-6 lg:sticky lg:top-4">
            <h2 className="text-lg sm:text-xl font-bold text-gray-900 mb-3 sm:mb-4">Resumen</h2>
            
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Subtotal</span>
                <span className="font-medium text-gray-900">
                  ${subtotalItems.toLocaleString('es-MX')} {order.currency}
                </span>
              </div>
              
              {order.retention && order.retention > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Retención ({order.retention}%)</span>
                  <span className="font-medium text-red-600">
                    -${retentionAmount.toLocaleString('es-MX')} {order.currency}
                  </span>
                </div>
              )}
              
              <div className="border-t border-gray-200 pt-3">
                <div className="flex justify-between">
                  <span className="text-lg font-bold text-gray-900">Total</span>
                  <span className="text-lg font-bold text-gray-900">
                    ${order.total.toLocaleString('es-MX')} {order.currency}
                  </span>
                </div>
              </div>
            </div>

            {/* Acciones */}
            <div className="mt-4 sm:mt-6 space-y-2 sm:space-y-3">
              <button
                onClick={handleDownloadPdf}
                disabled={downloadingPdf}
                className="w-full bg-gray-100 hover:bg-gray-200 text-gray-900 px-4 py-2 rounded-lg text-sm sm:text-base font-medium transition-colors flex items-center justify-center gap-2 disabled:bg-gray-50 disabled:text-gray-400"
              >
                <span>{downloadingPdf ? 'Generando...' : 'Descargar PDF'}</span>
              </button>
              
              {order.status === 'pending' && (
                <>
                  <button
                    onClick={() => {/* TODO: Aprobar */}}
                    className="w-full bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm sm:text-base font-medium transition-colors"
                  >
                    Aprobar Orden
                  </button>
                  
                  <button
                    onClick={() => {/* TODO: Rechazar */}}
                    className="w-full bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm sm:text-base font-medium transition-colors"
                  >
                    Rechazar Orden
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
