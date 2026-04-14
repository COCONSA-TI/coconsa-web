import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { hasPermission, PERMISSION_ERRORS, PERMISSIONS } from '@/lib/permissions';
import { supabaseAdmin } from '@/lib/supabase/server';

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
 * Middleware para verificar que el usuario sea jefe de departamento
 */
export async function requireDepartmentHead() {
  const { error, session } = await requireAuth();

  if (error) {
    return { error, session: null };
  }

  const { data: userData, error: userError } = await supabaseAdmin
    .from('users')
    .select('is_department_head')
    .eq('id', session!.userId)
    .single();

  if (userError || !userData?.is_department_head) {
    return {
      error: NextResponse.json(
        { error: 'Esta acción solo está disponible para jefes de departamento' },
        { status: 403 }
      ),
      session: null,
    };
  }

  return { error: null, session };
}

/**
 * Permite ver el catálogo de proveedores a cualquier usuario con acceso al dashboard.
 */
export async function requireSupplierCatalogAccess() {
  return requirePermission('dashboard', 'access');
}

/**
 * Permite gestionar proveedores solo a:
 * - Administradores del sistema
 * - Jefes de departamento de Dirección
 */
export async function requireSupplierManagement() {
  const { error, session } = await requireAuth();

  if (error) {
    return { error, session: null };
  }

  if (session!.role === 'admin') {
    return { error: null, session };
  }

  const { data: userData, error: userError } = await supabaseAdmin
    .from('users')
    .select(`
      is_department_head,
      department:departments(code, name)
    `)
    .eq('id', session!.userId)
    .single();

  const department = Array.isArray(userData?.department) ? userData?.department[0] : userData?.department;
  const departmentCode = (department?.code || '').toLowerCase();
  const departmentName = (department?.name || '').toLowerCase();
  const isDirectionDepartment = departmentCode === 'direccion' || departmentName.includes('direccion');
  const isDirectionManagement = Boolean(userData?.is_department_head) && isDirectionDepartment;

  if (userError || !isDirectionManagement) {
    return {
      error: NextResponse.json(
        { error: 'Esta acción solo está disponible para administradores y gerencias de Dirección' },
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
