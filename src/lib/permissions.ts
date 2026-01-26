// Utilidades para control de acceso basado en roles (RBAC)

export type UserRole = 'admin' | 'user' | 'client' | 'supervisor';

// Definición de permisos por rol
export const PERMISSIONS = {
  // Órdenes de compra
  orders: {
    view: ['admin', 'user', 'supervisor'],
    create: ['admin', 'user', 'supervisor'],
    edit: ['admin', 'user', 'supervisor'],
    delete: ['admin'],
    approve: ['admin'],
    reject: ['admin'],
  },
  // Dashboard
  dashboard: {
    access: ['admin', 'user', 'supervisor'],
  },
  // Reportes
  reports: {
    view: ['admin', 'supervisor', 'client'],
    create: ['admin', 'supervisor'],
    edit: ['admin', 'supervisor'],
    delete: ['admin'],
  },
  // Proyectos
  projects: {
    view: ['admin', 'supervisor', 'client'],
    create: ['admin', 'supervisor'],
    update: ['admin', 'supervisor'],
    delete: ['admin'],
  },
  // Chatbot
  chatbot: {
    access: ['admin'],
    configure: ['admin'],
  },
  // Usuarios
  users: {
    view: ['admin'],
    create: ['admin'],
    edit: ['admin'],
    delete: ['admin'],
  },
} as const;

/**
 * Verifica si un rol tiene un permiso específico
 */
export function hasPermission(
  userRole: UserRole | string | undefined,
  resource: keyof typeof PERMISSIONS,
  action: string
): boolean {
  if (!userRole) return false;
  
  const permissions = PERMISSIONS[resource];
  if (!permissions) return false;
  
  const allowedRoles = permissions[action as keyof typeof permissions] as readonly string[];
  if (!allowedRoles) return false;
  
  return allowedRoles.includes(userRole as string);
}

/**
 * Verifica si un usuario es admin
 */
export function isAdmin(userRole: UserRole | string | undefined): boolean {
  return userRole === 'admin';
}

/**
 * Verifica si un usuario puede realizar múltiples acciones
 */
export function hasAnyPermission(
  userRole: UserRole | string | undefined,
  checks: Array<{ resource: keyof typeof PERMISSIONS; action: string }>
): boolean {
  return checks.some(({ resource, action }) => 
    hasPermission(userRole, resource, action)
  );
}

/**
 * Verifica si un usuario puede realizar todas las acciones
 */
export function hasAllPermissions(
  userRole: UserRole | string | undefined,
  checks: Array<{ resource: keyof typeof PERMISSIONS; action: string }>
): boolean {
  return checks.every(({ resource, action }) => 
    hasPermission(userRole, resource, action)
  );
}

/**
 * Obtiene todos los permisos de un rol
 */
export function getRolePermissions(userRole: UserRole | string): string[] {
  const permissions: string[] = [];
  
  Object.entries(PERMISSIONS).forEach(([resource, actions]) => {
    Object.entries(actions).forEach(([action, roles]) => {
      if (roles.includes(userRole as UserRole)) {
        permissions.push(`${resource}.${action}`);
      }
    });
  });
  
  return permissions;
}

// Mensajes de error personalizados
export const PERMISSION_ERRORS = {
  unauthorized: 'No tienes autorización para realizar esta acción',
  notAuthenticated: 'Debes iniciar sesión para continuar',
  insufficientPermissions: 'No tienes los permisos necesarios',
  adminOnly: 'Esta acción solo está disponible para administradores',
} as const;
