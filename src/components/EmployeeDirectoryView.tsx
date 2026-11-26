import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowRightLeft,
  CheckSquare,
  Download,
  Plus,
  Search,
  Square,
  Trash2,
  X,
} from 'lucide-react';
import { auth } from '../lib/firebase';
import { apiFetch } from '../lib/api';
import { DepartmentWithStaffing, Employee, UserRole } from '../types';

interface EmployeeDirectoryViewProps {
  employees: Employee[];
  departments: DepartmentWithStaffing[];
  userRole: UserRole;
  userDepartmentId: number | null;
  onRefresh: () => Promise<void>;
  onNotify: (message: string) => void;
  selectedEmployeeId: number | null;
  onSelectEmployeeId: (id: number | null) => void;
}

export const EmployeeDirectoryView: React.FC<EmployeeDirectoryViewProps> = ({
  employees,
  departments,
  userRole,
  userDepartmentId,
  onRefresh,
  onNotify,
  selectedEmployeeId,
  onSelectEmployeeId,
}) => {
  const isCeo = userRole === 'CEO';
  const [searchTerm, setSearchTerm] = useState('');
  const [deptFilter, setDeptFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [typeFilter, setTypeFilter] = useState<string>('ALL');

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const selectedEmployee = useMemo(
    () => employees.find((e) => e.id === selectedEmployeeId) || null,
    [employees, selectedEmployeeId]
  );

  const manageableDepts = useMemo(
    () => (isCeo ? departments : departments.filter((d) => d.id === userDepartmentId)),
    [departments, isCeo, userDepartmentId]
  );

  const [createForm, setCreateForm] = useState({
    name: '',
    email: '',
    role: '',
    departmentId: manageableDepts[0]?.id || departments[0]?.id || 0,
    managerName: manageableDepts[0]?.leadName || '',
    startDate: new Date().toISOString().slice(0, 10),
    employmentType: 'Full-Time',
    status: 'Onboarding',
    compensationBand: 'L5 · ₦18.5M–₦24.0M',
    location: 'Abuja, FCT',
  });

  const [exportingCsv, setExportingCsv] = useState(false);

  const [editForm, setEditForm] = useState({
    name: '',
    email: '',
    role: '',
    managerName: '',
    startDate: '',
    employmentType: 'Full-Time',
    status: 'Active',
    compensationBand: '',
    location: '',
  });

  const [transferForm, setTransferForm] = useState({
    toDepartmentId: 0,
    newRole: '',
    newManager: '',
    justification: '',
  });

  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskCategory, setNewTaskCategory] = useState('Orientation');
  const [newTaskDue, setNewTaskDue] = useState(new Date().toISOString().slice(0, 10));

  useEffect(() => {
    if (selectedEmployee) {
      setEditForm({
        name: selectedEmployee.name,
        email: selectedEmployee.email,
        role: selectedEmployee.role,
        managerName: selectedEmployee.managerName,
        startDate: selectedEmployee.startDate,
        employmentType: selectedEmployee.employmentType,
        status: selectedEmployee.status,
        compensationBand: selectedEmployee.compensationBand,
        location: selectedEmployee.location,
      });
      const otherDept = departments.find((d) => d.id !== selectedEmployee.departmentId);
      setTransferForm({
        toDepartmentId: otherDept?.id || selectedEmployee.departmentId,
        newRole: selectedEmployee.role,
        newManager: otherDept?.leadName || '',
        justification: '',
      });
      setConfirmDelete(false);
      setError(null);
    }
  }, [selectedEmployee, departments]);

  const filteredEmployees = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return employees.filter((emp) => {
      if (deptFilter !== 'ALL' && emp.departmentId !== Number(deptFilter)) return false;
      if (statusFilter !== 'ALL' && emp.status !== statusFilter) return false;
      if (typeFilter !== 'ALL' && emp.employmentType !== typeFilter) return false;
      if (q) {
        const hay = `${emp.name} ${emp.email} ${emp.role} ${emp.employeeCode} ${emp.departmentName} ${emp.location}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [employees, deptFilter, statusFilter, typeFilter, searchTerm]);

  const canManageEmployee = (emp: Employee) =>
    isCeo || emp.departmentId === userDepartmentId;

  const handleCreateEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await apiFetch('/api/employees', {
        method: 'POST',
        body: JSON.stringify(createForm),
      });
      setShowCreateModal(false);
      onNotify(`Added ${createForm.name} to directory and updated department headcount.`);
      setCreateForm((prev) => ({ ...prev, name: '', email: '', role: '' }));
      await onRefresh();
    } catch (err: any) {
      setError(err.message || 'Failed to add employee.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEmployee) return;
    setSubmitting(true);
    setError(null);
    try {
      await apiFetch(`/api/employees/${selectedEmployee.id}`, {
        method: 'PATCH',
        body: JSON.stringify(editForm),
      });
      onNotify(`Updated profile for ${editForm.name}.`);
      await onRefresh();
    } catch (err: any) {
      setError(err.message || 'Failed to update profile.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDepartmentTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEmployee) return;
    setSubmitting(true);
    setError(null);
    try {
      if (isCeo) {
        await apiFetch(`/api/employees/${selectedEmployee.id}/transfer`, {
          method: 'POST',
          body: JSON.stringify({
            toDepartmentId: transferForm.toDepartmentId,
            newRole: transferForm.newRole,
            newManager: transferForm.newManager,
          }),
        });
        const targetDept = departments.find((d) => d.id === transferForm.toDepartmentId);
        onNotify(
          `Transferred ${selectedEmployee.name} to ${targetDept?.name || 'new department'}. Headcounts recalculated.`
        );
      } else {
        const targetDept = departments.find((d) => d.id === transferForm.toDepartmentId);
        await apiFetch('/api/approvals', {
          method: 'POST',
          body: JSON.stringify({
            requestType: 'DEPARTMENT_TRANSFER',
            departmentId: selectedEmployee.departmentId,
            employeeId: selectedEmployee.id,
            toDepartmentId: transferForm.toDepartmentId,
            title: `Transfer ${selectedEmployee.name} to ${targetDept?.name || 'Department'}`,
            justification:
              transferForm.justification ||
              `Department Head requested transfer to ${targetDept?.name}.`,
            requestedRoleTitle: transferForm.newRole,
          }),
        });
        onNotify(
          `Submitted transfer request for ${selectedEmployee.name} to CEO Approvals queue.`
        );
      }
      await onRefresh();
    } catch (err: any) {
      setError(err.message || 'Transfer failed.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteEmployee = async () => {
    if (!selectedEmployee) return;
    setSubmitting(true);
    try {
      await apiFetch(`/api/employees/${selectedEmployee.id}`, { method: 'DELETE' });
      onSelectEmployeeId(null);
      onNotify(`Removed ${selectedEmployee.name} from directory.`);
      await onRefresh();
    } catch (err: any) {
      setError(err.message || 'Failed to remove employee.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleTask = async (taskId: number, completed: boolean) => {
    try {
      await apiFetch(`/api/onboarding/${taskId}`, {
        method: 'PATCH',
        body: JSON.stringify({ completed }),
      });
      await onRefresh();
    } catch (err: any) {
      setError(err.message || 'Failed to update task.');
    }
  };

  const handleAddOnboardingTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEmployee || !newTaskTitle.trim()) return;
    try {
      await apiFetch(`/api/employees/${selectedEmployee.id}/onboarding`, {
        method: 'POST',
        body: JSON.stringify({
          title: newTaskTitle,
          category: newTaskCategory,
          dueDate: newTaskDue,
        }),
      });
      setNewTaskTitle('');
      await onRefresh();
    } catch (err: any) {
      setError(err.message || 'Failed to add onboarding task.');
    }
  };

  const handleActivateEmployee = async () => {
    if (!selectedEmployee) return;
    try {
      await apiFetch(`/api/employees/${selectedEmployee.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'Active' }),
      });
      onNotify(`${selectedEmployee.name} marked Active.`);
      await onRefresh();
    } catch (err: any) {
      setError(err.message || 'Failed to update status.');
    }
  };

  const handleExportPayrollCsv = async () => {
    if (!auth.currentUser) return;
    setExportingCsv(true);
    setError(null);
    try {
      const token = await auth.currentUser.getIdToken();
      const params = new URLSearchParams();
      if (deptFilter !== 'ALL') params.set('departmentId', deptFilter);
      if (statusFilter !== 'ALL') params.set('status', statusFilter);
      if (typeFilter !== 'ALL') params.set('employmentType', typeFilter);
      if (searchTerm.trim()) params.set('q', searchTerm.trim());

      const response = await fetch(`/api/employees/export?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to export payroll CSV.');
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `meridian-global-payroll-reconciliation-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      onNotify(
        `Exported ${filteredEmployees.length} employee record${
          filteredEmployees.length === 1 ? '' : 's'
        } to CSV for payroll reconciliation.`
      );
      await onRefresh();
    } catch (err: any) {
      setError(err.message || 'CSV export failed.');
    } finally {
      setExportingCsv(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">
            Employee Directory &amp; Org Management
          </h2>
          <p className="text-xs text-slate-500 mt-0.5 tabular-nums">
            Showing {filteredEmployees.length} of {employees.length} team members · Click any row to
            edit profile, transfer department, or manage onboarding checklist
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {isCeo && (
            <button
              type="button"
              disabled={exportingCsv || filteredEmployees.length === 0}
              onClick={handleExportPayrollCsv}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-300 hover:bg-slate-50 disabled:opacity-50 text-slate-900 text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap"
            >
              <Download className="w-3.5 h-3.5" />
              <span>{exportingCsv ? 'Exporting...' : 'Export Payroll CSV'}</span>
            </button>
          )}

          {manageableDepts.length > 0 && (
            <button
              type="button"
              onClick={() => {
                setCreateForm((prev) => ({
                  ...prev,
                  departmentId: manageableDepts[0].id,
                  managerName: manageableDepts[0].leadName,
                }));
                setError(null);
                setShowCreateModal(true);
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Employee</span>
            </button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white border border-slate-200 rounded-lg p-3 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Filter by name, code, role, email, or location..."
            className="w-full pl-8 pr-3 py-1.5 text-xs border border-slate-200 rounded-md focus:outline-none focus:border-slate-400"
          />
        </div>

        <select
          value={deptFilter}
          onChange={(e) => setDeptFilter(e.target.value)}
          className="px-2.5 py-1.5 text-xs border border-slate-200 rounded-md bg-white text-slate-700"
        >
          <option value="ALL">All Departments</option>
          {departments.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name} ({d.code})
            </option>
          ))}
        </select>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-2.5 py-1.5 text-xs border border-slate-200 rounded-md bg-white text-slate-700"
        >
          <option value="ALL">All Statuses</option>
          <option value="Active">Active</option>
          <option value="Onboarding">Onboarding</option>
          <option value="On Leave">On Leave</option>
        </select>

        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="px-2.5 py-1.5 text-xs border border-slate-200 rounded-md bg-white text-slate-700"
        >
          <option value="ALL">All Types</option>
          <option value="Full-Time">Full-Time</option>
          <option value="Part-Time">Part-Time</option>
          <option value="Contract">Contract</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/80 text-[11px] font-medium text-slate-500">
                <th className="py-3 px-4">ID</th>
                <th className="py-3 px-4">Employee</th>
                <th className="py-3 px-4">Role &amp; Manager</th>
                <th className="py-3 px-4">Department</th>
                <th className="py-3 px-4">Type &amp; Location</th>
                <th className="py-3 px-4">Comp Band</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Onboarding</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {filteredEmployees.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-10 text-center text-slate-500">
                    No employees match the selected filters.
                  </td>
                </tr>
              ) : (
                filteredEmployees.map((emp) => (
                  <tr
                    key={emp.id}
                    onClick={() => onSelectEmployeeId(emp.id)}
                    className={`cursor-pointer transition-colors ${
                      selectedEmployeeId === emp.id ? 'bg-blue-50/60' : 'hover:bg-slate-50/80'
                    }`}
                  >
                    <td className="py-3 px-4 font-mono text-slate-500 whitespace-nowrap">
                      {emp.employeeCode}
                    </td>
                    <td className="py-3 px-4">
                      <p className="text-sm font-medium text-slate-900">{emp.name}</p>
                      <p className="text-[11px] text-slate-500">{emp.email}</p>
                    </td>
                    <td className="py-3 px-4">
                      <p className="font-medium text-slate-800">{emp.role}</p>
                      <p className="text-[11px] text-slate-500">Mgr: {emp.managerName}</p>
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span className="font-medium text-slate-800">{emp.departmentName}</span>
                      <span className="ml-1.5 font-mono text-[11px] text-slate-400">
                        {emp.departmentCode}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-600 whitespace-nowrap">
                      {emp.employmentType} · {emp.location}
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-700 whitespace-nowrap">
                      {emp.compensationBand}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span
                        className={`font-medium ${
                          emp.status === 'Active'
                            ? 'text-emerald-700'
                            : emp.status === 'Onboarding'
                            ? 'text-amber-700'
                            : 'text-slate-600'
                        }`}
                      >
                        {emp.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-600 whitespace-nowrap">
                      {emp.onboardingTotalCount > 0
                        ? `${emp.onboardingCompletedCount}/${emp.onboardingTotalCount}`
                        : '—'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Employee Profile, Transfer & Onboarding Slide-Over Drawer */}
      {selectedEmployee && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 flex justify-end">
          <div className="bg-white w-full max-w-xl h-full overflow-y-auto border-l border-slate-200 p-6 space-y-6">
            <div className="flex items-start justify-between gap-4 pb-4 border-b border-slate-200">
              <div>
                <p className="text-xs font-mono text-slate-500">
                  {selectedEmployee.employeeCode} · {selectedEmployee.departmentName}
                </p>
                <h3 className="text-lg font-semibold text-slate-900 mt-0.5">
                  {selectedEmployee.name}
                </h3>
                <p className="text-xs text-slate-500">{selectedEmployee.email}</p>
              </div>
              <button
                type="button"
                onClick={() => onSelectEmployeeId(null)}
                aria-label="Close employee details"
                className="p-1.5 text-slate-400 hover:text-slate-800 rounded-md cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {error && (
              <div className="p-2.5 bg-red-50 border border-red-200 rounded text-xs text-red-700">
                {error}
              </div>
            )}

            {/* Profile Form */}
            <form onSubmit={handleUpdateEmployee} className="space-y-3">
              <h4 className="text-xs font-semibold text-slate-800">Profile &amp; Role Details</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-medium text-slate-600 mb-1">
                    Full Name
                  </label>
                  <input
                    type="text"
                    disabled={!canManageEmployee(selectedEmployee)}
                    value={editForm.name}
                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                    className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-md disabled:bg-slate-50"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-slate-600 mb-1">
                    Email
                  </label>
                  <input
                    type="email"
                    disabled={!canManageEmployee(selectedEmployee)}
                    value={editForm.email}
                    onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                    className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-md disabled:bg-slate-50"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-slate-600 mb-1">Role</label>
                  <input
                    type="text"
                    disabled={!canManageEmployee(selectedEmployee)}
                    value={editForm.role}
                    onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}
                    className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-md disabled:bg-slate-50"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-slate-600 mb-1">
                    Manager
                  </label>
                  <input
                    type="text"
                    disabled={!canManageEmployee(selectedEmployee)}
                    value={editForm.managerName}
                    onChange={(e) => setEditForm({ ...editForm, managerName: e.target.value })}
                    className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-md disabled:bg-slate-50"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-slate-600 mb-1">
                    Status
                  </label>
                  <select
                    disabled={!canManageEmployee(selectedEmployee)}
                    value={editForm.status}
                    onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
                    className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-md bg-white disabled:bg-slate-50"
                  >
                    <option value="Active">Active</option>
                    <option value="Onboarding">Onboarding</option>
                    <option value="On Leave">On Leave</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-slate-600 mb-1">
                    Employment Type
                  </label>
                  <select
                    disabled={!canManageEmployee(selectedEmployee)}
                    value={editForm.employmentType}
                    onChange={(e) =>
                      setEditForm({ ...editForm, employmentType: e.target.value })
                    }
                    className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-md bg-white disabled:bg-slate-50"
                  >
                    <option value="Full-Time">Full-Time</option>
                    <option value="Part-Time">Part-Time</option>
                    <option value="Contract">Contract</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-slate-600 mb-1">
                    Compensation Band
                  </label>
                  <input
                    type="text"
                    disabled={!canManageEmployee(selectedEmployee)}
                    value={editForm.compensationBand}
                    onChange={(e) =>
                      setEditForm({ ...editForm, compensationBand: e.target.value })
                    }
                    className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-md disabled:bg-slate-50"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-slate-600 mb-1">
                    Location
                  </label>
                  <input
                    type="text"
                    disabled={!canManageEmployee(selectedEmployee)}
                    value={editForm.location}
                    onChange={(e) => setEditForm({ ...editForm, location: e.target.value })}
                    className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-md disabled:bg-slate-50"
                  />
                </div>
              </div>

              {canManageEmployee(selectedEmployee) && (
                <div className="flex items-center justify-between pt-2">
                  {isCeo ? (
                    !confirmDelete ? (
                      <button
                        type="button"
                        onClick={() => setConfirmDelete(true)}
                        className="inline-flex items-center gap-1 text-xs text-red-700 hover:underline cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Remove Employee</span>
                      </button>
                    ) : (
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={handleDeleteEmployee}
                          className="px-2.5 py-1 text-xs font-medium bg-red-700 text-white rounded cursor-pointer"
                        >
                          Confirm Remove
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDelete(false)}
                          className="text-xs text-slate-500 cursor-pointer"
                        >
                          Cancel
                        </button>
                      </div>
                    )
                  ) : (
                    <span />
                  )}
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-3.5 py-1.5 text-xs font-medium bg-slate-900 hover:bg-slate-800 text-white rounded-md cursor-pointer disabled:opacity-50"
                  >
                    {submitting ? 'Saving...' : 'Save Profile'}
                  </button>
                </div>
              )}
            </form>

            {/* Department Transfer Section */}
            <form
              onSubmit={handleDepartmentTransfer}
              className="pt-5 border-t border-slate-200 space-y-3"
            >
              <div className="flex items-center gap-2">
                <ArrowRightLeft className="w-3.5 h-3.5 text-slate-600" />
                <h4 className="text-xs font-semibold text-slate-800">
                  {isCeo ? 'Instant Department Transfer' : 'Request Department Transfer'}
                </h4>
              </div>
              <p className="text-[11px] text-slate-500">
                {isCeo
                  ? 'Moves employee immediately and recalculates both source and destination department headcounts.'
                  : 'Submits a transfer request to the CEO Approvals queue.'}
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-medium text-slate-600 mb-1">
                    Destination Department
                  </label>
                  <select
                    value={transferForm.toDepartmentId}
                    onChange={(e) => {
                      const id = Number(e.target.value);
                      const dept = departments.find((d) => d.id === id);
                      setTransferForm({
                        ...transferForm,
                        toDepartmentId: id,
                        newManager: dept?.leadName || transferForm.newManager,
                      });
                    }}
                    className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-md bg-white"
                  >
                    {departments
                      .filter((d) => d.id !== selectedEmployee.departmentId)
                      .map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.name} ({d.code})
                        </option>
                      ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-slate-600 mb-1">
                    Updated Role Title
                  </label>
                  <input
                    type="text"
                    value={transferForm.newRole}
                    onChange={(e) =>
                      setTransferForm({ ...transferForm, newRole: e.target.value })
                    }
                    className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-md"
                  />
                </div>
              </div>

              {!isCeo && (
                <div>
                  <label className="block text-[11px] font-medium text-slate-600 mb-1">
                    Transfer Justification
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Reason for cross-department transfer..."
                    value={transferForm.justification}
                    onChange={(e) =>
                      setTransferForm({ ...transferForm, justification: e.target.value })
                    }
                    className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-md"
                  />
                </div>
              )}

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-3.5 py-1.5 text-xs font-medium bg-white border border-slate-300 hover:bg-slate-50 text-slate-900 rounded-md cursor-pointer"
                >
                  {isCeo ? 'Execute Instant Transfer' : 'Submit Transfer for Approval'}
                </button>
              </div>
            </form>

            {/* Onboarding Checklist */}
            <div className="pt-5 border-t border-slate-200 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-semibold text-slate-800">
                  Onboarding Checklist ({selectedEmployee.onboardingCompletedCount}/
                  {selectedEmployee.onboardingTotalCount})
                </h4>
                {selectedEmployee.status === 'Onboarding' &&
                  canManageEmployee(selectedEmployee) && (
                    <button
                      type="button"
                      onClick={handleActivateEmployee}
                      className="text-xs font-medium text-emerald-700 hover:underline cursor-pointer"
                    >
                      Mark Employee Active
                    </button>
                  )}
              </div>

              {selectedEmployee.onboardingTasks.length === 0 ? (
                <p className="text-xs text-slate-500">
                  No onboarding tasks assigned for this team member.
                </p>
              ) : (
                <div className="divide-y divide-slate-100 border border-slate-200 rounded-md">
                  {selectedEmployee.onboardingTasks.map((task) => (
                    <button
                      key={task.id}
                      type="button"
                      disabled={!canManageEmployee(selectedEmployee)}
                      onClick={() => handleToggleTask(task.id, !task.completed)}
                      className="w-full text-left px-3 py-2.5 flex items-start gap-2.5 hover:bg-slate-50 transition-colors cursor-pointer disabled:cursor-default"
                    >
                      {task.completed ? (
                        <CheckSquare className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
                      ) : (
                        <Square className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
                      )}
                      <div className="min-w-0 flex-1">
                        <p
                          className={`text-xs font-medium ${
                            task.completed ? 'line-through text-slate-400' : 'text-slate-800'
                          }`}
                        >
                          {task.title}
                        </p>
                        <p className="text-[11px] text-slate-500 font-mono mt-0.5">
                          {task.category} · Due {task.dueDate}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {canManageEmployee(selectedEmployee) && (
                <form onSubmit={handleAddOnboardingTask} className="flex items-center gap-2 pt-1">
                  <input
                    type="text"
                    placeholder="Add custom onboarding task..."
                    value={newTaskTitle}
                    onChange={(e) => setNewTaskTitle(e.target.value)}
                    className="flex-1 px-2.5 py-1.5 text-xs border border-slate-300 rounded-md"
                  />
                  <input
                    type="date"
                    value={newTaskDue}
                    onChange={(e) => setNewTaskDue(e.target.value)}
                    className="px-2 py-1.5 text-xs font-mono border border-slate-300 rounded-md"
                  />
                  <button
                    type="submit"
                    className="px-3 py-1.5 text-xs font-medium bg-slate-900 text-white rounded-md cursor-pointer whitespace-nowrap"
                  >
                    Add Task
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Create Employee Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-lg max-w-lg w-full p-6">
            <h3 className="text-base font-semibold text-slate-900">Add Employee Record</h3>
            <p className="text-xs text-slate-500 mt-1">
              Setting status to Onboarding automatically generates a 5-step onboarding checklist.
            </p>
            {error && (
              <div className="mt-3 p-2.5 bg-red-50 border border-red-200 rounded text-xs text-red-700">
                {error}
              </div>
            )}
            <form onSubmit={handleCreateEmployee} className="mt-4 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Full Name</label>
                  <input
                    type="text"
                    required
                    value={createForm.name}
                    onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                    className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-md"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Work Email</label>
                  <input
                    type="email"
                    required
                    value={createForm.email}
                    onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
                    className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-md"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Department
                  </label>
                  <select
                    value={createForm.departmentId}
                    onChange={(e) => {
                      const id = Number(e.target.value);
                      const dept = departments.find((d) => d.id === id);
                      setCreateForm({
                        ...createForm,
                        departmentId: id,
                        managerName: dept?.leadName || createForm.managerName,
                      });
                    }}
                    className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-md bg-white"
                  >
                    {manageableDepts.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name} ({d.code})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Role</label>
                  <input
                    type="text"
                    required
                    value={createForm.role}
                    onChange={(e) => setCreateForm({ ...createForm, role: e.target.value })}
                    className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-md"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Status</label>
                  <select
                    value={createForm.status}
                    onChange={(e) => setCreateForm({ ...createForm, status: e.target.value })}
                    className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-md bg-white"
                  >
                    <option value="Onboarding">Onboarding</option>
                    <option value="Active">Active</option>
                    <option value="On Leave">On Leave</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Type</label>
                  <select
                    value={createForm.employmentType}
                    onChange={(e) =>
                      setCreateForm({ ...createForm, employmentType: e.target.value })
                    }
                    className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-md bg-white"
                  >
                    <option value="Full-Time">Full-Time</option>
                    <option value="Part-Time">Part-Time</option>
                    <option value="Contract">Contract</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Start Date
                  </label>
                  <input
                    type="date"
                    required
                    value={createForm.startDate}
                    onChange={(e) => setCreateForm({ ...createForm, startDate: e.target.value })}
                    className="w-full px-3 py-1.5 text-sm font-mono border border-slate-300 rounded-md"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Compensation Band
                  </label>
                  <input
                    type="text"
                    required
                    value={createForm.compensationBand}
                    onChange={(e) =>
                      setCreateForm({ ...createForm, compensationBand: e.target.value })
                    }
                    className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-md"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Location</label>
                  <input
                    type="text"
                    required
                    value={createForm.location}
                    onChange={(e) => setCreateForm({ ...createForm, location: e.target.value })}
                    className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-md"
                  />
                </div>
              </div>

              <div className="pt-3 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-md cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 text-xs font-medium text-white bg-slate-900 hover:bg-slate-800 rounded-md disabled:opacity-50 cursor-pointer"
                >
                  {submitting ? 'Creating...' : 'Create Employee'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
