// Types generados desde el schema de la base de datos Supabase
// Estas interfaces representan las tablas y sus relaciones

// ============================================
// ENUMS
// ============================================

export type ProjectStatus = 'En Proceso' | 'Completado' | 'Pausado';
export type MilestoneStatus = 'Completado' | 'En Proceso' | 'Pendiente';
export type ApprovalStatus = 'pending' | 'approved' | 'rejected';
export type Currency = 'MXN' | 'USD';
export type AccessLevel = 'viewer' | 'editor' | 'admin';

// ============================================
// RETENTION OPTIONS
// ============================================

export interface RetentionOption {
  key: string;
  label: string;
  percentage: number;
  type: 'iva' | 'isr';
  /** 'subtotal' = se calcula sobre el subtotal, 'iva' = se calcula sobre el monto de IVA */
  appliesOn: 'subtotal' | 'iva';
}

export const RETENTION_OPTIONS: RetentionOption[] = [
  // Retenciones de IVA (se calculan sobre el monto de IVA trasladado, NO sobre el subtotal)
  { key: 'ret_iva_10.6667', label: 'Ret. IVA 10.6667% (2/3 del IVA)', percentage: 10.6667, type: 'iva', appliesOn: 'subtotal' },
  { key: 'ret_iva_4', label: 'Ret. IVA 4% (Transportistas)', percentage: 4, type: 'iva', appliesOn: 'subtotal' },
  { key: 'ret_iva_6', label: 'Ret. IVA 6% (Servicios Especializados)', percentage: 6, type: 'iva', appliesOn: 'subtotal' },
  { key: 'ret_iva_100', label: 'Ret. IVA 100%', percentage: 100, type: 'iva', appliesOn: 'iva' },
  { key: 'ret_iva_8_frontera', label: 'Ret. IVA 8% (Frontera Norte/Sur)', percentage: 8, type: 'iva', appliesOn: 'subtotal' },
  // Retenciones de ISR (se calculan sobre el subtotal)
  { key: 'ret_isr_10', label: 'Ret. ISR 10% (Honorarios / Arrendamiento)', percentage: 10, type: 'isr', appliesOn: 'subtotal' },
  { key: 'ret_isr_1.25', label: 'Ret. ISR 1.25% (RESICO / Fletes)', percentage: 1.25, type: 'isr', appliesOn: 'subtotal' },
];

/**
 * Mapa indexado por clave para lookup O(1) en calculateRetentions.
 * Antes: RETENTION_OPTIONS.find(o => o.key === key) → O(R) por clave seleccionada.
 * Ahora: RETENTION_MAP.get(key)                     → O(1) por clave seleccionada.
 * Impacto: O(K×R) → O(K) donde K = claves seleccionadas, R = 7 opciones totales.
 */
export const RETENTION_MAP = new Map<string, RetentionOption>(
  RETENTION_OPTIONS.map((o) => [o.key, o])
);

/**
 * Calcula el monto total de retenciones a partir de las claves seleccionadas.
 * Retorna el monto total a restar y el desglose por retencion.
 */
export function calculateRetentions(
  selectedKeys: string[],
  subtotal: number,
  ivaAmount: number
): { totalRetention: number; breakdown: Array<{ label: string; amount: number }> } {
  const breakdown: Array<{ label: string; amount: number }> = [];
  let totalRetention = 0;

  for (const key of selectedKeys) {
    const option = RETENTION_MAP.get(key);
    if (!option) continue;

    let amount: number;
    if (option.appliesOn === 'iva') {
      // Se calcula sobre el monto de IVA
      amount = ivaAmount * (option.percentage / 100);
    } else {
      // Se calcula sobre el subtotal
      amount = subtotal * (option.percentage / 100);
    }

    amount = Math.round(amount * 100) / 100;
    breakdown.push({ label: option.label, amount });
    totalRetention += amount;
  }

  return { totalRetention: Math.round(totalRetention * 100) / 100, breakdown };
}

// ============================================
// BASE TABLES
// ============================================

export interface Department {
  id: string;
  name: string;
  code: string;
  approval_order: number | null;
  requires_approval: boolean;
  created_at: string;
}

export interface Role {
  id: number;
  name: string;
  description: string | null;
  created_at: string;
}

export interface Store {
  id: number;
  name: string;
  created_at: string;
}

export interface Supplier {
  id: number;
  commercial_name: string;
  social_reason: string;
  rfc: string;
  address: string | null;
  phone: string | null;
  clabe: string;
  bank: string;
  contact: string | null;
  category: string;
  created_at: string;
}

// ============================================
// USER RELATED
// ============================================

export interface User {
  id: string;
  email: string;
  password_hash: string;
  full_name: string | null;
  created_at: string;
  updated_at: string;
  role: number;
  department_id: string | null;
  is_department_head: boolean;
  is_active: boolean;
}

export interface UserWithRelations extends User {
  roles?: Role;
  department?: Department;
}

// ============================================
// PROJECT RELATED
// ============================================

export interface Project {
  id: string;
  project_id: string;
  project_name: string;
  client: string;
  status: ProjectStatus;
  start_date: string;
  estimated_end_date: string | null;
  physical_progress: number;
  created_at: string;
  updated_at: string;
}

