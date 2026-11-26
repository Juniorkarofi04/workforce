import React, { useCallback, useEffect, useState } from 'react';
import {
  Building2,
  ClipboardCheck,
  Globe,
  LayoutDashboard,
  LogOut,
  Menu,
  UserCheck,
  Users,
  X,
} from 'lucide-react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { apiFetch } from './lib/api';
import {
  ApprovalRequest,
  AuditLog,
  Candidate,
  DashboardSnapshot,
  DepartmentWithStaffing,
  Employee,
  JobRequisition,
  UserRole,
} from './types';
import { SignInScreen } from './components/SignInScreen';
import { GlobalSearchBar } from './components/GlobalSearchBar';
import { ExecutiveDashboard } from './components/ExecutiveDashboard';
import { DepartmentStaffingView } from './components/DepartmentStaffingView';
import { RecruitmentPipelineView } from './components/RecruitmentPipelineView';
import { EmployeeDirectoryView } from './components/EmployeeDirectoryView';
import { ApprovalsAuditView } from './components/ApprovalsAuditView';
import { PublicCareersView } from './components/PublicCareersView';

type ActiveTab = 'dashboard' | 'departments' | 'recruitment' | 'employees' | 'approvals';

const NAV_ITEMS: Array<{ id: ActiveTab; label: string; icon: React.FC<{ className?: string }> }> = [
  { id: 'dashboard', label: 'Executive Overview', icon: LayoutDashboard },
  { id: 'departments', label: 'Department Staffing', icon: Building2 },
  { id: 'recruitment', label: 'Recruitment Pipeline', icon: UserCheck },
  { id: 'employees', label: 'Employee Directory', icon: Users },
  { id: 'approvals', label: 'Approvals & Audit', icon: ClipboardCheck },
];

