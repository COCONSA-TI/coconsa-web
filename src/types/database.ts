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
  status: string | null;
  created_at: string;
  updated_at: string | null;
  justification_prove: string | null;
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
  store_id?: number;
  items: OrderItem[];
  justification?: string;
  currency?: string;
  retention?: string;
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
