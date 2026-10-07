'use client';

import { useState, useEffect, useMemo } from 'react';
import { useToast } from '@/components/ui/Toast';
import type { InsumoCategoria } from '@/types/database';

interface UnlinkedItem {
  id: string;
  source: 'order' | 'needs_list';
  source_id: number;
  folio: string;
  item_index: number;
  nombre: string;
  unidad: string;
  cantidad: number;
  precio_unitario: number;
  total: number;
  fecha: string;
}

interface BudgetInsumoRef {
  id: number;
  clave: string;
  descripcion: string;
  unidad: string;
  categoria: string;
  costo_unitario: number;
}

interface AiProposal {
  id: string;
  action: 'match_existing' | 'create_new';
  matched_insumo_id?: number | null;
  matched_clave?: string | null;
  category: string;
  confidence: number;
  reasoning: string;
}

interface ItemDecisionState {
  item: UnlinkedItem;
  selected: boolean;
  action: 'match_existing' | 'create_new' | 'ignore';
  matched_insumo_id?: number;
  matched_clave?: string;
  category: string;
  confidence: number;
  reasoning: string;
}

const CATEGORIAS_OPTIONS: InsumoCategoria[] = [
  'Materiales',
  'Mano de Obra',
  'Herramienta',
  'Equipo',
  'Gastos Indirectos',
  'Adicionales',
];

