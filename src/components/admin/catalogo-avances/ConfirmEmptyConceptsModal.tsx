"use client";

import type { CatalogoConcepto } from "@/types/database";

interface ConfirmEmptyConceptsModalProps {
  emptyConcepts: CatalogoConcepto[];
  onClose: () => void;
  onConfirm: () => void;
  isSaving: boolean;
}

export default function ConfirmEmptyConceptsModal({
  emptyConcepts,
  onClose,
  onConfirm,
  isSaving,
}: ConfirmEmptyConceptsModalProps) {
  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fadeIn">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg p-6 space-y-4">
        {/* Encabezado del Modal */}
        <div className="flex items-start gap-3 border-b border-slate-100 pb-4">
          <div className="w-10 h-10 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center shrink-0">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>
          <div>
            <h3 className="font-bold text-gray-900 text-base">
              Verificación: Conceptos Vacíos Detectados
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">
              Se encontraron <strong className="text-amber-700">{emptyConcepts.length} concepto(s)</strong> con cantidad o precio unitario en $0.00 / 0.
            </p>
          </div>
        </div>

        {/* Mensaje Informativo */}
        <div className="bg-amber-50/70 border border-amber-200 rounded-xl p-3 text-xs text-amber-900 space-y-1">
          <p className="font-bold">¿Deseas confirmar el envío y guardarlos de todas formas?</p>
          <p className="text-[11px] text-amber-800">
            Los conceptos vacíos se registrarán en la base de datos con cantidad e importe presupuestado en $0.00. Podrás actualizar sus importes en cualquier momento.
          </p>
        </div>

        {/* Previsualización de Conceptos Vacíos */}
        <div className="max-h-44 overflow-y-auto border border-slate-200 rounded-xl divide-y divide-slate-100 text-xs">
          {emptyConcepts.map((item) => (
            <div key={item.id} className="p-2.5 flex items-center justify-between gap-3 hover:bg-slate-50">
              <div className="flex items-center gap-2 min-w-0">
                <span className="px-2 py-0.5 bg-slate-100 text-gray-800 font-mono font-bold text-[10px] rounded border border-slate-200">
                  {item.clave}
                </span>
                <span className="font-medium text-gray-900 truncate max-w-[220px]">
                  {item.descripcion}
                </span>
              </div>
              <div className="text-right text-[11px] shrink-0 font-mono">
                <span className={`block font-bold ${item.cantidad_presupuestada === 0 ? "text-amber-600" : "text-gray-700"}`}>
                  Cant: {item.cantidad_presupuestada} {item.unidad}
                </span>
                <span className={`block ${item.precio_unitario === 0 ? "text-amber-600 font-bold" : "text-gray-500"}`}>
                  P.U: ${item.precio_unitario.toFixed(2)}
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Acciones del Modal */}
        <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-gray-700 rounded-xl text-xs font-bold transition-colors disabled:opacity-50"
          >
            Cancelar / Revisar
          </button>

          <button
            type="button"
            onClick={onConfirm}
            disabled={isSaving}
            className="px-4 py-2.5 bg-[#C8102E] hover:bg-[#a00d24] text-white rounded-xl text-xs font-bold shadow-sm transition-colors flex items-center gap-1.5 disabled:opacity-50"
          >
            {isSaving ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Guardando...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Sí, Confirmar y Guardar
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
