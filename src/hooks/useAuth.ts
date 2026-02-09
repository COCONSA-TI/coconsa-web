'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { hasPermission, isAdmin, PERMISSIONS } from '@/lib/permissions';

interface User {
  id: string;
  email: string;
  full_name?: string;
  role?: string;
}

interface UseAuthReturn {
  user: User | null;
  loading: boolean;
  isAuthenticated: boolean;
  isAdmin: boolean;
  hasPermission: (resource: keyof typeof PERMISSIONS, action: string) => boolean;
  logout: () => Promise<void>;
  refetch: () => Promise<void>;
}

/**
 * Hook personalizado para gestionar autenticación y permisos
 * 
 * @example
 * const { user, isAdmin, hasPermission } = useAuth();
 * 
 * if (hasPermission('orders', 'approve')) {
 *   // Mostrar botón de aprobar
 * }
 */
export function useAuth(options?: { redirectTo?: string; requireAuth?: boolean }): UseAuthReturn {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchUser = useCallback(async () => {
    try {
      const response = await fetch('/api/v1/me', {
        credentials: 'include',
      });
      
      if (!response.ok) {
        setUser(null);
        if (options?.requireAuth !== false && options?.redirectTo) {
          router.push(options.redirectTo);
        }
        return;
      }
      
      const data = await response.json();
      setUser(data.user);
    } catch (error) {
      setUser(null);
      if (options?.requireAuth !== false && options?.redirectTo) {
        router.push(options.redirectTo);
      }
    } finally {
      setLoading(false);
    }
  }, [router, options?.redirectTo, options?.requireAuth]);

  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  const logout = async () => {
    try {
      await fetch('/api/v1/logout', {
        method: 'POST',
        credentials: 'include',
      });
      setUser(null);
      router.push('/login');
    } catch (error) {
      // Error silencioso - el usuario será redirigido al login
    }
  };

  const checkPermission = useCallback((resource: keyof typeof PERMISSIONS, action: string): boolean => {
    return hasPermission(user?.role, resource, action);
  }, [user?.role]);

  return {
    user,
    loading,
    isAuthenticated: !!user,
    isAdmin: isAdmin(user?.role),
    hasPermission: checkPermission,
    logout,
    refetch: fetchUser,
  };
}

/**
 * Hook para proteger páginas que requieren autenticación
 * Redirige automáticamente a login si no está autenticado
 * 
 * @example
 * const { user, loading } = useRequireAuth();
 * if (loading) return <Loading />;
 */
export function useRequireAuth() {
  return useAuth({ redirectTo: '/login', requireAuth: true });
}

/**
 * Hook para proteger páginas que requieren rol de admin
 * Redirige a dashboard si no es admin
 * 
 * @example
 * const { user, loading } = useRequireAdmin();
 * if (loading) return <Loading />;
 */
export function useRequireAdmin() {
  const auth = useAuth({ redirectTo: '/dashboard?error=unauthorized', requireAuth: true });
  const router = useRouter();

  useEffect(() => {
    if (!auth.loading && auth.user && !auth.isAdmin) {
      router.push('/dashboard?error=unauthorized');
    }
  }, [auth.loading, auth.user, auth.isAdmin, router]);

  return auth;
}
