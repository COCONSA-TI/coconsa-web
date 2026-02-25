"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import Link from "next/link";

interface Item {
  id: string;
  nombre: string;
  cantidad: string;
  unidad: string;
  precioUnitario: string;
  proveedor: string;
}

interface OrderDetail {
  id: string;
  created_at: string;
  store_name: string;
  supplier_name: string;
  total: number;
  currency: string;
  status: string;
  applicant_name: string;
  applicant_email: string;
  justification: string;
  justification_prove: string | null;
  retention: number | null;
  items: {
    id: string;
    name: string;
    quantity: number;
    unit: string;
    unit_price: number;
    subtotal: number;
    supplier_name: string;
  }[];
}

function SearchableSupplierSelect({
  value,
  suppliers,
  onChange,
  focusColor = "red",
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
                className={`w-full px-3 py-2 text-left text-sm hover:bg-red-50 transition-colors ${
                  supplier === value ? "bg-red-50 text-red-700 font-medium" : "text-gray-900"
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

export default function EditarOrdenPage() {
  const router = useRouter();
  const params = useParams();
  const orderId = params.id as string;
  // Auth hook - user and isAdmin used for future permission checks
  useAuth();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [originalOrder, setOriginalOrder] = useState<OrderDetail | null>(null);

  const [availableStores, setAvailableStores] = useState<string[]>([]);
  const [availableSuppliers, setAvailableSuppliers] = useState<string[]>([]);

  const [formData, setFormData] = useState({
    store_name: "",
    justification: "",
    currency: "MXN",
    retention: "",
  });

  const [items, setItems] = useState<Item[]>([
    { id: "1", nombre: "", cantidad: "", unidad: "pza", precioUnitario: "", proveedor: "" },
  ]);

  const [evidenceFiles, setEvidenceFiles] = useState<File[]>([]);
  const [existingEvidence, setExistingEvidence] = useState<string[]>([]);
  const [uploadingFiles, setUploadingFiles] = useState(false);

  // Cargar datos iniciales
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);

        // Obtener la orden existente
        const orderResponse = await fetch(`/api/v1/orders/${orderId}`);
        const orderData = await orderResponse.json();

        if (!orderData.success) {
          throw new Error(orderData.error || "Error al cargar la orden");
        }

        const order = orderData.order as OrderDetail;
        setOriginalOrder(order);

        // Verificar que la orden esté rechazada
        if (order.status !== "rejected") {
          setError("Solo se pueden editar órdenes rechazadas");
          return;
        }

        // Cargar evidencias existentes
        if (order.justification_prove) {
          setExistingEvidence(order.justification_prove.split(","));
        }

        // Cargar almacenes y proveedores disponibles
        const botResponse = await fetch("/api/v1/bot", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: "init" }),
        });

        if (botResponse.ok) {
          const botData = await botResponse.json();
          if (botData.availableStores && Array.isArray(botData.availableStores)) {
            setAvailableStores(botData.availableStores.map((store: { name: string }) => store.name));
          }
          if (botData.availableSuppliers && Array.isArray(botData.availableSuppliers)) {
            setAvailableSuppliers(botData.availableSuppliers.map((supplier: { commercial_name: string }) => supplier.commercial_name));
          }
        }

        // Pre-llenar el formulario con datos existentes
        setFormData({
          store_name: order.store_name || "",
          justification: order.justification || "",
          currency: order.currency || "MXN",
          retention: order.retention?.toString() || "",
        });

        // Pre-llenar items
        if (order.items && order.items.length > 0) {
          const mappedItems: Item[] = order.items.map((item, index) => ({
            id: (index + 1).toString(),
            nombre: item.name,
            cantidad: item.quantity.toString(),
            unidad: item.unit,
            precioUnitario: item.unit_price.toString(),
            proveedor: item.supplier_name || order.supplier_name,
          }));
          setItems(mappedItems);
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "Error al cargar la orden";
        setError(errorMessage);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [orderId]);

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
      { id: newId, nombre: "", cantidad: "", unidad: "pza", precioUnitario: "", proveedor: "" },
    ]);
  };

  const removeItem = (id: string) => {
    if (items.length > 1) {
      setItems((prev) => prev.filter((item) => item.id !== id));
    }
  };

  const calculateTotal = () => {
    return items.reduce((total, item) => {
      const cantidad = parseFloat(item.cantidad) || 0;
      const precio = parseFloat(item.precioUnitario) || 0;
      return total + cantidad * precio;
    }, 0);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files);
      setEvidenceFiles((prev) => [...prev, ...newFiles]);
    }
  };

  const removeFile = (index: number) => {
    setEvidenceFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const removeExistingEvidence = (index: number) => {
    setExistingEvidence((prev) => prev.filter((_, i) => i !== index));
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validaciones
    if (!formData.store_name) {
      setError("Por favor selecciona un almacén u obra");
      return;
    }

    const validItems = items.filter(
      (item) =>
        item.nombre &&
        item.cantidad &&
        item.unidad &&
        item.precioUnitario &&
        item.proveedor
    );

    if (validItems.length === 0) {
      setError("Debes agregar al menos un artículo válido con su proveedor");
      return;
    }

    if (!formData.justification || formData.justification.length < 10) {
      setError("La justificación debe tener al menos 10 caracteres");
      return;
    }

    // Verificar que hay evidencias (existentes o nuevas)
    if (existingEvidence.length === 0 && evidenceFiles.length === 0) {
      setError("Debes tener al menos un archivo de evidencia");
      return;
    }

    // Preparar datos
    const orderData = {
      store_name: formData.store_name,
      justification: formData.justification,
      currency: formData.currency,
      retention: formData.retention || "",
      items: validItems.map((item) => ({
        nombre: item.nombre,
        cantidad: parseFloat(item.cantidad),
        unidad: item.unidad,
        precioUnitario: parseFloat(item.precioUnitario),
        proveedor: item.proveedor,
        precioTotal: parseFloat(item.cantidad) * parseFloat(item.precioUnitario),
      })),
    };

    setSubmitting(true);
    setUploadingFiles(evidenceFiles.length > 0);

    try {
      const formDataToSend = new FormData();
      formDataToSend.append("orderData", JSON.stringify(orderData));

      // Agregar archivos de evidencia nuevos
      evidenceFiles.forEach((file) => {
        formDataToSend.append("evidence", file);
      });

      const response = await fetch(`/api/v1/orders/${orderId}`, {
        method: "PUT",
        body: formDataToSend,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Error al actualizar la orden");
      }

      // Redirigir a la página de detalles
      router.push(`/dashboard/ordenes-compra/${orderId}`);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Error desconocido";
      setError(errorMessage);
    } finally {
      setSubmitting(false);
      setUploadingFiles(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Cargando orden...</p>
        </div>
      </div>
    );
  }

  if (error && !originalOrder) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
          <svg className="w-12 h-12 text-red-500 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <h2 className="text-lg font-semibold text-red-900 mb-2">Error</h2>
          <p className="text-red-700 mb-4">{error}</p>
          <Link
            href={`/dashboard/ordenes-compra/${orderId}`}
            className="inline-flex items-center gap-2 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Volver a la Orden
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-red-600 to-red-700 rounded-xl shadow-lg p-6 text-white">
        <div className="flex items-center gap-2 mb-4">
          <Link
            href={`/dashboard/ordenes-compra/${orderId}`}
            className="inline-flex items-center gap-1 text-red-100 hover:text-white transition-colors text-sm"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Volver a Detalles
          </Link>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold">Editar Orden #{orderId}</h1>
              <span className="px-3 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                Rechazada
              </span>
            </div>
            <p className="text-red-100 text-sm mt-1">
              Modifica los datos y reenvía la orden para aprobación
            </p>
          </div>
        </div>
      </div>

      {/* Mensaje informativo */}
      <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
        <div className="flex items-start gap-3">
          <svg className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          <div>
            <h3 className="text-sm font-semibold text-yellow-800">Orden Rechazada</h3>
            <p className="text-sm text-yellow-700 mt-1">
              Esta orden fue rechazada. Puedes modificar los datos y reenviarla para una nueva revisión.
              Al guardar, el flujo de aprobaciones se reiniciará.
            </p>
          </div>
        </div>
      </div>

      {/* Formulario */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Mensajes de error */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-lg">
            <strong>Error:</strong> {error}
          </div>
        )}

        {/* Información del Solicitante */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Información del Solicitante</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Solicitante</label>
              <input
                type="text"
                value={originalOrder?.applicant_name || ""}
                readOnly
                className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-900 cursor-not-allowed"
              />
              <p className="text-xs text-gray-500 mt-1">{originalOrder?.applicant_email}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Almacén u Obra <span className="text-red-500">*</span>
              </label>
              <select
                name="store_name"
                value={formData.store_name}
                onChange={handleInputChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent text-gray-900"
                required
              >
                <option value="">Selecciona un almacen u obra</option>
                {availableStores.map((store) => (
                  <option key={store} value={store}>
                    {store}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Artículos */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Artículos / Servicios</h3>
            <button
              type="button"
              onClick={addItem}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm font-medium"
            >
              + Agregar Artículo
            </button>
          </div>

          <div className="space-y-4">
            {items.map((item, index) => (
              <div key={item.id} className="border border-gray-200 p-4 rounded-lg bg-gray-50">
                <div className="flex items-start justify-between mb-3">
                  <span className="text-sm font-semibold text-gray-700">Artículo {index + 1}</span>
                  {items.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeItem(item.id)}
                      className="text-red-600 hover:text-red-800 text-sm font-medium"
                    >
                      Eliminar
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                  <div className="md:col-span-2">
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      Nombre del Artículo
                    </label>
                    <input
                      type="text"
                      value={item.nombre}
                      onChange={(e) => handleItemChange(item.id, "nombre", e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent text-sm text-gray-900"
                      placeholder="Ej: Cemento gris 50kg"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      Proveedor <span className="text-red-500">*</span>
                    </label>
                    <SearchableSupplierSelect
                      value={item.proveedor}
                      suppliers={availableSuppliers}
                      onChange={(val) => handleItemChange(item.id, "proveedor", val)}
                      focusColor="red"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Cantidad</label>
                    <input
                      type="number"
                      step="0.01"
                      value={item.cantidad}
                      onChange={(e) => handleItemChange(item.id, "cantidad", e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent text-sm text-gray-900"
                      placeholder="100"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Unidad</label>
                    <select
                      value={item.unidad}
                      onChange={(e) => handleItemChange(item.id, "unidad", e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent text-sm text-gray-900"
                    >
                      <option value="pza">Pieza</option>
                      <option value="kg">Kilogramo</option>
                      <option value="m">Metro</option>
                      <option value="m2">Metro cuadrado</option>
                      <option value="m3">Metro cubico</option>
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
                      onChange={(e) => handleItemChange(item.id, "precioUnitario", e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent text-sm text-gray-900"
                      placeholder="150.00"
                    />
                  </div>
                </div>
                {item.cantidad && item.precioUnitario && (
                  <div className="mt-3 pt-3 border-t border-gray-300 flex justify-between items-center">
                    <span className="text-sm text-gray-600">
                      {item.proveedor && (
                        <span className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded mr-2">
                          {item.proveedor}
                        </span>
                      )}
                    </span>
                    <div className="text-sm text-gray-600">
                      <span className="font-semibold">Subtotal: </span>
                      {formData.currency} $
                      {(parseFloat(item.cantidad) * parseFloat(item.precioUnitario)).toFixed(2)}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Total */}
          <div className="mt-4 pt-4 border-t border-gray-300">
            <div className="flex justify-between items-center">
              <span className="text-lg font-bold text-gray-900">Total General:</span>
              <span className="text-2xl font-bold text-red-600">
                {formData.currency} ${calculateTotal().toFixed(2)}
              </span>
            </div>
          </div>
        </div>

        {/* Detalles Adicionales */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Detalles Adicionales</h3>
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
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent text-gray-900"
                placeholder="Describe el motivo de esta compra..."
                required
              />
            </div>

            {/* Evidencias existentes */}
            {existingEvidence.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Evidencias Actuales
                </label>
                <div className="space-y-2">
                  {existingEvidence.map((url, index) => {
                    const fileName = url.split("/").pop() || `Archivo ${index + 1}`;
                    const isImage = /\.(jpg|jpeg|png|gif|webp)$/i.test(url);
                    const isPdf = /\.pdf$/i.test(url);

                    return (
                      <div
                        key={index}
                        className="flex items-center justify-between bg-gray-50 p-3 rounded-lg border border-gray-200"
                      >
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <div
                            className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                              isImage ? "bg-purple-100" : isPdf ? "bg-red-100" : "bg-gray-200"
                            }`}
                          >
                            {isImage ? (
                              <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                              </svg>
                            ) : isPdf ? (
                              <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                              </svg>
                            ) : (
                              <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                              </svg>
                            )}
                          </div>
                          <p className="text-sm text-gray-700 truncate">{fileName}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <a
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                            </svg>
                          </a>
                          <button
                            type="button"
                            onClick={() => removeExistingEvidence(index)}
                            className="p-2 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Subir nuevas evidencias */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Agregar Nuevas Evidencias
              </label>
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 hover:border-red-400 transition-colors">
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
                  <span className="text-xs text-gray-500 mt-1">
                    Imagenes, PDF, Word, Excel (max. 50MB por archivo)
                  </span>
                </label>
              </div>

              {/* Lista de archivos nuevos */}
              {evidenceFiles.length > 0 && (
                <div className="mt-3 space-y-2">
                  <p className="text-sm font-medium text-gray-700">
                    Archivos nuevos ({evidenceFiles.length}):
                  </p>
                  {evidenceFiles.map((file, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between bg-green-50 p-2 rounded-lg border border-green-200"
                    >
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <span className="text-lg">
                          {file.type.startsWith("image/")
                            ? "imagen"
                            : file.type === "application/pdf"
                            ? "PDF"
                            : file.type.includes("word")
                            ? "Word"
                            : file.type.includes("excel") || file.type.includes("spreadsheet")
                            ? "Excel"
                            : "archivo"}
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
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent text-gray-900"
                >
                  <option value="MXN">MXN - Pesos Mexicanos</option>
                  <option value="USD">USD - Dolares</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Retencion (Opcional)
                </label>
                <input
                  type="text"
                  name="retention"
                  value={formData.retention}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent text-gray-900"
                  placeholder="Ej: IVA 16%"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Botones de acción */}
        <div className="flex flex-col sm:flex-row justify-end gap-3">
          <Link
            href={`/dashboard/ordenes-compra/${orderId}`}
            className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium text-center"
          >
            Cancelar
          </Link>
          <button
            type="submit"
            disabled={submitting}
            className="px-8 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors font-semibold"
          >
            {submitting
              ? uploadingFiles
                ? "Subiendo archivos..."
                : "Guardando..."
              : "Guardar y Reenviar"}
          </button>
        </div>
      </form>
    </div>
  );
}
