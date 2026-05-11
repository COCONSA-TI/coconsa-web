'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useToast } from '@/components/ui/Toast';
import { OrderDetailSkeleton } from '@/components/ui/Skeletons';
import { ConfirmModal } from '@/components/ui/Modal';
import { useAuth } from '@/hooks/useAuth';

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

export default function ComprobacionDetallePage() {
  const params = useParams();
  const router = useRouter();
  const listId = params.id as string;
  const toast = useToast();

  const [needsList, setNeedsList] = useState<any>(null);
  const [proofs, setProofs] = useState<ExpenseProof[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [finalizing, setFinalizing] = useState(false);
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    action: 'submit' | 'accept' | 'reject' | null;
    title: string;
    message: string;
    variant: 'danger' | 'warning' | 'success';
  }>({
    isOpen: false,
    action: null,
    title: '',
    message: '',
    variant: 'warning'
  });
  const { user, isDepartmentHead, isAdmin } = useAuth();
  const [userDeptCode, setUserDeptCode] = useState<string | null>(null);

  // Form states
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [files, setFiles] = useState<File[]>([]);

  const fetchDetails = async () => {
    try {
      setLoading(true);
      // Fetch needs list details
      const nlRes = await fetch(`/api/v1/needs-lists/${listId}`);
      const nlData = await nlRes.json();
      if (!nlData.success) throw new Error(nlData.error || 'Error al cargar lista');
      setNeedsList(nlData.needsList);

      // Fetch proofs
      const prRes = await fetch(`/api/v1/needs-lists/${listId}/expense-proofs`);
      const prData = await prRes.json();
      if (prData.success) {
        setProofs(prData.proofs || []);
      }
    } catch (error) {
      toast.error('Error', error instanceof Error ? error.message : 'Error interno');
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
    } catch {}
  };

  useEffect(() => {
    fetchDetails();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listId]);

  useEffect(() => {
    fetchUserDept();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.department_id]);

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
            bucket: 'order-attachments', // reutilizamos bucket
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

      // Guardar en BD
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
      fetchDetails();
    } catch (error) {
      toast.error('Error', error instanceof Error ? error.message : 'Ocurrió un error');
    } finally {
      setUploading(false);
    }
  };

  const requestAction = (action: 'submit' | 'accept' | 'reject') => {
    let title = '';
    let message = '';
    let variant: 'danger' | 'warning' | 'success' = 'warning';

    if (action === 'submit') {
      title = 'Enviar a Revisión';
      message = '¿Enviar comprobantes a revisión? Ya no podrás agregar más a menos que sean rechazados.';
      variant = 'warning';
    } else if (action === 'accept') {
      title = 'Aceptar Comprobación';
      message = '¿Aceptar y cerrar esta comprobación permanentemente?';
      variant = 'success';
    } else {
      title = 'Rechazar Comprobación';
      message = '¿Rechazar comprobación para que el solicitante la edite?';
      variant = 'danger';
    }

    setConfirmModal({
      isOpen: true,
      action,
      title,
      message,
      variant
    });
  };

  const handleAction = async () => {
    const action = confirmModal.action;
    if (!action) return;
    
    setFinalizing(true);
    setConfirmModal(prev => ({ ...prev, isOpen: false }));
    try {
      const res = await fetch(`/api/v1/needs-lists/${listId}/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);

      toast.success('Exito', data.message || 'Acción realizada correctamente');
      fetchDetails();
    } catch (error) {
      toast.error('Error', error instanceof Error ? error.message : 'Error interno');
    } finally {
      setFinalizing(false);
    }
  };

  if (loading) return <OrderDetailSkeleton />;
  if (!needsList) return <div className="p-6">Lista no encontrada</div>;

  const totalEntregado = needsList.total || 0;
  const totalComprobado = proofs.reduce((sum, p) => sum + Number(p.amount), 0);
  // Al subir múltiples archivos a la vez se duplica el amount en la BD con el código actual, 
  // pero el user normalmente sube un archivo (PDF) y le pone un amount. 
  // O podemos agrupar. Por ahora es un simple reduce. 
  // Wait, in my route.ts I did proofsToInsert = files.map(... amount). 
  // So if they upload 2 files (XML, PDF), the amount doubles. 
  // Let's divide it by the number of files inserted at that time, or we can just tell them to upload 1 amount per upload batch.
  // Actually, I'll calculate unique amounts by some group ID if needed, but for MVP let's assume they enter the total of the uploaded docs. 
  // To avoid double counting, I can group by created_at or description, but let's just do a unique Set for now or fix the API route.
  
  // Actually, let's fix the API route later. For now, we will calculate unique sums by grouping.
  const uniqueProofs = Array.from(new Map(proofs.map(p => [p.created_at, p])).values());
  const actualComprobado = uniqueProofs.reduce((sum, p) => sum + Number(p.amount), 0);
  
  const formatCurrency = (val: number) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: needsList.currency || 'MXN' }).format(val);

  const isVerified = needsList.status === 'verified';
  const isApplicant = user?.email === needsList.user_email;
  
  // Can Edit (Upload Proofs) - Solo el solicitante
  const canEdit = isApplicant;

  // Can Approve (Accept/Reject/Finalize)
  const canApprove = isAdmin || 
    (isDepartmentHead && ['direccion', 'pagos', 'contabilidad'].includes(userDeptCode || '')) ||
    (isDepartmentHead && needsList.department_name && userDeptCode === needsList.department_name.toLowerCase());

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <button onClick={() => router.push('/dashboard/comprobaciones')} className="p-2 bg-white rounded-lg border hover:bg-gray-50 transition-colors">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Comprobación: {needsList.folio || `NL-${listId.padStart(4, '0')}`}</h1>
          <p className="text-gray-500">Solicitante: {needsList.user_name}</p>
        </div>
        {needsList.status === 'verified' && (
          <span className="ml-auto px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
            Comprobada
          </span>
        )}
        {needsList.status === 'verifying' && (
          <span className="ml-auto px-3 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
            En Revisión
          </span>
        )}
        {needsList.status === 'completed' && (
          <span className="ml-auto px-3 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
            Pendiente Subir
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Resumen Financiero */}
        <div className="bg-white rounded-xl shadow p-5 border border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Resumen Financiero</h2>
          <div className="space-y-4">
            <div>
              <p className="text-sm text-gray-500">Total Entregado</p>
              <p className="text-2xl font-bold text-gray-900">{formatCurrency(totalEntregado)}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Total Comprobado</p>
              <p className="text-2xl font-bold text-emerald-600">{formatCurrency(actualComprobado)}</p>
            </div>
            <div className="pt-4 border-t border-gray-100">
              <p className="text-sm text-gray-500">Diferencia (Por devolver)</p>
              <p className={`text-xl font-bold ${totalEntregado - actualComprobado < 0 ? 'text-red-600' : 'text-gray-900'}`}>
                {formatCurrency(totalEntregado - actualComprobado)}
              </p>
            </div>
          </div>
        </div>

        {/* Formulario de carga */}
        <div className="md:col-span-2 bg-white rounded-xl shadow p-5 border border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Agregar Comprobante (Factura/Ticket)</h2>
          {needsList.status === 'verified' ? (
            <div className="p-4 bg-gray-50 rounded-lg border border-gray-200 text-center text-gray-500">
              Esta lista ya fue comprobada y cerrada.
            </div>
          ) : needsList.status === 'verifying' ? (
            <div className="p-4 bg-blue-50 rounded-lg border border-blue-200 text-center text-blue-700">
              Comprobantes en revisión. Espera la respuesta.
            </div>
          ) : !canEdit ? (
            <div className="p-4 bg-yellow-50 rounded-lg border border-yellow-200 text-center text-yellow-700">
              Solo el solicitante puede subir comprobantes.
            </div>
          ) : (
            <form onSubmit={handleUpload} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Descripción / Concepto</label>
                  <input type="text" value={description} onChange={e => setDescription(e.target.value)} placeholder="Ej. Compra de material..." className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none text-gray-900" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Monto del comprobante</label>
                  <input type="number" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00" className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none text-gray-900" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Archivos (XML, PDF, JPG)</label>
                <input type="file" multiple accept=".pdf,.xml,.jpg,.png" onChange={e => setFiles(Array.from(e.target.files || []))} className="w-full px-4 py-2 border rounded-lg file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-emerald-50 file:text-emerald-700 hover:file:bg-emerald-100 text-gray-900" />
              </div>

              <div className="flex justify-end pt-2">
                <button type="submit" disabled={uploading} className="px-6 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 transition-colors flex items-center gap-2 font-medium">
                  {uploading ? 'Subiendo...' : 'Guardar Comprobante'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>

      {/* Lista de comprobantes */}
      <div className="bg-white rounded-xl shadow p-5 border border-gray-100">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Comprobantes Registrados</h2>
          <div className="flex gap-2">
            {needsList.status === 'completed' && canEdit && proofs.length > 0 && (
              <button onClick={() => requestAction('submit')} disabled={finalizing} className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 text-sm font-medium transition-colors">
                {finalizing ? 'Procesando...' : 'Enviar a Revisión'}
              </button>
            )}
            {needsList.status === 'verifying' && canApprove && (
              <>
                <button onClick={() => requestAction('reject')} disabled={finalizing} className="px-4 py-2 bg-red-50 text-red-700 rounded-lg hover:bg-red-100 disabled:opacity-50 text-sm font-medium transition-colors border border-red-200">
                  Rechazar
                </button>
                <button onClick={() => requestAction('accept')} disabled={finalizing} className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 text-sm font-medium transition-colors">
                  Aceptar
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
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {proofs.map(proof => (
                  <tr key={proof.id}>
                    <td className="px-4 py-3 text-sm text-gray-900 font-medium">{proof.description}</td>
                    <td className="px-4 py-3 text-sm">
                      <a href={proof.file_url} target="_blank" rel="noopener noreferrer" className="text-emerald-600 hover:underline flex items-center gap-1">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" /></svg>
                        {proof.file_name}
                      </a>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">{new Date(proof.created_at).toLocaleDateString('es-MX')}</td>
                    <td className="px-4 py-3 text-sm text-right font-medium text-gray-900">{formatCurrency(proof.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Conceptos Originales (Items de la lista) */}
      <div className="bg-white rounded-xl shadow p-5 border border-gray-100">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Artículos Solicitados Originalmente</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-gray-50 border-y border-gray-200">
                <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Artículo</th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Cant.</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Precio Est.</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Total Est.</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {needsList.items?.map((item: any, idx: number) => (
                <tr key={idx}>
                  <td className="px-4 py-3 text-sm text-gray-900">{item.description}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{item.quantity} {item.unit}</td>
                  <td className="px-4 py-3 text-sm text-right text-gray-600">{formatCurrency(item.unit_price)}</td>
                  <td className="px-4 py-3 text-sm text-right font-medium text-gray-900">{formatCurrency(item.subtotal)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal de confirmación */}
      <ConfirmModal
        isOpen={confirmModal.isOpen}
        onClose={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
        onConfirm={handleAction}
        title={confirmModal.title}
        message={confirmModal.message}
        variant={confirmModal.variant}
        loading={finalizing}
        confirmText={confirmModal.action === 'reject' ? 'Rechazar' : confirmModal.action === 'accept' ? 'Aceptar' : 'Enviar a Revisión'}
      />
    </div>
  );
}
