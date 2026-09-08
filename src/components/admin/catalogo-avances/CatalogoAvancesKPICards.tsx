"use client";

import type { CatalogoAvancesSummary } from "@/types/database";

interface CatalogoAvancesKPICardsProps {
  summary: CatalogoAvancesSummary | null;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(amount || 0);
}

function formatPercent(value: number): string {
  return (value || 0).toFixed(2) + "%";
}

export default function CatalogoAvancesKPICards({ summary }: CatalogoAvancesKPICardsProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200">
        <span className="text-[11px] font-bold text-gray-900 uppercase tracking-wider block">Presupuesto Subtotal</span>
        <span className="text-lg font-black text-[#C8102E] tabular-nums mt-1 block">
          {formatCurrency(summary?.presupuesto_total || 0)}
        </span>
        <span className="text-[10px] text-gray-500 mt-1 block">100% Importe Base</span>
      </div>

      <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200">
        <span className="text-[11px] font-bold text-gray-900 uppercase tracking-wider block">IVA Trasladado (16%)</span>
        <span className="text-lg font-black text-slate-800 tabular-nums mt-1 block">
          {formatCurrency(summary?.iva_16 || 0)}
        </span>
        <span className="text-[10px] text-gray-500 mt-1 block">Impuesto Ley</span>
      </div>

      <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200">
        <span className="text-[11px] font-bold text-gray-900 uppercase tracking-wider block">Total con IVA</span>
        <span className="text-lg font-black text-slate-900 tabular-nums mt-1 block">
          {formatCurrency(summary?.total_con_iva || 0)}
        </span>
        <span className="text-[10px] text-gray-500 mt-1 block">Presupuesto Global</span>
      </div>

      <div className="bg-white rounded-2xl p-5 shadow-sm border border-rose-100">
        <span className="text-[11px] font-bold text-gray-900 uppercase tracking-wider block">Acumulado Ejecutado</span>
        <span className="text-lg font-black text-emerald-700 tabular-nums mt-1 block">
          {formatCurrency(summary?.total_acumulado_ejecutado || 0)}
        </span>
        <span className="text-[10px] text-emerald-600 font-semibold mt-1 block">Estimado en Campo</span>
      </div>

      <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200">
        <span className="text-[11px] font-bold text-gray-900 uppercase tracking-wider block">Por Ejercer / Estimar</span>
        <span className="text-lg font-black text-amber-700 tabular-nums mt-1 block">
          {formatCurrency(summary?.total_pendiente || 0)}
        </span>
        <span className="text-[10px] text-amber-600 font-semibold mt-1 block">Saldo Pendiente</span>
      </div>

      <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200">
        <span className="text-[11px] font-bold text-gray-900 uppercase tracking-wider block">% Avance Global</span>
        <span className="text-lg font-black text-[#C8102E] tabular-nums mt-1 block">
          {formatPercent(summary?.pct_avance_global || 0)}
        </span>
        <div className="w-full bg-slate-100 rounded-full h-1.5 mt-2 overflow-hidden">
          <div
            className="bg-[#C8102E] h-full rounded-full transition-all"
            style={{ width: `${Math.min(100, summary?.pct_avance_global || 0)}%` }}
          />
        </div>
      </div>
    </div>
  );
}
