"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { getOrderApprovals, canUserApprove, getApprovalIconType, type OrderApproval, type ApprovalIconType } from "@/lib/approvalFlow";

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
  justification_prove: string | null;
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
  const { isAdmin, user } = useAuth();
  
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [confirmComplete, setConfirmComplete] = useState(false);
  const [approvals, setApprovals] = useState<OrderApproval[]>([]);
  const [canApprove, setCanApprove] = useState(false);
  const [comments, setComments] = useState('');

  useEffect(() => {
    fetchOrderDetails();
  }, [orderId]);

  useEffect(() => {
    if (order && user) {
      checkUserCanApprove();
    }
  }, [order, user]);

  const fetchOrderDetails = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/v1/orders/${orderId}`);
      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || 'Error al cargar la orden');
      }
      
      setOrder(data.order);
      
      // Cargar aprobaciones
      const orderApprovals = await getOrderApprovals(orderId);
      setApprovals(orderApprovals);
    } catch (error) {
      console.error("Error al cargar orden:", error);
      alert('Error al cargar los detalles de la orden.');
      router.push('/dashboard/ordenes-compra');
    } finally {
      setLoading(false);
    }
  };

  const checkUserCanApprove = async () => {
    if (!user?.id) return;
    
    try {
      const result = await canUserApprove(user.id, orderId);
      setCanApprove(result.canApprove);
    } catch (error) {
      console.error('Error checking approval permissions:', error);
    }
  };

  const handleApprove = async () => {
    if (!confirm('¿Estás seguro de aprobar esta orden de compra?')) {
      return;
    }

    try {
      const response = await fetch(`/api/v1/orders/${orderId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ comments }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Error al aprobar la orden');
      }

      alert(data.message);
      setComments('');
      await fetchOrderDetails(); // Recargar datos
    } catch (error) {
      console.error('Error al aprobar:', error);
      const errorMessage = error instanceof Error ? error.message : 'Error al aprobar la orden';
      alert(errorMessage);
    }
  };

  const handleReject = async () => {
    const reason = prompt('¿Por qué rechazas esta orden? (obligatorio)');
    
    if (!reason || reason.trim() === '') {
      alert('Debes proporcionar una razón para rechazar la orden');
      return;
    }

    try {
      const response = await fetch(`/api/v1/orders/${orderId}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ comments: reason }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Error al rechazar la orden');
      }

      alert(data.message);
      await fetchOrderDetails(); // Recargar datos
    } catch (error) {
      console.error('Error al rechazar:', error);
      const errorMessage = error instanceof Error ? error.message : 'Error al rechazar la orden';
      alert(errorMessage);
    }
  };

  const handleCompleteOrder = async () => {
    if (!confirmComplete) {
      alert('Por favor, confirma que el proceso ha sido completado.');
      return;
    }

    try {
      const response = await fetch(`/api/v1/orders/${orderId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'complete' }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Error al completar orden');
      }

      alert('Orden completada exitosamente');
      await fetchOrderDetails(); // Recargar los detalles
      setConfirmComplete(false);
    } catch (error) {
      console.error('Error al completar orden:', error);
      alert('Error al completar la orden. Por favor, intenta nuevamente.');
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

  // Obtener el paso actual basado en aprobaciones
  const getCurrentApprovalStep = () => {
    if (order.status === 'rejected') return -1;
    if (order.status === 'completed') return approvals.length;
    
    // Encontrar la primera aprobación pendiente
    const firstPending = approvals.findIndex(a => a.status === 'pending');
    return firstPending === -1 ? approvals.length : firstPending;
  };

  const currentApprovalStep = getCurrentApprovalStep();

  // Renderizar icono según el tipo
  const renderApprovalIcon = (iconType: ApprovalIconType) => {
    switch (iconType) {
      case 'approved':
        return (
          <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
          </svg>
        );
      case 'rejected':
        return (
          <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
          </svg>
        );
      case 'active':
        return (
          <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
          </svg>
        );
      case 'pending':
      default:
        return (
          <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="currentColor" viewBox="0 0 20 20">
            <circle cx="10" cy="10" r="3" />
          </svg>
        );
    }
  };

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

      {/* Stepper de Progreso - Flujo de Aprobaciones */}
      {order.status !== 'rejected' && (
        <div className="mb-6 sm:mb-8 bg-white rounded-lg shadow-sm border border-gray-200 p-4 sm:p-6">
          <h2 className="text-lg font-bold text-gray-900 mb-4">Flujo de Aprobaciones</h2>
          
          {approvals.length === 0 ? (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <p className="text-sm text-yellow-800">
                Esta orden aún no tiene aprobaciones configuradas. Las aprobaciones se crearán automáticamente según el flujo establecido.
              </p>
            </div>
          ) : (
          <div className="relative">
            {/* Línea de progreso */}
            <div className="absolute top-5 left-8 right-8 h-1 bg-gray-200 -z-10"></div>
            <div 
              className="absolute top-5 left-8 h-1 bg-red-600 -z-10 transition-all duration-500"
              style={{ 
                width: approvals.length > 0
                  ? `calc(${(currentApprovalStep / (approvals.length - 1)) * 100}% - 64px)`
                  : '0%'
              }}
            ></div>

            {/* Steps */}
            <div className="flex justify-between">
              {approvals.map((approval, index) => {
                const isActive = index === currentApprovalStep;
                const isCompleted = approval.status === 'approved';
                const isRejected = approval.status === 'rejected';
                const isPending = approval.status === 'pending';
                const iconType = getApprovalIconType(approval.status, isActive);

                return (
                  <div key={approval.id} className="flex flex-col items-center flex-1 relative z-10">
                    {/* Círculo del step */}
                    <div
                      className={`
                        w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center
                        transition-all duration-300 border-4
                        ${isCompleted ? 'bg-green-600 border-green-600 text-white' : ''}
                        ${isRejected ? 'bg-red-600 border-red-600 text-white' : ''}
                        ${isActive && isPending ? 'bg-rojo-coconsa border-rojo-coconsa text-white scale-110 shadow-lg' : ''}
                        ${isPending && !isActive ? 'bg-white border-gray-300 text-gray-400' : ''}
                      `}
                    >
                      {renderApprovalIcon(iconType)}
                    </div>
                    
                    {/* Label */}
                    <div className="mt-2 text-center">
                      <span className={`
                        text-xs sm:text-sm font-medium block
                        ${isCompleted || isActive ? 'text-gray-900' : 'text-gray-400'}
                      `}>
                        {approval.department?.name || 'Departamento'}
                      </span>
                      
                      {/* Información de aprobación */}
                      {isCompleted && approval.approver && (
                        <div className="mt-1 text-xs text-gray-600">
                          <div className="font-medium">{approval.approver.full_name}</div>
                          <div className="text-gray-500">
                            {new Date(approval.approved_at!).toLocaleDateString('es-MX')}
                          </div>
                        </div>
                      )}
                      
                      {isRejected && approval.approver && (
                        <div className="mt-1 text-xs text-red-600">
                          <div className="font-medium">Rechazado</div>
                          <div className="text-red-500">
                            {approval.approver.full_name}
                          </div>
                        </div>
                      )}
                      
                      {isActive && isPending && (
                        <div className="mt-1 text-xs text-blue-600 font-medium">
                          Pendiente
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

          {/* Mostrar comentarios de aprobaciones */}
          {approvals.some(a => a.comments) && (
            <div className="mt-6 pt-4 border-t border-gray-200">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">Comentarios</h3>
              <div className="space-y-2">
                {approvals
                  .filter(a => a.comments)
                  .map(approval => (
                    <div key={approval.id} className="bg-gray-50 rounded p-3">
                      <div className="flex justify-between items-start mb-1">
                        <span className="text-sm font-medium text-gray-900">
                          {approval.department?.name}
                        </span>
                        <span className={`text-xs px-2 py-0.5 rounded ${
                          approval.status === 'approved' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                        }`}>
                          {approval.status === 'approved' ? 'Aprobado' : 'Rechazado'}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600">{approval.comments}</p>
                    </div>
                  ))}
              </div>
            </div>
          )}
          </div>
          )}
        </div>
      )}

      {/* Mensaje de orden rechazada */}
      {order.status === 'rejected' && (
        <div className="mb-6 sm:mb-8 bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <svg className="w-8 h-8 text-red-500" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
            <div>
              <h3 className="text-red-900 font-bold text-sm sm:text-base">Orden Rechazada</h3>
              <p className="text-red-700 text-xs sm:text-sm mt-1">
                Esta orden de compra ha sido rechazada y no continuará con el proceso.
              </p>
            </div>
          </div>
        </div>
      )}

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

              {/* Evidencias / Comprobantes */}
              {order.justification_prove && (
                <div className="sm:col-span-2">
                  <label className="text-xs sm:text-sm font-medium text-gray-500 mb-2 block">Evidencias / Comprobantes</label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {order.justification_prove.split(',').map((url, index) => {
                      const fileName = url.split('/').pop() || `Archivo ${index + 1}`;
                      const isImage = /\.(jpg|jpeg|png|gif|webp)$/i.test(url);
                      const isPdf = /\.pdf$/i.test(url);
                      
                      return (
                        <div key={index} className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg p-2">
                          <span className="text-lg flex-shrink-0">
                            {isImage ? '🖼️' : isPdf ? '📄' : '📎'}
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="text-xs text-gray-700 truncate" title={fileName}>
                              {fileName.length > 25 ? fileName.substring(0, 25) + '...' : fileName}
                            </p>
                          </div>
                          <div className="flex gap-1 flex-shrink-0">
                            <a
                              href={url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                              title="Ver archivo"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                              </svg>
                            </a>
                            <a
                              href={url}
                              download
                              className="p-1.5 text-green-600 hover:bg-green-50 rounded transition-colors"
                              title="Descargar archivo"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                              </svg>
                            </a>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
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
              
              {/* Botones de Aprobación/Rechazo - Solo para jefes de departamento con permiso */}
              {canApprove && order.status !== 'completed' && order.status !== 'rejected' && (
                <>
                  <div className="border-t pt-4 mt-4">
                    <h3 className="text-sm font-semibold text-gray-900 mb-2">Aprobar/Rechazar Orden</h3>
                    <textarea
                      value={comments}
                      onChange={(e) => setComments(e.target.value)}
                      placeholder="Comentarios (opcional)"
                      className="w-full px-3 py- text-gray-900 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent mb-3"
                      rows={3}
                    />
                    
                    <div className="space-y-2">
                      <button
                        onClick={handleApprove}
                        className="w-full bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm sm:text-base font-medium transition-colors"
                      >
                        Aprobar Orden
                      </button>
                      
                      <button
                        onClick={handleReject}
                        className="w-full bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm sm:text-base font-medium transition-colors"
                      >
                        Rechazar Orden
                      </button>
                    </div>
                  </div>
                </>
              )}

              {/* Botón de completar orden - Solo para admin cuando está aprobada */}
              {isAdmin && order.status === 'approved' && (
                <div className="border-t pt-4 mt-4">
                  <div className="mb-3">
                    <label className="flex items-start gap-3 cursor-pointer group">
                      <input
                        type="checkbox"
                        checked={confirmComplete}
                        onChange={(e) => setConfirmComplete(e.target.checked)}
                        className="mt-1 w-4 h-4 text-red-600 border-gray-300 rounded focus:ring-red-500"
                      />
                      <span className="text-sm text-gray-700 group-hover:text-gray-900">
                        Confirmo que se ha completado todo el proceso de esta orden de compra
                      </span>
                    </label>
                  </div>
                  
                  <button
                    onClick={handleCompleteOrder}
                    disabled={!confirmComplete}
                    className={`w-full px-4 py-2 rounded-lg text-sm sm:text-base font-medium transition-colors ${
                      confirmComplete
                        ? 'bg-blue-600 hover:bg-blue-700 text-white'
                        : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                    }`}
                  >
                    Completar Orden
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
