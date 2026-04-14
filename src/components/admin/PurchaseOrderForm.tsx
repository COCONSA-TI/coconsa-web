"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { RETENTION_OPTIONS, calculateRetentions } from "@/types/database";

interface Item {
  id: string;
  nombre: string;
  cantidad: string;
  unidad: string;
  precioUnitario: string;
}

interface OrderData {
  applicant_name: string;
  store_name: string;
  supplier_name: string;
  justification: string;
  currency: string;
  retention: string;
  payment_type: string;
  tax_type: string;
  iva_percentage: number;
  items: Item[];
  total: number;
}

interface PurchaseOrderFormProps {
  onSubmit?: (data: OrderData) => void;
}

const MACHINE_STORE_CODE_REGEX = /^(CG|AT|C|V)\s*0*(\d+)$/i;
const MACHINE_PREFIX_ORDER: Record<string, number> = {
  C: 1,
  V: 2,
  AT: 3,
  CG: 4,
};

function SearchableSupplierSelect({
  value,
  suppliers,
  onChange,
  focusColor = "blue",
}: {
  value: string;
  suppliers: string[];
  onChange: (value: string) => void;
  focusColor?: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = suppliers.filter((s) =>
    s.toLowerCase().includes(search.toLowerCase())
  );

  const handleClickOutside = useCallback((e: MouseEvent) => {
    if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
      setIsOpen(false);
      setSearch("");
    }
  }, []);

  useEffect(() => {
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [handleClickOutside]);

  const handleSelect = (supplier: string) => {
    onChange(supplier);
    setIsOpen(false);
    setSearch("");
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange("");
    setSearch("");
    setIsOpen(false);
  };

  const ringColor = focusColor === "red" ? "focus:ring-red-500" : "focus:ring-blue-500";

  return (
    <div ref={containerRef} className="relative">
      {!isOpen ? (
        <button
          type="button"
          onClick={() => {
            setIsOpen(true);
            setTimeout(() => inputRef.current?.focus(), 0);
          }}
          className={`w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-left flex items-center justify-between ${ringColor} focus:ring-2 focus:border-transparent ${
            value ? "text-gray-900" : "text-gray-500"
          }`}
        >
          <span className="truncate">{value || "Selecciona proveedor"}</span>
          <div className="flex items-center gap-1 flex-shrink-0">
            {value && (
              <span
                onClick={handleClear}
                className="text-gray-400 hover:text-gray-600 p-0.5"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </span>
            )}
            <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </button>
      ) : (
        <input
          ref={inputRef}
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar proveedor..."
          className={`w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 ${ringColor} focus:ring-2 focus:border-transparent`}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              setIsOpen(false);
              setSearch("");
            }
            if (e.key === "Enter" && filtered.length === 1) {
              e.preventDefault();
              handleSelect(filtered[0]);
            }
          }}
        />
      )}
      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="px-3 py-2 text-sm text-gray-500">
              Sin resultados
            </div>
          ) : (
            filtered.map((supplier) => (
              <button
                key={supplier}
                type="button"
                onClick={() => handleSelect(supplier)}
                className={`w-full px-3 py-2 text-left text-sm hover:bg-blue-50 transition-colors ${
                  supplier === value ? "bg-blue-50 text-blue-700 font-medium" : "text-gray-900"
                }`}
              >
                {supplier}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

export default function PurchaseOrderForm({ onSubmit }: PurchaseOrderFormProps) {
  const [currentUser, setCurrentUser] = useState<{name: string, email: string, isDepartmentHead: boolean} | null>(null);
  const [availableStores, setAvailableStores] = useState<string[]>([]);
  const [availableSuppliers, setAvailableSuppliers] = useState<string[]>([]);
  const [formData, setFormData] = useState({
    applicant_name: "",
    store_name: "",
    supplier_name: "",
    justification: "",
    currency: "MXN",
    selectedRetentions: [] as string[],
    payment_type: "",
    tax_type: "sin_iva",
    iva_percentage: 16,
    is_urgent: false,
    urgency_justification: "",
  });

  const [items, setItems] = useState<Item[]>([
    { id: "1", nombre: "", cantidad: "", unidad: "pza", precioUnitario: "" },
  ]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [evidenceFiles, setEvidenceFiles] = useState<File[]>([]);
  const [uploadingFiles, setUploadingFiles] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Obtener usuario actual
        const userResponse = await fetch('/api/v1/me');
        if (userResponse.ok) {
          const userData = await userResponse.json();
          setCurrentUser({ name: userData.user.full_name, email: userData.user.email, isDepartmentHead: userData.user.is_department_head || false });
          setFormData(prev => ({ ...prev, applicant_name: userData.user.full_name }));
        }

        // Obtener almacenes y proveedores disponibles
        const storesResponse = await fetch('/api/v1/stores-suppliers');

        if (storesResponse.ok) {
          const data = await storesResponse.json();
          if (data.stores && Array.isArray(data.stores)) {
            const sortedStores = data.stores
              .map((store: { name: string }) => store.name)
              .sort((a: string, b: string) => {
                const aTrim = a.trim();
                const bTrim = b.trim();
                const aMatch = aTrim.match(MACHINE_STORE_CODE_REGEX);
                const bMatch = bTrim.match(MACHINE_STORE_CODE_REGEX);

                if (aMatch && bMatch) {
                  const aPrefixRank = MACHINE_PREFIX_ORDER[aMatch[1].toUpperCase()] ?? 99;
                  const bPrefixRank = MACHINE_PREFIX_ORDER[bMatch[1].toUpperCase()] ?? 99;
                  if (aPrefixRank !== bPrefixRank) return aPrefixRank - bPrefixRank;

                  const aNumber = Number(aMatch[2]);
                  const bNumber = Number(bMatch[2]);
                  return aNumber - bNumber;
                }

                if (aMatch) return -1;
                if (bMatch) return 1;

                return aTrim.localeCompare(bTrim, "es", { sensitivity: "base" });
              });

            setAvailableStores(sortedStores);
          }
          if (data.suppliers && Array.isArray(data.suppliers)) {
            setAvailableSuppliers(data.suppliers.map((supplier: { commercial_name: string }) => supplier.commercial_name));
          }
        }
      } catch {
        // Error silencioso - se usarán listas vacías
      }
    };
    fetchData();
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleItemChange = (id: string, field: keyof Item, value: string) => {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, [field]: value } : item))
    );
  };

  const addItem = () => {
    const newId = (Math.max(...items.map((i) => parseInt(i.id))) + 1).toString();
    setItems((prev) => [
      ...prev,
      { id: newId, nombre: "", cantidad: "", unidad: "pza", precioUnitario: "" },
    ]);
  };

  const removeItem = (id: string) => {
    if (items.length > 1) {
      setItems((prev) => prev.filter((item) => item.id !== id));
    }
  };

  const calculateTotal = () => {
    const subtotal = items.reduce((total, item) => {
      const cantidad = parseFloat(item.cantidad) || 0;
      const precio = parseFloat(item.precioUnitario) || 0;
      return total + cantidad * precio;
    }, 0);
    return subtotal;
  };

  const calculateIva = () => {
    if (formData.tax_type !== 'con_iva') return 0;
    const subtotal = calculateTotal();
    return subtotal * (formData.iva_percentage / 100);
  };

  const calculateRetentionTotal = () => {
    if (formData.selectedRetentions.length === 0) return { totalRetention: 0, breakdown: [] };
    const subtotal = calculateTotal();
    const ivaAmount = calculateIva();
    return calculateRetentions(formData.selectedRetentions, subtotal, ivaAmount);
  };

  const calculateGrandTotal = () => {
    const { totalRetention } = calculateRetentionTotal();
    return calculateTotal() + calculateIva() - totalRetention;
  };

  const machineStores = availableStores.filter((store) =>
    MACHINE_STORE_CODE_REGEX.test(store.trim())
  );
  const nonMachineStores = availableStores.filter((store) =>
    !MACHINE_STORE_CODE_REGEX.test(store.trim())
  );

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files);
      setEvidenceFiles(prev => [...prev, ...newFiles]);
    }
  };

  const removeFile = (index: number) => {
    setEvidenceFiles(prev => prev.filter((_, i) => i !== index));
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    // Validación básica
    if (!formData.applicant_name || !formData.store_name) {
      setError("Por favor completa todos los campos requeridos");
      return;
    }

    const validItems = items.filter(
      (item) => item.nombre && item.cantidad && item.unidad && item.precioUnitario
    );

    if (validItems.length === 0) {
      setError("Debes agregar al menos un artículo válido");
      return;
    }

    if (!formData.supplier_name) {
      setError("Debes seleccionar un proveedor");
      return;
    }

    if (!formData.payment_type) {
      setError("Debes seleccionar un tipo de pago");
      return;
    }

    if (!formData.justification || formData.justification.length < 10) {
      setError("La justificación debe tener al menos 10 caracteres");
      return;
    }

    if (formData.is_urgent && (!formData.urgency_justification || formData.urgency_justification.trim().length < 10)) {
      setError("La justificación de urgencia debe tener al menos 10 caracteres");
      return;
    }

    if (evidenceFiles.length === 0) {
      setError("Debes adjuntar al menos un archivo de evidencia");
      return;
    }

    // Preparar datos para el endpoint
    const orderData = {
      applicant_name: formData.applicant_name,
      store_name: formData.store_name,
      supplier_name: formData.supplier_name,
      justification: formData.justification,
      currency: formData.currency,
      retention: formData.selectedRetentions.length > 0 ? JSON.stringify(formData.selectedRetentions) : '',
      payment_type: formData.payment_type,
      tax_type: formData.tax_type,
      iva_percentage: formData.tax_type === 'con_iva' ? formData.iva_percentage : 0,
      is_urgent: formData.is_urgent,
      urgency_justification: formData.is_urgent ? formData.urgency_justification : '',
      items: validItems.map((item) => ({
        nombre: item.nombre,
        cantidad: parseFloat(item.cantidad),
        unidad: item.unidad,
        precioUnitario: parseFloat(item.precioUnitario),
        proveedor: formData.supplier_name,
        precioTotal: parseFloat(item.cantidad) * parseFloat(item.precioUnitario),
      })),
    };

    setLoading(true);
    setUploadingFiles(evidenceFiles.length > 0);

      try {
        const uploadedUrls: string[] = [];

        // 1. Subir archivos de evidencia usando Presigned URLs directamente a Supabase (salta límite de 4.5MB Vercel)
        if (evidenceFiles.length > 0) {
          for (const file of evidenceFiles) {
            const urlRes = await fetch('/api/v1/storage/signed-url', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ fileName: file.name, contentType: file.type })
            });
            
            if (!urlRes.ok) throw new Error(`Error obteniendo permiso para subir archivo: ${file.name}`);
            const urlData = await urlRes.json();

            const uploadRes = await fetch(urlData.signedUrl, {
              method: 'PUT',
              headers: { 'Content-Type': file.type },
              body: file
            });

            if (!uploadRes.ok) throw new Error(`Error subiendo el archivo: ${file.name}`);

            uploadedUrls.push(urlData.publicUrl);
          }
        }

        // 2. Crear la orden (como JSON ligero)
        const finalOrderPayload = {
          ...orderData,
          evidenceUrls: uploadedUrls
        };

        const response = await fetch("/api/v1/orders/create", {
          method: "POST",
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(finalOrderPayload),
        });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Error al crear la orden");
      }

      setSuccess(true);
      setFormData({
        applicant_name: currentUser?.name || "",
        store_name: "",
        supplier_name: "",
        justification: "",
        currency: "MXN",
        selectedRetentions: [],
        payment_type: "",
        tax_type: "sin_iva",
        iva_percentage: 16,
        is_urgent: false,
        urgency_justification: "",
      });
      setItems([{ id: "1", nombre: "", cantidad: "", unidad: "pza", precioUnitario: "" }]);
      setEvidenceFiles([]);

      if (onSubmit) {
        onSubmit(data);
      }
      
      setTimeout(() => setSuccess(false), 5000);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error desconocido';
      setError(errorMessage);
      setTimeout(() => setError(null), 10000);
    } finally {
      setLoading(false);
      setUploadingFiles(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-4xl mx-auto">
      {/* Mensajes de estado */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-lg">
          <strong>Error:</strong> {error}
        </div>
      )}

      {success && (
        <div className="bg-green-50 border border-green-200 text-green-700 p-4 rounded-lg">
          <strong>¡Éxito!</strong> La orden de compra ha sido creada correctamente.
        </div>
      )}

      {/* Información General */}
      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Información General
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Nombre del Solicitante <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="applicant_name"
              value={formData.applicant_name || ""}
              readOnly
              className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-900 cursor-not-allowed"
              placeholder="Cargando..."
            />
            {currentUser && (
              <p className="text-xs text-gray-500 mt-1">Detectado automáticamente: {currentUser.email}</p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Centro de costos <span className="text-red-500">*</span>
            </label>
            <select
              name="store_name"
              value={formData.store_name || ""}
              onChange={handleInputChange}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
              required
            >
              <option value="">Selecciona un centro de costos</option>
              {machineStores.length > 0 && (
                <option value="__maquinaria_header__" disabled>
                  ----maquinaria----
                </option>
              )}
              {machineStores.map((store) => (
                <option key={store} value={store}>{store}</option>
              ))}
              {nonMachineStores.map((store) => (
                <option key={store} value={store}>{store}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Proveedor <span className="text-red-500">*</span>
            </label>
            <SearchableSupplierSelect
              value={formData.supplier_name}
              suppliers={availableSuppliers}
              onChange={(val) => setFormData((prev) => ({ ...prev, supplier_name: val }))}
            />
          </div>
        </div>
      </div>

      {/* Orden Urgente - Solo visible para jefes de departamento */}
      {currentUser?.isDepartmentHead && (
        <div className={`p-6 rounded-lg shadow-sm border ${formData.is_urgent ? 'bg-orange-50 border-orange-300' : 'bg-white border-gray-200'} transition-colors`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${formData.is_urgent ? 'bg-orange-500' : 'bg-gray-200'} transition-colors`}>
                <svg className={`w-5 h-5 ${formData.is_urgent ? 'text-white' : 'text-gray-500'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Orden Urgente</h3>
                <p className="text-sm text-gray-500">
                  Salta las aprobaciones de Gerencia y Contraloria (va directo a Direccion)
                </p>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={formData.is_urgent}
                onChange={(e) => setFormData(prev => ({ ...prev, is_urgent: e.target.checked }))}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-orange-300 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-orange-500"></div>
            </label>
          </div>

          {formData.is_urgent && (
            <div className="mt-4">
              <label className="block text-sm font-medium text-orange-800 mb-2">
                Justificacion de Urgencia <span className="text-red-500">*</span>
              </label>
              <textarea
                name="urgency_justification"
                value={formData.urgency_justification}
                onChange={handleInputChange}
                rows={2}
                className="w-full px-4 py-2 border border-orange-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent text-gray-900 bg-white"
                placeholder="Explica por que esta orden requiere tratamiento urgente (min. 10 caracteres)..."
                required
              />
              {formData.urgency_justification.length > 0 && formData.urgency_justification.length < 10 && (
                <p className="text-xs text-orange-600 mt-1">
                  Minimo 10 caracteres ({formData.urgency_justification.length}/10)
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Artículos */}
      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">
            Artículos / Servicios
          </h3>
          <button
            type="button"
            onClick={addItem}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
          >
            + Agregar Artículo
          </button>
        </div>

        <div className="space-y-4">
          {items.map((item, index) => (
            <div key={item.id} className="border border-gray-200 p-4 rounded-lg bg-gray-50">
              <div className="flex items-start justify-between mb-3">
                <span className="text-sm font-semibold text-gray-700">
                  Artículo {index + 1}
                </span>
                {items.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeItem(item.id)}
                    className="text-red-600 hover:text-red-800 text-sm font-medium"
                  >
                    ✕ Eliminar
                  </button>
                )}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="md:col-span-2">
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Nombre del Artículo
                  </label>
                  <input
                    type="text"
                    value={item.nombre}
                    onChange={(e) => handleItemChange(item.id, "nombre", e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm text-gray-900"
                    placeholder="Ej: Cemento gris 50kg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Cantidad
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={item.cantidad}
                    onChange={(e) => handleItemChange(item.id, "cantidad", e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm text-gray-900"
                    placeholder="100"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Unidad
                  </label>
                  <select
                    value={item.unidad}
                    onChange={(e) => handleItemChange(item.id, "unidad", e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm text-gray-900"
                  >
                    <option value="pza">Pieza</option>
                    <option value="kg">Kilogramo</option>
                    <option value="m">Metro</option>
                    <option value="m2">Metro²</option>
                    <option value="m3">Metro³</option>
                    <option value="lt">Litro</option>
                    <option value="caja">Caja</option>
                    <option value="paquete">Paquete</option>
                    <option value="servicio">Servicio</option>
                  </select>
                </div>
                <div className="md:col-span-2">
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Precio Unitario (sin IVA)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={item.precioUnitario}
                    onChange={(e) =>
                      handleItemChange(item.id, "precioUnitario", e.target.value)
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm text-gray-900"
                    placeholder="150.00"
                  />
                </div>
              </div>
              {item.cantidad && item.precioUnitario && (
                <div className="mt-3 pt-3 border-t border-gray-300 flex justify-end items-center">
                  <div className="text-sm text-gray-600">
                    <span className="font-semibold">Subtotal: </span>
                    {formData.currency} ${(parseFloat(item.cantidad) * parseFloat(item.precioUnitario)).toFixed(2)}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Totales */}
        <div className="mt-4 pt-4 border-t border-gray-300">
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Subtotal:</span>
              <span className="text-sm font-medium text-gray-900">
                {formData.currency} ${calculateTotal().toFixed(2)}
              </span>
            </div>
            {formData.tax_type === 'con_iva' && (
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">IVA ({formData.iva_percentage}%):</span>
                <span className="text-sm font-medium text-gray-900">
                  {formData.currency} ${calculateIva().toFixed(2)}
                </span>
              </div>
            )}
            {formData.selectedRetentions.length > 0 && (
              <>
                {calculateRetentionTotal().breakdown.map((ret, idx) => (
                  <div key={idx} className="flex justify-between items-center">
                    <span className="text-sm text-red-600">{ret.label}:</span>
                    <span className="text-sm font-medium text-red-600">
                      - {formData.currency} ${ret.amount.toFixed(2)}
                    </span>
                  </div>
                ))}
              </>
            )}
            <div className="flex justify-between items-center pt-2 border-t border-gray-200">
              <span className="text-lg font-bold text-gray-900">Total General:</span>
              <span className="text-2xl font-bold text-blue-600">
                {formData.currency} ${calculateGrandTotal().toFixed(2)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Detalles Adicionales */}
      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Detalles Adicionales
        </h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Justificación de la Compra <span className="text-red-500">*</span>
            </label>
            <textarea
              name="justification"
              value={formData.justification}
              onChange={handleInputChange}
              rows={3}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
              placeholder="Describe el motivo de esta compra..."
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Evidencias / Comprobantes <span className="text-red-500">*</span>
            </label>
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 hover:border-blue-400 transition-colors">
              <input
                type="file"
                id="evidence-upload"
                multiple
                accept="image/*,.pdf,.doc,.docx,.xls,.xlsx"
                onChange={handleFileChange}
                className="hidden"
              />
              <label
                htmlFor="evidence-upload"
                className="flex flex-col items-center justify-center cursor-pointer"
              >
                <svg className="w-10 h-10 text-gray-400 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
                <span className="text-sm text-gray-600 font-medium">Haz clic para subir archivos</span>
                <span className="text-xs text-gray-500 mt-1">Imágenes, PDF, Word, Excel (máx. 50MB por archivo)</span>
              </label>
            </div>
            
            {/* Lista de archivos seleccionados */}
            {evidenceFiles.length > 0 && (
              <div className="mt-3 space-y-2">
                <p className="text-sm font-medium text-gray-700">Archivos seleccionados ({evidenceFiles.length}):</p>
                {evidenceFiles.map((file, index) => (
                  <div key={index} className="flex items-center justify-between bg-gray-50 p-2 rounded-lg border border-gray-200">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <span className="text-lg">
                        {file.type.startsWith('image/') ? '🖼️' : 
                         file.type === 'application/pdf' ? '📄' : 
                         file.type.includes('word') ? '📝' : 
                         file.type.includes('excel') || file.type.includes('spreadsheet') ? '📊' : '📎'}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-gray-700 truncate">{file.name}</p>
                        <p className="text-xs text-gray-500">{formatFileSize(file.size)}</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeFile(index)}
                      className="text-red-500 hover:text-red-700 p-1 flex-shrink-0"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Moneda <span className="text-red-500">*</span>
              </label>
              <select
                name="currency"
                value={formData.currency}
                onChange={handleInputChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
              >
                <option value="MXN">MXN - Pesos Mexicanos</option>
                <option value="USD">USD - Dolares</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Tipo de Pago <span className="text-red-500">*</span>
              </label>
              <select
                name="payment_type"
                value={formData.payment_type}
                onChange={handleInputChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
                required
              >
                <option value="">Selecciona tipo de pago</option>
                <option value="credito">Credito</option>
                <option value="de_contado">De Contado</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Impuestos
              </label>
              <select
                name="tax_type"
                value={formData.tax_type}
                onChange={(e) => {
                  const newTaxType = e.target.value;
                  setFormData(prev => ({
                    ...prev,
                    tax_type: newTaxType,
                    // Limpiar retenciones si cambia a sin_iva
                    selectedRetentions: newTaxType === 'sin_iva' ? [] : prev.selectedRetentions,
                  }));
                }}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
              >
                <option value="sin_iva">Sin IVA</option>
                <option value="con_iva">Con IVA</option>
              </select>
            </div>
            {formData.tax_type === 'con_iva' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Porcentaje de IVA
                </label>
                <select
                  name="iva_percentage"
                  value={formData.iva_percentage}
                  onChange={(e) => setFormData(prev => ({ ...prev, iva_percentage: parseInt(e.target.value) }))}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
                >
                  <option value={16}>16%</option>
                  <option value={8}>8%</option>
                  <option value={0}>0% (Solo retenciones)</option>
                </select>
              </div>
            )}
          </div>

          {/* Retenciones (solo cuando hay IVA) */}
          {formData.tax_type === 'con_iva' && (
            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Retenciones (opcional)
              </label>
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-1">
                <p className="text-xs text-gray-500 mb-3">Selecciona las retenciones que aplican a esta orden. Se restaran del total.</p>
                <div className="space-y-3">
                  <div>
                    <p className="text-xs font-semibold text-gray-600 mb-2 uppercase tracking-wide">Retenciones de IVA</p>
                    <div className="space-y-2">
                      {RETENTION_OPTIONS.filter(o => o.type === 'iva').map(option => (
                        <label key={option.key} className="flex items-start gap-2 cursor-pointer group">
                          <input
                            type="checkbox"
                            checked={formData.selectedRetentions.includes(option.key)}
                            onChange={(e) => {
                              setFormData(prev => ({
                                ...prev,
                                selectedRetentions: e.target.checked
                                  ? [...prev.selectedRetentions, option.key]
                                  : prev.selectedRetentions.filter(k => k !== option.key),
                              }));
                            }}
                            className="mt-0.5 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          />
                          <span className="text-sm text-gray-700 group-hover:text-gray-900">{option.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                  <div className="border-t border-gray-200 pt-3">
                    <p className="text-xs font-semibold text-gray-600 mb-2 uppercase tracking-wide">Retenciones de ISR</p>
                    <div className="space-y-2">
                      {RETENTION_OPTIONS.filter(o => o.type === 'isr').map(option => (
                        <label key={option.key} className="flex items-start gap-2 cursor-pointer group">
                          <input
                            type="checkbox"
                            checked={formData.selectedRetentions.includes(option.key)}
                            onChange={(e) => {
                              setFormData(prev => ({
                                ...prev,
                                selectedRetentions: e.target.checked
                                  ? [...prev.selectedRetentions, option.key]
                                  : prev.selectedRetentions.filter(k => k !== option.key),
                              }));
                            }}
                            className="mt-0.5 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          />
                          <span className="text-sm text-gray-700 group-hover:text-gray-900">{option.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Botón de Envío */}
      <div className="flex justify-end gap-3">
        <button
          type="button"
          onClick={() => {
            setFormData({
              applicant_name: currentUser?.name || "",
              store_name: "",
              supplier_name: "",
              justification: "",
              currency: "MXN",
              selectedRetentions: [],
              payment_type: "",
              tax_type: "sin_iva",
              iva_percentage: 16,
              is_urgent: false,
              urgency_justification: "",
            });
            setItems([{ id: "1", nombre: "", cantidad: "", unidad: "pza", precioUnitario: "" }]);
            setEvidenceFiles([]);
          }}
          className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
        >
          Limpiar Formulario
        </button>
        <button
          type="submit"
          disabled={loading}
          className={`px-8 py-3 text-white rounded-lg disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors font-semibold ${
            formData.is_urgent
              ? 'bg-orange-600 hover:bg-orange-700'
              : 'bg-blue-600 hover:bg-blue-700'
          }`}
        >
          {loading 
            ? (uploadingFiles ? "Subiendo archivos..." : "Creando...") 
            : formData.is_urgent 
              ? "Crear Orden Urgente"
              : "Crear Orden de Compra"
          }
        </button>
      </div>
    </form>
  );
}
