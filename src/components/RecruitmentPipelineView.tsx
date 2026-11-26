import React, { useMemo, useState } from 'react';
import {
  ArrowRight,
  Check,
  CheckCircle2,
  Copy,
  Globe,
  Plus,
  Share2,
  UserPlus,
} from 'lucide-react';
import { apiFetch } from '../lib/api';
import {
  Candidate,
  DepartmentWithStaffing,
  JobRequisition,
  PipelineStage,
  UserRole,
} from '../types';

interface RecruitmentPipelineViewProps {
  requisitions: JobRequisition[];
  candidates: Candidate[];
  departments: DepartmentWithStaffing[];
  userRole: UserRole;
  userDepartmentId: number | null;
  onRefresh: () => Promise<void>;
  onNotify: (message: string) => void;
  prefilledDeptId: number | null;
  onClearPrefilledDept: () => void;
  selectedReqId: number | null;
  onSelectReqId: (id: number | null) => void;
  onOpenCareersPortal: () => void;
}

const STAGES: PipelineStage[] = ['Applied', 'Screening', 'Interview', 'Offer', 'Hired'];
const SOCIAL_CHANNELS = ['LinkedIn', 'X', 'WhatsApp', 'Instagram'];

function getNextStage(current: PipelineStage): PipelineStage | null {
  const idx = STAGES.indexOf(current);
  if (idx === -1 || idx >= STAGES.length - 1) return null;
  return STAGES[idx + 1];
}