export interface ProjectFinancial {
  id: string;
  project_id: string;
  total_budget: number;
  currency: Currency;
  spent: number;
  percentage: number;
  last_update: string;
  created_at: string;
  updated_at: string;
}

export interface ProjectSupervisor {
  id: string;
  project_id: string;
  name: string;
  phone: string | null;
  email: string | null;
  position: string;
  created_at: string;
  updated_at: string;
}

export interface ProjectContact {
  id: string;
  project_id: string;
  name: string;
  role: string | null;
  phone: string | null;
  email: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProjectMilestone {
  id: string;
  project_id: string;
  name: string;
  status: MilestoneStatus;
  progress: number;
  date: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface ProjectUpdate {
  id: string;
  project_id: string;
  date: string;
  title: string;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export interface UserProject {
  id: string;
  user_id: string;
  project_id: string;
  assigned_at: string;
  assigned_by: string | null;
  access_level: AccessLevel;
  created_at: string;
}

export interface ProjectWithRelations extends Project {
  project_financials?: ProjectFinancial[];
  project_supervisors?: ProjectSupervisor[];
  project_contacts?: ProjectContact[];
  project_milestones?: ProjectMilestone[];
  project_updates?: ProjectUpdate[];
}

// ============================================
// ORDER RELATED
// ============================================

export interface OrderItem {
  nombre: string;
  cantidad: number;
  unidad: string;
  precioUnitario: number;
  precioTotal?: number;
  proveedor?: string;
  supplier_id?: number;
  supplier_name?: string;
}

export interface Order {
  id: number;
  applicant_id: string;
  store_id: number;
  date: string | null;
  supplier_id: number;
  items: string; // JSON stringified OrderItem[]
  quantity: number | null;
  unity: string | null;
  price_excluding_iva: number | null;
  price_with_iva: number | null;
  subtotal: number | null;
  iva: number | null;
  total: number | null;
  currency: string | null;
  justification: string | null;
  retention: string | null;
  payment_type: string | null; // 'credito' | 'de_contado'
  tax_type: string | null; // 'con_iva' | 'sin_iva' | 'retencion'
  iva_percentage: number | null; // 8 or 16
  status: string | null;
  created_at: string;
  updated_at: string | null;
  justification_prove: string | null;
  is_urgent: boolean;
  urgency_justification: string | null;
  is_definitive_rejection: boolean;
}

export interface OrderApproval {
  id: string;
  order_id: number | null;
  department_id: string | null;
  approver_id: string | null;
  status: ApprovalStatus | null;
  comments: string | null;
  approved_at: string | null;
  approval_order: number | null;
  created_at: string;
}

export interface OrderApprovalWithRelations extends OrderApproval {
  department?: Department;
}

// ============================================
// CHATBOT / API SPECIFIC TYPES
// ============================================

export interface FormattedProject {
  projectId: string;
  projectName: string;
  client: string;
  status: ProjectStatus;
  startDate: string;
  estimatedEndDate: string | null;
  physicalProgress: number;
  financialProgress: {
    totalBudget: number;
    currency: Currency;
    spent: number;
    percentage: number;
    lastUpdate: string;
  };
  supervisor: {
    name: string;
    phone: string;
    email: string;
    position: string;
  };
  contacts: Array<{
    name: string;
    role: string | null;
    phone: string | null;
    email: string | null;
  }>;
  milestones: Array<{
    name: string;
    status: MilestoneStatus;
    progress: number;
    date: string | null;
  }>;
  recentUpdates: Array<{
    date: string;
    title: string;
    description: string | null;
  }>;
}

export interface ProjectMetrics {
  totalDays: number;
  elapsedDays: number;
  remainingDays: number;
  timeProgress: number;
  physicalProgress: number;
  progressDifference: number;
  dailyProgressRate: string;
  estimatedDaysToComplete: number;
  estimatedCompletionDate: string;
  estimatedDelay: number;
  projectHealthStatus: string;
  healthEmoji: string;
  budgetUsageRate: string;
  budgetEfficiency: string;
  budgetStatus: string;
  budgetEmoji: string;
  budgetRemaining: number;
  delayedMilestones: number;
  delayedMilestonesList: Array<{
    name: string;
    status: MilestoneStatus;
    progress: number;
    date: string | null;
  }>;
  upcomingMilestones: Array<{
    name: string;
    status: MilestoneStatus;
    progress: number;
    date: string | null;
  }>;
  totalMilestones: number;
  completedMilestones: number;
}

export interface FormattedProjectWithMetrics extends FormattedProject {
  calculatedMetrics?: ProjectMetrics;
}

// ============================================
// API REQUEST/RESPONSE TYPES
// ============================================

export interface CreateOrderRequest {
  applicant_name: string;
  applicant_id?: string;
  store_name: string;
  machine_name?: string;
  store_id?: number;
  supplier_name?: string;
  supplier_id?: string | number;
  items: OrderItem[];
  justification?: string;
  currency?: string;
  retention?: string;
  payment_type?: string;
  tax_type?: string;
  iva_percentage?: number;
  is_urgent?: boolean;
  urgency_justification?: string;
  evidenceUrls?: string[];
}

export interface ApiError {
  message?: string;
  status?: number;
  code?: string | number;
}

// ============================================
// APPROVAL FLOW TYPES
// ============================================

export interface ApprovalPosition {
  order: number;
  label: string;
  x: number;
  y: number;
}

// Type guard para errores
export function isApiError(error: unknown): error is ApiError {
  return (
    typeof error === 'object' &&
    error !== null &&
    ('message' in error || 'status' in error || 'code' in error)
  );
}

// ============================================
// USER ROLE RELATION TYPE
// ============================================

export interface UserRoleRelation {
  name: string;
}

// ============================================
// ORDER WITH RELATIONS (para PDFs y queries)
// ============================================

export interface OrderApplicant {
  full_name: string | null;
  email: string | null;
}

export interface OrderStore {
  name: string;
}

export interface OrderSupplier {
  commercial_name: string;
  social_reason: string;
  rfc: string;
  address: string | null;
  phone: string | null;
  clabe: string;
  bank: string;
  contact: string | null;
}

export interface OrderWithRelations extends Order {
  applicant?: OrderApplicant | null;
  store?: OrderStore | null;
  supplier?: OrderSupplier | null;
}

// ============================================
// MILESTONE/UPDATE SORTING TYPES
// ============================================

export interface MilestoneSortable {
  sort_order: number;
  name: string;
  status: MilestoneStatus;
  progress: number;
  date: string | null;
}

export interface UpdateSortable {
  date: string;
  title: string;
  description: string | null;
}

// ============================================
// APPROVAL WITH APPROVER (para PDFs)
// ============================================

export interface ApprovalApprover {
  full_name: string;
  email: string;
}

export interface OrderApprovalForPdf extends OrderApproval {
  department?: Department | null;
  approver?: ApprovalApprover | null;
}

// ============================================
// NEEDS LIST RELATED (Listas de Necesidades)
// ============================================

export type AccountType = 'ahorro' | 'cheques' | 'inversion';
export type NeedsListStatus = 'pending' | 'in_progress' | 'approved' | 'rejected' | 'paid' | 'completed';

export interface UserBankAccount {
  id: string;
  user_id: string;
  bank_name: string;
  account_number: string;
  clabe: string | null;
  account_type: AccountType;
  is_primary: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

export interface NeedsListItem {
  nombre: string;
  cantidad: number;
  unidad: string;
  precioUnitario: number;
  precioTotal?: number;
  descripcion?: string;
  justificacion?: string;
  evidencia_url?: string;
}

export interface NeedsList {
  id: number;
  applicant_id: string;
  store_id: number | null;
  bank_account_id: string;
  date: string;
  folio: string | null;
  items: string; // JSON stringified NeedsListItem[]
  justification: string | null;
  evidence_urls: string | null; // URLs separadas por comas
  subtotal: number;
  iva: number;
  total: number;
  currency: Currency;
  iva_percentage: number;
  status: NeedsListStatus;
  is_urgent: boolean;
  urgency_justification: string | null;
  is_definitive_rejection: boolean;
  created_at: string;
  updated_at: string;
}

export interface NeedsListApproval {
  id: string;
  needs_list_id: number;
  department_id: string;
  approver_id: string | null;
  status: ApprovalStatus;
  comments: string | null;
  approved_at: string | null;
  approval_order: number; // 1: Gerencia, 2: Contabilidad, 3: Contraloría
  created_at: string;
}

export interface NeedsListAttachment {
  id: string;
  needs_list_id: number;
  uploaded_by: string;
  file_name: string;
  file_size: number;
  file_type: string;
  file_url: string;
  storage_path: string;
  description: string | null;
  created_at: string;
}

// ============================================
// NEEDS LIST WITH RELATIONS
// ============================================

export interface NeedsListApplicant {
  full_name: string | null;
  email: string | null;
}

export interface NeedsListStore {
  name: string;
}

export interface NeedsListBankAccount {
  bank_name: string;
  account_number: string;
  clabe: string | null;
}

export interface NeedsListWithRelations extends NeedsList {
  applicant?: NeedsListApplicant | null;
  store?: NeedsListStore | null;
  bank_account?: NeedsListBankAccount | null;
}

export interface NeedsListApprovalWithRelations extends NeedsListApproval {
  department?: Department;
  approver?: ApprovalApprover | null;
}

// ============================================
// API REQUEST TYPES FOR NEEDS LISTS
// ============================================

export interface CreateNeedsListRequest {
  applicant_id?: string; // Se obtiene de la sesión, no del body
  store_name?: string;
  store_id?: number;
  bank_account_id: string;
  items: NeedsListItem[];
  currency?: Currency;
  iva_percentage?: number;
  is_urgent?: boolean;
  urgency_justification?: string;
}

export interface UpdateNeedsListRequest {
  store_name?: string;
  store_id?: number;
  bank_account_id?: string;
  items?: NeedsListItem[];
  justification?: string;
  currency?: Currency;
  iva_percentage?: number;
  evidenceUrls?: string[];
}
