import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, CheckCircle2, MapPin, Search, Share2 } from 'lucide-react';
import { PublicCareerListing } from '../types';

interface PublicCareersViewProps {
  initialReqCode?: string | null;
  isSignedIn?: boolean;
  onBackToApp?: () => void;
}

export const PublicCareersView: React.FC<PublicCareersViewProps> = ({
  initialReqCode,
  isSignedIn = false,
  onBackToApp,
}) => {
  const [listings, setListings] = useState<PublicCareerListing[]>([]);
  const [company, setCompany] = useState({
    name: 'Meridian Global',
    tagline: 'Powering global digital infrastructure and enterprise operations from Northern Nigeria to international markets.',
    headquarters: 'Maitama, Abuja & Global Remote',
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [deptFilter, setDeptFilter] = useState('ALL');
  const [selectedJob, setSelectedJob] = useState<PublicCareerListing | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [appliedBanner, setAppliedBanner] = useState<string | null>(null);

  const [applyForm, setApplyForm] = useState({
    name: '',
    email: '',
    currentTitle: '',
    location: 'Abuja, Nigeria',
    compensationExpectation: '',
    notes: '',
    source: 'Careers Website',
  });

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        setLoading(true);
        const res = await fetch('/api/public/careers');
        if (!res.ok) throw new Error('Unable to load job openings.');
        const data = await res.json();
        if (!active) return;
        setCompany(data.company);
        setListings(data.listings || []);
        if (initialReqCode) {
          const match = (data.listings || []).find(
            (j: PublicCareerListing) =>
              j.reqCode.toUpperCase() === initialReqCode.toUpperCase()
          );
          if (match) setSelectedJob(match);
        }
      } catch (err: any) {
        if (active) setError(err.message || 'Failed to load openings.');
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [initialReqCode]);

  const departmentsList = useMemo(
    () => Array.from(new Set(listings.map((l) => l.departmentName))).sort(),
    [listings]
  );

  const filteredListings = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return listings.filter((item) => {
      if (deptFilter !== 'ALL' && item.departmentName !== deptFilter) return false;
      if (q) {
        const hay = `${item.roleTitle} ${item.departmentName} ${item.location} ${item.jobSummary}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [listings, deptFilter, searchTerm]);

  const handleApplySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedJob) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/public/careers/${encodeURIComponent(selectedJob.reqCode)}/apply`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(applyForm),
        }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to submit application.');
      setAppliedBanner(
        `Application submitted for ${selectedJob.roleTitle} (${selectedJob.reqCode}). Our hiring team in ${selectedJob.location} will review your profile shortly.`
      );
      setSelectedJob(null);
      setApplyForm({
        name: '',
        email: '',
        currentTitle: '',
        location: 'Abuja, Nigeria',
        compensationExpectation: '',
        notes: '',
        source: 'Careers Website',
      });
    } catch (err: any) {
      setError(err.message || 'Could not submit application.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      {/* Top Bar */}
      <header className="bg-white border-b border-slate-200 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-6">
          <span className="font-display text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0">
            {company.name} Careers
          </span>
          <div className="flex items-center gap-4">
            {onBackToApp && (
              <button
                type="button"
                onClick={onBackToApp}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-md cursor-pointer whitespace-nowrap"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>{isSignedIn ? 'Back to Workforce Hub' : 'Staff Sign In'}</span>
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-10 space-y-8">
        {/* Hero */}
        <section className="bg-white border border-slate-200 rounded-lg p-8">
          <p className="text-xs font-medium text-slate-500">{company.headquarters}</p>
          <h1 className="mt-2 text-2xl sm:text-3xl font-semibold text-slate-900 tracking-tight [text-wrap:balance]">
            Open Opportunities at {company.name}
          </h1>
          <p className="mt-2 text-sm text-slate-600 max-w-2xl leading-relaxed">
            {company.tagline} Every application goes directly to the hiring manager&apos;s recruitment pipeline.
          </p>

          <div className="mt-6 flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search roles, skills, or hubs (Abuja, Kano, Kaduna, Global Remote)..."
                className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:border-slate-500"
              />
            </div>
            <select
              value={deptFilter}
              onChange={(e) => setDeptFilter(e.target.value)}
              className="px-3 py-2 text-sm border border-slate-300 rounded-md bg-white text-slate-700"
            >
              <option value="ALL">All Departments ({listings.length})</option>
              {departmentsList.map((dept) => (
                <option key={dept} value={dept}>
                  {dept}
                </option>
              ))}
            </select>
          </div>
        </section>

        {appliedBanner && (
          <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg flex items-start gap-3 text-sm text-emerald-900">
            <CheckCircle2 className="w-4 h-4 text-emerald-700 mt-0.5 shrink-0" />
            <span>{appliedBanner}</span>
          </div>
        )}

        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Job Listings */}
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-28 bg-white border border-slate-200 rounded-lg animate-pulse" />
            ))}
          </div>
        ) : filteredListings.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-lg p-10 text-center text-sm text-slate-500">
            No open positions match your current filter.
          </div>
        ) : (
          <div className="space-y-3">
            {filteredListings.map((job) => {
              const roleUrl = `${window.location.origin}/?view=careers&role=${encodeURIComponent(
                job.reqCode
              )}`;
              const shareText = `We're hiring a ${job.roleTitle} (${job.location}) at ${company.name}. Compensation: ${job.compensationBand}. Apply here:`;
              return (
                <article
                  key={job.id}
                  className="bg-white border border-slate-200 rounded-lg p-6 flex flex-col md:flex-row md:items-center justify-between gap-5"
                >
                  <div className="space-y-2 max-w-2xl">
                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                      <span className="font-mono text-slate-600">{job.reqCode}</span>
                      <span aria-hidden="true">·</span>
                      <span className="font-medium text-slate-700">{job.departmentName}</span>
                      <span aria-hidden="true">·</span>
                      <span>{job.employmentType}</span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono">{job.compensationBand}</span>
                    </div>

                    <h2 className="text-lg font-semibold text-slate-900">{job.roleTitle}</h2>
                    <p className="text-sm text-slate-600 leading-relaxed">{job.jobSummary}</p>

                    <div className="pt-1 flex flex-wrap items-center gap-4 text-xs text-slate-500">
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5" />
                        <span>{job.location}</span>
                      </span>
                      <span className="tabular-nums">
                        {job.openings} {job.openings === 1 ? 'opening' : 'openings'} · Target start{' '}
                        {job.targetStartDate}
                      </span>
                      {job.publishedSocials && (
                        <span className="inline-flex items-center gap-1 text-slate-600">
                          <Share2 className="w-3.5 h-3.5" />
                          <span>Shared on {job.publishedSocials.split(',').join(', ')}</span>
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row md:flex-col items-stretch sm:items-center md:items-end gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        setError(null);
                        setSelectedJob(job);
                      }}
                      className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap"
                    >
                      Apply Now
                    </button>
                    <div className="flex items-center gap-3 text-xs text-slate-500">
                      <a
                        href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(
                          roleUrl
                        )}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:text-slate-900 underline"
                      >
                        LinkedIn
                      </a>
                      <a
                        href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(
                          shareText
                        )}&url=${encodeURIComponent(roleUrl)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:text-slate-900 underline"
                      >
                        Share on X
                      </a>
                      <a
                        href={`https://wa.me/?text=${encodeURIComponent(
                          `${shareText} ${roleUrl}`
                        )}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:text-slate-900 underline"
                      >
                        WhatsApp
                      </a>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </main>

      {/* Apply Modal */}
      {selectedJob && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-lg max-w-lg w-full p-6">
            <p className="text-xs font-mono text-slate-500">
              {selectedJob.reqCode} · {selectedJob.departmentName}
            </p>
            <h3 className="text-base font-semibold text-slate-900 mt-1">
              Apply for {selectedJob.roleTitle}
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              {selectedJob.location} · {selectedJob.compensationBand}
            </p>

            <form onSubmit={handleApplySubmit} className="mt-4 space-y-3.5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Full Name
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Suleiman Bello"
                    value={applyForm.name}
                    onChange={(e) => setApplyForm({ ...applyForm, name: e.target.value })}
                    className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-md"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Email Address
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="suleiman@example.com"
                    value={applyForm.email}
                    onChange={(e) => setApplyForm({ ...applyForm, email: e.target.value })}
                    className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-md"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Current Role / Company
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Senior Backend Engineer"
                    value={applyForm.currentTitle}
                    onChange={(e) => setApplyForm({ ...applyForm, currentTitle: e.target.value })}
                    className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-md"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Current Location
                  </label>
                  <input
                    type="text"
                    required
                    value={applyForm.location}
                    onChange={(e) => setApplyForm({ ...applyForm, location: e.target.value })}
                    className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-md"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Expected Annual Comp (NGN)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. ₦20M"
                    value={applyForm.compensationExpectation}
                    onChange={(e) =>
                      setApplyForm({ ...applyForm, compensationExpectation: e.target.value })
                    }
                    className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-md"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    How did you hear about us?
                  </label>
                  <select
                    value={applyForm.source}
                    onChange={(e) => setApplyForm({ ...applyForm, source: e.target.value })}
                    className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-md bg-white"
                  >
                    <option value="Careers Website">Company Website</option>
                    <option value="LinkedIn">LinkedIn</option>
                    <option value="X (Twitter)">X (Twitter)</option>
                    <option value="WhatsApp">WhatsApp</option>
                    <option value="Referral">Referral</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Portfolio / LinkedIn URL &amp; Summary
                </label>
                <textarea
                  rows={3}
                  required
                  placeholder="Share relevant experience, GitHub/LinkedIn link, or notice period..."
                  value={applyForm.notes}
                  onChange={(e) => setApplyForm({ ...applyForm, notes: e.target.value })}
                  className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-md"
                />
              </div>

              <div className="pt-3 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedJob(null)}
                  className="px-4 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-md cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 text-xs font-medium text-white bg-slate-900 hover:bg-slate-800 rounded-md disabled:opacity-50 cursor-pointer"
                >
                  {submitting ? 'Submitting...' : 'Submit Application'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