export const RecruitmentPipelineView: React.FC<RecruitmentPipelineViewProps> = ({
  requisitions,
  candidates,
  departments,
  userRole,
  userDepartmentId,
  onRefresh,
  onNotify,
  prefilledDeptId,
  onClearPrefilledDept,
  selectedReqId,
  onSelectReqId,
  onOpenCareersPortal,
}) => {
  const isCeo = userRole === 'CEO';
  const [showNewReqModal, setShowNewReqModal] = useState(Boolean(prefilledDeptId));
  const [showNewCandidateModal, setShowNewCandidateModal] = useState(false);
  const [broadcastReq, setBroadcastReq] = useState<JobRequisition | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [busyCandidateId, setBusyCandidateId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const manageableDepartments = useMemo(
    () => (isCeo ? departments : departments.filter((d) => d.id === userDepartmentId)),
    [departments, isCeo, userDepartmentId]
  );

  const [reqForm, setReqForm] = useState(() => {
    const initialDept =
      departments.find((d) => d.id === (prefilledDeptId || userDepartmentId)) ||
      departments[0];
    return {
      departmentId: initialDept?.id || 0,
      roleTitle: '',
      hiringManager: initialDept?.leadName || '',
      urgency: 'High',
      headcountNeeded: 1,
      targetStartDate: '2027-01-15',
      compensationBand: 'L5 · ₦18.5M–₦24.0M',
      location: initialDept?.location || 'Abuja, FCT',
      employmentType: 'Full-Time',
      jobSummary: '',
      isPublishedToWebsite: true,
      selectedSocials: ['LinkedIn', 'X', 'WhatsApp'] as string[],
    };
  });

  React.useEffect(() => {
    if (prefilledDeptId) {
      const dept = departments.find((d) => d.id === prefilledDeptId);
      setReqForm((prev) => ({
        ...prev,
        departmentId: prefilledDeptId,
        hiringManager: dept?.leadName || prev.hiringManager,
        location: dept?.location || prev.location,
        urgency: dept?.priority === 'Critical' ? 'Critical' : 'High',
      }));
      setError(null);
      setShowNewReqModal(true);
      onClearPrefilledDept();
    }
  }, [prefilledDeptId, departments, onClearPrefilledDept]);

  const [candForm, setCandForm] = useState({
    requisitionId: selectedReqId || requisitions.find((r) => r.status === 'Open')?.id || 0,
    name: '',
    email: '',
    currentTitle: '',
    source: 'LinkedIn',
    stage: 'Applied' as PipelineStage,
    location: 'Abuja, Nigeria',
    compensationExpectation: '',
    notes: '',
  });

  const filteredCandidates = useMemo(() => {
    if (!selectedReqId) return candidates;
    return candidates.filter((c) => c.requisitionId === selectedReqId);
  }, [candidates, selectedReqId]);

  const canManageDept = (deptId?: number) => {
    if (isCeo) return true;
    return deptId !== undefined && deptId === userDepartmentId;
  };

  const toggleReqSocial = (channel: string) => {
    setReqForm((prev) => ({
      ...prev,
      selectedSocials: prev.selectedSocials.includes(channel)
        ? prev.selectedSocials.filter((c) => c !== channel)
        : [...prev.selectedSocials, channel],
    }));
  };

  const handleCreateRequisition = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const created = await apiFetch<JobRequisition>('/api/requisitions', {
        method: 'POST',
        body: JSON.stringify({
          ...reqForm,
          publishedSocials: reqForm.selectedSocials.join(','),
        }),
      });
      setShowNewReqModal(false);
      setReqForm((prev) => ({ ...prev, roleTitle: '', jobSummary: '' }));
      onNotify(
        `Opened ${created.reqCode || 'requisition'} for ${reqForm.roleTitle}${
          reqForm.isPublishedToWebsite ? ' and published to Careers Website.' : '.'
        }`
      );
      await onRefresh();
    } catch (err: any) {
      setError(err.message || 'Failed to open requisition.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateCandidate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await apiFetch('/api/candidates', {
        method: 'POST',
        body: JSON.stringify(candForm),
      });
      setShowNewCandidateModal(false);
      setCandForm((prev) => ({
        ...prev,
        name: '',
        email: '',
        currentTitle: '',
        compensationExpectation: '',
        notes: '',
      }));
      onNotify(`Added ${candForm.name} to recruitment pipeline.`);
      await onRefresh();
    } catch (err: any) {
      setError(err.message || 'Failed to add candidate.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleStageChange = async (candidate: Candidate, targetStage: PipelineStage) => {
    setBusyCandidateId(candidate.id);
    setError(null);
    try {
      const res = await apiFetch<{
        candidate: Candidate;
        hiredEmployee: { employeeCode: string; name: string } | null;
      }>(`/api/candidates/${candidate.id}/stage`, {
        method: 'PATCH',
        body: JSON.stringify({ stage: targetStage }),
      });

      if (targetStage === 'Hired' && res.hiredEmployee) {
        onNotify(
          `${res.hiredEmployee.name} hired (${res.hiredEmployee.employeeCode}) — employee profile created, 5 onboarding tasks assigned, and department headcount updated.`
        );
      } else {
        onNotify(`Moved ${candidate.name} to ${targetStage}.`);
      }
      await onRefresh();
    } catch (err: any) {
      setError(err.message || 'Failed to update candidate stage.');
    } finally {
      setBusyCandidateId(null);
    }
  };

  const handleToggleReqStatus = async (req: JobRequisition) => {
    try {
      const nextStatus = req.status === 'Open' ? 'Paused' : 'Open';
      await apiFetch(`/api/requisitions/${req.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: nextStatus }),
      });
      await onRefresh();
    } catch (err: any) {
      setError(err.message || 'Failed to update requisition status.');
    }
  };

  const handleSaveBroadcastSettings = async (
    req: JobRequisition,
    isPublishedToWebsite: boolean,
    channels: string[]
  ) => {
    try {
      const updated = await apiFetch<JobRequisition>(`/api/requisitions/${req.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          isPublishedToWebsite,
          publishedSocials: channels.join(','),
        }),
      });
      setBroadcastReq({ ...req, ...updated });
      onNotify(
        `Updated website & social publishing settings for ${req.reqCode} (${req.roleTitle}).`
      );
      await onRefresh();
    } catch (err: any) {
      setError(err.message || 'Failed to update publishing settings.');
    }
  };

  const copyText = async (key: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 2000);
    } catch {
      setError('Unable to access clipboard.');
    }
  };

  const openManageableReqs = requisitions.filter(
    (r) => r.status === 'Open' && canManageDept(r.departmentId)
  );

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">
            Staff Recruitment &amp; Candidate Pipeline
          </h2>
          <p className="text-xs text-slate-500 mt-0.5 tabular-nums">
            {requisitions.filter((r) => r.status === 'Open').length} open requisitions ·{' '}
            {requisitions.filter((r) => r.status === 'Open' && r.isPublishedToWebsite).length}{' '}
            live on Careers Website · Marking a candidate Hired auto-provisions their employee profile
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={onOpenCareersPortal}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-900 text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap"
          >
            <Globe className="w-3.5 h-3.5" />
            <span>View Careers Website</span>
          </button>

          {openManageableReqs.length > 0 && (
            <button
              type="button"
              onClick={() => {
                setCandForm((prev) => ({
                  ...prev,
                  requisitionId:
                    selectedReqId &&
                    openManageableReqs.some((r) => r.id === selectedReqId)
                      ? selectedReqId
                      : openManageableReqs[0].id,
                }));
                setError(null);
                setShowNewCandidateModal(true);
              }}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-900 text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>Add Candidate</span>
            </button>
          )}

          {manageableDepartments.length > 0 && (
            <button
              type="button"
              onClick={() => {
                const defaultDept = manageableDepartments[0];
                setReqForm((prev) => ({
                  ...prev,
                  departmentId: defaultDept.id,
                  hiringManager: defaultDept.leadName,
                  location: defaultDept.location,
                }));
                setError(null);
                setShowNewReqModal(true);
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New Requisition</span>
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-md text-xs text-red-700">
          {error}
        </div>
      )}

      {/* Requisitions Filter Strip */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between gap-3">
          <span className="text-xs font-semibold text-slate-800">
            Job Requisitions ({requisitions.length})
          </span>
          {selectedReqId && (
            <button
              type="button"
              onClick={() => onSelectReqId(null)}
              className="text-xs text-blue-700 hover:underline font-medium cursor-pointer"
            >
              Show All Requisitions
            </button>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/70 text-[11px] font-medium text-slate-500">
                <th className="py-2.5 px-4">Req</th>
                <th className="py-2.5 px-4">Role Title</th>
                <th className="py-2.5 px-4">Department</th>
                <th className="py-2.5 px-4">Hiring Manager</th>
                <th className="py-2.5 px-4">Urgency</th>
                <th className="py-2.5 px-4 text-right">Hires</th>
                <th className="py-2.5 px-4">Distribution</th>
                <th className="py-2.5 px-4">Status</th>
                <th className="py-2.5 px-4 text-right">Share</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {requisitions.map((req) => {
                const isSelected = selectedReqId === req.id;
                const socialsList = req.publishedSocials
                  ? req.publishedSocials.split(',').filter(Boolean)
                  : [];
                return (
                  <tr
                    key={req.id}
                    onClick={() => onSelectReqId(isSelected ? null : req.id)}
                    className={`cursor-pointer transition-colors ${
                      isSelected ? 'bg-blue-50/60' : 'hover:bg-slate-50/80'
                    }`}
                  >
                    <td className="py-2.5 px-4 font-mono text-slate-500 whitespace-nowrap">
                      {req.reqCode}
                    </td>
                    <td className="py-2.5 px-4 font-medium text-slate-900">
                      {req.roleTitle}
                      <span className="ml-2 text-slate-400 font-normal">
                        ({req.candidates.length} candidates)
                      </span>
                    </td>
                    <td className="py-2.5 px-4 text-slate-700 whitespace-nowrap">
                      {req.departmentName}
                    </td>
                    <td className="py-2.5 px-4 text-slate-600 whitespace-nowrap">
                      {req.hiringManager}
                    </td>
                    <td className="py-2.5 px-4 whitespace-nowrap">
                      <span
                        className={`font-medium ${
                          req.urgency === 'Critical'
                            ? 'text-red-700'
                            : req.urgency === 'High'
                            ? 'text-amber-700'
                            : 'text-slate-600'
                        }`}
                      >
                        {req.urgency}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono tabular-nums text-slate-800">
                      {req.filledHires} / {req.headcountNeeded}
                    </td>
                    <td className="py-2.5 px-4 whitespace-nowrap">
                      <span
                        className={`font-medium ${
                          req.isPublishedToWebsite ? 'text-emerald-700' : 'text-slate-400'
                        }`}
                      >
                        {req.isPublishedToWebsite ? 'Website Live' : 'Internal Only'}
                      </span>
                      {socialsList.length > 0 && (
                        <span className="text-slate-400 ml-1">
                          · {socialsList.join(', ')}
                        </span>
                      )}
                    </td>
                    <td
                      className="py-2.5 px-4 whitespace-nowrap"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {canManageDept(req.departmentId) && req.status !== 'Filled' ? (
                        <button
                          type="button"
                          onClick={() => handleToggleReqStatus(req)}
                          className={`font-medium cursor-pointer hover:underline ${
                            req.status === 'Open' ? 'text-emerald-700' : 'text-slate-500'
                          }`}
                        >
                          {req.status}
                        </button>
                      ) : (
                        <span
                          className={`font-medium ${
                            req.status === 'Filled'
                              ? 'text-blue-700'
                              : req.status === 'Open'
                              ? 'text-emerald-700'
                              : 'text-slate-500'
                          }`}
                        >
                          {req.status}
                        </span>
                      )}
                    </td>
                    <td
                      className="py-2.5 px-4 text-right whitespace-nowrap"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        type="button"
                        onClick={() => setBroadcastReq(req)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium text-slate-800 bg-white border border-slate-300 hover:bg-slate-50 rounded cursor-pointer whitespace-nowrap"
                      >
                        <Share2 className="w-3 h-3" />
                        <span>Share / Post</span>
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* 5-Stage Candidate Pipeline Board */}
      <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-5 gap-4 items-start">
        {STAGES.map((stage) => {
          const stageCandidates = filteredCandidates.filter((c) => c.stage === stage);
          return (
            <div
              key={stage}
              className="bg-white border border-slate-200 rounded-lg overflow-hidden flex flex-col"
            >
              <div className="px-3.5 py-2.5 border-b border-slate-200 bg-slate-50/70 flex items-center justify-between">
                <span
                  className={`text-xs font-semibold ${
                    stage === 'Hired'
                      ? 'text-emerald-800'
                      : stage === 'Offer'
                      ? 'text-blue-800'
                      : 'text-slate-800'
                  }`}
                >
                  {stage}
                </span>
                <span className="text-xs font-mono tabular-nums text-slate-500">
                  {stageCandidates.length}
                </span>
              </div>

              <div className="p-2.5 space-y-2.5 min-h-[220px]">
                {stageCandidates.length === 0 ? (
                  <p className="text-xs text-slate-400 text-center py-8">No candidates</p>
                ) : (
                  stageCandidates.map((cand) => {
                    const nextStage = getNextStage(cand.stage);
                    const editable = canManageDept(cand.departmentId) && cand.stage !== 'Hired';
                    const isBusy = busyCandidateId === cand.id;

                    return (
                      <div
                        key={cand.id}
                        className="p-3 bg-slate-50/60 border border-slate-200 rounded-md space-y-2"
                      >
                        <div>
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-sm font-medium text-slate-900 leading-snug">
                              {cand.name}
                            </p>
                            <span className="text-[11px] font-mono text-slate-400 shrink-0">
                              {cand.departmentCode}
                            </span>
                          </div>
                          <p className="text-xs text-slate-700 mt-0.5">{cand.roleTitle}</p>
                          {cand.currentTitle && (
                            <p className="text-[11px] text-slate-500 mt-0.5 truncate">
                              {cand.currentTitle}
                            </p>
                          )}
                        </div>

                        <div className="text-[11px] text-slate-500 flex items-center gap-1.5 flex-wrap">
                          <span>{cand.source}</span>
                          <span aria-hidden="true">·</span>
                          <span>{cand.location}</span>
                          {cand.compensationExpectation && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span className="font-mono">{cand.compensationExpectation}</span>
                            </>
                          )}
                        </div>

                        {cand.notes && (
                          <p className="text-[11px] text-slate-600 line-clamp-2">{cand.notes}</p>
                        )}

                        {cand.stage === 'Hired' ? (
                          <div className="pt-1.5 border-t border-slate-200 flex items-center gap-1.5 text-xs text-emerald-700 font-medium">
                            <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                            <span>Hired &amp; Onboarding</span>
                          </div>
                        ) : (
                          editable && (
                            <div className="pt-2 border-t border-slate-200 flex items-center justify-between gap-2">
                              <select
                                value={cand.stage}
                                disabled={isBusy}
                                aria-label={`Change stage for ${cand.name}`}
                                onChange={(e) =>
                                  handleStageChange(cand, e.target.value as PipelineStage)
                                }
                                className="text-[11px] bg-white border border-slate-300 rounded px-1.5 py-1 text-slate-700 focus:outline-none"
                              >
                                {STAGES.map((s) => (
                                  <option key={s} value={s}>
                                    {s}
                                  </option>
                                ))}
                                <option value="Rejected">Rejected</option>
                              </select>

                              {nextStage && (
                                <button
                                  type="button"
                                  disabled={isBusy}
                                  onClick={() => handleStageChange(cand, nextStage)}
                                  className={`inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium rounded transition-colors cursor-pointer whitespace-nowrap disabled:opacity-50 ${
                                    nextStage === 'Hired'
                                      ? 'bg-emerald-700 hover:bg-emerald-800 text-white'
                                      : 'bg-slate-900 hover:bg-slate-800 text-white'
                                  }`}
                                >
                                  <span>
                                    {isBusy
                                      ? 'Saving...'
                                      : nextStage === 'Hired'
                                      ? 'Mark Hired'
                                      : nextStage}
                                  </span>
                                  <ArrowRight className="w-3 h-3" />
                                </button>
                              )}
                            </div>
                          )
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Share & Publish to Website / Socials Modal */}
      {broadcastReq && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-lg max-w-xl w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div>
              <p className="text-xs font-mono text-slate-500">
                {broadcastReq.reqCode} · {broadcastReq.departmentName}
              </p>
              <h3 className="text-base font-semibold text-slate-900 mt-0.5">
                Publish to Website &amp; Social Media
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Promote <strong>{broadcastReq.roleTitle}</strong> so external job seekers can view and apply directly.
              </p>
            </div>

            {(() => {
              const roleUrl = `${window.location.origin}/?view=careers&role=${encodeURIComponent(
                broadcastReq.reqCode
              )}`;
              const activeChannels = broadcastReq.publishedSocials
                ? broadcastReq.publishedSocials.split(',').filter(Boolean)
                : [];
              const linkedInCopy = `We're hiring! Meridian Global is looking for a ${broadcastReq.roleTitle} (${broadcastReq.location}).\n\nCompensation: ${broadcastReq.compensationBand}\n${broadcastReq.jobSummary || 'Join our team building resilient global enterprise & financial infrastructure.'}\n\nApply directly on our Careers Website: ${roleUrl}`;
              const xCopy = `We're hiring a ${broadcastReq.roleTitle} in ${broadcastReq.location} at Meridian Global (${broadcastReq.compensationBand}). Apply here: ${roleUrl}`;
              const whatsappCopy = `*Job Opening at Meridian Global*\nRole: ${broadcastReq.roleTitle}\nLocation: ${broadcastReq.location}\nPackage: ${broadcastReq.compensationBand}\nApply directly: ${roleUrl}`;

              return (
                <>
                  {/* Website & Channel Persistence Controls */}
                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-md space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-xs font-semibold text-slate-900">
                          Company Careers Website Visibility
                        </p>
                        <p className="text-[11px] text-slate-500">
                          When live, applicants can submit applications directly into your pipeline.
                        </p>
                      </div>
                      <button
                        type="button"
                        disabled={!canManageDept(broadcastReq.departmentId)}
                        onClick={() =>
                          handleSaveBroadcastSettings(
                            broadcastReq,
                            !broadcastReq.isPublishedToWebsite,
                            activeChannels
                          )
                        }
                        className={`px-3 py-1.5 text-xs font-medium rounded-md cursor-pointer whitespace-nowrap disabled:opacity-50 ${
                          broadcastReq.isPublishedToWebsite
                            ? 'bg-emerald-700 text-white'
                            : 'bg-white border border-slate-300 text-slate-700'
                        }`}
                      >
                        {broadcastReq.isPublishedToWebsite ? 'Published Live' : 'Hidden (Enable)'}
                      </button>
                    </div>

                    <div className="pt-2 border-t border-slate-200">
                      <p className="text-[11px] font-medium text-slate-700 mb-2">
                        Promoted Social Channels
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {SOCIAL_CHANNELS.map((ch) => {
                          const enabled = activeChannels.includes(ch);
                          return (
                            <button
                              key={ch}
                              type="button"
                              disabled={!canManageDept(broadcastReq.departmentId)}
                              onClick={() => {
                                const next = enabled
                                  ? activeChannels.filter((c) => c !== ch)
                                  : [...activeChannels, ch];
                                handleSaveBroadcastSettings(
                                  broadcastReq,
                                  broadcastReq.isPublishedToWebsite,
                                  next
                                );
                              }}
                              className={`px-2.5 py-1 text-xs font-medium rounded border cursor-pointer disabled:opacity-50 ${
                                enabled
                                  ? 'bg-slate-900 text-white border-slate-900'
                                  : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-100'
                              }`}
                            >
                              {ch}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {/* Direct Careers URL */}
                  <div className="space-y-1.5">
                    <label className="block text-xs font-medium text-slate-700">
                      Direct Careers Website Link
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        readOnly
                        value={roleUrl}
                        className="flex-1 px-3 py-1.5 text-xs font-mono bg-slate-50 border border-slate-200 rounded-md text-slate-700"
                      />
                      <button
                        type="button"
                        onClick={() => copyText('url', roleUrl)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-white border border-slate-300 hover:bg-slate-50 rounded-md cursor-pointer"
                      >
                        {copiedKey === 'url' ? (
                          <Check className="w-3.5 h-3.5 text-emerald-700" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                        <span>{copiedKey === 'url' ? 'Copied' : 'Copy'}</span>
                      </button>
                    </div>
                  </div>

                  {/* Social Post Copy & Direct Share Links */}
                  <div className="space-y-3">
                    <div className="border border-slate-200 rounded-md p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-slate-800">LinkedIn Post</span>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => copyText('linkedin', linkedInCopy)}
                            className="text-xs text-slate-600 hover:text-slate-900 underline cursor-pointer"
                          >
                            {copiedKey === 'linkedin' ? 'Copied!' : 'Copy Post'}
                          </button>
                          <a
                            href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(
                              roleUrl
                            )}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-2.5 py-1 text-[11px] font-medium bg-slate-900 text-white rounded hover:bg-slate-800"
                          >
                            Post on LinkedIn
                          </a>
                        </div>
                      </div>
                      <p className="text-xs text-slate-600 whitespace-pre-line">{linkedInCopy}</p>
                    </div>

                    <div className="border border-slate-200 rounded-md p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-slate-800">X (Twitter) Post</span>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => copyText('x', xCopy)}
                            className="text-xs text-slate-600 hover:text-slate-900 underline cursor-pointer"
                          >
                            {copiedKey === 'x' ? 'Copied!' : 'Copy Post'}
                          </button>
                          <a
                            href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(
                              xCopy
                            )}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-2.5 py-1 text-[11px] font-medium bg-slate-900 text-white rounded hover:bg-slate-800"
                          >
                            Post on X
                          </a>
                        </div>
                      </div>
                      <p className="text-xs text-slate-600">{xCopy}</p>
                    </div>

                    <div className="border border-slate-200 rounded-md p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-slate-800">
                          WhatsApp Broadcast / Status
                        </span>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => copyText('wa', whatsappCopy)}
                            className="text-xs text-slate-600 hover:text-slate-900 underline cursor-pointer"
                          >
                            {copiedKey === 'wa' ? 'Copied!' : 'Copy Post'}
                          </button>
                          <a
                            href={`https://wa.me/?text=${encodeURIComponent(whatsappCopy)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-2.5 py-1 text-[11px] font-medium bg-emerald-700 text-white rounded hover:bg-emerald-800"
                          >
                            Share on WhatsApp
                          </a>
                        </div>
                      </div>
                      <p className="text-xs text-slate-600 whitespace-pre-line">{whatsappCopy}</p>
                    </div>
                  </div>
                </>
              );
            })()}

            <div className="pt-2 flex items-center justify-between">
              <button
                type="button"
                onClick={() => {
                  setBroadcastReq(null);
                  onOpenCareersPortal();
                }}
                className="text-xs font-medium text-blue-700 hover:underline cursor-pointer"
              >
                Preview Live Careers Website
              </button>
              <button
                type="button"
                onClick={() => setBroadcastReq(null)}
                className="px-4 py-2 text-xs font-medium text-white bg-slate-900 hover:bg-slate-800 rounded-md cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New Requisition Modal */}
      {showNewReqModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-lg max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto">
            <h3 className="text-base font-semibold text-slate-900">Open Job Requisition</h3>
            <p className="text-xs text-slate-500 mt-1">
              Create a hiring requisition and optionally publish immediately to your website and social channels.
            </p>

            <form onSubmit={handleCreateRequisition} className="mt-4 space-y-3.5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Department
                  </label>
                  <select
                    value={reqForm.departmentId}
                    onChange={(e) => {
                      const deptId = Number(e.target.value);
                      const dept = departments.find((d) => d.id === deptId);
                      setReqForm({
                        ...reqForm,
                        departmentId: deptId,
                        hiringManager: dept?.leadName || reqForm.hiringManager,
                        location: dept?.location || reqForm.location,
                      });
                    }}
                    className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-md bg-white"
                  >
                    {manageableDepartments.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name} ({d.code})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Hiring Manager
                  </label>
                  <input
                    type="text"
                    required
                    value={reqForm.hiringManager}
                    onChange={(e) => setReqForm({ ...reqForm, hiringManager: e.target.value })}
                    className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-md"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Role Title
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Senior Backend Engineer"
                    value={reqForm.roleTitle}
                    onChange={(e) => setReqForm({ ...reqForm, roleTitle: e.target.value })}
                    className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-md"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Type</label>
                  <select
                    value={reqForm.employmentType}
                    onChange={(e) => setReqForm({ ...reqForm, employmentType: e.target.value })}
                    className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-md bg-white"
                  >
                    <option value="Full-Time">Full-Time</option>
                    <option value="Part-Time">Part-Time</option>
                    <option value="Contract">Contract</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Urgency</label>
                  <select
                    value={reqForm.urgency}
                    onChange={(e) => setReqForm({ ...reqForm, urgency: e.target.value })}
                    className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-md bg-white"
                  >
                    <option value="Critical">Critical</option>
                    <option value="High">High</option>
                    <option value="Normal">Normal</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Headcount Needed
                  </label>
                  <input
                    type="number"
                    min={1}
                    required
                    value={reqForm.headcountNeeded}
                    onChange={(e) =>
                      setReqForm({ ...reqForm, headcountNeeded: Number(e.target.value) })
                    }
                    className="w-full px-3 py-1.5 text-sm font-mono border border-slate-300 rounded-md"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Target Start Date
                  </label>
                  <input
                    type="date"
                    required
                    value={reqForm.targetStartDate}
                    onChange={(e) => setReqForm({ ...reqForm, targetStartDate: e.target.value })}
                    className="w-full px-3 py-1.5 text-sm font-mono border border-slate-300 rounded-md"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Compensation Band (NGN)
                  </label>
                  <input
                    type="text"
                    required
                    value={reqForm.compensationBand}
                    onChange={(e) =>
                      setReqForm({ ...reqForm, compensationBand: e.target.value })
                    }
                    className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-md"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Location</label>
                  <input
                    type="text"
                    required
                    value={reqForm.location}
                    onChange={(e) => setReqForm({ ...reqForm, location: e.target.value })}
                    className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-md"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Public Job Summary (shown on Website &amp; Socials)
                </label>
                <textarea
                  rows={2}
                  placeholder="Describe impact, core responsibilities, and required stack..."
                  value={reqForm.jobSummary}
                  onChange={(e) => setReqForm({ ...reqForm, jobSummary: e.target.value })}
                  className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-md"
                />
              </div>

              <div className="p-3 bg-slate-50 border border-slate-200 rounded-md space-y-2.5">
                <label className="flex items-center gap-2 text-xs font-medium text-slate-800 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={reqForm.isPublishedToWebsite}
                    onChange={(e) =>
                      setReqForm({ ...reqForm, isPublishedToWebsite: e.target.checked })
                    }
                  />
                  <span>Publish immediately to Meridian Global Careers Website</span>
                </label>

                <div>
                  <p className="text-[11px] text-slate-600 mb-1.5">Social Channels to Promote:</p>
                  <div className="flex flex-wrap gap-1.5">
                    {SOCIAL_CHANNELS.map((ch) => {
                      const active = reqForm.selectedSocials.includes(ch);
                      return (
                        <button
                          key={ch}
                          type="button"
                          onClick={() => toggleReqSocial(ch)}
                          className={`px-2.5 py-1 text-[11px] font-medium rounded border cursor-pointer ${
                            active
                              ? 'bg-slate-900 text-white border-slate-900'
                              : 'bg-white text-slate-600 border-slate-300'
                          }`}
                        >
                          {ch}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="pt-3 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowNewReqModal(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-md cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 text-xs font-medium text-white bg-slate-900 hover:bg-slate-800 rounded-md disabled:opacity-50 cursor-pointer"
                >
                  {submitting ? 'Opening...' : 'Open & Publish Requisition'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Candidate Modal */}
      {showNewCandidateModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-lg max-w-lg w-full p-6">
            <h3 className="text-base font-semibold text-slate-900">Add Candidate to Pipeline</h3>
            <form onSubmit={handleCreateCandidate} className="mt-4 space-y-3.5">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Job Requisition
                </label>
                <select
                  value={candForm.requisitionId}
                  onChange={(e) =>
                    setCandForm({ ...candForm, requisitionId: Number(e.target.value) })
                  }
                  className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-md bg-white"
                >
                  {openManageableReqs.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.reqCode} · {r.roleTitle} ({r.departmentCode})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Full Name</label>
                  <input
                    type="text"
                    required
                    value={candForm.name}
                    onChange={(e) => setCandForm({ ...candForm, name: e.target.value })}
                    className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-md"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Email</label>
                  <input
                    type="email"
                    required
                    value={candForm.email}
                    onChange={(e) => setCandForm({ ...candForm, email: e.target.value })}
                    className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-md"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Current Title / Company
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Senior Systems Engineer"
                    value={candForm.currentTitle}
                    onChange={(e) => setCandForm({ ...candForm, currentTitle: e.target.value })}
                    className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-md"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Source</label>
                  <select
                    value={candForm.source}
                    onChange={(e) => setCandForm({ ...candForm, source: e.target.value })}
                    className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-md bg-white"
                  >
                    <option value="LinkedIn">LinkedIn</option>
                    <option value="Careers Website">Careers Website</option>
                    <option value="Referral">Referral</option>
                    <option value="Direct">Direct</option>
                    <option value="Agency">Agency</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Stage</label>
                  <select
                    value={candForm.stage}
                    onChange={(e) =>
                      setCandForm({ ...candForm, stage: e.target.value as PipelineStage })
                    }
                    className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-md bg-white"
                  >
                    <option value="Applied">Applied</option>
                    <option value="Screening">Screening</option>
                    <option value="Interview">Interview</option>
                    <option value="Offer">Offer</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Location</label>
                  <input
                    type="text"
                    value={candForm.location}
                    onChange={(e) => setCandForm({ ...candForm, location: e.target.value })}
                    className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-md"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Comp Target (NGN)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. L5 · ₦21M"
                    value={candForm.compensationExpectation}
                    onChange={(e) =>
                      setCandForm({ ...candForm, compensationExpectation: e.target.value })
                    }
                    className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-md"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Notes</label>
                <textarea
                  rows={2}
                  value={candForm.notes}
                  onChange={(e) => setCandForm({ ...candForm, notes: e.target.value })}
                  className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-md"
                />
              </div>

              <div className="pt-3 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowNewCandidateModal(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-md cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 text-xs font-medium text-white bg-slate-900 hover:bg-slate-800 rounded-md disabled:opacity-50 cursor-pointer"
                >
                  {submitting ? 'Adding...' : 'Add Candidate'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
