"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import Link from "next/link";
import { getNeedsListApprovals, canUserApproveNeedsList, getApprovalIconType, type NeedsListApproval, type ApprovalIconType } from "@/lib/needsListApprovalFlow";
import { useToast } from "@/components/ui/Toast";
import { Modal } from "@/components/ui/Modal";
import { OrderDetailSkeleton } from "@/components/ui/Skeletons";

type NeedsListStatus = "pending" | "approved" | "rejected" | "in_progress";

interface NeedsListItem {
  id: string;
  description: string;
  quantity: number;
  unit: string;
  unit_price: number;
  subtotal: number;
}

interface BankAccount {
  id: string;
  bank_name: string;
  account_number: string;
  clabe: string;
  account_holder_name: string;
}

interface NeedsListDetail {
  id: string;
  folio: string;
  created_at: string;
  user_name: string;
  user_email: string;
  total: number;
  status: NeedsListStatus;
  justification: string;
  evidence_urls: string | null;
  items: NeedsListItem[];
  bank_account: BankAccount;
  is_urgent: boolean;
  urgency_justification: string | null;
  is_definitive_rejection: boolean;
  current_department_name?: string | null;
  department_name?: string | null;
}

const statusConfig: Record<NeedsListStatus, { label: string; className: string; iconBg: string }> = {
  pending: { label: "Nuevo", className: "bg-yellow-100 text-yellow-800", iconBg: "bg-yellow-500" },
  approved: { label: "Aprobada", className: "bg-green-100 text-green-800", iconBg: "bg-green-500" },
  rejected: { label: "Rechazada", className: "bg-red-100 text-red-800", iconBg: "bg-red-500" },
  in_progress: { label: "En Proceso", className: "bg-blue-100 text-blue-800", iconBg: "bg-blue-500" },
};

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
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

