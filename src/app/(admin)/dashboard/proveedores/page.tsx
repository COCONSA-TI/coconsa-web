'use client';

import { useRequireAuth } from '@/hooks/useAuth';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useToast } from '@/components/ui/Toast';

interface Supplier {
  id: number;
  commercial_name: string;
  rfc: string;
  category: string;
  bank: string;
  contact: string | null;
  phone: string | null;
  cover_image_url: string | null;
}

export default function ProveedoresPage() {
  const { user, loading } = useRequireAuth();
  const { success, error: toastError } = useToast();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const canManageSuppliers = Boolean(user?.can_manage_suppliers);
  const [previewSupplier, setPreviewSupplier] = useState<Supplier | null>(null);

  useEffect(() => {
    if (user) {
      fetchSuppliers();
    }
  }, [user]);

  const fetchSuppliers = async (search?: string) => {
    try {
      setLoadingData(true);
      const url = search ? `/api/v1/suppliers?search=${encodeURIComponent(search)}` : '/api/v1/suppliers';
      const response = await fetch(url);
      const data = await response.json();
      
      if (data.success) {
        setSuppliers(data.suppliers);
      } else {
        toastError('Error', data.error || 'Error al cargar proveedores');
      }
    } catch (error) {
      toastError('Error', 'Error de conexión');
    } finally {
      setLoadingData(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchSuppliers(searchTerm);
  };

  const handleDelete = async (id: number, name: string) => {
    if (!window.confirm(`¿Estás seguro que deseas eliminar permanentemente a ${name}?`)) {
      return;
    }

    try {
      const response = await fetch(`/api/v1/suppliers/${id}`, {
        method: 'DELETE',
      });
      const data = await response.json();

      if (data.success) {
        success('Éxito', data.message);
        setSuppliers(suppliers.filter((s) => s.id !== id));
      } else {
        toastError('Error', data.error || 'Error al eliminar proveedor');
      }
    } catch (error) {
      toastError('Error', 'Error de conexión');
    }
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="h-32 bg-gray-200 rounded-xl mb-6 animate-pulse"></div>
        <div className="h-64 bg-gray-200 rounded-xl animate-pulse"></div>
      </div>
    );
  }

  return (
    <>
      {/* Cover Preview Modal */}
      {previewSupplier && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          onClick={() => setPreviewSupplier(null)}
        >
          <div 
            className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden animate-in fade-in zoom-in duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center text-red-700 font-bold text-sm">
                  {previewSupplier.commercial_name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">{previewSupplier.commercial_name}</h3>
                  <p className="text-xs text-gray-500">{previewSupplier.rfc}</p>
                </div>
              </div>
              <button
                onClick={() => setPreviewSupplier(null)}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Modal Body - Image */}
            <div className="p-4">
              {previewSupplier.cover_image_url ? (
                previewSupplier.cover_image_url.toLowerCase().endsWith('.pdf') ? (
                  <div className="flex flex-col items-center gap-4 py-8">
                    <div className="w-20 h-20 rounded-2xl bg-red-100 flex items-center justify-center">
                      <svg className="w-10 h-10 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <p className="text-sm text-gray-600">Carátula en formato PDF</p>
                    <a
                      href={previewSupplier.cover_image_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 transition-colors"
                    >
                      Abrir PDF
                    </a>
                  </div>
                ) : (
                  <img 
                    src={previewSupplier.cover_image_url} 
                    alt={`Carátula de ${previewSupplier.commercial_name}`}
                    className="w-full rounded-xl object-contain max-h-[60vh] bg-gray-50"
                  />
                )
              ) : (
                <div className="flex flex-col items-center gap-3 py-12 text-gray-400">
                  <svg className="w-16 h-16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <p className="text-sm">Sin carátula disponible</p>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            {previewSupplier.cover_image_url && !previewSupplier.cover_image_url.toLowerCase().endsWith('.pdf') && (
              <div className="px-4 pb-4">
                <a
                  href={previewSupplier.cover_image_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 w-full px-4 py-2.5 bg-gray-100 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-200 transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                  Abrir en nueva pestaña
                </a>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="space-y-6 p-6">
        {/* Banner Header */}
        <div className="bg-gradient-to-r from-red-600 to-red-700 rounded-xl shadow-lg p-6 text-white">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold">Directorio de Proveedores</h1>
              <p className="text-red-100 text-sm mt-1">Gestiona los proveedores autorizados del sistema</p>
            </div>
            {canManageSuppliers && (
              <Link
                href="/dashboard/proveedores/crear"
                className="inline-flex items-center justify-center gap-2 bg-white text-red-600 px-5 py-2.5 rounded-lg font-medium hover:bg-red-50 transition-colors shadow-sm"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Nuevo Proveedor
              </Link>
            )}
          </div>
        </div>

        {/* Buscador y Tabla */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          {/* Barra de herramientas */}
          <div className="p-4 border-b border-gray-200 bg-gray-50">
            <form onSubmit={handleSearch} className="flex gap-2 max-w-md">
              <div className="relative flex-1">
                <input
                  type="text"
                  placeholder="Buscar por nombre, RFC o categoría..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 text-gray-900 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none transition-all"
                />
                <svg className="w-5 h-5 text-gray-400 absolute left-3 top-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <button 
                type="submit"
                className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors font-medium shadow-sm"
              >
                Buscar
              </button>
              {searchTerm && (
                <button 
                  type="button"
                  onClick={() => {
                    setSearchTerm('');
                    fetchSuppliers('');
                  }}
                  className="px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg font-medium transition"
                >
                  Limpiar
                </button>
              )}
            </form>
          </div>

          {/* Tabla */}
          <div className="overflow-x-auto">
            {loadingData ? (
              <div className="p-8 text-center text-gray-500">Cargando proveedores...</div>
            ) : suppliers.length === 0 ? (
              <div className="p-12 text-center">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-100 mb-4">
                  <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                  </svg>
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-1">No hay proveedores en sistema</h3>
                <p className="text-gray-500">
                  {searchTerm ? 'No se encontraron coincidencias para tu búsqueda.' : 'Aún no has registrado ningún proveedor.'}
                </p>
              </div>
            ) : (
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      Proveedor
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      RFC
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      Categoría
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      Contacto
                    </th>
                    {canManageSuppliers && (
                      <th scope="col" className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">
                        Acciones
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {suppliers.map((supplier) => (
                    <tr key={supplier.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <button
                            onClick={() => setPreviewSupplier(supplier)}
                            className="h-10 w-10 flex-shrink-0 rounded-lg overflow-hidden shadow-sm border border-gray-200 hover:ring-2 hover:ring-red-300 hover:border-red-300 transition-all cursor-pointer group relative"
                            title="Ver carátula"
                          >
                            {supplier.cover_image_url ? (
                              <>
                                <img 
                                  src={supplier.cover_image_url} 
                                  alt={supplier.commercial_name} 
                                  className="h-10 w-10 object-cover"
                                  onError={(e) => {
                                    const target = e.target as HTMLImageElement;
                                    target.style.display = 'none';
                                    target.parentElement!.querySelector('.fallback')?.classList.remove('hidden');
                                  }}
                                />
                                <div className="fallback hidden h-10 w-10 bg-red-100 flex items-center justify-center text-red-700 font-bold">
                                  {supplier.commercial_name.charAt(0).toUpperCase()}
                                </div>
                              </>
                            ) : (
                              <div className="h-10 w-10 bg-red-100 flex items-center justify-center text-red-700 font-bold">
                                {supplier.commercial_name.charAt(0).toUpperCase()}
                              </div>
                            )}
                            {/* Hover overlay */}
                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                              <svg className="w-4 h-4 text-white opacity-0 group-hover:opacity-100 transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
                              </svg>
                            </div>
                          </button>
                          <div className="ml-4">
                            <div className="text-sm font-semibold text-gray-900 truncate max-w-[250px]">{supplier.commercial_name}</div>
                            <div className="text-sm text-gray-500 truncate max-w-[250px]">{supplier.bank}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900 font-medium bg-gray-100 inline-block px-2 py-1 rounded">{supplier.rfc}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800 border border-blue-200">
                          {supplier.category}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        <div>{supplier.contact || 'Sin contacto directo'}</div>
                        <div className="text-xs">{supplier.phone}</div>
                      </td>
                      {canManageSuppliers && (
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <div className="flex items-center justify-end gap-3">
                            <Link 
                              href={`/dashboard/proveedores/${supplier.id}/editar`}
                              className="text-gray-400 hover:text-blue-600 transition-colors"
                              title="Editar"
                            >
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                            </Link>
                            <button
                              onClick={() => handleDelete(supplier.id, supplier.commercial_name)}
                              className="text-gray-400 hover:text-red-600 transition-colors"
                              title="Eliminar"
                            >
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
