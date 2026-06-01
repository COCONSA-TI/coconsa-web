import { useEffect, useState } from 'react';

type PendingBalanceUser = {
  user_id: string;
  full_name: string;
  department_name: string | null;
  list_count: number;
  last_updated_at: string | null;
  totals: Array<{ currency: string; amount: number }>;
};

type PendingBalancesDashboardProps = {
  userId?: string;
  isOwnBalance?: boolean;
};

function formatCurrency(amount: number, currency: string) {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: currency === 'USD' ? 'USD' : 'MXN',
  }).format(amount);
}

function formatDate(dateString: string | null) {
  if (!dateString) return 'N/A';
  return new Date(dateString).toLocaleDateString('es-MX', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export default function PendingBalancesDashboard({ userId, isOwnBalance = false }: PendingBalancesDashboardProps) {
  const [users, setUsers] = useState<PendingBalanceUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchBalances = async () => {
    try {
      setLoading(true);
      setError(null);
      let url = '/api/v1/needs-lists/pending-balances/users';
      if (userId) {
        url += `?userId=${encodeURIComponent(userId)}`;
      }
      const response = await fetch(url);
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Error al cargar saldos');
      }

      setUsers(data.users || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBalances();
  }, [userId]);

  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow p-6">
        <div className="h-5 w-48 bg-gray-200 rounded animate-pulse mb-4"></div>
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-10 bg-gray-100 rounded animate-pulse"></div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
        <p className="text-red-800 font-medium">{error}</p>
        <button
          onClick={fetchBalances}
          className="mt-3 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm"
        >
          Reintentar
        </button>
      </div>
    );
  }

  if (users.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow p-12 text-center">
        <div className="w-16 h-16 mx-auto bg-gray-100 rounded-full flex items-center justify-center mb-4">
          <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </div>
        <p className="text-gray-900 font-medium text-lg mb-1">Sin saldos pendientes</p>
        <p className="text-gray-500 text-sm">No hay usuarios con saldo pendiente por comprobar.</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow p-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">
            {isOwnBalance ? 'Mi saldo pendiente' : 'Saldos pendientes por usuario'}
          </h2>
          <p className="text-sm text-gray-500">
            {isOwnBalance ? 'Listas comprobadas con saldo pendiente por comprobar.' : 'Listas comprobadas con saldo pendiente.'}
          </p>
        </div>
        <button
          onClick={fetchBalances}
          className="inline-flex items-center justify-center gap-2 bg-gray-100 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v6h6M20 20v-6h-6M20 4l-3.5 3.5M4 20l3.5-3.5" />
          </svg>
          Actualizar
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wide text-gray-500 border-b border-gray-200">
              {!isOwnBalance && <th className="py-2 pr-4 font-semibold">Usuario</th>}
              {!isOwnBalance && <th className="py-2 pr-4 font-semibold">Departamento</th>}
              <th className="py-2 pr-4 font-semibold">Saldo pendiente</th>
              <th className="py-2 pr-4 font-semibold">Listas</th>
              <th className="py-2 font-semibold">Última actualización</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {users.map((user) => (
              <tr key={user.user_id} className="text-gray-700">
                {!isOwnBalance && <td className="py-3 pr-4 font-medium text-gray-900">{user.full_name}</td>}
                {!isOwnBalance && <td className="py-3 pr-4">{user.department_name || 'Sin departamento'}</td>}
                <td className="py-3 pr-4 space-y-1">
                  {user.totals.map((total) => (
                    <div
                      key={total.currency}
                      className={total.amount >= 0 ? 'text-amber-600 font-semibold' : 'text-red-600 font-semibold'}
                    >
                      {formatCurrency(total.amount, total.currency)}
                    </div>
                  ))}
                </td>
                <td className="py-3 pr-4">{user.list_count}</td>
                <td className="py-3">{formatDate(user.last_updated_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
