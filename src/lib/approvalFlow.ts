import { createBrowserClient } from '@supabase/ssr';

export const APPROVAL_FLOW = [
  { code: 'gerencia_construccion', name: 'Gerencia de Construcción', order: 1 },
  { code: 'gerencia_maquinaria', name: 'Gerencia de Maquinaria', order: 1 },
  { code: 'gerencia_rh', name: 'Gerencia de Recursos Humanos', order: 1 },
  { code: 'gerencia_seguridad', name: 'Gerencia de Seguridad', order: 1 },
  { code: 'gerencia_administracion', name: 'Gerencia de Administración', order: 1 },
  { code: 'gerencia_contabilidad', name: 'Gerencia de Contabilidad', order: 1 },
  { code: 'contraloria', name: 'Contraloría', order: 2 },
  { code: 'direccion', name: 'Dirección', order: 3 },
  { code: 'contabilidad', name: 'Contabilidad', order: 4 },
  { code: 'pagos', name: 'Pagos', order: 5 },
];

export interface Department {
  id: string;
  name: string;
  code: string;
  approval_order: number;
  requires_approval: boolean;
}

export interface OrderApproval {
  id: string;
  order_id: string;
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

export async function canUserApprove(
  userId: string,
  orderId: string
): Promise<{ canApprove: boolean; reason?: string; approval?: OrderApproval }> {
  try {
    const response = await fetch(`/api/v1/orders/${orderId}/can-approve`);
    const data = await response.json();

    if (!data.success) {
      return { canApprove: false, reason: data.error || 'Error al verificar permisos' };
    }

    return {
      canApprove: data.canApprove,
      reason: data.reason,
      approval: data.approval
    };
  } catch (error) {
    console.error('Error checking approval permissions:', error);
    return { canApprove: false, reason: 'Error al verificar permisos' };
  }
}

export async function getOrderApprovals(orderId: string): Promise<OrderApproval[]> {
  try {
    const response = await fetch(`/api/v1/orders/${orderId}/approvals`);
    const data = await response.json();

    if (!data.success) {
      console.error('Error fetching approvals:', data.error);
      return [];
    }

    return data.approvals || [];
  } catch (error) {
    console.error('Error fetching approvals:', error);
    return [];
  }
}

export async function createOrderApprovals(orderId: string, applicantDepartmentId: string) {
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

  // Crear aprobaciones para cada departamento en el flujo
  // La primera aprobación es para el departamento del solicitante
  const approvalsToCreate = [];

  // 1. Aprobación del departamento del solicitante (gerencia)
  const applicantDept = departments.find((d) => d.id === applicantDepartmentId);
  if (applicantDept) {
    approvalsToCreate.push({
      order_id: orderId,
      department_id: applicantDept.id,
      status: 'pending',
      approval_order: applicantDept.approval_order,
    });
  }

  // 2. Aprobaciones para el resto del flujo (contraloría, dirección, contabilidad, pagos)
  const subsequentDepartments = departments.filter(
    (d) => d.approval_order > 1
  );

  for (const dept of subsequentDepartments) {
    approvalsToCreate.push({
      order_id: orderId,
      department_id: dept.id,
      status: 'pending',
      approval_order: dept.approval_order,
    });
  }

  const { error: insertError } = await supabase
    .from('order_approvals')
    .insert(approvalsToCreate);

  if (insertError) {
    throw new Error('Error al crear aprobaciones: ' + insertError.message);
  }

  return true;
}

export type ApprovalIconType = 'approved' | 'rejected' | 'active' | 'pending';

export function getApprovalIconType(status: 'pending' | 'approved' | 'rejected', isActive: boolean): ApprovalIconType {
  if (status === 'approved') return 'approved';
  if (status === 'rejected') return 'rejected';
  if (isActive) return 'active';
  return 'pending';
}
