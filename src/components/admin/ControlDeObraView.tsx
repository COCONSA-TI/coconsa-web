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
  const [savingWeekId, setSavingWeekId] = useState<number | string | null>(null);
  const [deletingWeekId, setDeletingWeekId] = useState<number | null>(null);

  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

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
  const [activeChartTab, setActiveChartTab] = useState<"generado_egresos" | "utilidad" | "desglose" | "avance">("generado_egresos");

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

      const directos =
        newTempReport.egreso_maquinaria_equipo +
        newTempReport.egreso_nomina_directa +
        newTempReport.egreso_seguro_nomina_directa +
        newTempReport.egreso_destajos +
        newTempReport.egreso_materiales +
        newTempReport.egreso_diesel;

      const indirectosBase =
        newTempReport.egreso_nomina_indirecta +
        newTempReport.egreso_seguro_nomina_indirecta +
        newTempReport.egreso_gastos_indirectos;

      const montoCampo = (directos + indirectosBase) * (settings.pct_indirecto_campo / 100);
      const montoOficina = newTempReport.importe_generado * (settings.pct_indirecto_oficina / 100);

      newTempReport.total_egresos_directos = directos;
      newTempReport.total_egresos_indirectos = indirectosBase;
      newTempReport.monto_indirecto_campo = montoCampo;
      newTempReport.monto_indirecto_oficina = montoOficina;
      newTempReport.total_egresos = directos + indirectosBase + montoCampo + montoOficina;
      newTempReport.importe_utilidad = newTempReport.importe_generado - newTempReport.total_egresos;
      newTempReport.pct_utilidad = newTempReport.importe_generado > 0 ? (newTempReport.importe_utilidad / newTempReport.importe_generado) * 100 : 0;

      setReports((prev) => [...prev, newTempReport]);
      setSuccessMsg(`Datos extraídos exitosamente desde "${file.name}" para la Semana ${nextSemanaNum}. Revisa la fila agregada y haz clic en Guardar.`);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "Error al procesar el archivo");
    } finally {
      setParsingFile(false);
    }
  };

  const handleAddWeek = () => {
    const nextSemanaNum = reports.length > 0 ? Math.max(...reports.map((r) => r.semana_numero)) + 1 : 1;

    const today = new Date();
    const day = today.getDay(); // 0: Sun, 1: Mon, 2: Tue, 3: Wed, 4: Thu, 5: Fri, 6: Sat
    const diffToWed = today.getDate() - day + (day < 3 ? -4 : 3); // Miércoles de la semana
    const wednesday = new Date(today.setDate(diffToWed));
    const thursday = new Date(wednesday);
    thursday.setDate(wednesday.getDate() + 8); // Jueves (+8 días)

    const newTempReport: ControlObraCalculatedReport & { isTemp?: boolean } = {
      id: Date.now(),
      store_id: storeId,
      semana_numero: nextSemanaNum,
      fecha_inicio: wednesday.toISOString().split("T")[0],
      fecha_fin: thursday.toISOString().split("T")[0],
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

    setReports((prev) => [...prev, newTempReport]);
  };

  const handleFieldChange = (reportId: number | string, field: string, value: unknown) => {
    setReports((prev) =>
      prev.map((r) => {
        if (r.id !== reportId) return r;
        const updated = { ...r, [field]: value };
        
        const directos =
          Number(updated.egreso_maquinaria_equipo || 0) +
          Number(updated.egreso_nomina_directa || 0) +
          Number(updated.egreso_seguro_nomina_directa || 0) +
          Number(updated.egreso_destajos || 0) +
          Number(updated.egreso_materiales || 0) +
          Number(updated.egreso_diesel || 0);

        const indirectosBase =
          Number(updated.egreso_nomina_indirecta || 0) +
          Number(updated.egreso_seguro_nomina_indirecta || 0) +
          Number(updated.egreso_gastos_indirectos || 0);

        const montoCampo = (directos + indirectosBase) * (Number(updated.pct_indirecto_campo || 4.33) / 100);
        const montoOficina = Number(updated.importe_generado || 0) * (Number(updated.pct_indirecto_oficina || 3.00) / 100);

        const totalEgresos = directos + indirectosBase + montoCampo + montoOficina;
        const utilidad = Number(updated.importe_generado || 0) - totalEgresos;
        const pctUtil = Number(updated.importe_generado || 0) > 0 ? (utilidad / Number(updated.importe_generado)) * 100 : 0;

        return {
          ...updated,
          total_egresos_directos: directos,
          total_egresos_indirectos: indirectosBase,
          monto_indirecto_campo: montoCampo,
          monto_indirecto_oficina: montoOficina,
          total_egresos: totalEgresos,
          importe_utilidad: utilidad,
          pct_utilidad: pctUtil,
        };
      })
    );
  };

  const handleSaveWeek = async (report: ControlObraCalculatedReport) => {
    setSavingWeekId(report.id);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
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
      <div className="p-12 text-center bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="inline-block w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin mb-3" />
        <p className="text-sm text-gray-500 font-medium">Cargando módulo de Control de Obra...</p>
      </div>
    );
  }

  const maxGeneradoOEgreso = Math.max(
    ...(reports.map((r) => Math.max(r.importe_generado, r.total_egresos)) || [10000])
  );

  const totalGen = summary?.total_generado || 0;
  const totalEg = summary?.total_egresos || 0;
  const avanceActual = summary?.ultimo_pct_avance || 0;
  const eacEstimado = avanceActual > 0 ? (totalEg / (avanceActual / 100)) : totalEg;
  const eacDiferencia = totalGen > 0 ? (totalGen - eacEstimado) : 0;

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

      {/* ENCABEZADO Y BARRA SUPERIOR DE INDICADORES ACUMULADOS */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6 border-b border-gray-100 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold text-gray-900">Control Financiero de Obra</h2>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-100 text-indigo-700">
                {storeName}
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Plantilla ejecutiva semanal de seguimiento de ingresos, egresos directos/indirectos y utilidad bruta.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => setShowSettingsModal(true)}
              className="px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5"
            >
              <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              Indirectos: Campo ({settings.pct_indirecto_campo}%) | Oficina ({settings.pct_indirecto_oficina}%)
            </button>

            {canEdit && (
              <>
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
                  className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-sm transition-colors flex items-center gap-1.5 disabled:opacity-50"
                  title="Subir archivo Excel o PDF para autocompletar la semana vía IA"
                >
                  {parsingFile ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Extrayendo con IA...
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                      </svg>
                      Importar Excel / PDF con IA
                    </>
                  )}
                </button>

                <button
                  onClick={handleAddWeek}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-semibold shadow-sm transition-colors flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Agregar Semana
                </button>
              </>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-blue-50/60 border border-blue-100 rounded-xl p-5">
            <span className="text-xs font-semibold text-blue-700 uppercase tracking-wider block mb-1">ACUMULADO GENERADO</span>
            <span className="text-2xl font-bold text-blue-900 tabular-nums">
              {formatCurrency(summary?.total_generado || 0)}
            </span>
            <p className="text-xs text-blue-600 mt-2 font-medium">
              Total Facturado / Estimado ({summary?.semanas_count || 0} semanas)
            </p>
          </div>

          <div className="bg-amber-50/60 border border-amber-100 rounded-xl p-5">
            <span className="text-xs font-semibold text-amber-700 uppercase tracking-wider block mb-1">TOTAL EGRESOS ACUMULADOS</span>
            <span className="text-2xl font-bold text-amber-900 tabular-nums">
              {formatCurrency(summary?.total_egresos || 0)}
            </span>
            <p className="text-xs text-amber-600 mt-2 font-medium">
              Directos: {formatCurrency(summary?.total_egresos_directos || 0)} | Indirectos: {formatCurrency((summary?.total_egresos_indirectos || 0) + (summary?.total_indirectos_campo || 0) + (summary?.total_indirectos_oficina || 0))}
            </p>
          </div>

          <div className="bg-emerald-50/60 border border-emerald-100 rounded-xl p-5">
            <div className="flex justify-between items-center mb-1">
              <span className="text-xs font-semibold text-emerald-700 uppercase tracking-wider">UTILIDAD BRUTA ACUMULADA</span>
              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                {formatPercent(summary?.pct_utilidad_global || 0)}
              </span>
            </div>
            <span className="text-2xl font-bold text-emerald-900 tabular-nums">
              {formatCurrency(summary?.total_utilidad || 0)}
            </span>
            <p className="text-xs text-emerald-600 mt-2 font-medium">
              Avance Físico del Programa: <strong>{formatPercent(summary?.ultimo_pct_avance || 0)}</strong>
            </p>
          </div>
        </div>

        {/* WIDGET DE AUDITORÍA DE COSTOS Y PROYECCIÓN A CIERRE DE OBRA (EAC) */}
        {summary && summary.total_generado > 0 && (
          <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-col justify-between">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                  <svg className="w-4 h-4 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                  Proyección a Cierre de Obra (Forecast EAC)
                </span>
                <span className="text-[11px] font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded">
                  Avance: {formatPercent(avanceActual)}
                </span>
              </div>
              <div className="flex items-baseline gap-3">
                <span className="text-xl font-bold text-slate-900 tabular-nums">
                  {formatCurrency(eacEstimado)}
                </span>
                <span className={`text-xs font-semibold ${eacDiferencia >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                  {eacDiferencia >= 0 ? "Proyección con Utilidad Positiva" : "Riesgo de Margen Negativo"}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 mt-1">
                Costo total proyectado al finalizar la obra manteniendo el ritmo actual de gasto por avance.
              </p>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-col justify-between">
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <svg className="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Auditoría Automática de Costos
              </span>
              <p className="text-xs text-slate-700 font-medium">
                {summary.pct_utilidad_global >= 10
                  ? "La obra presenta una excelente rentabilidad promedio superior al 10% de utilidad bruta."
                  : summary.pct_utilidad_global >= 0
                  ? "La obra opera con utilidad aceptable. Monitorear costos directos de mano de obra y equipo."
                  : "Atención: Los egresos acumulados superan los ingresos generados hasta la fecha."}
              </p>
              <div className="mt-2 text-[11px] text-slate-500">
                Semanas analizadas: <strong>{summary.semanas_count}</strong> | Egresos Directos: <strong>{formatCurrency(summary.total_egresos_directos)}</strong>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ZONA DE ARRASTRE DROPZONE PARA EXCEL / PDF */}
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
          className={`border-2 border-dashed rounded-2xl p-6 text-center transition-all ${
            dragActive
              ? "border-indigo-500 bg-indigo-50/50 scale-[1.01]"
              : "border-gray-300 hover:border-gray-400 bg-gray-50/50"
          }`}
        >
          <div className="w-12 h-12 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto mb-3">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
          </div>
          <p className="text-sm font-bold text-gray-800">
            Arrastra y suelta tu plantilla en Excel (.xlsx, .csv) o PDF aquí
          </p>
          <p className="text-xs text-gray-500 mt-1">
            La Inteligencia Artificial extraerá automáticamente todas las cifras semanales para llenar la plantilla de Control de Obra.
          </p>
        </div>
      )}

      {/* TABLA DE REPORTES FINANCIEROS SEMANALES (EXCEL STYLE) */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 bg-gray-50/80 border-b border-gray-200 flex justify-between items-center">
          <h3 className="font-bold text-gray-800 text-sm uppercase tracking-wide">Desglose Semanal Financiero (Plantilla de Control)</h3>
          <span className="text-xs text-gray-500 font-mono">Valores en $ MXN</span>
        </div>

        {reports.length === 0 ? (
          <div className="p-12 text-center">
            <svg className="w-12 h-12 text-gray-300 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p className="text-base font-semibold text-gray-700">No hay semanas registradas</p>
            <p className="text-xs text-gray-400 mt-1 mb-4">Comienza capturando los reportes semanales de la obra o importa tu archivo Excel.</p>
            {canEdit && (
              <button
                onClick={handleAddWeek}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-semibold transition-colors inline-flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Agregar Primera Semana
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left border-collapse min-w-[1400px]">
              <thead>
                <tr className="bg-gray-800 text-white text-[11px] font-bold uppercase tracking-wider text-center divide-x divide-gray-700">
                  <th className="py-3 px-2 w-20">Semana</th>
                  <th className="py-3 px-2 w-32">Fechas</th>
                  <th className="py-3 px-2 w-28 bg-blue-900/80">Imp. Generado</th>
                  <th className="py-3 px-2 bg-emerald-900/60" colSpan={7}>EGRESOS DIRECTOS</th>
                  <th className="py-3 px-2 bg-purple-900/60" colSpan={5}>EGRESOS INDIRECTOS</th>
                  <th className="py-3 px-2 w-28 bg-amber-900/80">Total Egresos</th>
                  <th className="py-3 px-2 bg-teal-900/80" colSpan={2}>Utilidad Bruta</th>
                  <th className="py-3 px-2 w-20">% Avance</th>
                  {canEdit && <th className="py-3 px-2 w-20">Acciones</th>}
                </tr>
                <tr className="bg-gray-100 text-gray-700 text-[10px] font-bold uppercase tracking-wider text-center divide-x divide-gray-200 border-b border-gray-300">
                  <th className="py-2 px-2">#</th>
                  <th className="py-2 px-2">Inicio - Fin</th>
                  <th className="py-2 px-2 text-right bg-blue-50 text-blue-900">Facturado</th>
                  
                  <th className="py-2 px-1 text-right">Maq. y Eq.</th>
                  <th className="py-2 px-1 text-right">Nóm. Dir.</th>
                  <th className="py-2 px-1 text-right">Seg. Nóm.</th>
                  <th className="py-2 px-1 text-right">Destajos</th>
                  <th className="py-2 px-1 text-right">Materiales</th>
                  <th className="py-2 px-1 text-right">Diesel</th>
                  <th className="py-2 px-1 text-right font-black bg-emerald-100 text-emerald-900">TOTAL E.D.</th>
                  
                  <th className="py-2 px-1 text-right">Nóm. Indir.</th>
                  <th className="py-2 px-1 text-right">Seg. Indir.</th>
                  <th className="py-2 px-1 text-right">Gastos Ind.</th>
                  <th className="py-2 px-1 text-right">% Campo</th>
                  <th className="py-2 px-1 text-right font-black bg-purple-100 text-purple-900">TOTAL E.I.</th>
                  
                  <th className="py-2 px-2 text-right bg-amber-100 text-amber-900 font-black">TOTAL EG.</th>
                  <th className="py-2 px-2 text-right bg-teal-100 text-teal-900">Importe $</th>
                  <th className="py-2 px-2 text-center bg-teal-100 text-teal-900">% Util</th>
                  <th className="py-2 px-2 text-center">Programa</th>
                  {canEdit && <th className="py-2 px-2 text-center">Acción</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white font-mono text-[11px]">
                {reports.map((report) => {
                  return (
                    <tr key={report.id} className="hover:bg-indigo-50/30 transition-colors divide-x divide-gray-100">
                      <td className="p-2 text-center font-bold text-gray-900 bg-gray-50/50">
                        Sem {report.semana_numero}
                      </td>

                      <td className="p-1 text-center">
                        {canEdit ? (
                          <div className="flex flex-col gap-1">
                            <input
                              type="date"
                              value={report.fecha_inicio}
                              onChange={(e) => handleFieldChange(report.id, "fecha_inicio", e.target.value)}
                              className="px-1 py-0.5 border border-gray-300 rounded text-[10px] text-gray-900"
                            />
                            <input
                              type="date"
                              value={report.fecha_fin}
                              onChange={(e) => handleFieldChange(report.id, "fecha_fin", e.target.value)}
                              className="px-1 py-0.5 border border-gray-300 rounded text-[10px] text-gray-900"
                            />
                          </div>
                        ) : (
                          <span className="text-gray-700 text-[10px]">
                            {formatDate(report.fecha_inicio)} - {formatDate(report.fecha_fin)}
                          </span>
                        )}
                      </td>

                      <td className="p-1 text-right bg-blue-50/30">
                        {canEdit ? (
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={report.importe_generado}
                            onChange={(e) => handleFieldChange(report.id, "importe_generado", parseFloat(e.target.value) || 0)}
                            className="w-full px-1 py-1 border border-blue-300 rounded text-right font-bold text-blue-900 bg-white"
                          />
                        ) : (
                          <span className="font-bold text-blue-900">{formatCurrency(report.importe_generado)}</span>
                        )}
                      </td>

                      <td className="p-1 text-right">
                        {canEdit ? (
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={report.egreso_maquinaria_equipo}
                            onChange={(e) => handleFieldChange(report.id, "egreso_maquinaria_equipo", parseFloat(e.target.value) || 0)}
                            className="w-full px-1 py-1 border border-gray-200 rounded text-right text-gray-800"
                          />
                        ) : (
                          formatCurrency(report.egreso_maquinaria_equipo)
                        )}
                      </td>
                      <td className="p-1 text-right">
                        {canEdit ? (
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={report.egreso_nomina_directa}
                            onChange={(e) => handleFieldChange(report.id, "egreso_nomina_directa", parseFloat(e.target.value) || 0)}
                            className="w-full px-1 py-1 border border-gray-200 rounded text-right text-gray-800"
                          />
                        ) : (
                          formatCurrency(report.egreso_nomina_directa)
                        )}
                      </td>
                      <td className="p-1 text-right">
                        {canEdit ? (
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={report.egreso_seguro_nomina_directa}
                            onChange={(e) => handleFieldChange(report.id, "egreso_seguro_nomina_directa", parseFloat(e.target.value) || 0)}
                            className="w-full px-1 py-1 border border-gray-200 rounded text-right text-gray-800"
                          />
                        ) : (
                          formatCurrency(report.egreso_seguro_nomina_directa)
                        )}
                      </td>
                      <td className="p-1 text-right">
                        {canEdit ? (
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={report.egreso_destajos}
                            onChange={(e) => handleFieldChange(report.id, "egreso_destajos", parseFloat(e.target.value) || 0)}
                            className="w-full px-1 py-1 border border-gray-200 rounded text-right text-gray-800"
                          />
                        ) : (
                          formatCurrency(report.egreso_destajos)
                        )}
                      </td>
                      <td className="p-1 text-right">
                        {canEdit ? (
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={report.egreso_materiales}
                            onChange={(e) => handleFieldChange(report.id, "egreso_materiales", parseFloat(e.target.value) || 0)}
                            className="w-full px-1 py-1 border border-gray-200 rounded text-right text-gray-800"
                          />
                        ) : (
                          formatCurrency(report.egreso_materiales)
                        )}
                      </td>
                      <td className="p-1 text-right">
                        {canEdit ? (
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={report.egreso_diesel}
                            onChange={(e) => handleFieldChange(report.id, "egreso_diesel", parseFloat(e.target.value) || 0)}
                            className="w-full px-1 py-1 border border-gray-200 rounded text-right text-gray-800"
                          />
                        ) : (
                          formatCurrency(report.egreso_diesel)
                        )}
                      </td>
                      
                      <td className="p-2 text-right font-bold bg-emerald-50 text-emerald-900">
                        {formatCurrency(report.total_egresos_directos)}
                      </td>

                      <td className="p-1 text-right">
                        {canEdit ? (
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={report.egreso_nomina_indirecta}
                            onChange={(e) => handleFieldChange(report.id, "egreso_nomina_indirecta", parseFloat(e.target.value) || 0)}
                            className="w-full px-1 py-1 border border-gray-200 rounded text-right text-gray-800"
                          />
                        ) : (
                          formatCurrency(report.egreso_nomina_indirecta)
                        )}
                      </td>
                      <td className="p-1 text-right">
                        {canEdit ? (
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={report.egreso_seguro_nomina_indirecta}
                            onChange={(e) => handleFieldChange(report.id, "egreso_seguro_nomina_indirecta", parseFloat(e.target.value) || 0)}
                            className="w-full px-1 py-1 border border-gray-200 rounded text-right text-gray-800"
                          />
                        ) : (
                          formatCurrency(report.egreso_seguro_nomina_indirecta)
                        )}
                      </td>
                      <td className="p-1 text-right">
                        {canEdit ? (
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={report.egreso_gastos_indirectos}
                            onChange={(e) => handleFieldChange(report.id, "egreso_gastos_indirectos", parseFloat(e.target.value) || 0)}
                            className="w-full px-1 py-1 border border-gray-200 rounded text-right text-gray-800"
                          />
                        ) : (
                          formatCurrency(report.egreso_gastos_indirectos)
                        )}
                      </td>

                      <td className="p-2 text-right text-purple-800 text-[10px]">
                        {formatCurrency(report.monto_indirecto_campo)}
                      </td>

                      <td className="p-2 text-right font-bold bg-purple-50 text-purple-900">
                        {formatCurrency(report.total_egresos_indirectos + report.monto_indirecto_campo + report.monto_indirecto_oficina)}
                      </td>

                      <td className="p-2 text-right font-black bg-amber-50 text-amber-900">
                        {formatCurrency(report.total_egresos)}
                      </td>

                      <td className={`p-2 text-right font-bold ${report.importe_utilidad >= 0 ? "text-emerald-700 bg-emerald-50/50" : "text-red-600 bg-red-50/50"}`}>
                        {formatCurrency(report.importe_utilidad)}
                      </td>

                      <td className="p-2 text-center font-bold">
                        <span className={`px-1.5 py-0.5 rounded ${report.pct_utilidad >= 10 ? "bg-emerald-100 text-emerald-800" : report.pct_utilidad >= 0 ? "bg-amber-100 text-amber-800" : "bg-red-100 text-red-800"}`}>
                          {formatPercent(report.pct_utilidad)}
                        </span>
                      </td>

                      <td className="p-1 text-center">
                        {canEdit ? (
                          <input
                            type="number"
                            min="0"
                            max="100"
                            step="0.1"
                            value={report.pct_avance_programa}
                            onChange={(e) => handleFieldChange(report.id, "pct_avance_programa", parseFloat(e.target.value) || 0)}
                            className="w-14 px-1 py-1 border border-gray-200 rounded text-center text-gray-800 font-bold"
                          />
                        ) : (
                          <span className="font-bold text-gray-800">{formatPercent(report.pct_avance_programa)}</span>
                        )}
                      </td>

                      {canEdit && (
                        <td className="p-1 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              onClick={() => handleSaveWeek(report)}
                              disabled={savingWeekId === report.id}
                              className="p-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded transition-colors disabled:opacity-50"
                              title="Guardar semana"
                            >
                              {savingWeekId === report.id ? (
                                <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                              ) : (
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                              )}
                            </button>
                            <button
                              onClick={() => handleDeleteWeek(report)}
                              disabled={deletingWeekId === report.id}
                              className="p-1 bg-red-100 hover:bg-red-200 text-red-600 rounded transition-colors disabled:opacity-50"
                              title="Eliminar"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
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

      {/* SECCIÓN DE GRÁFICAS INTERACTIVAS */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-6 border-b border-gray-100 pb-4">
          <div>
            <h3 className="text-lg font-bold text-gray-900">Análisis Visual y Gráficas de Control</h3>
            <p className="text-xs text-gray-500 mt-0.5">Visualización en tiempo real del comportamiento de la obra.</p>
          </div>

          <div className="flex bg-gray-100 p-1 rounded-xl gap-1 text-xs font-semibold">
            <button
              onClick={() => setActiveChartTab("generado_egresos")}
              className={`px-3 py-1.5 rounded-lg transition-all ${activeChartTab === "generado_egresos" ? "bg-white text-indigo-700 shadow-sm" : "text-gray-600 hover:text-gray-900"}`}
            >
              Generado vs Egresos
            </button>
            <button
              onClick={() => setActiveChartTab("utilidad")}
              className={`px-3 py-1.5 rounded-lg transition-all ${activeChartTab === "utilidad" ? "bg-white text-indigo-700 shadow-sm" : "text-gray-600 hover:text-gray-900"}`}
            >
              Tendencia Utilidad
            </button>
            <button
              onClick={() => setActiveChartTab("desglose")}
              className={`px-3 py-1.5 rounded-lg transition-all ${activeChartTab === "desglose" ? "bg-white text-indigo-700 shadow-sm" : "text-gray-600 hover:text-gray-900"}`}
            >
              Desglose Gastos
            </button>
            <button
              onClick={() => setActiveChartTab("avance")}
              className={`px-3 py-1.5 rounded-lg transition-all ${activeChartTab === "avance" ? "bg-white text-indigo-700 shadow-sm" : "text-gray-600 hover:text-gray-900"}`}
            >
              Curva Avance
            </button>
          </div>
        </div>

        {reports.length === 0 ? (
          <div className="py-10 text-center text-xs text-gray-400">Captura reportes semanales para visualizar gráficas.</div>
        ) : (
          <div className="min-h-[280px]">
            {activeChartTab === "generado_egresos" && (
              <div className="space-y-4">
                <div className="flex justify-end items-center gap-4 text-xs font-semibold">
                  <span className="flex items-center gap-1.5"><span className="w-3 h-3 bg-blue-500 rounded-sm" /> Generado ($)</span>
                  <span className="flex items-center gap-1.5"><span className="w-3 h-3 bg-amber-500 rounded-sm" /> Egresos ($)</span>
                </div>
                <div className="h-56 flex items-end gap-3 pt-6 pb-2 border-b border-gray-200 overflow-x-auto">
                  {reports.map((r) => {
                    const hGen = maxGeneradoOEgreso > 0 ? (r.importe_generado / maxGeneradoOEgreso) * 100 : 0;
                    const hEgr = maxGeneradoOEgreso > 0 ? (r.total_egresos / maxGeneradoOEgreso) * 100 : 0;
                    return (
                      <div key={r.id} className="flex-1 min-w-[48px] flex flex-col items-center gap-1 group relative">
                        <div className="opacity-0 group-hover:opacity-100 transition-opacity absolute bottom-full mb-2 bg-gray-900 text-white text-[10px] p-2 rounded shadow-lg pointer-events-none z-10 w-36 text-center">
                          <p className="font-bold">Semana {r.semana_numero}</p>
                          <p className="text-blue-300">Gen: {formatCurrency(r.importe_generado)}</p>
                          <p className="text-amber-300">Egr: {formatCurrency(r.total_egresos)}</p>
                        </div>
                        <div className="w-full flex items-end justify-center gap-1 h-44">
                          <div className="w-4 bg-blue-500 rounded-t transition-all hover:bg-blue-600" style={{ height: `${Math.max(4, hGen)}%` }} />
                          <div className="w-4 bg-amber-500 rounded-t transition-all hover:bg-amber-600" style={{ height: `${Math.max(4, hEgr)}%` }} />
                        </div>
                        <span className="text-[10px] text-gray-500 font-bold">Sem {r.semana_numero}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {activeChartTab === "utilidad" && (
              <div className="space-y-4">
                <div className="flex justify-between text-xs text-gray-500 font-semibold">
                  <span>Margen de Utilidad Bruta Semanal (%)</span>
                  <span>Promedio Global: <strong className="text-emerald-700">{formatPercent(summary?.pct_utilidad_global || 0)}</strong></span>
                </div>
                <div className="h-56 flex items-end gap-3 pt-6 pb-2 border-b border-gray-200 overflow-x-auto">
                  {reports.map((r) => {
                    const pct = r.pct_utilidad;
                    const h = Math.min(100, Math.max(5, Math.abs(pct) * 2));
                    return (
                      <div key={r.id} className="flex-1 min-w-[48px] flex flex-col items-center gap-1 group relative">
                        <div className="opacity-0 group-hover:opacity-100 transition-opacity absolute bottom-full mb-2 bg-gray-900 text-white text-[10px] p-2 rounded shadow-lg pointer-events-none z-10 w-36 text-center">
                          <p className="font-bold">Semana {r.semana_numero}</p>
                          <p className="text-emerald-300">Utilidad: {formatCurrency(r.importe_utilidad)} ({r.pct_utilidad.toFixed(1)}%)</p>
                        </div>
                        <div className="w-full flex items-end justify-center h-44">
                          <div
                            className={`w-6 rounded-t transition-all ${pct >= 10 ? "bg-emerald-500 hover:bg-emerald-600" : pct >= 0 ? "bg-amber-500 hover:bg-amber-600" : "bg-red-500 hover:bg-red-600"}`}
                            style={{ height: `${h}%` }}
                          />
                        </div>
                        <span className="text-[10px] font-bold text-gray-600">{pct.toFixed(1)}%</span>
                        <span className="text-[9px] text-gray-400">Sem {r.semana_numero}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {activeChartTab === "desglose" && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
                <div className="space-y-3 text-xs">
                  <p className="font-bold text-gray-700 uppercase">Distribución Acumulada de Gastos Directos</p>
                  {(() => {
                    const totalD = summary?.total_egresos_directos || 1;
                    const catMaq = reports.reduce((a, b) => a + Number(b.egreso_maquinaria_equipo || 0), 0);
                    const catNom = reports.reduce((a, b) => a + Number(b.egreso_nomina_directa || 0) + Number(b.egreso_seguro_nomina_directa || 0), 0);
                    const catDes = reports.reduce((a, b) => a + Number(b.egreso_destajos || 0), 0);
                    const catMat = reports.reduce((a, b) => a + Number(b.egreso_materiales || 0), 0);
                    const catDie = reports.reduce((a, b) => a + Number(b.egreso_diesel || 0), 0);

                    const items = [
                      { label: "Materiales", value: catMat, color: "bg-blue-500" },
                      { label: "Nómina Directa", value: catNom, color: "bg-emerald-500" },
                      { label: "Maquinaria y Equipo", value: catMaq, color: "bg-purple-500" },
                      { label: "Destajos", value: catDes, color: "bg-amber-500" },
                      { label: "Diesel", value: catDie, color: "bg-red-500" },
                    ];

                    return items.map((item) => (
                      <div key={item.label} className="space-y-1">
                        <div className="flex justify-between text-gray-600 font-medium">
                          <span className="flex items-center gap-2"><span className={`w-2.5 h-2.5 rounded-full ${item.color}`} /> {item.label}</span>
                          <span>{formatCurrency(item.value)} ({((item.value / totalD) * 100).toFixed(1)}%)</span>
                        </div>
                        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div className={`h-full ${item.color}`} style={{ width: `${Math.min(100, (item.value / totalD) * 100)}%` }} />
                        </div>
                      </div>
                    ));
                  })()}
                </div>

                <div className="bg-gray-50 border border-gray-100 rounded-xl p-5 text-center text-xs space-y-2">
                  <span className="font-bold text-gray-700 uppercase block">Egresos Indirectos vs Directos</span>
                  <div className="text-2xl font-extrabold text-gray-900 tabular-nums">
                    {formatCurrency(summary?.total_egresos || 0)}
                  </div>
                  <div className="flex justify-center gap-4 pt-2 text-gray-600">
                    <span>Directos: <strong className="text-emerald-700">{formatCurrency(summary?.total_egresos_directos || 0)}</strong></span>
                    <span>Indirectos: <strong className="text-purple-700">{formatCurrency((summary?.total_egresos_indirectos || 0) + (summary?.total_indirectos_campo || 0) + (summary?.total_indirectos_oficina || 0))}</strong></span>
                  </div>
                </div>
              </div>
            )}

            {activeChartTab === "avance" && (
              <div className="space-y-4">
                <div className="flex justify-between text-xs text-gray-500 font-semibold">
                  <span>Curva S de Avance Físico del Programa (%)</span>
                  <span>Último avance: <strong className="text-indigo-600">{formatPercent(summary?.ultimo_pct_avance || 0)}</strong></span>
                </div>
                <div className="h-56 flex items-end gap-3 pt-6 pb-2 border-b border-gray-200 overflow-x-auto">
                  {reports.map((r) => {
                    const h = Math.min(100, Math.max(4, r.pct_avance_programa));
                    return (
                      <div key={r.id} className="flex-1 min-w-[48px] flex flex-col items-center gap-1 group relative">
                        <div className="opacity-0 group-hover:opacity-100 transition-opacity absolute bottom-full mb-2 bg-gray-900 text-white text-[10px] p-2 rounded shadow-lg pointer-events-none z-10 w-32 text-center">
                          <p className="font-bold">Semana {r.semana_numero}</p>
                          <p className="text-indigo-300">Avance: {r.pct_avance_programa}%</p>
                        </div>
                        <div className="w-full flex items-end justify-center h-44">
                          <div className="w-6 bg-indigo-500 rounded-t transition-all hover:bg-indigo-600" style={{ height: `${h}%` }} />
                        </div>
                        <span className="text-[10px] font-bold text-indigo-700">{r.pct_avance_programa}%</span>
                        <span className="text-[9px] text-gray-400">Sem {r.semana_numero}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ASISTENTE Y ANALISTA FINANCIERO DE IA */}
      <div className="bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 rounded-2xl shadow-lg text-white p-6">
        <div className="flex items-center justify-between mb-4 border-b border-indigo-900/60 pb-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-600/30 border border-indigo-400/30 flex items-center justify-center text-indigo-300">
              <svg className="w-5 h-5 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <div>
              <h3 className="font-bold text-base text-white">Analista Financiero de Obra</h3>
              <p className="text-xs text-indigo-200">Consultas en vivo de ingresos, egresos y desviaciones de la obra "{storeName}"</p>
            </div>
          </div>
          <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Datos Conectados en Tiempo Real
          </span>
        </div>

        <div className="flex flex-wrap gap-2 mb-4">
          <span className="text-xs text-indigo-300 font-semibold self-center mr-1">Consultas ejecutivas:</span>
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
              className="px-3 py-1 rounded-full bg-indigo-900/40 hover:bg-indigo-800/60 border border-indigo-700/40 text-xs text-indigo-200 transition-colors disabled:opacity-50 text-left"
            >
              {q}
            </button>
          ))}
        </div>

        <div className="space-y-4 max-h-80 overflow-y-auto pr-2 mb-4 scrollbar-thin scrollbar-thumb-indigo-800">
          {aiHistory.length === 0 ? (
            <div className="p-4 rounded-xl bg-indigo-950/40 border border-indigo-800/30 text-xs text-indigo-300 text-center">
              Escribe una consulta o selecciona una opción para generar análisis financiero instantáneo.
            </div>
          ) : (
            aiHistory.map((msg) => (
              <div
                key={msg.id}
                className={`p-4 rounded-xl text-xs leading-relaxed ${
                  msg.role === "user"
                    ? "bg-indigo-600/30 border border-indigo-500/40 text-indigo-100 ml-8"
                    : "bg-slate-800/80 border border-slate-700/60 text-slate-100 mr-4"
                }`}
              >
                <div className="flex justify-between items-center mb-1 text-[10px] text-indigo-300 font-semibold">
                  <span className="flex items-center gap-1">
                    {msg.role === "user" ? (
                      <>
                        <svg className="w-3 h-3 text-indigo-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                        Usuario
                      </>
                    ) : (
                      <>
                        <svg className="w-3 h-3 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
            <div className="p-3 rounded-xl bg-slate-800/50 border border-slate-700/50 text-xs text-indigo-300 flex items-center gap-2">
              <div className="w-4 h-4 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
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
            className="flex-1 px-4 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white placeholder-slate-400 text-xs focus:ring-2 focus:ring-indigo-500 outline-none"
          />
          <button
            type="submit"
            disabled={aiLoading || !aiInput.trim()}
            className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl text-xs shadow-md transition-colors disabled:opacity-50 flex items-center gap-1.5"
          >
            <span>Consultar</span>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
            </svg>
          </button>
        </form>
      </div>

      {/* MODAL CONFIGURACIÓN DE INDIRECTOS POR OBRA */}
      {showSettingsModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-gray-200 w-full max-w-md p-6 space-y-5">
            <div className="flex justify-between items-center border-b border-gray-100 pb-3">
              <h3 className="font-bold text-gray-900 text-base">Configuración de Indirectos de la Obra</h3>
              <button onClick={() => setShowSettingsModal(false)} className="text-gray-400 hover:text-gray-600 font-bold">✕</button>
            </div>

            <p className="text-xs text-gray-500">
              Define los porcentajes asignados para el cálculo automático de los Indirectos de Campo y de Oficina en la obra "{storeName}".
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
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
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 font-bold pr-8"
                  />
                  <span className="absolute right-3 top-2.5 text-xs text-gray-400 font-bold">%</span>
                </div>
                <span className="text-[10px] text-gray-400 mt-1 block">Se aplica sobre (Egresos Directos + Egresos Indirectos Base).</span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
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
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 font-bold pr-8"
                  />
                  <span className="absolute right-3 top-2.5 text-xs text-gray-400 font-bold">%</span>
                </div>
                <span className="text-[10px] text-gray-400 mt-1 block">Se aplica sobre el Importe Generado de la semana.</span>
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t border-gray-100 pt-4">
              <button
                onClick={() => setShowSettingsModal(false)}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-xs font-semibold"
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveSettings}
                disabled={savingSettings}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow-sm transition-colors disabled:opacity-50"
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
