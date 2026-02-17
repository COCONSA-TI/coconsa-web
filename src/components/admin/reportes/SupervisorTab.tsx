"use client";

import { Project, Supervisor } from "@/types/project";

interface SupervisorTabProps {
  formData: Project;
  setFormData: (data: Project) => void;
}

export default function SupervisorTab({
  formData,
  setFormData,
}: SupervisorTabProps) {
  const handleSupervisorChange = (field: keyof Supervisor, value: string) => {
    setFormData({
      ...formData,
      supervisor: {
        ...formData.supervisor,
        [field]: value,
      },
    });
  };

  return (
    <div className="space-y-6">
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <svg className="w-6 h-6 text-[#e52b2d] flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
          <div>
            <h4 className="font-semibold text-red-900 mb-1">
              Información del Supervisor
            </h4>
            <p className="text-sm text-red-700">
              Esta información se mostrará a los clientes cuando soliciten datos de contacto del supervisor.
            </p>
          </div>
        </div>
      </div>

      {/* Supervisor Name */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Nombre Completo <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={formData.supervisor.name}
          onChange={(e) => handleSupervisorChange("name", e.target.value)}
          placeholder="Ing. Juan Pérez González"
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#e52b2d] focus:border-transparent text-gray-900"
          required
        />
      </div>

      {/* Position */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Cargo <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={formData.supervisor.position}
          onChange={(e) => handleSupervisorChange("position", e.target.value)}
          placeholder="Supervisor de Obra"
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#e52b2d] focus:border-transparent text-gray-900"
          required
        />
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Phone */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Teléfono <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
              </svg>
            </div>
            <input
              type="tel"
              value={formData.supervisor.phone}
              onChange={(e) => handleSupervisorChange("phone", e.target.value)}
              placeholder="+52 123 456 7890"
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#e52b2d] focus:border-transparent text-gray-900"
              required
            />
          </div>
        </div>

        {/* Email */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Correo Electrónico <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <input
              type="email"
              value={formData.supervisor.email}
              onChange={(e) => handleSupervisorChange("email", e.target.value)}
              placeholder="supervisor@ejemplo.com"
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#e52b2d] focus:border-transparent text-gray-900"
              required
            />
          </div>
        </div>
      </div>

      {/* Preview Card */}
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
        <h4 className="text-sm font-semibold text-gray-700 mb-4">
          Vista Previa
        </h4>
        <div className="bg-white rounded-lg p-4 border border-gray-200">
          <div className="flex items-start gap-4">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center">
              <svg className="w-8 h-8 text-[#e52b2d]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
            <div className="flex-1">
              <h5 className="font-semibold text-gray-900">
                {formData.supervisor.name || "Nombre del Supervisor"}
              </h5>
              <p className="text-sm text-gray-600 mb-2">
                {formData.supervisor.position || "Cargo"}
              </p>
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-sm text-gray-700">
                  <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                  </svg>
                  <span>{formData.supervisor.phone || "Teléfono"}</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-700">
                  <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                  <span>{formData.supervisor.email || "email@ejemplo.com"}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
