'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import BankAccountManager from '@/components/admin/BankAccountManager';
import { useToast } from '@/components/ui/Toast';

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
  justificacion: string;
  evidenciaFile: File | null;
  insumo_clave?: string;
  categoria?: string;
}

interface StoreOption {
  id: number;
  name: string;
}

interface UnitOption {
  id: string;
  name: string;
  abbreviation: string;
}

interface InsumoOption {
  id: number;
  clave: string;
  descripcion: string;
  unidad: string;
  costo_unitario: number;
  cantidad_disponible: number;
  agotado: boolean;
  categoria: string;
}

interface InsumoAutocompleteProps {
  value: string;
  insumos: InsumoOption[];
  onSelect: (insumo: InsumoOption) => void;
  onChange: (val: string) => void;
}

function InsumoAutocomplete({ value, insumos, onSelect, onChange }: InsumoAutocompleteProps) {
  const [query, setQuery] = useState(value);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => { setQuery(value); }, [value]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const filtered = query.length >= 1
    ? insumos.filter(ins =>
        ins.clave.toLowerCase().includes(query.toLowerCase()) ||
        ins.descripcion.toLowerCase().includes(query.toLowerCase())
      ).slice(0, 30)
    : insumos.slice(0, 30);

  return (
    <div ref={ref} className="relative">
      <input
        type="text"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          onChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent text-sm text-gray-900"
        placeholder="Busca por clave o descripción del presupuesto..."
        autoComplete="off"
      />
      {open && filtered.length > 0 && (
        <div className="absolute z-50 left-0 right-0 mt-1 bg-white rounded-lg border border-gray-200 shadow-xl max-h-60 overflow-y-auto">
          {filtered.map((ins) => (
            <button
              key={ins.id}
              type="button"
              onClick={() => {
                onSelect(ins);
                setQuery(ins.descripcion);
                setOpen(false);
              }}
              className={`w-full text-left px-3 py-2 hover:bg-red-50 transition-colors border-b border-gray-50 last:border-0 ${ins.agotado ? 'opacity-50' : ''}`}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <span className="text-xs font-semibold text-gray-500 font-mono mr-2">{ins.clave}</span>
                  <span className="inline-block px-1.5 py-0.5 text-[10px] font-medium bg-gray-100 text-gray-600 rounded mr-2">{ins.categoria}</span>
                  <p className="text-sm text-gray-800 truncate mt-0.5">{ins.descripcion}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className={`text-xs font-medium ${ins.agotado ? 'text-red-500' : 'text-green-600'}`}>
                    {ins.agotado ? 'Agotado' : `Disp: ${ins.cantidad_disponible.toLocaleString('es-MX', { maximumFractionDigits: 2 })} ${ins.unidad}`}
                  </p>
                  <p className="text-xs text-gray-400">${ins.costo_unitario.toLocaleString('es-MX', { maximumFractionDigits: 2 })}/{ins.unidad}</p>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

const LEGACY_MACHINE_STORE_REGEX = /^(CG|M|C|V|AT)\d+[\.\s-]?/i;

export default function CreateNeedsListPage() {
  const router = useRouter();
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [loadingAccounts, setLoadingAccounts] = useState(true);
  const [showAccountModal, setShowAccountModal] = useState(false);

  // Formulario
  const [bankAccountId, setBankAccountId] = useState('');
  const [storeName, setStoreName] = useState('');
  const [storeId, setStoreId] = useState('');
  const [availableStores, setAvailableStores] = useState<StoreOption[]>([]);
  const [availableUnits, setAvailableUnits] = useState<UnitOption[]>([]);
  const [storeInsumos, setStoreInsumos] = useState<InsumoOption[]>([]);
  const [hasPresupuesto, setHasPresupuesto] = useState(false);
  const [loadingInsumos, setLoadingInsumos] = useState(false);
  const [currency, setCurrency] = useState('MXN');
  const [ivaPercentage, setIvaPercentage] = useState(16);
  const [isUrgent, setIsUrgent] = useState(false);
  const [urgencyJustification, setUrgencyJustification] = useState('');
  const [items, setItems] = useState<NeedsListItem[]>([
    { nombre: '', cantidad: 1, unidad: '', precioUnitario: 0, justificacion: '', evidenciaFile: null },
  ]);

  const fetchInsumosForStore = useCallback(async (sId: string) => {
    if (!sId) {
      setStoreInsumos([]);
      setHasPresupuesto(false);
      return;
    }
    setLoadingInsumos(true);
    try {
      const res = await fetch(`/api/v1/stores/${sId}/insumos?limit=500`);
      if (!res.ok) throw new Error('Error');
      const data = await res.json();
      setHasPresupuesto(data.hasPresupuesto);
      const CATEGORIAS_SOLICITABLES = ['Materiales', 'Herramienta'];
      setStoreInsumos(
        (data.insumos || []).filter((i: { categoria: string }) =>
          CATEGORIAS_SOLICITABLES.includes(i.categoria)
        )
      );
    } catch {
      setStoreInsumos([]);
      setHasPresupuesto(false);
    } finally {
      setLoadingInsumos(false);
    }
  }, []);

  useEffect(() => {
    fetchBankAccounts();
    fetchStores();
    fetchUnits();
  }, []);

  useEffect(() => {
    if (storeId) {
      fetchInsumosForStore(storeId);
    } else {
      setStoreInsumos([]);
      setHasPresupuesto(false);
    }
  }, [storeId, fetchInsumosForStore]);

  const fetchUnits = async () => {
    try {
      const response = await fetch('/api/v1/units');
      const data = await response.json();
      if (response.ok && data.units) {
        setAvailableUnits(data.units);
      }
    } catch (error) {
      console.error('Error al cargar unidades:', error);
    }
  };

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

  const fetchStores = async () => {
    try {
      const response = await fetch('/api/v1/stores-suppliers');
      const data = await response.json();
      if (response.ok && data.stores && Array.isArray(data.stores)) {
        const filteredStores = data.stores.filter((store: StoreOption) => {
          const normalized = store.name.trim().toLowerCase();
          if (normalized === 'maquinaria') return true;
          return !LEGACY_MACHINE_STORE_REGEX.test(store.name);
        });
        setAvailableStores(filteredStores);
      }
    } catch (error) {
      console.error('Error al cargar centros de costos:', error);
    }
  };

  const addItem = () => {
    setItems([...items, { nombre: '', cantidad: 1, unidad: '', precioUnitario: 0, justificacion: '', evidenciaFile: null }]);
  };

  const removeItem = (index: number) => {
    if (items.length > 1) {
      setItems(items.filter((_, i) => i !== index));
    }
  };

  const updateItem = (index: number, field: keyof NeedsListItem, value: string | number | File | null) => {
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
      toast.warning('Cuenta bancaria requerida', 'Debes seleccionar una cuenta bancaria');
      return;
    }

    if (!storeId) {
      toast.warning('Centro de costos requerido', 'Debes seleccionar un centro de costos');
      return;
    }

    if (items.length === 0 || !items[0].nombre) {
      toast.warning('Items requeridos', 'Debes agregar al menos un item');
      return;
    }

    for (let index = 0; index < items.length; index += 1) {
      const item = items[index];
      if (!item.justificacion || item.justificacion.trim().length < 10) {
        toast.warning(
          'Justificación inválida',
          `La justificación del item #${index + 1} debe tener al menos 10 caracteres`
        );
        return;
      }
      if (!(item.evidenciaFile instanceof File)) {
        toast.warning(
          'Archivo requerido',
          `Debes adjuntar un archivo de justificación para el item #${index + 1}`
        );
        return;
      }
    }

    if (isUrgent && (!urgencyJustification || urgencyJustification.length < 10)) {
      toast.warning(
        'Justificación urgente requerida',
        'Las listas urgentes requieren una justificación de al menos 10 caracteres'
      );
      return;
    }

    setLoading(true);

    try {
      // 1. Subir archivos de evidencia usando Presigned URLs directamente a Supabase (salta límite de 4.5MB Vercel)
      const itemEvidenceUrls: string[] = [];

      for (let index = 0; index < items.length; index++) {
        const item = items[index];
        if (item.evidenciaFile) {
          const urlRes = await fetch('/api/v1/storage/signed-url', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              fileName: item.evidenciaFile.name,
              contentType: item.evidenciaFile.type,
              folder: 'needs-lists/staging',
              bucket: 'order-attachments',
            }),
          });

          if (!urlRes.ok) throw new Error(`Error obteniendo permiso para subir archivo del item #${index + 1}`);
          const urlData = await urlRes.json();

          const uploadRes = await fetch(urlData.signedUrl, {
            method: 'PUT',
            headers: { 'Content-Type': item.evidenciaFile.type },
            body: item.evidenciaFile,
          });

          if (!uploadRes.ok) throw new Error(`Error subiendo el archivo del item #${index + 1}`);

          itemEvidenceUrls.push(urlData.publicUrl);
        }
      }

      // 2. Crear la lista (como JSON ligero con presigned URLs)
      const payload = {
        bank_account_id: bankAccountId,
        store_name: storeName,
        store_id: storeId,
        currency,
        iva_percentage: ivaPercentage,
        is_urgent: isUrgent,
        urgency_justification: isUrgent ? urgencyJustification : undefined,
        items: items.map((item, index) => ({
          nombre: item.nombre,
          cantidad: item.cantidad,
          unidad: item.unidad,
          precioUnitario: item.precioUnitario,
          justificacion: item.justificacion,
          evidencia_url: itemEvidenceUrls[index] || undefined,
          insumo_clave: item.insumo_clave || undefined,
          categoria: item.categoria || undefined,
        })),
      };

      const response = await fetch('/api/v1/needs-lists/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (data.success) {
        toast.success('Lista creada', 'Lista de necesidades creada exitosamente');
        router.push(`/dashboard/listas-necesidades/${data.data.id}`);
      } else {
        toast.error('Error al crear la lista', data.error || 'No se pudo crear la lista');
      }
    } catch (error) {
      console.error('Error:', error);
      toast.error('Error al crear la lista', error instanceof Error ? error.message : 'Error al crear la lista de necesidades');
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

            {/* Centro de costos */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Centro de costos <span className="text-red-500">*</span>
              </label>
              <select
                value={storeId}
                onChange={(e) => {
                  const selected = availableStores.find((store) => String(store.id) === e.target.value);
                  setStoreId(e.target.value);
                  setStoreName(selected?.name || '');
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent text-gray-900"
                required
              >
                <option value="">Selecciona un centro de costos</option>
                {availableStores.map((store) => (
                  <option key={store.id} value={store.id}>{store.name}</option>
                ))}
              </select>
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

          {hasPresupuesto && (
            <div className="mb-4 bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-800 flex items-center justify-between">
              <div>
                <span className="font-semibold">Presupuesto activo:</span> Esta obra cuenta con un presupuesto cargado. Selecciona los insumos autorizados (categorías Materiales y Herramienta) para vinculación automática.
              </div>
              {loadingInsumos && <span className="text-blue-600 animate-pulse font-medium">Cargando catálogo...</span>}
            </div>
          )}

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
                    <label className="block text-sm text-gray-600 mb-1 flex items-center justify-between">
                      <span>Nombre / Descripción <span className="text-red-500">*</span></span>
                      {item.insumo_clave && (
                        <span className="text-[11px] font-mono text-green-700 bg-green-50 px-1.5 py-0.5 rounded border border-green-200">
                          {item.insumo_clave} ({item.categoria})
                        </span>
                      )}
                    </label>
                    {hasPresupuesto && storeInsumos.length > 0 ? (
                      <InsumoAutocomplete
                        value={item.nombre}
                        insumos={storeInsumos}
                        onChange={(val) => {
                          const newItems = [...items];
                          newItems[index] = { ...newItems[index], nombre: val, insumo_clave: undefined, categoria: undefined };
                          setItems(newItems);
                        }}
                        onSelect={(insumo) => {
                          const newItems = [...items];
                          newItems[index] = {
                            ...newItems[index],
                            nombre: insumo.descripcion,
                            unidad: insumo.unidad || newItems[index].unidad,
                            precioUnitario: insumo.costo_unitario || newItems[index].precioUnitario,
                            insumo_clave: insumo.clave,
                            categoria: insumo.categoria,
                          };
                          setItems(newItems);
                        }}
                      />
                    ) : (
                      <input
                        type="text"
                        value={item.nombre}
                        onChange={(e) => updateItem(index, 'nombre', e.target.value)}
                        required
                        placeholder="Descripción del item"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent text-gray-900"
                      />
                    )}
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
                      <option value="" disabled>Seleccionar</option>
                      {availableUnits.map((u) => (
                        <option key={u.id} value={u.abbreviation}>
                          {u.name}
                        </option>
                      ))}
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

                  <div className="md:col-span-4">
                    <label className="block text-sm text-gray-600 mb-1">
                      Justificación del item <span className="text-red-500">*</span>
                    </label>
                    <textarea
                      value={item.justificacion}
                      onChange={(e) => updateItem(index, 'justificacion', e.target.value)}
                      rows={2}
                      required
                      placeholder="Describe el motivo de este concepto (mínimo 10 caracteres)"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent text-gray-900"
                    />
                  </div>

                  <div className="md:col-span-4">
                    <label className="block text-sm text-gray-600 mb-1">
                      Archivo de justificación del item <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="file"
                      accept="image/*,application/pdf"
                      required
                      onChange={(e) => updateItem(index, 'evidenciaFile', e.target.files?.[0] || null)}
                      className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-red-50 file:text-red-700 hover:file:bg-red-100"
                    />
                    {item.evidenciaFile && (
                      <div className="mt-1 text-xs text-gray-500">
                        {item.evidenciaFile.name}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
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
