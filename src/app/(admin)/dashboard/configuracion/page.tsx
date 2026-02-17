'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import Link from 'next/link';

interface UserProfile {
  id: string;
  email: string;
  full_name: string | null;
  created_at: string;
  updated_at: string | null;
  is_department_head: boolean;
  role: { id: number; name: string } | null;
  role_name: string;
  department: { id: string; name: string } | null;
}

function getRoleDisplayName(roleName: string): string {
  const roleNames: Record<string, string> = {
    admin: 'Administrador',
    user: 'Usuario',
    supervisor: 'Supervisor',
    client: 'Cliente',
  };
  return roleNames[roleName] || roleName;
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('es-MX', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function ConfiguracionPage() {
  const { isAdmin, loading: authLoading } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [changingPassword, setChangingPassword] = useState(false);
  
  // Estados de formulario
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  // Estados de feedback
  const [passwordMessage, setPasswordMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (!authLoading) {
      fetchProfile();
    }
  }, [authLoading]);

  const fetchProfile = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/v1/profile');
      const data = await response.json();
      
      if (data.success) {
        setProfile(data.user);
      }
    } catch (error) {
      console.error('Error fetching profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordMessage(null);

    if (newPassword !== confirmPassword) {
      setPasswordMessage({ type: 'error', text: 'Las contraseñas no coinciden' });
      return;
    }

    if (newPassword.length < 6) {
      setPasswordMessage({ type: 'error', text: 'La nueva contraseña debe tener al menos 6 caracteres' });
      return;
    }

    setChangingPassword(true);

    try {
      const response = await fetch('/api/v1/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          current_password: currentPassword,
          new_password: newPassword,
          confirm_password: confirmPassword,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setPasswordMessage({ type: 'success', text: 'Contraseña actualizada exitosamente' });
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
        setShowPasswordForm(false);
      } else {
        setPasswordMessage({ type: 'error', text: data.error || 'Error al cambiar contraseña' });
      }
    } catch {
      setPasswordMessage({ type: 'error', text: 'Error de conexión' });
    } finally {
      setChangingPassword(false);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Cargando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-red-600 to-red-700 rounded-xl shadow-lg p-6 text-white">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Configuracion</h1>
            <p className="text-red-100 text-sm mt-1">
              Informacion de tu cuenta y seguridad
            </p>
          </div>
          
          {isAdmin && (
            <Link
              href="/dashboard/configuracion/usuarios"
              className="inline-flex items-center justify-center gap-2 bg-white text-red-600 px-5 py-2.5 rounded-lg font-medium hover:bg-red-50 transition-colors shadow-sm"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
              <span>Gestionar Usuarios</span>
            </Link>
          )}
        </div>
      </div>

      {/* Información de la Cuenta (Solo lectura) */}
      <div className="bg-white rounded-xl shadow p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
          Informacion de la Cuenta
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Nombre */}
          <div>
            <label className="block text-sm font-medium text-gray-500 mb-1">
              Nombre Completo
            </label>
            <div className="px-4 py-2.5 bg-gray-100 border border-gray-200 rounded-lg text-gray-700">
              {profile?.full_name || 'Sin nombre asignado'}
            </div>
          </div>

          {/* Email (solo lectura) */}
          <div>
            <label className="block text-sm font-medium text-gray-500 mb-1">
              Correo Electronico
            </label>
            <div className="px-4 py-2.5 bg-gray-100 border border-gray-200 rounded-lg text-gray-700">
              {profile?.email || ''}
            </div>
          </div>

          {/* Rol (solo lectura) */}
          <div>
            <label className="block text-sm font-medium text-gray-500 mb-1">
              Rol
            </label>
            <div className="px-4 py-2.5 bg-gray-100 border border-gray-200 rounded-lg">
              <span className="inline-flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${
                  profile?.role_name === 'admin' ? 'bg-purple-500' :
                  profile?.role_name === 'supervisor' ? 'bg-blue-500' :
                  'bg-green-500'
                }`}></span>
                <span className="text-gray-700">{getRoleDisplayName(profile?.role_name || 'user')}</span>
              </span>
            </div>
          </div>

          {/* Departamento (solo lectura) */}
          <div>
            <label className="block text-sm font-medium text-gray-500 mb-1">
              Departamento
            </label>
            <div className="px-4 py-2.5 bg-gray-100 border border-gray-200 rounded-lg text-gray-700">
              {profile?.department ? (
                <>
                  {profile.department.name}
                  {profile.is_department_head && (
                    <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800">
                      Jefe de Departamento
                    </span>
                  )}
                </>
              ) : (
                'Sin departamento asignado'
              )}
            </div>
          </div>

          {/* Fecha de Registro */}
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-500 mb-1">
              Miembro desde
            </label>
            <div className="px-4 py-2.5 bg-gray-100 border border-gray-200 rounded-lg text-gray-700">
              {profile?.created_at ? formatDate(profile.created_at) : '-'}
            </div>
          </div>
        </div>

        <p className="mt-4 text-sm text-gray-500 flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Para modificar tu informacion personal, contacta al administrador del sistema.
        </p>
      </div>

      {/* Cambiar Contraseña */}
      <div className="bg-white rounded-xl shadow p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
            </svg>
            Seguridad
          </h2>
          {!showPasswordForm && (
            <button
              onClick={() => setShowPasswordForm(true)}
              className="text-sm text-red-600 hover:text-red-700 font-medium"
            >
              Cambiar Contraseña
            </button>
          )}
        </div>

        {showPasswordForm ? (
          <form onSubmit={handleChangePassword} className="space-y-4">
            <div>
              <label htmlFor="currentPassword" className="block text-sm font-medium text-gray-700 mb-1">
                Contraseña Actual
              </label>
              <input
                id="currentPassword"
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-gray-900 focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all"
                placeholder="********"
                required
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="newPassword" className="block text-sm font-medium text-gray-700 mb-1">
                  Nueva Contraseña
                </label>
                <input
                  id="newPassword"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-gray-900 focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all"
                  placeholder="Minimo 6 caracteres"
                  required
                  minLength={6}
                />
              </div>

              <div>
                <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-1">
                  Confirmar Contraseña
                </label>
                <input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-gray-900 focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all"
                  placeholder="Repite la nueva contraseña"
                  required
                />
              </div>
            </div>

            {passwordMessage && (
              <div className={`p-3 rounded-lg text-sm ${
                passwordMessage.type === 'success' 
                  ? 'bg-green-50 text-green-700 border border-green-200' 
                  : 'bg-red-50 text-red-700 border border-red-200'
              }`}>
                {passwordMessage.text}
              </div>
            )}

            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  setShowPasswordForm(false);
                  setCurrentPassword('');
                  setNewPassword('');
                  setConfirmPassword('');
                  setPasswordMessage(null);
                }}
                className="px-4 py-2 text-gray-700 hover:text-gray-900 font-medium transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={changingPassword}
                className="px-5 py-2.5 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                {changingPassword ? 'Actualizando...' : 'Actualizar Contraseña'}
              </button>
            </div>
          </form>
        ) : (
          <p className="text-sm text-gray-500">
            Te recomendamos cambiar tu contraseña periodicamente para mantener tu cuenta segura.
          </p>
        )}
      </div>
    </div>
  );
}
