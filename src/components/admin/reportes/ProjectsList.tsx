"use client";

import { useState, useEffect } from "react";
import { Project } from "@/types/project";

interface ProjectsListProps {
  onEdit: (project: Project) => void;
  onCreate: () => void;
  selectedProjectId: string | null;
  refreshTrigger?: number;
}

export default function ProjectsList({
  onEdit,
  onCreate,
  selectedProjectId,
  refreshTrigger,
}: ProjectsListProps) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [deleting, setDeleting] = useState<string | null>(null);

  useEffect(() => {
    fetchProjects();
  }, [refreshTrigger]);

  const fetchProjects = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/v1/projects");
      const data = await response.json();
      if (data.success) {
        setProjects(data.projects);
      }
    } catch (error) {
      console.error("Error al cargar proyectos:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (e: React.MouseEvent, projectId: string) => {
    e.stopPropagation();
    
    if (!confirm('¿Estás seguro de eliminar este proyecto? Esta acción no se puede deshacer.')) {
      return;
    }

    try {
      setDeleting(projectId);
      const response = await fetch(`/api/v1/projects/${projectId}`, {
        method: 'DELETE'
      });
      const data = await response.json();
      
      if (data.success) {
        alert('Proyecto eliminado exitosamente');
        fetchProjects();
      } else {
        alert('Error al eliminar: ' + data.error);
      }
    } catch (error) {
      console.error('Error al eliminar:', error);
      alert('Error al eliminar el proyecto');
    } finally {
      setDeleting(null);
    }
  };

  const filteredProjects = projects.filter(
    (project) =>
      project.projectName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      project.projectId.toLowerCase().includes(searchTerm.toLowerCase()) ||
      project.client.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getStatusColor = (status: string) => {
    switch (status) {
      case "En Proceso":
        return "bg-red-100 text-red-800";
      case "Completado":
        return "bg-green-100 text-green-800";
      case "Pausado":
        return "bg-yellow-100 text-yellow-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden">
      {/* Header */}
      <div className="p-4 bg-gradient-to-r from-[#e52b2d] to-[#c91f21] text-white">
        <h2 className="text-lg font-semibold mb-3">Proyectos</h2>
        
        {/* Search */}
        <input
          type="text"
          placeholder="Buscar proyecto..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full px-3 py-2 rounded-lg text-gray-900 placeholder-white focus:outline-none focus:ring-2 focus:ring-red-300"
        />
      </div>

      {/* Create Button */}
      <div className="p-4 border-b">
        <button
          onClick={onCreate}
          className="w-full px-4 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-semibold transition-colors flex items-center justify-center gap-2"
        >
          <span className="text-xl">+</span>
          Crear Nuevo Proyecto
        </button>
      </div>

      {/* Projects List */}
      <div className="overflow-y-auto max-h-[calc(100vh-300px)]">
        {loading ? (
          <div className="p-8 text-center text-gray-500">
            Cargando proyectos...
          </div>
        ) : filteredProjects.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            {searchTerm
              ? "No se encontraron proyectos"
              : "No hay proyectos disponibles"}
          </div>
        ) : (
          filteredProjects.map((project) => (
            <div
              key={project.projectId}
              className={`w-full p-4 text-left hover:bg-gray-50 border-b transition-colors cursor-pointer ${
                selectedProjectId === project.projectId
                  ? "bg-red-50 border-l-4 border-l-[#e52b2d]"
                  : ""
              }`}
            >
              <div 
                onClick={() => onEdit(project)}
                className="flex items-start justify-between gap-2"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-mono text-gray-500">
                      {project.projectId}
                    </span>
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full font-medium ${getStatusColor(
                        project.status
                      )}`}
                    >
                      {project.status}
                    </span>
                  </div>
                  <h3 className="font-semibold text-gray-900 text-sm mb-1 truncate">
                    {project.projectName}
                  </h3>
                  <p className="text-xs text-gray-600 truncate">
                    {project.client}
                  </p>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="text-lg font-bold text-[#e52b2d]">
                    {project.physicalProgress}%
                  </div>
                  <div className="text-xs text-gray-500">Avance</div>
                </div>
              </div>

              {/* Progress Bar y Botón eliminar */}
              <div className="mt-3 flex items-center gap-3">
                <div 
                  onClick={() => onEdit(project)}
                  className="flex-1 bg-gray-200 rounded-full h-2 overflow-hidden cursor-pointer"
                >
                  <div
                    className="bg-[#e52b2d] h-full transition-all duration-300"
                    style={{ width: `${project.physicalProgress}%` }}
                  />
                </div>
                <button
                  onClick={(e) => handleDelete(e, project.projectId)}
                  disabled={deleting === project.projectId}
                  className="text-xs text-red-600 hover:text-red-800 hover:underline disabled:text-gray-400 flex-shrink-0"
                >
                  {deleting === project.projectId ? 'Eliminando...' : 'Eliminar'}
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Footer Stats */}
      {!loading && projects.length > 0 && (
        <div className="p-4 bg-gray-50 border-t">
          <div className="text-xs text-gray-600 text-center">
            {filteredProjects.length} de {projects.length} proyecto(s)
          </div>
        </div>
      )}
    </div>
  );
}
