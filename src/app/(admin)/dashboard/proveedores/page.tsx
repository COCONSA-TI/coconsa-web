'use client';

import { useRequireAuth } from '@/hooks/useAuth';
import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { useToast } from '@/components/ui/Toast';
import { ProveedoresPageSkeleton } from '@/components/ui/Skeletons';

interface Supplier {
  id: number;
  commercial_name: string;
  social_reason?: string;
  rfc: string;
  category: string;
  bank: string;
  clabe?: string;
  contact: string | null;
  phone: string | null;
  address?: string | null;
  cover_image_url: string | null;
  created_at?: string;
}

type FilterType = 'all' | 'fiscal' | 'temp' | 'with_bank';

export default function ProveedoresPage() {
  const { user, loading, isAdmin, isDepartmentHead } = useRequireAuth();
  const { success, error: toastError } = useToast();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<FilterType>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [previewSupplier, setPreviewSupplier] = useState<Supplier | null>(null);

  const canCreateSuppliers = isAdmin || isDepartmentHead;
  const canEditSuppliers = isAdmin || isDepartmentHead;

  useEffect(() => {
    if (user) {
      fetchSuppliers();
    }
  }, [user]);

  const fetchSuppliers = async () => {
    try {
      setLoadingData(true);
      const response = await fetch('/api/v1/suppliers');
      const data = await response.json();

      if (data.success) {
        setSuppliers(data.suppliers || []);
      } else {
        toastError('Error', data.error || 'Error al cargar proveedores');
      }
    } catch {
      toastError('Error', 'Error de conexión al cargar proveedores');
    } finally {
      setLoadingData(false);
    }
  };

  const handleDelete = async (id: number, name: string) => {
    if (!window.confirm(`¿Estás seguro que deseas eliminar permanentemente a "${name}"?`)) {
      return;
    }

    try {
      const response = await fetch(`/api/v1/suppliers/${id}`, {
        method: 'DELETE',
      });
      const data = await response.json();

      if (data.success) {
        success('Éxito', data.message || 'Proveedor eliminado correctamente');
        setSuppliers((prev) => prev.filter((s) => s.id !== id));
      } else {
        toastError('Error', data.error || 'Error al eliminar proveedor');
      }
    } catch {
      toastError('Error', 'Error de conexión');
    }
  };

  // KPIs
  const stats = useMemo(() => {
    const total = suppliers.length;
    const temp = suppliers.filter((s) => s.rfc?.toUpperCase().startsWith('TEMP-')).length;
    const fiscal = total - temp;
    const withBank = suppliers.filter(
      (s) => s.clabe && s.clabe !== 'XXXX' && s.bank && s.bank !== 'XXXX'
    ).length;

    return { total, fiscal, temp, withBank };
  }, [suppliers]);

  // Unique categories list
  const categories = useMemo(() => {
    const set = new Set<string>();
    suppliers.forEach((s) => {
      if (s.category && s.category !== 'XXXX') set.add(s.category);
    });
    return Array.from(set).sort();
  }, [suppliers]);

  // Filtered suppliers
  const filteredSuppliers = useMemo(() => {
    return suppliers.filter((s) => {
      // Search query
      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase();
        const matchName = s.commercial_name?.toLowerCase().includes(query);
        const matchSocial = s.social_reason?.toLowerCase().includes(query);
        const matchRfc = s.rfc?.toLowerCase().includes(query);
        const matchCat = s.category?.toLowerCase().includes(query);
        const matchBank = s.bank?.toLowerCase().includes(query);
        const matchContact = s.contact?.toLowerCase().includes(query);
        if (!matchName && !matchSocial && !matchRfc && !matchCat && !matchBank && !matchContact) {
          return false;
        }
      }

      // Filter type
      if (filterType === 'fiscal' && s.rfc?.toUpperCase().startsWith('TEMP-')) return false;
      if (filterType === 'temp' && !s.rfc?.toUpperCase().startsWith('TEMP-')) return false;
      if (
        filterType === 'with_bank' &&
        (!s.clabe || s.clabe === 'XXXX' || !s.bank || s.bank === 'XXXX')
      ) {
        return false;
      }

      // Category filter
      if (selectedCategory !== 'all' && s.category !== selectedCategory) {
        return false;
      }

      return true;
    });
  }, [suppliers, searchTerm, filterType, selectedCategory]);

  if (loading || loadingData) {
    return <ProveedoresPageSkeleton />;
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
                <div className="w-9 h-9 rounded-xl bg-red-100 flex items-center justify-center text-red-700 font-bold text-sm">
                  {previewSupplier.commercial_name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 text-sm">{previewSupplier.commercial_name}</h3>
                  <p className="text-xs text-gray-500 font-mono">{previewSupplier.rfc}</p>
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

            {/* Modal Body */}
            <div className="p-4">
              {previewSupplier.cover_image_url ? (
                previewSupplier.cover_image_url.toLowerCase().endsWith('.pdf') ? (
                  <div className="flex flex-col items-center gap-4 py-8">
                    <div className="w-20 h-20 rounded-2xl bg-red-100 flex items-center justify-center text-red-600">
                      <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <div className="text-center">
                      <p className="text-sm font-medium text-gray-800">Carátula / Constancia en PDF</p>
                      <p className="text-xs text-gray-500 mt-0.5">Abre el archivo para consultarlo a detalle</p>
                    </div>
                    <a
                      href={previewSupplier.cover_image_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-5 py-2.5 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 transition-colors shadow-sm inline-flex items-center gap-2"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                      Abrir PDF en pestaña nueva
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
                  Ver imagen original en nueva pestaña
                </a>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header Banner - Diseño Oficial COCONSA */}
        <div className="bg-gradient-to-r from-red-600 to-red-700 rounded-xl shadow-lg p-6 text-white">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold">Catálogo de Proveedores</h1>
              <p className="text-red-100 text-sm mt-1">
                Directorio oficial y gestión de proveedores autorizados de COCONSA
              </p>
            </div>
            {canCreateSuppliers && (
              <Link
                href="/dashboard/proveedores/crear"
                className="inline-flex items-center justify-center gap-2 bg-white text-red-600 px-5 py-2.5 rounded-lg font-medium hover:bg-red-50 transition-colors shadow-sm self-start sm:self-auto"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                <span>Nuevo Proveedor</span>
              </Link>
            )}
          </div>
        </div>

        {/* Stats Grid - Mismo formato y dimensiones que Órdenes y Listas de Necesidades */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <button
            onClick={() => setFilterType(filterType === 'all' ? 'all' : 'all')}
            className={`bg-white rounded-xl shadow p-4 text-left transition-all ${
              filterType === 'all' && selectedCategory === 'all'
                ? 'ring-2 ring-red-500 ring-offset-2'
                : 'hover:shadow-md'
            }`}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-500 text-xs font-medium uppercase tracking-wide">Total Proveedores</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{stats.total}</p>
              </div>
              <div className="bg-red-50 rounded-full p-2.5 text-red-600">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
              </div>
            </div>
          </button>

          <button
            onClick={() => setFilterType(filterType === 'fiscal' ? 'all' : 'fiscal')}
            className={`bg-white rounded-xl shadow p-4 text-left transition-all ${
              filterType === 'fiscal' ? 'ring-2 ring-green-500 ring-offset-2' : 'hover:shadow-md'
            }`}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-500 text-xs font-medium uppercase tracking-wide">Con RFC Fiscal</p>
                <p className="text-2xl font-bold text-green-600 mt-1">{stats.fiscal}</p>
              </div>
              <div className="bg-green-100 rounded-full p-2.5 text-green-600">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
          </button>

          <button
            onClick={() => setFilterType(filterType === 'temp' ? 'all' : 'temp')}
            className={`bg-white rounded-xl shadow p-4 text-left transition-all ${
              filterType === 'temp' ? 'ring-2 ring-yellow-500 ring-offset-2' : 'hover:shadow-md'
            }`}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-500 text-xs font-medium uppercase tracking-wide">En Trámite (TEMP)</p>
                <p className="text-2xl font-bold text-yellow-600 mt-1">{stats.temp}</p>
              </div>
              <div className="bg-yellow-100 rounded-full p-2.5 text-yellow-600">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
          </button>

          <button
            onClick={() => setFilterType(filterType === 'with_bank' ? 'all' : 'with_bank')}
            className={`bg-white rounded-xl shadow p-4 text-left transition-all ${
              filterType === 'with_bank' ? 'ring-2 ring-blue-500 ring-offset-2' : 'hover:shadow-md'
            }`}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-500 text-xs font-medium uppercase tracking-wide">Cuentas Bancarias</p>
                <p className="text-2xl font-bold text-blue-600 mt-1">{stats.withBank}</p>
              </div>
              <div className="bg-blue-100 rounded-full p-2.5 text-blue-600">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                </svg>
              </div>
            </div>
          </button>
        </div>

        {/* Search & Filters Card */}
        <div className="bg-white rounded-xl shadow p-4 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-md">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                placeholder="Buscar por nombre comercial, razón social, RFC, categoría o banco..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-red-500 focus:bg-white transition-all"
              />
            </div>
            <div className="flex items-center gap-2 self-start sm:self-center">
              <span className="text-xs text-gray-400">
                ({filteredSuppliers.length} resultado{filteredSuppliers.length !== 1 ? 's' : ''})
              </span>
              {(searchTerm || filterType !== 'all' || selectedCategory !== 'all') && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchTerm('');
                    setFilterType('all');
                    setSelectedCategory('all');
                  }}
                  className="text-xs text-red-600 hover:text-red-700 font-medium px-2 py-1 rounded hover:bg-red-50 transition"
                >
                  Restablecer
                </button>
              )}
            </div>
          </div>

          {/* Filter Pills */}
          <div className="flex flex-wrap gap-2 pt-2 border-t border-gray-100">
            <button
              onClick={() => { setFilterType('all'); setSelectedCategory('all'); }}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                filterType === 'all' && selectedCategory === 'all'
                  ? 'bg-red-600 text-white shadow-sm'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              Todos
              <span className={`text-[11px] px-1.5 py-0.2 rounded-full ${
                filterType === 'all' && selectedCategory === 'all'
                  ? 'bg-red-500 text-white'
                  : 'bg-white text-gray-600'
              }`}>
                {suppliers.length}
              </span>
            </button>

            <button
              onClick={() => setFilterType(filterType === 'fiscal' ? 'all' : 'fiscal')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                filterType === 'fiscal'
                  ? 'bg-green-600 text-white shadow-sm'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              RFC Fiscal
              <span className={`text-[11px] px-1.5 py-0.2 rounded-full ${
                filterType === 'fiscal'
                  ? 'bg-green-500 text-white'
                  : 'bg-white text-gray-600'
              }`}>
                {stats.fiscal}
              </span>
            </button>

            <button
              onClick={() => setFilterType(filterType === 'temp' ? 'all' : 'temp')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                filterType === 'temp'
                  ? 'bg-yellow-600 text-white shadow-sm'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              Temporales (TEMP)
              <span className={`text-[11px] px-1.5 py-0.2 rounded-full ${
                filterType === 'temp'
                  ? 'bg-yellow-500 text-white'
                  : 'bg-white text-gray-600'
              }`}>
                {stats.temp}
              </span>
            </button>

            {/* Categorías frecuentes */}
            {categories.slice(0, 6).map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(selectedCategory === cat ? 'all' : cat)}
                className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                  selectedCategory === cat
                    ? 'bg-gray-800 text-white shadow-sm'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Suppliers Container - Desktop Table + Mobile Cards */}
        <div className="bg-white rounded-xl shadow overflow-hidden">
          {filteredSuppliers.length === 0 ? (
            <div className="p-12 text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-100 mb-4">
                <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
              </div>
              <h3 className="text-base font-semibold text-gray-900 mb-1">No se encontraron proveedores</h3>
              <p className="text-sm text-gray-500 max-w-sm mx-auto">
                {searchTerm || filterType !== 'all' || selectedCategory !== 'all'
                  ? 'No hay registros que coincidan con los filtros aplicados.'
                  : 'Aún no has registrado ningún proveedor en el sistema.'}
              </p>
              {canCreateSuppliers && (
                <Link
                  href="/dashboard/proveedores/crear"
                  className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 transition"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Dar de alta primer proveedor
                </Link>
              )}
            </div>
          ) : (
            <>
              {/* Desktop Table View */}
              <div className="hidden md:block overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th scope="col" className="px-6 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                        Proveedor / Empresa
                      </th>
                      <th scope="col" className="px-6 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                        RFC Fiscal
                      </th>
                      <th scope="col" className="px-6 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                        Categoría
                      </th>
                      <th scope="col" className="px-6 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                        Banco y CLABE
                      </th>
                      <th scope="col" className="px-6 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                        Contacto
                      </th>
                      {canEditSuppliers && (
                        <th scope="col" className="px-6 py-3.5 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">
                          Acciones
                        </th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-100">
                    {filteredSuppliers.map((supplier) => {
                      const isTempRfc = supplier.rfc?.toUpperCase().startsWith('TEMP-');

                      return (
                        <tr key={supplier.id} className="hover:bg-gray-50/80 transition-colors">
                          {/* Proveedor y Carátula */}
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center gap-3">
                              <button
                                onClick={() => setPreviewSupplier(supplier)}
                                className="h-10 w-10 flex-shrink-0 rounded-lg overflow-hidden border border-gray-200 shadow-sm hover:ring-2 hover:ring-red-400 transition-all cursor-pointer group relative bg-gray-50 flex items-center justify-center"
                                title="Ver carátula o documento adjunto"
                              >
                                {supplier.cover_image_url ? (
                                  supplier.cover_image_url.toLowerCase().endsWith('.pdf') ? (
                                    <div className="w-full h-full bg-red-50 text-red-600 flex items-center justify-center font-bold text-xs">
                                      PDF
                                    </div>
                                  ) : (
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
                                  )
                                ) : (
                                  <div className="w-full h-full bg-red-100 text-red-700 flex items-center justify-center font-bold text-xs">
                                    {supplier.commercial_name.charAt(0).toUpperCase()}
                                  </div>
                                )}

                                <div className="fallback hidden w-full h-full bg-red-100 text-red-700 flex items-center justify-center font-bold text-xs">
                                  {supplier.commercial_name.charAt(0).toUpperCase()}
                                </div>

                                {/* Hover overlay */}
                                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/25 transition-colors flex items-center justify-center">
                                  <svg className="w-4 h-4 text-white opacity-0 group-hover:opacity-100 transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                  </svg>
                                </div>
                              </button>

                              <div className="min-w-0">
                                <div className="text-sm font-semibold text-gray-900 truncate max-w-[240px]" title={supplier.commercial_name}>
                                  {supplier.commercial_name}
                                </div>
                                <div className="text-xs text-gray-500 truncate max-w-[240px]" title={supplier.social_reason || supplier.commercial_name}>
                                  {supplier.social_reason || supplier.commercial_name}
                                </div>
                              </div>
                            </div>
                          </td>

                          {/* RFC */}
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span
                              className={`inline-flex items-center px-2.5 py-1 rounded text-xs font-mono font-medium ${
                                isTempRfc
                                  ? 'bg-yellow-50 text-yellow-800 border border-yellow-200'
                                  : 'bg-gray-100 text-gray-900 border border-gray-200'
                              }`}
                            >
                              {supplier.rfc}
                            </span>
                          </td>

                          {/* Categoría */}
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-red-50 text-red-700 border border-red-200">
                              {supplier.category || 'General'}
                            </span>
                          </td>

                          {/* Banco & CLABE */}
                          <td className="px-6 py-4 whitespace-nowrap text-xs">
                            <div className="font-semibold text-gray-900">{supplier.bank || 'Sin banco'}</div>
                            <div className="font-mono text-gray-500 mt-0.5">{supplier.clabe || 'XXXX'}</div>
                          </td>

                          {/* Contacto & Teléfono */}
                          <td className="px-6 py-4 whitespace-nowrap text-xs text-gray-600">
                            <div className="font-medium text-gray-900">{supplier.contact && supplier.contact !== 'XXXX' ? supplier.contact : 'Sin contacto'}</div>
                            <div className="text-gray-500 mt-0.5">{supplier.phone && supplier.phone !== 'XXXX' ? supplier.phone : 'Sin teléfono'}</div>
                          </td>

                          {/* Acciones */}
                          {canEditSuppliers && (
                            <td className="px-6 py-4 whitespace-nowrap text-right text-xs font-medium">
                              <div className="flex items-center justify-end gap-2">
                                <Link
                                  href={`/dashboard/proveedores/${supplier.id}/editar`}
                                  className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                  title="Editar proveedor"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                  </svg>
                                </Link>
                                <button
                                  onClick={() => handleDelete(supplier.id, supplier.commercial_name)}
                                  className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                  title="Eliminar proveedor"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                  </svg>
                                </button>
                              </div>
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile Cards View */}
              <div className="md:hidden divide-y divide-gray-200">
                {filteredSuppliers.map((supplier) => {
                  const isTempRfc = supplier.rfc?.toUpperCase().startsWith('TEMP-');

                  return (
                    <div key={supplier.id} className="p-4 space-y-3 hover:bg-gray-50/60 transition-colors">
                      {/* Top row: Avatar + Name + Actions */}
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <button
                            onClick={() => setPreviewSupplier(supplier)}
                            className="w-10 h-10 rounded-lg overflow-hidden border border-gray-200 shadow-sm flex items-center justify-center flex-shrink-0 bg-red-100 text-red-700 font-bold text-xs"
                            title="Ver carátula"
                          >
                            {supplier.cover_image_url ? (
                              supplier.cover_image_url.toLowerCase().endsWith('.pdf') ? (
                                'PDF'
                              ) : (
                                <img
                                  src={supplier.cover_image_url}
                                  alt={supplier.commercial_name}
                                  className="w-full h-full object-cover"
                                />
                              )
                            ) : (
                              supplier.commercial_name.charAt(0).toUpperCase()
                            )}
                          </button>

                          <div className="min-w-0">
                            <h4 className="text-sm font-semibold text-gray-900 truncate">
                              {supplier.commercial_name}
                            </h4>
                            <p className="text-xs text-gray-500 truncate">
                              {supplier.social_reason || supplier.commercial_name}
                            </p>
                          </div>
                        </div>

                        {canEditSuppliers && (
                          <div className="flex items-center gap-1 flex-shrink-0">
                            <Link
                              href={`/dashboard/proveedores/${supplier.id}/editar`}
                              className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition"
                              title="Editar"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                            </Link>
                            <button
                              onClick={() => handleDelete(supplier.id, supplier.commercial_name)}
                              className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                              title="Eliminar"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Middle row: Badges */}
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-mono font-medium ${
                            isTempRfc
                              ? 'bg-yellow-50 text-yellow-800 border border-yellow-200'
                              : 'bg-gray-100 text-gray-800 border border-gray-200'
                          }`}
                        >
                          {supplier.rfc}
                        </span>

                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-red-50 text-red-700 border border-red-200">
                          {supplier.category || 'General'}
                        </span>
                      </div>

                      {/* Bottom row: Bank & Contact */}
                      <div className="grid grid-cols-2 gap-2 text-xs pt-1 border-t border-gray-100">
                        <div>
                          <p className="text-gray-400 text-[10px] uppercase font-semibold">Banco / CLABE</p>
                          <p className="font-medium text-gray-800 truncate">{supplier.bank || 'XXXX'}</p>
                          <p className="font-mono text-gray-500 text-[11px] truncate">{supplier.clabe || 'XXXX'}</p>
                        </div>
                        <div>
                          <p className="text-gray-400 text-[10px] uppercase font-semibold">Contacto</p>
                          <p className="font-medium text-gray-800 truncate">{supplier.contact || 'Sin contacto'}</p>
                          <p className="text-gray-500 text-[11px] truncate">{supplier.phone || 'Sin teléfono'}</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
