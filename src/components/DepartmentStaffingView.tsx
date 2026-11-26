import React, { useState } from 'react';
import { Plus, Pencil, UserPlus } from 'lucide-react';
import { apiFetch } from '../lib/api';
import { DepartmentWithStaffing, UserRole } from '../types';

interface DepartmentStaffingViewProps {
  departments: DepartmentWithStaffing[];
  userRole: UserRole;
  userDepartmentId: number | null;
  onRefresh: () => Promise<void>;
  onOpenRecruitmentForDept: (dept: DepartmentWithStaffing) => void;
  onRequestIncreaseForDept: (dept: DepartmentWithStaffing) => void;
  highlightedDeptId: number | null;
}

export const DepartmentStaffingView: React.FC<DepartmentStaffingViewProps> = ({
  departments,
  userRole,
  userDepartmentId,
  onRefresh,
  onOpenRecruitmentForDept,
  onRequestIncreaseForDept,
  highlightedDeptId,
}) => {
  const isCeo = userRole === 'CEO';
  const [editingDept, setEditingDept] = useState<DepartmentWithStaffing | null>(null);
  const [creatingDept, setCreatingDept] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formState, setFormState] = useState({
    name: '',
    code: '',
    leadName: '',
    description: '',
    targetHeadcount: 5,
    allocatedBudget: 95000000,
    priority: 'Normal',
    location: 'Victoria Island, Lagos',
  });

  const openCreateModal = () => {
    setFormState({
      name: '',
      code: '',
      leadName: '',
      description: '',
      targetHeadcount: 5,
      allocatedBudget: 95000000,
      priority: 'Normal',
      location: 'Victoria Island, Lagos',
    });
    setError(null);
    setCreatingDept(true);
  };

  const openEditModal = (dept: DepartmentWithStaffing) => {
    setFormState({
      name: dept.name,
      code: dept.code,
      leadName: dept.leadName,
      description: dept.description,
      targetHeadcount: dept.targetHeadcount,
      allocatedBudget: dept.allocatedBudget,
      priority: dept.priority,
      location: dept.location,
    });
    setError(null);
    setEditingDept(dept);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      if (creatingDept) {
        await apiFetch('/api/departments', {
          method: 'POST',
          body: JSON.stringify(formState),
        });
        setCreatingDept(false);
      } else if (editingDept) {
        await apiFetch(`/api/departments/${editingDept.id}`, {
          method: 'PATCH',
          body: JSON.stringify(formState),
        });
        setEditingDept(null);
      }
      await onRefresh();
    } catch (err: any) {
      setError(err.message || 'Failed to save department.');
    } finally {
      setSubmitting(false);
    }
  };

  const totalTarget = departments.reduce((s, d) => s + d.targetHeadcount, 0);
  const totalFilled = departments.reduce((s, d) => s + d.filledCount, 0);
  const totalGap = totalTarget - totalFilled;
  const totalBudget = departments.reduce((s, d) => s + d.allocatedBudget, 0);

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">
            Department Staffing &amp; Gap Tracker
          </h2>
          <p className="text-xs text-slate-500 mt-0.5 tabular-nums">
            {departments.length} departments · {totalFilled} filled / {totalTarget} approved target ·{' '}
            {totalGap} total gap · ₦{(totalBudget / 1_000_000_000).toFixed(2)}B total budget
          </p>
        </div>

        {isCeo && (
          <button
            type="button"
            onClick={openCreateModal}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Department</span>
          </button>
        )}
      </div>

      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/80 text-[11px] font-medium text-slate-500">
                <th className="py-3 px-4">Department</th>
                <th className="py-3 px-4">Lead</th>
                <th className="py-3 px-4 text-right">Target</th>
                <th className="py-3 px-4 text-right">Filled</th>
                <th className="py-3 px-4 text-right">Gap</th>
                <th className="py-3 px-4 text-right">Budget</th>
                <th className="py-3 px-4">Priority</th>
                <th className="py-3 px-4 text-right">Open Reqs</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {departments.map((dept) => {
                const canManageDept = isCeo || userDepartmentId === dept.id;
                const isHighlighted = highlightedDeptId === dept.id;
                return (
                  <tr
                    key={dept.id}
                    className={`hover:bg-slate-50/70 transition-colors ${
                      isHighlighted ? 'bg-blue-50/50' : ''
                    }`}
                  >
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs text-slate-400">{dept.code}</span>
                        <span className="font-medium text-slate-900">{dept.name}</span>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">{dept.location}</p>
                    </td>
                    <td className="py-3.5 px-4 text-xs text-slate-700 whitespace-nowrap">
                      {dept.leadName}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono tabular-nums text-slate-700">
                      {dept.targetHeadcount}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono tabular-nums font-medium text-slate-900">
                      {dept.filledCount}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono tabular-nums">
                      <span
                        className={
                          dept.gap > 0
                            ? dept.priority === 'Critical'
                              ? 'text-red-700 font-semibold'
                              : 'text-amber-700 font-medium'
                            : 'text-emerald-700 font-medium'
                        }
                      >
                        {dept.gap > 0 ? `-${dept.gap}` : '0'}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono tabular-nums text-xs text-slate-700">
                      ₦{dept.allocatedBudget.toLocaleString()}
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <span
                        className={`text-xs font-medium ${
                          dept.priority === 'Critical'
                            ? 'text-red-700'
                            : dept.priority === 'High'
                            ? 'text-amber-700'
                            : 'text-emerald-700'
                        }`}
                      >
                        {dept.priority}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono tabular-nums text-xs text-slate-700">
                      {dept.openRequisitionsCount}
                    </td>
                    <td className="py-3.5 px-4 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-2">
                        {canManageDept && (
                          <button
                            type="button"
                            onClick={() => onOpenRecruitmentForDept(dept)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-900 bg-white border border-slate-300 hover:bg-slate-50 rounded-md transition-colors cursor-pointer whitespace-nowrap"
                          >
                            <UserPlus className="w-3.5 h-3.5" />
                            <span>Open Recruitment</span>
                          </button>
                        )}
                        {isCeo ? (
                          <button
                            type="button"
                            onClick={() => openEditModal(dept)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 border border-slate-200 hover:border-slate-300 rounded-md transition-colors cursor-pointer whitespace-nowrap"
                          >
                            <Pencil className="w-3 h-3" />
                            <span>Edit</span>
                          </button>
                        ) : (
                          userDepartmentId === dept.id && (
                            <button
                              type="button"
                              onClick={() => onRequestIncreaseForDept(dept)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-blue-700 hover:text-blue-800 border border-blue-200 hover:bg-blue-50 rounded-md transition-colors cursor-pointer whitespace-nowrap"
                            >
                              <span>Request Target Change</span>
                            </button>
                          )
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create / Edit Department Modal (CEO) */}
      {(creatingDept || editingDept) && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-lg max-w-lg w-full p-6">
            <h3 className="text-base font-semibold text-slate-900">
              {creatingDept ? 'Create Department' : `Edit ${editingDept?.name}`}
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Changes to target headcount and budget are recorded in the executive audit log.
            </p>

            {error && (
              <div className="mt-3 p-2.5 bg-red-50 border border-red-200 rounded text-xs text-red-700">
                {error}
              </div>
            )}

            <form onSubmit={handleSave} className="mt-4 space-y-3.5">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Department Name
                  </label>
                  <input
                    type="text"
                    required
                    value={formState.name}
                    onChange={(e) => setFormState({ ...formState, name: e.target.value })}
                    className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-md focus:outline-none focus:border-slate-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Code</label>
                  <input
                    type="text"
                    required
                    disabled={!creatingDept}
                    maxLength={6}
                    value={formState.code}
                    onChange={(e) =>
                      setFormState({ ...formState, code: e.target.value.toUpperCase() })
                    }
                    className="w-full px-3 py-1.5 text-sm font-mono uppercase border border-slate-300 rounded-md disabled:bg-slate-100 focus:outline-none focus:border-slate-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Department Lead
                  </label>
                  <input
                    type="text"
                    required
                    value={formState.leadName}
                    onChange={(e) => setFormState({ ...formState, leadName: e.target.value })}
                    className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-md focus:outline-none focus:border-slate-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Location</label>
                  <input
                    type="text"
                    required
                    value={formState.location}
                    onChange={(e) => setFormState({ ...formState, location: e.target.value })}
                    className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-md focus:outline-none focus:border-slate-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Target Headcount
                  </label>
                  <input
                    type="number"
                    min={0}
                    required
                    value={formState.targetHeadcount}
                    onChange={(e) =>
                      setFormState({ ...formState, targetHeadcount: Number(e.target.value) })
                    }
                    className="w-full px-3 py-1.5 text-sm font-mono border border-slate-300 rounded-md focus:outline-none focus:border-slate-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Budget (NGN ₦)
                  </label>
                  <input
                    type="number"
                    min={0}
                    step={1000000}
                    required
                    value={formState.allocatedBudget}
                    onChange={(e) =>
                      setFormState({ ...formState, allocatedBudget: Number(e.target.value) })
                    }
                    className="w-full px-3 py-1.5 text-sm font-mono border border-slate-300 rounded-md focus:outline-none focus:border-slate-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Priority</label>
                  <select
                    value={formState.priority}
                    onChange={(e) => setFormState({ ...formState, priority: e.target.value })}
                    className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-md bg-white focus:outline-none focus:border-slate-500"
                  >
                    <option value="Critical">Critical</option>
                    <option value="High">High</option>
                    <option value="Normal">Normal</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Charter / Description
                </label>
                <textarea
                  rows={2}
                  value={formState.description}
                  onChange={(e) => setFormState({ ...formState, description: e.target.value })}
                  className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-md focus:outline-none focus:border-slate-500"
                />
              </div>

              <div className="pt-3 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setCreatingDept(false);
                    setEditingDept(null);
                  }}
                  className="px-4 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-md cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 text-xs font-medium text-white bg-slate-900 hover:bg-slate-800 rounded-md disabled:opacity-50 cursor-pointer"
                >
                  {submitting ? 'Saving...' : creatingDept ? 'Create Department' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
