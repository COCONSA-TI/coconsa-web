"use client";

import { Project } from "@/types/project";

interface GeneralInfoTabProps {
  formData: Project;
  setFormData: (data: Project) => void;
}

export default function GeneralInfoTab({
  formData,
  setFormData,
}: GeneralInfoTabProps) {
  const handleChange = (field: keyof Project, value: string | number | boolean) => {
    setFormData({ ...formData, [field]: value });
  };

  return (
    <div className="space-y-6">
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <svg className="w-6 h-6 text-[#e52b2d] flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div>
            <h4 className="font-semibold text-red-900 mb-1">
              Información General del Proyecto
            </h4>
            <p className="text-sm text-red-700">
              Datos básicos del proyecto que se mostrarán al cliente.
            </p>
          </div>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Project ID */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            ID del Proyecto <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={formData.projectId}
            onChange={(e) => handleChange("projectId", e.target.value)}
            placeholder="PROY-001"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#e52b2d] focus:border-transparent text-gray-900"
            required
          />
          <p className="text-xs text-gray-500 mt-1">
            Identificador único del proyecto
          </p>
        </div>

        {/* Status */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Estado <span className="text-red-500">*</span>
          </label>
          <select
            value={formData.status}
            onChange={(e) => handleChange("status", e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#e52b2d] focus:border-transparent text-gray-900"
          >
            <option value="En Proceso">En Proceso</option>
            <option value="Completado">Completado</option>
            <option value="Pausado">Pausado</option>
          </select>
        </div>
      </div>

      {/* Project Name */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Nombre del Proyecto <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={formData.projectName}
          onChange={(e) => handleChange("projectName", e.target.value)}
          placeholder="Construcción Planta Industrial Querétaro"
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#e52b2d] focus:border-transparent text-gray-900"
          required
        />
      </div>

      {/* Client */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Cliente <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={formData.client}
          onChange={(e) => handleChange("client", e.target.value)}
          placeholder="Empresa ABC S.A. de C.V."
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#e52b2d] focus:border-transparent text-gray-900"
          required
        />
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Start Date */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Fecha de Inicio <span className="text-red-500">*</span>
          </label>
          <input
            type="date"
            value={formData.startDate}
            onChange={(e) => handleChange("startDate", e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#e52b2d] focus:border-transparent text-gray-900"
            required
          />
        </div>

        {/* Estimated End Date */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Fecha Estimada de Fin <span className="text-red-500">*</span>
          </label>
          <input
            type="date"
            value={formData.estimatedEndDate}
            onChange={(e) => handleChange("estimatedEndDate", e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#e52b2d] focus:border-transparent text-gray-900"
            required
          />
        </div>
      </div>

      {/* Physical Progress */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Avance Físico
        </label>
        <div className="space-y-3">
          <input
            type="range"
            min="0"
            max="100"
            value={formData.physicalProgress}
            onChange={(e) =>
              handleChange("physicalProgress", parseInt(e.target.value))
            }
            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-[#e52b2d]"
          />
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">Progreso actual</span>
            <span className="text-2xl font-bold text-[#e52b2d]">
              {formData.physicalProgress}%
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-4">
            <div
              className="h-4 bg-[#e52b2d] rounded-full transition-all duration-300 flex items-center justify-end pr-2"
              style={{ width: `${formData.physicalProgress}%` }}
            >
              {formData.physicalProgress > 10 && (
                <span className="text-xs text-white font-semibold">
                  {formData.physicalProgress}%
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
