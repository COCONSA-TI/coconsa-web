"use client";

import { useState } from "react";
import { Project, Contact } from "@/types/project";

interface ContactsTabProps {
  formData: Project;
  setFormData: (data: Project) => void;
}

export default function ContactsTab({
  formData,
  setFormData,
}: ContactsTabProps) {
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [currentContact, setCurrentContact] = useState<Contact>({
    name: "",
    role: "",
    phone: "",
    email: "",
  });

  const handleAdd = () => {
    if (
      !currentContact.name ||
      !currentContact.role ||
      !currentContact.phone ||
      !currentContact.email
    ) {
      alert("Todos los campos son obligatorios");
      return;
    }

    const updatedContacts = [...formData.contacts, currentContact];
    setFormData({ ...formData, contacts: updatedContacts });
    setCurrentContact({ name: "", role: "", phone: "", email: "" });
  };

  const handleEdit = (index: number) => {
    setEditingIndex(index);
    setCurrentContact(formData.contacts[index]);
  };

  const handleUpdate = () => {
    if (editingIndex === null) return;

    const updatedContacts = [...formData.contacts];
    updatedContacts[editingIndex] = currentContact;
    setFormData({ ...formData, contacts: updatedContacts });
    setEditingIndex(null);
    setCurrentContact({ name: "", role: "", phone: "", email: "" });
  };

  const handleDelete = (index: number) => {
    if (confirm("¿Estás seguro de eliminar este contacto?")) {
      const updatedContacts = formData.contacts.filter((_, i) => i !== index);
      setFormData({ ...formData, contacts: updatedContacts });
    }
  };

  const handleCancel = () => {
    setEditingIndex(null);
    setCurrentContact({ name: "", role: "", phone: "", email: "" });
  };

  return (
    <div className="space-y-6">
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <svg className="w-6 h-6 text-[#e52b2d] flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
          <div>
            <h4 className="font-semibold text-red-900 mb-1">
              Contactos del Proyecto
            </h4>
            <p className="text-sm text-red-700">
              Agrega las personas de contacto relevantes para el proyecto.
            </p>
          </div>
        </div>
      </div>

      {/* Form */}
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
        <h4 className="font-semibold text-gray-900 mb-4">
          {editingIndex !== null ? "Editar Contacto" : "Agregar Nuevo Contacto"}
        </h4>

        <div className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            {/* Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Nombre Completo <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={currentContact.name}
                onChange={(e) =>
                  setCurrentContact({ ...currentContact, name: e.target.value })
                }
                placeholder="María González"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#e52b2d] focus:border-transparent text-gray-900"
              />
            </div>

            {/* Position */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Cargo <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={currentContact.role}
                onChange={(e) =>
                  setCurrentContact({ ...currentContact, role: e.target.value })
                }
                placeholder="Coordinadora de Proyecto"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#e52b2d] focus:border-transparent text-gray-900"
              />
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
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
                  value={currentContact.phone}
                  onChange={(e) =>
                    setCurrentContact({ ...currentContact, phone: e.target.value })
                  }
                  placeholder="+52 123 456 7890"
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#e52b2d] focus:border-transparent text-gray-900"
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
                  value={currentContact.email}
                  onChange={(e) =>
                    setCurrentContact({ ...currentContact, email: e.target.value })
                  }
                  placeholder="contacto@ejemplo.com"
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#e52b2d] focus:border-transparent text-gray-900"
                />
              </div>
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
                Agregar Contacto
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Contacts List */}
      <div>
        <h4 className="font-semibold text-gray-900 mb-3">
          Lista de Contactos ({formData.contacts.length})
        </h4>

        {formData.contacts.length === 0 ? (
          <div className="text-center py-8 bg-gray-50 rounded-lg border border-gray-200">
            <svg className="w-12 h-12 mx-auto mb-2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            <p className="text-gray-500">
              No hay contactos agregados. Añade el primer contacto del proyecto.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {formData.contacts.map((contact, index) => (
              <div
                key={index}
                className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3 flex-1">
                    <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0">
                      <svg className="w-6 h-6 text-[#e52b2d]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <h5 className="font-semibold text-gray-900">
                        {contact.name}
                      </h5>
                      <p className="text-sm text-gray-600 mb-2">
                        {contact.role}
                      </p>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 text-sm text-gray-700">
                          <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                          </svg>
                          <span>{contact.phone}</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-gray-700">
                          <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                          </svg>
                          <span>{contact.email}</span>
                        </div>
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
