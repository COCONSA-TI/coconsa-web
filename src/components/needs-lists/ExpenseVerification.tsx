'use client';

import { useState, useEffect } from 'react';
import { useToast } from '@/components/ui/Toast';
import { ConfirmModal } from '@/components/ui/Modal';
import { useAuth } from '@/hooks/useAuth';
import { mergeUrlsToPdf } from '@/lib/pdfUtils';

interface ExpenseProof {
  id: string;
  description: string;
  amount: number;
  file_name: string;
  file_url: string;
  created_at: string;
  uploader?: {
    full_name: string;
  };
}

interface ExpenseVerificationProps {
  listId: string;
  listStatus: string;
  listTotal: number;
  listDepositAmount?: number | null;
  listCurrency: string;
  listUserEmail: string;
  onStatusChange: () => void;
}

export default function ExpenseVerification({
  listId,
  listStatus,
  listTotal,
  listDepositAmount,
  listCurrency,
  listUserEmail,
  onStatusChange,
}: ExpenseVerificationProps) {
  const toast = useToast();
  const { user, isDepartmentHead, isAdmin } = useAuth();

  const [proofs, setProofs] = useState<ExpenseProof[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [finalizing, setFinalizing] = useState(false);
  const [isMerging, setIsMerging] = useState(false);
  const [userDeptCode, setUserDeptCode] = useState<string | null>(null);
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    action: 'submit' | 'accept' | 'reject' | 'delete' | 'reopen' | null;
    title: string;
    message: string;
    variant: 'danger' | 'warning' | 'success';
    proofIdToDelete?: string;
  }>({
    isOpen: false,
    action: null,
    title: '',
    message: '',
    variant: 'warning',
  });

  // Form states
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [files, setFiles] = useState<File[]>([]);

  // Saldos pendientes de listas anteriores
  const [previousBalances, setPreviousBalances] = useState<{
    lists: Array<{ id: number; folio: string | null; remaining_balance: number; currency: string }>;
    totalPendingBalance: number;
  }>({ lists: [], totalPendingBalance: 0 });

  const fetchProofs = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/v1/needs-lists/${listId}/expense-proofs`);
      const data = await res.json();
      if (data.success) {
        setProofs(data.proofs || []);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  };

  const fetchUserDept = async () => {
    if (!user?.department_id) return;
    try {
      const res = await fetch(`/api/v1/departments/${user.department_id}`);
      const data = await res.json();
      if (data.success && data.department) {
        setUserDeptCode(data.department.code);
      }
    } catch {
      // silent
    }
  };

  useEffect(() => {
    fetchProofs();
    fetchPreviousBalances();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listId]);

  useEffect(() => {
    fetchUserDept();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.department_id]);

  const fetchPreviousBalances = async () => {
    try {
      const res = await fetch('/api/v1/needs-lists/pending-balances');
      const data = await res.json();
      if (data.success) {
        // Excluir la lista actual de los saldos pendientes
        const otherLists = (data.lists || []).filter(
          (l: { id: number }) => String(l.id) !== String(listId)
        );
        const total = otherLists.reduce(
          (sum: number, l: { remaining_balance: number }) => sum + Number(l.remaining_balance),
          0
        );
        setPreviousBalances({
          lists: otherLists,
          totalPendingBalance: Math.round(total * 100) / 100,
        });
      }
    } catch {
      // silent
    }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!description || !amount || files.length === 0) {
      toast.warning('Campos requeridos', 'Ingresa la descripción, monto y adjunta al menos un archivo');
      return;
    }

    setUploading(true);
    try {
      const filesInfo = [];
      for (const file of files) {
        const urlRes = await fetch('/api/v1/storage/signed-url', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fileName: file.name,
            contentType: file.type,
            bucket: 'order-attachments',
            folder: `expense-proofs/${listId}`,
          }),
        });

        if (!urlRes.ok) throw new Error('Error al generar URL para ' + file.name);
        const urlData = await urlRes.json();

        const uploadRes = await fetch(urlData.signedUrl, {
          method: 'PUT',
          headers: { 'Content-Type': file.type },
          body: file,
        });

        if (!uploadRes.ok) throw new Error('Error subiendo ' + file.name);

        filesInfo.push({
          name: file.name,
          size: file.size,
          type: file.type,
          url: urlData.publicUrl,
          path: urlData.path,
        });
      }

      const res = await fetch(`/api/v1/needs-lists/${listId}/expense-proofs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          description,
          amount: parseFloat(amount),
          files: filesInfo,
        }),
      });

      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Error al guardar');

      toast.success('Guardado', 'Comprobante registrado correctamente');
      setDescription('');
      setAmount('');
      setFiles([]);
      fetchProofs();
    } catch (error) {
      toast.error('Error', error instanceof Error ? error.message : 'Ocurrió un error');
    } finally {
      setUploading(false);
    }
  };

  const requestDeleteProof = (proofId: string) => {
    setConfirmModal({
      isOpen: true,
      action: 'delete',
      title: 'Eliminar comprobante',
      message: '¿Seguro que deseas eliminar este comprobante? Tendrás que volver a subirlo si fue un error.',
      variant: 'danger',
      proofIdToDelete: proofId,
    });
  };

  const requestAction = (action: 'submit' | 'accept' | 'reject' | 'reopen') => {
    let title = '';
    let message = '';
    let variant: 'danger' | 'warning' | 'success' = 'warning';

    if (action === 'submit') {
      title = 'Enviar a Revisión';
      message = '¿Enviar comprobantes a revisión? Puedes seguir agregando comprobantes mientras están en revisión.';
      variant = 'warning';
    } else if (action === 'accept') {
      title = 'Aceptar Comprobación';
      message = hasRemainingBalance
        ? `Hay un saldo pendiente de ${formatCurrency(remainingBalance)}. Al aceptar, este saldo quedará registrado como pendiente y podrá comprobarse posteriormente o arrastrarse a otra lista.`
        : '¿Aceptar y cerrar esta comprobación?';
      variant = 'success';
    } else if (action === 'reopen') {
      title = 'Reabrir Comprobación';
      message = '¿Reabrir esta lista para agregar más comprobantes del saldo pendiente?';
      variant = 'warning';
    } else {
      title = 'Rechazar Comprobación';
      message = '¿Rechazar comprobación para que el solicitante la edite?';
      variant = 'danger';
    }

    setConfirmModal({ isOpen: true, action, title, message, variant });
  };

  const handleAction = async () => {
    const action = confirmModal.action;
    if (!action) return;

    setFinalizing(true);
    setConfirmModal((prev) => ({ ...prev, isOpen: false }));

    if (action === 'delete') {
      try {
        const res = await fetch(
          `/api/v1/needs-lists/${listId}/expense-proofs?proofId=${confirmModal.proofIdToDelete}`,
          { method: 'DELETE' }
        );
        const data = await res.json();
        if (!data.success) throw new Error(data.error);
        toast.success('Eliminado', 'El comprobante ha sido removido');
        fetchProofs();
      } catch (error) {
        toast.error('Error', error instanceof Error ? error.message : 'No se pudo eliminar');
      } finally {
        setFinalizing(false);
      }
      return;
    }

    try {
      const res = await fetch(`/api/v1/needs-lists/${listId}/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);

      toast.success('Éxito', data.message || 'Acción realizada correctamente');
      fetchProofs();
      onStatusChange();
    } catch (error) {
      toast.error('Error', error instanceof Error ? error.message : 'Error interno');
    } finally {
      setFinalizing(false);
    }
  };

  const handleMergeProofs = async () => {
    if (proofs.length === 0) {
      toast.warning('Sin comprobantes', 'No hay comprobantes para descargar.');
      return;
    }

    setIsMerging(true);
    try {
      const urls = proofs.map(p => ({ url: p.file_url, name: p.file_name }));
      await mergeUrlsToPdf(urls, `comprobantes_NL-${listId}.pdf`);
      toast.success('Éxito', 'Los comprobantes han sido descargados en un solo PDF.');
    } catch (error) {
      console.error('Error merging proofs:', error);
      toast.error('Error', 'No se pudieron unir los comprobantes.');
    } finally {
      setIsMerging(false);
    }
  };

  // Permissions
  const isApplicant = user?.email === listUserEmail;
  const canEdit = isApplicant;
  // Solo Dirección puede aceptar/rechazar la comprobación (firma final)
  const canApprove =
    isAdmin ||
    (isDepartmentHead && userDeptCode === 'direccion');

  // Financial calculations
  const totalEntregado = listDepositAmount !== undefined && listDepositAmount !== null ? listDepositAmount : (listTotal || 0);
  const uniqueProofs = Array.from(new Map(proofs.map((p) => [p.created_at, p])).values());
  const actualComprobado = uniqueProofs.reduce((sum, p) => sum + Number(p.amount), 0);
  const remainingBalance = totalEntregado - actualComprobado;
  const hasRemainingBalance = remainingBalance > 0.01;
  const progressPercent = totalEntregado > 0 ? Math.min((actualComprobado / totalEntregado) * 100, 100) : 0;

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat('es-MX', { style: 'currency', currency: listCurrency || 'MXN' }).format(val);

  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow p-6 border border-gray-100">
        <div className="animate-pulse space-y-4">
          <div className="h-6 w-48 bg-gray-200 rounded"></div>
          <div className="h-4 w-64 bg-gray-200 rounded"></div>
          <div className="grid grid-cols-3 gap-4">
            <div className="h-20 bg-gray-200 rounded-lg"></div>
            <div className="h-20 bg-gray-200 rounded-lg"></div>
            <div className="h-20 bg-gray-200 rounded-lg"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="bg-white rounded-xl shadow border border-gray-100 overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-600 to-emerald-700 px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <div>
                <h2 className="text-lg font-semibold text-white">Comprobación de Gastos</h2>
                <p className="text-emerald-100 text-sm">Registra las facturas y comprobantes de esta lista</p>
              </div>
            </div>
            {listStatus === 'verified' && (
              <span className="px-3 py-1 rounded-full text-xs font-medium bg-white/20 text-white">
                ✓ Comprobada
              </span>
            )}
            {listStatus === 'verifying' && (
              <span className="px-3 py-1 rounded-full text-xs font-medium bg-yellow-400/20 text-yellow-100">
                En Revisión
              </span>
            )}
            {listStatus === 'completed' && (
              <span className="px-3 py-1 rounded-full text-xs font-medium bg-white/20 text-emerald-100">
                Pendiente Subir
              </span>
            )}
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* Resumen Financiero */}
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-sm text-gray-500">Total Entregado</p>
                <p className="text-xl font-bold text-gray-900 mt-1">{formatCurrency(totalEntregado)}</p>
              </div>
              <div className="bg-emerald-50 rounded-lg p-4">
                <p className="text-sm text-emerald-600">Total Comprobado</p>
                <p className="text-xl font-bold text-emerald-700 mt-1">{formatCurrency(actualComprobado)}</p>
              </div>
              <div className={`rounded-lg p-4 ${remainingBalance < 0 ? 'bg-red-50' : hasRemainingBalance ? 'bg-amber-50' : 'bg-green-50'}`}>
                <p className="text-sm text-gray-500">Saldo Pendiente</p>
                <p className={`text-xl font-bold mt-1 ${remainingBalance < 0 ? 'text-red-600' : hasRemainingBalance ? 'text-amber-600' : 'text-green-600'}`}>
                  {formatCurrency(remainingBalance)}
                </p>
              </div>
            </div>

            {/* Barra de progreso */}
            {totalEntregado > 0 && (
              <div>
                <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                  <span>Avance de comprobación</span>
                  <span>{progressPercent.toFixed(0)}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2.5">
                  <div
                    className={`h-2.5 rounded-full transition-all duration-500 ${
                      progressPercent >= 100 ? 'bg-green-500' : progressPercent >= 50 ? 'bg-emerald-500' : 'bg-amber-500'
                    }`}
                    style={{ width: `${Math.min(progressPercent, 100)}%` }}
                  ></div>
                </div>
              </div>
            )}

            {/* Mensaje de saldo pendiente */}
            {hasRemainingBalance && listStatus === 'verified' && (
              <div className="flex items-start gap-3 p-3 bg-amber-50 rounded-lg border border-amber-200">
                <svg className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div>
                  <p className="text-sm font-medium text-amber-800">Saldo pendiente: {formatCurrency(remainingBalance)}</p>
                  <p className="text-xs text-amber-600 mt-0.5">
                    Este saldo puede comprobarse reabriendo esta lista o arrastrándolo a una siguiente lista de necesidades.
                  </p>
                </div>
                {canEdit && (
                  <button
                    onClick={() => requestAction('reopen')}
                    disabled={finalizing}
                    className="ml-auto px-3 py-1.5 text-xs font-medium text-amber-700 bg-amber-100 rounded-lg hover:bg-amber-200 transition-colors disabled:opacity-50 whitespace-nowrap"
                  >
                    Reabrir
                  </button>
                )}
              </div>
            )}

            {/* Saldos pendientes de listas anteriores */}
            {previousBalances.lists.length > 0 && (
              <div className="p-4 bg-indigo-50 rounded-lg border border-indigo-200">
                <div className="flex items-center gap-2 mb-2">
                  <svg className="w-5 h-5 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                  </svg>
                  <h4 className="text-sm font-semibold text-indigo-800">Saldos de Listas Anteriores</h4>
                </div>
                <div className="space-y-1.5">
                  {previousBalances.lists.map((list) => (
                    <div key={list.id} className="flex items-center justify-between text-sm">
                      <span className="text-indigo-700">{list.folio || `NL-${list.id}`}</span>
                      <span className={`font-medium ${Number(list.remaining_balance) > 0 ? 'text-amber-600' : 'text-red-600'}`}>
                        {Number(list.remaining_balance) > 0 ? '+' : ''}{formatCurrency(Number(list.remaining_balance))}
                      </span>
                    </div>
                  ))}
                  <div className="border-t border-indigo-200 pt-1.5 mt-1.5 flex items-center justify-between">
                    <span className="text-sm font-medium text-indigo-800">Total acumulado</span>
                    <span className={`text-base font-bold ${previousBalances.totalPendingBalance > 0 ? 'text-amber-600' : 'text-red-600'}`}>
                      {previousBalances.totalPendingBalance > 0 ? '+' : ''}{formatCurrency(previousBalances.totalPendingBalance)}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Formulario de carga */}
          {listStatus === 'verified' && !hasRemainingBalance ? (
            <div className="p-4 bg-gray-50 rounded-lg border border-gray-200 text-center text-gray-500">
              Esta lista ya fue comprobada y cerrada.
            </div>
          ) : listStatus === 'verified' && hasRemainingBalance ? (
            <div className="p-4 bg-amber-50 rounded-lg border border-amber-200 text-center text-amber-700">
              Lista comprobada con saldo pendiente. Puedes reabrir la lista para agregar más comprobantes.
            </div>
          ) : !canEdit ? (
            <div className="p-4 bg-yellow-50 rounded-lg border border-yellow-200 text-center text-yellow-700">
              Solo el solicitante puede subir comprobantes.
            </div>
          ) : (
            <>
              {listStatus === 'verifying' && (
                <div className="p-3 bg-blue-50 rounded-lg border border-blue-200 flex items-center gap-2 text-sm text-blue-700">
                  <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Comprobantes en revisión. Puedes seguir agregando comprobantes mientras tanto.
                </div>
              )}
              <form onSubmit={handleUpload} className="space-y-4 bg-gray-50 rounded-lg p-4 border border-gray-200">
                <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Agregar Comprobante</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Descripción / Concepto</label>
                  <input
                    type="text"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Ej. Compra de material..."
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none text-gray-900"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Monto del comprobante</label>
                  <input
                    type="number"
                    step="0.01"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0.00"
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none text-gray-900"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Archivos (XML, PDF, JPG)</label>
                <input
                  type="file"
                  multiple
                  accept=".pdf,.xml,.jpg,.png"
                  onChange={(e) => setFiles(Array.from(e.target.files || []))}
                  className="w-full px-4 py-2 border rounded-lg file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-emerald-50 file:text-emerald-700 hover:file:bg-emerald-100 text-gray-900"
                />
              </div>
              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  disabled={uploading}
                  className="px-6 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 transition-colors flex items-center gap-2 font-medium"
                >
                  {uploading ? 'Subiendo...' : 'Guardar Comprobante'}
                </button>
              </div>
              </form>
            </>
          )}

          {/* Lista de comprobantes */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-semibold text-gray-900">
                Comprobantes Registrados
                {proofs.length > 0 && (
                  <span className="text-gray-400 font-normal ml-2">({proofs.length})</span>
                )}
              </h3>
              <div className="flex gap-2">
                {proofs.length > 0 && (
                  <button
                    onClick={handleMergeProofs}
                    disabled={isMerging}
                    className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 text-sm font-medium transition-colors flex items-center gap-1"
                    title="Descargar todos en 1 PDF"
                  >
                    {isMerging ? (
                      <>
                        <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Descargando...
                      </>
                    ) : (
                      <>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" />
                        </svg>
                        Unir PDF
                      </>
                    )}
                  </button>
                )}
                {listStatus === 'completed' && canEdit && proofs.length > 0 && (
                  <button
                    onClick={() => requestAction('submit')}
                    disabled={finalizing}
                    className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 text-sm font-medium transition-colors"
                  >
                    {finalizing ? 'Procesando...' : 'Enviar a Revisión'}
                  </button>
                )}
                {listStatus === 'verifying' && canApprove && (
                  <>
                    <button
                      onClick={() => requestAction('reject')}
                      disabled={finalizing}
                      className="px-4 py-2 bg-red-50 text-red-700 rounded-lg hover:bg-red-100 disabled:opacity-50 text-sm font-medium transition-colors border border-red-200"
                    >
                      Rechazar
                    </button>
                    <button
                      onClick={() => requestAction('accept')}
                      disabled={finalizing}
                      className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 text-sm font-medium transition-colors"
                    >
                      {hasRemainingBalance ? 'Aceptar con Saldo' : 'Aceptar'}
                    </button>
                  </>
                )}
              </div>
            </div>

            {proofs.length === 0 ? (
              <p className="text-gray-500 text-center py-8">No hay comprobantes registrados aún.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-gray-50 border-y border-gray-200">
                      <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Concepto</th>
                      <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Archivo</th>
                      <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Fecha</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Monto</th>
                      {(listStatus === 'completed' || listStatus === 'verifying') && canEdit && (
                        <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Acción</th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {proofs.map((proof) => (
                      <tr key={proof.id}>
                        <td className="px-4 py-3 text-sm text-gray-900 font-medium">{proof.description}</td>
                        <td className="px-4 py-3 text-sm">
                          <a
                            href={proof.file_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-emerald-600 hover:underline flex items-center gap-1"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                            </svg>
                            {proof.file_name}
                          </a>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-500">
                          {new Date(proof.created_at).toLocaleDateString('es-MX')}
                        </td>
                        <td className="px-4 py-3 text-sm text-right font-medium text-gray-900">
                          {formatCurrency(proof.amount)}
                        </td>
                        {(listStatus === 'completed' || listStatus === 'verifying') && canEdit && (
                          <td className="px-4 py-3 text-right">
                            <button
                              onClick={() => requestDeleteProof(proof.id)}
                              className="p-1 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
                              title="Eliminar comprobante"
                            >
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modal de confirmación */}
      <ConfirmModal
        isOpen={confirmModal.isOpen}
        onClose={() => setConfirmModal((prev) => ({ ...prev, isOpen: false }))}
        onConfirm={handleAction}
        title={confirmModal.title}
        message={confirmModal.message}
        variant={confirmModal.variant}
        loading={finalizing}
        confirmText={
           confirmModal.action === 'delete'
            ? 'Eliminar'
            : confirmModal.action === 'reject'
              ? 'Rechazar'
              : confirmModal.action === 'accept'
                ? (hasRemainingBalance ? 'Aceptar con Saldo Pendiente' : 'Aceptar')
                : confirmModal.action === 'reopen'
                  ? 'Reabrir'
                  : 'Enviar a Revisión'
        }
      />
    </>
  );
}
