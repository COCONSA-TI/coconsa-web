"use client";

import { useState, useEffect, useCallback } from "react";
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
  useAuth();

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

  const [pendingFile, setPendingFile] = useState<File | null>(null);
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
  }, [selectedStoreId, fetchSummary, fetchInsumos]);

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
      setUploadSuccess(
        `Presupuesto cargado correctamente — ${data.resumen.totalInsumos} insumos · ${formatCurrency(data.resumen.totalReporte)} total`
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
    const cat_insumos = insumos.filter((i) => i.categoria === cat);
    const presup = cat_insumos.reduce((a, i) => a + i.monto_presupuestado, 0);
    if (presup === 0) return 0;
    const solicitado = cat_insumos.reduce((a, i) => a + i.costo_unitario * i.cantidad_solicitada, 0);
    return Math.min(100, (solicitado / presup) * 100);
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

          {/* Selector de Obra */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
            <label className="block text-sm font-semibold text-gray-700 mb-2">
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
                className="w-full max-w-md px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 bg-white"
              >
                <option value="">Selecciona una obra...</option>
                {stores.map((store) => (
                  <option key={store.id} value={store.id}>{store.name}</option>
                ))}
              </select>
            )}
          </div>

          {selectedStoreId && (
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
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                  {[...Array(4)].map((_, i) => (
                    <div key={i} className="h-36 bg-white rounded-xl shadow-sm border border-gray-200 animate-pulse" />
                  ))}
                </div>
              ) : summary?.hasPresupuesto ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
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
                            <th className="px-4 py-3 text-left">Clave</th>
                            <th className="px-4 py-3 text-left">Descripción</th>
                            <th className="px-4 py-3 text-center">Unidad</th>
                            <th className="px-4 py-3 text-right">Cantidad Presup.</th>
                            <th className="px-4 py-3 text-right">Costo Unit.</th>
                            <th className="px-4 py-3 text-right">Monto Presup.</th>
                            <th className="px-4 py-3 text-right">Solicitado</th>
                            <th className="px-4 py-3 text-right">Disponible</th>
                            <th className="px-4 py-3 text-right">Disp. Unidades</th>
                            <th className="px-4 py-3 text-center">Categoría</th>
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
                                <td className="px-4 py-3 font-mono text-xs font-semibold text-gray-700">
                                  {insumo.clave}
                                </td>
                                <td className="px-4 py-3 text-gray-700 max-w-xs">
                                  <p className="line-clamp-2">{insumo.descripcion}</p>
                                </td>
                                <td className="px-4 py-3 text-center text-gray-500 uppercase text-xs font-medium">
                                  {insumo.unidad}
                                </td>
                                <td className="px-4 py-3 text-right text-gray-700 tabular-nums">
                                  {insumo.cantidad_presupuestada.toLocaleString("es-MX", { maximumFractionDigits: 3 })}
                                </td>
                                <td className="px-4 py-3 text-right text-gray-700 tabular-nums">
                                  {formatCurrency(insumo.costo_unitario)}
                                </td>
                                <td className="px-4 py-3 text-right font-semibold text-gray-900 tabular-nums">
                                  {formatCurrency(insumo.monto_presupuestado)}
                                </td>
                                <td className="px-4 py-3 text-right tabular-nums">
                                  <span className={`font-medium ${insumo.cantidad_solicitada > 0 ? "text-orange-600" : "text-gray-400"}`}>
                                    {insumo.cantidad_solicitada.toLocaleString("es-MX", { maximumFractionDigits: 3 })}
                                  </span>
                                  {insumo.cantidad_presupuestada > 0 && (
                                    <div className="mt-1 h-1 bg-gray-100 rounded-full overflow-hidden w-16 ml-auto">
                                      <div
                                        className={`h-full rounded-full ${pct >= 100 ? "bg-red-500" : pct >= 75 ? "bg-amber-400" : "bg-green-400"}`}
                                        style={{ width: `${Math.min(100, pct)}%` }}
                                      />
                                    </div>
                                  )}
                                </td>
                                <td className="px-4 py-3 text-right tabular-nums">
                                  <span className={`font-semibold ${insumo.agotado ? "text-red-600"
                                    : insumo.cantidad_disponible < insumo.cantidad_presupuestada * 0.2 ? "text-amber-600"
                                      : "text-green-600"
                                    }`}>
                                    {insumo.cantidad_disponible.toLocaleString("es-MX", { maximumFractionDigits: 3 })}
                                  </span>
                                </td>
                                <td className="px-4 py-3 text-right tabular-nums">
                                  <span className="font-semibold text-gray-700">
                                    {insumo.costo_unitario > 0
                                      ? (insumo.cantidad_disponible / insumo.costo_unitario).toLocaleString("es-MX", { maximumFractionDigits: 2 })
                                      : "—"
                                    }
                                  </span>
                                  <span className="text-xs text-gray-400 ml-1 lowercase">
                                    {insumo.unidad}
                                  </span>
                                </td>
                                <td className="px-4 py-3 text-center">
                                  <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${cfg.badge}`}>
                                    {cfg.icon}
                                    <span>{insumo.categoria}</span>
                                  </span>
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
                    <div className="px-6 py-3 bg-gray-50 border-t border-gray-200 flex justify-between items-center text-sm">
                      <span className="text-gray-500">{insumos.length} insumos mostrados</span>
                      <span className="font-semibold text-gray-900 tabular-nums">
                        Total presupuestado:{" "}
                        {formatCurrency(insumos.reduce((a, i) => a + i.monto_presupuestado, 0))}
                      </span>
                    </div>
                  )}
                </div>
              )}
            </>
          )}

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
    </>
  );
}