export default function ListaNecesidadesDetallePage() {
  const router = useRouter();
  const params = useParams();
  const listId = params.id as string;
  const listIdNumber = parseInt(listId, 10);
  const { user } = useAuth();
  const toast = useToast();
  
  const [needsList, setNeedsList] = useState<NeedsListDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [approvals, setApprovals] = useState<NeedsListApproval[]>([]);
  const [canApproveList, setCanApproveList] = useState(false);
  
  // Modal states
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectDefinitive, setRejectDefinitive] = useState(false);
  const [processingAction, setProcessingAction] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  
  // Approval modal states
  const [approveComments, setApproveComments] = useState('');

  const fetchNeedsListDetails = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/v1/needs-lists/${listId}`);
      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || 'Error al cargar la lista de necesidades');
      }
      
      setNeedsList(data.needsList);
      
      const listApprovals = await getNeedsListApprovals(listIdNumber);
      // Filter only main flow approvals (approval_order 1-3) and sort
      const filteredApprovals = listApprovals
        .filter(a => a.approval_order && a.approval_order >= 1 && a.approval_order <= 3)
        .sort((a, b) => (a.approval_order || 0) - (b.approval_order || 0));
      setApprovals(filteredApprovals);
    } catch {
      toast.error('Error', 'No se pudo cargar la lista de necesidades');
      router.push('/dashboard/listas-necesidades');
    } finally {
      setLoading(false);
    }
  };

  const checkUserCanApprove = async () => {
    if (!user?.id) return;
    
    try {
      const result = await canUserApproveNeedsList(user.id, listIdNumber);
      setCanApproveList(result.canApprove);
    } catch {
      // Error silencioso
    }
  };

  useEffect(() => {
    fetchNeedsListDetails();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listId]);

  useEffect(() => {
    if (needsList && user) {
      checkUserCanApprove();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [needsList, user]);

  const handleApprove = async (comments?: string) => {
    setProcessingAction(true);
    try {
      const response = await fetch(`/api/v1/needs-lists/${listId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ comments: comments || '' }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Error al aprobar la lista');
      }

      toast.success('Lista aprobada', data.message);
      setShowApproveModal(false);
      setApproveComments('');
      await fetchNeedsListDetails();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Error al aprobar la lista';
      toast.error('Error', errorMessage);
    } finally {
      setProcessingAction(false);
    }
  };

  const handleReject = async (reason: string, isDefinitive: boolean) => {
    if (!reason || reason.trim() === '') {
      toast.warning('Campo requerido', 'Debes proporcionar una razon para rechazar la lista');
      return;
    }

    setProcessingAction(true);
    try {
      const response = await fetch(`/api/v1/needs-lists/${listId}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ comments: reason, is_definitive: isDefinitive }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Error al rechazar la lista');
      }

      toast.success('Lista rechazada', data.message);
      setShowRejectModal(false);
      setRejectDefinitive(false);
      await fetchNeedsListDetails();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Error al rechazar la lista';
      toast.error('Error', errorMessage);
    } finally {
      setProcessingAction(false);
    }
  };

  const handleDownloadPdf = async () => {
    try {
      setDownloadingPdf(true);
      const response = await fetch(`/api/v1/needs-lists/${listId}/pdf`);

      if (!response.ok) {
        throw new Error('Error al generar el PDF');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `lista-necesidades-${needsList?.folio || listId}.pdf`;
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
    return <OrderDetailSkeleton />;
  }

  if (!needsList) {
    return null;
  }

  const statusInfo = statusConfig[needsList.status] || statusConfig.pending;
  const dateInfo = formatDate(needsList.created_at);

  const getCurrentApprovalStep = () => {
    if (needsList.status === 'rejected') return -1;
    if (needsList.status === 'approved') return approvals.length;
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
      <Modal
        isOpen={showApproveModal}
        onClose={() => {
          setShowApproveModal(false);
          setApproveComments('');
        }}
        title="Aprobar Lista de Necesidades"
        size="md"
      >
        <div>
          <p className="text-gray-600 mb-4">
            ¿Deseas agregar un comentario a esta aprobacion? (opcional)
          </p>
          
          <textarea
            value={approveComments}
            onChange={(e) => setApproveComments(e.target.value)}
            placeholder="Escribe un comentario (opcional)..."
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent resize-none text-gray-900"
          />

          <div className="flex gap-3 mt-6">
            <button
              onClick={() => {
                setShowApproveModal(false);
                setApproveComments('');
              }}
              disabled={processingAction}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={() => handleApprove(approveComments)}
              disabled={processingAction}
              className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
            >
              {processingAction ? (
                <>
                  <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Procesando...
                </>
              ) : (
                'Aprobar'
              )}
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={showRejectModal}
        onClose={() => { setShowRejectModal(false); setRejectDefinitive(false); }}
        title="Rechazar Lista de Necesidades"
        size="md"
      >
        <div>
          <p className="text-gray-600 mb-4">Por favor, indica el motivo del rechazo. Esta informacion sera visible para el solicitante.</p>
          <textarea
            id="reject-reason-textarea"
            placeholder="Escribe el motivo del rechazo..."
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent resize-none text-gray-900"
          />
          <p className="text-xs text-gray-500 mt-1">* Este campo es obligatorio</p>

          {/* Toggle rechazo definitivo */}
          <label className="flex items-start gap-3 mt-4 p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
            <input
              type="checkbox"
              checked={rejectDefinitive}
              onChange={(e) => setRejectDefinitive(e.target.checked)}
              className="mt-0.5 w-4 h-4 text-red-600 border-gray-300 rounded focus:ring-red-500"
            />
            <div>
              <span className="text-sm font-medium text-gray-900">Rechazo definitivo</span>
              <p className="text-xs text-gray-500 mt-0.5">
                La lista no podra ser editada ni reenviada por el solicitante.
              </p>
            </div>
          </label>

          {rejectDefinitive && (
            <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-xs text-red-700 font-medium">
                Esta accion es irreversible. El solicitante no podra modificar ni reenviar esta lista.
              </p>
            </div>
          )}

          <div className="flex gap-3 mt-5">
            <button
              onClick={() => { setShowRejectModal(false); setRejectDefinitive(false); }}
              disabled={processingAction}
              className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              onClick={() => {
                const textarea = document.getElementById('reject-reason-textarea') as HTMLTextAreaElement;
                const reason = textarea?.value || '';
                handleReject(reason, rejectDefinitive);
              }}
              disabled={processingAction}
              className={`flex-1 px-4 py-2.5 text-white rounded-lg transition-colors font-medium disabled:opacity-50 ${
                rejectDefinitive 
                  ? 'bg-red-800 hover:bg-red-900' 
                  : 'bg-red-600 hover:bg-red-700'
              }`}
            >
              {processingAction ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Procesando...
                </span>
              ) : (
                rejectDefinitive ? 'Rechazar Definitivamente' : 'Rechazar'
              )}
            </button>
          </div>
        </div>
      </Modal>

      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-xl shadow-lg p-6 text-white">
          <div className="flex items-center gap-2 mb-4">
            <Link
              href="/dashboard/listas-necesidades"
              className="inline-flex items-center gap-1 text-blue-100 hover:text-white transition-colors text-sm"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Volver a Listas de Necesidades
            </Link>
          </div>
          
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="text-2xl font-bold break-all">{needsList.folio}</h1>
                {needsList.is_urgent && (
                  <span className="px-3 py-1 rounded-full text-xs font-medium bg-orange-500 text-white flex items-center gap-1">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    Urgente
                  </span>
                )}
                <span className={`px-3 py-1 rounded-full text-xs font-medium ${statusInfo.className}`}>
                  {(needsList.status === 'pending' || needsList.status === 'in_progress') && needsList.current_department_name ? `${statusInfo.label} | ${needsList.current_department_name}` : statusInfo.label}
                </span>
                {needsList.status === 'rejected' && needsList.is_definitive_rejection && (
                  <span className="px-3 py-1 rounded-full text-xs font-semibold bg-red-700 text-white">
                    Definitiva
                  </span>
                )}
                {needsList.status === 'rejected' && !needsList.is_definitive_rejection && (
                  <span className="px-3 py-1 rounded-full text-xs font-semibold bg-yellow-100 text-yellow-800">
                    Editable
                  </span>
                )}
              </div>
              <p className="text-blue-100 text-sm mt-1">
                {dateInfo.full} - {dateInfo.time}
              </p>
            </div>
          </div>
        </div>

        {/* Banner de lista urgente */}
        {needsList.is_urgent && (
          <div className="bg-orange-50 border border-orange-200 rounded-xl p-5">
            <div className="flex items-start gap-4">
              <div className="bg-orange-100 rounded-full p-2">
                <svg className="w-6 h-6 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <div>
                <h3 className="text-orange-900 font-semibold">Lista Urgente</h3>
                <p className="text-orange-700 text-sm mt-1">
                  Esta lista salta la aprobacion de Gerencia, iniciando directamente en Contabilidad.
                </p>
                {needsList.urgency_justification && (
                  <div className="mt-2 p-3 bg-white rounded-lg border border-orange-200">
                    <p className="text-xs font-medium text-orange-800 uppercase tracking-wide mb-1">Justificacion de urgencia</p>
                    <p className="text-sm text-gray-900">{needsList.urgency_justification}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Mensaje de lista rechazada */}
        {needsList.status === 'rejected' && (
          <div className={`border rounded-xl p-5 ${
            needsList.is_definitive_rejection 
              ? 'bg-red-100 border-red-300' 
              : 'bg-red-50 border-red-200'
          }`}>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-start gap-4">
                <div className="bg-red-100 rounded-full p-2">
                  <svg className="w-6 h-6 text-red-600" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-red-900 font-semibold">Lista Rechazada</h3>
                    {needsList.is_definitive_rejection ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-red-700 text-white">
                        Definitiva
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-yellow-100 text-yellow-800 border border-yellow-300">
                        Editable
                      </span>
                    )}
                  </div>
                  <p className="text-red-700 text-sm mt-1">
                    {needsList.is_definitive_rejection
                      ? 'Esta lista de necesidades ha sido rechazada de forma definitiva. No puede ser editada ni reenviada.'
                      : 'Esta lista de necesidades ha sido rechazada. Puedes editarla y reenviarla para aprobacion.'
                    }
                  </p>
                </div>
              </div>
              {/* Edit button - only for original requester and only if NOT definitive */}
              {!needsList.is_definitive_rejection && user?.email === needsList.user_email && (
                <Link
                  href={`/dashboard/listas-necesidades/${needsList.id}/editar`}
                  className="inline-flex items-center justify-center gap-2 bg-blue-600 text-white px-5 py-2.5 rounded-lg font-medium hover:bg-blue-700 transition-colors shadow-sm whitespace-nowrap"
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
        {needsList.status !== 'rejected' && approvals.length > 0 && (
          <div className="bg-white rounded-xl shadow p-5">
            <h2 className="text-lg font-semibold text-gray-900 mb-5">Flujo de Aprobaciones</h2>
            
            <div className="relative">
              {/* Linea de progreso - Desktop */}
              <div className="hidden sm:block absolute top-5 left-8 right-8 h-0.5 bg-gray-200"></div>
              <div 
                className="hidden sm:block absolute top-5 left-8 h-0.5 bg-blue-500 transition-all duration-500"
                style={{ 
                  width: approvals.length > 1
                    ? `calc(${(Math.min(currentApprovalStep, approvals.length - 1) / (approvals.length - 1)) * 100}% - 64px)`
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
                          ${isActive && isPending ? 'bg-blue-600 text-white ring-4 ring-blue-100' : ''}
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
                          <span className="inline-flex items-center gap-1 text-xs text-blue-600 font-medium mt-0.5">
                            <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse"></span>
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

        {/* Comentarios de aprobaciones */}
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
                  <p className="text-gray-900 font-medium">{needsList.user_name}</p>
                  <p className="text-sm text-gray-500">{needsList.user_email}</p>
                </div>
                
                <div className="space-y-1">
                  <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Departamento</label>
                  <p className="text-gray-900 font-medium">{needsList.department_name || 'N/A'}</p>
                </div>
                
                <div className="space-y-1 sm:col-span-2">
                  <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Justificacion</label>
                  <p className="text-gray-900">{needsList.justification}</p>
                </div>

                {/* Evidencias */}
                {needsList.evidence_urls && (
                  <div className="sm:col-span-2 space-y-2">
                    <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Evidencias</label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {needsList.evidence_urls.split(',').map((url, index) => {
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
                                className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
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

            {/* Articulos/Conceptos */}
            <div className="bg-white rounded-xl shadow p-5">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                Conceptos <span className="text-gray-400 font-normal">({needsList.items.length})</span>
              </h2>
              
              {/* Mobile Cards */}
              <div className="lg:hidden space-y-3">
                {needsList.items.map((item, index) => (
                  <div key={item.id || `item-${index}`} className="bg-gray-50 rounded-lg p-4">
                    <div className="font-medium text-gray-900 mb-3">{item.description}</div>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-500">Cantidad</span>
                        <span className="text-gray-900">{item.quantity} {item.unit}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Precio unitario</span>
                        <span className="text-gray-900">{formatCurrency(item.unit_price)}</span>
                      </div>
                      <div className="flex justify-between pt-2 border-t border-gray-200">
                        <span className="text-gray-700 font-medium">Subtotal</span>
                        <span className="text-gray-900 font-bold">{formatCurrency(item.subtotal)}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Desktop Table */}
              <div className="hidden lg:block overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-gray-100">
                      <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wide pb-3 pr-4">Concepto</th>
                      <th className="text-right text-xs font-medium text-gray-500 uppercase tracking-wide pb-3 px-4">Cantidad</th>
                      <th className="text-right text-xs font-medium text-gray-500 uppercase tracking-wide pb-3 px-4 whitespace-nowrap">P. Unitario</th>
                      <th className="text-right text-xs font-medium text-gray-500 uppercase tracking-wide pb-3 pl-4">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {needsList.items.map((item, index) => (
                      <tr key={item.id || `item-row-${index}`}>
                        <td className="py-3 pr-4">
                          <span className="font-medium text-gray-900">{item.description}</span>
                        </td>
                        <td className="py-3 px-4 text-right whitespace-nowrap">
                          <span className="text-gray-900">{item.quantity} {item.unit}</span>
                        </td>
                        <td className="py-3 px-4 text-right whitespace-nowrap">
                          <span className="text-gray-600">{formatCurrency(item.unit_price)}</span>
                        </td>
                        <td className="py-3 pl-4 text-right whitespace-nowrap">
                          <span className="font-medium text-gray-900">{formatCurrency(item.subtotal)}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Sidebar - Resumen y Acciones */}
          <div className="space-y-6">
            {/* Cuenta Bancaria */}
            <div className="bg-white rounded-xl shadow p-5">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Cuenta Bancaria</h2>
              <div className="space-y-3">
                <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg">
                  <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900">{needsList.bank_account.bank_name}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{needsList.bank_account.account_holder_name}</p>
                  </div>
                </div>
                
                <div className="space-y-2 text-sm">
                  <div>
                    <label className="text-xs font-medium text-gray-500 uppercase tracking-wide block mb-1">CLABE</label>
                    <p className="text-gray-900 font-mono">{needsList.bank_account.clabe}</p>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-500 uppercase tracking-wide block mb-1">No. de cuenta</label>
                    <p className="text-gray-900 font-mono">{needsList.bank_account.account_number}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Resumen Financiero */}
            <div className="bg-white rounded-xl shadow p-5">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Resumen</h2>
              
              <div className="space-y-3">
                <div className="flex justify-between py-3 border-t border-gray-100">
                  <span className="text-base font-bold text-gray-900">Total</span>
                  <span className="text-lg font-bold text-blue-600">{formatCurrency(needsList.total)}</span>
                </div>
              </div>
            </div>

            <button
              onClick={handleDownloadPdf}
              disabled={downloadingPdf}
              className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {downloadingPdf ? (
                <>
                  <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                  </svg>
                  Generando PDF...
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3M5 20h14" />
                  </svg>
                  Descargar PDF
                </>
              )}
            </button>

            {/* Botones de Accion */}
            {canApproveList && needsList.status !== 'approved' && needsList.status !== 'rejected' && (
              <div className="bg-white rounded-xl shadow p-5">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Acciones</h2>
                <div className="space-y-3">
                  <button
                    onClick={() => setShowApproveModal(true)}
                    className="w-full px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium flex items-center justify-center gap-2"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Aprobar
                  </button>
                  
                  <button
                    onClick={() => setShowRejectModal(true)}
                    className="w-full px-4 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium flex items-center justify-center gap-2"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                    Rechazar
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
