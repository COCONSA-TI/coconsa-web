"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";
import type { StoreInsumoSearchResult, InsumoCategoria } from "@/types/database";

interface Store {
  id: number;
  name: string;
}

interface BudgetSummary {
  hasPresupuesto: boolean;
  totalInsumos: number;
  totalReporte: number;
  resumenPorCategoria: Record<string, { monto: number; count: number }>;
  ultimaCarga: {
    file_name: string;
    created_at: string;
    insumos_count: number;
    total_reporte: number;
  } | null;
}

const CATEGORIAS: InsumoCategoria[] = ["Materiales", "Mano de Obra", "Herramienta", "Equipo"];

const CATEGORIA_CONFIG: Record<InsumoCategoria, {
  bg: string; text: string; badge: string; borderActive: string;
  icon: React.ReactNode;
}> = {
  Materiales: {
    bg: "bg-blue-50", text: "text-blue-700", badge: "bg-blue-100 text-blue-700",
    borderActive: "border-blue-400",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
          d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
      </svg>
    ),
  },
  "Mano de Obra": {
    bg: "bg-emerald-50", text: "text-emerald-700", badge: "bg-emerald-100 text-emerald-700",
    borderActive: "border-emerald-400",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
          d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
  Herramienta: {
    bg: "bg-orange-50", text: "text-orange-700", badge: "bg-orange-100 text-orange-700",
    borderActive: "border-orange-400",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
          d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
  Equipo: {
    bg: "bg-violet-50", text: "text-violet-700", badge: "bg-violet-100 text-violet-700",
    borderActive: "border-violet-400",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
          d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
      </svg>
    ),
  },
};

const LOCALSTORAGE_KEY = "coconsa_presupuestos_storeId";

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(amount);
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString("es-MX", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ─── Iconos reutilizables ────────────────────────────────────────────────────

function IconUpload({ className = "w-7 h-7" }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
        d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
    </svg>
  );
}

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
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
    </svg>
  );
}

function IconTrash({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
    </svg>
  );
}

function IconSearch({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
    </svg>
  );
}

function IconDocument({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  );
}

function IconChartBar({ className = "w-8 h-8" }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
        d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
    </svg>
  );
}

// ─── Modal de confirmación de borrado ────────────────────────────────────────

function DeleteConfirmModal({
  storeName,
  onConfirm,
  onCancel,
  loading,
}: {
  storeName: string;
  onConfirm: () => void;
  onCancel: () => void;
  loading: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full mx-4">
        <div className="flex items-center justify-center w-12 h-12 rounded-full bg-red-100 mx-auto mb-4">
          <IconTrash className="w-6 h-6 text-red-600" />
        </div>
        <h3 className="text-center text-lg font-semibold text-gray-900 mb-1">
          Eliminar presupuesto
        </h3>
        <p className="text-center text-sm text-gray-500 mb-6">
          Se eliminarán todos los insumos del presupuesto de{" "}
          <strong className="text-gray-700">{storeName}</strong>. Esta acción no se puede deshacer.
        </p>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            disabled={loading}
            className="flex-1 px-4 py-2.5 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="flex-1 px-4 py-2.5 rounded-lg bg-red-600 text-sm font-medium text-white hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <IconTrash className="w-4 h-4" />
            )}
            Eliminar
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Componente principal ────────────────────────────────────────────────────

