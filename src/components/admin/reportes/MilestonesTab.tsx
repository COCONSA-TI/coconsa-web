"use client";

import { useState } from "react";
import { Project, Milestone } from "@/types/project";

interface MilestonesTabProps {
  formData: Project;
  setFormData: (data: Project) => void;
}

const getStatusIcon = (status: string) => {
  switch (status) {
    case "Completado":
      return (
        <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      );
    case "En Proceso":
      return (
        <svg className="w-5 h-5 text-[#e52b2d]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      );
    case "Pendiente":
      return (
        <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      );
    default:
      return null;
  }
};

const getStatusColor = (status: string) => {
  switch (status) {
    case "Completado":
      return "bg-green-100 text-green-800 border-green-200";
    case "En Proceso":
      return "bg-red-100 text-[#e52b2d] border-red-200";
    case "Pendiente":
      return "bg-gray-100 text-gray-600 border-gray-200";
    default:
      return "bg-gray-100 text-gray-600 border-gray-200";
  }
};

export default function MilestonesTab({
  formData,
  setFormData,
}: MilestonesTabProps) {
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [currentMilestone, setCurrentMilestone] = useState<Milestone>({
    name: "",
    status: "Pendiente",
    date: "",
    progress: 0,
  });

  const handleAdd = () => {
    if (!currentMilestone.name || !currentMilestone.date) {
      alert("El nombre y la fecha son obligatorios");
      return;
    }

    const updatedMilestones = [...formData.milestones, currentMilestone];
    setFormData({ ...formData, milestones: updatedMilestones });
    setCurrentMilestone({ name: "", status: "Pendiente", date: "", progress: 0 });
  };

  const handleEdit = (index: number) => {
    setEditingIndex(index);
    setCurrentMilestone(formData.milestones[index]);
  };

  const handleUpdate = () => {
    if (editingIndex === null) return;

    const updatedMilestones = [...formData.milestones];
    updatedMilestones[editingIndex] = currentMilestone;
    setFormData({ ...formData, milestones: updatedMilestones });
    setEditingIndex(null);
    setCurrentMilestone({ name: "", status: "Pendiente", date: "", progress: 0 });
  };

  const handleDelete = (index: number) => {
    if (confirm("¿Estás seguro de eliminar este hito?")) {
      const updatedMilestones = formData.milestones.filter((_, i) => i !== index);
      setFormData({ ...formData, milestones: updatedMilestones });
    }
  };

  const handleCancel = () => {
    setEditingIndex(null);
    setCurrentMilestone({ name: "", status: "Pendiente", date: "", progress: 0 });
  };

  return (
    <div className="space-y-6">
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <svg className="w-6 h-6 text-[#e52b2d] flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
          </svg>
          <div>
            <h4 className="font-semibold text-red-900 mb-1">
              Hitos y Fases del Proyecto
            </h4>
            <p className="text-sm text-red-700">
              Define las fases principales del proyecto y su estado de avance.
            </p>
          </div>
        </div>
      </div>

      {/* Form */}
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
        <h4 className="font-semibold text-gray-900 mb-4">
          {editingIndex !== null ? "Editar Hito" : "Agregar Nuevo Hito"}
        </h4>

        <div className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            {/* Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Nombre del Hito <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={currentMilestone.name}
                onChange={(e) =>
                  setCurrentMilestone({ ...currentMilestone, name: e.target.value })
                }
                placeholder="Cimentación"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#e52b2d] focus:border-transparent text-gray-900"
              />
            </div>

            {/* Date */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Fecha <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={currentMilestone.date}
                onChange={(e) =>
                  setCurrentMilestone({ ...currentMilestone, date: e.target.value })
                }
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#e52b2d] focus:border-transparent text-gray-900"
              />
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            {/* Status */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Estado <span className="text-red-500">*</span>
              </label>
              <select
                value={currentMilestone.status}
                onChange={(e) =>
                  setCurrentMilestone({ ...currentMilestone, status: e.target.value as "Completado" | "En Proceso" | "Pendiente" })
                }
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#e52b2d] focus:border-transparent text-gray-900"
              >
                <option value="Pendiente">Pendiente</option>
                <option value="En Proceso">En Proceso</option>
                <option value="Completado">Completado</option>
              </select>
            </div>

            {/* Progress */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Progreso: {currentMilestone.progress}%
              </label>
              <input
                type="range"
                min="0"
                max="100"
                value={currentMilestone.progress}
                onChange={(e) =>
                  setCurrentMilestone({
                    ...currentMilestone,
                    progress: parseInt(e.target.value),
                  })
                }
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-[#e52b2d]"
              />
            </div>
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
                Agregar Hito
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Milestones List */}
      <div>
        <h4 className="font-semibold text-gray-900 mb-3">
          Hitos del Proyecto ({formData.milestones.length})
        </h4>

        {formData.milestones.length === 0 ? (
          <div className="text-center py-8 bg-gray-50 rounded-lg border border-gray-200">
            <svg className="w-12 h-12 mx-auto mb-2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
            </svg>
            <p className="text-gray-500">
              No hay hitos agregados. Define las fases principales del proyecto.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {formData.milestones.map((milestone, index) => (
              <div
                key={index}
                className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-start gap-3 mb-3">
                      <div className="mt-1">{getStatusIcon(milestone.status)}</div>
                      <div className="flex-1">
                        <h5 className="font-semibold text-gray-900 mb-1">
                          {milestone.name}
                        </h5>
                        <div className="flex items-center gap-3 text-sm text-gray-600 mb-2">
                          <span className="text-gray-500">{milestone.date}</span>
                          <span
                            className={`px-2 py-0.5 text-xs rounded-full border ${getStatusColor(
                              milestone.status
                            )}`}
                          >
                            {milestone.status}
                          </span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div
                            className="h-2 bg-[#e52b2d] rounded-full transition-all"
                            style={{ width: `${milestone.progress}%` }}
                          />
                        </div>
                        <p className="text-xs text-gray-500 mt-1">
                          {milestone.progress}% completado
                        </p>
                      </div>
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
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
