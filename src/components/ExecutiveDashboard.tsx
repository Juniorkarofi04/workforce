import React from 'react';
import { AlertTriangle, ArrowRight } from 'lucide-react';
import { DashboardSnapshot, DepartmentWithStaffing } from '../types';

interface ExecutiveDashboardProps {
  snapshot: DashboardSnapshot | null;
  loading: boolean;
  onNavigateTab: (tab: 'departments' | 'recruitment' | 'employees' | 'approvals') => void;
  onOpenRecruitmentForDept: (dept: DepartmentWithStaffing) => void;
}

function formatCurrency(amount: number): string {
  if (amount >= 1_000_000_000) {
    return `₦${(amount / 1_000_000_000).toFixed(2)}B`;
  }
  if (amount >= 1_000_000) {
    return `₦${(amount / 1_000_000).toFixed(1)}M`;
  }
  return `₦${amount.toLocaleString()}`;
}

function formatTimestamp(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export const ExecutiveDashboard: React.FC<ExecutiveDashboardProps> = ({
  snapshot,
  loading,
  onNavigateTab,
  onOpenRecruitmentForDept,
}) => {
  if (loading && !snapshot) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-28 bg-white border border-slate-200 rounded-lg animate-pulse" />
          ))}
        </div>
        <div className="h-72 bg-white border border-slate-200 rounded-lg animate-pulse" />
      </div>
    );
  }

  if (!snapshot) return null;

  const { summary, departments, criticalAlerts, recentAudit } = snapshot;

  return (
    <div className="space-y-6">
      {/* KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-lg p-5">
          <p className="text-xs font-medium text-slate-500">Total Headcount vs. Target</p>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-semibold text-slate-900 font-mono tabular-nums">
              {summary.totalFilled}
            </span>
            <span className="text-sm text-slate-500 font-mono tabular-nums">
              / {summary.totalTarget} FTE
            </span>
          </div>
          <p className="mt-2 text-xs text-slate-600 tabular-nums">
            <span className="font-medium text-slate-900">{summary.fillRate}% fill rate</span>
            {' · '}
            <span className={summary.totalGap > 0 ? 'text-amber-700 font-medium' : 'text-emerald-700'}>
              {summary.totalGap > 0 ? `${summary.totalGap} open gap` : 'Fully staffed'}
            </span>
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-5">
          <p className="text-xs font-medium text-slate-500">Workforce Status Breakdown</p>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-semibold text-slate-900 font-mono tabular-nums">
              {summary.activeCount}
            </span>
            <span className="text-sm text-slate-500">Active</span>
          </div>
          <p className="mt-2 text-xs text-slate-600 tabular-nums">
            <span className="text-amber-700 font-medium">{summary.onboardingCount} Onboarding</span>
            {' · '}
            <span>{summary.onLeaveCount} On Leave</span>
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-5">
          <p className="text-xs font-medium text-slate-500">Approved Staffing Budget</p>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-semibold text-slate-900 font-mono tabular-nums">
              {formatCurrency(summary.totalBudget)}
            </span>
            <span className="text-sm text-slate-500">Annual</span>
          </div>
          <p className="mt-2 text-xs text-slate-600 tabular-nums">
            Across {departments.length} operating departments
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-5">
          <p className="text-xs font-medium text-slate-500">Active Pipeline &amp; Approvals</p>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-semibold text-slate-900 font-mono tabular-nums">
              {summary.activeCandidatesCount}
            </span>
            <span className="text-sm text-slate-500">Candidates</span>
          </div>
          <p className="mt-2 text-xs text-slate-600 tabular-nums">
            <span>{summary.openRequisitionsCount} Open Reqs</span>
            {' · '}
            <button
              type="button"
              onClick={() => onNavigateTab('approvals')}
              className="text-blue-700 hover:underline font-medium cursor-pointer"
            >
              {summary.pendingApprovalsCount} Pending Approvals
            </button>
          </p>
        </div>
      </div>

      {/* Critical Understaffing Alerts */}
      {criticalAlerts.length > 0 && (
        <section className="bg-white border border-slate-200 rounded-lg overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
              <h2 className="text-sm font-semibold text-slate-900">
                Critical &amp; High Understaffing Alerts
              </h2>
            </div>
            <button
              type="button"
              onClick={() => onNavigateTab('departments')}
              className="text-xs font-medium text-slate-600 hover:text-slate-900 inline-flex items-center gap-1 cursor-pointer whitespace-nowrap"
            >
              <span>View Staffing Tracker</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="divide-y divide-slate-100">
            {criticalAlerts.map((dept) => {
              const pct =
                dept.targetHeadcount > 0
                  ? Math.round((dept.filledCount / dept.targetHeadcount) * 100)
                  : 100;
              return (
                <div
                  key={dept.id}
                  className="px-5 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/70 transition-colors"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 text-sm">
                      <span className="font-mono text-xs text-slate-500">{dept.code}</span>
                      <span className="font-medium text-slate-900">{dept.name}</span>
                      <span aria-hidden="true" className="text-slate-300">
                        ·
                      </span>
                      <span
                        className={`text-xs font-medium ${
                          dept.priority === 'Critical' ? 'text-red-700' : 'text-amber-700'
                        }`}
                      >
                        {dept.priority} Priority
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-slate-500 tabular-nums">
                      Lead: {dept.leadName} · Filled {dept.filledCount} of {dept.targetHeadcount}{' '}
                      ({pct}%) · <span className="text-red-700 font-medium">Gap: {dept.gap} FTE</span>
                      {' · '}
                      {dept.openRequisitionsCount} open requisition
                      {dept.openRequisitionsCount === 1 ? '' : 's'}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => onOpenRecruitmentForDept(dept)}
                    className="px-3 py-1.5 text-xs font-medium text-slate-900 bg-white border border-slate-300 hover:bg-slate-50 rounded-md transition-colors cursor-pointer whitespace-nowrap shrink-0"
                  >
                    Open Recruitment Request
                  </button>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Main 2-column split: Department Staffing Breakdown + Recent Audit Trail */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <section className="lg:col-span-7 bg-white border border-slate-200 rounded-lg overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-900">
              Department Headcount vs. Approved Target
            </h2>
            <span className="text-xs text-slate-500 tabular-nums">
              {summary.totalFilled} / {summary.totalTarget} Total
            </span>
          </div>
          <div className="divide-y divide-slate-100">
            {departments.map((dept) => {
              const ratio =
                dept.targetHeadcount > 0
                  ? Math.min(100, Math.round((dept.filledCount / dept.targetHeadcount) * 100))
                  : 100;
              return (
                <div key={dept.id} className="px-5 py-3.5">
                  <div className="flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-900 truncate">
                        {dept.name}{' '}
                        <span className="font-mono text-xs text-slate-400 ml-1">{dept.code}</span>
                      </p>
                      <p className="text-xs text-slate-500 mt-0.5 tabular-nums">
                        {dept.activeCount} Active · {dept.onboardingCount} Onboarding ·{' '}
                        {dept.onLeaveCount} Leave
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-mono font-medium text-slate-900 tabular-nums">
                        {dept.filledCount} / {dept.targetHeadcount}
                      </p>
                      <p
                        className={`text-xs tabular-nums ${
                          dept.gap > 0
                            ? dept.priority === 'Critical'
                              ? 'text-red-700 font-medium'
                              : 'text-amber-700'
                            : 'text-emerald-700'
                        }`}
                      >
                        {dept.gap > 0 ? `-${dept.gap} gap` : 'On target'}
                      </p>
                    </div>
                  </div>
                  <div className="mt-2.5 h-1.5 w-full bg-slate-100 rounded-sm overflow-hidden">
                    <div
                      className={`h-full transition-all ${
                        dept.gap <= 0
                          ? 'bg-emerald-600'
                          : dept.priority === 'Critical'
                          ? 'bg-red-600'
                          : 'bg-slate-800'
                      }`}
                      style={{ width: `${ratio}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section className="lg:col-span-5 bg-white border border-slate-200 rounded-lg overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-900">Recent Workforce Events</h2>
            <button
              type="button"
              onClick={() => onNavigateTab('approvals')}
              className="text-xs font-medium text-slate-600 hover:text-slate-900 cursor-pointer whitespace-nowrap"
            >
              Full Audit Log
            </button>
          </div>
          <div className="divide-y divide-slate-100">
            {recentAudit.length === 0 ? (
              <div className="px-5 py-8 text-xs text-slate-500 text-center">
                No workforce events recorded yet.
              </div>
            ) : (
              recentAudit.map((entry) => (
                <div key={entry.id} className="px-5 py-3">
                  <div className="flex items-center justify-between gap-2 text-xs text-slate-500">
                    <span className="font-medium text-slate-700 truncate">{entry.actorName}</span>
                    <span className="font-mono tabular-nums shrink-0">
                      {formatTimestamp(entry.createdAt)}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-slate-900 leading-relaxed">{entry.summary}</p>
                  {entry.details && (
                    <p className="mt-0.5 text-[11px] text-slate-500">{entry.details}</p>
                  )}
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  );
};
