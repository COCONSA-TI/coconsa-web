'use client';

import { ReactNode } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { PERMISSIONS } from '@/lib/permissions';

interface ProtectedProps {
  children: ReactNode;
  resource: keyof typeof PERMISSIONS;
  action: string;
  fallback?: ReactNode;
  requireAdmin?: boolean;
}

/**
 * Componente para proteger elementos de la UI basado en permisos
 * 
 * @example
 * <Protected resource="orders" action="approve">
 *   <button>Aprobar Orden</button>
 * </Protected>
 */
export function Protected({ 
  children, 
  resource, 
  action, 
  fallback = null,
  requireAdmin = false 
}: ProtectedProps) {
  const { hasPermission, isAdmin } = useAuth();

  if (requireAdmin && !isAdmin) {
    return <>{fallback}</>;
  }

  if (!hasPermission(resource, action)) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}

interface AdminOnlyProps {
  children: ReactNode;
  fallback?: ReactNode;
}

/**
 * Componente para mostrar contenido solo a administradores
 * 
 * @example
 * <AdminOnly>
 *   <button>Eliminar Usuario</button>
 * </AdminOnly>
 */
export function AdminOnly({ children, fallback = null }: AdminOnlyProps) {
  const { isAdmin } = useAuth();

  if (!isAdmin) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}

interface RoleGateProps {
  children: ReactNode;
  allowedRoles: string[];
  fallback?: ReactNode;
}

/**
 * Componente para mostrar contenido basado en roles específicos
 * 
 * @example
 * <RoleGate allowedRoles={['admin', 'supervisor']}>
 *   <ReportsDashboard />
 * </RoleGate>
 */
export function RoleGate({ children, allowedRoles, fallback = null }: RoleGateProps) {
  const { user } = useAuth();

  if (!user?.role || !allowedRoles.includes(user.role)) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}
