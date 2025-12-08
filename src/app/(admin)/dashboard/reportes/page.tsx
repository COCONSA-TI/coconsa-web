"use client";

import { useState } from "react";
import ProjectsList from "@/components/admin/reportes/ProjectsList";
import ProjectForm from "@/components/admin/reportes/ProjectForm";
import { Project } from "@/types/project";

export default function ReportesPage() {
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  const handleEdit = (project: Project) => {
    setSelectedProject(project);
    setIsCreating(false);
  };

  const handleCreate = () => {
    setSelectedProject(null);
    setIsCreating(true);
  };

  const handleCancel = () => {
    setSelectedProject(null);
    setIsCreating(false);
  };

  const handleSave = () => {
    setSelectedProject(null);
    setIsCreating(false);
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Gestión de Reportes de Proyectos
          </h1>
          <p className="text-gray-600">
            Administra la información de los proyectos que se muestra a los clientes
          </p>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Lista de Proyectos */}
          <div className="lg:col-span-1">
            <ProjectsList
              onEdit={handleEdit}
              onCreate={handleCreate}
              selectedProjectId={selectedProject?.projectId || null}
            />
          </div>

          {/* Formulario de Edición/Creación */}
          <div className="lg:col-span-2">
            {(selectedProject || isCreating) ? (
              <ProjectForm
                project={selectedProject}
                onSave={handleSave}
                onCancel={handleCancel}
                isCreating={isCreating}
              />
            ) : (
              <div className="bg-white rounded-lg shadow-md p-8 text-center">
                <div className="w-16 h-16 mx-auto mb-4 bg-blue-100 rounded-full flex items-center justify-center">
                  <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
                <h3 className="text-xl font-semibold text-gray-700 mb-2">
                  Selecciona un proyecto
                </h3>
                <p className="text-gray-500">
                  Elige un proyecto de la lista para editarlo o crea uno nuevo
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
