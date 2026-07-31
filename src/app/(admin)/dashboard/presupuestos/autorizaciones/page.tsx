'use client';

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";

function IconCheck({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
    </svg>
  );
}

function IconWarning({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
      />
    </svg>
  );
}

function IconArrowLeft({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
    </svg>
  );
}

function IconRefresh({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
      />
    </svg>
  );
}

function IconClose({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(amount);

const formatDate = (dateStr: string) => {
  if (!dateStr) return "";
  return new Date(dateStr).toLocaleDateString("es-MX", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const getWeekRangeLabel = (startDateStr: string) => {
  if (!startDateStr) return "—";
  const start = new Date(startDateStr + "T00:00:00");
  const end = new Date(start);
  end.setDate(start.getDate() + 6);

  const options: Intl.DateTimeFormatOptions = { day: "2-digit", month: "short" };
  const startStr = start.toLocaleDateString("es-MX", options);
  const endStr = end.toLocaleDateString("es-MX", { ...options, year: "numeric" });

  return `${startStr} - ${endStr}`;
};

export default function AutorizacionesPresupuestoPage() {
  const { user, isAdmin, isDepartmentHead, loading: loadingAuth } = useAuth();

  const isDireccion = Boolean(
    (user?.department_code && /dir|direccion|dirección/i.test(user.department_code)) ||
    (user?.department_name && /direccion|dirección/i.test(user.department_name))
  );

  const [allApprovals, setAllApprovals] = useState<any[]>([]);
  const [loadingApprovals, setLoadingApprovals] = useState(true);
  const [approvalsFilter, setApprovalsFilter] = useState<"pending_approval" | "approved" | "rejected" | "all">("pending_approval");

  const [approvingReportId, setApprovingReportId] = useState<number | null>(null);
  const [rejectingReportId, setRejectingReportId] = useState<number | null>(null);

  const [noticeSuccess, setNoticeSuccess] = useState<string | null>(null);
  const [noticeError, setNoticeError] = useState<string | null>(null);

  // Estado para el mini modal personalizado de confirmación / rechazo
  const [confirmModal, setConfirmModal] = useState<{
    open: boolean;
    type: "approve" | "reject";
    report: any;
  } | null>(null);

  const [rejectionReasonInput, setRejectionReasonInput] = useState<string>("Solicitud no aprobada por Dirección");

  const fetchGlobalApprovals = useCallback(async () => {
    setLoadingApprovals(true);
    try {
      const res = await fetch("/api/v1/weekly-reports/approvals");
      const data = await res.json();
      if (res.ok && data.success) {
        setAllApprovals(data.reports || []);
      }
    } catch {
      setAllApprovals([]);
    } finally {
      setLoadingApprovals(false);
    }
  }, []);

  useEffect(() => {
    fetchGlobalApprovals();
  }, [fetchGlobalApprovals]);

  const openApproveModal = (report: any) => {
    setConfirmModal({ open: true, type: "approve", report });
  };

  const openRejectModal = (report: any) => {
    setRejectionReasonInput("Solicitud no aprobada por Dirección");
    setConfirmModal({ open: true, type: "reject", report });
  };

  const handleExecuteApprove = async () => {
    if (!confirmModal?.report) return;
    const report = confirmModal.report;
    const storeName = report.store_name || `Obra #${report.store_id}`;

    setApprovingReportId(report.id);
    setNoticeError(null);
    setNoticeSuccess(null);
    setConfirmModal(null);
    try {
      const res = await fetch(`/api/v1/stores/${report.store_id}/weekly-reports/${report.id}/approval`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "approve" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al autorizar");

      setNoticeSuccess(`El gasto semanal de "${storeName}" fue autorizado correctamente por Dirección.`);
      await fetchGlobalApprovals();
    } catch (err: unknown) {
      setNoticeError(err instanceof Error ? err.message : "Error al autorizar");
    } finally {
      setApprovingReportId(null);
    }
  };

  const handleExecuteReject = async () => {
    if (!confirmModal?.report) return;
    const report = confirmModal.report;
    const storeName = report.store_name || `Obra #${report.store_id}`;
    const reason = rejectionReasonInput.trim() || "Solicitud no aprobada por Dirección";

    setRejectingReportId(report.id);
    setNoticeError(null);
    setNoticeSuccess(null);
    setConfirmModal(null);
    try {
      const res = await fetch(`/api/v1/stores/${report.store_id}/weekly-reports/${report.id}/approval`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reject", rejection_reason: reason }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al rechazar");

      setNoticeError(`La solicitud de sobrecosto para "${storeName}" fue rechazada.`);
      await fetchGlobalApprovals();
    } catch (err: unknown) {
      setNoticeError(err instanceof Error ? err.message : "Error al rechazar");
    } finally {
      setRejectingReportId(null);
    }
  };

  const filtered = allApprovals.filter((a) => approvalsFilter === "all" || a.status === approvalsFilter);

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Botón de retorno y encabezado */}
        <div className="mb-6">
          <Link
            href="/dashboard/presupuestos"
            className="inline-flex items-center gap-2 text-sm font-semibold text-indigo-600 hover:text-indigo-800 transition-colors mb-3"
          >
            <IconArrowLeft className="w-4 h-4" />
            Volver a Control de Presupuestos
          </Link>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2.5">
                <IconWarning className="w-8 h-8 text-amber-600" />
                Autorizaciones de Presupuesto
              </h1>
              <p className="mt-1 text-sm text-gray-500">
                Dictamen y control de gastos semanales que exceden el presupuesto autorizado por obra.
              </p>
            </div>

            <button
              onClick={() => fetchGlobalApprovals()}
              className="px-4 py-2 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 rounded-xl text-xs font-semibold shadow-sm transition-all flex items-center gap-2 self-start sm:self-auto"
            >
              <IconRefresh className="w-4 h-4 text-gray-500" />
              Actualizar solicitudes
            </button>
          </div>
        </div>

        {/* Notificaciones */}
        {noticeSuccess && (
          <div className="mb-6 p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-sm text-emerald-800 flex items-center justify-between shadow-sm">
            <div className="flex items-center gap-2">
              <IconCheck className="w-5 h-5 text-emerald-600" />
              <span className="font-medium">{noticeSuccess}</span>
            </div>
            <button onClick={() => setNoticeSuccess(null)} className="text-emerald-500 hover:text-emerald-700 text-xs font-bold">
              ✕
            </button>
          </div>
        )}

        {noticeError && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-800 flex items-center justify-between shadow-sm">
            <div className="flex items-center gap-2">
              <IconWarning className="w-5 h-5 text-red-600" />
              <span className="font-medium">{noticeError}</span>
            </div>
            <button onClick={() => setNoticeError(null)} className="text-red-500 hover:text-red-700 text-xs font-bold">
              ✕
            </button>
          </div>
        )}

        {/* Tarjeta principal con pestañas y contenido */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
          {/* Pestañas de Filtrado */}
          <div className="flex items-center gap-2 mb-6 border-b border-gray-200 pb-3 overflow-x-auto">
            <button
              onClick={() => setApprovalsFilter("pending_approval")}
              className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap ${
                approvalsFilter === "pending_approval"
                  ? "bg-amber-500 text-white shadow"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              <span className="w-2.5 h-2.5 rounded-full bg-amber-300" />
              Pendientes ({allApprovals.filter((a) => a.status === "pending_approval").length})
            </button>

            <button
              onClick={() => setApprovalsFilter("approved")}
              className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap ${
                approvalsFilter === "approved"
                  ? "bg-emerald-600 text-white shadow"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-300" />
              Autorizadas ({allApprovals.filter((a) => a.status === "approved").length})
            </button>

            <button
              onClick={() => setApprovalsFilter("rejected")}
              className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap ${
                approvalsFilter === "rejected"
                  ? "bg-red-600 text-white shadow"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              <span className="w-2.5 h-2.5 rounded-full bg-red-300" />
              Rechazadas ({allApprovals.filter((a) => a.status === "rejected").length})
            </button>

            <button
              onClick={() => setApprovalsFilter("all")}
              className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                approvalsFilter === "all"
                  ? "bg-gray-800 text-white shadow"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              Todas ({allApprovals.length})
            </button>
          </div>

          {/* Estado de carga */}
          {loadingApprovals || loadingAuth ? (
            <div className="py-20 text-center">
              <div className="inline-block w-8 h-8 border-3 border-amber-500 border-t-transparent rounded-full animate-spin" />
              <p className="text-sm text-gray-500 mt-3 font-medium">Cargando solicitudes de autorización...</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-20 text-center border-2 border-dashed border-gray-200 rounded-2xl bg-gray-50/50">
              <IconCheck className="w-12 h-12 text-emerald-500 mx-auto mb-3 opacity-60" />
              <h3 className="text-base font-bold text-gray-800">No hay solicitudes en esta categoría</h3>
              <p className="text-xs text-gray-400 mt-1">
                {approvalsFilter === "pending_approval"
                  ? "No existen gastos semanales pendientes de autorización por Dirección."
                  : "No se encontraron registros con el filtro seleccionado."}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-5">
              {filtered.map((report) => {
                const isPending = report.status === "pending_approval";
                const isRejected = report.status === "rejected";
                const isApproved = report.status === "approved";
                const totalGasto = (Number(report.mano_obra_gasto) || 0) + (Number(report.equipo_gasto) || 0);

                return (
                  <div
                    key={report.id}
                    className="border border-gray-200 rounded-2xl p-6 bg-white hover:shadow-md transition-all flex flex-col lg:flex-row lg:items-center justify-between gap-6"
                  >
                    {/* Información Principal de la Solicitud */}
                    <div className="space-y-3 flex-1">
                      <div className="flex items-center gap-3 flex-wrap">
                        <span className="text-lg font-extrabold text-gray-900">{report.store_name}</span>
                        {isPending ? (
                          <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-300 inline-flex items-center gap-1">
                            <IconWarning className="w-3.5 h-3.5 text-amber-600" />
                            Pendiente Dirección
                          </span>
                        ) : isRejected ? (
                          <span className="px-3 py-1 rounded-full text-xs font-bold bg-red-100 text-red-800 border border-red-300 inline-flex items-center gap-1">
                            <IconClose className="w-3.5 h-3.5 text-red-600" />
                            Rechazado
                          </span>
                        ) : (
                          <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 inline-flex items-center gap-1">
                            <IconCheck className="w-3.5 h-3.5 text-emerald-600" />
                            Autorizado por Dirección
                          </span>
                        )}
                      </div>

                      <div className="text-xs text-gray-600 flex items-center gap-4 flex-wrap">
                        <span><strong>Período:</strong> {getWeekRangeLabel(report.week_start_date)}</span>
                        <span><strong>Solicitante:</strong> {report.requested_by_name}</span>
                        {report.exceeded_categories && (
                          <span className="text-amber-700 font-bold bg-amber-50 px-2.5 py-0.5 rounded-md border border-amber-200">
                            Excede: {report.exceeded_categories}
                          </span>
                        )}
                      </div>

                      {/* Desglose de Gastos y Análisis de Sobrecosto */}
                      <div className="mt-3 bg-gray-50/90 p-4 rounded-xl border border-gray-200/80 space-y-3 text-xs">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {/* Mano de Obra */}
                          <div className="bg-white p-3 rounded-lg border border-gray-100 shadow-sm space-y-1">
                            <div className="flex items-center justify-between">
                              <span className="text-gray-500 font-bold uppercase text-[10px]">Mano de Obra</span>
                              {report.exceso_mano_obra > 0 && (
                                <span className="bg-red-100 text-red-700 text-[10px] font-extrabold px-2 py-0.5 rounded-full border border-red-200">
                                  Excedido: +{formatCurrency(report.exceso_mano_obra)}
                                </span>
                              )}
                            </div>
                            <div className="grid grid-cols-3 gap-1 pt-1 text-center">
                              <div>
                                <span className="text-[9px] text-gray-400 block uppercase">Límite Obra</span>
                                <span className="font-semibold text-gray-700">{formatCurrency(report.presupuesto_mano_obra || 0)}</span>
                              </div>
                              <div>
                                <span className="text-[9px] text-gray-400 block uppercase">Semana</span>
                                <span className="font-semibold text-gray-700">{formatCurrency(report.mano_obra_gasto || 0)}</span>
                              </div>
                              <div>
                                <span className="text-[9px] text-gray-400 block uppercase">Acumulado</span>
                                <span className={`font-bold ${report.exceso_mano_obra > 0 ? "text-red-600" : "text-gray-800"}`}>
                                  {formatCurrency(report.acumulado_mano_obra || 0)}
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Equipo y Maquinaria */}
                          <div className="bg-white p-3 rounded-lg border border-gray-100 shadow-sm space-y-1">
                            <div className="flex items-center justify-between">
                              <span className="text-gray-500 font-bold uppercase text-[10px]">Equipo y Maquinaria</span>
                              {report.exceso_equipo > 0 && (
                                <span className="bg-red-100 text-red-700 text-[10px] font-extrabold px-2 py-0.5 rounded-full border border-red-200">
                                  Excedido: +{formatCurrency(report.exceso_equipo)}
                                </span>
                              )}
                            </div>
                            <div className="grid grid-cols-3 gap-1 pt-1 text-center">
                              <div>
                                <span className="text-[9px] text-gray-400 block uppercase">Límite Obra</span>
                                <span className="font-semibold text-gray-700">{formatCurrency(report.presupuesto_equipo || 0)}</span>
                              </div>
                              <div>
                                <span className="text-[9px] text-gray-400 block uppercase">Semana</span>
                                <span className="font-semibold text-gray-700">{formatCurrency(report.equipo_gasto || 0)}</span>
                              </div>
                              <div>
                                <span className="text-[9px] text-gray-400 block uppercase">Acumulado</span>
                                <span className={`font-bold ${report.exceso_equipo > 0 ? "text-red-600" : "text-gray-800"}`}>
                                  {formatCurrency(report.acumulado_equipo || 0)}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center justify-between pt-1 border-t border-gray-200/60 text-xs">
                          <span className="text-gray-500 font-medium">Gasto Total de esta Semana:</span>
                          <span className="font-extrabold text-indigo-700 text-sm">{formatCurrency(totalGasto)}</span>
                        </div>
                      </div>

                      {/* Detalles adicionales: comentarios o motivo */}
                      {report.comments && (
                        <p className="text-xs text-gray-500 italic">
                          <strong>Comentarios:</strong> {report.comments}
                        </p>
                      )}
                      {isRejected && report.rejection_reason && (
                        <p className="text-xs text-red-600 font-semibold bg-red-50 p-2.5 rounded-lg border border-red-100">
                          <strong>Motivo de rechazo:</strong> {report.rejection_reason}
                        </p>
                      )}
                      {isApproved && report.approved_by_name && (
                        <p className="text-xs text-emerald-700 font-semibold bg-emerald-50 p-2.5 rounded-lg border border-emerald-100">
                          <strong>Autorizado por:</strong> {report.approved_by_name} {report.approval_date ? `el ${formatDate(report.approval_date)}` : ""}
                        </p>
                      )}
                    </div>

                    {/* Acciones para Dirección */}
                    {isPending && isDireccion && (
                      <div className="flex items-center gap-3 lg:flex-col lg:items-end flex-shrink-0 pt-3 lg:pt-0 border-t lg:border-t-0 border-gray-100">
                        <button
                          onClick={() => openApproveModal(report)}
                          disabled={approvingReportId === report.id || rejectingReportId === report.id}
                          className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-extrabold transition-all shadow flex items-center gap-2 disabled:opacity-50"
                        >
                          {approvingReportId === report.id ? (
                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          ) : (
                            <>
                              <IconCheck className="w-4 h-4" />
                              Autorizar Exceso
                            </>
                          )}
                        </button>

                        <button
                          onClick={() => openRejectModal(report)}
                          disabled={approvingReportId === report.id || rejectingReportId === report.id}
                          className="px-5 py-2.5 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded-xl text-xs font-bold transition-all flex items-center gap-2 disabled:opacity-50"
                        >
                          {rejectingReportId === report.id ? (
                            <div className="w-4 h-4 border-2 border-red-600 border-t-transparent rounded-full animate-spin" />
                          ) : (
                            <>
                              <IconClose className="w-4 h-4 text-red-600" />
                              Rechazar
                            </>
                          )}
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Mini Modal Personalizado de Confirmación para Dirección */}
        {confirmModal?.open && confirmModal.report && (
          <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-gray-100 space-y-5 animate-in fade-in zoom-in-95 duration-150">
              <div className="flex items-start gap-4">
                <div
                  className={`w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 ${
                    confirmModal.type === "approve"
                      ? "bg-emerald-100 text-emerald-600"
                      : "bg-red-100 text-red-600"
                  }`}
                >
                  {confirmModal.type === "approve" ? (
                    <IconCheck className="w-6 h-6" />
                  ) : (
                    <IconWarning className="w-6 h-6" />
                  )}
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900">
                    {confirmModal.type === "approve"
                      ? "Confirmar Autorización de Sobrecosto"
                      : "Rechazar Solicitud de Sobrecosto"}
                  </h3>
                  <p className="text-xs text-gray-500 mt-1">
                    Obra: <strong className="text-gray-800">{confirmModal.report.store_name}</strong>
                  </p>
                  <p className="text-xs text-gray-500">
                    Período: <strong className="text-gray-800">{getWeekRangeLabel(confirmModal.report.week_start_date)}</strong>
                  </p>
                </div>
              </div>

              {confirmModal.type === "approve" ? (
                <div className="bg-emerald-50/60 border border-emerald-100 rounded-xl p-3.5 text-xs text-emerald-900 space-y-1">
                  <p className="font-semibold">¿Deseas autorizar esta solicitud?</p>
                  <p className="text-emerald-700">
                    El gasto semanal reportado quedará desbloqueado y contabilizado en el presupuesto ejecutado de la obra.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  <label className="block text-xs font-semibold text-gray-700">
                    Motivo del rechazo para el solicitante:
                  </label>
                  <textarea
                    rows={3}
                    value={rejectionReasonInput}
                    onChange={(e) => setRejectionReasonInput(e.target.value)}
                    placeholder="Indica la razón o justificación del rechazo..."
                    className="w-full text-xs p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-transparent text-gray-900"
                  />
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  onClick={() => setConfirmModal(null)}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-bold transition-all"
                >
                  Cancelar
                </button>
                {confirmModal.type === "approve" ? (
                  <button
                    onClick={handleExecuteApprove}
                    disabled={approvingReportId === confirmModal.report.id}
                    className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-extrabold shadow transition-all flex items-center gap-1.5 disabled:opacity-50"
                  >
                    {approvingReportId === confirmModal.report.id ? (
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <>
                        <IconCheck className="w-4 h-4" />
                        Sí, Autorizar Exceso
                      </>
                    )}
                  </button>
                ) : (
                  <button
                    onClick={handleExecuteReject}
                    disabled={rejectingReportId === confirmModal.report.id}
                    className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-extrabold shadow transition-all flex items-center gap-1.5 disabled:opacity-50"
                  >
                    {rejectingReportId === confirmModal.report.id ? (
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      "Confirmar Rechazo"
                    )}
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
