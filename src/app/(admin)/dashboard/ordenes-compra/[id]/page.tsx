"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import Link from "next/link";
import { getOrderApprovals, canUserApprove, getApprovalIconType, type OrderApproval, type ApprovalIconType } from "@/lib/approvalFlow";
import { useToast } from "@/components/ui/Toast";
import { ConfirmModal, InputModal } from "@/components/ui/Modal";

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
  }).format(amount);
}

function formatDate(dateString: string): { full: string; date: string; time: string } {
  const date = new Date(dateString);
  return {
    full: date.toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric' }),
    date: date.toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' }),
    time: date.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }),
  };
}

export default function OrdenDetallesPage() {
  const router = useRouter();
  const params = useParams();
  const orderId = params.id as string;
  const { isAdmin, user } = useAuth();
  const toast = useToast();
  
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [confirmComplete, setConfirmComplete] = useState(false);
  const [approvals, setApprovals] = useState<OrderApproval[]>([]);
  const [canApproveOrder, setCanApproveOrder] = useState(false);
  // Modal states
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const [processingAction, setProcessingAction] = useState(false);

  const fetchOrderDetails = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/v1/orders/${orderId}`);
      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || 'Error al cargar la orden');
      }
      
      setOrder(data.order);
      
      const orderApprovals = await getOrderApprovals(orderId);
      setApprovals(orderApprovals);
    } catch {
      toast.error('Error', 'No se pudo cargar la orden');
      router.push('/dashboard/ordenes-compra');
    } finally {
      setLoading(false);
    }
  };

  const checkUserCanApprove = async () => {
    if (!user?.id) return;
    
    try {
      const result = await canUserApprove(user.id, orderId);
      setCanApproveOrder(result.canApprove);
    } catch {
      // Error silencioso
    }
  };

  useEffect(() => {
    fetchOrderDetails();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId]);

  useEffect(() => {
    if (order && user) {
      checkUserCanApprove();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order, user]);

  const handleApprove = async (approveComments?: string) => {
    setProcessingAction(true);
    try {
      const response = await fetch(`/api/v1/orders/${orderId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ comments: approveComments || '' }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Error al aprobar la orden');
      }

      toast.success('Orden aprobada', data.message);
      setShowApproveModal(false);
      await fetchOrderDetails();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Error al aprobar la orden';
      toast.error('Error', errorMessage);
    } finally {
      setProcessingAction(false);
    }
  };

  const handleReject = async (reason: string) => {
    if (!reason || reason.trim() === '') {
      toast.warning('Campo requerido', 'Debes proporcionar una razon para rechazar la orden');
      return;
    }

    setProcessingAction(true);
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

      toast.success('Orden rechazada', data.message);
      setShowRejectModal(false);
      await fetchOrderDetails();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Error al rechazar la orden';
      toast.error('Error', errorMessage);
    } finally {
      setProcessingAction(false);
    }
  };

  const handleCompleteOrder = async () => {
    setProcessingAction(true);
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

      toast.success('Orden completada', 'La orden ha sido marcada como completada');
      setShowCompleteModal(false);
      setConfirmComplete(false);
      await fetchOrderDetails();
    } catch {
      toast.error('Error', 'No se pudo completar la orden. Por favor, intenta nuevamente.');
    } finally {
      setProcessingAction(false);
    }
  };

  const handleDownloadPdf = async () => {
    try {
      setDownloadingPdf(true);
      const response = await fetch(`/api/v1/orders/${orderId}/pdf`);
      
      if (!response.ok) {
        throw new Error('Error al generar el PDF');
      }
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `orden-compra-${orderId}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast.success('PDF descargado', 'El archivo se ha descargado correctamente');
    } catch {
      toast.error('Error', 'No se pudo descargar el PDF. Por favor, intenta nuevamente.');
    } finally {
      setDownloadingPdf(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Cargando orden...</p>
        </div>
      </div>
    );
  }

  if (!order) {
    return null;
  }

  const statusInfo = statusConfig[order.status] || statusConfig.pending;
  const dateInfo = formatDate(order.created_at);
  const subtotalItems = order.items.reduce((sum, item) => sum + item.subtotal, 0);
  const retentionAmount = order.retention ? (subtotalItems * order.retention / 100) : 0;

  const getCurrentApprovalStep = () => {
    if (order.status === 'rejected') return -1;
    if (order.status === 'completed') return approvals.length;
    const firstPending = approvals.findIndex(a => a.status === 'pending');
    return firstPending === -1 ? approvals.length : firstPending;
  };

  const currentApprovalStep = getCurrentApprovalStep();

  const renderApprovalIcon = (iconType: ApprovalIconType) => {
    switch (iconType) {
      case 'approved':
        return (
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
          </svg>
        );
      case 'rejected':
        return (
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
          </svg>
        );
      case 'active':
        return (
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
          </svg>
        );
      case 'pending':
      default:
        return (
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <circle cx="10" cy="10" r="3" />
          </svg>
        );
    }
  };

  return (
    <>
      {/* Modales */}
      <InputModal
        isOpen={showApproveModal}
        onClose={() => setShowApproveModal(false)}
        onConfirm={handleApprove}
        title="Aprobar Orden"
        message="¿Deseas agregar un comentario a esta aprobacion? (opcional)"
        placeholder="Escribe un comentario (opcional)..."
        confirmText="Aprobar"
        cancelText="Cancelar"
        required={false}
        loading={processingAction}
      />

      <InputModal
        isOpen={showRejectModal}
        onClose={() => setShowRejectModal(false)}
        onConfirm={handleReject}
        title="Rechazar Orden"
        message="Por favor, indica el motivo del rechazo. Esta informacion sera visible para el solicitante."
        placeholder="Escribe el motivo del rechazo..."
        confirmText="Rechazar"
        cancelText="Cancelar"
        required={true}
        loading={processingAction}
      />

      <ConfirmModal
        isOpen={showCompleteModal}
        onClose={() => setShowCompleteModal(false)}
        onConfirm={handleCompleteOrder}
        title="Completar Orden"
        message="¿Confirmas que se ha completado todo el proceso de esta orden de compra?"
        confirmText="Completar"
        cancelText="Cancelar"
        variant="success"
        loading={processingAction}
      />

      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="bg-gradient-to-r from-red-600 to-red-700 rounded-xl shadow-lg p-6 text-white">
          <div className="flex items-center gap-2 mb-4">
            <Link
              href="/dashboard/ordenes-compra"
              className="inline-flex items-center gap-1 text-red-100 hover:text-white transition-colors text-sm"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Volver a Ordenes
            </Link>
          </div>
          
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold">Orden #{order.id}</h1>
                <span className={`px-3 py-1 rounded-full text-xs font-medium ${statusInfo.className}`}>
                  {statusInfo.label}
                </span>
              </div>
              <p className="text-red-100 text-sm mt-1">
                {dateInfo.full} - {dateInfo.time}
              </p>
            </div>
            
            <button
              onClick={handleDownloadPdf}
              disabled={downloadingPdf}
              className="inline-flex items-center justify-center gap-2 bg-white text-red-600 px-5 py-2.5 rounded-lg font-medium hover:bg-red-50 transition-colors shadow-sm disabled:opacity-50"
            >
              {downloadingPdf ? (
                <>
                  <div className="w-4 h-4 border-2 border-red-600 border-t-transparent rounded-full animate-spin"></div>
                  <span>Generando...</span>
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <span>Descargar PDF</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Mensaje de orden rechazada */}
        {order.status === 'rejected' && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-5">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-start gap-4">
                <div className="bg-red-100 rounded-full p-2">
                  <svg className="w-6 h-6 text-red-600" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-red-900 font-semibold">Orden Rechazada</h3>
                  <p className="text-red-700 text-sm mt-1">
                    Esta orden de compra ha sido rechazada. Puedes editarla y reenviarla para aprobacion.
                  </p>
                </div>
              </div>
              {/* Boton editar - solo para el solicitante original (NO para gerentes/admins) */}
              {user?.email === order.applicant_email && (
                <Link
                  href={`/dashboard/ordenes-compra/${order.id}/editar`}
                  className="inline-flex items-center justify-center gap-2 bg-red-600 text-white px-5 py-2.5 rounded-lg font-medium hover:bg-red-700 transition-colors shadow-sm whitespace-nowrap"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                  <span>Editar y Reenviar</span>
                </Link>
              )}
            </div>
          </div>
        )}

        {/* Flujo de Aprobaciones */}
        {order.status !== 'rejected' && approvals.length > 0 && (
          <div className="bg-white rounded-xl shadow p-5">
            <h2 className="text-lg font-semibold text-gray-900 mb-5">Flujo de Aprobaciones</h2>
            
            <div className="relative">
              {/* Linea de progreso - Desktop */}
              <div className="hidden sm:block absolute top-5 left-8 right-8 h-0.5 bg-gray-200"></div>
              <div 
                className="hidden sm:block absolute top-5 left-8 h-0.5 bg-red-500 transition-all duration-500"
                style={{ 
                  width: approvals.length > 1
                    ? `calc(${(Math.max(0, currentApprovalStep) / (approvals.length - 1)) * 100}% - 64px)`
                    : '0%'
                }}
              ></div>

              {/* Steps */}
              <div className="flex flex-col sm:flex-row sm:justify-between gap-4 sm:gap-0">
                {approvals.map((approval, index) => {
                  const isActive = index === currentApprovalStep;
                  const isCompleted = approval.status === 'approved';
                  const isRejected = approval.status === 'rejected';
                  const isPending = approval.status === 'pending';
                  const iconType = getApprovalIconType(approval.status, isActive);

                  return (
                    <div key={approval.id} className="flex sm:flex-col items-center sm:items-center gap-3 sm:gap-0 sm:flex-1 relative z-10">
                      {/* Circulo del step */}
                      <div
                        className={`
                          w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0
                          transition-all duration-300
                          ${isCompleted ? 'bg-green-500 text-white' : ''}
                          ${isRejected ? 'bg-red-500 text-white' : ''}
                          ${isActive && isPending ? 'bg-red-600 text-white ring-4 ring-red-100' : ''}
                          ${isPending && !isActive ? 'bg-gray-200 text-gray-400' : ''}
                        `}
                      >
                        {renderApprovalIcon(iconType)}
                      </div>
                      
                      {/* Info */}
                      <div className="sm:mt-3 sm:text-center flex-1 sm:flex-initial">
                        <span className={`text-sm font-medium block ${isCompleted || isActive ? 'text-gray-900' : 'text-gray-400'}`}>
                          {approval.department?.name || 'Departamento'}
                        </span>
                        
                        {isCompleted && approval.approver && (
                          <div className="text-xs text-gray-500 mt-0.5">
                            <span>{approval.approver.full_name}</span>
                            <span className="hidden sm:inline"> - </span>
                            <span className="block sm:inline">{new Date(approval.approved_at!).toLocaleDateString('es-MX')}</span>
                          </div>
                        )}
                        
                        {isRejected && approval.approver && (
                          <div className="text-xs text-red-600 mt-0.5">
                            <span>Rechazado por {approval.approver.full_name}</span>
                          </div>
                        )}
                        
                        {isActive && isPending && (
                          <span className="inline-flex items-center gap-1 text-xs text-red-600 font-medium mt-0.5">
                            <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse"></span>
                            En espera
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Comentarios de aprobaciones - Visible para todos */}
        {approvals.some(a => a.comments) && (
          <div className="bg-white rounded-xl shadow p-5">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Comentarios</h2>
            <div className="space-y-3">
              {approvals
                .filter(a => a.comments)
                .map(approval => (
                  <div key={approval.id} className="flex gap-3 p-4 bg-gray-50 rounded-lg">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                      approval.status === 'approved' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'
                    }`}>
                      {approval.status === 'approved' ? (
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      ) : (
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                        </svg>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-gray-900 text-sm">
                          {approval.department?.name}
                        </span>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                          approval.status === 'approved' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                        }`}>
                          {approval.status === 'approved' ? 'Aprobado' : 'Rechazado'}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 mt-1">{approval.comments}</p>
                      {approval.approver && (
                        <p className="text-xs text-gray-400 mt-2">
                          {approval.approver.full_name} - {new Date(approval.approved_at!).toLocaleDateString('es-MX')}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Informacion y Articulos */}
          <div className="lg:col-span-2 space-y-6">
            {/* Informacion General */}
            <div className="bg-white rounded-xl shadow p-5">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Informacion General</h2>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Solicitante</label>
                  <p className="text-gray-900 font-medium">{order.applicant_name}</p>
                  <p className="text-sm text-gray-500">{order.applicant_email}</p>
                </div>
                
                <div className="space-y-1">
                  <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Almacen/Obra</label>
                  <p className="text-gray-900 font-medium">{order.store_name}</p>
                </div>
                
                <div className="space-y-1">
                  <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Proveedor</label>
                  <p className="text-gray-900 font-medium">{order.supplier_name}</p>
                </div>
                
                <div className="space-y-1 sm:col-span-2">
                  <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Justificacion</label>
                  <p className="text-gray-900">{order.justification}</p>
                </div>

                {/* Evidencias */}
                {order.justification_prove && (
                  <div className="sm:col-span-2 space-y-2">
                    <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Evidencias</label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {order.justification_prove.split(',').map((url, index) => {
                        const fileName = url.split('/').pop() || `Archivo ${index + 1}`;
                        const isImage = /\.(jpg|jpeg|png|gif|webp)$/i.test(url);
                        const isPdf = /\.pdf$/i.test(url);
                        
                        return (
                          <div key={index} className="flex items-center gap-3 bg-gray-50 rounded-lg p-3">
                            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                              isImage ? 'bg-purple-100' : isPdf ? 'bg-red-100' : 'bg-gray-200'
                            }`}>
                              {isImage ? (
                                <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                </svg>
                              ) : isPdf ? (
                                <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                                </svg>
                              ) : (
                                <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                                </svg>
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm text-gray-900 truncate">{fileName}</p>
                            </div>
                            <div className="flex gap-1">
                              <a
                                href={url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
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

            {/* Articulos */}
            <div className="bg-white rounded-xl shadow p-5">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                Articulos <span className="text-gray-400 font-normal">({order.items.length})</span>
              </h2>
              
              {/* Mobile Cards */}
              <div className="lg:hidden space-y-3">
                {order.items.map((item) => (
                  <div key={item.id} className="bg-gray-50 rounded-lg p-4">
                    <div className="font-medium text-gray-900 mb-3">{item.name}</div>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-500">Proveedor</span>
                        <span className="text-gray-900">{item.supplier_name}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Cantidad</span>
                        <span className="text-gray-900">{item.quantity} {item.unit}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Precio unitario</span>
                        <span className="text-gray-900">{formatCurrency(item.unit_price, order.currency)}</span>
                      </div>
                      <div className="flex justify-between pt-2 border-t border-gray-200">
                        <span className="text-gray-700 font-medium">Subtotal</span>
                        <span className="text-gray-900 font-bold">{formatCurrency(item.subtotal, order.currency)}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Desktop Table */}
              <div className="hidden lg:block overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-100">
                      <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wide pb-3">Articulo</th>
                      <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wide pb-3">Proveedor</th>
                      <th className="text-right text-xs font-medium text-gray-500 uppercase tracking-wide pb-3">Cantidad</th>
                      <th className="text-right text-xs font-medium text-gray-500 uppercase tracking-wide pb-3">P. Unitario</th>
                      <th className="text-right text-xs font-medium text-gray-500 uppercase tracking-wide pb-3">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {order.items.map((item) => (
                      <tr key={item.id}>
                        <td className="py-3">
                          <span className="font-medium text-gray-900">{item.name}</span>
                        </td>
                        <td className="py-3">
                          <span className="text-gray-600">{item.supplier_name}</span>
                        </td>
                        <td className="py-3 text-right">
                          <span className="text-gray-900">{item.quantity} {item.unit}</span>
                        </td>
                        <td className="py-3 text-right">
                          <span className="text-gray-900">{formatCurrency(item.unit_price, order.currency)}</span>
                        </td>
                        <td className="py-3 text-right">
                          <span className="font-semibold text-gray-900">{formatCurrency(item.subtotal, order.currency)}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Resumen y Acciones */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-xl shadow p-5 lg:sticky lg:top-4 space-y-5">
              <div>
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Resumen</h2>
                
                <div className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Subtotal</span>
                    <span className="text-gray-900">{formatCurrency(subtotalItems, order.currency)}</span>
                  </div>
                  
                  {order.retention && order.retention > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Retencion ({order.retention}%)</span>
                      <span className="text-red-600">-{formatCurrency(retentionAmount, order.currency)}</span>
                    </div>
                  )}
                  
                  <div className="pt-3 border-t border-gray-200">
                    <div className="flex justify-between">
                      <span className="text-lg font-bold text-gray-900">Total</span>
                      <span className="text-lg font-bold text-gray-900">{formatCurrency(order.total, order.currency)}</span>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Acciones de Aprobacion - Para usuarios con permiso */}
              {canApproveOrder && order.status !== 'completed' && order.status !== 'rejected' && (
                <div className="pt-5 border-t border-gray-200">
                  <h3 className="text-sm font-semibold text-gray-900 mb-3">Acciones</h3>
                  
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => setShowApproveModal(true)}
                      className="bg-green-600 hover:bg-green-700 text-white px-4 py-2.5 rounded-lg text-sm font-medium transition-colors"
                    >
                      Aprobar
                    </button>
                    
                    <button
                      onClick={() => setShowRejectModal(true)}
                      className="bg-red-600 hover:bg-red-700 text-white px-4 py-2.5 rounded-lg text-sm font-medium transition-colors"
                    >
                      Rechazar
                    </button>
                  </div>
                </div>
              )}

              {/* Completar Orden - Solo Admin */}
              {isAdmin && order.status === 'approved' && (
                <div className="pt-5 border-t border-gray-200">
                  <h3 className="text-sm font-semibold text-gray-900 mb-3">Completar Orden</h3>
                  
                  <label className="flex items-start gap-3 cursor-pointer group mb-3">
                    <input
                      type="checkbox"
                      checked={confirmComplete}
                      onChange={(e) => setConfirmComplete(e.target.checked)}
                      className="mt-0.5 w-4 h-4 text-red-600 border-gray-300 rounded focus:ring-red-500"
                    />
                    <span className="text-sm text-gray-600 group-hover:text-gray-900">
                      Confirmo que se ha completado todo el proceso de esta orden
                    </span>
                  </label>
                  
                  <button
                    onClick={() => setShowCompleteModal(true)}
                    disabled={!confirmComplete}
                    className={`w-full px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                      confirmComplete
                        ? 'bg-blue-600 hover:bg-blue-700 text-white'
                        : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    }`}
                  >
                    Marcar como Completada
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
