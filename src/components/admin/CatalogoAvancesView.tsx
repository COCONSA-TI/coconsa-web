"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type {
  CatalogoConcepto,
  CatalogoAvancesSummary,
} from "@/types/database";

import CatalogoAvancesKPICards from "./catalogo-avances/CatalogoAvancesKPICards";
import CatalogoAvancesTable from "./catalogo-avances/CatalogoAvancesTable";
import AddConceptModal from "./catalogo-avances/AddConceptModal";

interface CatalogoAvancesViewProps {
  storeId: number;
  storeName: string;
  canEdit: boolean;
}

export default function CatalogoAvancesView({ storeId, storeName, canEdit }: CatalogoAvancesViewProps) {
  const [concepts, setConcepts] = useState<CatalogoConcepto[]>([]);
  const [summary, setSummary] = useState<CatalogoAvancesSummary | null>(null);
  const [weeksCount, setWeeksCount] = useState<number>(5);

  const [loading, setLoading] = useState(true);
  const [parsingFile, setParsingFile] = useState(false);
  const [savingData, setSavingData] = useState(false);

  const [searchQuery, setSearchQuery] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const [showAddModal, setShowAddModal] = useState(false);
  const [showWeeksModal, setShowWeeksModal] = useState(false);
  const [tempWeeksInput, setTempWeeksInput] = useState<string>("5");

  const fileInputRef = useRef<HTMLInputElement>(null);
  const LOCALSTORAGE_WEEKS_KEY = `coconsa_catalogo_weeks_${storeId}`;

  // Cargar preferencia de semanas guardada
  useEffect(() => {
    const savedWeeks = localStorage.getItem(LOCALSTORAGE_WEEKS_KEY);
    if (savedWeeks) {
      const parsed = parseInt(savedWeeks, 10);
      if (!isNaN(parsed) && parsed > 0) setWeeksCount(parsed);
    }
  }, [LOCALSTORAGE_WEEKS_KEY]);

  const recalculateSummary = (cList: CatalogoConcepto[]) => {
    const presupuestoTotal = cList.reduce((acc, c) => acc + c.importe_presupuestado, 0);
    const iva16 = presupuestoTotal * 0.16;
    const totalConIva = presupuestoTotal + iva16;
    const totalAcumuladoEjecutado = cList.reduce((acc, c) => acc + c.importe_acumulado, 0);
    const totalPendiente = Math.max(0, presupuestoTotal - totalAcumuladoEjecutado);
    const pctAvanceGlobal = presupuestoTotal > 0 ? (totalAcumuladoEjecutado / presupuestoTotal) * 100 : 0;

    setSummary({
      presupuesto_total: presupuestoTotal,
      iva_16: iva16,
      total_con_iva: totalConIva,
      total_acumulado_ejecutado: totalAcumuladoEjecutado,
      total_pendiente: totalPendiente,
      pct_avance_global: pctAvanceGlobal,
    });
  };

  const fetchConcepts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/stores/${storeId}/catalogo-avances`);
      const data = await res.json();
      if (res.ok && Array.isArray(data.concepts)) {
        setConcepts(data.concepts);
        setSummary(data.summary);

        // Detectar si algún concepto tiene semanas mayores a la actual
        let maxWeekInConcepts = 5;
        data.concepts.forEach((c: CatalogoConcepto) => {
          if (c.semanas) {
            Object.keys(c.semanas).forEach((wKey) => {
              const wNum = parseInt(wKey, 10);
              if (!isNaN(wNum) && wNum > maxWeekInConcepts) {
                maxWeekInConcepts = wNum;
              }
            });
          }
        });

        const savedWeeks = localStorage.getItem(LOCALSTORAGE_WEEKS_KEY);
        if (!savedWeeks && maxWeekInConcepts > 5) {
          setWeeksCount(maxWeekInConcepts);
        }
      } else {
        setConcepts([]);
        recalculateSummary([]);
      }
    } catch {
      setConcepts([]);
      recalculateSummary([]);
    } finally {
      setLoading(false);
    }
  }, [storeId, LOCALSTORAGE_WEEKS_KEY]);

  useEffect(() => {
    fetchConcepts();
  }, [fetchConcepts]);

  const handleAddWeek = () => {
    const nextWeeks = weeksCount + 1;
    setWeeksCount(nextWeeks);
    localStorage.setItem(LOCALSTORAGE_WEEKS_KEY, String(nextWeeks));
    setSuccessMsg(`Semana ${nextWeeks < 10 ? '0' + nextWeeks : nextWeeks} agregada al programa de obra.`);
  };

  const handleSaveWeeksCount = (newCount: number) => {
    if (newCount < 1) return;
    setWeeksCount(newCount);
    localStorage.setItem(LOCALSTORAGE_WEEKS_KEY, String(newCount));
    setShowWeeksModal(false);
    setSuccessMsg(`Programa de obra actualizado a ${newCount} semanas.`);
  };

  const handleFileUploadAI = async (file: File) => {
    if (!file) return;
    setParsingFile(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch(`/api/v1/stores/${storeId}/catalogo-avances/parse-excel`, {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al procesar el Catálogo con IA");

      if (data.extractedConcepts && data.extractedConcepts.length > 0) {
        let maxWeekInExtracted = weeksCount;

        const parsed: CatalogoConcepto[] = data.extractedConcepts.map((c: any, index: number) => {
          const clave = String(c.clave || c.codigo || c.code || c.num || index + 1).trim();
          const descripcion = String(c.descripcion || c.concepto || c.desc || c.name || "Concepto").trim();
          const unidad = String(c.unidad || c.um || c.unit || "M2").trim().toUpperCase();

          const cantPresup = Number(c.cantidad_presupuestada ?? c.cantidad ?? c.cant ?? 0);
          const pu = Number(c.precio_unitario ?? c.precio ?? c.pu ?? c.costo_unitario ?? c.costoUnitario ?? 0);
          const impPresup = Number(c.importe_presupuestado ?? c.importe ?? c.monto ?? (cantPresup * pu));

          const semanasRaw = c.semanas || c.semana || c.avances || c.weekly || {};
          const semanasFormatted: Record<number, any> = {};

          if (typeof semanasRaw === "object" && semanasRaw !== null) {
            Object.entries(semanasRaw).forEach(([wKey, wVal]: [string, any]) => {
              const wNum = parseInt(wKey.replace(/\D/g, ""), 10) || parseInt(wKey, 10);
              if (!isNaN(wNum) && wNum > 0) {
                const cantEjec = Number(
                  typeof wVal === "number"
                    ? wVal
                    : wVal?.cantidad_ejecutada ?? wVal?.cantidad ?? wVal?.cant ?? 0
                );
                const impEjec = Number(
                  typeof wVal === "object" && wVal?.importe_ejecutado
                    ? wVal.importe_ejecutado
                    : cantEjec * pu
                );

                if (cantEjec > 0) {
                  semanasFormatted[wNum] = {
                    semana_numero: wNum,
                    fecha_inicio: wVal?.fecha_inicio || "",
                    fecha_fin: wVal?.fecha_fin || "",
                    cantidad_ejecutada: cantEjec,
                    importe_ejecutado: impEjec,
                  };
                  if (wNum > maxWeekInExtracted) maxWeekInExtracted = wNum;
                }
              }
            });
          }

          const cantAcum = Number(
            c.cantidad_acumulada ??
              c.cant_acumulada ??
              Object.values(semanasFormatted).reduce((acc: number, s: any) => acc + (s.cantidad_ejecutada || 0), 0)
          );
          const impAcum = Number(c.importe_acumulado ?? c.imp_acumulado ?? cantAcum * pu);

          return {
            id: Date.now() + index,
            store_id: storeId,
            clave,
            descripcion,
            unidad,
            cantidad_presupuestada: cantPresup,
            precio_unitario: pu,
            importe_presupuestado: impPresup,
            cantidad_acumulada: cantAcum,
            importe_acumulado: impAcum,
            cantidad_pendiente: Math.max(0, cantPresup - cantAcum),
            importe_pendiente: Math.max(0, impPresup - impAcum),
            semanas: semanasFormatted,
          };
        });

        if (maxWeekInExtracted > weeksCount) {
          setWeeksCount(maxWeekInExtracted);
          localStorage.setItem(LOCALSTORAGE_WEEKS_KEY, String(maxWeekInExtracted));
        }

        setConcepts(parsed);
        recalculateSummary(parsed);
        setSuccessMsg(`Catálogo extraído con éxito desde "${file.name}" (${parsed.length} conceptos). Haz clic en "Guardar en BD" para persistirlos.`);
      } else {
        throw new Error("No se encontraron conceptos en el archivo procesado.");
      }
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "Error al procesar archivo");
    } finally {
      setParsingFile(false);
    }
  };

  const handleUpdateWeeklyExecution = (conceptId: number | string, semanaNum: number, cantEjec: number) => {
    setConcepts((prev: CatalogoConcepto[]) => {
      const updated = prev.map((c: CatalogoConcepto) => {
        if (c.id !== conceptId) return c;

        const newSemanas = { ...c.semanas };
        const pu = c.precio_unitario || 0;
        const impEjec = cantEjec * pu;

        if (cantEjec <= 0) {
          delete newSemanas[semanaNum];
        } else {
          newSemanas[semanaNum] = {
            semana_numero: semanaNum,
            fecha_inicio: "",
            fecha_fin: "",
            cantidad_ejecutada: cantEjec,
            importe_ejecutado: impEjec,
          };
        }

        const newCantAcum = Object.values(newSemanas).reduce((sum: number, s: any) => sum + Number(s?.cantidad_ejecutada || 0), 0);
        const newImpAcum = newCantAcum * pu;
        const newCantPend = Math.max(0, c.cantidad_presupuestada - newCantAcum);
        const newImpPend = Math.max(0, c.importe_presupuestado - newImpAcum);

        return {
          ...c,
          cantidad_acumulada: newCantAcum,
          importe_acumulado: newImpAcum,
          cantidad_pendiente: newCantPend,
          importe_pendiente: newImpPend,
          semanas: newSemanas,
        };
      });

      recalculateSummary(updated);
      return updated;
    });
  };

  const handleAddConcept = (newConceptData: {
    clave: string;
    descripcion: string;
    unidad: string;
    cantidad: number;
    precioUnitario: number;
  }) => {
    const imp = newConceptData.cantidad * newConceptData.precioUnitario;

    const newConcept: CatalogoConcepto = {
      id: Date.now(),
      store_id: storeId,
      clave: newConceptData.clave,
      descripcion: newConceptData.descripcion,
      unidad: newConceptData.unidad,
      cantidad_presupuestada: newConceptData.cantidad,
      precio_unitario: newConceptData.precioUnitario,
      importe_presupuestado: imp,
      cantidad_acumulada: 0,
      importe_acumulado: 0,
      cantidad_pendiente: newConceptData.cantidad,
      importe_pendiente: imp,
      semanas: {},
    };

    setConcepts((prev: CatalogoConcepto[]) => {
      const updated = [...prev, newConcept];
      recalculateSummary(updated);
      return updated;
    });

    setShowAddModal(false);
    setSuccessMsg("Concepto agregado al catálogo.");
  };

  const handleSaveCatalog = async () => {
    setSavingData(true);
    setErrorMsg(null);
    try {
      const res = await fetch(`/api/v1/stores/${storeId}/catalogo-avances`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ concepts, weeksCount }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al guardar el catálogo");
      setSuccessMsg("Catálogo de Avances guardado con éxito en la base de datos.");
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "Error al guardar datos en BD");
    } finally {
      setSavingData(false);
    }
  };

  if (loading) {
    return (
      <div className="p-12 text-center bg-white rounded-2xl shadow-sm border border-slate-200">
        <div className="inline-block w-8 h-8 border-3 border-[#C8102E] border-t-transparent rounded-full animate-spin mb-3" />
        <p className="text-sm text-gray-900 font-bold">Cargando Catálogo de Avances desde la base de datos...</p>
      </div>
    );
  }

  const filteredConcepts = concepts.filter(
    (c) =>
      c.clave.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.descripcion.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {errorMsg && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm flex justify-between items-center">
          <span className="font-semibold">{errorMsg}</span>
          <button onClick={() => setErrorMsg(null)} className="text-red-500 font-bold hover:text-red-800">✕</button>
        </div>
      )}
      {successMsg && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm flex justify-between items-center">
          <span className="font-semibold">{successMsg}</span>
          <button onClick={() => setSuccessMsg(null)} className="text-emerald-500 font-bold hover:text-emerald-800">✕</button>
        </div>
      )}

      {/* METRICAS Y RESUMEN KPI */}
      <CatalogoAvancesKPICards summary={summary} />

      {/* BARRA DE ACCIONES Y BUSCADOR */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 flex flex-col md:flex-row justify-between items-stretch md:items-center gap-4">
        <div className="flex-1 max-w-md relative">
          <input
            type="text"
            placeholder="Buscar concepto por clave o descripción..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 bg-white border border-slate-300 rounded-xl text-sm font-medium text-gray-900 focus:ring-2 focus:ring-[#C8102E] outline-none"
          />
          <svg className="w-4 h-4 text-gray-400 absolute left-3 top-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {canEdit && (
            <>
              <button
                onClick={() => {
                  setTempWeeksInput(String(weeksCount));
                  setShowWeeksModal(true);
                }}
                className="px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 text-gray-800 text-xs font-bold rounded-xl transition-colors flex items-center gap-1.5 border border-slate-300"
                title="Configurar total de semanas del programa de obra"
              >
                <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                ⚙️ Semanas ({weeksCount})
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
                className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-sm transition-colors flex items-center gap-1.5 disabled:opacity-50"
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
                    Subir Plantilla Excel / PDF
                  </>
                )}
              </button>

              <button
                onClick={() => setShowAddModal(true)}
                className="px-4 py-2.5 bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold rounded-xl shadow-sm transition-colors flex items-center gap-1.5"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Agregar Concepto
              </button>

              <button
                onClick={handleSaveCatalog}
                disabled={savingData}
                className="px-4 py-2.5 bg-[#C8102E] hover:bg-[#a00d24] text-white text-xs font-bold rounded-xl shadow-sm transition-colors flex items-center gap-1.5 disabled:opacity-50"
              >
                {savingData ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Guardando...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Guardar en BD
                  </>
                )}
              </button>
            </>
          )}
        </div>
      </div>

      {/* MATRIZ DE TABLA DE CONCEPTOS */}
      {filteredConcepts.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-12 text-center">
          <svg className="w-12 h-12 text-gray-300 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <h3 className="text-base font-bold text-gray-900">No hay conceptos registrados para esta obra</h3>
          <p className="text-xs text-gray-500 mt-1 mb-4">Haz clic en "Agregar Concepto" para ingresar uno manualmente o sube tu plantilla Excel/PDF.</p>
          {canEdit && (
            <button
              onClick={() => setShowAddModal(true)}
              className="px-4 py-2 bg-[#C8102E] hover:bg-[#a00d24] text-white rounded-xl text-xs font-bold inline-flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Agregar Primer Concepto
            </button>
          )}
        </div>
      ) : (
        <CatalogoAvancesTable
          concepts={filteredConcepts}
          storeName={storeName}
          canEdit={canEdit}
          weeksCount={weeksCount}
          onUpdateWeeklyExecution={handleUpdateWeeklyExecution}
          onAddWeek={handleAddWeek}
        />
      )}

      {/* MODAL PARA AGREGAR CONCEPTO */}
      {showAddModal && (
        <AddConceptModal
          onClose={() => setShowAddModal(false)}
          onAdd={handleAddConcept}
        />
      )}

      {/* MODAL PARA CONFIGURAR SEMANAS DEL PROGRAMA */}
      {showWeeksModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-md p-6 space-y-4">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h3 className="font-bold text-gray-900 text-base">Configurar Semanas del Programa de Obra</h3>
              <button onClick={() => setShowWeeksModal(false)} className="text-gray-400 hover:text-gray-600 font-bold">✕</button>
            </div>

            <p className="text-xs text-gray-500">
              Ajusta la cantidad total de semanas visibles en el Catálogo de Avances para la obra "{storeName}".
            </p>

            <div className="space-y-2">
              <label className="block text-xs font-bold text-gray-900">Total de Semanas del Programa</label>
              <input
                type="number"
                min="1"
                max="104"
                value={tempWeeksInput}
                onChange={(e) => setTempWeeksInput(e.target.value)}
                className="w-full px-4 py-2.5 border border-slate-300 rounded-xl text-sm font-extrabold text-gray-900 focus:ring-2 focus:ring-[#C8102E] outline-none"
              />
              <span className="text-[10px] text-gray-400 block">Semanas actualmente activas: {weeksCount}</span>
            </div>

            <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
              <button
                onClick={() => setShowWeeksModal(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-gray-700 rounded-xl text-xs font-bold"
              >
                Cancelar
              </button>
              <button
                onClick={() => handleSaveWeeksCount(parseInt(tempWeeksInput, 10) || 5)}
                className="px-4 py-2 bg-[#C8102E] hover:bg-[#a00d24] text-white rounded-xl text-xs font-bold shadow-sm"
              >
                Guardar Configuración
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