const WorkspaceShell: React.FC = () => {
  const { dbUser, assignedDepartment, loading: authLoading, signOut } = useAuth();
  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const initialParams = new URLSearchParams(window.location.search);
  const [careersMode, setCareersMode] = useState<boolean>(
    initialParams.get('view') === 'careers' || window.location.pathname === '/careers'
  );
  const [careersRoleCode] = useState<string | null>(initialParams.get('role'));

  const [snapshot, setSnapshot] = useState<DashboardSnapshot | null>(null);
  const [departments, setDepartments] = useState<DepartmentWithStaffing[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [requisitions, setRequisitions] = useState<JobRequisition[]>([]);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [approvals, setApprovals] = useState<ApprovalRequest[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [dataLoading, setDataLoading] = useState(false);
  const [dataError, setDataError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const [prefilledReqDeptId, setPrefilledReqDeptId] = useState<number | null>(null);
  const [prefilledApprovalDeptId, setPrefilledApprovalDeptId] = useState<number | null>(null);
  const [selectedReqId, setSelectedReqId] = useState<number | null>(null);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<number | null>(null);
  const [highlightedDeptId, setHighlightedDeptId] = useState<number | null>(null);

  const showToast = useCallback((message: string) => {
    setToast(message);
    setTimeout(() => {
      setToast((current) => (current === message ? null : current));
    }, 5500);
  }, []);

  const loadAllData = useCallback(async () => {
    if (!dbUser) return;
    setDataLoading(true);
    setDataError(null);
    try {
      const [dash, depts, emps, rec, appr, audit] = await Promise.all([
        apiFetch<DashboardSnapshot>('/api/dashboard'),
        apiFetch<DepartmentWithStaffing[]>('/api/departments'),
        apiFetch<Employee[]>('/api/employees'),
        apiFetch<{ requisitions: JobRequisition[]; candidates: Candidate[] }>('/api/recruitment'),
        apiFetch<ApprovalRequest[]>('/api/approvals'),
        apiFetch<AuditLog[]>('/api/audit'),
      ]);
      setSnapshot(dash);
      setDepartments(depts);
      setEmployees(emps);
      setRequisitions(rec.requisitions);
      setCandidates(rec.candidates);
      setApprovals(appr);
      setAuditLogs(audit);
    } catch (err: any) {
      console.error('Error loading workspace data:', err);
      setDataError(err.message || 'Unable to load workspace data.');
    } finally {
      setDataLoading(false);
    }
  }, [dbUser]);

  useEffect(() => {
    if (dbUser) {
      loadAllData();
    }
  }, [dbUser, loadAllData]);

  const openCareersView = () => {
    setCareersMode(true);
    const url = new URL(window.location.href);
    url.searchParams.set('view', 'careers');
    window.history.replaceState({}, '', url.toString());
  };

  const closeCareersView = () => {
    setCareersMode(false);
    const url = new URL(window.location.href);
    url.searchParams.delete('view');
    url.searchParams.delete('role');
    window.history.replaceState({}, '', url.toString());
    if (dbUser) {
      loadAllData();
    }
  };

  if (careersMode) {
    return (
      <PublicCareersView
        initialReqCode={careersRoleCode}
        isSignedIn={Boolean(dbUser)}
        onBackToApp={closeCareersView}
      />
    );
  }

  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <p className="text-sm text-slate-500">Verifying workspace session...</p>
      </div>
    );
  }

  if (!dbUser) {
    return <SignInScreen onOpenCareers={openCareersView} />;
  }

  const userRole = dbUser.role as UserRole;
  const pendingCount = approvals.filter((a) => a.status === 'Pending').length;
  const currentTitle = NAV_ITEMS.find((n) => n.id === activeTab)?.label || 'Overview';

  const handleOpenRecruitmentForDept = (dept: DepartmentWithStaffing) => {
    setPrefilledReqDeptId(dept.id);
    setActiveTab('recruitment');
  };

  const handleRequestIncreaseForDept = (dept: DepartmentWithStaffing) => {
    setPrefilledApprovalDeptId(dept.id);
    setActiveTab('approvals');
  };

  const sidebarContent = (
    <div className="flex flex-col h-full justify-between bg-white border-r border-slate-200">
      <div>
        <div className="h-14 px-5 border-b border-slate-200 flex items-center justify-between">
          <span className="font-display text-base font-bold tracking-tight text-slate-900 whitespace-nowrap">
            Meridian Workforce
          </span>
          <button
            type="button"
            onClick={() => setMobileMenuOpen(false)}
            className="lg:hidden p-1 text-slate-500 hover:text-slate-900"
            aria-label="Close navigation menu"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <nav className="p-3 space-y-1">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setActiveTab(item.id);
                  setMobileMenuOpen(false);
                }}
                className={`w-full flex items-center justify-between gap-2.5 px-3 py-2 text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                  active
                    ? 'bg-slate-900 text-white'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                <span className="flex items-center gap-2.5">
                  <Icon className="w-4 h-4 shrink-0" />
                  <span>{item.label}</span>
                </span>
                {item.id === 'approvals' && pendingCount > 0 && (
                  <span
                    className={`font-mono tabular-nums text-[11px] ${
                      active ? 'text-amber-300' : 'text-amber-700'
                    }`}
                  >
                    {pendingCount}
                  </span>
                )}
              </button>
            );
          })}

          <div className="pt-2 mt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={openCareersView}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900 rounded-md transition-colors cursor-pointer whitespace-nowrap"
            >
              <Globe className="w-4 h-4 shrink-0" />
              <span>Public Careers Site</span>
            </button>
          </div>
        </nav>
      </div>

      <div className="p-4 border-t border-slate-200 space-y-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold text-slate-900 truncate">{dbUser.name}</p>
          <p className="text-[11px] text-slate-500 truncate">{dbUser.email}</p>
          <p className="mt-1 text-[11px] font-medium text-slate-700">
            {userRole === 'CEO'
              ? 'CEO · Super Admin'
              : `Department Head · ${assignedDepartment?.name || 'Assigned Dept'}`}
          </p>
        </div>

        <button
          type="button"
          onClick={signOut}
          className="w-full inline-flex items-center justify-center gap-2 px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-md transition-colors cursor-pointer whitespace-nowrap"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>Sign Out</span>
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 flex">
      <aside className="hidden lg:block w-60 shrink-0 sticky top-0 h-screen">
        {sidebarContent}
      </aside>

      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div className="w-64 h-full">{sidebarContent}</div>
          <div
            className="flex-1 bg-slate-900/40"
            onClick={() => setMobileMenuOpen(false)}
          />
        </div>
      )}

      <div className="flex-1 min-w-0 flex flex-col">
        <header className="h-14 bg-white border-b border-slate-200 px-4 sm:px-6 flex items-center justify-between gap-4 sticky top-0 z-30">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden p-1.5 text-slate-600 hover:text-slate-900 rounded-md"
              aria-label="Open navigation menu"
            >
              <Menu className="w-4 h-4" />
            </button>
            <div className="hidden sm:flex items-center gap-2 text-xs text-slate-500 whitespace-nowrap">
              <span>Meridian Global</span>
              <span aria-hidden="true">/</span>
              <span className="font-medium text-slate-900">{currentTitle}</span>
            </div>
          </div>

          <GlobalSearchBar
            onSelectEmployee={(empId) => {
              setSelectedEmployeeId(empId);
              setActiveTab('employees');
            }}
            onSelectDepartment={(deptId) => {
              setHighlightedDeptId(deptId);
              setActiveTab('departments');
            }}
            onSelectRequisition={(reqId) => {
              setSelectedReqId(reqId);
              setActiveTab('recruitment');
            }}
          />
        </header>

        <main className="flex-1 p-4 sm:p-6 max-w-[1400px] w-full mx-auto space-y-5">
          {toast && (
            <div className="px-4 py-3 bg-emerald-50 border border-emerald-200 rounded-md flex items-center justify-between gap-3 text-xs text-emerald-900">
              <span>{toast}</span>
              <button
                type="button"
                onClick={() => setToast(null)}
                className="text-emerald-700 hover:text-emerald-900 cursor-pointer shrink-0"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {dataError && (
            <div className="px-4 py-3 bg-red-50 border border-red-200 rounded-md flex items-center justify-between gap-3 text-xs text-red-800">
              <span>{dataError}</span>
              <button
                type="button"
                onClick={loadAllData}
                className="font-medium underline cursor-pointer shrink-0"
              >
                Retry
              </button>
            </div>
          )}

          {activeTab === 'dashboard' && (
            <ExecutiveDashboard
              snapshot={snapshot}
              loading={dataLoading}
              onNavigateTab={(tab) => setActiveTab(tab)}
              onOpenRecruitmentForDept={handleOpenRecruitmentForDept}
            />
          )}

          {activeTab === 'departments' && (
            <DepartmentStaffingView
              departments={departments}
              userRole={userRole}
              userDepartmentId={dbUser.departmentId}
              onRefresh={loadAllData}
              onOpenRecruitmentForDept={handleOpenRecruitmentForDept}
              onRequestIncreaseForDept={handleRequestIncreaseForDept}
              highlightedDeptId={highlightedDeptId}
            />
          )}

          {activeTab === 'recruitment' && (
            <RecruitmentPipelineView
              requisitions={requisitions}
              candidates={candidates}
              departments={departments}
              userRole={userRole}
              userDepartmentId={dbUser.departmentId}
              onRefresh={loadAllData}
              onNotify={showToast}
              prefilledDeptId={prefilledReqDeptId}
              onClearPrefilledDept={() => setPrefilledReqDeptId(null)}
              selectedReqId={selectedReqId}
              onSelectReqId={setSelectedReqId}
              onOpenCareersPortal={openCareersView}
            />
          )}

          {activeTab === 'employees' && (
            <EmployeeDirectoryView
              employees={employees}
              departments={departments}
              userRole={userRole}
              userDepartmentId={dbUser.departmentId}
              onRefresh={loadAllData}
              onNotify={showToast}
              selectedEmployeeId={selectedEmployeeId}
              onSelectEmployeeId={setSelectedEmployeeId}
            />
          )}

          {activeTab === 'approvals' && (
            <ApprovalsAuditView
              approvals={approvals}
              auditLogs={auditLogs}
              departments={departments}
              employees={employees}
              userRole={userRole}
              userDepartmentId={dbUser.departmentId}
              onRefresh={loadAllData}
              onNotify={showToast}
              prefilledApprovalDeptId={prefilledApprovalDeptId}
              onClearPrefilledApproval={() => setPrefilledApprovalDeptId(null)}
            />
          )}
        </main>
      </div>
    </div>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <WorkspaceShell />
    </AuthProvider>
  );
}
