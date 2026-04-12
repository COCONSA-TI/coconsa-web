"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import Link from "next/link";
import { useToast } from "@/components/ui/Toast";
import BankAccountManager from "@/components/admin/BankAccountManager";
import { OrderFormSkeleton } from "@/components/ui/Skeletons";

interface BankAccount {
  id: string;
  bank_name: string;
  account_number: string;
  clabe: string;
  is_primary: boolean;
}

interface NeedsListItem {
  id: string;
  description: string;
  quantity: number;
  unit: string;
  unit_price: number;
  subtotal: number;
}

interface NeedsListDetail {
  id: number;
  folio: string;
  created_at: string;
  user_name: string;
  user_email: string;
  total: number;
  status: string;
  justification: string;
  evidence_urls: string | null;
  items: NeedsListItem[];
  bank_account_id: string;
  bank_account: BankAccount;
  is_urgent: boolean;
  urgency_justification: string | null;
  is_definitive_rejection: boolean;
}

interface FormItem {
  id: string;
  nombre: string;
  cantidad: string;
  unidad: string;
  precioUnitario: string;
}

export default function EditarListaNecesidadesPage() {
  const router = useRouter();
  const params = useParams();
  const listId = params.id as string;
  const { user } = useAuth();
  const toast = useToast();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [originalList, setOriginalList] = useState<NeedsListDetail | null>(null);

  // Bank accounts
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [showAccountModal, setShowAccountModal] = useState(false);

  // Form state
  const [bankAccountId, setBankAccountId] = useState("");
  const [justification, setJustification] = useState("");
  const [items, setItems] = useState<FormItem[]>([
    { id: "1", nombre: "", cantidad: "1", unidad: "pza", precioUnitario: "" },
  ]);
  const [evidenceFiles, setEvidenceFiles] = useState<File[]>([]);
  const [existingEvidence, setExistingEvidence] = useState<string[]>([]);

  const fetchBankAccounts = async () => {
    try {
      const response = await fetch("/api/v1/bank-accounts");
      const data = await response.json();
      if (data.success) {
        setBankAccounts(data.data || []);
      }
    } catch (error) {
      console.error("Error al cargar cuentas bancarias:", error);
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);

        // Fetch the existing needs list
        const response = await fetch(`/api/v1/needs-lists/${listId}`);
        const data = await response.json();

        if (!data.success) {
          throw new Error(data.error || "Error al cargar la lista");
        }

        const needsList = data.needsList as NeedsListDetail;
        setOriginalList(needsList);

        // Verify that the list is rejected
        if (needsList.status !== "rejected") {
          setError("Solo se pueden editar listas rechazadas");
          return;
        }

        // Verify it's not a definitive rejection
        if (needsList.is_definitive_rejection) {
          setError("Esta lista fue rechazada de forma definitiva y no puede ser editada ni reenviada");
          return;
        }

        // Verify the user is the owner
        if (user?.email !== needsList.user_email) {
          setError("Solo el solicitante original puede editar esta lista");
          return;
        }

        // Load existing evidence
        if (needsList.evidence_urls) {
          setExistingEvidence(needsList.evidence_urls.split(","));
        }

        // Pre-fill form
        setBankAccountId(needsList.bank_account_id);
        setJustification(needsList.justification);

        // Pre-fill items
        if (needsList.items && needsList.items.length > 0) {
          const mappedItems: FormItem[] = needsList.items.map((item, index) => ({
            id: (index + 1).toString(),
            nombre: item.description,
            cantidad: item.quantity.toString(),
            unidad: item.unit,
            precioUnitario: item.unit_price.toString(),
          }));
          setItems(mappedItems);
        }

        // Fetch bank accounts
        await fetchBankAccounts();
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "Error al cargar la lista";
        setError(errorMessage);
      } finally {
        setLoading(false);
      }
    };

    if (user) {
      fetchData();
    }
  }, [listId, user]);

  const handleItemChange = (id: string, field: keyof FormItem, value: string) => {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, [field]: value } : item))
    );
  };

  const addItem = () => {
    const newId = (Math.max(...items.map((i) => parseInt(i.id))) + 1).toString();
    setItems((prev) => [
      ...prev,
      { id: newId, nombre: "", cantidad: "1", unidad: "pza", precioUnitario: "" },
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

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("es-MX", {
      style: "currency",
      currency: "MXN",
    }).format(amount);
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

    // Validations
    if (!bankAccountId) {
      setError("Por favor selecciona una cuenta bancaria");
      return;
    }

    const validItems = items.filter(
      (item) =>
        item.nombre &&
        item.cantidad &&
        item.unidad &&
        item.precioUnitario
    );

    if (validItems.length === 0) {
      setError("Debes agregar al menos un concepto válido");
      return;
    }

    if (!justification || justification.length < 10) {
      setError("La justificación debe tener al menos 10 caracteres");
      return;
    }

    // Verify evidence exists
    if (existingEvidence.length === 0 && evidenceFiles.length === 0) {
      setError("Debes tener al menos un archivo de evidencia");
      return;
    }

    // Prepare data
    const listData = {
      bank_account_id: bankAccountId,
      justification: justification,
      items: validItems.map((item) => ({
        description: item.nombre,
        quantity: parseFloat(item.cantidad),
        unit: item.unidad,
        unit_price: parseFloat(item.precioUnitario),
      })),
      existing_evidence: existingEvidence,
    };

    setSubmitting(true);

    try {
      const formDataToSend = new FormData();
      formDataToSend.append("listData", JSON.stringify(listData));

      // Add new evidence files
      evidenceFiles.forEach((file) => {
        formDataToSend.append("evidence", file);
      });

      const response = await fetch(`/api/v1/needs-lists/${listId}`, {
        method: "PUT",
        body: formDataToSend,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Error al actualizar la lista");
      }

      toast.success("Lista actualizada", "La lista se ha reenviado para aprobación");
      router.push(`/dashboard/listas-necesidades/${listId}`);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Error desconocido";
      setError(errorMessage);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <OrderFormSkeleton />;
  }

  if (error && !originalList) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
          <svg className="w-12 h-12 text-red-500 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <h2 className="text-lg font-semibold text-red-900 mb-2">Error</h2>
          <p className="text-red-700 mb-4">{error}</p>
          <Link
            href={`/dashboard/listas-necesidades/${listId}`}
            className="inline-flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Volver a la Lista
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-xl shadow-lg p-6 text-white">
        <div className="flex items-center gap-2 mb-4">
          <Link
            href={`/dashboard/listas-necesidades/${listId}`}
            className="inline-flex items-center gap-1 text-blue-100 hover:text-white transition-colors text-sm"
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
              <h1 className="text-2xl font-bold">Editar {originalList?.folio}</h1>
              <span className="px-3 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                Rechazada
              </span>
            </div>
            <p className="text-blue-100 text-sm mt-1">
              Modifica los datos y reenvía la lista para aprobación
            </p>
          </div>
        </div>
      </div>

      {/* Info message */}
      <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
        <div className="flex items-start gap-3">
          <svg className="w-5 h-5 text-yellow-600 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <div>
            <h3 className="font-medium text-yellow-800">Lista rechazada - Correcciones pendientes</h3>
            <p className="text-sm text-yellow-700 mt-1">
              Revisa los comentarios del rechazo y realiza las correcciones necesarias. 
              Al guardar, la lista se reenviará automáticamente para aprobación.
            </p>
          </div>
        </div>
      </div>

      {/* Error display */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-red-700">{error}</p>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Bank Account & Justification */}
        <div className="bg-white rounded-xl shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Información General</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Bank Account */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Cuenta Bancaria <span className="text-red-500">*</span>
              </label>
              <select
                value={bankAccountId}
                onChange={(e) => setBankAccountId(e.target.value)}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
              >
                <option value="">Selecciona una cuenta</option>
                {bankAccounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.bank_name} - ****{account.account_number.slice(-4)}
                    {account.is_primary && " (Principal)"}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => setShowAccountModal(true)}
                className="mt-2 text-sm text-blue-600 hover:text-blue-700"
              >
                + Administrar cuentas bancarias
              </button>
            </div>

            <div></div>

            {/* Justification */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Justificación <span className="text-red-500">*</span>
              </label>
              <textarea
                value={justification}
                onChange={(e) => setJustification(e.target.value)}
                rows={3}
                placeholder="Describe el motivo de esta lista de necesidades (mínimo 10 caracteres)"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
              />
            </div>
          </div>
        </div>

        {/* Items */}
        <div className="bg-white rounded-xl shadow p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Conceptos</h2>
            <button
              type="button"
              onClick={addItem}
              className="px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm flex items-center gap-1"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Agregar
            </button>
          </div>

          <div className="space-y-4">
            {items.map((item, index) => (
              <div key={item.id} className="bg-gray-50 rounded-lg p-4">
                <div className="flex justify-between items-start mb-3">
                  <span className="text-sm font-medium text-gray-500">Concepto #{index + 1}</span>
                  {items.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeItem(item.id)}
                      className="text-red-500 hover:text-red-700"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  <div className="sm:col-span-2 lg:col-span-4">
                    <label className="block text-xs font-medium text-gray-600 mb-1">Descripción</label>
                    <input
                      type="text"
                      value={item.nombre}
                      onChange={(e) => handleItemChange(item.id, "nombre", e.target.value)}
                      placeholder="Descripción del concepto"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 text-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Cantidad</label>
                    <input
                      type="number"
                      value={item.cantidad}
                      onChange={(e) => handleItemChange(item.id, "cantidad", e.target.value)}
                      min="0.01"
                      step="0.01"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 text-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Unidad</label>
                    <select
                      value={item.unidad}
                      onChange={(e) => handleItemChange(item.id, "unidad", e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 text-sm"
                    >
                      <option value="pza">Pieza</option>
                      <option value="kg">Kilogramo</option>
                      <option value="lt">Litro</option>
                      <option value="m">Metro</option>
                      <option value="m2">Metro²</option>
                      <option value="m3">Metro³</option>
                      <option value="caja">Caja</option>
                      <option value="paq">Paquete</option>
                      <option value="rollo">Rollo</option>
                      <option value="servicio">Servicio</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Precio Unitario</label>
                    <input
                      type="number"
                      value={item.precioUnitario}
                      onChange={(e) => handleItemChange(item.id, "precioUnitario", e.target.value)}
                      min="0"
                      step="0.01"
                      placeholder="$0.00"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 text-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Subtotal</label>
                    <div className="px-3 py-2 bg-gray-100 border border-gray-200 rounded-lg text-gray-900 text-sm font-medium">
                      {formatCurrency((parseFloat(item.cantidad) || 0) * (parseFloat(item.precioUnitario) || 0))}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Total */}
          <div className="mt-6 flex justify-end">
            <div className="bg-blue-50 border border-blue-200 rounded-lg px-6 py-3">
              <span className="text-sm text-blue-700 font-medium">Total: </span>
              <span className="text-lg font-bold text-blue-900">{formatCurrency(calculateTotal())}</span>
            </div>
          </div>
        </div>

        {/* Evidence */}
        <div className="bg-white rounded-xl shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Evidencias</h2>

          {/* Existing Evidence */}
          {existingEvidence.length > 0 && (
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">Archivos existentes</label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {existingEvidence.map((url, index) => {
                  const fileName = url.split("/").pop() || `Archivo ${index + 1}`;
                  return (
                    <div key={index} className="flex items-center justify-between bg-gray-50 rounded-lg p-3">
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                        </svg>
                        <span className="text-sm text-gray-700 truncate">{fileName}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeExistingEvidence(index)}
                        className="ml-2 text-red-500 hover:text-red-700"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* New Files Upload */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Agregar nuevos archivos
            </label>
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 hover:border-blue-500 transition-colors">
              <input
                type="file"
                multiple
                accept=".pdf,.jpg,.jpeg,.png,.xls,.xlsx,.doc,.docx"
                onChange={handleFileChange}
                className="hidden"
                id="evidence-upload"
              />
              <label
                htmlFor="evidence-upload"
                className="flex flex-col items-center cursor-pointer"
              >
                <svg className="w-8 h-8 text-gray-400 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
                <span className="text-sm text-gray-600">Click para seleccionar archivos</span>
                <span className="text-xs text-gray-500 mt-1">PDF, imágenes, Excel, Word</span>
              </label>
            </div>

            {/* New files list */}
            {evidenceFiles.length > 0 && (
              <div className="mt-3 space-y-2">
                {evidenceFiles.map((file, index) => (
                  <div key={index} className="flex items-center justify-between p-2 bg-blue-50 rounded-lg">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      <span className="text-sm text-gray-700 truncate">{file.name}</span>
                      <span className="text-xs text-gray-500">({formatFileSize(file.size)})</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeFile(index)}
                      className="ml-2 text-red-500 hover:text-red-700"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <p className="text-xs text-gray-500 mt-2">
            * Se requiere al menos un archivo de evidencia
          </p>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-4">
          <Link
            href={`/dashboard/listas-necesidades/${listId}`}
            className="px-6 py-2.5 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 font-medium"
          >
            Cancelar
          </Link>
          <button
            type="submit"
            disabled={submitting}
            className="px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium flex items-center gap-2"
          >
            {submitting ? (
              <>
                <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Guardando...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
                Guardar y Reenviar
              </>
            )}
          </button>
        </div>
      </form>

      {/* Bank Account Manager Modal */}
      <BankAccountManager
        isOpen={showAccountModal}
        onClose={() => setShowAccountModal(false)}
        onAccountAdded={fetchBankAccounts}
      />
    </div>
  );
}
