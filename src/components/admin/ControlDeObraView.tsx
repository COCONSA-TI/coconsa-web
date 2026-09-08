"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type {
  ControlObraCalculatedReport,
  ControlObraSummary,
  ControlObraSettings,
  AIAssistantMessage,
} from "@/types/database";

interface ControlDeObraViewProps {
  storeId: number;
  storeName: string;
  canEdit: boolean;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(amount || 0);
}

function formatPercent(value: number): string {
  return (value || 0).toFixed(2) + "%";
}

function formatDate(dateStr: string): string {
  if (!dateStr) return "—";
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("es-MX", { day: "2-digit", month: "short" });
}

export default function ControlDeObraView({ storeId, storeName, canEdit }: ControlDeObraViewProps) {
  const [reports, setReports] = useState<ControlObraCalculatedReport[]>([]);
  const [summary, setSummary] = useState<ControlObraSummary | null>(null);
  const [settings, setSettings] = useState<ControlObraSettings>({
    pct_indirecto_campo: 4.33,
    pct_indirecto_oficina: 3.00,
  });

  const [loading, setLoading] = useState(true);
  const [syncingSystem, setSyncingSystem] = useState(false);
  const [savingWeekId, setSavingWeekId] = useState<number | string | null>(null);
  const [deletingWeekId, setDeletingWeekId] = useState<number | null>(null);

  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const [viewMode, setViewMode] = useState<"table" | "cards">("table");

  const [editingReport, setEditingReport] = useState<ControlObraCalculatedReport | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [loadingCatalogoAutofill, setLoadingCatalogoAutofill] = useState(false);

  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [tempPctCampo, setTempPctCampo] = useState(4.33);
  const [tempPctOficina, setTempPctOficina] = useState(3.00);
  const [savingSettings, setSavingSettings] = useState(false);

  const [parsingFile, setParsingFile] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [aiHistory, setAiHistory] = useState<AIAssistantMessage[]>([]);
  const [aiInput, setAiInput] = useState("");
  const [aiLoading, setAiLoading] = useState(false);

  const fetchControlObraData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/stores/${storeId}/control-obra`);
      if (!res.ok) throw new Error("Error al obtener datos de Control de Obra");
      const data = await res.json();
      setReports(data.reports || []);
      setSummary(data.summary || null);
      if (data.settings) {
        setSettings(data.settings);
        setTempPctCampo(data.settings.pct_indirecto_campo);
        setTempPctOficina(data.settings.pct_indirecto_oficina);
      }
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "Error al cargar datos");
    } finally {
      setLoading(false);
    }
  }, [storeId]);

  useEffect(() => {
    fetchControlObraData();
  }, [fetchControlObraData]);

  const handleAutoSyncSystem = async () => {
    setSyncingSystem(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const res = await fetch(`/api/v1/stores/${storeId}/control-obra/auto-sync`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al auto-sincronizar con el sistema");
      setSuccessMsg(data.message || "Gastos del sistema sincronizados con éxito.");
      await fetchControlObraData();
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "Error en auto-sincronización");
    } finally {
      setSyncingSystem(false);
    }
  };

  const handleFileUploadAI = async (file: File) => {
    if (!file) return;
    setParsingFile(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch(`/api/v1/stores/${storeId}/control-obra/parse-excel`, {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al procesar el archivo con IA");

      const ext = data.extractedData;
      if (!ext) throw new Error("No se pudieron extraer datos del archivo");

      const nextSemanaNum = ext.semana_numero || (reports.length > 0 ? Math.max(...reports.map((r) => r.semana_numero)) + 1 : 1);

      const newTempReport: ControlObraCalculatedReport & { isTemp?: boolean } = {
        id: Date.now(),
        store_id: storeId,
        semana_numero: nextSemanaNum,
        fecha_inicio: ext.fecha_inicio || new Date().toISOString().split("T")[0],
        fecha_fin: ext.fecha_fin || new Date().toISOString().split("T")[0],
        importe_generado: Number(ext.importe_generado || 0),
        egreso_maquinaria_equipo: Number(ext.egreso_maquinaria_equipo || 0),
        egreso_nomina_directa: Number(ext.egreso_nomina_directa || 0),
        egreso_seguro_nomina_directa: Number(ext.egreso_seguro_nomina_directa || 0),
        egreso_destajos: Number(ext.egreso_destajos || 0),
        egreso_materiales: Number(ext.egreso_materiales || 0),
        egreso_diesel: Number(ext.egreso_diesel || 0),
        egreso_nomina_indirecta: Number(ext.egreso_nomina_indirecta || 0),
        egreso_seguro_nomina_indirecta: Number(ext.egreso_seguro_nomina_indirecta || 0),
        egreso_gastos_indirectos: Number(ext.egreso_gastos_indirectos || 0),
        pct_indirecto_campo: settings.pct_indirecto_campo,
        pct_indirecto_oficina: settings.pct_indirecto_oficina,
        pct_avance_programa: Number(ext.pct_avance_programa || 0),
        comments: ext.comments || "Extraído automáticamente desde archivo",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        isTemp: true,
        total_egresos_directos: 0,
        total_egresos_indirectos: 0,
        monto_indirecto_campo: 0,
        monto_indirecto_oficina: 0,
        total_egresos: 0,
        importe_utilidad: 0,
        pct_utilidad: 0,
      };

      recalculateTotals(newTempReport);
      setReports((prev) => [...prev, newTempReport]);
      setSuccessMsg(`Datos extraídos con éxito desde "${file.name}" para la Semana ${nextSemanaNum}.`);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "Error al procesar el archivo");
    } finally {
      setParsingFile(false);
    }
  };

  const recalculateTotals = (r: ControlObraCalculatedReport) => {
    const directos =
      Number(r.egreso_maquinaria_equipo || 0) +
      Number(r.egreso_nomina_directa || 0) +
      Number(r.egreso_seguro_nomina_directa || 0) +
      Number(r.egreso_destajos || 0) +
      Number(r.egreso_materiales || 0) +
      Number(r.egreso_diesel || 0);

    const indirectosBase =
      Number(r.egreso_nomina_indirecta || 0) +
      Number(r.egreso_seguro_nomina_indirecta || 0) +
      Number(r.egreso_gastos_indirectos || 0);

    const gen = Number(r.importe_generado || 0);

    // Porcentaje de campo: (Nómina Indirecta + Seguro Indirecto + Gastos Indirectos) / Importe Generado
    const pctCampo = gen > 0 ? (indirectosBase / gen) * 100 : 0;
    const montoOficina = gen * (Number(r.pct_indirecto_oficina || 3.00) / 100);

    const totalEgresos = directos + indirectosBase + montoOficina;
    const utilidad = gen - totalEgresos;
    const pctUtil = gen > 0 ? (utilidad / gen) * 100 : 0;

    r.pct_indirecto_campo = pctCampo;
    r.total_egresos_directos = directos;
    r.total_egresos_indirectos = indirectosBase;
    r.monto_indirecto_campo = indirectosBase;
    r.monto_indirecto_oficina = montoOficina;
    r.total_egresos = totalEgresos;
    r.importe_utilidad = utilidad;
    r.pct_utilidad = pctUtil;
  };

  const handleAutofillFromCatalogo = async (semanaNum: number, currentReport?: ControlObraCalculatedReport) => {
    const targetReport = currentReport || editingReport;
    if (!targetReport) return;

    setLoadingCatalogoAutofill(true);
    setErrorMsg(null);
    try {
      const res = await fetch(`/api/v1/stores/${storeId}/catalogo-avances`);
      if (!res.ok) throw new Error("Error al consultar Catálogo de Avances");
      const data = await res.json();

      const conceptsList = data.concepts || [];
      const summaryData = data.summary || {};

      let importeSemana = 0;
      let acumuladoHastaSemana = 0;
      let presupuestoTotal = Number(summaryData.presupuesto_total || 0);

      if (presupuestoTotal === 0 && conceptsList.length > 0) {
        presupuestoTotal = conceptsList.reduce(
          (sum: number, c: any) => sum + (Number(c.importe_presupuestado) || (Number(c.cantidad_presupuestada || 0) * Number(c.precio_unitario || 0))),
          0
        );
      }

      conceptsList.forEach((c: any) => {
        const pu = Number(c.precio_unitario || 0);
        const semanasObj = c.semanas || {};

        // 1. Obtener datos de la semana seleccionada (ej. 1, "1", "01", "Semana 01")
        const padSemKey = semanaNum < 10 ? `0${semanaNum}` : String(semanaNum);
        const semData =
          semanasObj[semanaNum] ||
          semanasObj[String(semanaNum)] ||
          semanasObj[padSemKey] ||
          semanasObj[`Semana ${semanaNum}`] ||
          semanasObj[`Semana ${padSemKey}`];

        if (semData) {
          const cantEjec = Number(semData.cantidad_ejecutada ?? semData.cantidad ?? 0);
          const impEjec = semData.importe_ejecutado !== undefined && semData.importe_ejecutado !== null
            ? Number(semData.importe_ejecutado)
            : cantEjec * pu;
          importeSemana += impEjec;
        }

        // 2. Obtener acumulado de avance hasta la semana seleccionada
        Object.entries(semanasObj).forEach(([wKey, wVal]: [string, any]) => {
          const wNum = parseInt(wKey.replace(/\D/g, ""), 10) || parseInt(wKey, 10);
          if (!isNaN(wNum) && wNum <= semanaNum) {
            const cantEjec = Number(wVal?.cantidad_ejecutada ?? wVal?.cantidad ?? 0);
            const impEjec = wVal?.importe_ejecutado !== undefined && wVal?.importe_ejecutado !== null
              ? Number(wVal.importe_ejecutado)
              : cantEjec * pu;
            acumuladoHastaSemana += impEjec;
          }
        });
      });

      // Si no hay ejecuciones específicas en esa semana pero hay acumulado global
      if (acumuladoHastaSemana === 0 && Number(summaryData.total_acumulado_ejecutado || 0) > 0) {
        acumuladoHastaSemana = Number(summaryData.total_acumulado_ejecutado);
      }

      const pctAvance = presupuestoTotal > 0 ? (acumuladoHastaSemana / presupuestoTotal) * 100 : 0;
      const finalImporte = Number(importeSemana.toFixed(2));
      const finalPct = Number(pctAvance.toFixed(2));

      // 3. Obtener egresos de Materiales, Diesel y Destajos desde Órdenes de Compra para esta obra
      try {
        const syncRes = await fetch(`/api/v1/stores/${storeId}/control-obra/auto-sync`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fecha_inicio: targetReport.fecha_inicio,
            fecha_fin: targetReport.fecha_fin,
          }),
        });
        if (syncRes.ok) {
          const syncData = await syncRes.json();
          if (syncData.weekCalculation) {
            targetReport.egreso_materiales = syncData.weekCalculation.egreso_materiales ?? targetReport.egreso_materiales ?? 0;
            targetReport.egreso_diesel = syncData.weekCalculation.egreso_diesel ?? targetReport.egreso_diesel ?? 0;
            targetReport.egreso_destajos = syncData.weekCalculation.egreso_destajos ?? targetReport.egreso_destajos ?? 0;
          } else {
            const freshDataRes = await fetch(`/api/v1/stores/${storeId}/control-obra`);
            if (freshDataRes.ok) {
              const freshData = await freshDataRes.json();
              const freshReport = (freshData.reports || []).find((r: any) => r.semana_numero === semanaNum);
              if (freshReport) {
                targetReport.egreso_materiales = freshReport.egreso_materiales ?? targetReport.egreso_materiales ?? 0;
                targetReport.egreso_diesel = freshReport.egreso_diesel ?? targetReport.egreso_diesel ?? 0;
                targetReport.egreso_destajos = freshReport.egreso_destajos ?? targetReport.egreso_destajos ?? 0;
              }
            }
          }
        }
      } catch {
        // Si no hay órdenes registradas, se conservan los valores existentes
      }

      const updated = {
        ...targetReport,
        importe_generado: finalImporte,
        pct_avance_programa: finalPct,
      };

      recalculateTotals(updated);
      setEditingReport(updated);

      setSuccessMsg(`Datos autocompletados para la Obra: Importe Generado ($${finalImporte.toLocaleString("es-MX")}), Avance (${finalPct.toFixed(2)}%), Materiales, Diesel y Destajos desde Órdenes de Compra.`);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "No se pudieron obtener datos del Catálogo de Avances y Órdenes de Compra");
    } finally {
      setLoadingCatalogoAutofill(false);
    }
  };

  const handleAddWeek = () => {
    const nextSemanaNum = reports.length > 0 ? Math.max(...reports.map((r) => r.semana_numero)) + 1 : 1;

    const today = new Date();
    const day = today.getDay(); // 0: Sun, 1: Mon, 2: Tue, 3: Wed, 4: Thu, 5: Fri, 6: Sat
    const diffToThu = today.getDate() - day + (day < 4 ? -3 : 4); // Jueves
    const thursday = new Date(today.setDate(diffToThu));
    const wednesday = new Date(thursday);
    wednesday.setDate(thursday.getDate() + 6); // Miércoles (+6 días)

    const newTempReport: ControlObraCalculatedReport & { isTemp?: boolean } = {
      id: Date.now(),
      store_id: storeId,
      semana_numero: nextSemanaNum,
      fecha_inicio: thursday.toISOString().split("T")[0],
      fecha_fin: wednesday.toISOString().split("T")[0],
      importe_generado: 0,
      egreso_maquinaria_equipo: 0,
      egreso_nomina_directa: 0,
      egreso_seguro_nomina_directa: 0,
      egreso_destajos: 0,
      egreso_materiales: 0,
      egreso_diesel: 0,
      egreso_nomina_indirecta: 0,
      egreso_seguro_nomina_indirecta: 0,
      egreso_gastos_indirectos: 0,
      pct_indirecto_campo: settings.pct_indirecto_campo,
      pct_indirecto_oficina: settings.pct_indirecto_oficina,
      pct_avance_programa: 0,
      comments: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      isTemp: true,
      total_egresos_directos: 0,
      total_egresos_indirectos: 0,
      monto_indirecto_campo: 0,
      monto_indirecto_oficina: 0,
      total_egresos: 0,
      importe_utilidad: 0,
      pct_utilidad: 0,
    };

    recalculateTotals(newTempReport);
    setEditingReport(newTempReport);
    setShowEditModal(true);

    // Auto-completar importe_generado y pct_avance_programa desde Catálogo de Avances
    handleAutofillFromCatalogo(nextSemanaNum, newTempReport);
  };

  const openEditModal = (report: ControlObraCalculatedReport) => {
    setEditingReport({ ...report });
    setShowEditModal(true);
  };

  const handleSaveWeek = async (reportToSave?: ControlObraCalculatedReport) => {
    const report = reportToSave || editingReport;
    if (!report) return;

    setSavingWeekId(report.id);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      recalculateTotals(report);
      const res = await fetch(`/api/v1/stores/${storeId}/control-obra`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          semana_numero: report.semana_numero,
          fecha_inicio: report.fecha_inicio,
          fecha_fin: report.fecha_fin,
          importe_generado: report.importe_generado,
          egreso_maquinaria_equipo: report.egreso_maquinaria_equipo,
          egreso_nomina_directa: report.egreso_nomina_directa,
          egreso_seguro_nomina_directa: report.egreso_seguro_nomina_directa,
          egreso_destajos: report.egreso_destajos,
          egreso_materiales: report.egreso_materiales,
          egreso_diesel: report.egreso_diesel,
          egreso_nomina_indirecta: report.egreso_nomina_indirecta,
          egreso_seguro_nomina_indirecta: report.egreso_seguro_nomina_indirecta,
          egreso_gastos_indirectos: report.egreso_gastos_indirectos,
          pct_indirecto_campo: report.pct_indirecto_campo,
          pct_indirecto_oficina: report.pct_indirecto_oficina,
          pct_avance_programa: report.pct_avance_programa,
          comments: report.comments,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al guardar la semana");

      setSuccessMsg(`Semana ${report.semana_numero} guardada con éxito.`);
      setShowEditModal(false);
      await fetchControlObraData();
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "Error al guardar");
    } finally {
      setSavingWeekId(null);
    }
  };

  const handleDeleteWeek = async (report: ControlObraCalculatedReport & { isTemp?: boolean }) => {
    if (report.isTemp) {
      setReports((prev) => prev.filter((r) => r.id !== report.id));
      setShowEditModal(false);
      return;
    }
    if (!confirm(`¿Eliminar los datos registrados para la Semana ${report.semana_numero}?`)) return;
    setDeletingWeekId(report.id);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const res = await fetch(`/api/v1/stores/${storeId}/control-obra?reportId=${report.id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al eliminar semana");
      setSuccessMsg(`Semana ${report.semana_numero} eliminada.`);
      setShowEditModal(false);
      await fetchControlObraData();
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "Error al eliminar");
    } finally {
      setDeletingWeekId(null);
    }
  };

  const handleSaveSettings = async () => {
    setSavingSettings(true);
    setErrorMsg(null);
    try {
      const res = await fetch(`/api/v1/stores/${storeId}/control-obra`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pct_indirecto_campo: tempPctCampo,
          pct_indirecto_oficina: tempPctOficina,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al actualizar configuración");
      setSettings({
        pct_indirecto_campo: tempPctCampo,
        pct_indirecto_oficina: tempPctOficina,
      });
      setShowSettingsModal(false);
      setSuccessMsg("Porcentajes de indirectos actualizados correctamente.");
      await fetchControlObraData();
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "Error al guardar configuración");
    } finally {
      setSavingSettings(false);
    }
  };

  const handleAskAI = async (promptText?: string) => {
    const query = promptText || aiInput;
    if (!query.trim() || aiLoading) return;

    const userMessage: AIAssistantMessage = {
      id: "usr-" + Date.now(),
      role: "user",
      content: query,
      timestamp: new Date().toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" }),
    };

    setAiHistory((prev) => [...prev, userMessage]);
    if (!promptText) setAiInput("");
    setAiLoading(true);

    try {
      const res = await fetch(`/api/v1/stores/${storeId}/control-obra/ai-assistant`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userPrompt: query }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error en la respuesta de la IA");

      const aiResponseMsg: AIAssistantMessage = {
        id: "ai-" + Date.now(),
        role: "assistant",
        content: data.message,
        suggestedQuestions: data.suggestedQuestions,
        timestamp: new Date().toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" }),
      };
      setAiHistory((prev) => [...prev, aiResponseMsg]);
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : "Error al comunicarse con la IA";
      setAiHistory((prev) => [
        ...prev,
        {
          id: "ai-err-" + Date.now(),
          role: "assistant",
          content: `Error: ${errMsg}`,
          timestamp: new Date().toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" }),
        },
      ]);
    } finally {
      setAiLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="p-12 text-center bg-white rounded-2xl shadow-sm border border-slate-200">
        <div className="inline-block w-8 h-8 border-3 border-[#C8102E] border-t-transparent rounded-full animate-spin mb-3" />
        <p className="text-sm text-slate-500 font-medium">Cargando módulo de Control de Obra COCONSA...</p>
      </div>
    );
  }

  const totalGen = summary?.total_generado || 0;
  const totalEg = summary?.total_egresos || 0;
  const totalUtil = summary?.total_utilidad || 0;
  const maxValHorizontal = Math.max(totalGen, totalEg, Math.abs(totalUtil), 1000);

  return (
    <div className="space-y-6">
      {errorMsg && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm flex justify-between items-center">
          <span>{errorMsg}</span>
          <button onClick={() => setErrorMsg(null)} className="text-red-500 font-bold hover:text-red-800">✕</button>
        </div>
      )}
      {successMsg && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm flex justify-between items-center">
          <span>{successMsg}</span>
          <button onClick={() => setSuccessMsg(null)} className="text-emerald-500 font-bold hover:text-emerald-800">✕</button>
        </div>
      )}

      {/* ENCABEZADO CLARO (BLANCO Y ROJO COCONSA) */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-100 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-extrabold text-slate-900">Control Financiero de Obra</h2>
              <span className="px-3 py-1 rounded-lg text-xs font-extrabold bg-rose-50 text-[#C8102E] border border-rose-200">
                {storeName}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Monitoreo semanal ejecutivo de ingresos, egresos directos/indirectos y margen de utilidad.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Selector de modo de vista */}
            <div className="flex bg-slate-100 p-1 rounded-xl gap-1 text-xs font-semibold">
              <button
                onClick={() => setViewMode("table")}
                className={`px-3.5 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                  viewMode === "table" ? "bg-[#C8102E] text-white shadow-sm font-bold" : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                Tabla Ejecutiva
              </button>
              <button
                onClick={() => setViewMode("cards")}
                className={`px-3.5 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                  viewMode === "cards" ? "bg-[#C8102E] text-white shadow-sm font-bold" : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
                Tarjetas Móviles
              </button>
            </div>

            <button
              onClick={() => setShowSettingsModal(true)}
              className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-colors flex items-center gap-1.5"
            >
              <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              Indirectos ({settings.pct_indirecto_campo}% | {settings.pct_indirecto_oficina}%)
            </button>

            {canEdit && (
              <>
                <button
                  onClick={handleAutoSyncSystem}
                  disabled={syncingSystem}
                  className="px-3.5 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-semibold shadow-sm transition-colors flex items-center gap-1.5 disabled:opacity-50"
                  title="Calcula automáticamente los gastos de órdenes de compra e insumos del sistema"
                >
                  {syncingSystem ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Calculando...
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4 text-rose-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      Auto-Calcular con Sistema
                    </>
                  )}
                </button>

                <input
                  type="file"
                  ref={fileInputRef}
                  accept=".xlsx,.xls,.csv,.pdf"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleFileUploadAI(file);
                  }}
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={parsingFile}
                  className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold shadow-sm transition-colors flex items-center gap-1.5 disabled:opacity-50"
                >
                  {parsingFile ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Procesando IA...
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                      </svg>
                      Subir Excel / PDF
                    </>
                  )}
                </button>

                <button
                  onClick={handleAddWeek}
                  className="px-4 py-2 bg-[#C8102E] hover:bg-[#a00d24] text-white rounded-xl text-xs font-semibold shadow-sm transition-colors flex items-center gap-1.5"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Capturar Semana
                </button>
              </>
            )}
          </div>
        </div>

        {/* GRÁFICA HORIZONTAL CLARA (BLANCA CON DETALLES ROJOS Y VERDES) */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-4 border-b border-slate-100 pb-3">
            <div>
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Resumen Ejecutivo Acumulado — Obra "{storeName}"</h3>
              <p className="text-[11px] text-slate-500 mt-0.5">Totales consolidados de la obra en tiempo real</p>
            </div>
            <div className="flex gap-4 text-xs font-mono font-bold text-gray-900">
              <div className="text-gray-900">GENERADO: <span className="text-[#C8102E] font-black">{formatCurrency(totalGen)}</span></div>
              <div className="text-gray-900">EGRESOS: <span className="text-slate-900 font-black">{formatCurrency(totalEg)}</span></div>
              <div className="text-gray-900">UTILIDAD: <span className={totalUtil >= 0 ? "text-emerald-700 font-black" : "text-red-600 font-black"}>{formatCurrency(totalUtil)} ({formatPercent(summary?.pct_utilidad_global || 0)})</span></div>
            </div>
          </div>

          <div className="space-y-3 font-mono text-xs">
            {/* Fila UTILIDAD */}
            <div className="flex items-center gap-3">
              <span className="w-24 text-right font-black text-gray-900 text-[11px]">UTILIDAD</span>
              <div className="flex-1 bg-slate-100 rounded-lg h-8 overflow-hidden relative flex items-center p-0.5 border border-slate-200">
                <div
                  className={`h-full transition-all duration-500 rounded-md flex items-center justify-end pr-3 ${
                    totalUtil >= 0 ? "bg-emerald-600" : "bg-red-600"
                  }`}
                  style={{ width: `${Math.max(3, (Math.abs(totalUtil) / maxValHorizontal) * 100)}%` }}
                >
                  <span className="text-white font-black text-xs drop-shadow-sm tabular-nums">
                    {formatCurrency(totalUtil)}
                  </span>
                </div>
              </div>
            </div>

            {/* Fila EGRESOS */}
            <div className="flex items-center gap-3">
              <span className="w-24 text-right font-black text-gray-900 text-[11px]">EGRESOS</span>
              <div className="flex-1 bg-slate-100 rounded-lg h-8 overflow-hidden relative flex items-center p-0.5 border border-slate-200">
                <div
                  className="bg-slate-600 h-full transition-all duration-500 rounded-md flex items-center justify-end pr-3"
                  style={{ width: `${Math.max(3, (totalEg / maxValHorizontal) * 100)}%` }}
                >
                  <span className="text-white font-black text-xs drop-shadow-sm tabular-nums">
                    {formatCurrency(totalEg)}
                  </span>
                </div>
              </div>
            </div>

            {/* Fila GENERADO */}
            <div className="flex items-center gap-3">
              <span className="w-24 text-right font-black text-gray-900 text-[11px]">GENERADO</span>
              <div className="flex-1 bg-slate-100 rounded-lg h-8 overflow-hidden relative flex items-center p-0.5 border border-slate-200">
                <div
                  className="bg-[#C8102E] h-full transition-all duration-500 rounded-md flex items-center justify-end pr-3"
                  style={{ width: `${Math.max(3, (totalGen / maxValHorizontal) * 100)}%` }}
                >
                  <span className="text-white font-black text-xs drop-shadow-sm tabular-nums">
                    {formatCurrency(totalGen)}
                  </span>
                </div>
              </div>
            </div>

            {/* Eje inferior */}
            <div className="flex justify-between pl-27 pr-2 pt-1 text-[10px] text-gray-900 font-bold font-mono border-t border-slate-200 mt-2">
              <span>$-</span>
              <span>{formatCurrency(maxValHorizontal * 0.25)}</span>
              <span>{formatCurrency(maxValHorizontal * 0.50)}</span>
              <span>{formatCurrency(maxValHorizontal * 0.75)}</span>
              <span>{formatCurrency(maxValHorizontal)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* DROPZONE DE EXCEL / PDF */}
      {canEdit && (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragActive(true);
          }}
          onDragLeave={() => setDragActive(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragActive(false);
            const file = e.dataTransfer.files?.[0];
            if (file) handleFileUploadAI(file);
          }}
          className={`border-2 border-dashed rounded-2xl p-5 text-center transition-all bg-white ${
            dragActive
              ? "border-[#C8102E] bg-rose-50/50 scale-[1.01]"
              : "border-slate-300 hover:border-slate-400"
          }`}
        >
          <div className="w-10 h-10 rounded-full bg-rose-50 text-[#C8102E] flex items-center justify-center mx-auto mb-2">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
          </div>
          <p className="text-xs font-bold text-slate-800">
            Arrastra y suelta tu archivo Excel (.xlsx, .csv) o PDF aquí
          </p>
          <p className="text-[11px] text-slate-500 mt-0.5">
            La Inteligencia Artificial extraerá automáticamente todas las cifras semanales para llenar la plantilla de Control de Obra.
          </p>
        </div>
      )}

      {/* RENDERIZADO SEGÚN MODO DE VISTA (TABLA vs TARJETAS) */}
      {viewMode === "cards" ? (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="font-bold text-slate-800 text-sm uppercase tracking-wide">Tarjetas Semanales de Obra</h3>
            <span className="text-xs text-slate-500 font-medium">{reports.length} semanas registradas</span>
          </div>

          {reports.length === 0 ? (
            <div className="p-8 text-center bg-white rounded-2xl border border-slate-200 text-slate-400 text-xs">
              No hay semanas registradas. Haz clic en "Capturar Semana" para comenzar.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {reports.map((report) => (
                <div key={report.id} className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 space-y-4 hover:border-rose-300 transition-all">
                  <div className="flex justify-between items-start border-b border-slate-100 pb-3">
                    <div>
                      <span className="text-xs font-extrabold text-[#C8102E] bg-rose-50 px-2.5 py-1 rounded-lg border border-rose-200">
                        Semana {report.semana_numero}
                      </span>
                      <p className="text-xs text-slate-500 mt-2 font-medium">
                        {formatDate(report.fecha_inicio)} – {formatDate(report.fecha_fin)}
                      </p>
                    </div>
                    <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                      report.pct_utilidad >= 10 ? "bg-emerald-100 text-emerald-800 border border-emerald-200" : report.pct_utilidad >= 0 ? "bg-amber-100 text-amber-800 border border-amber-200" : "bg-red-100 text-red-800 border border-red-200"
                    }`}>
                      {formatPercent(report.pct_utilidad)} Util.
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-xs font-mono">
                    <div className="bg-rose-50/60 p-2.5 rounded-xl border border-rose-100">
                      <span className="text-[10px] text-[#C8102E] font-sans uppercase font-bold block">Generado</span>
                      <span className="font-bold text-slate-900 tabular-nums">{formatCurrency(report.importe_generado)}</span>
                    </div>
                    <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                      <span className="text-[10px] text-slate-600 font-sans uppercase font-bold block">Egresos Totales</span>
                      <span className="font-bold text-slate-900 tabular-nums">{formatCurrency(report.total_egresos)}</span>
                    </div>
                  </div>

                  <div className="bg-slate-50/80 p-3 rounded-xl space-y-1.5 text-xs font-mono">
                    <div className="flex justify-between text-slate-600 font-sans">
                      <span>Egresos Directos:</span>
                      <span className="font-semibold text-slate-900">{formatCurrency(report.total_egresos_directos)}</span>
                    </div>
                    <div className="flex justify-between text-slate-600 font-sans">
                      <span>Egresos Indirectos:</span>
                      <span className="font-semibold text-slate-900">{formatCurrency(report.total_egresos_indirectos + report.monto_indirecto_campo + report.monto_indirecto_oficina)}</span>
                    </div>
                    <div className="flex justify-between text-slate-700 font-sans border-t border-slate-200 pt-1">
                      <span>Utilidad Bruta:</span>
                      <span className={`font-bold ${report.importe_utilidad >= 0 ? "text-emerald-700" : "text-red-600"}`}>
                        {formatCurrency(report.importe_utilidad)}
                      </span>
                    </div>
                  </div>

                  {canEdit && (
                    <div className="flex gap-2 pt-1 border-t border-slate-100">
                      <button
                        onClick={() => openEditModal(report)}
                        className="flex-1 py-2.5 bg-[#C8102E] hover:bg-[#a00d24] text-white rounded-xl text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 shadow-sm"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                        Editar Datos
                      </button>
                      <button
                        onClick={() => handleDeleteWeek(report)}
                        className="p-2.5 bg-red-50 text-red-600 hover:bg-red-100 rounded-xl transition-colors border border-red-100"
                        title="Eliminar semana"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        /* VISTA TABLA LIMPIA CLARA */
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="px-6 py-4 bg-slate-50 text-slate-800 flex justify-between items-center border-b border-slate-200">
            <div>
              <h3 className="font-bold text-xs uppercase tracking-wider flex items-center gap-2 text-slate-900">
                <svg className="w-4 h-4 text-[#C8102E]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                Desglose Semanal Financiero (Plantilla Ejecutiva COCONSA)
              </h3>
            </div>
            <span className="text-xs text-slate-500 font-mono">Valores en $ MXN</span>
          </div>

          {reports.length === 0 ? (
            <div className="p-12 text-center">
              <svg className="w-12 h-12 text-slate-300 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <p className="text-base font-semibold text-slate-700">No hay semanas registradas</p>
              <p className="text-xs text-slate-400 mt-1 mb-4">Comienza capturando los reportes semanales de la obra o importa tu archivo Excel.</p>
              {canEdit && (
                <button
                  onClick={handleAddWeek}
                  className="px-4 py-2 bg-[#C8102E] hover:bg-[#a00d24] text-white rounded-xl text-sm font-semibold transition-colors inline-flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Agregar Primera Semana
                </button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto relative scrollbar-thin scrollbar-thumb-slate-300">
              <table className="w-full text-xs text-left border-collapse min-w-[1550px]">
                <thead>
                  {/* Fila 1: Grupos de encabezados de categoría */}
                  <tr className="bg-slate-100 text-slate-800 text-[11px] font-bold uppercase tracking-wider text-center border-b border-slate-200">
                    <th className="py-3 px-3 sticky left-0 z-20 bg-slate-100 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] w-20">Semana</th>
                    <th className="py-3 px-3 sticky left-20 z-20 bg-slate-100 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] w-36 border-r border-slate-200">Fechas</th>
                    <th className="py-3 px-3 w-32 bg-rose-100 text-[#C8102E] border-r border-rose-200">INGRESOS</th>
                    <th className="py-3 px-3 bg-slate-100 text-slate-800 border-r border-slate-200" colSpan={7}>EGRESOS DIRECTOS DE OBRA</th>
                    <th className="py-3 px-3 bg-slate-50 text-slate-800 border-r border-slate-200" colSpan={5}>EGRESOS INDIRECTOS Y SOBRECOSTOS</th>
                    <th className="py-3 px-3 w-32 bg-slate-200 text-slate-900 border-r border-slate-300">EGRESOS TOTALES</th>
                    <th className="py-3 px-3 bg-emerald-100 text-emerald-900 border-r border-emerald-200" colSpan={2}>UTILIDAD BRUTA</th>
                    <th className="py-3 px-2 w-20">AVANCE</th>
                    {canEdit && <th className="py-3 px-2 w-24">ACCIONES</th>}
                  </tr>

                  {/* Fila 2: Columnas individuales */}
                  <tr className="bg-slate-50 text-slate-600 text-[10px] font-bold uppercase tracking-wider text-center border-b border-slate-200">
                    <th className="py-2.5 px-2 sticky left-0 z-20 bg-slate-50 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]">#</th>
                    <th className="py-2.5 px-2 sticky left-20 z-20 bg-slate-50 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)] border-r border-slate-200">Inicio – Fin</th>
                    
                    <th className="py-2.5 px-2 text-right bg-rose-50 text-[#C8102E] font-extrabold border-r border-rose-100">Facturado</th>
                    
                    <th className="py-2.5 px-2 text-right">Maq. y Eq.</th>
                    <th className="py-2.5 px-2 text-right">Nóm. Dir.</th>
                    <th className="py-2.5 px-2 text-right">Seg. Nóm.</th>
                    <th className="py-2.5 px-2 text-right">Destajos</th>
                    <th className="py-2.5 px-2 text-right">Materiales</th>
                    <th className="py-2.5 px-2 text-right">Diesel</th>
                    <th className="py-2.5 px-2 text-right font-black bg-slate-100 text-slate-900 border-r border-slate-200">TOTAL E.D.</th>
                    
                    <th className="py-2.5 px-2 text-right">Nóm. Indir.</th>
                    <th className="py-2.5 px-2 text-right">Seg. Indir.</th>
                    <th className="py-2.5 px-2 text-right">Gastos Ind.</th>
                    <th className="py-2.5 px-2 text-right">% Campo</th>
                    <th className="py-2.5 px-2 text-right font-black bg-slate-100 text-slate-900 border-r border-slate-200">TOTAL E.I.</th>
                    
                    <th className="py-2.5 px-2 text-right bg-slate-200 text-slate-950 font-black border-r border-slate-300">TOTAL EG.</th>
                    <th className="py-2.5 px-2 text-right bg-emerald-50 text-emerald-950">Importe $</th>
                    <th className="py-2.5 px-2 text-center bg-emerald-50 text-emerald-950 border-r border-slate-200">% Util</th>
                    <th className="py-2.5 px-2 text-center">% Prog.</th>
                    {canEdit && <th className="py-2.5 px-2 text-center">Acción</th>}
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100 bg-white font-mono text-xs">
                  {reports.map((report) => (
                    <tr key={report.id} className="hover:bg-rose-50/40 transition-colors even:bg-slate-50/30">
                      <td className="p-2.5 text-center font-bold text-slate-900 bg-white sticky left-0 z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]">
                        Sem {report.semana_numero}
                      </td>

                      <td className="p-2 text-center font-semibold text-slate-700 bg-white sticky left-20 z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)] border-r border-slate-200 whitespace-nowrap">
                        {formatDate(report.fecha_inicio)} – {formatDate(report.fecha_fin)}
                      </td>

                      <td className="p-2.5 text-right font-bold text-[#C8102E] bg-rose-50/30 border-r border-slate-200 tabular-nums">
                        {formatCurrency(report.importe_generado)}
                      </td>

                      <td className="p-2.5 text-right text-slate-800 tabular-nums">{formatCurrency(report.egreso_maquinaria_equipo)}</td>
                      <td className="p-2.5 text-right text-slate-800 tabular-nums">{formatCurrency(report.egreso_nomina_directa)}</td>
                      <td className="p-2.5 text-right text-slate-800 tabular-nums">{formatCurrency(report.egreso_seguro_nomina_directa)}</td>
                      <td className="p-2.5 text-right text-slate-800 tabular-nums">{formatCurrency(report.egreso_destajos)}</td>
                      <td className="p-2.5 text-right text-slate-800 tabular-nums">{formatCurrency(report.egreso_materiales)}</td>
                      <td className="p-2.5 text-right text-slate-800 tabular-nums">{formatCurrency(report.egreso_diesel)}</td>
                      
                      <td className="p-2.5 text-right font-bold bg-slate-100 text-slate-900 border-r border-slate-200 tabular-nums">
                        {formatCurrency(report.total_egresos_directos)}
                      </td>

                      <td className="p-2.5 text-right text-slate-800 tabular-nums">{formatCurrency(report.egreso_nomina_indirecta)}</td>
                      <td className="p-2.5 text-right text-slate-800 tabular-nums">{formatCurrency(report.egreso_seguro_nomina_indirecta)}</td>
                      <td className="p-2.5 text-right text-slate-800 tabular-nums">{formatCurrency(report.egreso_gastos_indirectos)}</td>
                      <td className="p-2.5 text-right font-bold text-slate-900 text-[11px] tabular-nums">{formatPercent(report.pct_indirecto_campo)}</td>

                      <td className="p-2.5 text-right font-bold bg-slate-100 text-slate-900 border-r border-slate-200 tabular-nums">
                        {formatCurrency(report.total_egresos_indirectos + report.monto_indirecto_oficina)}
                      </td>

                      <td className="p-2.5 text-right font-black bg-slate-100 text-slate-950 border-r border-slate-300 tabular-nums">
                        {formatCurrency(report.total_egresos)}
                      </td>

                      <td className={`p-2.5 text-right font-bold tabular-nums ${report.importe_utilidad >= 0 ? "text-emerald-700 bg-emerald-50/50" : "text-red-600 bg-red-50/50"}`}>
                        {formatCurrency(report.importe_utilidad)}
                      </td>

                      <td className="p-2.5 text-center font-bold border-r border-slate-200">
                        <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                          report.pct_utilidad >= 10 ? "bg-emerald-100 text-emerald-800 border border-emerald-200" : report.pct_utilidad >= 0 ? "bg-amber-100 text-amber-800 border border-amber-200" : "bg-red-100 text-red-800 border border-red-200"
                        }`}>
                          {formatPercent(report.pct_utilidad)}
                        </span>
                      </td>

                      <td className="p-2.5 text-center font-bold text-slate-800">
                        {formatPercent(report.pct_avance_programa)}
                      </td>

                      {canEdit && (
                        <td className="p-2 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              onClick={() => openEditModal(report)}
                              className="px-2.5 py-1.5 bg-[#C8102E] hover:bg-[#a00d24] text-white rounded-lg text-xs font-semibold transition-colors flex items-center gap-1 shadow-sm"
                              title="Editar datos de la semana"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                              Editar
                            </button>
                            <button
                              onClick={() => handleDeleteWeek(report)}
                              disabled={deletingWeekId === report.id}
                              className="p-1.5 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg transition-colors border border-red-100 disabled:opacity-50"
                              title="Eliminar semana"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ASISTENTE Y ANALISTA FINANCIERO CON FONDO CLARO */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 text-slate-900">
        <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-rose-50 border border-rose-100 flex items-center justify-center text-[#C8102E]">
              <svg className="w-5 h-5 text-[#C8102E]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <div>
              <h3 className="font-bold text-base text-slate-900">Analista Financiero de Obra</h3>
              <p className="text-xs text-slate-500">Consultas en vivo de ingresos, egresos y desviaciones de la obra "{storeName}"</p>
            </div>
          </div>
          <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Datos Conectados en Tiempo Real
          </span>
        </div>

        <div className="flex flex-wrap gap-2 mb-4">
          <span className="text-xs text-slate-500 font-semibold self-center mr-1">Consultas ejecutivas:</span>
          {[
            "¿Cuál es la semana con mejor margen de utilidad?",
            "¿Qué rubro de egresos directos representa el mayor gasto?",
            "Genera un resumen ejecutivo de salud financiera de la obra",
            "¿El margen de utilidad actual cumple con la rentabilidad esperada?",
          ].map((q) => (
            <button
              key={q}
              onClick={() => handleAskAI(q)}
              disabled={aiLoading}
              className="px-3 py-1 rounded-full bg-slate-50 hover:bg-slate-100 border border-slate-200 text-xs text-slate-700 transition-colors disabled:opacity-50 text-left"
            >
              {q}
            </button>
          ))}
        </div>

        <div className="space-y-4 max-h-80 overflow-y-auto pr-2 mb-4 scrollbar-thin scrollbar-thumb-slate-200">
          {aiHistory.length === 0 ? (
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-500 text-center">
              Escribe una consulta o selecciona una opción para generar análisis financiero instantáneo.
            </div>
          ) : (
            aiHistory.map((msg) => (
              <div
                key={msg.id}
                className={`p-4 rounded-xl text-xs leading-relaxed ${
                  msg.role === "user"
                    ? "bg-rose-50 border border-rose-200 text-[#C8102E] ml-8 font-semibold"
                    : "bg-slate-50 border border-slate-200 text-slate-800 mr-4"
                }`}
              >
                <div className="flex justify-between items-center mb-1 text-[10px] text-slate-400 font-semibold">
                  <span className="flex items-center gap-1">
                    {msg.role === "user" ? (
                      <>
                        <svg className="w-3 h-3 text-[#C8102E]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                        Usuario
                      </>
                    ) : (
                      <>
                        <svg className="w-3 h-3 text-[#C8102E]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                        </svg>
                        Analista Financiero de Obra
                      </>
                    )}
                  </span>
                  <span>{msg.timestamp}</span>
                </div>
                <div className="whitespace-pre-wrap font-sans text-xs space-y-1">
                  {msg.content}
                </div>
              </div>
            ))
          )}
          {aiLoading && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-[#C8102E] flex items-center gap-2">
              <div className="w-4 h-4 border-2 border-[#C8102E] border-t-transparent rounded-full animate-spin" />
              <span>Analizando datos financieros de la obra...</span>
            </div>
          )}
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleAskAI();
          }}
          className="flex gap-2"
        >
          <input
            type="text"
            placeholder="Haz una consulta sobre ingresos, egresos o proyección de esta obra..."
            value={aiInput}
            onChange={(e) => setAiInput(e.target.value)}
            disabled={aiLoading}
            className="flex-1 px-4 py-2.5 rounded-xl bg-white border border-slate-300 text-slate-900 placeholder-slate-400 text-xs focus:ring-2 focus:ring-[#C8102E] outline-none"
          />
          <button
            type="submit"
            disabled={aiLoading || !aiInput.trim()}
            className="px-5 py-2.5 bg-[#C8102E] hover:bg-[#a00d24] text-white font-semibold rounded-xl text-xs shadow-md transition-colors disabled:opacity-50 flex items-center gap-1.5"
          >
            <span>Consultar</span>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
            </svg>
          </button>
        </form>
      </div>

      {/* MODAL / DRAWER DE CAPTURA RÁPIDA CON ROJO COCONSA */}
      {showEditModal && editingReport && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-3 overflow-y-auto">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6 space-y-6">
            <div className="flex justify-between items-center border-b border-slate-100 pb-4">
              <div>
                <span className="text-xs font-extrabold text-[#C8102E] uppercase bg-rose-50 px-2.5 py-1 rounded-lg border border-rose-200">
                  Semana #{editingReport.semana_numero}
                </span>
                <h3 className="font-bold text-slate-900 text-lg mt-1">Captura / Edición de Reporte Semanal</h3>
              </div>
              <button
                onClick={() => setShowEditModal(false)}
                className="text-slate-400 hover:text-slate-600 p-2 rounded-full hover:bg-slate-100"
              >
                ✕
              </button>
            </div>

            {/* Formulario dividido en Secciones Táctiles Amplias */}
            <div className="space-y-6">
              {/* Sección 1: Fechas y Período */}
              <div className="bg-rose-50/40 p-4 rounded-2xl border border-rose-100 space-y-3">
                <div className="flex justify-between items-center">
                  <h4 className="text-xs font-bold text-[#C8102E] uppercase tracking-wider flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-[#C8102E] text-white flex items-center justify-center text-[10px]">1</span>
                    Período de Corte (Jueves a Miércoles)
                  </h4>
                  <div className="flex items-center gap-1.5 bg-white px-2.5 py-1 rounded-xl border border-rose-200 shadow-sm">
                    <label className="text-xs font-extrabold text-[#C8102E]">Semana #:</label>
                    <input
                      type="number"
                      min="1"
                      value={editingReport.semana_numero}
                      onChange={(e) => {
                        const semNum = parseInt(e.target.value, 10) || 1;
                        const updated = { ...editingReport, semana_numero: semNum };
                        setEditingReport(updated);
                        handleAutofillFromCatalogo(semNum, updated);
                      }}
                      className="w-14 h-7 px-1 bg-rose-50 border border-rose-300 rounded-lg text-xs font-black text-[#C8102E] text-center outline-none focus:ring-2 focus:ring-[#C8102E]"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Fecha de Inicio (Jueves)</label>
                    <input
                      type="date"
                      value={editingReport.fecha_inicio}
                      onChange={(e) => {
                        const updated = { ...editingReport, fecha_inicio: e.target.value };
                        recalculateTotals(updated);
                        setEditingReport(updated);
                      }}
                      className="w-full h-11 px-3 bg-white border border-slate-300 rounded-xl text-sm font-bold text-slate-900 outline-none focus:ring-2 focus:ring-[#C8102E]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Fecha de Fin (Miércoles)</label>
                    <input
                      type="date"
                      value={editingReport.fecha_fin}
                      onChange={(e) => {
                        const updated = { ...editingReport, fecha_fin: e.target.value };
                        recalculateTotals(updated);
                        setEditingReport(updated);
                      }}
                      className="w-full h-11 px-3 bg-white border border-slate-300 rounded-xl text-sm font-bold text-slate-900 outline-none focus:ring-2 focus:ring-[#C8102E]"
                    />
                  </div>
                </div>
              </div>

              {/* Sección 2: Ingresos y Avance */}
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                  <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-slate-800 text-white flex items-center justify-center text-[10px]">2</span>
                    Ingresos Generados y Avance Físico
                  </h4>
                  <button
                    type="button"
                    onClick={() => handleAutofillFromCatalogo(editingReport.semana_numero)}
                    disabled={loadingCatalogoAutofill}
                    className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-[#C8102E] border border-rose-200 rounded-lg text-[11px] font-bold transition-colors flex items-center gap-1.5 disabled:opacity-50"
                    title="Obtener importe generado y % de avance automáticamente desde el Catálogo de Avances"
                  >
                    {loadingCatalogoAutofill ? (
                      <>
                        <div className="w-3 h-3 border-2 border-[#C8102E] border-t-transparent rounded-full animate-spin" />
                        Obteniendo...
                      </>
                    ) : (
                      <>
                        <svg className="w-3.5 h-3.5 text-[#C8102E]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                        🔄 Traer de Catálogo de Avances
                      </>
                    )}
                  </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Importe Generado ($ MXN)</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      inputMode="decimal"
                      value={editingReport.importe_generado ?? ""}
                      onChange={(e) => {
                        const updated = { ...editingReport, importe_generado: parseFloat(e.target.value) || 0 };
                        recalculateTotals(updated);
                        setEditingReport(updated);
                      }}
                      className="w-full h-11 px-3 bg-white border border-rose-300 rounded-xl text-sm font-extrabold text-[#C8102E] outline-none focus:ring-2 focus:ring-[#C8102E]"
                      placeholder="0.00"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">% Avance del Programa (%)</label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.1"
                      inputMode="decimal"
                      value={editingReport.pct_avance_programa ?? ""}
                      onChange={(e) => {
                        const updated = { ...editingReport, pct_avance_programa: parseFloat(e.target.value) || 0 };
                        recalculateTotals(updated);
                        setEditingReport(updated);
                      }}
                      className="w-full h-11 px-3 bg-white border border-slate-300 rounded-xl text-sm font-bold text-slate-900 outline-none focus:ring-2 focus:ring-[#C8102E]"
                      placeholder="0.0%"
                    />
                  </div>
                </div>

                <p className="text-[11px] text-slate-500 bg-white p-2.5 rounded-xl border border-slate-200 flex items-center gap-1.5">
                  <span className="text-amber-500">💡</span>
                  <span>
                    <strong>Cálculo Automático:</strong> Importe Generado = Suma de importes ejecutados en Semana #{editingReport.semana_numero} del Catálogo de Avances. Avance % = Acumulado total ejecutado ÷ Presupuesto total.
                  </span>
                </p>
              </div>

              {/* Sección 3: Egresos Directos */}
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3">
                <div className="flex justify-between items-center">
                  <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-slate-800 text-white flex items-center justify-center text-[10px]">3</span>
                    Egresos Directos de Obra
                  </h4>
                  <span className="text-xs font-black text-slate-900">
                    Total E.D.: {formatCurrency(editingReport.total_egresos_directos)}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">Maquinaria y Equipo</label>
                    <input
                      type="number"
                      step="0.01"
                      inputMode="decimal"
                      value={editingReport.egreso_maquinaria_equipo || ""}
                      onChange={(e) => {
                        const updated = { ...editingReport, egreso_maquinaria_equipo: parseFloat(e.target.value) || 0 };
                        recalculateTotals(updated);
                        setEditingReport(updated);
                      }}
                      className="w-full h-10 px-3 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-900"
                      placeholder="0.00"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">Nómina Directa</label>
                    <input
                      type="number"
                      step="0.01"
                      inputMode="decimal"
                      value={editingReport.egreso_nomina_directa || ""}
                      onChange={(e) => {
                        const updated = { ...editingReport, egreso_nomina_directa: parseFloat(e.target.value) || 0 };
                        recalculateTotals(updated);
                        setEditingReport(updated);
                      }}
                      className="w-full h-10 px-3 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-900"
                      placeholder="0.00"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">Seguro Nóm. Directa</label>
                    <input
                      type="number"
                      step="0.01"
                      inputMode="decimal"
                      value={editingReport.egreso_seguro_nomina_directa || ""}
                      onChange={(e) => {
                        const updated = { ...editingReport, egreso_seguro_nomina_directa: parseFloat(e.target.value) || 0 };
                        recalculateTotals(updated);
                        setEditingReport(updated);
                      }}
                      className="w-full h-10 px-3 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-900"
                      placeholder="0.00"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1 flex items-center justify-between">
                      <span>Destajos</span>
                      <span className="text-[9px] text-emerald-700 font-bold bg-emerald-50 px-1.5 py-0.5 rounded">Auto Órdenes</span>
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      inputMode="decimal"
                      value={editingReport.egreso_destajos || ""}
                      onChange={(e) => {
                        const updated = { ...editingReport, egreso_destajos: parseFloat(e.target.value) || 0 };
                        recalculateTotals(updated);
                        setEditingReport(updated);
                      }}
                      className="w-full h-10 px-3 bg-white border border-emerald-300 rounded-xl text-xs font-bold text-slate-900 focus:ring-2 focus:ring-emerald-500"
                      placeholder="0.00"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1 flex items-center justify-between">
                      <span>Materiales</span>
                      <span className="text-[9px] text-emerald-700 font-bold bg-emerald-50 px-1.5 py-0.5 rounded">Auto Órdenes</span>
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      inputMode="decimal"
                      value={editingReport.egreso_materiales || ""}
                      onChange={(e) => {
                        const updated = { ...editingReport, egreso_materiales: parseFloat(e.target.value) || 0 };
                        recalculateTotals(updated);
                        setEditingReport(updated);
                      }}
                      className="w-full h-10 px-3 bg-white border border-emerald-300 rounded-xl text-xs font-bold text-slate-900 focus:ring-2 focus:ring-emerald-500"
                      placeholder="0.00"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1 flex items-center justify-between">
                      <span>Diesel</span>
                      <span className="text-[9px] text-emerald-700 font-bold bg-emerald-50 px-1.5 py-0.5 rounded">Auto Órdenes</span>
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      inputMode="decimal"
                      value={editingReport.egreso_diesel || ""}
                      onChange={(e) => {
                        const updated = { ...editingReport, egreso_diesel: parseFloat(e.target.value) || 0 };
                        recalculateTotals(updated);
                        setEditingReport(updated);
                      }}
                      className="w-full h-10 px-3 bg-white border border-emerald-300 rounded-xl text-xs font-bold text-slate-900 focus:ring-2 focus:ring-emerald-500"
                      placeholder="0.00"
                    />
                  </div>
                </div>
              </div>

              {/* Sección 4: Egresos Indirectos */}
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3">
                <div className="flex justify-between items-center">
                  <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-slate-800 text-white flex items-center justify-center text-[10px]">4</span>
                    Egresos Indirectos y Resumen
                  </h4>
                  <span className="text-xs font-black text-slate-900">
                    Total E.I.: {formatCurrency(editingReport.total_egresos_indirectos + editingReport.monto_indirecto_campo + editingReport.monto_indirecto_oficina)}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">Nómina Indirecta</label>
                    <input
                      type="number"
                      step="0.01"
                      inputMode="decimal"
                      value={editingReport.egreso_nomina_indirecta || ""}
                      onChange={(e) => {
                        const updated = { ...editingReport, egreso_nomina_indirecta: parseFloat(e.target.value) || 0 };
                        recalculateTotals(updated);
                        setEditingReport(updated);
                      }}
                      className="w-full h-10 px-3 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-900"
                      placeholder="0.00"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">Seguro Nóm. Indirecta</label>
                    <input
                      type="number"
                      step="0.01"
                      inputMode="decimal"
                      value={editingReport.egreso_seguro_nomina_indirecta || ""}
                      onChange={(e) => {
                        const updated = { ...editingReport, egreso_seguro_nomina_indirecta: parseFloat(e.target.value) || 0 };
                        recalculateTotals(updated);
                        setEditingReport(updated);
                      }}
                      className="w-full h-10 px-3 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-900"
                      placeholder="0.00"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">Gastos Indirectos</label>
                    <input
                      type="number"
                      step="0.01"
                      inputMode="decimal"
                      value={editingReport.egreso_gastos_indirectos || ""}
                      onChange={(e) => {
                        const updated = { ...editingReport, egreso_gastos_indirectos: parseFloat(e.target.value) || 0 };
                        recalculateTotals(updated);
                        setEditingReport(updated);
                      }}
                      className="w-full h-10 px-3 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-900"
                      placeholder="0.00"
                    />
                  </div>
                </div>
              </div>

              {/* Resumen Calculado en Tiempo Real */}
              <div className="bg-slate-100 border border-slate-200 text-slate-900 p-4 rounded-2xl grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                <div>
                  <span className="text-[10px] text-slate-500 block uppercase font-bold">Total Egresos</span>
                  <span className="text-base font-extrabold text-slate-900 tabular-nums">
                    {formatCurrency(editingReport.total_egresos)}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 block uppercase font-bold">Utilidad Bruta</span>
                  <span className={`text-base font-extrabold tabular-nums ${editingReport.importe_utilidad >= 0 ? "text-emerald-700" : "text-red-600"}`}>
                    {formatCurrency(editingReport.importe_utilidad)}
                  </span>
                </div>
                <div className="col-span-2 sm:col-span-1">
                  <span className="text-[10px] text-slate-500 block uppercase font-bold">% Utilidad</span>
                  <span className={`text-base font-extrabold tabular-nums ${editingReport.pct_utilidad >= 10 ? "text-emerald-700" : "text-amber-700"}`}>
                    {formatPercent(editingReport.pct_utilidad)}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 border-t border-slate-100 pt-4">
              <button
                onClick={() => setShowEditModal(false)}
                className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold"
              >
                Cancelar
              </button>
              <button
                onClick={() => handleSaveWeek()}
                disabled={savingWeekId === editingReport.id}
                className="px-6 py-2.5 bg-[#C8102E] hover:bg-[#a00d24] text-white rounded-xl text-xs font-semibold shadow-md transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {savingWeekId === editingReport.id ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Guardando...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Guardar Semana
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL CONFIGURACIÓN DE INDIRECTOS POR OBRA */}
      {showSettingsModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-md p-6 space-y-5">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h3 className="font-bold text-slate-900 text-base">Configuración de Indirectos de la Obra</h3>
              <button onClick={() => setShowSettingsModal(false)} className="text-slate-400 hover:text-slate-600 font-bold">✕</button>
            </div>

            <p className="text-xs text-slate-500">
              Define los porcentajes asignados para el cálculo automático de los Indirectos de Campo y de Oficina en la obra "{storeName}".
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Porcentaje Indirecto de Campo (%)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    value={tempPctCampo}
                    onChange={(e) => setTempPctCampo(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 font-bold pr-8 focus:ring-2 focus:ring-[#C8102E] outline-none"
                  />
                  <span className="absolute right-3 top-2.5 text-xs text-slate-400 font-bold">%</span>
                </div>
                <span className="text-[10px] text-slate-400 mt-1 block">Se aplica sobre (Egresos Directos + Egresos Indirectos Base).</span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Porcentaje Indirecto de Oficina (%)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    value={tempPctOficina}
                    onChange={(e) => setTempPctOficina(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 font-bold pr-8 focus:ring-2 focus:ring-[#C8102E] outline-none"
                  />
                  <span className="absolute right-3 top-2.5 text-xs text-slate-400 font-bold">%</span>
                </div>
                <span className="text-[10px] text-slate-400 mt-1 block">Se aplica sobre el Importe Generado de la semana.</span>
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
              <button
                onClick={() => setShowSettingsModal(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold"
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveSettings}
                disabled={savingSettings}
                className="px-4 py-2 bg-[#C8102E] hover:bg-[#a00d24] text-white rounded-lg text-xs font-semibold shadow-sm transition-colors disabled:opacity-50"
              >
                {savingSettings ? "Guardando..." : "Guardar Cambios"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
