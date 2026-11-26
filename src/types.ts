export type UserRole = 'CEO' | 'DEPARTMENT_HEAD';

export interface UserProfile {
  id: number;
  uid: string;
  email: string;
  name: string;
  avatarUrl: string | null;
  role: UserRole;
  departmentId: number | null;
}

export interface DepartmentWithStaffing {
  id: number;
  name: string;
  code: string;
  leadName: string;
  description: string;
  targetHeadcount: number;
  allocatedBudget: number;
  priority: 'Critical' | 'High' | 'Normal';
  location: string;
  filledCount: number;
  activeCount: number;
  onLeaveCount: number;
  onboardingCount: number;
  gap: number;
  openRequisitionsCount: number;
  openRolesNeeded: number;
}

export interface OnboardingTask {
  id: number;
  employeeId: number;
  title: string;
  category: string;
  completed: boolean;
  dueDate: string;
  completedAt: string | null;
}

export interface Employee {
  id: number;
  employeeCode: string;
  name: string;
  email: string;
  role: string;
  departmentId: number;
  departmentName: string;
  departmentCode: string;
  managerName: string;
  startDate: string;
  employmentType: 'Full-Time' | 'Part-Time' | 'Contract';
  status: 'Active' | 'On Leave' | 'Onboarding';
  compensationBand: string;
  location: string;
  onboardingTasks: OnboardingTask[];
  onboardingCompletedCount: number;
  onboardingTotalCount: number;
}

export type PipelineStage = 'Applied' | 'Screening' | 'Interview' | 'Offer' | 'Hired' | 'Rejected';

export interface Candidate {
  id: number;
  requisitionId: number;
  name: string;
  email: string;
  currentTitle: string;
  source: string;
  stage: PipelineStage;
  location: string;
  compensationExpectation: string;
  notes: string;
  hiredEmployeeId: number | null;
  appliedAt: string;
  updatedAt: string;
  roleTitle?: string;
  reqCode?: string;
  departmentId?: number;
  departmentName?: string;
  departmentCode?: string;
}

export interface JobRequisition {
  id: number;
  reqCode: string;
  departmentId: number;
  departmentName: string;
  departmentCode: string;
  roleTitle: string;
  hiringManager: string;
  urgency: 'Critical' | 'High' | 'Normal';
  headcountNeeded: number;
  filledHires: number;
  targetStartDate: string;
  compensationBand: string;
  location: string;
  employmentType: string;
  jobSummary: string;
  isPublishedToWebsite: boolean;
  publishedSocials: string;
  status: 'Open' | 'Filled' | 'Paused';
  candidates: Candidate[];
}

export interface PublicCareerListing {
  id: number;
  reqCode: string;
  roleTitle: string;
  departmentName: string;
  departmentCode: string;
  urgency: 'Critical' | 'High' | 'Normal';
  openings: number;
  targetStartDate: string;
  compensationBand: string;
  location: string;
  employmentType: string;
  jobSummary: string;
  publishedSocials: string;
  createdAt: string;
}

export interface ApprovalRequest {
  id: number;
  requestType: 'STAFFING_INCREASE' | 'DEPARTMENT_TRANSFER' | 'NEW_REQUISITION';
  status: 'Pending' | 'Approved' | 'Rejected';
  requesterName: string;
  requesterEmail: string;
  departmentId: number;
  departmentName: string;
  departmentCode: string;
  employeeId: number | null;
  employeeName: string | null;
  employeeCode: string | null;
  toDepartmentId: number | null;
  toDepartmentName: string | null;
  title: string;
  justification: string;
  requestedTargetHeadcount: number | null;
  requestedBudget: number | null;
  requestedRoleTitle: string | null;
  requestedUrgency: string | null;
  reviewerName: string | null;
  reviewerNotes: string | null;
  reviewedAt: string | null;
  createdAt: string;
}

export interface AuditLog {
  id: number;
  actorName: string;
  actorEmail: string;
  actorRole: string;
  action: string;
  entityType: string;
  entityId: number | null;
  summary: string;
  details: string;
  createdAt: string;
}

export interface DashboardSnapshot {
  summary: {
    totalFilled: number;
    totalTarget: number;
    totalGap: number;
    fillRate: number;
    totalBudget: number;
    activeCount: number;
    onLeaveCount: number;
    onboardingCount: number;
    openRequisitionsCount: number;
    activeCandidatesCount: number;
    pendingApprovalsCount: number;
  };
  departments: DepartmentWithStaffing[];
  criticalAlerts: DepartmentWithStaffing[];
  recentAudit: AuditLog[];
}

export interface GlobalSearchResult {
  employees: Array<{
    id: number;
    employeeCode: string;
    name: string;
    email: string;
    role: string;
    departmentId: number;
    status: string;
    location: string;
  }>;
  departments: Array<{
    id: number;
    name: string;
    code: string;
    leadName: string;
    priority: string;
  }>;
  requisitions: Array<{
    id: number;
    reqCode: string;
    roleTitle: string;
    departmentId: number;
    urgency: string;
    status: string;
  }>;
}

export interface ManagedUser {
  id: number;
  uid: string;
  email: string;
  name: string;
  avatarUrl: string | null;
  role: UserRole;
  departmentId: number | null;
  departmentName: string | null;
  departmentCode: string | null;
}
