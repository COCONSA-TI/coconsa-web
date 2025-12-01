'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase/client';

// Tipos
interface User {
  id: string;
  full_name: string;
  email: string;
  role: string;
}

interface Store {
  id: number;
  name: string;
}

interface Supplier {
  id: number;
  commercial_name: string;
  social_reason: string;
  rfc: string;
  address?: string;
  phone?: string;
  clabe: string;
  bank: string;
  contact?: string;
  category: string;
}

interface OrderItem {
  nombre: string;
  cantidad: string;
  unidad: string;
  precioUnitario: number;
  precioTotal: number;
}

export default function OrdenDeCompra() {
  const [formData, setFormData] = useState({
    applicant_id: '',
    store_id: '',
    date: new Date().toISOString().split('T')[0],
    supplier_id: '',
    justification: '',
    currency: 'MXN',
    retention: '',
    status: 'PENDIENTE',
  });

  const [items, setItems] = useState<OrderItem[]>([
    { nombre: '', cantidad: '', unidad: '', precioUnitario: 0, precioTotal: 0 }
  ]);

  const [totales, setTotales] = useState({
    subtotal: 0,
    iva: 0,
    total: 0
  });

  // Estados para los catálogos
  const [users, setUsers] = useState<User[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Cargar catálogos al iniciar
  useEffect(() => {
    loadCatalogs();
  }, []);

  const loadCatalogs = async () => {
    try {
      setIsLoading(true);

      // Cargar usuarios
      const { data: usersData, error: usersError } = await supabase
        .from('users')
        .select('id, full_name, email, role')
        .order('full_name');

      if (usersError) throw usersError;
      setUsers(usersData || []);

      // Cargar almacenes/obras
      const { data: storesData, error: storesError } = await supabase
        .from('stores')
        .select('id, name')
        .order('name');

      if (storesError) throw storesError;
      setStores(storesData || []);

      // Cargar proveedores
      const { data: suppliersData, error: suppliersError } = await supabase
        .from('suppliers')
        .select('*')
        .order('commercial_name');

      if (suppliersError) throw suppliersError;
      setSuppliers(suppliersData || []);

    } catch (error) {
      console.error('Error loading catalogs:', error);
      alert('Error al cargar los catálogos');
    } finally {
      setIsLoading(false);
    }
  };

  // Calcular totales cuando cambien los items
  useEffect(() => {
    const subtotal = items.reduce((acc, item) => acc + (item.precioTotal || 0), 0);
    const iva = subtotal * 0.16;
    const total = subtotal + iva;
    
    setTotales({ subtotal, iva, total });
  }, [items]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSupplierChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const supplierId = e.target.value;
    setFormData(prev => ({ ...prev, supplier_id: supplierId }));
    
    // Buscar el proveedor seleccionado
    const supplier = suppliers.find(s => s.id.toString() === supplierId);
    setSelectedSupplier(supplier || null);
  };

  const handleItemChange = (index: number, field: string, value: string | number) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    
    // Calcular precio total si cambia cantidad o precio unitario
    if (field === 'precioUnitario' || field === 'cantidad') {
      const cantidad = parseFloat(newItems[index].cantidad as string) || 0;
      const precioUnitario = parseFloat(newItems[index].precioUnitario as unknown as string) || 0;
      newItems[index].precioTotal = cantidad * precioUnitario;
    }
    
    setItems(newItems);
  };

  const addItem = () => {
    setItems([...items, { nombre: '', cantidad: '', unidad: '', precioUnitario: 0, precioTotal: 0 }]);
  };

  const removeItem = (index: number) => {
    if (items.length > 1) {
      setItems(items.filter((_, i) => i !== index));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validaciones
    if (!formData.applicant_id) {
      alert('Por favor selecciona un solicitante');
      return;
    }
    if (!formData.store_id) {
      alert('Por favor selecciona un almacén u obra');
      return;
    }
    if (!formData.supplier_id) {
      alert('Por favor selecciona un proveedor');
      return;
    }
    if (items.some(item => !item.nombre || !item.cantidad || !item.unidad)) {
      alert('Por favor completa todos los campos de los artículos');
      return;
    }

    setIsSaving(true);

    try {
      // Preparar datos para insertar
      const orderData = {
        applicant_id: formData.applicant_id,
        store_id: parseInt(formData.store_id),
        date: formData.date,
        supplier_id: parseInt(formData.supplier_id),
        items: JSON.stringify(items),
        quantity: items.reduce((sum, item) => sum + parseFloat(item.cantidad), 0),
        unity: items[0]?.unidad || '', // Podrías manejarlo de otra forma
        price_excluding_iva: totales.subtotal,
        price_with_iva: totales.total,
        subtotal: totales.subtotal,
        iva: totales.iva,
        total: totales.total,
        currency: formData.currency,
        justification: formData.justification,
        retention: formData.retention,
        status: formData.status,
      };

      const { data, error } = await supabase
        .from('orders')
        .insert([orderData])
        .select();

      if (error) throw error;

      alert('Orden de compra creada exitosamente');
      console.log('Order created:', data);

      // Resetear formulario
      resetForm();

    } catch (error) {
      console.error('Error saving order:', error);
      alert('Error al guardar la orden de compra');
    } finally {
      setIsSaving(false);
    }
  };

  const resetForm = () => {
    setFormData({
      applicant_id: '',
      store_id: '',
      date: new Date().toISOString().split('T')[0],
      supplier_id: '',
      justification: '',
      currency: 'MXN',
      retention: '',
      status: 'PENDIENTE',
    });
    setItems([{ nombre: '', cantidad: '', unidad: '', precioUnitario: 0, precioTotal: 0 }]);
    setSelectedSupplier(null);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-xl">Cargando...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 p-5">
      <div className="max-w-5xl mx-auto bg-white p-5 border border-gray-300 shadow-lg">
        {/* Header */}
        <header className="text-center border-b-2 border-black pb-2.5 mb-5">
          <h1 className="text-2xl font-bold text-gray-800 m-0">COCONSA CONSTRUCCIONES S.A DE C.V.</h1>
          <p className="text-sm my-0.5">Joaquín Serrano 255 Cd. Industrial Torreón C.P. 27019</p>
          <p className="text-sm my-0.5">RFC: CCO0811261F4 | Tel.: 01(871) 750 74 64 al 67</p>
          <h2 className="text-xl font-semibold mt-2">REQUISICIÓN DE COMPRA / ORDEN DE COMPRA</h2>
        </header>

        <form id="requisicionForm" onSubmit={handleSubmit}>
          {/* Sección 1: Información General */}
          <div className="mb-5 border border-gray-200 p-4 rounded">
            <div className="grid grid-cols-3 gap-4">
              <div className="flex flex-col">
                <label htmlFor="applicant_id" className="font-bold mb-1 text-sm">
                  NOMBRE DEL SOLICITANTE *
                </label>
                <select
                  id="applicant_id"
                  name="applicant_id"
                  value={formData.applicant_id}
                  onChange={handleInputChange}
                  required
                  className="p-2 border border-gray-300 rounded w-full"
                >
                  <option value="">Seleccionar...</option>
                  {users.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.full_name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col">
                <label htmlFor="store_id" className="font-bold mb-1 text-sm">
                  ALMACEN U OBRA *
                </label>
                <select
                  id="store_id"
                  name="store_id"
                  value={formData.store_id}
                  onChange={handleInputChange}
                  required
                  className="p-2 border border-gray-300 rounded w-full"
                >
                  <option value="">Seleccionar...</option>
                  {stores.map((store) => (
                    <option key={store.id} value={store.id}>
                      {store.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col">
                <label htmlFor="date" className="font-bold mb-1 text-sm">
                  FECHA ELAB: *
                </label>
                <input
                  type="date"
                  id="date"
                  name="date"
                  value={formData.date}
                  onChange={handleInputChange}
                  required
                  className="p-2 border border-gray-300 rounded w-full"
                />
              </div>
            </div>
          </div>

          {/* Sección 2: Datos del Proveedor */}
          <div className="mb-5 border border-gray-200 p-4 rounded">
            <h2 className="text-lg font-semibold border-b border-gray-300 pb-1 mb-3 mt-0">
              Datos del Proveedor
            </h2>

            <div className="mb-4">
              <label htmlFor="supplier_id" className="font-bold mb-1 text-sm block">
                SELECCIONAR PROVEEDOR *
              </label>
              <select
                id="supplier_id"
                name="supplier_id"
                value={formData.supplier_id}
                onChange={handleSupplierChange}
                required
                className="p-2 border border-gray-300 rounded w-full"
              >
                <option value="">Seleccionar proveedor...</option>
                {suppliers.map((supplier) => (
                  <option key={supplier.id} value={supplier.id}>
                    {supplier.commercial_name} - {supplier.rfc}
                  </option>
                ))}
              </select>
            </div>

            {selectedSupplier && (
              <div className="bg-gray-50 p-4 rounded border border-gray-200">
                <h3 className="font-semibold mb-2">Información del Proveedor</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p><strong>Nombre Comercial:</strong> {selectedSupplier.commercial_name}</p>
                    <p><strong>Razón Social:</strong> {selectedSupplier.social_reason}</p>
                    <p><strong>RFC:</strong> {selectedSupplier.rfc}</p>
                  </div>
                  <div>
                    <p><strong>Dirección:</strong> {selectedSupplier.address || 'N/A'}</p>
                    <p><strong>Teléfono:</strong> {selectedSupplier.phone || 'N/A'}</p>
                    <p><strong>Contacto:</strong> {selectedSupplier.contact || 'N/A'}</p>
                  </div>
                  <div>
                    <p><strong>Banco:</strong> {selectedSupplier.bank}</p>
                    <p><strong>CLABE:</strong> {selectedSupplier.clabe}</p>
                  </div>
                  <div>
                    <p><strong>Categoría:</strong> {selectedSupplier.category}</p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Sección 3: Artículos y/o Servicios */}
          <div className="mb-5 border border-gray-200 p-4 rounded">
            <h2 className="text-lg font-semibold border-b border-gray-300 pb-1 mb-3 mt-0">
              Artículos y/o Servicios
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse mt-4">
                <thead>
                  <tr>
                    <th className="border border-gray-400 p-2 bg-gray-100 text-left text-sm">
                      NOMBRE DEL ARTICULO Y/O SERVICIO
                    </th>
                    <th className="border border-gray-400 p-2 bg-gray-100 text-left text-sm">
                      CANTIDAD
                    </th>
                    <th className="border border-gray-400 p-2 bg-gray-100 text-left text-sm">
                      UNIDAD
                    </th>
                    <th className="border border-gray-400 p-2 bg-gray-100 text-left text-sm">
                      PRECIO UNITARIO SIN IVA
                    </th>
                    <th className="border border-gray-400 p-2 bg-gray-100 text-left text-sm">
                      PRECIO TOTAL SIN IVA
                    </th>
                    <th className="border border-gray-400 p-2 bg-gray-100 text-left text-sm">
                      ACCIONES
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, index) => (
                    <tr key={index}>
                      <td className="border border-gray-400 p-2">
                        <input
                          type="text"
                          value={item.nombre}
                          onChange={(e) => handleItemChange(index, 'nombre', e.target.value)}
                          className="w-full p-1 border border-gray-300 rounded"
                          required
                        />
                      </td>
                      <td className="border border-gray-400 p-2">
                        <input
                          type="number"
                          value={item.cantidad}
                          onChange={(e) => handleItemChange(index, 'cantidad', e.target.value)}
                          className="w-full p-1 border border-gray-300 rounded"
                          step="0.01"
                          required
                        />
                      </td>
                      <td className="border border-gray-400 p-2">
                        <input
                          type="text"
                          value={item.unidad}
                          onChange={(e) => handleItemChange(index, 'unidad', e.target.value)}
                          className="w-full p-1 border border-gray-300 rounded"
                          placeholder="ej: pza, kg, m"
                          required
                        />
                      </td>
                      <td className="border border-gray-400 p-2">
                        <input
                          type="number"
                          value={item.precioUnitario}
                          onChange={(e) => handleItemChange(index, 'precioUnitario', parseFloat(e.target.value) || 0)}
                          step="0.01"
                          className="w-full p-1 border border-gray-300 rounded"
                          required
                        />
                      </td>
                      <td className="border border-gray-400 p-2">
                        <input
                          type="number"
                          value={item.precioTotal.toFixed(2)}
                          readOnly
                          className="w-full p-1 border border-gray-300 rounded bg-gray-50"
                        />
                      </td>
                      <td className="border border-gray-400 p-2 text-center">
                        <button
                          type="button"
                          onClick={() => removeItem(index)}
                          className="bg-red-500 text-white px-2 py-1 rounded text-sm hover:bg-red-600 disabled:bg-gray-300"
                          disabled={items.length === 1}
                        >
                          Eliminar
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <button
              type="button"
              onClick={addItem}
              className="mt-3 bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
            >
              + Agregar Item
            </button>
          </div>

          {/* Sección 4: Justificación y Totales */}
          <div className="mb-5 border border-gray-200 p-4 rounded">
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col">
                <label htmlFor="justification" className="font-bold mb-1 text-sm">
                  JUSTIFICACION DE LA COMPRA
                </label>
                <textarea
                  id="justification"
                  name="justification"
                  value={formData.justification}
                  onChange={handleInputChange}
                  placeholder="Ej: ACERO PARA CANAL PLUVIAL"
                  className="p-2 border border-gray-300 rounded w-full resize-y min-h-[80px]"
                />
                
                <label htmlFor="retention" className="font-bold mb-1 text-sm mt-3">
                  RETENCIÓN (Opcional)
                </label>
                <input
                  type="text"
                  id="retention"
                  name="retention"
                  value={formData.retention}
                  onChange={handleInputChange}
                  className="p-2 border border-gray-300 rounded w-full"
                  placeholder="Ej: 4% ISR"
                />
              </div>

              <div>
                <div className="mb-3">
                  <label className="font-bold text-sm mr-3">Moneda: *</label>
                  <div className="mt-2">
                    <label className="inline-flex items-center mr-4">
                      <input
                        type="radio"
                        name="currency"
                        value="MXN"
                        checked={formData.currency === 'MXN'}
                        onChange={handleInputChange}
                        className="mr-2"
                      />
                      Moneda Nacional (MXN)
                    </label>
                    <label className="inline-flex items-center">
                      <input
                        type="radio"
                        name="currency"
                        value="USD"
                        checked={formData.currency === 'USD'}
                        onChange={handleInputChange}
                        className="mr-2"
                      />
                      Dólar Americano (USD)
                    </label>
                  </div>
                </div>

                <div className="mt-5 bg-gray-50 p-4 rounded border border-gray-300">
                  <h3 className="font-semibold mb-3">Totales</h3>
                  <div className="flex justify-between items-center mb-2">
                    <label className="font-bold text-sm">SUBTOTAL:</label>
                    <span className="text-lg font-semibold">
                      ${totales.subtotal.toFixed(2)} {formData.currency}
                    </span>
                  </div>
                  <div className="flex justify-between items-center mb-2">
                    <label className="font-bold text-sm">16% IVA:</label>
                    <span className="text-lg font-semibold">
                      ${totales.iva.toFixed(2)} {formData.currency}
                    </span>
                  </div>
                  <div className="flex justify-between items-center mb-2 pt-2 border-t border-gray-400">
                    <label className="font-bold text-base">TOTAL:</label>
                    <span className="text-xl font-bold text-green-600">
                      ${totales.total.toFixed(2)} {formData.currency}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Firmas */}
          <div className="mt-20 border-t border-gray-300 pt-5 grid grid-cols-4 text-center text-sm">
            <div className="border-t border-black pt-1 mx-2">
              <strong>SOLICITANTE</strong>
            </div>
            <div className="border-t border-black pt-1 mx-2">
              <strong>REVISIÓN</strong>
              <br />
              CONTROL DE OBRA
            </div>
            <div className="border-t border-black pt-1 mx-2">
              <strong>REVISIÓN</strong>
              <br />
              GERENTE CONSTRUCCION
            </div>
            <div className="border-t border-black pt-1 mx-2">
              <strong>AUTORIZACIÓN</strong>
              <br />
              DIRECCION
            </div>
          </div>

          {/* Botones de acción */}
          <div className="mt-8 text-center flex gap-4 justify-center">
            <button
              type="button"
              onClick={resetForm}
              className="bg-gray-500 text-white px-8 py-3 rounded-lg text-lg font-semibold hover:bg-gray-600 transition-colors"
            >
              Limpiar Formulario
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="bg-green-600 text-white px-8 py-3 rounded-lg text-lg font-semibold hover:bg-green-700 transition-colors disabled:bg-gray-400"
            >
              {isSaving ? 'Guardando...' : 'Guardar Requisición'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
