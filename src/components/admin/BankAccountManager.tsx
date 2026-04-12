"use client";

import { useState, useEffect } from "react";
import { useToast } from "@/components/ui/Toast";
import { Modal, ConfirmModal } from "@/components/ui/Modal";

interface BankAccount {
  id: string;
  bank_name: string;
  account_number: string;
  clabe: string;
  account_holder_name: string;
  is_primary: boolean;
  is_active: boolean;
  created_at: string;
}

interface BankAccountManagerProps {
  isOpen: boolean;
  onClose: () => void;
  onAccountAdded?: () => void;
}

// Mexican banks list
const MEXICAN_BANKS = [
  "BBVA",
  "Santander",
  "Banorte",
  "Citibanamex",
  "HSBC",
  "Scotiabank",
  "Banco Azteca",
  "BanCoppel",
  "Inbursa",
  "Banco del Bajío",
  "Banregio",
  "Afirme",
  "Multiva",
  "Banca Mifel",
  "CI Banco",
  "Compartamos Banco",
  "Otro",
];

export default function BankAccountManager({ isOpen, onClose, onAccountAdded }: BankAccountManagerProps) {
  const toast = useToast();
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // Form state
  const [showForm, setShowForm] = useState(false);
  const [editingAccount, setEditingAccount] = useState<BankAccount | null>(null);
  const [bankName, setBankName] = useState("");
  const [customBankName, setCustomBankName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [clabe, setClabe] = useState("");
  const [accountHolderName, setAccountHolderName] = useState("");
  const [isPrimary, setIsPrimary] = useState(false);
  
  // Delete confirmation
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchAccounts = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/v1/bank-accounts');
      const data = await response.json();
      
      if (data.success) {
        setAccounts(data.data || []);
      } else {
        toast.error('Error', 'No se pudieron cargar las cuentas bancarias');
      }
    } catch (error) {
      toast.error('Error', 'Error al cargar las cuentas bancarias');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchAccounts();
    }
  }, [isOpen]);

  const resetForm = () => {
    setBankName("");
    setCustomBankName("");
    setAccountNumber("");
    setClabe("");
    setAccountHolderName("");
    setIsPrimary(false);
    setEditingAccount(null);
    setShowForm(false);
  };

  const openEditForm = (account: BankAccount) => {
    setEditingAccount(account);
    // Check if bank name is in the list or custom
    if (MEXICAN_BANKS.includes(account.bank_name)) {
      setBankName(account.bank_name);
      setCustomBankName("");
    } else {
      setBankName("Otro");
      setCustomBankName(account.bank_name);
    }
    setAccountNumber(account.account_number);
    setClabe(account.clabe);
    setAccountHolderName(account.account_holder_name);
    setIsPrimary(account.is_primary);
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const finalBankName = bankName === "Otro" ? customBankName : bankName;
    
    // Validations
    if (!finalBankName) {
      toast.warning('Campo requerido', 'Selecciona o ingresa el nombre del banco');
      return;
    }
    if (!accountNumber || accountNumber.length < 10) {
      toast.warning('Campo requerido', 'Ingresa un número de cuenta válido (mínimo 10 dígitos)');
      return;
    }
    if (!clabe || clabe.length !== 18) {
      toast.warning('Campo requerido', 'La CLABE debe tener exactamente 18 dígitos');
      return;
    }
    if (!/^\d{18}$/.test(clabe)) {
      toast.warning('CLABE inválida', 'La CLABE debe contener solo números');
      return;
    }
    if (!accountHolderName) {
      toast.warning('Campo requerido', 'Ingresa el nombre del titular');
      return;
    }

    setSaving(true);
    try {
      const endpoint = editingAccount 
        ? `/api/v1/bank-accounts/${editingAccount.id}`
        : '/api/v1/bank-accounts';
      
      const method = editingAccount ? 'PUT' : 'POST';
      
      const response = await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bank_name: finalBankName,
          account_number: accountNumber,
          clabe,
          account_holder_name: accountHolderName,
          is_primary: isPrimary,
        }),
      });

      const data = await response.json();

      if (data.success) {
        toast.success(
          editingAccount ? 'Cuenta actualizada' : 'Cuenta agregada', 
          editingAccount ? 'La cuenta bancaria se actualizó correctamente' : 'La cuenta bancaria se agregó correctamente'
        );
        resetForm();
        await fetchAccounts();
        onAccountAdded?.();
      } else {
        throw new Error(data.error || 'Error al guardar la cuenta');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Error al guardar la cuenta bancaria';
      toast.error('Error', errorMessage);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (accountId: string) => {
    setDeleting(true);
    try {
      const response = await fetch(`/api/v1/bank-accounts/${accountId}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (data.success) {
        toast.success('Cuenta eliminada', 'La cuenta bancaria se eliminó correctamente');
        setDeleteConfirmId(null);
        await fetchAccounts();
        onAccountAdded?.();
      } else {
        throw new Error(data.error || 'Error al eliminar la cuenta');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Error al eliminar la cuenta bancaria';
      toast.error('Error', errorMessage);
    } finally {
      setDeleting(false);
    }
  };

  const handleSetPrimary = async (accountId: string) => {
    try {
      const response = await fetch(`/api/v1/bank-accounts/${accountId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_primary: true }),
      });

      const data = await response.json();

      if (data.success) {
        toast.success('Cuenta principal', 'Se actualizó la cuenta principal');
        await fetchAccounts();
        onAccountAdded?.();
      } else {
        throw new Error(data.error || 'Error al actualizar la cuenta');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Error al actualizar la cuenta';
      toast.error('Error', errorMessage);
    }
  };

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={() => {
          resetForm();
          onClose();
        }}
        title="Mis Cuentas Bancarias"
        size="lg"
      >
        <div className="space-y-4">
          {/* Header with add button */}
          {!showForm && (
            <div className="flex justify-between items-center">
              <p className="text-sm text-gray-600">
                Administra las cuentas bancarias donde recibirás los reembolsos y anticipos.
              </p>
              <button
                onClick={() => setShowForm(true)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 text-sm font-medium"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Agregar cuenta
              </button>
            </div>
          )}

          {/* Form */}
          {showForm && (
            <form onSubmit={handleSubmit} className="bg-gray-50 rounded-lg p-4 space-y-4">
              <div className="flex justify-between items-center mb-2">
                <h3 className="font-medium text-gray-900">
                  {editingAccount ? 'Editar cuenta bancaria' : 'Nueva cuenta bancaria'}
                </h3>
                <button
                  type="button"
                  onClick={resetForm}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Bank Name */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Banco <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={bankName}
                    onChange={(e) => setBankName(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
                  >
                    <option value="">Selecciona un banco</option>
                    {MEXICAN_BANKS.map((bank) => (
                      <option key={bank} value={bank}>{bank}</option>
                    ))}
                  </select>
                </div>

                {/* Custom Bank Name */}
                {bankName === "Otro" && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Nombre del banco <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={customBankName}
                      onChange={(e) => setCustomBankName(e.target.value)}
                      placeholder="Escribe el nombre del banco"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
                    />
                  </div>
                )}

                {/* Account Holder Name */}
                <div className={bankName === "Otro" ? "md:col-span-2" : ""}>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Titular de la cuenta <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={accountHolderName}
                    onChange={(e) => setAccountHolderName(e.target.value)}
                    placeholder="Nombre completo del titular"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
                  />
                </div>

                {/* Account Number */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Número de cuenta <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={accountNumber}
                    onChange={(e) => setAccountNumber(e.target.value.replace(/\D/g, ''))}
                    placeholder="10-12 dígitos"
                    maxLength={12}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 font-mono"
                  />
                </div>

                {/* CLABE */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    CLABE Interbancaria <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={clabe}
                    onChange={(e) => setClabe(e.target.value.replace(/\D/g, ''))}
                    placeholder="18 dígitos"
                    maxLength={18}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 font-mono"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    {clabe.length}/18 dígitos
                  </p>
                </div>
              </div>

              {/* Primary checkbox */}
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={isPrimary}
                  onChange={(e) => setIsPrimary(e.target.checked)}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700">Establecer como cuenta principal</span>
              </label>

              {/* Form actions */}
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={resetForm}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                >
                  {saving ? (
                    <>
                      <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Guardando...
                    </>
                  ) : (
                    editingAccount ? 'Guardar cambios' : 'Agregar cuenta'
                  )}
                </button>
              </div>
            </form>
          )}

          {/* Accounts list */}
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : accounts.length === 0 ? (
            <div className="text-center py-8 bg-gray-50 rounded-lg">
              <svg className="w-12 h-12 text-gray-400 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
              </svg>
              <p className="text-gray-600">No tienes cuentas bancarias registradas</p>
              <p className="text-sm text-gray-500 mt-1">Agrega una cuenta para recibir tus reembolsos</p>
            </div>
          ) : (
            <div className="space-y-3">
              {accounts.map((account) => (
                <div
                  key={account.id}
                  className={`border rounded-lg p-4 ${
                    account.is_primary ? 'border-blue-300 bg-blue-50' : 'border-gray-200 bg-white'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                        account.is_primary ? 'bg-blue-100' : 'bg-gray-100'
                      }`}>
                        <svg className={`w-5 h-5 ${account.is_primary ? 'text-blue-600' : 'text-gray-500'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                        </svg>
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-gray-900">{account.bank_name}</span>
                          {account.is_primary && (
                            <span className="px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-700 rounded-full">
                              Principal
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-600 mt-0.5">{account.account_holder_name}</p>
                        <div className="flex flex-col sm:flex-row sm:gap-4 mt-2 text-xs text-gray-500">
                          <span>Cuenta: ****{account.account_number.slice(-4)}</span>
                          <span>CLABE: ****{account.clabe.slice(-4)}</span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-1">
                      {!account.is_primary && (
                        <button
                          onClick={() => handleSetPrimary(account.id)}
                          title="Establecer como principal"
                          className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                          </svg>
                        </button>
                      )}
                      <button
                        onClick={() => openEditForm(account)}
                        title="Editar"
                        className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                      <button
                        onClick={() => setDeleteConfirmId(account.id)}
                        title="Eliminar"
                        className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </Modal>

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={deleteConfirmId !== null}
        onClose={() => setDeleteConfirmId(null)}
        onConfirm={() => deleteConfirmId && handleDelete(deleteConfirmId)}
        title="Eliminar cuenta bancaria"
        message="¿Estás seguro de que deseas eliminar esta cuenta bancaria? Esta acción no se puede deshacer."
        confirmText="Eliminar"
        cancelText="Cancelar"
        variant="danger"
        loading={deleting}
      />
    </>
  );
}
