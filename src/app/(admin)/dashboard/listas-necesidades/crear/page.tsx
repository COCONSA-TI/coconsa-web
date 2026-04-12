'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import BankAccountManager from '@/components/admin/BankAccountManager';

interface BankAccount {
  id: string;
  bank_name: string;
  account_number: string;
  clabe: string | null;
  account_type: string;
  is_primary: boolean;
}

interface NeedsListItem {
  nombre: string;
  cantidad: number;
  unidad: string;
  precioUnitario: number;
  precioTotal?: number;
  descripcion?: string;
}

export default function CreateNeedsListPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [loadingAccounts, setLoadingAccounts] = useState(true);
  const [showAccountModal, setShowAccountModal] = useState(false);

  // Formulario
  const [bankAccountId, setBankAccountId] = useState('');
  const [storeName, setStoreName] = useState('');
  const [justification, setJustification] = useState('');
  const [currency, setCurrency] = useState('MXN');
  const [ivaPercentage, setIvaPercentage] = useState(16);
  const [isUrgent, setIsUrgent] = useState(false);
  const [urgencyJustification, setUrgencyJustification] = useState('');
  const [items, setItems] = useState<NeedsListItem[]>([
    { nombre: '', cantidad: 1, unidad: 'pza', precioUnitario: 0 },
  ]);
  const [evidenceFiles, setEvidenceFiles] = useState<File[]>([]);

  useEffect(() => {
    fetchBankAccounts();
  }, []);

  const fetchBankAccounts = async () => {
    try {
      const response = await fetch('/api/v1/bank-accounts');
      const data = await response.json();
      if (data.success) {
        setBankAccounts(data.data || []);
        // Seleccionar cuenta principal por defecto
        const primary = data.data?.find((acc: BankAccount) => acc.is_primary);
        if (primary) {
          setBankAccountId(primary.id);
        } else if (data.data?.length > 0) {
          setBankAccountId(data.data[0].id);
        }
      }
    } catch (error) {
      console.error('Error al cargar cuentas bancarias:', error);
    } finally {
      setLoadingAccounts(false);
    }
  };

  const addItem = () => {
    setItems([...items, { nombre: '', cantidad: 1, unidad: 'pza', precioUnitario: 0 }]);
  };

  const removeItem = (index: number) => {
    if (items.length > 1) {
      setItems(items.filter((_, i) => i !== index));
    }
  };

  const updateItem = (index: number, field: keyof NeedsListItem, value: any) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    setItems(newItems);
  };

  const calculateTotals = () => {
    const subtotal = items.reduce((sum, item) => {
      return sum + (item.cantidad * item.precioUnitario);
    }, 0);
    const iva = subtotal * (ivaPercentage / 100);
    const total = subtotal + iva;
    return { subtotal, iva, total };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!bankAccountId) {
      alert('Debes seleccionar una cuenta bancaria');
      return;
    }

    if (items.length === 0 || !items[0].nombre) {
      alert('Debes agregar al menos un item');
      return;
    }

    if (isUrgent && (!urgencyJustification || urgencyJustification.length < 10)) {
      alert('Las listas urgentes requieren una justificación de al menos 10 caracteres');
      return;
    }

    setLoading(true);

    try {
      const formData = new FormData();
      formData.append('bank_account_id', bankAccountId);
      formData.append('store_name', storeName);
      formData.append('justification', justification);
      formData.append('currency', currency);
      formData.append('iva_percentage', ivaPercentage.toString());
      formData.append('is_urgent', isUrgent.toString());
      if (isUrgent) {
        formData.append('urgency_justification', urgencyJustification);
      }
      formData.append('items', JSON.stringify(items));

      // Agregar archivos de evidencia
      evidenceFiles.forEach((file, index) => {
        formData.append(`evidence_${index}`, file);
      });

      const response = await fetch('/api/v1/needs-lists/create', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (data.success) {
        alert('Lista de necesidades creada exitosamente');
        router.push(`/dashboard/listas-necesidades/${data.data.id}`);
      } else {
        alert(data.error || 'Error al crear la lista');
      }
    } catch (error) {
      console.error('Error:', error);
      alert('Error al crear la lista de necesidades');
    } finally {
      setLoading(false);
    }
  };

  const { subtotal, iva, total } = calculateTotals();

  if (loadingAccounts) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Cargando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Nueva Lista de Necesidades</h1>
          <p className="mt-1 text-sm text-gray-600">
            Crea una solicitud de reembolso o anticipo
          </p>
        </div>
        <Link
          href="/dashboard/listas-necesidades"
          className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
        >
          Cancelar
        </Link>
      </div>

      {/* Alerta si no hay cuentas bancarias */}
      {bankAccounts.length === 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex">
            <svg className="w-5 h-5 text-yellow-600 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <div className="flex-1">
              <h3 className="text-sm font-medium text-yellow-800">No tienes cuentas bancarias registradas</h3>
              <p className="mt-1 text-sm text-yellow-700">
                Necesitas agregar al menos una cuenta bancaria para crear listas de necesidades.
              </p>
              <button
                onClick={() => setShowAccountModal(true)}
                className="mt-2 text-sm font-medium text-yellow-800 underline hover:text-yellow-900"
              >
                Agregar cuenta bancaria ahora
              </button>
            </div>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Información General */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Información General</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Cuenta Bancaria */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Cuenta Bancaria <span className="text-red-500">*</span>
              </label>
              <select
                value={bankAccountId}
                onChange={(e) => setBankAccountId(e.target.value)}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent text-gray-900"
              >
                <option value="">Selecciona una cuenta</option>
                {bankAccounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.bank_name} - {account.account_number.slice(-4)} 
                    {account.is_primary && ' (Principal)'}
                  </option>
                ))}
              </select>
              {bankAccounts.length > 0 && (
                <button
                  type="button"
                  onClick={() => setShowAccountModal(true)}
                  className="mt-2 text-sm text-red-600 hover:text-red-700"
                >
                  + Agregar nueva cuenta
                </button>
              )}
            </div>

            {/* Almacén/Obra */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Almacén/Obra
              </label>
              <input
                type="text"
                value={storeName}
                onChange={(e) => setStoreName(e.target.value)}
                placeholder="Nombre del almacén u obra"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent text-gray-900"
              />
            </div>

            {/* Moneda */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Moneda
              </label>
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent text-gray-900"
              >
                <option value="MXN">MXN (Pesos Mexicanos)</option>
                <option value="USD">USD (Dólares)</option>
              </select>
            </div>

            {/* IVA */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                IVA (%)
              </label>
              <select
                value={ivaPercentage}
                onChange={(e) => setIvaPercentage(Number(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent text-gray-900"
              >
                <option value="0">Sin IVA (0%)</option>
                <option value="8">IVA Frontera (8%)</option>
                <option value="16">IVA Normal (16%)</option>
              </select>
            </div>
          </div>

          {/* Justificación */}
          <div className="mt-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Justificación
            </label>
            <textarea
              value={justification}
              onChange={(e) => setJustification(e.target.value)}
              rows={3}
              placeholder="Describe el motivo de esta lista de necesidades"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent text-gray-900"
            />
          </div>

          {/* Lista Urgente */}
          <div className="mt-4">
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={isUrgent}
                onChange={(e) => setIsUrgent(e.target.checked)}
                className="rounded border-gray-300 text-red-600 focus:ring-red-500"
              />
              <span className="ml-2 text-sm font-medium text-gray-700">
                Marcar como urgente (saltará aprobación de gerencia)
              </span>
            </label>
            {isUrgent && (
              <div className="mt-3">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Justificación de Urgencia <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={urgencyJustification}
                  onChange={(e) => setUrgencyJustification(e.target.value)}
                  rows={2}
                  required={isUrgent}
                  placeholder="Explica por qué esta lista es urgente (mínimo 10 caracteres)"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent text-gray-900"
                />
              </div>
            )}
          </div>
        </div>

        {/* Items */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Items</h2>
            <button
              type="button"
              onClick={addItem}
              className="px-3 py-1 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700"
            >
              + Agregar Item
            </button>
          </div>

          <div className="space-y-4">
            {items.map((item, index) => (
              <div key={index} className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-start justify-between mb-3">
                  <span className="text-sm font-medium text-gray-700">Item #{index + 1}</span>
                  {items.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeItem(index)}
                      className="text-red-600 hover:text-red-700"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                  <div className="md:col-span-2">
                    <label className="block text-sm text-gray-600 mb-1">Nombre *</label>
                    <input
                      type="text"
                      value={item.nombre}
                      onChange={(e) => updateItem(index, 'nombre', e.target.value)}
                      required
                      placeholder="Descripción del item"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent text-gray-900"
                    />
                  </div>

                  <div>
                    <label className="block text-sm text-gray-600 mb-1">Cantidad *</label>
                    <input
                      type="number"
                      value={item.cantidad}
                      onChange={(e) => updateItem(index, 'cantidad', Number(e.target.value))}
                      required
                      min="0.01"
                      step="0.01"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent text-gray-900"
                    />
                  </div>

                  <div>
                    <label className="block text-sm text-gray-600 mb-1">Unidad *</label>
                    <select
                      value={item.unidad}
                      onChange={(e) => updateItem(index, 'unidad', e.target.value)}
                      required
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent text-gray-900"
                    >
                      <option value="pza">Pieza</option>
                      <option value="kg">Kilogramo</option>
                      <option value="m">Metro</option>
                      <option value="m2">Metro²</option>
                      <option value="m3">Metro³</option>
                      <option value="lt">Litro</option>
                      <option value="caja">Caja</option>
                      <option value="paq">Paquete</option>
                      <option value="servicio">Servicio</option>
                    </select>
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-sm text-gray-600 mb-1">Precio Unitario *</label>
                    <input
                      type="number"
                      value={item.precioUnitario}
                      onChange={(e) => updateItem(index, 'precioUnitario', Number(e.target.value))}
                      required
                      min="0"
                      step="0.01"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent text-gray-900"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-sm text-gray-600 mb-1">Total</label>
                    <div className="px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg text-gray-700 font-medium">
                      {new Intl.NumberFormat('es-MX', { style: 'currency', currency }).format(item.cantidad * item.precioUnitario)}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Evidencias */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Evidencias (Opcional)</h2>
          <p className="text-sm text-gray-600 mb-4">
            Puedes adjuntar hasta 5 archivos (imágenes o PDFs, máximo 10MB cada uno)
          </p>
          <input
            type="file"
            multiple
            accept="image/*,application/pdf"
            onChange={(e) => {
              const files = Array.from(e.target.files || []);
              if (files.length > 5) {
                alert('Máximo 5 archivos');
                return;
              }
              setEvidenceFiles(files);
            }}
            className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-red-50 file:text-red-700 hover:file:bg-red-100"
          />
          {evidenceFiles.length > 0 && (
            <div className="mt-2 text-sm text-gray-600">
              {evidenceFiles.length} archivo(s) seleccionado(s)
            </div>
          )}
        </div>

        {/* Resumen */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Resumen</h2>
          <div className="space-y-2">
            <div className="flex justify-between text-gray-700">
              <span>Subtotal:</span>
              <span className="font-medium">
                {new Intl.NumberFormat('es-MX', { style: 'currency', currency }).format(subtotal)}
              </span>
            </div>
            <div className="flex justify-between text-gray-700">
              <span>IVA ({ivaPercentage}%):</span>
              <span className="font-medium">
                {new Intl.NumberFormat('es-MX', { style: 'currency', currency }).format(iva)}
              </span>
            </div>
            <div className="flex justify-between text-xl font-bold text-gray-900 pt-2 border-t">
              <span>Total:</span>
              <span>{new Intl.NumberFormat('es-MX', { style: 'currency', currency }).format(total)}</span>
            </div>
          </div>
        </div>

        {/* Botones */}
        <div className="flex justify-end gap-3">
          <Link
            href="/dashboard/listas-necesidades"
            className="px-6 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            Cancelar
          </Link>
          <button
            type="submit"
            disabled={loading || bankAccounts.length === 0}
            className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Creando...' : 'Crear Lista de Necesidades'}
          </button>
        </div>
      </form>

      {/* Modal para agregar cuenta bancaria */}
      <BankAccountManager
        isOpen={showAccountModal}
        onClose={() => setShowAccountModal(false)}
        onAccountAdded={fetchBankAccounts}
      />
    </div>
  );
}
