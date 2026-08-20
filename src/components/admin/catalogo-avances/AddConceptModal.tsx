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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!clave.trim() || !descripcion.trim()) return;

    onAdd({
      clave: clave.trim(),
      descripcion: descripcion.trim(),
      unidad: unidad.trim() || "M2",
      cantidad: parseFloat(cantidad) || 0,
      precioUnitario: parseFloat(precio) || 0,
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
              onChange={(e) => setClave(e.target.value)}
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
              onChange={(e) => setDescripcion(e.target.value)}
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
                onChange={(e) => setCantidad(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-gray-900 font-bold outline-none focus:ring-2 focus:ring-[#C8102E]"
                placeholder="0.00"
              />
            </div>
            <div>
              <label className="block font-bold text-gray-900 mb-1">P. Unitario ($)</label>
              <input
                type="number"
                step="0.01"
                value={precio}
                onChange={(e) => setPrecio(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-gray-900 font-bold outline-none focus:ring-2 focus:ring-[#C8102E]"
                placeholder="0.00"
              />
            </div>
          </div>

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
              className="px-4 py-2 bg-[#C8102E] hover:bg-[#a00d24] text-white rounded-xl text-xs font-bold shadow-sm"
            >
              Agregar al Catálogo
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
