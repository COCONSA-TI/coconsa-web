"use client";

import { useState } from "react";

interface AddConceptModalProps {
  onClose: () => void;
  onAdd: (concept: {
    clave: string;
    descripcion: string;
    unidad: string;
    cantidad: number;
    precioUnitario: number;
  }) => void;
}

export default function AddConceptModal({ onClose, onAdd }: AddConceptModalProps) {
  const [clave, setClave] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [unidad, setUnidad] = useState("M2");
  const [cantidad, setCantidad] = useState("");
  const [precio, setPrecio] = useState("");
  const [showWarning, setShowWarning] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!clave.trim() || !descripcion.trim()) return;

    const cantNum = parseFloat(cantidad) || 0;
    const puNum = parseFloat(precio) || 0;

    // Si la cantidad o el precio unitario están en 0 y no se ha mostrado la advertencia aún
    if ((cantNum <= 0 || puNum <= 0) && !showWarning) {
      setShowWarning(true);
      return;
    }

    onAdd({
      clave: clave.trim(),
      descripcion: descripcion.trim(),
      unidad: unidad.trim() || "M2",
      cantidad: cantNum,
      precioUnitario: puNum,
    });
  };

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-md p-6 space-y-4">
        <div className="flex justify-between items-center border-b border-slate-100 pb-3">
          <h3 className="font-bold text-gray-900 text-base">Agregar Nuevo Concepto de Obra</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 font-bold">
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3 text-xs">
          <div>
            <label className="block font-bold text-gray-900 mb-1">Clave de Concepto</label>
            <input
              type="text"
              value={clave}
              onChange={(e) => {
                setClave(e.target.value);
                setShowWarning(false);
              }}
              className="w-full px-3 py-2 border border-slate-300 rounded-xl text-gray-900 font-bold outline-none focus:ring-2 focus:ring-[#C8102E]"
              placeholder="Ej. 1, 2A, EXT-01"
              required
            />
          </div>

          <div>
            <label className="block font-bold text-gray-900 mb-1">Descripción</label>
            <textarea
              rows={3}
              value={descripcion}
              onChange={(e) => {
                setDescripcion(e.target.value);
                setShowWarning(false);
              }}
              className="w-full px-3 py-2 border border-slate-300 rounded-xl text-gray-900 font-semibold outline-none focus:ring-2 focus:ring-[#C8102E]"
              placeholder="Descripción detallada del concepto..."
              required
            />
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="block font-bold text-gray-900 mb-1">Unidad (UM)</label>
              <input
                type="text"
                value={unidad}
                onChange={(e) => setUnidad(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-gray-900 font-bold uppercase outline-none focus:ring-2 focus:ring-[#C8102E]"
                placeholder="M2, M3, M"
              />
            </div>
            <div>
              <label className="block font-bold text-gray-900 mb-1">Cantidad</label>
              <input
                type="number"
                step="0.01"
                value={cantidad}
                onChange={(e) => {
                  setCantidad(e.target.value);
                  setShowWarning(false);
                }}
                className={`w-full px-3 py-2 border rounded-xl font-bold outline-none focus:ring-2 focus:ring-[#C8102E] ${
                  showWarning && (parseFloat(cantidad) || 0) <= 0
                    ? "border-amber-400 bg-amber-50 text-amber-900"
                    : "border-slate-300 text-gray-900"
                }`}
                placeholder="0.00"
              />
            </div>
            <div>
              <label className="block font-bold text-gray-900 mb-1">P. Unitario ($)</label>
              <input
                type="number"
                step="0.01"
                value={precio}
                onChange={(e) => {
                  setPrecio(e.target.value);
                  setShowWarning(false);
                }}
                className={`w-full px-3 py-2 border rounded-xl font-bold outline-none focus:ring-2 focus:ring-[#C8102E] ${
                  showWarning && (parseFloat(precio) || 0) <= 0
                    ? "border-amber-400 bg-amber-50 text-amber-900"
                    : "border-slate-300 text-gray-900"
                }`}
                placeholder="0.00"
              />
            </div>
          </div>

          {showWarning && (
            <div className="bg-amber-50 border border-amber-200 text-amber-900 p-2.5 rounded-xl text-[11px] font-medium space-y-0.5 animate-fadeIn">
              <p className="font-bold flex items-center gap-1 text-amber-800">
                <svg className="w-4 h-4 text-amber-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                Advertencia: Concepto Vacío
              </p>
              <p>Estás agregando este concepto con Cantidad o P. Unitario en <strong>$0.00</strong>. Haz clic de nuevo en <strong>"Confirmar y Agregar"</strong> para insertarlo.</p>
            </div>
          )}

          <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-gray-700 rounded-xl text-xs font-bold"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className={`px-4 py-2 rounded-xl text-xs font-bold shadow-sm transition-colors ${
                showWarning
                  ? "bg-amber-600 hover:bg-amber-700 text-white"
                  : "bg-[#C8102E] hover:bg-[#a00d24] text-white"
              }`}
            >
              {showWarning ? "⚠️ Confirmar y Agregar" : "Agregar al Catálogo"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