export default function BudgetReconcileModal({
  storeId,
  storeName,
  isOpen,
  onClose,
  onSuccess,
}: {
  storeId: number;
  storeName: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const { success, error: toastError, warning } = useToast();

  const [step, setStep] = useState<'loading' | 'detection' | 'analyzing' | 'review' | 'applying' | 'finished'>('loading');
  const [unlinkedItems, setUnlinkedItems] = useState<UnlinkedItem[]>([]);
  const [budgetInsumos, setBudgetInsumos] = useState<BudgetInsumoRef[]>([]);
  const [decisions, setDecisions] = useState<ItemDecisionState[]>([]);
  const [filterAction, setFilterAction] = useState<'all' | 'match_existing' | 'create_new'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [resultSummary, setResultSummary] = useState<{ matchedCount: number; createdCount: number } | null>(null);

  // 1. Cargar items no vinculados e insumos del presupuesto
  useEffect(() => {
    if (!isOpen || !storeId) return;

    const loadUnlinked = async () => {
      setStep('loading');
      try {
        const res = await fetch(`/api/v1/stores/${storeId}/budget/reconcile`);
        const data = await res.json();

        if (res.ok && data.success) {
          setUnlinkedItems(data.unlinkedItems || []);
          setBudgetInsumos(data.budgetInsumos || []);
          setStep('detection');
        } else {
          toastError('Error', data.error || 'Error al obtener compras históricas');
          onClose();
        }
      } catch {
        toastError('Error', 'Error de conexión con el servidor');
        onClose();
      }
    };

    loadUnlinked();
  }, [isOpen, storeId, toastError, onClose]);

  // 2. Analizar con Gemini IA
  const handleAnalyzeWithAI = async () => {
    setStep('analyzing');

    try {
      const res = await fetch(`/api/v1/stores/${storeId}/budget/reconcile`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: unlinkedItems,
          budgetInsumos,
        }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        const proposalsMap = new Map<string, AiProposal>();
        (data.proposals || []).forEach((p: AiProposal) => {
          proposalsMap.set(p.id, p);
        });

        // Construir estado de decisiones combinando items y propuestas
        const initialDecisions: ItemDecisionState[] = unlinkedItems.map((item) => {
          const prop = proposalsMap.get(item.id);
          if (prop) {
            return {
              item,
              selected: true,
              action: prop.action,
              matched_insumo_id: prop.matched_insumo_id || undefined,
              matched_clave: prop.matched_clave || undefined,
              category: prop.category || (item.source === 'needs_list' ? 'Gastos Indirectos' : 'Materiales'),
              confidence: prop.confidence || 85,
              reasoning: prop.reasoning || '',
            };
          }

          // Fallback por defecto si no vino en el análisis
          const fallbackCat = item.source === 'needs_list' ? 'Gastos Indirectos' : 'Materiales';
          return {
            item,
            selected: true,
            action: 'create_new',
            category: fallbackCat,
            confidence: 70,
            reasoning: item.source === 'needs_list' ? 'Asignado a Gastos Indirectos' : 'Nuevo concepto',
          };
        });

        setDecisions(initialDecisions);
        setStep('review');
      } else {
        toastError('Error al analizar', data.error || 'No se pudo completar el análisis de los conceptos');
        setStep('detection');
      }
    } catch {
      toastError('Error', 'Ocurrió un error al procesar los conceptos');
      setStep('detection');
    }
  };

  // 3. Modificar decisión de un item
  const updateDecision = (id: string, updates: Partial<ItemDecisionState>) => {
    setDecisions((prev) =>
      prev.map((d) => (d.item.id === id ? { ...d, ...updates } : d))
    );
  };

  // 4. Aplicar conciliación a la base de datos
  const handleApplyReconciliation = async () => {
    const selectedDecisions = decisions.filter((d) => d.selected && d.action !== 'ignore');
    if (selectedDecisions.length === 0) {
      warning('Sin selección', 'Selecciona al menos un concepto para aplicar.');
      return;
    }

    setStep('applying');

    try {
      const res = await fetch(`/api/v1/stores/${storeId}/budget/reconcile/apply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          decisions: selectedDecisions.map((d) => ({
            id: d.item.id,
            source: d.item.source,
            source_id: d.item.source_id,
            item_index: d.item.item_index,
            action: d.action,
            matched_insumo_id: d.matched_insumo_id,
            matched_clave: d.matched_clave,
            category: d.category,
            nombre: d.item.nombre,
            unidad: d.item.unidad,
            cantidad: d.item.cantidad,
            precio_unitario: d.item.precio_unitario,
            total: d.item.total,
          })),
        }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setResultSummary({
          matchedCount: data.matchedCount || 0,
          createdCount: data.createdCount || 0,
        });
        setStep('finished');
        success('Conciliación aplicada', data.message);
        onSuccess();
      } else {
        toastError('Error al aplicar', data.error || 'No se pudieron aplicar los cambios');
        setStep('review');
      }
    } catch {
      toastError('Error', 'Error de conexión al aplicar la conciliación');
      setStep('review');
    }
  };

  // Filtrado para la tabla de revisión
  const filteredDecisions = useMemo(() => {
    return decisions.filter((d) => {
      if (filterAction !== 'all' && d.action !== filterAction) return false;
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const matchName = d.item.nombre.toLowerCase().includes(q);
        const matchFolio = d.item.folio.toLowerCase().includes(q);
        const matchClave = (d.matched_clave || '').toLowerCase().includes(q);
        const matchCat = d.category.toLowerCase().includes(q);
        if (!matchName && !matchFolio && !matchClave && !matchCat) return false;
      }
      return true;
    });
  }, [decisions, filterAction, searchTerm]);

  // Contadores
  const counts = useMemo(() => {
    const ordersCount = unlinkedItems.filter((i) => i.source === 'order').length;
    const needsCount = unlinkedItems.filter((i) => i.source === 'needs_list').length;
    const selectedCount = decisions.filter((d) => d.selected).length;
    const matchedCount = decisions.filter((d) => d.selected && d.action === 'match_existing').length;
    const createdCount = decisions.filter((d) => d.selected && d.action === 'create_new').length;

    return { ordersCount, needsCount, selectedCount, matchedCount, createdCount };
  }, [unlinkedItems, decisions]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
      <div
        className="bg-white rounded-2xl shadow-2xl max-w-5xl w-full max-h-[92vh] flex flex-col overflow-hidden border border-gray-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-gray-50/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 to-red-600 flex items-center justify-center text-white shadow-sm flex-shrink-0">
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path d="M11 3a1 1 0 10-2 0v1a1 1 0 102 0V3zM15.657 5.757a1 1 0 00-1.414-1.414l-.707.707a1 1 0 001.414 1.414l.707-.707zM18 10a1 1 0 01-1 1h-1a1 1 0 110-2h1a1 1 0 011 1zM5.05 6.464A1 1 0 106.464 5.05l-.707-.707a1 1 0 00-1.414 1.414l.707.707zM5 10a1 1 0 01-1 1H3a1 1 0 110-2h1a1 1 0 011 1zM8 16v-1h4v1a2 2 0 11-4 0zM12 14c.015-.34.208-.646.477-.859a4 4 0 10-4.954 0c.27.213.462.519.477.859h4z" />
              </svg>
            </div>
            <div>
              <h3 className="font-bold text-gray-900 text-base flex items-center gap-2">
                Conciliación Histórica de Compras
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 font-semibold border border-amber-200">
                  Asistida
                </span>
              </h3>
              <p className="text-xs text-gray-500">{storeName} · Sincronización precisa con el presupuesto</p>
            </div>
          </div>

          <button
            onClick={onClose}
            disabled={step === 'analyzing' || step === 'applying'}
            className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-30"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body content based on step */}
        <div className="flex-1 overflow-y-auto p-6">
          {step === 'loading' && (
            <div className="py-20 flex flex-col items-center justify-center text-center space-y-3">
              <div className="w-12 h-12 border-4 border-red-200 border-t-red-600 rounded-full animate-spin"></div>
              <p className="text-sm font-medium text-gray-700">Explorando compras y presupuesto de la obra...</p>
            </div>
          )}

          {step === 'detection' && (
            <div className="space-y-6">
              {unlinkedItems.length === 0 ? (
                <div className="py-16 text-center space-y-3">
                  <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto">
                    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <h4 className="text-lg font-bold text-gray-900">¡Presupuesto completamente al día!</h4>
                  <p className="text-sm text-gray-500 max-w-md mx-auto">
                    No se detectaron compras históricas pendientes de vincular en esta obra. Todos los conceptos están correctamente enlazados.
                  </p>
                </div>
              ) : (
                <>
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 text-sm text-amber-900 space-y-2">
                    <h4 className="font-bold flex items-center gap-2">
                      <svg className="w-5 h-5 text-amber-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      Se encontraron compras históricas sin clave presupuestal
                    </h4>
                    <p className="text-xs text-amber-800 leading-relaxed">
                      Estas compras se registraron previamente con texto libre. El sistema analizará automáticamente cada concepto para:
                    </p>
                    <ul className="text-xs list-disc list-inside text-amber-800 space-y-1 pl-2">
                      <li><strong>Vincular semánticamente:</strong> Si un concepto (ej. <em>"Varilla 3/8"</em>) ya existe en el presupuesto (ej. <em>"ACERO DE REFUERZO NO. 3"</em>), lo vinculará directamente sin duplicar el presupuesto.</li>
                      <li><strong>Gastos Indirectos:</strong> Las compras de listas de necesidades se clasificarán como <em>Gastos Indirectos</em>.</li>
                      <li><strong>Categorización técnica:</strong> Las compras extraordinarias que no existan se clasificarán en <em>Materiales</em>, <em>Equipo</em> o <em>Herramienta</em> según su naturaleza.</li>
                    </ul>
                  </div>

                  {/* Resumen numérico */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-center">
                      <p className="text-xs font-semibold text-gray-500 uppercase">Total Conceptos</p>
                      <p className="text-2xl font-black text-gray-900 mt-1">{unlinkedItems.length}</p>
                    </div>
                    <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-center">
                      <p className="text-xs font-semibold text-blue-700 uppercase">De Órdenes de Compra</p>
                      <p className="text-2xl font-black text-blue-900 mt-1">{counts.ordersCount}</p>
                    </div>
                    <div className="bg-teal-50 border border-teal-200 rounded-xl p-4 text-center">
                      <p className="text-xs font-semibold text-teal-700 uppercase">De Listas de Necesidades</p>
                      <p className="text-2xl font-black text-teal-900 mt-1">{counts.needsCount}</p>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {step === 'analyzing' && (
            <div className="py-20 flex flex-col items-center justify-center text-center space-y-4">
              <div className="relative">
                <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-amber-400 to-red-600 flex items-center justify-center shadow-lg animate-pulse">
                  <svg className="w-8 h-8 text-white animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                </div>
              </div>
              <div>
                <h4 className="text-base font-bold text-gray-900">Procesando y analizando conceptos...</h4>
                <p className="text-xs text-gray-500 mt-1 max-w-md">
                  Comparando descripciones contra el catálogo presupuestal y asignando las categorías correspondientes.
                </p>
              </div>
            </div>
          )}

          {step === 'review' && (
            <div className="space-y-4">
              {/* Barra de filtros y contadores */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-gray-50 p-3 rounded-xl border border-gray-200">
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => setFilterAction('all')}
                    className={`px-3 py-1 text-xs font-semibold rounded-lg transition-colors ${
                      filterAction === 'all' ? 'bg-gray-900 text-white' : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200'
                    }`}
                  >
                    Todos ({decisions.length})
                  </button>
                  <button
                    onClick={() => setFilterAction('match_existing')}
                    className={`px-3 py-1 text-xs font-semibold rounded-lg transition-colors ${
                      filterAction === 'match_existing' ? 'bg-green-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200'
                    }`}
                  >
                    Vincular a Presupuesto ({decisions.filter((d) => d.action === 'match_existing').length})
                  </button>
                  <button
                    onClick={() => setFilterAction('create_new')}
                    className={`px-3 py-1 text-xs font-semibold rounded-lg transition-colors ${
                      filterAction === 'create_new' ? 'bg-amber-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200'
                    }`}
                  >
                    Nuevos Clasificados ({decisions.filter((d) => d.action === 'create_new').length})
                  </button>
                </div>

                <div className="relative">
                  <input
                    type="text"
                    placeholder="Buscar por concepto o folio..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full sm:w-60 pl-8 pr-3 py-1.5 text-xs bg-white border border-gray-300 rounded-lg outline-none focus:ring-1 focus:ring-red-500"
                  />
                  <svg className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
              </div>

              {/* Botón rápido para marcar / desmarcar todos */}
              <div className="flex items-center justify-between text-xs text-gray-500 px-1">
                <span>
                  Mostrando {filteredDecisions.length} de {decisions.length} ({counts.selectedCount} seleccionados para aplicar)
                </span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setDecisions((prev) => prev.map((d) => ({ ...d, selected: true })))}
                    className="text-red-600 hover:underline font-medium"
                  >
                    Seleccionar todos
                  </button>
                  <span>·</span>
                  <button
                    type="button"
                    onClick={() => setDecisions((prev) => prev.map((d) => ({ ...d, selected: false })))}
                    className="text-gray-500 hover:underline"
                  >
                    Desmarcar todos
                  </button>
                </div>
              </div>

              {/* Tabla de revisión interactiva */}
              <div className="border border-gray-200 rounded-xl overflow-hidden bg-white shadow-sm max-h-[50vh] overflow-y-auto">
                <table className="min-w-full divide-y divide-gray-200 text-xs">
                  <thead className="bg-gray-50 sticky top-0 z-10">
                    <tr>
                      <th className="px-3 py-2.5 text-center w-8">
                        <input
                          type="checkbox"
                          checked={decisions.every((d) => d.selected)}
                          onChange={(e) => setDecisions((prev) => prev.map((d) => ({ ...d, selected: e.target.checked })))}
                          className="rounded border-gray-300 text-red-600 focus:ring-red-500"
                        />
                      </th>
                      <th className="px-3 py-2.5 text-left font-semibold text-gray-600">Origen / Folio</th>
                      <th className="px-3 py-2.5 text-left font-semibold text-gray-600">Concepto Comprado</th>
                      <th className="px-3 py-2.5 text-left font-semibold text-gray-600">Propuesta de la IA</th>
                      <th className="px-3 py-2.5 text-left font-semibold text-gray-600">Categoría / Enlace</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filteredDecisions.map((dec) => {
                      const isMatch = dec.action === 'match_existing';

                      return (
                        <tr key={dec.item.id} className={`hover:bg-gray-50/80 transition-colors ${!dec.selected ? 'opacity-40 bg-gray-50/40' : ''}`}>
                          {/* Checkbox */}
                          <td className="px-3 py-3 text-center">
                            <input
                              type="checkbox"
                              checked={dec.selected}
                              onChange={(e) => updateDecision(dec.item.id, { selected: e.target.checked })}
                              className="rounded border-gray-300 text-red-600 focus:ring-red-500 cursor-pointer"
                            />
                          </td>

                          {/* Origen */}
                          <td className="px-3 py-3 whitespace-nowrap">
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold ${
                                dec.item.source === 'order'
                                  ? 'bg-blue-100 text-blue-800'
                                  : 'bg-teal-100 text-teal-800'
                              }`}
                            >
                              {dec.item.folio}
                            </span>
                            <div className="text-[10px] text-gray-400 mt-0.5">{dec.item.fecha}</div>
                          </td>

                          {/* Concepto comprado */}
                          <td className="px-3 py-3 max-w-[220px]">
                            <div className="font-semibold text-gray-900 truncate" title={dec.item.nombre}>
                              {dec.item.nombre}
                            </div>
                            <div className="text-[11px] text-gray-500">
                              {dec.item.cantidad} {dec.item.unidad} · ${dec.item.total.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                            </div>
                          </td>

                          {/* Propuesta IA */}
                          <td className="px-3 py-3 max-w-[240px]">
                            <div className="flex items-center gap-1.5 mb-1">
                              <span
                                className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                                  isMatch
                                    ? 'bg-green-100 text-green-800 border border-green-200'
                                    : 'bg-amber-100 text-amber-800 border border-amber-200'
                                }`}
                              >
                                {isMatch ? '✓ Coincide en Presupuesto' : '+ Nuevo Concepto'}
                              </span>
                              <span className="text-[10px] text-gray-400 font-mono">{dec.confidence}%</span>
                            </div>
                            <p className="text-[11px] text-gray-600 line-clamp-2" title={dec.reasoning}>
                              {dec.reasoning}
                            </p>
                          </td>

                          {/* Categoría / Enlace Interactivo */}
                          <td className="px-3 py-3">
                            <div className="flex flex-col gap-1.5">
                              {/* Toggle acción */}
                              <div className="flex items-center gap-1">
                                <select
                                  value={dec.action}
                                  onChange={(e) => {
                                    const act = e.target.value as 'match_existing' | 'create_new' | 'ignore';
                                    updateDecision(dec.item.id, { action: act });
                                  }}
                                  className="text-[11px] font-medium bg-gray-50 border border-gray-300 rounded px-2 py-1 outline-none focus:ring-1 focus:ring-red-500"
                                >
                                  <option value="match_existing">Vincular a insumo existente</option>
                                  <option value="create_new">Crear concepto nuevo</option>
                                  <option value="ignore">Ignorar / No procesar</option>
                                </select>
                              </div>

                              {/* Si es match_existing, permitir cambiar el insumo vinculado */}
                              {dec.action === 'match_existing' && (
                                <select
                                  value={dec.matched_clave || ''}
                                  onChange={(e) => {
                                    const selectedClave = e.target.value;
                                    const found = budgetInsumos.find((i) => i.clave === selectedClave);
                                    updateDecision(dec.item.id, {
                                      matched_clave: selectedClave,
                                      matched_insumo_id: found?.id,
                                      category: found?.categoria || dec.category,
                                    });
                                  }}
                                  className="text-[11px] bg-white border border-gray-300 rounded px-2 py-1 max-w-[200px] truncate outline-none focus:ring-1 focus:ring-green-500 text-gray-800"
                                >
                                  {budgetInsumos.map((ins) => (
                                    <option key={ins.id} value={ins.clave}>
                                      [{ins.clave}] {ins.descripcion.slice(0, 35)}...
                                    </option>
                                  ))}
                                </select>
                              )}

                              {/* Si es create_new, permitir cambiar la categoría asignada */}
                              {dec.action === 'create_new' && (
                                <select
                                  value={dec.category}
                                  onChange={(e) => updateDecision(dec.item.id, { category: e.target.value })}
                                  className="text-[11px] bg-white border border-gray-300 rounded px-2 py-1 font-semibold text-gray-800 outline-none focus:ring-1 focus:ring-amber-500"
                                >
                                  {CATEGORIAS_OPTIONS.map((c) => (
                                    <option key={c} value={c}>
                                      {c}
                                    </option>
                                  ))}
                                </select>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {step === 'applying' && (
            <div className="py-20 flex flex-col items-center justify-center text-center space-y-4">
              <div className="w-14 h-14 border-4 border-red-200 border-t-red-600 rounded-full animate-spin"></div>
              <div>
                <h4 className="text-base font-bold text-gray-900">Aplicando conciliación a la base de datos...</h4>
                <p className="text-xs text-gray-500 mt-1 max-w-sm">
                  Vinculando claves a las órdenes, registrando nuevos conceptos clasificados y recalculando el presupuesto.
                </p>
              </div>
            </div>
          )}

          {step === 'finished' && (
            <div className="py-12 flex flex-col items-center justify-center text-center space-y-4">
              <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center shadow-inner">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div>
                <h4 className="text-xl font-black text-gray-900">¡Conciliación Completada con Éxito!</h4>
                <p className="text-sm text-gray-600 mt-1 max-w-md mx-auto">
                  La base de datos y el presupuesto de <strong>{storeName}</strong> han sido actualizados con exactitud.
                </p>
              </div>

              {resultSummary && (
                <div className="grid grid-cols-2 gap-4 max-w-sm w-full pt-2">
                  <div className="bg-green-50 border border-green-200 rounded-xl p-3 text-center">
                    <p className="text-xs text-green-800 font-semibold uppercase">Vinculados a Insumos</p>
                    <p className="text-2xl font-black text-green-700 mt-0.5">{resultSummary.matchedCount}</p>
                  </div>
                  <div className="bg-teal-50 border border-teal-200 rounded-xl p-3 text-center">
                    <p className="text-xs text-teal-800 font-semibold uppercase">Nuevos Clasificados</p>
                    <p className="text-2xl font-black text-teal-700 mt-0.5">{resultSummary.createdCount}</p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer controls */}
        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex items-center justify-between gap-3">
          {step === 'detection' && (
            <>
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 border border-gray-300 rounded-lg text-xs font-semibold text-gray-700 hover:bg-gray-100 transition"
              >
                Cerrar
              </button>

              {unlinkedItems.length > 0 && (
                <button
                  type="button"
                  onClick={handleAnalyzeWithAI}
                  className="px-5 py-2.5 bg-gradient-to-r from-amber-500 to-red-600 text-white rounded-lg text-xs font-bold hover:from-amber-600 hover:to-red-700 transition shadow-sm inline-flex items-center gap-2"
                >
                  <svg className="w-4 h-4 text-amber-200 animate-pulse" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M11 3a1 1 0 10-2 0v1a1 1 0 102 0V3zM15.657 5.757a1 1 0 00-1.414-1.414l-.707.707a1 1 0 001.414 1.414l.707-.707zM18 10a1 1 0 01-1 1h-1a1 1 0 110-2h1a1 1 0 011 1zM5.05 6.464A1 1 0 106.464 5.05l-.707-.707a1 1 0 00-1.414 1.414l.707.707zM5 10a1 1 0 01-1 1H3a1 1 0 110-2h1a1 1 0 011 1zM8 16v-1h4v1a2 2 0 11-4 0zM12 14c.015-.34.208-.646.477-.859a4 4 0 10-4.954 0c.27.213.462.519.477.859h4z" />
                  </svg>
                  <span>Iniciar Conciliación de Compras ({unlinkedItems.length})</span>
                </button>
              )}
            </>
          )}

          {step === 'review' && (
            <>
              <button
                type="button"
                onClick={() => setStep('detection')}
                className="px-4 py-2 border border-gray-300 rounded-lg text-xs font-semibold text-gray-700 hover:bg-gray-100 transition"
              >
                Volver
              </button>

              <div className="flex items-center gap-3">
                <span className="text-xs text-gray-500 hidden sm:inline">
                  {counts.selectedCount} seleccionados ({counts.matchedCount} a enlazar, {counts.createdCount} nuevos)
                </span>
                <button
                  type="button"
                  onClick={handleApplyReconciliation}
                  disabled={counts.selectedCount === 0}
                  className="px-6 py-2.5 bg-red-600 text-white rounded-lg text-xs font-bold hover:bg-red-700 transition shadow-sm disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>Aplicar Conciliación ({counts.selectedCount})</span>
                </button>
              </div>
            </>
          )}

          {step === 'finished' && (
            <div className="w-full flex justify-end">
              <button
                type="button"
                onClick={onClose}
                className="px-6 py-2.5 bg-gray-900 text-white rounded-lg text-xs font-bold hover:bg-black transition shadow"
              >
                Entendido y Cerrar
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
