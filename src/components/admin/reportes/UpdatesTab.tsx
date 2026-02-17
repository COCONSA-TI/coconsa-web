"use client";

import { useState } from "react";
import { Project, RecentUpdate } from "@/types/project";

interface UpdatesTabProps {
  formData: Project;
  setFormData: (data: Project) => void;
}

export default function UpdatesTab({ formData, setFormData }: UpdatesTabProps) {
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [currentUpdate, setCurrentUpdate] = useState<RecentUpdate>({
    date: new Date().toISOString().split("T")[0],
    title: "",
    description: "",
  });

  const handleAdd = () => {
    if (!currentUpdate.title || !currentUpdate.description) {
      alert("El título y la descripción son obligatorios");
      return;
    }

    const updatedUpdates = [currentUpdate, ...formData.recentUpdates];
    setFormData({ ...formData, recentUpdates: updatedUpdates });
    setCurrentUpdate({
      date: new Date().toISOString().split("T")[0],
      title: "",
      description: "",
    });
  };

  const handleEdit = (index: number) => {
    setEditingIndex(index);
    setCurrentUpdate(formData.recentUpdates[index]);
  };

  const handleUpdate = () => {
    if (editingIndex === null) return;

    const updatedUpdates = [...formData.recentUpdates];
    updatedUpdates[editingIndex] = currentUpdate;
    setFormData({ ...formData, recentUpdates: updatedUpdates });
    setEditingIndex(null);
    setCurrentUpdate({
      date: new Date().toISOString().split("T")[0],
      title: "",
      description: "",
    });
  };

  const handleDelete = (index: number) => {
    if (confirm("¿Estás seguro de eliminar esta actualización?")) {
      const updatedUpdates = formData.recentUpdates.filter((_, i) => i !== index);
      setFormData({ ...formData, recentUpdates: updatedUpdates });
    }
  };

  const handleCancel = () => {
    setEditingIndex(null);
    setCurrentUpdate({
      date: new Date().toISOString().split("T")[0],
      title: "",
      description: "",
    });
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("es-MX", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  return (
    <div className="space-y-6">
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <svg className="w-6 h-6 text-[#e52b2d] flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
          </svg>
          <div>
            <h4 className="font-semibold text-red-900 mb-1">
              Actualizaciones Recientes
            </h4>
            <p className="text-sm text-red-700">
              Mantén informados a los clientes sobre los últimos avances y novedades del proyecto.
              Las actualizaciones se mostrarán en orden cronológico descendente.
            </p>
          </div>
        </div>
      </div>

      {/* Form */}
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
        <h4 className="font-semibold text-gray-900 mb-4">
          {editingIndex !== null ? "Editar Actualización" : "Agregar Nueva Actualización"}
        </h4>

        <div className="space-y-4">
          {/* Date */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Fecha de la Actualización <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              value={currentUpdate.date}
              onChange={(e) =>
                setCurrentUpdate({ ...currentUpdate, date: e.target.value })
              }
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#e52b2d] focus:border-transparent text-gray-900"
            />
          </div>

          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Título <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={currentUpdate.title}
              onChange={(e) =>
                setCurrentUpdate({ ...currentUpdate, title: e.target.value })
              }
              placeholder="Avance en Cerramientos"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#e52b2d] focus:border-transparent text-gray-900"
              maxLength={100}
            />
            <p className="text-xs text-gray-500 mt-1">
              {currentUpdate.title.length}/100 caracteres
            </p>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Descripción <span className="text-red-500">*</span>
            </label>
            <textarea
              value={currentUpdate.description}
              onChange={(e) =>
                setCurrentUpdate({ ...currentUpdate, description: e.target.value })
              }
              placeholder="Se completó el 75% de muros perimetrales. Se iniciaron trabajos de instalación de ventanería."
              rows={4}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#e52b2d] focus:border-transparent resize-none text-gray-900"
              maxLength={500}
            />
            <p className="text-xs text-gray-500 mt-1">
              {currentUpdate.description.length}/500 caracteres
            </p>
          </div>

          <div className="flex gap-3">
            {editingIndex !== null ? (
              <>
                <button
                  onClick={handleUpdate}
                  className="px-4 py-2 bg-[#e52b2d] text-white rounded-lg hover:bg-[#c91f21] transition-colors"
                >
                  Actualizar
                </button>
                <button
                  onClick={handleCancel}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  Cancelar
                </button>
              </>
            ) : (
              <button
                onClick={handleAdd}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2"
              >
                <span>+</span>
                Agregar Actualización
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Updates List */}
      <div>
        <h4 className="font-semibold text-gray-900 mb-3">
          Historial de Actualizaciones ({formData.recentUpdates.length})
        </h4>

        {formData.recentUpdates.length === 0 ? (
          <div className="text-center py-8 bg-gray-50 rounded-lg border border-gray-200">
            <svg className="w-12 h-12 mx-auto mb-2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p className="text-gray-500">
              No hay actualizaciones registradas. Agrega la primera actualización del proyecto.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {formData.recentUpdates.map((update, index) => (
              <div
                key={index}
                className="bg-white border border-gray-200 rounded-lg p-5 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between gap-4 mb-3">
                  <div className="flex items-start gap-3 flex-1">
                    <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center text-[#e52b2d] flex-shrink-0">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
                      </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs text-gray-500">
                          {formatDate(update.date)}
                        </span>
                      </div>
                      <h5 className="font-semibold text-gray-900 mb-2">
                        {update.title}
                      </h5>
                      <p className="text-sm text-gray-600 leading-relaxed">
                        {update.description}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-col gap-2 flex-shrink-0">
                    <button
                      onClick={() => handleEdit(index)}
                      className="px-3 py-1 text-sm bg-red-50 text-[#e52b2d] rounded hover:bg-red-100 transition-colors whitespace-nowrap"
                    >
                      Editar
                    </button>
                    <button
                      onClick={() => handleDelete(index)}
                      className="px-3 py-1 text-sm bg-red-50 text-red-600 rounded hover:bg-red-100 transition-colors whitespace-nowrap"
                    >
                      Eliminar
                    </button>
                  </div>
                </div>

                {/* Timeline indicator */}
                {index < formData.recentUpdates.length - 1 && (
                  <div className="ml-5 mt-3 pt-3 border-t border-gray-100"></div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Tips */}
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <svg className="w-6 h-6 text-yellow-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
          </svg>
          <div>
            <h4 className="font-semibold text-yellow-900 mb-1">
              Consejos para Actualizaciones
            </h4>
            <ul className="text-sm text-yellow-700 space-y-1">
              <li>• Sé específico y conciso en las descripciones</li>
              <li>• Menciona logros concretos y avances medibles</li>
              <li>• Actualiza regularmente (al menos una vez por semana)</li>
              <li>• Incluye información relevante para el cliente</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
