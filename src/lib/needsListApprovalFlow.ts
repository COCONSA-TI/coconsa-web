import { createBrowserClient } from '@supabase/ssr';

/**
 * Flujo de aprobaciones para Listas de Necesidades
 * 
 * Flujo normal: Gerencia → Contabilidad → Contraloría
 * Flujo urgente: Contabilidad → Contraloría (salta Gerencia)
 */

export const NEEDS_LIST_APPROVAL_FLOW = [
  // Nivel 1: Gerencias (depende del departamento del solicitante)
  { code: 'gerencia_construccion', name: 'Gerencia de Construcción', order: 1 },
  { code: 'gerencia_maquinaria', name: 'Gerencia de Maquinaria', order: 1 },
  { code: 'gerencia_rh', name: 'Gerencia de Recursos Humanos', order: 1 },
  { code: 'gerencia_seguridad', name: 'Gerencia de Seguridad', order: 1 },
  { code: 'gerencia_administracion', name: 'Gerencia de Administración', order: 1 },
  { code: 'gerencia_contabilidad', name: 'Gerencia de Contabilidad', order: 1 },
  
  // Nivel 2: Contabilidad
  { code: 'contabilidad', name: 'Contabilidad', order: 2 },
  
  // Nivel 3: Contraloría
  { code: 'contraloria', name: 'Contraloría', order: 3 },
];

// Flujo reducido para listas urgentes (salta Gerencia)
export const URGENT_NEEDS_LIST_APPROVAL_FLOW = [
  { code: 'contabilidad', name: 'Contabilidad', order: 2 },
  { code: 'contraloria', name: 'Contraloría', order: 3 },
];

export interface Department {
  id: string;
  name: string;
  code: string;
  approval_order: number;
  requires_approval: boolean;
}

export interface NeedsListApproval {
  id: string;
  needs_list_id: number;
  department_id: string;
  approver_id: string | null;
  status: 'pending' | 'approved' | 'rejected';
  comments: string | null;
  approved_at: string | null;
  approval_order: number;
  created_at: string;
  department?: Department;
  approver?: {
    id: string;
    full_name: string;
    email: string;
  };
}

export interface User {
  id: string;
  name: string;
  email: string;
  department_id: string | null;
  is_department_head: boolean;
  department?: Department;
}

/**
 * Verifica si un usuario puede aprobar una lista de necesidades específica
 */
export async function canUserApproveNeedsList(
  userId: string,
  needsListId: number
): Promise<{ canApprove: boolean; reason?: string; approval?: NeedsListApproval }> {
  try {
    const response = await fetch(`/api/v1/needs-lists/${needsListId}/can-approve`);
    const data = await response.json();

    if (!data.success) {
      return { canApprove: false, reason: data.error || 'Error al verificar permisos' };
    }

    return {
      canApprove: data.canApprove,
      reason: data.reason,
      approval: data.approval
    };
  } catch {
    return { canApprove: false, reason: 'Error al verificar permisos' };
  }
}

/**
 * Obtiene todas las aprobaciones de una lista de necesidades
 */
export async function getNeedsListApprovals(needsListId: number): Promise<NeedsListApproval[]> {
  try {
    const response = await fetch(`/api/v1/needs-lists/${needsListId}/approvals`);
    const data = await response.json();

    if (!data.success) {
      return [];
    }

    return data.approvals || [];
  } catch {
    return [];
  }
}

/**
 * Crea el flujo de aprobaciones para una lista de necesidades
 * 
 * @param needsListId - ID de la lista de necesidades
 * @param applicantDepartmentId - ID del departamento del solicitante
 * @param isUrgent - Si la lista es urgente (salta gerencia)
 */
export async function createNeedsListApprovals(
  needsListId: number,
  applicantDepartmentId: string,
  isUrgent: boolean = false
) {
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  // Obtener todos los departamentos que requieren aprobación
  const { data: departments, error: deptError } = await supabase
    .from('departments')
    .select('*')
    .eq('requires_approval', true)
    .order('approval_order');

  if (deptError || !departments) {
    throw new Error('Error al obtener departamentos');
  }

  const approvalsToCreate = [];

  if (isUrgent) {
    // Flujo urgente: solo Contabilidad (order=2) y Contraloría (order=3)
    const contabilidad = departments.find((d) => d.code === 'contabilidad' && d.approval_order === 2);
    const contraloria = departments.find((d) => d.code === 'contraloria' && d.approval_order === 3);

    if (contabilidad) {
      approvalsToCreate.push({
        needs_list_id: needsListId,
        department_id: contabilidad.id,
        status: 'pending',
        approval_order: 2,
      });
    }

    if (contraloria) {
      approvalsToCreate.push({
        needs_list_id: needsListId,
        department_id: contraloria.id,
        status: 'pending',
        approval_order: 3,
      });
    }
  } else {
    // Flujo normal: Gerencia → Contabilidad → Contraloría
    
    // 1. Aprobación del departamento del solicitante (gerencia, order=1)
    const applicantDept = departments.find(
      (d) => d.id === applicantDepartmentId && d.approval_order === 1
    );
    
    if (applicantDept) {
      approvalsToCreate.push({
        needs_list_id: needsListId,
        department_id: applicantDept.id,
        status: 'pending',
        approval_order: 1,
      });
    }

    // 2. Contabilidad (order=2)
    const contabilidad = departments.find((d) => d.code === 'contabilidad' && d.approval_order === 2);
    if (contabilidad) {
      approvalsToCreate.push({
        needs_list_id: needsListId,
        department_id: contabilidad.id,
        status: 'pending',
        approval_order: 2,
      });
    }

    // 3. Contraloría (order=3)
    const contraloria = departments.find((d) => d.code === 'contraloria' && d.approval_order === 3);
    if (contraloria) {
      approvalsToCreate.push({
        needs_list_id: needsListId,
        department_id: contraloria.id,
        status: 'pending',
        approval_order: 3,
      });
    }
  }

  if (approvalsToCreate.length === 0) {
    throw new Error('No se pudo crear el flujo de aprobaciones');
  }

  const { error: insertError } = await supabase
    .from('needs_list_approvals')
    .insert(approvalsToCreate);

  if (insertError) {
    throw new Error('Error al crear aprobaciones: ' + insertError.message);
  }

  return true;
}

export type ApprovalIconType = 'approved' | 'rejected' | 'active' | 'pending';

/**
 * Determina el tipo de ícono a mostrar para una aprobación
 */
export function getApprovalIconType(
  status: 'pending' | 'approved' | 'rejected',
  isActive: boolean
): ApprovalIconType {
  if (status === 'approved') return 'approved';
  if (status === 'rejected') return 'rejected';
  if (isActive) return 'active';
  return 'pending';
}

/**
 * Obtiene el nombre del departamento según su orden en el flujo
 */
export function getDepartmentNameByOrder(order: number): string {
  switch (order) {
    case 1:
      return 'Gerencia';
    case 2:
      return 'Contabilidad';
    case 3:
      return 'Contraloría';
    default:
      return 'Desconocido';
  }
}