export default function PresupuestosPage() {
  const { user, isDepartmentHead, isAdmin } = useAuth();

  const [stores, setStores] = useState<Store[]>([]);
  const [selectedStoreId, setSelectedStoreId] = useState<number | null>(null);
  const [summary, setSummary] = useState<BudgetSummary | null>(null);
  const [insumos, setInsumos] = useState<StoreInsumoSearchResult[]>([]);
  const [selectedCategoria, setSelectedCategoria] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  const [loadingStores, setLoadingStores] = useState(true);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [loadingInsumos, setLoadingInsumos] = useState(false);

  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // ── Edición inline de costo_autorizado ─────────────────────────────────
  const [editingCostoId, setEditingCostoId] = useState<number | null>(null);
  const [editingCostoValue, setEditingCostoValue] = useState("");
  const [savingCosto, setSavingCosto] = useState(false);
  const costoInputRef = useRef<HTMLInputElement>(null);

  // ── Edición inline de monto_autorizado ──────────────────────────────────
  const [editingMontoId, setEditingMontoId] = useState<number | null>(null);
  const [editingMontoValue, setEditingMontoValue] = useState("");
  const [savingMonto, setSavingMonto] = useState(false);
  const montoInputRef = useRef<HTMLInputElement>(null);

  const [pendingFile, setPendingFile] = useState<File | null>(null);
  // ── Reportes Semanales ──────────────────────────────────────────────────
  const [weeklyReports, setWeeklyReports] = useState<any[]>([]);
  const [loadingWeeklyReports, setLoadingWeeklyReports] = useState(false);
  const [savingReportId, setSavingReportId] = useState<number | string | null>(null);
  const [deletingReportId, setDeletingReportId] = useState<number | null>(null);
  const [approvingReportId, setApprovingReportId] = useState<number | null>(null);
  const [rejectingReportId, setRejectingReportId] = useState<number | null>(null);

  // ── Modal de Confirmación para Autorizaciones ─────────────────────────────
  const [confirmModal, setConfirmModal] = useState<{
    open: boolean;
    type: "approve" | "reject";
    report: any;
  } | null>(null);
  const [rejectionReasonInput, setRejectionReasonInput] = useState<string>("Solicitud no aprobada por Dirección");

  // ── Vista General de Autorizaciones ──────────────────────────────────────
  const [activeTab, setActiveTab] = useState<"presupuesto" | "autorizaciones">("presupuesto");
  const [allApprovals, setAllApprovals] = useState<any[]>([]);
  const [loadingApprovals, setLoadingApprovals] = useState(false);
  const [approvalsFilter, setApprovalsFilter] = useState<"pending_approval" | "approved" | "rejected" | "all">("pending_approval");

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

  const fetchWeeklyReports = useCallback(async (storeId: number) => {
    setLoadingWeeklyReports(true);
    try {
      const res = await fetch(`/api/v1/stores/${storeId}/weekly-reports`);
      if (!res.ok) throw new Error("Error");
      const data = await res.json();
      setWeeklyReports(data.reports || []);
    } catch {
      setWeeklyReports([]);
    } finally {
      setLoadingWeeklyReports(false);
    }
  }, []);

  const handleAddWeek = () => {
    if (!selectedStoreId) return;
    const today = new Date();
    const day = today.getDay();
    const diff = today.getDate() - day + (day === 0 ? -6 : 1); // lunes de esta semana
    const monday = new Date(today.setDate(diff));
    const formattedDate = monday.toISOString().split("T")[0];

    if (weeklyReports.some((r) => r.week_start_date === formattedDate)) {
      setUploadError("Ya existe un reporte para esta semana.");
      return;
    }

    const newTempReport = {
      id: "temp-" + Date.now(),
      store_id: selectedStoreId,
      week_start_date: formattedDate,
      mano_obra_gasto: 0,
      equipo_gasto: 0,
      comments: "",
      isTemp: true,
    };
    setWeeklyReports((prev) => [...prev, newTempReport]);
  };

  const updateReportField = (id: string | number, field: string, value: any) => {
    setWeeklyReports((prev) =>
      prev.map((r) => (r.id === id ? { ...r, [field]: value } : r))
    );
  };

  const handleSaveReport = async (report: any) => {
    if (!selectedStoreId) return;
    setSavingReportId(report.id);
    setUploadError(null);
    setUploadSuccess(null);
    try {
      const res = await fetch(`/api/v1/stores/${selectedStoreId}/weekly-reports`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          week_start_date: report.week_start_date,
          mano_obra_gasto: Number(report.mano_obra_gasto) || 0,
          equipo_gasto: Number(report.equipo_gasto) || 0,
          comments: report.comments,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al guardar el reporte");
      
      if (data.isPendingApproval) {
        setUploadError(`Presupuesto excedido en (${data.exceededCategories}). Se ha enviado una solicitud de autorización a Dirección. Espera su aprobación.`);
      } else {
        setUploadSuccess("Reporte semanal guardado correctamente.");
      }
      await fetchWeeklyReports(selectedStoreId);
      await fetchGlobalApprovals();
    } catch (err: unknown) {
      setUploadError(err instanceof Error ? err.message : "Error al guardar");
    } finally {
      setSavingReportId(null);
    }
  };

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
    const storeName = report.store_name || selectedStore?.name || `Obra #${report.store_id}`;

    setApprovingReportId(report.id);
    setUploadError(null);
    setUploadSuccess(null);
    setConfirmModal(null);
    try {
      const res = await fetch(`/api/v1/stores/${report.store_id}/weekly-reports/${report.id}/approval`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "approve" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al autorizar");

      setUploadSuccess(`El gasto semanal de "${storeName}" fue autorizado por Dirección.`);
      await fetchGlobalApprovals();
      if (selectedStoreId && selectedStoreId === report.store_id) {
        await fetchWeeklyReports(selectedStoreId);
      }
    } catch (err: unknown) {
      setUploadError(err instanceof Error ? err.message : "Error al autorizar");
    } finally {
      setApprovingReportId(null);
    }
  };

  const handleExecuteReject = async () => {
    if (!confirmModal?.report) return;
    const report = confirmModal.report;
    const storeName = report.store_name || selectedStore?.name || `Obra #${report.store_id}`;
    const reason = rejectionReasonInput.trim() || "Solicitud no aprobada por Dirección";

    setRejectingReportId(report.id);
    setUploadError(null);
    setUploadSuccess(null);
    setConfirmModal(null);
    try {
      const res = await fetch(`/api/v1/stores/${report.store_id}/weekly-reports/${report.id}/approval`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reject", rejection_reason: reason }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al rechazar");

      setUploadError(`La solicitud de sobrecosto para "${storeName}" fue rechazada.`);
      await fetchGlobalApprovals();
      if (selectedStoreId && selectedStoreId === report.store_id) {
        await fetchWeeklyReports(selectedStoreId);
      }
    } catch (err: unknown) {
      setUploadError(err instanceof Error ? err.message : "Error al rechazar");
    } finally {
      setRejectingReportId(null);
    }
  };

  const handleRejectReport = async (report: any) => {
    if (!selectedStoreId || report.isTemp) return;
    const reason = prompt("Indica el motivo del rechazo (opcional):", "Solicitud no aprobada por Dirección");
    if (reason === null) return;

    setRejectingReportId(report.id);
    setUploadError(null);
    setUploadSuccess(null);
    try {
      const res = await fetch(`/api/v1/stores/${selectedStoreId}/weekly-reports/${report.id}/approval`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reject", rejection_reason: reason }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al rechazar");

      setUploadError("❌ Gasto semanal rechazado por Dirección.");
      await fetchWeeklyReports(selectedStoreId);
    } catch (err: unknown) {
      setUploadError(err instanceof Error ? err.message : "Error al rechazar");
    } finally {
      setRejectingReportId(null);
    }
  };

  const handleDeleteReport = async (report: any) => {
    if (report.isTemp) {
      setWeeklyReports((prev) => prev.filter((r) => r.id !== report.id));
      return;
    }
    if (!selectedStoreId) return;
    if (!confirm("¿Estás seguro de que deseas eliminar este reporte semanal?")) return;
    setDeletingReportId(report.id);
    setUploadError(null);
    setUploadSuccess(null);
    try {
      const res = await fetch(
        `/api/v1/stores/${selectedStoreId}/weekly-reports?reportId=${report.id}`,
        { method: "DELETE" }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al eliminar");
      
      setUploadSuccess("Reporte semanal eliminado.");
      await fetchWeeklyReports(selectedStoreId);
    } catch (err: unknown) {
      setUploadError(err instanceof Error ? err.message : "Error al eliminar");
    } finally {
      setDeletingReportId(null);
    }
  };

  const getWeekRangeLabel = (startDateStr: string) => {
    const start = new Date(startDateStr + "T00:00:00");
    const end = new Date(start);
    end.setDate(start.getDate() + 6);

    const options: Intl.DateTimeFormatOptions = { day: "2-digit", month: "short" };
    const startStr = start.toLocaleDateString("es-MX", options);
    const endStr = end.toLocaleDateString("es-MX", options);
    const yearStr = start.getFullYear();

    return `Del ${startStr} al ${endStr} (${yearStr})`;
  };

  const getPresupuestoManoObra = () => {
    const manoObraInsumos = insumos.filter((i) => i.categoria === "Mano de Obra");
    return manoObraInsumos.reduce((sum, i) => sum + (i.monto_autorizado ?? i.monto_presupuestado), 0);
  };

  const getPresupuestoEquipo = () => {
    const equipoInsumos = insumos.filter((i) => i.categoria === "Equipo");
    return equipoInsumos.reduce((sum, i) => sum + (i.monto_autorizado ?? i.monto_presupuestado), 0);
  };

  const getGastoManoObraTotal = () => {
    return weeklyReports
      .filter((r) => r.status === "approved" || !r.status)
      .reduce((sum, r) => sum + (Number(r.mano_obra_gasto) || 0), 0);
  };

  const getGastoEquipoTotal = () => {
    return weeklyReports
      .filter((r) => r.status === "approved" || !r.status)
      .reduce((sum, r) => sum + (Number(r.equipo_gasto) || 0), 0);
  };

  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  // ── Cargar lista de stores ──────────────────────────────────────────────
  useEffect(() => {
    const fetchStores = async () => {
      setLoadingStores(true);
      try {
        const res = await fetch("/api/v1/stores-suppliers");
        if (!res.ok) throw new Error("Error al cargar obras");
        const data = await res.json();
        const obraStores = (data.stores || []).filter((s: Store) => {
          const name = s.name?.trim() || "";
          return !/^(M|CG|AT|C|V)\s*0*\d+/i.test(name);
        });
        setStores(obraStores);

        // Restaurar la obra seleccionada anteriormente (persistencia)
        const saved = localStorage.getItem(LOCALSTORAGE_KEY);
        if (saved) {
          const savedId = parseInt(saved, 10);
          const stillExists = obraStores.some((s: Store) => s.id === savedId);
          if (stillExists) setSelectedStoreId(savedId);
        }
      } catch {
        setStores([]);
      } finally {
        setLoadingStores(false);
      }
    };
    fetchStores();
  }, []);

  // Persistir la selección de obra en localStorage
  useEffect(() => {
    if (selectedStoreId !== null) {
      localStorage.setItem(LOCALSTORAGE_KEY, String(selectedStoreId));
    } else {
      localStorage.removeItem(LOCALSTORAGE_KEY);
    }
  }, [selectedStoreId]);

  // ── Fetch del resumen ───────────────────────────────────────────────────
  const fetchSummary = useCallback(async (storeId: number) => {
    setLoadingSummary(true);
    setSummary(null);
    try {
      const res = await fetch(`/api/v1/stores/${storeId}/budget`);
      if (!res.ok) throw new Error("Error");
      const data = await res.json();
      setSummary(data);
    } catch {
      setSummary(null);
    } finally {
      setLoadingSummary(false);
    }
  }, []);

  // ── Fetch de insumos ────────────────────────────────────────────────────
  const fetchInsumos = useCallback(async (storeId: number, query = "", categoria = "all") => {
    setLoadingInsumos(true);
    try {
      const params = new URLSearchParams({ limit: "500" });
      if (query) params.set("query", query);
      if (categoria !== "all") params.set("categoria", categoria);
      const res = await fetch(`/api/v1/stores/${storeId}/insumos?${params}`);
      if (!res.ok) throw new Error("Error");
      const data = await res.json();
      setInsumos(data.insumos || []);
    } catch {
      setInsumos([]);
    } finally {
      setLoadingInsumos(false);
    }
  }, []);

  useEffect(() => {
    if (!selectedStoreId) return;
    fetchSummary(selectedStoreId);
    fetchInsumos(selectedStoreId);
    fetchWeeklyReports(selectedStoreId);
  }, [selectedStoreId, fetchSummary, fetchInsumos, fetchWeeklyReports]);

  // Filtro con debounce
  useEffect(() => {
    if (!selectedStoreId) return;
    const t = setTimeout(() => fetchInsumos(selectedStoreId, searchQuery, selectedCategoria), 300);
    return () => clearTimeout(t);
  }, [searchQuery, selectedCategoria, selectedStoreId, fetchInsumos]);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  // ── Subida de PDF ───────────────────────────────────────────────────────
  const handleUpload = async (file: File) => {
    if (!selectedStoreId) return;
    if (file.type !== "application/pdf") {
      setUploadError("El archivo debe ser un PDF.");
      return;
    }
    setUploading(true);
    setUploadError(null);
    setUploadSuccess(null);
    try {
      const fd = new FormData();
      fd.append("pdf", file);
      const res = await fetch(`/api/v1/stores/${selectedStoreId}/budget`, { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al procesar el PDF");
      const r = data.resumen;
      const parts = [];
      if (r.actualizados) parts.push(`${r.actualizados} actualizados`);
      if (r.nuevos) parts.push(`${r.nuevos} nuevos`);
      if (r.inactivados) parts.push(`${r.inactivados} inactivados`);
      setUploadSuccess(
        `Presupuesto actualizado — ${parts.join(', ')} · ${formatCurrency(r.totalReporte)} total`
      );
      await fetchSummary(selectedStoreId);
      await fetchInsumos(selectedStoreId, searchQuery, selectedCategoria);
    } catch (err: unknown) {
      setUploadError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setUploading(false);
    }
  };

  const handleFileSelect = (file: File) => {
    if (file.type !== "application/pdf") {
      setUploadError("El archivo debe ser un PDF.");
      return;
    }
    if (previewUrl) URL.revokeObjectURL(previewUrl);

    setPendingFile(file);
    setPreviewUrl(URL.createObjectURL(file));
    setUploadError(null);
    setUploadSuccess(null);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFileSelect(file);
    e.target.value = "";
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFileSelect(file);
  };

  const handleConfirmUpload = () => {
    if (pendingFile) handleUpload(pendingFile);
    setPendingFile(null);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
  };

  const handleCancelPreview = () => {
    setPendingFile(null);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
  };

  // ── Borrar presupuesto ──────────────────────────────────────────────────
  const handleDeleteBudget = async () => {
    if (!selectedStoreId) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/v1/stores/${selectedStoreId}/budget`, { method: "DELETE" });
      if (!res.ok) throw new Error("Error al eliminar");
      setShowDeleteModal(false);
      setInsumos([]);
      setUploadSuccess(null);
      setUploadError(null);
      await fetchSummary(selectedStoreId);
    } catch {
      setUploadError("No se pudo eliminar el presupuesto. Inténtalo de nuevo.");
      setShowDeleteModal(false);
    } finally {
      setDeleting(false);
    }
  };

  // ── Helpers ─────────────────────────────────────────────────────────────
  const selectedStore = stores.find((s) => s.id === selectedStoreId);

  const getPorcentajeComprometido = (cat: string) => {
    const cat_insumos = cat === "all" ? insumos : insumos.filter((i) => i.categoria === cat);
    const presup = cat_insumos.reduce((a, i) => a + i.monto_presupuestado, 0);
    if (presup === 0) return 0;
    const solicitado = cat_insumos.reduce((a, i) => a + i.costo_unitario * i.cantidad_solicitada, 0);
    return Math.min(100, (solicitado / presup) * 100);
  };

  // Gerencia (approval_order 1) y Dirección (code contiene 'direccion') pueden editar costo_autorizado
  const canEditCostoAutorizado = isAdmin || (isDepartmentHead && !!user?.department_code &&
    (/gerencia/i.test(user.department_code) || /direccion/i.test(user.department_code)));

  const isDireccion = Boolean(
    (user?.department_code && /dir|direccion|dirección/i.test(user.department_code)) ||
    (user?.department_name && /direccion|dirección/i.test(user.department_name))
  );

  const startEditCosto = (insumo: StoreInsumoSearchResult) => {
    setEditingCostoId(insumo.id);
    setEditingCostoValue(
      insumo.costo_autorizado != null ? String(insumo.costo_autorizado) : ""
    );
    setTimeout(() => costoInputRef.current?.focus(), 50);
  };

  const cancelEditCosto = () => {
    setEditingCostoId(null);
    setEditingCostoValue("");
  };

  const handleSaveCostoAutorizado = async (insumoId: number) => {
    if (!selectedStoreId) return;
    setSavingCosto(true);
    try {
      const val = editingCostoValue.trim() === "" ? null : parseFloat(editingCostoValue);
      if (val !== null && (isNaN(val) || val < 0)) {
        setUploadError("El costo autorizado debe ser un número mayor o igual a 0.");
        return;
      }
      const insumoActual = insumos.find((i) => i.id === insumoId);
      if (val !== null && insumoActual && val > insumoActual.costo_unitario) {
        setUploadError(
          `El costo autorizado ($${val.toFixed(2)}) no puede ser mayor al costo unitario ($${insumoActual.costo_unitario.toFixed(2)}).`
        );
        setSavingCosto(false);
        return;
      }
      const res = await fetch(
        `/api/v1/stores/${selectedStoreId}/insumos/${insumoId}`,
        { method: "PATCH", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ costo_autorizado: val }) }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al guardar");
      setInsumos((prev) =>
        prev.map((ins) => {
          if (ins.id !== insumoId) return ins;
          const montoAut = val != null ? val * ins.cantidad_presupuestada : null;
          return { ...ins, costo_autorizado: val, monto_autorizado: montoAut };
        })
      );
      setEditingCostoId(null);
      setEditingCostoValue("");
    } catch (err: unknown) {
      setUploadError(err instanceof Error ? err.message : "Error al guardar el costo autorizado");
    } finally {
      setSavingCosto(false);
    }
  };

  const startEditMonto = (insumo: StoreInsumoSearchResult) => {
    setEditingMontoId(insumo.id);
    setEditingMontoValue(
      insumo.monto_autorizado != null ? String(insumo.monto_autorizado) : ""
    );
    setTimeout(() => montoInputRef.current?.focus(), 50);
  };

  const cancelEditMonto = () => {
    setEditingMontoId(null);
    setEditingMontoValue("");
  };

  const handleSaveMontoAutorizado = async (insumoId: number) => {
    if (!selectedStoreId) return;
    setSavingMonto(true);
    try {
      const val = editingMontoValue.trim() === "" ? null : parseFloat(editingMontoValue);
      if (val !== null && (isNaN(val) || val < 0)) {
        setUploadError("El monto autorizado debe ser un número mayor o igual a 0.");
        return;
      }
      const insumoActual = insumos.find((i) => i.id === insumoId);
      if (val !== null && insumoActual && val > insumoActual.monto_presupuestado) {
        setUploadError(
          `El monto autorizado ($${val.toFixed(2)}) no puede ser mayor al monto presupuestado ($${insumoActual.monto_presupuestado.toFixed(2)}).`
        );
        setSavingMonto(false);
        return;
      }
      const res = await fetch(
        `/api/v1/stores/${selectedStoreId}/insumos/${insumoId}`,
        { method: "PATCH", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ monto_autorizado: val }) }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al guardar");
      // Actualizar localmente: recalcular costo_autorizado desde el monto
      setInsumos((prev) =>
        prev.map((ins) => {
          if (ins.id !== insumoId) return ins;
          const costoAut = val != null && ins.cantidad_presupuestada > 0
            ? val / ins.cantidad_presupuestada
            : null;
          return { ...ins, monto_autorizado: val, costo_autorizado: costoAut };
        })
      );
      setEditingMontoId(null);
      setEditingMontoValue("");
    } catch (err: unknown) {
      setUploadError(err instanceof Error ? err.message : "Error al guardar el monto autorizado");
    } finally {
      setSavingMonto(false);
    }
  };

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <>
      {showDeleteModal && selectedStore && (
        <DeleteConfirmModal
          storeName={selectedStore.name}
          onConfirm={handleDeleteBudget}
          onCancel={() => setShowDeleteModal(false)}
          loading={deleting}
        />
      )}

      <div className="min-h-screen bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900">Control de Presupuesto por Obra</h1>
            <p className="mt-1 text-sm text-gray-500">
              Carga el PDF de Explosión de Insumos para habilitar el control presupuestal de materiales y compras.
            </p>
          </div>

          {/* Selector de Obra y Botón de enlace a Autorizaciones */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex-1 max-w-md">
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                  Centro de Costos / Obra
                </label>
                {loadingStores ? (
                  <div className="h-10 bg-gray-100 animate-pulse rounded-lg w-full" />
                ) : (
                  <select
                    id="select-obra"
                    value={selectedStoreId ?? ""}
                    onChange={(e) => {
                      const val = e.target.value;
                      setSelectedStoreId(val ? parseInt(val, 10) : null);
                      setSummary(null);
                      setInsumos([]);
                      setUploadError(null);
                      setUploadSuccess(null);
                      setSelectedCategoria("all");
                      setSearchQuery("");
                    }}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 bg-white font-medium"
                  >
                    <option value="">Selecciona una obra...</option>
                    {stores.map((store) => (
                      <option key={store.id} value={store.id}>{store.name}</option>
                    ))}
                  </select>
                )}
              </div>

              {/* Enlace a la página independiente de Autorizaciones (sólo para Dirección) */}
              {isDireccion && (
                <div className="flex items-center gap-3 pt-2 md:pt-4">
                  <Link
                    href="/dashboard/presupuestos/autorizaciones"
                    className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl font-semibold text-sm transition-all shadow-sm bg-amber-50 text-amber-900 border border-amber-200 hover:bg-amber-100"
                  >
                    <IconWarning className="w-4 h-4 text-amber-600" />
                    <span>Solicitudes de Autorización</span>
                    {allApprovals.filter((a) => a.status === "pending_approval").length > 0 && (
                      <span className="bg-amber-600 text-white text-xs font-extrabold px-2.5 py-0.5 rounded-full shadow-sm ml-1 animate-pulse">
                        {allApprovals.filter((a) => a.status === "pending_approval").length}
                      </span>
                    )}
                  </Link>
                </div>
              )}
            </div>
          </div>

          {selectedStoreId ? (
            <>
              {/* Zona de carga del PDF */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900">
                      Explosión de Insumos de Presupuesto
                    </h2>
                    <p className="text-sm text-gray-500 mt-0.5">
                      Sube el PDF del presupuesto de{" "}
                      <strong className="text-gray-700">{selectedStore?.name}</strong>.
                      La IA lo procesará automáticamente.
                    </p>
                  </div>

                  {/* Acciones: última carga + botón borrar */}
                  <div className="flex items-start gap-3 flex-shrink-0">
                    {summary?.ultimaCarga && (
                      <div className="text-right text-xs text-gray-400 hidden sm:block">
                        <p className="font-medium text-gray-500">Última carga</p>
                        <p className="text-gray-600 truncate max-w-[200px]">{summary.ultimaCarga.file_name}</p>
                        <p>{formatDate(summary.ultimaCarga.created_at)}</p>
                      </div>
                    )}
                    {summary?.hasPresupuesto && (
                      <button
                        onClick={() => setShowDeleteModal(true)}
                        className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-colors"
                        title="Eliminar presupuesto y cargar uno nuevo"
                      >
                        <IconTrash className="w-4 h-4" />
                        <span className="hidden sm:inline">Eliminar presupuesto</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Alertas */}
                {uploadSuccess && (
                  <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700 flex items-start gap-2">
                    <IconCheck className="w-4 h-4 mt-0.5 flex-shrink-0" />
                    <span>{uploadSuccess}</span>
                  </div>
                )}
                {uploadError && (
                  <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 flex items-start gap-2">
                    <IconWarning className="w-4 h-4 mt-0.5 flex-shrink-0" />
                    <span><strong>Error:</strong> {uploadError}</span>
                  </div>
                )}

                {/* Drop zone — solo visible si no hay presupuesto o si se está subiendo */}
                {(!summary?.hasPresupuesto || uploading) && (
                  <div
                    onDrop={handleDrop}
                    onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                    onDragLeave={() => setDragOver(false)}
                    className={`border-2 border-dashed rounded-xl p-8 text-center transition-all duration-200 ${dragOver
                      ? "border-blue-500 bg-blue-50"
                      : uploading
                        ? "border-blue-300 bg-blue-50 cursor-not-allowed"
                        : "border-gray-300 hover:border-blue-400 hover:bg-gray-50 cursor-pointer"
                      }`}
                  >
                    <input
                      type="file"
                      id="budget-pdf-upload"
                      accept="application/pdf"
                      className="hidden"
                      onChange={handleFileChange}
                      disabled={uploading}
                    />
                    <label
                      htmlFor="budget-pdf-upload"
                      className={`w-full block ${uploading ? "cursor-not-allowed" : "cursor-pointer"}`}
                    >
                      {uploading ? (
                        <div className="flex flex-col items-center gap-3">
                          <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
                          <p className="text-blue-600 font-medium">Procesando PDF con IA...</p>
                          <p className="text-xs text-gray-500">Esto puede tardar unos segundos</p>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center gap-3">
                          <div className="w-14 h-14 bg-gray-100 rounded-full flex items-center justify-center text-gray-400">
                            <IconUpload className="w-7 h-7" />
                          </div>
                          <div>
                            <p className="text-gray-700 font-medium">
                              {dragOver ? "Suelta el PDF aquí" : "Arrastra o haz clic para subir el PDF"}
                            </p>
                            <p className="text-xs text-gray-400 mt-1">
                              PDF de Explosión de Insumos · Máximo 20 MB
                            </p>
                          </div>
                        </div>
                      )}
                    </label>
                  </div>
                )}

                {previewUrl && pendingFile && (
                  <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900">
                          Vista previa del PDF
                        </h3>
                        <p className="text-sm text-gray-500">
                          {pendingFile.name} · {(pendingFile.size / 1024 / 1024).toFixed(2)} MB
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={handleCancelPreview}
                          className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
                        >
                          Cancelar
                        </button>
                        <button
                          onClick={handleConfirmUpload}
                          className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 flex items-center gap-2"
                        >
                          <IconUpload className="w-4 h-4" />
                          Confirmar y procesar con IA
                        </button>
                      </div>
                    </div>
                    <iframe
                      src={previewUrl}
                      className="w-full h-[600px] rounded-lg border border-gray-200"
                      title="Vista previa del PDF"
                    />
                  </div>
                )}

                {/* Si ya hay presupuesto y no se está subiendo, mostrar opción de reemplazar */}
                {summary?.hasPresupuesto && !uploading && (
                  <div className="mt-2 flex items-center gap-2">
                    <label
                      htmlFor="budget-pdf-replace"
                      className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer"
                    >
                      <IconUpload className="w-4 h-4" />
                      Reemplazar PDF
                    </label>
                    <input
                      type="file"
                      id="budget-pdf-replace"
                      accept="application/pdf"
                      className="hidden"
                      onChange={handleFileChange}
                    />
                    <span className="text-xs text-gray-400">
                      Esto sobreescribirá el presupuesto actual de la obra
                    </span>
                  </div>
                )}
              </div>

              {/* Resumen financiero por categoría */}
              {loadingSummary ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 mb-6">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="h-36 bg-white rounded-xl shadow-sm border border-gray-200 animate-pulse" />
                  ))}
                </div>
              ) : summary?.hasPresupuesto ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 mb-6">
                  {/* Card de Total */}
                  <button
                    onClick={() => setSelectedCategoria("all")}
                    className={`bg-white rounded-xl shadow-sm border-2 p-5 text-left hover:shadow-md transition-all ${
                      selectedCategoria === "all"
                        ? "border-indigo-400 shadow-md"
                        : "border-gray-200"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-indigo-50 text-indigo-700">
                        <IconChartBar className="w-5 h-5" />
                      </div>
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700">
                        {summary.totalInsumos}
                      </span>
                    </div>
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Total General</p>
                    <p className="text-xl font-bold text-gray-900 mt-0.5 tabular-nums">
                      {formatCurrency(summary.totalReporte)}
                    </p>
                    <div className="mt-3">
                      <div className="flex justify-between text-xs text-gray-400 mb-1">
                        <span>Comprometido</span>
                        <span className="tabular-nums">{getPorcentajeComprometido("all").toFixed(1)}%</span>
                      </div>
                      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${
                            getPorcentajeComprometido("all") >= 90
                              ? "bg-red-500"
                              : getPorcentajeComprometido("all") >= 70
                              ? "bg-amber-400"
                              : "bg-green-500"
                          }`}
                          style={{ width: `${getPorcentajeComprometido("all")}%` }}
                        />
                      </div>
                    </div>
                  </button>

                  {CATEGORIAS.map((cat) => {
                    const cfg = CATEGORIA_CONFIG[cat];
                    const catData = summary.resumenPorCategoria[cat];
                    const comprometido = getPorcentajeComprometido(cat);
                    const isActive = selectedCategoria === cat;
                    return (
                      <button
                        key={cat}
                        onClick={() => setSelectedCategoria((prev) => (prev === cat ? "all" : cat))}
                        className={`bg-white rounded-xl shadow-sm border-2 p-5 text-left hover:shadow-md transition-all ${isActive ? `${cfg.borderActive} shadow-md` : "border-gray-200"
                          }`}
                      >
                        <div className="flex items-center justify-between mb-3">
                          <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${cfg.bg} ${cfg.text}`}>
                            {cfg.icon}
                          </div>
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${cfg.badge}`}>
                            {catData?.count ?? 0}
                          </span>
                        </div>
                        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">{cat}</p>
                        <p className="text-xl font-bold text-gray-900 mt-0.5 tabular-nums">
                          {formatCurrency(catData?.monto ?? 0)}
                        </p>
                        <div className="mt-3">
                          <div className="flex justify-between text-xs text-gray-400 mb-1">
                            <span>Comprometido</span>
                            <span className="tabular-nums">{comprometido.toFixed(1)}%</span>
                          </div>
                          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${comprometido >= 90 ? "bg-red-500" : comprometido >= 70 ? "bg-amber-400" : "bg-green-500"
                                }`}
                              style={{ width: `${comprometido}%` }}
                            />
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              ) : summary && !summary.hasPresupuesto ? (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 mb-6 flex items-start gap-4">
                  <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center flex-shrink-0">
                    <IconDocument className="w-5 h-5 text-amber-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-amber-800">Sin presupuesto cargado</h3>
                    <p className="text-sm text-amber-700 mt-1">
                      Esta obra aún no tiene una Explosión de Insumos cargada. Sube el PDF para habilitar
                      el control presupuestal de materiales y compras.
                    </p>
                  </div>
                </div>
              ) : null}

              {/* Tabla de insumos */}
              {summary?.hasPresupuesto && (
                <>
                                  <div className="bg-white rounded-xl shadow-sm border border-gray-200">
                  {/* Toolbar */}
                  <div className="px-6 py-4 border-b border-gray-200 flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => setSelectedCategoria("all")}
                        className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${selectedCategoria === "all"
                          ? "bg-gray-900 text-white"
                          : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                          }`}
                      >
                        Todos ({summary.totalInsumos})
                      </button>
                      {CATEGORIAS.map((cat) => {
                        const cfg = CATEGORIA_CONFIG[cat];
                        const count = summary.resumenPorCategoria[cat]?.count ?? 0;
                        return (
                          <button
                            key={cat}
                            onClick={() => setSelectedCategoria(selectedCategoria === cat ? "all" : cat)}
                            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${selectedCategoria === cat
                              ? `${cfg.bg} ${cfg.text} ring-2 ring-offset-1 ring-current`
                              : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                              }`}
                          >
                            <span className={selectedCategoria === cat ? cfg.text : "text-gray-500"}>
                              {cfg.icon}
                            </span>
                            {cat} ({count})
                          </button>
                        );
                      })}
                    </div>
                    <div className="relative w-full sm:w-64">
                      <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                        <IconSearch className="w-4 h-4" />
                      </div>
                      <input
                        type="text"
                        placeholder="Buscar por clave o descripción..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
                      />
                    </div>
                  </div>

                  {/* Tabla */}
                  <div className="overflow-x-auto">
                    {loadingInsumos ? (
                      <div className="p-10 text-center">
                        <div className="inline-block w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                        <p className="text-sm text-gray-500 mt-2">Cargando insumos...</p>
                      </div>
                    ) : insumos.length === 0 ? (
                      <div className="p-10 text-center">
                        <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-3">
                          <IconSearch className="w-6 h-6 text-gray-400" />
                        </div>
                        <p className="text-sm text-gray-500">No se encontraron insumos con los filtros actuales.</p>
                      </div>
                    ) : (
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-gray-50 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                            <th className="px-4 py-3 text-left">Clave / Cat.</th>
                            <th className="px-4 py-3 text-left">Descripción</th>
                            <th className="px-4 py-3 text-center">Unidad</th>
                            <th className="px-4 py-3 text-right">Cantidad (Presup. / Disp.)</th>
                            <th className="px-4 py-3 text-right">Costo (Base / Autorizado)</th>
                            <th className="px-4 py-3 text-right">Monto (Base / Autorizado)</th>
                            <th className="px-4 py-3 text-right">Ahorro</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {insumos.map((insumo) => {
                            const cfg = CATEGORIA_CONFIG[insumo.categoria as InsumoCategoria] ?? CATEGORIA_CONFIG.Materiales;
                            const pct = insumo.cantidad_presupuestada > 0
                              ? ((insumo.cantidad_solicitada + insumo.cantidad_comprada) / insumo.cantidad_presupuestada) * 100
                              : 0;
                            return (
                              <tr key={insumo.id} className="hover:bg-gray-50 transition-colors">
                                {/* Clave y Categoría */}
                                <td className="px-4 py-3">
                                  <div className="flex flex-col gap-1">
                                    <span className="font-mono text-xs font-semibold text-gray-700">{insumo.clave}</span>
                                    <span className={`inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full w-max ${cfg.badge}`}>
                                      {cfg.icon}
                                      <span>{insumo.categoria}</span>
                                    </span>
                                  </div>
                                </td>
                                
                                {/* Descripción */}
                                <td className="px-4 py-3 text-gray-700 max-w-xs">
                                  <p className="line-clamp-2">{insumo.descripcion}</p>
                                </td>
                                
                                {/* Unidad */}
                                <td className="px-4 py-3 text-center text-gray-500 uppercase text-xs font-medium">
                                  {insumo.unidad}
                                </td>
                                
                                {/* Cantidad (Presup. / Disp.) */}
                                <td className="px-4 py-3 text-right tabular-nums">
                                  <div className="text-gray-900 font-medium">
                                    {insumo.cantidad_presupuestada.toLocaleString("es-MX", { maximumFractionDigits: 3 })}
                                  </div>
                                  <div className="text-xs text-gray-500 mt-0.5">
                                    Disp: <span className={insumo.cantidad_disponible > 0 ? "text-green-600 font-semibold" : "text-red-500 font-semibold"}>
                                      {insumo.cantidad_disponible.toLocaleString("es-MX", { maximumFractionDigits: 3 })}
                                    </span>
                                    {insumo.cantidad_solicitada > 0 && (
                                      <span className="text-gray-400"> (Sol: {insumo.cantidad_solicitada.toLocaleString("es-MX", { maximumFractionDigits: 3 })})</span>
                                    )}
                                  </div>
                                  {insumo.cantidad_presupuestada > 0 && (
                                    <div className="mt-1 h-1 bg-gray-100 rounded-full overflow-hidden w-16 ml-auto">
                                      <div
                                        className={`h-full rounded-full ${pct >= 100 ? "bg-red-500" : pct >= 75 ? "bg-amber-400" : "bg-green-400"}`}
                                        style={{ width: `${Math.min(100, pct)}%` }}
                                      />
                                    </div>
                                  )}
                                </td>

                                {/* Costo (Base / Autorizado) */}
                                <td className="px-4 py-3 text-right tabular-nums">
                                  <div className="text-xs text-gray-400 mb-1">
                                    Base: {formatCurrency(insumo.costo_unitario)}
                                  </div>
                                  {editingCostoId === insumo.id ? (
                                    <div className="flex items-center justify-end gap-1">
                                      <input
                                        ref={costoInputRef}
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        value={editingCostoValue}
                                        onChange={(e) => setEditingCostoValue(e.target.value)}
                                        onKeyDown={(e) => {
                                          if (e.key === "Enter") handleSaveCostoAutorizado(insumo.id);
                                          if (e.key === "Escape") cancelEditCosto();
                                        }}
                                        className="w-28 px-2 py-1 text-right text-sm text-gray-900 border border-blue-400 rounded focus:outline-none focus:ring-2 focus:ring-blue-300"
                                        placeholder="0.00"
                                        disabled={savingCosto}
                                      />
                                      <button
                                        onClick={() => handleSaveCostoAutorizado(insumo.id)}
                                        disabled={savingCosto}
                                        title="Guardar"
                                        className="p-1 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
                                      >
                                        {savingCosto ? (
                                          <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                        ) : (
                                          <IconCheck className="w-3 h-3" />
                                        )}
                                      </button>
                                      <button
                                        onClick={cancelEditCosto}
                                        title="Cancelar"
                                        className="p-1 rounded bg-gray-200 text-gray-600 hover:bg-gray-300 transition-colors"
                                      >
                                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                        </svg>
                                      </button>
                                    </div>
                                  ) : (
                                    <div className="flex items-center justify-end gap-1.5 group">
                                      {insumo.costo_autorizado != null ? (
                                        <span className="font-semibold text-green-700">
                                          {formatCurrency(insumo.costo_autorizado)}
                                        </span>
                                      ) : (
                                        <span className="text-gray-300">—</span>
                                      )}
                                      {canEditCostoAutorizado && (
                                        <button
                                          onClick={() => startEditCosto(insumo)}
                                          title="Editar costo autorizado"
                                          className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-blue-50 text-blue-400 hover:text-blue-600"
                                        >
                                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                              d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                          </svg>
                                        </button>
                                      )}
                                    </div>
                                  )}
                                </td>

                                {/* Monto (Base / Autorizado) */}
                                <td className="px-4 py-3 text-right tabular-nums">
                                  <div className="text-xs text-gray-400 mb-1">
                                    Base: {formatCurrency(insumo.monto_presupuestado)}
                                  </div>
                                  {editingMontoId === insumo.id ? (
                                    <div className="flex items-center justify-end gap-1">
                                      <input
                                        ref={montoInputRef}
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        value={editingMontoValue}
                                        onChange={(e) => setEditingMontoValue(e.target.value)}
                                        onKeyDown={(e) => {
                                          if (e.key === "Enter") handleSaveMontoAutorizado(insumo.id);
                                          if (e.key === "Escape") cancelEditMonto();
                                        }}
                                        className="w-32 px-2 py-1 text-right text-sm text-gray-900 border border-blue-400 rounded focus:outline-none focus:ring-2 focus:ring-blue-300"
                                        placeholder="0.00"
                                        disabled={savingMonto}
                                      />
                                      <button
                                        onClick={() => handleSaveMontoAutorizado(insumo.id)}
                                        disabled={savingMonto}
                                        title="Guardar"
                                        className="p-1 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
                                      >
                                        {savingMonto ? (
                                          <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                        ) : (
                                          <IconCheck className="w-3 h-3" />
                                        )}
                                      </button>
                                      <button
                                        onClick={cancelEditMonto}
                                        title="Cancelar"
                                        className="p-1 rounded bg-gray-200 text-gray-600 hover:bg-gray-300 transition-colors"
                                      >
                                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                        </svg>
                                      </button>
                                    </div>
                                  ) : (
                                    <div className="flex items-center justify-end gap-1.5 group">
                                      {insumo.monto_autorizado != null ? (
                                        <span className="font-semibold text-green-700">
                                          {formatCurrency(insumo.monto_autorizado)}
                                        </span>
                                      ) : (
                                        <span className="text-gray-300">—</span>
                                      )}
                                      {canEditCostoAutorizado && (
                                        <button
                                          onClick={() => startEditMonto(insumo)}
                                          title="Editar monto autorizado"
                                          className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-blue-50 text-blue-400 hover:text-blue-600"
                                        >
                                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                              d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                          </svg>
                                        </button>
                                      )}
                                    </div>
                                  )}
                                </td>

                                {/* Ahorro */}
                                <td className="px-4 py-3 text-right tabular-nums">
                                  {insumo.monto_autorizado != null ? (
                                    (() => {
                                      const ahorro = insumo.monto_presupuestado - insumo.monto_autorizado;
                                      return (
                                        <span className={`font-semibold ${
                                          ahorro > 0 ? "text-emerald-600" : ahorro < 0 ? "text-red-500" : "text-gray-400"
                                        }`}>
                                          {ahorro > 0 ? "+" : ""}{formatCurrency(ahorro)}
                                        </span>
                                      );
                                    })()
                                  ) : (
                                    <span className="text-gray-300">—</span>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    )}
                  </div>

                  {/* Footer */}
                  {insumos.length > 0 && (
                    <div className="px-6 py-3 bg-gray-50 border-t border-gray-200 flex flex-col sm:flex-row justify-between items-center gap-2 text-sm">
                      <span className="text-gray-500">{insumos.length} insumos mostrados</span>
                      <div className="flex flex-wrap gap-4 sm:gap-6 justify-end">
                        <span className="text-gray-600">
                          Presupuestado: <strong className="text-gray-900">{formatCurrency(insumos.reduce((a, i) => a + i.monto_presupuestado, 0))}</strong>
                        </span>
                        {insumos.some(i => i.monto_autorizado != null) && (
                          <>
                            <span className="text-gray-600">
                              Autorizado: <strong className="text-green-700">{formatCurrency(insumos.reduce((a, i) => a + (i.monto_autorizado ?? i.monto_presupuestado), 0))}</strong>
                            </span>
                            {(() => {
                              const totalPres = insumos.reduce((a, i) => a + i.monto_presupuestado, 0);
                              const totalAut = insumos.reduce((a, i) => a + (i.monto_autorizado ?? i.monto_presupuestado), 0);
                              const totalAhorro = totalPres - totalAut;
                              return totalAhorro !== 0 ? (
                                <span className="text-gray-600">
                                  Ahorro Total: <strong className={totalAhorro > 0 ? "text-emerald-600" : "text-red-500"}>{totalAhorro > 0 ? "+" : ""}{formatCurrency(totalAhorro)}</strong>
                                </span>
                              ) : null;
                            })()}
                          </>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                  {/* Reporteador Semanal de Mano de Obra y Equipo */}
                  <div className="bg-white rounded-xl shadow-sm border border-gray-200 mt-6 p-6">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 border-b border-gray-100 pb-4">
                      <div>
                        <h3 className="text-lg font-bold text-gray-900">Control y Reporte Semanal</h3>
                        <p className="text-xs text-gray-500 mt-1">
                          Registra manualmente los gastos semanales de mano de obra y equipo/maquinaria para comparar con el presupuesto.
                        </p>
                      </div>
                      {canEditCostoAutorizado && (
                        <button
                          onClick={handleAddWeek}
                          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-semibold shadow-sm transition-colors flex items-center gap-2"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                          </svg>
                          Agregar Semana
                        </button>
                      )}
                    </div>

                    {/* Resumen Comparativo Acumulado */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                      {/* Mano de Obra Card */}
                      {(() => {
                        const presup = getPresupuestoManoObra();
                        const gasto = getGastoManoObraTotal();
                        const disponible = presup - gasto;
                        const pct = presup > 0 ? (gasto / presup) * 100 : 0;
                        return (
                          <div className="bg-emerald-50/50 border border-emerald-100 rounded-xl p-5">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-sm font-semibold text-emerald-800 uppercase tracking-wider">Mano de Obra</span>
                              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${pct > 100 ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'}`}>
                                {pct.toFixed(1)}% Consumido
                              </span>
                            </div>
                            <div className="grid grid-cols-3 gap-2 mt-4 text-center">
                              <div className="bg-white/80 rounded-lg p-2.5 shadow-sm border border-emerald-50">
                                <span className="block text-[10px] font-semibold text-gray-400 uppercase">Presupuesto</span>
                                <span className="text-sm font-bold text-gray-800 mt-1 block">{formatCurrency(presup)}</span>
                              </div>
                              <div className="bg-white/80 rounded-lg p-2.5 shadow-sm border border-emerald-50">
                                <span className="block text-[10px] font-semibold text-gray-400 uppercase">Ejecutado</span>
                                <span className="text-sm font-bold text-emerald-700 mt-1 block">{formatCurrency(gasto)}</span>
                              </div>
                              <div className="bg-white/80 rounded-lg p-2.5 shadow-sm border border-emerald-50">
                                <span className="block text-[10px] font-semibold text-gray-400 uppercase">Saldo Disp.</span>
                                <span className={`text-sm font-bold mt-1 block ${disponible >= 0 ? "text-green-600" : "text-red-600"}`}>
                                  {formatCurrency(disponible)}
                                </span>
                              </div>
                            </div>
                            <div className="mt-4 h-2 bg-emerald-100 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all duration-500 ${pct > 100 ? 'bg-red-500' : pct > 90 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                                style={{ width: `${Math.min(100, pct)}%` }}
                              />
                            </div>
                          </div>
                        );
                      })()}

                      {/* Equipo Card */}
                      {(() => {
                        const presup = getPresupuestoEquipo();
                        const gasto = getGastoEquipoTotal();
                        const disponible = presup - gasto;
                        const pct = presup > 0 ? (gasto / presup) * 100 : 0;
                        return (
                          <div className="bg-violet-50/50 border border-violet-100 rounded-xl p-5">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-sm font-semibold text-violet-800 uppercase tracking-wider">Equipo y Maquinaria</span>
                              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${pct > 100 ? 'bg-red-100 text-red-700' : 'bg-violet-100 text-violet-700'}`}>
                                {pct.toFixed(1)}% Consumido
                              </span>
                            </div>
                            <div className="grid grid-cols-3 gap-2 mt-4 text-center">
                              <div className="bg-white/80 rounded-lg p-2.5 shadow-sm border border-violet-50">
                                <span className="block text-[10px] font-semibold text-gray-400 uppercase">Presupuesto</span>
                                <span className="text-sm font-bold text-gray-800 mt-1 block">{formatCurrency(presup)}</span>
                              </div>
                              <div className="bg-white/80 rounded-lg p-2.5 shadow-sm border border-violet-50">
                                <span className="block text-[10px] font-semibold text-gray-400 uppercase">Ejecutado</span>
                                <span className="text-sm font-bold text-violet-700 mt-1 block">{formatCurrency(gasto)}</span>
                              </div>
                              <div className="bg-white/80 rounded-lg p-2.5 shadow-sm border border-violet-50">
                                <span className="block text-[10px] font-semibold text-gray-400 uppercase">Saldo Disp.</span>
                                <span className={`text-sm font-bold mt-1 block ${disponible >= 0 ? "text-green-600" : "text-red-600"}`}>
                                  {formatCurrency(disponible)}
                                </span>
                              </div>
                            </div>
                            <div className="mt-4 h-2 bg-violet-100 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all duration-500 ${pct > 100 ? 'bg-red-500' : pct > 90 ? 'bg-amber-500' : 'bg-violet-500'}`}
                                style={{ width: `${Math.min(100, pct)}%` }}
                              />
                            </div>
                          </div>
                        );
                      })()}
                    </div>

                    {/* Tabla de Semanas */}
                    {loadingWeeklyReports ? (
                      <div className="py-10 text-center">
                        <div className="inline-block w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                        <p className="text-sm text-gray-500 mt-2">Cargando reporteador...</p>
                      </div>
                    ) : weeklyReports.length === 0 ? (
                      <div className="py-10 text-center border border-dashed border-gray-200 rounded-xl bg-gray-50/50">
                        <svg className="w-10 h-10 text-gray-400 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        <p className="text-sm font-semibold text-gray-600">No se han registrado gastos semanales</p>
                        <p className="text-xs text-gray-400 mt-1">Presiona "Agregar Semana" para comenzar a reportar.</p>
                      </div>
                    ) : (
                      <div className="overflow-x-auto border border-gray-100 rounded-xl">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="bg-gray-50 text-xs font-semibold text-gray-500 uppercase tracking-wide border-b border-gray-100">
                              <th className="px-4 py-3 text-left w-56">Fecha / Período de la Semana</th>
                              <th className="px-4 py-3 text-right w-36">Gasto Mano de Obra</th>
                              <th className="px-4 py-3 text-right w-36">Gasto Equipo / Maq.</th>
                              <th className="px-4 py-3 text-center w-52">Estado / Autorización</th>
                              <th className="px-4 py-3 text-left">Comentarios / Notas</th>
                              {canEditCostoAutorizado && <th className="px-4 py-3 text-center w-40">Acciones</th>}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100 bg-white">
                            {weeklyReports.map((report) => {
                              const isPending = report.status === "pending_approval";
                              const isRejected = report.status === "rejected";
                              const isApproved = report.status === "approved" || !report.status;
                              const canApproveThisReport = isPending && isDireccion;
                              const isSaveDisabled = savingReportId === report.id || (isPending && !isDireccion);

                              return (
                                <tr key={report.id} className="hover:bg-gray-50/50 transition-colors">
                                  {/* Selector de fecha / Label */}
                                  <td className="px-4 py-3">
                                    {report.isTemp ? (
                                      <div className="flex flex-col gap-1">
                                        <label className="text-[10px] font-semibold text-indigo-600 uppercase">Selecciona el lunes de inicio:</label>
                                        <input
                                          type="date"
                                          value={report.week_start_date}
                                          onChange={(e) => {
                                            const chosenDate = new Date(e.target.value + "T00:00:00");
                                            const day = chosenDate.getDay();
                                            const diff = chosenDate.getDate() - day + (day === 0 ? -6 : 1);
                                            const monday = new Date(chosenDate.setDate(diff));
                                            const formatted = monday.toISOString().split("T")[0];
                                            
                                            if (weeklyReports.some((r) => r.id !== report.id && r.week_start_date === formatted)) {
                                              setUploadError("Ya existe un reporte registrado para esa semana.");
                                              return;
                                            }
                                            updateReportField(report.id, "week_start_date", formatted);
                                          }}
                                          className="px-2 py-1.5 border border-indigo-300 rounded focus:ring-2 focus:ring-indigo-300 outline-none text-gray-900 bg-indigo-50/30"
                                        />
                                        <span className="text-[10px] text-gray-400 mt-1">{getWeekRangeLabel(report.week_start_date)}</span>
                                      </div>
                                    ) : (
                                      <div className="font-medium text-gray-900">
                                        {getWeekRangeLabel(report.week_start_date)}
                                      </div>
                                    )}
                                  </td>

                                  {/* Input Mano de Obra */}
                                  <td className="px-4 py-3 text-right">
                                    {canEditCostoAutorizado ? (
                                      <input
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        placeholder="0.00"
                                        value={report.mano_obra_gasto}
                                        onChange={(e) => updateReportField(report.id, "mano_obra_gasto", e.target.value)}
                                        className="w-full max-w-[130px] px-2 py-1.5 border border-gray-300 rounded focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-right text-gray-900"
                                      />
                                    ) : (
                                      <span className="font-semibold text-gray-800 tabular-nums">{formatCurrency(report.mano_obra_gasto)}</span>
                                    )}
                                  </td>

                                  {/* Input Equipo */}
                                  <td className="px-4 py-3 text-right">
                                    {canEditCostoAutorizado ? (
                                      <input
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        placeholder="0.00"
                                        value={report.equipo_gasto}
                                        onChange={(e) => updateReportField(report.id, "equipo_gasto", e.target.value)}
                                        className="w-full max-w-[130px] px-2 py-1.5 border border-gray-300 rounded focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-right text-gray-900"
                                      />
                                    ) : (
                                      <span className="font-semibold text-gray-800 tabular-nums">{formatCurrency(report.equipo_gasto)}</span>
                                    )}
                                  </td>

                                  {/* Estado / Autorización */}
                                  <td className="px-4 py-3 text-center">
                                    {isPending ? (
                                      <div className="flex flex-col items-center gap-1">
                                        <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-300 inline-flex items-center gap-1">
                                          <IconWarning className="w-3.5 h-3.5 text-amber-600" />
                                          Pendiente Dirección
                                        </span>
                                        {report.exceeded_categories && (
                                          <span className="text-[10px] text-amber-700 font-medium">Excede: {report.exceeded_categories}</span>
                                        )}
                                        <span className="text-[10px] text-gray-500 italic">Esperando decisión de Dirección</span>
                                      </div>
                                    ) : isRejected ? (
                                      <div className="flex flex-col items-center gap-1">
                                        <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-800 border border-red-300 inline-flex items-center gap-1">
                                          ❌ Rechazado
                                        </span>
                                        <span className="text-[10px] text-red-600 font-medium">
                                          {report.rejection_reason || "Solicitud no aprobada por Dirección"}
                                        </span>
                                      </div>
                                    ) : (
                                      <div className="flex flex-col items-center gap-0.5">
                                        <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-300 inline-flex items-center gap-1">
                                          <IconCheck className="w-3.5 h-3.5 text-emerald-600" />
                                          {report.exceeded_categories ? "Autorizado" : "Aprobado"}
                                        </span>
                                        {report.exceeded_categories && (
                                          <span className="text-[10px] text-emerald-700">Autorizado por Dirección</span>
                                        )}
                                      </div>
                                    )}
                                  </td>

                                  {/* Comentarios */}
                                  <td className="px-4 py-3">
                                    {canEditCostoAutorizado ? (
                                      <input
                                        type="text"
                                        placeholder="ej. Avance de cimentación..."
                                        value={report.comments || ""}
                                        onChange={(e) => updateReportField(report.id, "comments", e.target.value)}
                                        className="w-full px-2 py-1.5 border border-gray-300 rounded focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-gray-900"
                                      />
                                    ) : (
                                      <span className="text-gray-500 text-xs">{report.comments || "—"}</span>
                                    )}
                                  </td>

                                  {/* Acciones */}
                                  {canEditCostoAutorizado && (
                                    <td className="px-4 py-3 text-center">
                                      <div className="flex justify-center items-center gap-1.5">
                                        {/* Botones de Dirección para Aprobar / Rechazar exceso (sólo si no es la misma persona) */}
                                        {canApproveThisReport && (
                                          <>
                                            <button
                                              onClick={() => openApproveModal({ ...report, store_name: selectedStore?.name })}
                                              disabled={approvingReportId === report.id}
                                              className="px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs font-medium transition-colors flex items-center gap-1 disabled:opacity-50"
                                              title="Autorizar exceso de presupuesto"
                                            >
                                              {approvingReportId === report.id ? (
                                                <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                              ) : (
                                                <>
                                                  <IconCheck className="w-3.5 h-3.5" />
                                                  Autorizar
                                                </>
                                              )}
                                            </button>

                                            <button
                                              onClick={() => openRejectModal({ ...report, store_name: selectedStore?.name })}
                                              disabled={rejectingReportId === report.id}
                                              className="px-2 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-xs font-medium transition-colors flex items-center gap-1 disabled:opacity-50"
                                              title="Rechazar exceso de presupuesto"
                                            >
                                              {rejectingReportId === report.id ? (
                                                <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                              ) : (
                                                <>
                                                  ❌ Rechazar
                                                </>
                                              )}
                                            </button>
                                          </>
                                        )}

                                        {/* Guardar / Confirmar subida */}
                                        <button
                                          onClick={() => handleSaveReport(report)}
                                          disabled={isSaveDisabled}
                                          className={`p-2 rounded-lg transition-colors flex items-center justify-center disabled:opacity-50 ${
                                            isPending
                                              ? "bg-amber-500 hover:bg-amber-600 text-white"
                                              : "bg-emerald-600 hover:bg-emerald-700 text-white"
                                          }`}
                                          title={
                                            isPending
                                              ? "Esperando autorización de Dirección para confirmar subida"
                                              : "Guardar / Confirmar subida"
                                          }
                                        >
                                          {savingReportId === report.id ? (
                                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                          ) : (
                                            <IconCheck className="w-4 h-4" />
                                          )}
                                        </button>

                                        {/* Eliminar semana */}
                                        <button
                                          onClick={() => handleDeleteReport(report)}
                                          disabled={deletingReportId === report.id}
                                          className="p-2 bg-red-50/50 hover:bg-red-100 text-red-600 rounded-lg transition-colors flex items-center justify-center disabled:opacity-50"
                                          title="Eliminar semana"
                                        >
                                          {deletingReportId === report.id ? (
                                            <div className="w-4 h-4 border-2 border-red-600 border-t-transparent rounded-full animate-spin" />
                                          ) : (
                                            <IconTrash className="w-4 h-4" />
                                          )}
                                        </button>
                                      </div>
                                    </td>
                                  )}
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </>
              )}
            </>
          ) : null}

          {/* Estado vacío inicial */}
          {!selectedStoreId && !loadingStores && (
            <div className="text-center py-20">
              <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
                <IconChartBar className="w-8 h-8 text-gray-400" />
              </div>
              <h2 className="text-xl font-semibold text-gray-700">Selecciona una obra</h2>
              <p className="text-gray-400 mt-2 text-sm">
                Elige el Centro de Costos para ver o cargar su presupuesto de insumos.
              </p>
            </div>
          )}
        </div>
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
                  Obra: <strong className="text-gray-800">{confirmModal.report.store_name || selectedStore?.name}</strong>
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
    </>
  );
}
