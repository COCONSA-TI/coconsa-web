'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';

interface User {
  id: string;
  email: string;
  role?: string;
}

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchUser();
  }, []);

  const fetchUser = async () => {
    try {
      const response = await fetch('/api/v1/me');
      const data = await response.json();
      
      if (!response.ok) {
        router.push('/login');
        return;
      }
      
      setUser(data.user);
    } catch (error) {
      console.error('Error al cargar usuario:', error);
      router.push('/login');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/v1/logout', { method: 'POST' });
      router.push('/login');
      router.refresh();
    } catch (error) {
      console.error('Error al cerrar sesión:', error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Cargando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <Image
              src="/logo-coconsa.png"
              alt="COCONSA Logo"
              width={50}
              height={50}
              priority
            />
            <h1 className="text-2xl font-bold text-gray-900">Dashboard COCONSA</h1>
          </div>
          <button
            onClick={handleLogout}
            className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors"
          >
            Cerrar Sesión
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Welcome Card */}
        <div className="bg-white rounded-lg shadow-lg p-8 mb-8">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-20 h-20 bg-red-600 rounded-full flex items-center justify-center text-white text-3xl font-bold">
              {user?.email?.charAt(0).toUpperCase()}
            </div>
            <div>
              <h2 className="text-3xl font-bold text-gray-900">
                ¡Bienvenido de vuelta!
              </h2>
              <p className="text-gray-600 text-lg">{user?.email}</p>
              {user?.role && (
                <span className="inline-block mt-2 px-3 py-1 bg-red-100 text-red-800 rounded-full text-sm font-medium">
                  {user.role === 'admin' ? 'Administrador' : 'Usuario'}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm font-medium">Cotizaciones</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">24</p>
              </div>
              <div className="bg-blue-100 rounded-full p-3">
                <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm font-medium">Proyectos</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">12</p>
              </div>
              <div className="bg-green-100 rounded-full p-3">
                <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm font-medium">Mensajes</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">8</p>
              </div>
              <div className="bg-purple-100 rounded-full p-3">
                <svg className="w-8 h-8 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
            </div>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="bg-white rounded-lg shadow">
          <div className="p-6 border-b border-gray-200">
            <h3 className="text-xl font-bold text-gray-900">Actividad Reciente</h3>
          </div>
          <div className="p-6">
            <div className="space-y-4">
              {[
                { icon: '📝', title: 'Nueva cotización recibida', time: 'Hace 2 horas', color: 'blue' },
                { icon: '🏗️', title: 'Proyecto actualizado', time: 'Hace 4 horas', color: 'green' },
                { icon: '📧', title: 'Nuevo mensaje de cliente', time: 'Hace 6 horas', color: 'purple' },
                { icon: '✅', title: 'Cotización aprobada', time: 'Hace 1 día', color: 'green' },
                { icon: '📊', title: 'Reporte generado', time: 'Hace 2 días', color: 'blue' },
              ].map((activity, index) => (
                <div key={index} className="flex items-center gap-4 p-4 hover:bg-gray-50 rounded-lg transition-colors">
                  <div className="text-3xl">{activity.icon}</div>
                  <div className="flex-1">
                    <p className="font-medium text-gray-900">{activity.title}</p>
                    <p className="text-sm text-gray-600">{activity.time}</p>
                  </div>
                  <button className="text-red-600 hover:text-red-700 font-medium">
                    Ver detalles →
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="mt-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <button className="bg-white p-6 rounded-lg shadow hover:shadow-lg transition-shadow text-left">
            <div className="text-3xl mb-3">📋</div>
            <h4 className="font-bold text-gray-900 mb-1">Nueva Cotización</h4>
            <p className="text-sm text-gray-600">Crear nueva cotización</p>
          </button>

          <button className="bg-white p-6 rounded-lg shadow hover:shadow-lg transition-shadow text-left">
            <div className="text-3xl mb-3">🏗️</div>
            <h4 className="font-bold text-gray-900 mb-1">Proyectos</h4>
            <p className="text-sm text-gray-600">Ver todos los proyectos</p>
          </button>

          <button className="bg-white p-6 rounded-lg shadow hover:shadow-lg transition-shadow text-left">
            <div className="text-3xl mb-3">👥</div>
            <h4 className="font-bold text-gray-900 mb-1">Clientes</h4>
            <p className="text-sm text-gray-600">Gestionar clientes</p>
          </button>

          <button className="bg-white p-6 rounded-lg shadow hover:shadow-lg transition-shadow text-left">
            <div className="text-3xl mb-3">📊</div>
            <h4 className="font-bold text-gray-900 mb-1">Reportes</h4>
            <p className="text-sm text-gray-600">Ver estadísticas</p>
          </button>
        </div>
      </main>
    </div>
  );
}
