import React, { useEffect, useState } from 'react';
import { Check, Plus, Shield, X } from 'lucide-react';
import { apiFetch } from '../lib/api';
import {
  ApprovalRequest,
  AuditLog,
  DepartmentWithStaffing,
  Employee,
  ManagedUser,
  UserRole,
} from '../types';

interface ApprovalsAuditViewProps {
  approvals: ApprovalRequest[];
  auditLogs: AuditLog[];
  departments: DepartmentWithStaffing[];
  employees: Employee[];
  userRole: UserRole;
  userDepartmentId: number | null;
  onRefresh: () => Promise<void>;
  onNotify: (message: string) => void;
  prefilledApprovalDeptId: number | null;
  onClearPrefilledApproval: () => void;
}

export const ApprovalsAuditView: React.FC<ApprovalsAuditViewProps> = ({
  approvals,
  auditLogs,
  departments,
  employees,
  userRole,
  userDepartmentId,
  onRefresh,
  onNotify,
  prefilledApprovalDeptId,
  onClearPrefilledApproval,
}) => {
  const isCeo = userRole === 'CEO';
  const [subTab, setSubTab] = useState<'approvals' | 'audit' | 'access'>('approvals');
  const [actionFilter, setActionFilter] = useState('ALL');
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [reviewNotes, setReviewNotes] = useState<Record<number, string>>({});
  const [busyId, setBusyId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [managedUsers, setManagedUsers] = useState<ManagedUser[]>([]);

  const [requestForm, setRequestForm] = useState({
    requestType: 'STAFFING_INCREASE' as
      | 'STAFFING_INCREASE'
      | 'DEPARTMENT_TRANSFER'
      | 'NEW_REQUISITION',
    departmentId: userDepartmentId || departments[0]?.id || 0,
    employeeId: employees[0]?.id || 0,
    toDepartmentId: departments[1]?.id || departments[0]?.id || 0,
    title: '',
    justification: '',
    requestedTargetHeadcount: 10,
    requestedBudget: 210000000,
    requestedRoleTitle: '',
    requestedUrgency: 'High',
  });

  useEffect(() => {
    if (prefilledApprovalDeptId) {
      const dept = departments.find((d) => d.id === prefilledApprovalDeptId);
      setRequestForm((prev) => ({
        ...prev,
        requestType: 'STAFFING_INCREASE',
        departmentId: prefilledApprovalDeptId,
        requestedTargetHeadcount: (dept?.targetHeadcount || 5) + 2,
        requestedBudget: (dept?.allocatedBudget || 95000000) + 45000000,
        title: `Expand ${dept?.name || 'Department'} Target Headcount (+2 FTE)`,
      }));
      setSubTab('approvals');
      setShowRequestModal(true);
      onClearPrefilledApproval();
    }
  }, [prefilledApprovalDeptId, departments, onClearPrefilledApproval]);

  useEffect(() => {
    if (isCeo && subTab === 'access') {
      apiFetch<ManagedUser[]>('/api/users')
        .then(setManagedUsers)
        .catch((err) => setError(err.message));
    }
  }, [isCeo, subTab]);

  const handleCreateRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await apiFetch('/api/approvals', {
        method: 'POST',
        body: JSON.stringify(requestForm),
      });
      setShowRequestModal(false);
      setRequestForm((prev) => ({ ...prev, title: '', justification: '' }));
      onNotify('Submitted request to CEO approval queue.');
      await onRefresh();
    } catch (err: any) {
      setError(err.message || 'Failed to submit request.');
    }
  };

  const handleReview = async (id: number, decision: 'Approved' | 'Rejected') => {
    setBusyId(id);
    setError(null);
    try {
      await apiFetch(`/api/approvals/${id}/review`, {
        method: 'POST',
        body: JSON.stringify({
          decision,
          reviewerNotes: reviewNotes[id] || '',
        }),
      });
      onNotify(`Request ${decision.toLowerCase()} and recorded in audit trail.`);
      await onRefresh();
    } catch (err: any) {
      setError(err.message || 'Failed to process decision.');
    } finally {
      setBusyId(null);
    }
  };

  const handleRoleUpdate = async (
    userId: number,
    role: UserRole,
    departmentId: number | null
  ) => {
    setError(null);
    try {
      await apiFetch(`/api/users/${userId}/role`, {
        method: 'PATCH',
        body: JSON.stringify({ role, departmentId }),
      });
      const updated = await apiFetch<ManagedUser[]>('/api/users');
      setManagedUsers(updated);
      onNotify('Updated user access role.');
      await onRefresh();
    } catch (err: any) {
      setError(err.message || 'Failed to update role.');
    }
  };

  const filteredLogs = auditLogs.filter(
    (log) => actionFilter === 'ALL' || log.action === actionFilter
  );

  const pendingApprovals = approvals.filter((a) => a.status === 'Pending');
  const resolvedApprovals = approvals.filter((a) => a.status !== 'Pending');

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">
            CEO Approvals, Audit Trail &amp; Access Control
          </h2>
          <p className="text-xs text-slate-500 mt-0.5 tabular-nums">
            {pendingApprovals.length} pending requests · {auditLogs.length} recorded audit events
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 p-1 bg-slate-200/70 rounded-md">
            <button
              type="button"
              onClick={() => setSubTab('approvals')}
              className={`px-3 py-1.5 text-xs font-medium rounded transition-colors cursor-pointer whitespace-nowrap ${
                subTab === 'approvals'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Approvals ({pendingApprovals.length})
            </button>
            <button
              type="button"
              onClick={() => setSubTab('audit')}
              className={`px-3 py-1.5 text-xs font-medium rounded transition-colors cursor-pointer whitespace-nowrap ${
                subTab === 'audit'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Audit Log
            </button>
            {isCeo && (
              <button
                type="button"
                onClick={() => setSubTab('access')}
                className={`px-3 py-1.5 text-xs font-medium rounded transition-colors cursor-pointer whitespace-nowrap ${
                  subTab === 'access'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Role Access
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={() => {
              setError(null);
              setShowRequestModal(true);
            }}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Submit Request</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-md text-xs text-red-700">
          {error}
        </div>
      )}

      {subTab === 'approvals' && (
        <div className="space-y-6">
          <section className="space-y-3">
            <h3 className="text-xs font-semibold text-slate-700">
              Pending Decisions ({pendingApprovals.length})
            </h3>
            {pendingApprovals.length === 0 ? (
              <div className="bg-white border border-slate-200 rounded-lg p-8 text-center text-xs text-slate-500">
                All staffing and transfer requests have been reviewed.
              </div>
            ) : (
              <div className="space-y-3">
                {pendingApprovals.map((req) => (
                  <div
                    key={req.id}
                    className="bg-white border border-slate-200 rounded-lg p-5 space-y-3"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2 text-xs text-slate-500">
                          <span className="font-mono text-amber-700 font-medium">
                            {req.requestType.replace('_', ' ')}
                          </span>
                          <span aria-hidden="true">·</span>
                          <span>{req.departmentName}</span>
                          <span aria-hidden="true">·</span>
                          <span>Requested by {req.requesterName}</span>
                        </div>
                        <h4 className="text-sm font-semibold text-slate-900 mt-1">{req.title}</h4>
                      </div>
                      <span className="text-xs font-mono text-slate-500 shrink-0 tabular-nums">
                        {new Date(req.createdAt).toLocaleDateString()}
                      </span>
                    </div>

                    <p className="text-xs text-slate-600 leading-relaxed">{req.justification}</p>

                    <div className="text-xs text-slate-700 font-mono tabular-nums flex flex-wrap gap-4 pt-1">
                      {req.requestedTargetHeadcount !== null && (
                        <span>Proposed Target: {req.requestedTargetHeadcount} FTE</span>
                      )}
                      {req.requestedBudget !== null && (
                        <span>Proposed Budget: ₦{req.requestedBudget.toLocaleString()}</span>
                      )}
                      {req.employeeName && (
                        <span>
                          Employee: {req.employeeName} ({req.employeeCode}) → {req.toDepartmentName}
                        </span>
                      )}
                      {req.requestedRoleTitle && <span>Role: {req.requestedRoleTitle}</span>}
                    </div>

                    {isCeo ? (
                      <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                        <input
                          type="text"
                          placeholder="Optional executive decision note..."
                          value={reviewNotes[req.id] || ''}
                          onChange={(e) =>
                            setReviewNotes({ ...reviewNotes, [req.id]: e.target.value })
                          }
                          className="flex-1 px-3 py-1.5 text-xs border border-slate-300 rounded-md"
                        />
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            type="button"
                            disabled={busyId === req.id}
                            onClick={() => handleReview(req.id, 'Rejected')}
                            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-red-700 bg-white border border-red-200 hover:bg-red-50 rounded-md cursor-pointer disabled:opacity-50"
                          >
                            <X className="w-3.5 h-3.5" />
                            <span>Reject</span>
                          </button>
                          <button
                            type="button"
                            disabled={busyId === req.id}
                            onClick={() => handleReview(req.id, 'Approved')}
                            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-white bg-emerald-700 hover:bg-emerald-800 rounded-md cursor-pointer disabled:opacity-50"
                          >
                            <Check className="w-3.5 h-3.5" />
                            <span>Approve &amp; Apply</span>
                          </button>
                        </div>
                      </div>
                    ) : (
                      <p className="pt-2 border-t border-slate-100 text-xs text-amber-700 font-medium">
                        Awaiting CEO / Super Admin decision
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>

          {resolvedApprovals.length > 0 && (
            <section className="space-y-3">
              <h3 className="text-xs font-semibold text-slate-700">
                Decision History ({resolvedApprovals.length})
              </h3>
              <div className="bg-white border border-slate-200 rounded-lg divide-y divide-slate-100">
                {resolvedApprovals.map((req) => (
                  <div
                    key={req.id}
                    className="px-5 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                  >
                    <div>
                      <p className="font-medium text-slate-900">{req.title}</p>
                      <p className="text-slate-500 mt-0.5">
                        {req.departmentName} · Requested by {req.requesterName} · Reviewed by{' '}
                        {req.reviewerName || 'Executive'}
                        {req.reviewerNotes ? ` — "${req.reviewerNotes}"` : ''}
                      </p>
                    </div>
                    <span
                      className={`font-medium shrink-0 ${
                        req.status === 'Approved' ? 'text-emerald-700' : 'text-red-700'
                      }`}
                    >
                      {req.status}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      )}

      {subTab === 'audit' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <select
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
              className="px-3 py-1.5 text-xs border border-slate-200 rounded-md bg-white text-slate-700"
            >
              <option value="ALL">All Event Categories</option>
              <option value="CANDIDATE_HIRED">Candidate Hires</option>
              <option value="EMPLOYEE_TRANSFERRED">Department Transfers</option>
              <option value="EMPLOYEE_CREATED">Employee Additions</option>
              <option value="EMPLOYEE_UPDATED">Profile &amp; Onboarding Updates</option>
              <option value="DEPARTMENT_UPDATED">Department Plan Updates</option>
              <option value="REQUISITION_CREATED">Requisitions</option>
              <option value="REQUEST_APPROVED">Approved Requests</option>
              <option value="REQUEST_REJECTED">Rejected Requests</option>
              <option value="ROLE_UPDATED">RBAC Role Changes</option>
            </select>
            <span className="text-xs text-slate-500 tabular-nums">
              {filteredLogs.length} events
            </span>
          </div>

          <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/80 text-[11px] font-medium text-slate-500">
                    <th className="py-3 px-4">Timestamp</th>
                    <th className="py-3 px-4">Actor</th>
                    <th className="py-3 px-4">Action</th>
                    <th className="py-3 px-4">Summary</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {filteredLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50/70">
                      <td className="py-3 px-4 font-mono tabular-nums text-slate-500 whitespace-nowrap">
                        {new Date(log.createdAt).toLocaleString()}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <p className="font-medium text-slate-900">{log.actorName}</p>
                        <p className="text-[11px] text-slate-500">{log.actorRole}</p>
                      </td>
                      <td className="py-3 px-4 font-mono text-[11px] text-slate-700 whitespace-nowrap">
                        {log.action}
                      </td>
                      <td className="py-3 px-4">
                        <p className="text-slate-900">{log.summary}</p>
                        {log.details && (
                          <p className="text-[11px] text-slate-500 mt-0.5">{log.details}</p>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {subTab === 'access' && isCeo && (
        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-200 flex items-center gap-2">
            <Shield className="w-4 h-4 text-slate-700" />
            <h3 className="text-sm font-semibold text-slate-900">
              Registered Users &amp; Role Assignment
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/80 text-[11px] font-medium text-slate-500">
                  <th className="py-3 px-4">User</th>
                  <th className="py-3 px-4">Role</th>
                  <th className="py-3 px-4">Assigned Department</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {managedUsers.map((u) => (
                  <tr key={u.id}>
                    <td className="py-3 px-4">
                      <p className="font-medium text-slate-900">{u.name}</p>
                      <p className="text-[11px] text-slate-500">{u.email}</p>
                    </td>
                    <td className="py-3 px-4">
                      <select
                        value={u.role}
                        onChange={(e) => {
                          const newRole = e.target.value as UserRole;
                          const deptId =
                            newRole === 'DEPARTMENT_HEAD'
                              ? u.departmentId || departments[0]?.id || null
                              : null;
                          handleRoleUpdate(u.id, newRole, deptId);
                        }}
                        className="px-2.5 py-1 border border-slate-300 rounded bg-white text-xs"
                      >
                        <option value="CEO">CEO / Super Admin</option>
                        <option value="DEPARTMENT_HEAD">Department Head</option>
                      </select>
                    </td>
                    <td className="py-3 px-4">
                      {u.role === 'CEO' ? (
                        <span className="text-slate-500">All Departments (Organization-wide)</span>
                      ) : (
                        <select
                          value={u.departmentId || ''}
                          onChange={(e) =>
                            handleRoleUpdate(u.id, 'DEPARTMENT_HEAD', Number(e.target.value))
                          }
                          className="px-2.5 py-1 border border-slate-300 rounded bg-white text-xs"
                        >
                          {departments.map((d) => (
                            <option key={d.id} value={d.id}>
                              {d.name} ({d.code})
                            </option>
                          ))}
                        </select>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Submit Request Modal */}
      {showRequestModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-lg max-w-lg w-full p-6">
            <h3 className="text-base font-semibold text-slate-900">
              Submit Executive Approval Request
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Submit staffing target increases, department transfers, or new headcount requisitions for CEO review.
            </p>
            <form onSubmit={handleCreateRequest} className="mt-4 space-y-3.5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Request Type
                  </label>
                  <select
                    value={requestForm.requestType}
                    onChange={(e) =>
                      setRequestForm({
                        ...requestForm,
                        requestType: e.target.value as any,
                      })
                    }
                    className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-md bg-white"
                  >
                    <option value="STAFFING_INCREASE">Staffing / Budget Increase</option>
                    <option value="DEPARTMENT_TRANSFER">Department Transfer</option>
                    <option value="NEW_REQUISITION">New Requisition</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Department
                  </label>
                  <select
                    value={requestForm.departmentId}
                    disabled={!isCeo && Boolean(userDepartmentId)}
                    onChange={(e) =>
                      setRequestForm({ ...requestForm, departmentId: Number(e.target.value) })
                    }
                    className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-md bg-white disabled:bg-slate-50"
                  >
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name} ({d.code})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Request Summary Title
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Expand Core Engineering Target (+2 FTE)"
                  value={requestForm.title}
                  onChange={(e) => setRequestForm({ ...requestForm, title: e.target.value })}
                  className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-md"
                />
              </div>

              {requestForm.requestType === 'STAFFING_INCREASE' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Requested Target Headcount
                    </label>
                    <input
                      type="number"
                      min={1}
                      value={requestForm.requestedTargetHeadcount}
                      onChange={(e) =>
                        setRequestForm({
                          ...requestForm,
                          requestedTargetHeadcount: Number(e.target.value),
                        })
                      }
                      className="w-full px-3 py-1.5 text-sm font-mono border border-slate-300 rounded-md"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Requested Budget (NGN ₦)
                    </label>
                    <input
                      type="number"
                      min={0}
                      step={1000000}
                      value={requestForm.requestedBudget}
                      onChange={(e) =>
                        setRequestForm({
                          ...requestForm,
                          requestedBudget: Number(e.target.value),
                        })
                      }
                      className="w-full px-3 py-1.5 text-sm font-mono border border-slate-300 rounded-md"
                    />
                  </div>
                </div>
              )}

              {requestForm.requestType === 'DEPARTMENT_TRANSFER' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Employee
                    </label>
                    <select
                      value={requestForm.employeeId}
                      onChange={(e) =>
                        setRequestForm({ ...requestForm, employeeId: Number(e.target.value) })
                      }
                      className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-md bg-white"
                    >
                      {employees.map((emp) => (
                        <option key={emp.id} value={emp.id}>
                          {emp.name} ({emp.departmentCode})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Target Department
                    </label>
                    <select
                      value={requestForm.toDepartmentId}
                      onChange={(e) =>
                        setRequestForm({
                          ...requestForm,
                          toDepartmentId: Number(e.target.value),
                        })
                      }
                      className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-md bg-white"
                    >
                      {departments.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.name} ({d.code})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              {requestForm.requestType === 'NEW_REQUISITION' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Role Title
                    </label>
                    <input
                      type="text"
                      required
                      value={requestForm.requestedRoleTitle}
                      onChange={(e) =>
                        setRequestForm({ ...requestForm, requestedRoleTitle: e.target.value })
                      }
                      className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-md"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Urgency
                    </label>
                    <select
                      value={requestForm.requestedUrgency}
                      onChange={(e) =>
                        setRequestForm({ ...requestForm, requestedUrgency: e.target.value })
                      }
                      className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-md bg-white"
                    >
                      <option value="Critical">Critical</option>
                      <option value="High">High</option>
                      <option value="Normal">Normal</option>
                    </select>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Business Justification
                </label>
                <textarea
                  rows={3}
                  required
                  value={requestForm.justification}
                  onChange={(e) =>
                    setRequestForm({ ...requestForm, justification: e.target.value })
                  }
                  className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-md"
                />
              </div>

              <div className="pt-3 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowRequestModal(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-md cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-medium text-white bg-slate-900 hover:bg-slate-800 rounded-md cursor-pointer"
                >
                  Submit Request
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
