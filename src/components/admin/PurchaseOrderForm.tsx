"use client";

import React, { useState, useEffect } from "react";

interface Item {
  id: string;
  nombre: string;
  cantidad: string;
  unidad: string;
  precioUnitario: string;
  proveedor: string;
}

interface OrderData {
  applicant_name: string;
  store_name: string;
  justification: string;
  currency: string;
  retention: string;
  items: Item[];
  total: number;
}

interface PurchaseOrderFormProps {
  onSubmit?: (data: OrderData) => void;
}

export default function PurchaseOrderForm({ onSubmit }: PurchaseOrderFormProps) {
  const [currentUser, setCurrentUser] = useState<{name: string, email: string} | null>(null);
  const [availableStores, setAvailableStores] = useState<string[]>([]);
  const [availableSuppliers, setAvailableSuppliers] = useState<string[]>([]);
  const [formData, setFormData] = useState({
    applicant_name: "",
    store_name: "",
    store_custom: "",
    justification: "",
    currency: "MXN",
    retention: "",
  });

  const [items, setItems] = useState<Item[]>([
    { id: "1", nombre: "", cantidad: "", unidad: "pza", precioUnitario: "", proveedor: "" },
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
          setCurrentUser({ name: userData.user.full_name, email: userData.user.email });
          setFormData(prev => ({ ...prev, applicant_name: userData.user.full_name }));
        }

        // Obtener almacenes y proveedores disponibles
        const botResponse = await fetch('/api/v1/bot', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: 'init' })
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

    // Determinar el nombre del almacén (si es custom o seleccionado)
    const storeName = formData.store_name === "custom" ? formData.store_custom : formData.store_name;

    // Validación básica
    if (!formData.applicant_name || !storeName) {
      setError("Por favor completa todos los campos requeridos");
      return;
    }

    const validItems = items.filter(
      (item) => item.nombre && item.cantidad && item.unidad && item.precioUnitario && item.proveedor && item.proveedor !== "custom"
    );

    if (validItems.length === 0) {
      setError("Debes agregar al menos un artículo válido con su proveedor");
      return;
    }

    if (!formData.justification || formData.justification.length < 10) {
      setError("La justificación debe tener al menos 10 caracteres");
      return;
    }

    if (evidenceFiles.length === 0) {
      setError("Debes adjuntar al menos un archivo de evidencia");
      return;
    }

    // Preparar datos para el endpoint - cada item ya tiene su proveedor
    const orderData = {
      applicant_name: formData.applicant_name,
      store_name: storeName,
      justification: formData.justification,
      currency: formData.currency,
      retention: formData.retention || '',
      items: validItems.map((item) => ({
        nombre: item.nombre,
        cantidad: parseFloat(item.cantidad),
        unidad: item.unidad,
        precioUnitario: parseFloat(item.precioUnitario),
        proveedor: item.proveedor,
        precioTotal: parseFloat(item.cantidad) * parseFloat(item.precioUnitario),
      })),
    };

    setLoading(true);
    setUploadingFiles(evidenceFiles.length > 0);

    try {
      // Crear FormData para enviar datos y archivos
      const formDataToSend = new FormData();
      formDataToSend.append('orderData', JSON.stringify(orderData));
      
      // Agregar archivos de evidencia
      evidenceFiles.forEach((file) => {
        formDataToSend.append('evidence', file);
      });

      const response = await fetch("/api/v1/orders/create", {
        method: "POST",
        body: formDataToSend,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Error al crear la orden");
      }

      setSuccess(true);
      setFormData({
        applicant_name: currentUser?.name || "",
        store_name: "",
        store_custom: "",
        justification: "",
        currency: "MXN",
        retention: "",
      });
      setItems([{ id: "1", nombre: "", cantidad: "", unidad: "pza", precioUnitario: "", proveedor: "" }]);
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

      {/* Información del Solicitante */}
      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Información del Solicitante
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
              Almacén u Obra <span className="text-red-500">*</span>
            </label>
            <select
              name="store_name"
              value={formData.store_name || ""}
              onChange={handleInputChange}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
              required
            >
              <option value="">Selecciona un almacén u obra</option>
              {availableStores.map((store) => (
                <option key={store} value={store}>{store}</option>
              ))}
              <option value="custom">✏️ Otro (personalizado)</option>
            </select>
            {formData.store_name === "custom" && (
              <input
                type="text"
                name="store_custom"
                value={formData.store_custom || ""}
                onChange={handleInputChange}
                className="w-full mt-2 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
                placeholder="Escribe el nombre del almacén u obra"
                required
              />
            )}
          </div>
        </div>
      </div>

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
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
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
                    Proveedor <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={item.proveedor}
                    onChange={(e) => handleItemChange(item.id, "proveedor", e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm text-gray-900"
                  >
                    <option value="">Selecciona proveedor</option>
                    {availableSuppliers.map((supplier) => (
                      <option key={supplier} value={supplier}>{supplier}</option>
                    ))}
                    <option value="custom">✏️ Otro (personalizado)</option>
                  </select>
                  {item.proveedor === "custom" && (
                    <input
                      type="text"
                      placeholder="Nombre del proveedor"
                      onChange={(e) => handleItemChange(item.id, "proveedor", e.target.value || "custom")}
                      className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm text-gray-900"
                    />
                  )}
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
                <div className="mt-3 pt-3 border-t border-gray-300 flex justify-between items-center">
                  <span className="text-sm text-gray-600">
                    {item.proveedor && item.proveedor !== "custom" && (
                      <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded mr-2">
                        {item.proveedor}
                      </span>
                    )}
                  </span>
                  <div className="text-sm text-gray-600">
                    <span className="font-semibold">Subtotal: </span>
                    {formData.currency} ${(parseFloat(item.cantidad) * parseFloat(item.precioUnitario)).toFixed(2)}
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
            <span className="text-2xl font-bold text-blue-600">
              {formData.currency} ${calculateTotal().toFixed(2)}
            </span>
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
                <option value="USD">USD - Dólares</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Retención (Opcional)
              </label>
              <input
                type="text"
                name="retention"
                value={formData.retention}
                onChange={handleInputChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
                placeholder="Ej: IVA 16%"
              />
            </div>
          </div>
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
              store_custom: "",
              justification: "",
              currency: "MXN",
              retention: "",
            });
            setItems([{ id: "1", nombre: "", cantidad: "", unidad: "pza", precioUnitario: "", proveedor: "" }]);
            setEvidenceFiles([]);
          }}
          className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
        >
          Limpiar Formulario
        </button>
        <button
          type="submit"
          disabled={loading}
          className="px-8 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors font-semibold"
        >
          {loading ? (uploadingFiles ? "Subiendo archivos..." : "Creando...") : "Crear Orden de Compra"}
        </button>
      </div>
    </form>
  );
}
