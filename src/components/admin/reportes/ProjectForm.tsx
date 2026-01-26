"use client";

import { useState, useEffect } from "react";
import { Project } from "@/types/project";
import GeneralInfoTab from "./GeneralInfoTab";
import FinancialTab from "./FinancialTab";
import SupervisorTab from "./SupervisorTab";
import ContactsTab from "./ContactsTab";
import MilestonesTab from "./MilestonesTab";
import UpdatesTab from "./UpdatesTab";

interface ProjectFormProps {
  project: Project | null;
  onSave: () => void;
  onCancel: () => void;
  isCreating: boolean;
}

const tabs = [
  { id: "general", label: "General" },
  { id: "financial", label: "Financiero" },
  { id: "supervisor", label: "Supervisor" },
  { id: "contacts", label: "Contactos" },
  { id: "milestones", label: "Hitos" },
  { id: "updates", label: "Actualizaciones" },
];

export default function ProjectForm({
  project,
  onSave,
  onCancel,
  isCreating,
}: ProjectFormProps) {
  const [activeTab, setActiveTab] = useState("general");
  const [formData, setFormData] = useState<Project | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (project) {
      setFormData(project);
    } else if (isCreating) {
      // Plantilla para nuevo proyecto
      setFormData({
        projectId: "",
        projectName: "",
        client: "",
        status: "En Proceso",
        startDate: new Date().toISOString().split("T")[0],
        estimatedEndDate: "",
        physicalProgress: 0,
        financialProgress: {
          totalBudget: 0,
          currency: "MXN",
          spent: 0,
          percentage: 0,
          lastUpdate: new Date().toISOString().split("T")[0],
        },
        supervisor: {
          name: "",
          phone: "",
          email: "",
          position: "Supervisor de Obra",
        },
        contacts: [],
        milestones: [],
        recentUpdates: [],
      });
    }
    setActiveTab("general");
  }, [project, isCreating]);

  const handleSave = async () => {
    if (!formData) return;

    // Validaciones básicas
    if (!formData.projectName.trim()) {
      alert('El nombre del proyecto es requerido');
      return;
    }
    if (!formData.client.trim()) {
      alert('El cliente es requerido');
      return;
    }

    setSaving(true);
    try {
      const url = isCreating 
        ? '/api/v1/projects' 
        : `/api/v1/projects/${formData.projectId}`;
      
      const method = isCreating ? 'POST' : 'PUT';
      
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });
      
      const data = await response.json();
      
      if (data.success) {
        alert(isCreating ? 'Proyecto creado exitosamente' : 'Proyecto actualizado exitosamente');
        onSave();
      } else {
        alert('Error: ' + (data.error || 'Error desconocido'));
      }
    } catch (error) {
      console.error("Error al guardar:", error);
      alert("Error al guardar el proyecto");
    } finally {
      setSaving(false);
    }
  };

  if (!formData) return null;

  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden">
      {/* Header */}
      <div className="p-6 bg-gradient-to-r from-[#e52b2d] to-[#c91f21] text-white">
        <h2 className="text-2xl font-bold mb-2">
          {isCreating ? "Crear Nuevo Proyecto" : `Editar: ${project?.projectName}`}
        </h2>
        <p className="text-red-100 text-sm">
          {isCreating
            ? "Completa la información del nuevo proyecto"
            : `ID: ${project?.projectId}`}
        </p>
      </div>

      {/* Tabs */}
      <div className="border-b overflow-x-auto">
        <div className="flex min-w-max">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-6 py-4 font-medium transition-colors whitespace-nowrap ${
                activeTab === tab.id
                  ? "border-b-2 border-[#e52b2d] text-[#e52b2d] bg-red-50"
                  : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="p-6 max-h-[calc(100vh-400px)] overflow-y-auto">
        {activeTab === "general" && (
          <GeneralInfoTab formData={formData} setFormData={setFormData} />
        )}
        {activeTab === "financial" && (
          <FinancialTab formData={formData} setFormData={setFormData} />
        )}
        {activeTab === "supervisor" && (
          <SupervisorTab formData={formData} setFormData={setFormData} />
        )}
        {activeTab === "contacts" && (
          <ContactsTab formData={formData} setFormData={setFormData} />
        )}
        {activeTab === "milestones" && (
          <MilestonesTab formData={formData} setFormData={setFormData} />
        )}
        {activeTab === "updates" && (
          <UpdatesTab formData={formData} setFormData={setFormData} />
        )}
      </div>

      {/* Actions */}
      <div className="p-6 bg-gray-50 border-t flex flex-col sm:flex-row gap-3">
        <button
          onClick={onCancel}
          className="flex-1 sm:flex-none px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 transition-colors font-medium"
          disabled={saving}
        >
          Cancelar
        </button>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex-1 sm:flex-none px-6 py-3 bg-[#e52b2d] text-white rounded-lg hover:bg-[#c91f21] transition-colors font-medium disabled:bg-gray-400 disabled:cursor-not-allowed"
        >
          {saving ? "Guardando..." : isCreating ? "Crear Proyecto" : "Guardar Cambios"}
        </button>
      </div>
    </div>
  );
}
