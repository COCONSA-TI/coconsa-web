import type { Department } from "@/types/database";

// Regla única para armar el flujo de aprobaciones de una orden de compra.
// La usan la creación de órdenes y el reenvío de órdenes rechazadas.

export interface OrderApprovalRoutingInput {
  orderId: string;
  applicantId: string;
  applicantDepartmentId: string | null;
  isApplicantDeptHead: boolean;
  isUrgent: boolean;
  requiresExtraBudgetApproval: boolean;
  storeName?: string;
  storeTypeCode?: string | null;
}

export interface OrderApprovalRow {
  order_id: string;
  department_id: string;
  status: 'pending' | 'approved';
  approval_order: number;
  approver_id?: string | null;
  approved_at?: string | null;
  comments?: string | null;
}

export interface OrderApprovalPlan {
  approvals: OrderApprovalRow[];
  // true cuando el primer paso pendiente ya no es una Gerencia (urgente, Gerencia autoaprobada o sin Gerencia)
  startsInProgress: boolean;
}

/**
 * Gerencia que revisa la orden cuando el solicitante no pertenece a una Gerencia:
 * se decide por el tipo de centro de costos (maquinaria → Maquinaria; obra u otro → Construcción).
 * Solo se buscan Gerencias (approval_order 1) para no repetir un departamento de pasos posteriores.
 */
function gerenciaPorTipoDeCentro(
  departments: Department[],
  storeTypeCode?: string | null,
  storeName?: string
): Department | undefined {
  const gerencias = departments.filter((d) => d.approval_order === 1);
  const isMaquinaria = storeTypeCode
    ? storeTypeCode === 'maquinaria'
    : (storeName ? (storeName.trim().toLowerCase() === 'maquinaria' || /^0*30\b/i.test(storeName.trim())) : false);

  if (isMaquinaria) {
    return gerencias.find((d) => d.code === 'gerencia_maquinaria') ||
      gerencias.find((d) => d.name?.toLowerCase().includes('maquinaria'));
  }

  return gerencias.find((d) => d.code === 'gerencia_construccion') ||
    gerencias.find((d) => d.code?.includes('construccion')) ||
    gerencias.find((d) => d.name?.toLowerCase().includes('construcci'));
}

/**
 * Arma las aprobaciones de una orden a partir de los departamentos que requieren aprobación:
 * - Urgente de un jefe (sin conceptos fuera de presupuesto): Dirección (3) → Contabilidad (4) → Pagos (5).
 * - Solicitante de una Gerencia (approval_order 1): su Gerencia → Contraloría → ... Si es el jefe, su paso
 *   se autoaprueba, salvo que haya conceptos fuera de presupuesto (Gerencia siempre los revisa).
 * - Solicitante de Contraloría, Dirección, Contabilidad o Pagos: empieza en Contraloría, sin Gerencia.
 * - Solicitante sin Gerencia propia (o fuera de presupuesto desde un depto. sin Gerencia):
 *   Gerencia según el tipo de centro de costos.
 */
export function buildOrderApprovals(
  departments: Department[],
  input: OrderApprovalRoutingInput,
  now: Date = new Date()
): OrderApprovalPlan {
  const { orderId, applicantId, applicantDepartmentId, isApplicantDeptHead, isUrgent, requiresExtraBudgetApproval } = input;
  const approvals: OrderApprovalRow[] = [];
  const pendingStep = (dept: Department): OrderApprovalRow => ({
    order_id: orderId,
    department_id: dept.id,
    status: 'pending',
    approval_order: dept.approval_order as number,
  });

  if (isUrgent && isApplicantDeptHead && !requiresExtraBudgetApproval) {
    // Se saltan Gerencia (1) y Contraloría (2)
    departments
      .filter((d) => d.approval_order && d.approval_order >= 3)
      .forEach((d) => approvals.push(pendingStep(d)));
  } else {
    const applicantDept = departments.find((d) => d.id === applicantDepartmentId);
    const applicantIsGerencia = applicantDept?.approval_order === 1;
    const applicantInLaterStep = Boolean(applicantDept?.approval_order && applicantDept.approval_order >= 2);

    let gerencia: Department | undefined;
    if (applicantIsGerencia) {
      gerencia = applicantDept;
    } else if (!applicantInLaterStep || requiresExtraBudgetApproval) {
      gerencia = gerenciaPorTipoDeCentro(departments, input.storeTypeCode, input.storeName);
    }

    if (gerencia) {
      const autoApprove = applicantIsGerencia && isApplicantDeptHead && !requiresExtraBudgetApproval;
      approvals.push({
        ...pendingStep(gerencia),
        approval_order: gerencia.approval_order || 1,
        status: autoApprove ? 'approved' : 'pending',
        approver_id: autoApprove ? applicantId : null,
        approved_at: autoApprove ? now.toISOString() : null,
        comments: requiresExtraBudgetApproval
          ? 'Autorización especial requerida: conceptos fuera de presupuesto o agotados'
          : (autoApprove ? 'Auto-aprobado (solicitante es jefe de departamento)' : null),
      });
    }

    // Resto del flujo: Contraloría (2) → Dirección (3) → Contabilidad (4) → Pagos (5)
    departments
      .filter((d) => d.approval_order && d.approval_order > 1 && d.id !== gerencia?.id)
      .forEach((d) => approvals.push(pendingStep(d)));
  }

  const firstPending = approvals
    .filter((a) => a.status === 'pending')
    .reduce<number | null>((min, a) => (min === null || a.approval_order < min ? a.approval_order : min), null);

  return {
    approvals,
    startsInProgress: firstPending !== null && firstPending > 1,
  };
}
