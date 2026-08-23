"use client";

import { Fragment } from "react";
import type { CatalogoConcepto } from "@/types/database";

interface CatalogoAvancesTableProps {
  concepts: CatalogoConcepto[];
  storeName: string;
  canEdit: boolean;
  weeksCount: number;
  onUpdateWeeklyExecution: (conceptId: number | string, semanaNum: number, cantEjec: number) => void;
  onAddWeek?: () => void;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(amount || 0);
}

export default function CatalogoAvancesTable({
  concepts,
  storeName,
  canEdit,
  weeksCount,
  onUpdateWeeklyExecution,
  onAddWeek,
}: CatalogoAvancesTableProps) {
  const WEEKS = Array.from({ length: Math.max(1, weeksCount) }, (_, i) => i + 1);

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
      <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h3 className="font-bold text-xs text-gray-900 uppercase tracking-wider flex items-center gap-2">
            <svg className="w-4 h-4 text-[#C8102E]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Catálogo de Conceptos y Seguimiento de Avances — {storeName}
          </h3>
          <p className="text-[11px] text-gray-500 mt-0.5">
            Programa de Obra: <strong className="text-gray-900">{WEEKS.length} Semanas</strong> configuradas
          </p>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-500 font-semibold">{concepts.length} Conceptos</span>
          {canEdit && onAddWeek && (
            <button
              onClick={onAddWeek}
              className="px-3 py-1.5 bg-rose-50 text-[#C8102E] hover:bg-rose-100 border border-rose-200 text-xs font-bold rounded-lg transition-colors flex items-center gap-1"
              title="Agregar nueva columna de semana al programa"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              + Agregar Semana
            </button>
          )}
        </div>
      </div>

      <div className="overflow-x-auto relative scrollbar-thin scrollbar-thumb-slate-300">
        <table className="w-full text-xs text-left border-collapse min-w-[1500px]">
          <thead>
            {/* Fila 1: Grupos de encabezados */}
            <tr className="bg-slate-100 text-gray-900 text-[11px] font-extrabold uppercase tracking-wider text-center border-b border-slate-200">
              <th className="py-2.5 px-2 sticky left-0 z-30 bg-slate-100 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] w-12 min-w-[48px] max-w-[48px]">Clave</th>
              <th className="py-2.5 px-2 sticky left-12 z-30 bg-slate-100 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] w-60 min-w-[240px] max-w-[240px] border-r border-slate-200">Descripción del Concepto</th>
              <th className="py-2.5 px-1 w-12 min-w-[48px] max-w-[48px] text-center">UM</th>
              <th className="py-2.5 px-2 w-24 min-w-[96px] max-w-[96px] text-right">Cant. Presup.</th>
              <th className="py-2.5 px-2 w-24 min-w-[96px] max-w-[96px] text-right">P. Unitario</th>
              <th className="py-2.5 px-2 sticky left-[288px] z-30 w-28 min-w-[112px] max-w-[112px] text-right bg-rose-100 text-[#C8102E] border-r border-rose-200 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]">Importe Total</th>

              <th className="py-2.5 px-2 sticky left-[400px] z-30 w-[176px] min-w-[176px] max-w-[176px] text-center bg-emerald-100 text-emerald-900 border-r border-emerald-200 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]" colSpan={2}>
                ACUMULADO EJECUTADO
              </th>

              <th className="py-2.5 px-2 sticky left-[576px] z-30 w-[208px] min-w-[208px] max-w-[208px] text-center bg-amber-100 text-amber-900 border-r border-amber-200 shadow-[3px_0_6px_-2px_rgba(0,0,0,0.15)]" colSpan={2}>
                PENDIENTE POR EJERCER
              </th>

              {WEEKS.map((semNum) => (
                <th key={semNum} className="py-2.5 px-2 bg-slate-50 text-gray-900 border-r border-slate-200 text-center w-[176px] min-w-[176px]" colSpan={2}>
                  SEMANA {semNum < 10 ? `0${semNum}` : semNum}
                </th>
              ))}
            </tr>

            {/* Fila 2: Subencabezados de columnas */}
            <tr className="bg-slate-50 text-gray-900 text-[10px] font-extrabold uppercase tracking-wider text-center border-b border-slate-200">
              <th className="py-2 px-1.5 sticky left-0 z-30 bg-slate-50 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)] w-12 min-w-[48px] max-w-[48px] text-center">#</th>
              <th className="py-2 px-2 sticky left-12 z-30 bg-slate-50 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)] border-r border-slate-200 text-left w-60 min-w-[240px] max-w-[240px]">Concepto de Obra</th>
              <th className="py-2 px-1 w-12 min-w-[48px] max-w-[48px] text-center">Unidad</th>
              <th className="py-2 px-1.5 w-24 min-w-[96px] max-w-[96px] text-right">Cantidad</th>
              <th className="py-2 px-1.5 w-24 min-w-[96px] max-w-[96px] text-right">P.U. ($)</th>
              <th className="py-2 px-1.5 sticky left-[288px] z-30 w-28 min-w-[112px] max-w-[112px] text-right bg-rose-100 text-[#C8102E] font-black border-r border-rose-200 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]">Importe ($)</th>

              <th className="py-2 px-1.5 sticky left-[400px] z-30 w-20 min-w-[80px] max-w-[80px] text-right bg-emerald-100 text-emerald-900 font-bold shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]">Cant. Ej.</th>
              <th className="py-2 px-1.5 sticky left-[480px] z-30 w-24 min-w-[96px] max-w-[96px] text-right bg-emerald-100 text-emerald-900 border-r border-emerald-200 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]">Importe Ej.</th>

              <th className="py-2 px-1.5 sticky left-[576px] z-30 w-24 min-w-[96px] max-w-[96px] text-right bg-amber-100 text-amber-900 font-bold shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]">Cant. Pend.</th>
              <th className="py-2 px-1.5 sticky left-[672px] z-30 w-28 min-w-[112px] max-w-[112px] text-right bg-amber-100 text-amber-900 border-r border-amber-200 shadow-[3px_0_6px_-2px_rgba(0,0,0,0.15)]">Importe Pend.</th>

              {WEEKS.map((semNum) => (
                <Fragment key={semNum}>
                  <th className="py-2 px-1.5 text-right bg-slate-50 text-gray-900 w-20 min-w-[80px]">Cant.</th>
                  <th className="py-2 px-1.5 text-right bg-slate-50 text-gray-900 border-r border-slate-200 w-24 min-w-[96px]">Importe ($)</th>
                </Fragment>
              ))}
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-100 bg-white font-mono text-[11px]">
            {concepts.map((item) => (
              <tr key={item.id} className="hover:bg-rose-50/30 transition-colors even:bg-slate-50/30">
                <td className="p-2 text-center font-bold text-gray-900 bg-white sticky left-0 z-20 w-12 min-w-[48px] max-w-[48px] shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)] text-[10px]">
                  {item.clave}
                </td>

                <td className="p-2 text-left font-sans text-gray-900 font-semibold bg-white sticky left-12 z-20 w-60 min-w-[240px] max-w-[240px] shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)] border-r border-slate-200">
                  <p className="line-clamp-2 leading-tight">{item.descripcion}</p>
                </td>

                <td className="p-2 text-center font-bold text-gray-500 uppercase w-12 min-w-[48px] max-w-[48px] text-[10px]">{item.unidad}</td>
                <td className="p-2 text-right font-bold text-gray-900 tabular-nums w-24 min-w-[96px] max-w-[96px]">{item.cantidad_presupuestada.toLocaleString("es-MX", { maximumFractionDigits: 2 })}</td>
                <td className="p-2 text-right text-gray-700 tabular-nums w-24 min-w-[96px] max-w-[96px]">{formatCurrency(item.precio_unitario)}</td>

                <td className="p-2 sticky left-[288px] z-20 w-28 min-w-[112px] max-w-[112px] text-right font-black text-[#C8102E] bg-[#FFF0F2] border-r border-rose-200 tabular-nums shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]">{formatCurrency(item.importe_presupuestado)}</td>

                <td className="p-2 sticky left-[400px] z-20 w-20 min-w-[80px] max-w-[80px] text-right font-bold text-emerald-800 bg-[#EDFDF5] tabular-nums shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]">{item.cantidad_acumulada.toLocaleString("es-MX", { maximumFractionDigits: 2 })}</td>
                <td className="p-2 sticky left-[480px] z-20 w-24 min-w-[96px] max-w-[96px] text-right font-black text-emerald-800 bg-[#EDFDF5] border-r border-emerald-200 tabular-nums shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]">{formatCurrency(item.importe_acumulado)}</td>

                <td className="p-2 sticky left-[576px] z-20 w-24 min-w-[96px] max-w-[96px] text-right font-bold text-amber-800 bg-[#FFFBEB] tabular-nums shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]">{item.cantidad_pendiente.toLocaleString("es-MX", { maximumFractionDigits: 2 })}</td>
                <td className="p-2 sticky left-[672px] z-20 w-28 min-w-[112px] max-w-[112px] text-right font-black text-amber-800 bg-[#FFFBEB] border-r border-amber-200 shadow-[3px_0_6px_-2px_rgba(0,0,0,0.15)] tabular-nums">{formatCurrency(item.importe_pendiente)}</td>

                {WEEKS.map((semNum) => {
                  const semData = item.semanas?.[semNum];
                  return (
                    <Fragment key={semNum}>
                      <td className="p-1.5 text-right w-24 min-w-[96px]">
                        {canEdit ? (
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={semData?.cantidad_ejecutada || ""}
                            onChange={(e) =>
                              onUpdateWeeklyExecution(item.id, semNum, parseFloat(e.target.value) || 0)
                            }
                            className="w-20 px-2 py-1 bg-white border border-slate-300 rounded-lg text-right font-bold text-gray-900 focus:ring-2 focus:ring-[#C8102E] outline-none"
                            placeholder="0"
                          />
                        ) : (
                          <span className="font-bold text-gray-900">{semData?.cantidad_ejecutada || "—"}</span>
                        )}
                      </td>
                      <td className="p-2.5 text-right font-bold text-gray-900 border-r border-slate-200 tabular-nums">
                        {semData?.importe_ejecutado ? formatCurrency(semData.importe_ejecutado) : "—"}
                      </td>
                    </Fragment>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
