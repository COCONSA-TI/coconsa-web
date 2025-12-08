export interface Contact {
  name: string;
  role: string;
  phone: string;
  email: string;
}

export interface Supervisor {
  name: string;
  phone: string;
  email: string;
  position: string;
}

export interface Milestone {
  name: string;
  status: "Completado" | "En Proceso" | "Pendiente";
  progress: number;
  date: string;
}

export interface RecentUpdate {
  date: string;
  title: string;
  description: string;
}

export interface FinancialProgress {
  totalBudget: number;
  currency: "MXN" | "USD";
  spent: number;
  percentage: number;
  lastUpdate: string;
}

export interface Project {
  projectId: string;
  projectName: string;
  client: string;
  status: "En Proceso" | "Completado" | "Pausado";
  startDate: string;
  estimatedEndDate: string;
  physicalProgress: number;
  financialProgress: FinancialProgress;
  supervisor: Supervisor;
  contacts: Contact[];
  milestones: Milestone[];
  recentUpdates: RecentUpdate[];
}
