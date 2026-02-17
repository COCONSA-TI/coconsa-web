import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { hasPermission, PERMISSION_ERRORS, PERMISSIONS } from '@/lib/permissions';

/**
 * Middleware para verificar autenticación en endpoints de API
 */
export async function requireAuth() {
  const session = await getSession();
  
  if (!session) {
    return {
      error: NextResponse.json(
        { error: PERMISSION_ERRORS.notAuthenticated },
        { status: 401 }
      ),
      session: null,
    };
  }
  
  return { error: null, session };
}

/**
 * Middleware para verificar permisos específicos
 */
export async function requirePermission(
  resource: keyof typeof PERMISSIONS,
  action: string
) {
  const { error, session } = await requireAuth();
  
  if (error) {
    return { error, session: null };
  }
  
  const userRole = session!.role;
  
  if (!hasPermission(userRole, resource, action)) {
    return {
      error: NextResponse.json(
        { 
          error: PERMISSION_ERRORS.insufficientPermissions,
          required: `${resource}.${action}`,
          userRole 
        },
        { status: 403 }
      ),
      session: null,
    };
  }
  
  return { error: null, session };
}

/**
 * Middleware para verificar que el usuario sea admin
 */
export async function requireAdmin() {
  const { error, session } = await requireAuth();
  
  if (error) {
    return { error, session: null };
  }
  
  if (session!.role !== 'admin') {
    return {
      error: NextResponse.json(
        { error: PERMISSION_ERRORS.adminOnly },
        { status: 403 }
      ),
      session: null,
    };
  }
  
  return { error: null, session };
}

/**
 * Helper para obtener usuario con verificación de autenticación
 */
export async function getAuthenticatedUser() {
  const { error, session } = await requireAuth();
  
  if (error || !session) {
    return null;
  }
  
  return {
    userId: session.userId,
    email: session.email,
    role: session.role,
  };
}
