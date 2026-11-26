import React from 'react';
import { Building2, Globe, ShieldCheck, Users, GitPullRequest } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface SignInScreenProps {
  onOpenCareers?: () => void;
}

export const SignInScreen: React.FC<SignInScreenProps> = ({ onOpenCareers }) => {
  const {
    firebaseUser,
    signInWithGoogle,
    signOut,
    refreshProfile,
    signingIn,
    authError,
  } = useAuth();

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl w-full mx-auto grid grid-cols-1 lg:grid-cols-12 bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="lg:col-span-7 p-8 sm:p-10 flex flex-col justify-between border-b lg:border-b-0 lg:border-r border-slate-200">
          <div>
            <p className="text-xs font-medium text-slate-500 tracking-wide">
              Meridian Global · Abuja, Kano &amp; Global Hubs
            </p>
            <h1 className="mt-3 text-2xl sm:text-3xl font-semibold text-slate-900 tracking-tight [text-wrap:balance]">
              Workforce Staffing, Payroll &amp; Recruitment Operations
            </h1>
            <p className="mt-3 text-sm text-slate-600 leading-relaxed max-w-lg">
              Centralized PostgreSQL command center for executive headcount planning,
              NGN budget tracking, candidate pipelines, and role-based approval workflows.
            </p>

            <div className="mt-8 space-y-4">
              <div className="flex items-start gap-3">
                <Building2 className="w-4 h-4 text-slate-700 mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-medium text-slate-900">
                    Real-Time Department Staffing &amp; Naira Budgets
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Live headcount targets, payroll CSV reconciliation, and instant department transfers.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Users className="w-4 h-4 text-slate-700 mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-medium text-slate-900">
                    Website &amp; Social Job Distribution
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Publish requisitions directly to the public Careers Website and share across LinkedIn, X, and WhatsApp.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <GitPullRequest className="w-4 h-4 text-slate-700 mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-medium text-slate-900">
                    Role-Based Governance &amp; Audit Trail
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    CEO / Super Admin approvals, Department Head submissions, and immutable event history.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-8 pt-6 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500">
            <span className="inline-flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-slate-600 shrink-0" />
              <span>Protected by Google Identity &amp; RBAC</span>
            </span>
            {onOpenCareers && (
              <button
                type="button"
                onClick={onOpenCareers}
                className="inline-flex items-center gap-1.5 font-medium text-slate-900 hover:underline cursor-pointer"
              >
                <Globe className="w-3.5 h-3.5" />
                <span>Looking for a job? View Open Roles</span>
              </button>
            )}
          </div>
        </div>

        <div className="lg:col-span-5 p-8 sm:p-10 bg-slate-50/60 flex flex-col justify-center">
          <h2 className="text-lg font-semibold text-slate-900">Sign in to Workspace</h2>
          <p className="mt-1.5 text-sm text-slate-600">
            Authenticate with your corporate Google account to load your organization role and dashboard.
          </p>

          {authError && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md text-xs text-red-700 space-y-2">
              <p>{authError}</p>
              {firebaseUser && (
                <div className="flex items-center gap-3 pt-1">
                  <button
                    type="button"
                    onClick={refreshProfile}
                    className="font-medium underline text-red-800 cursor-pointer"
                  >
                    Retry Session Sync
                  </button>
                  <button
                    type="button"
                    onClick={signOut}
                    className="font-medium underline text-slate-700 cursor-pointer"
                  >
                    Switch Account
                  </button>
                </div>
              )}
            </div>
          )}

          <button
            type="button"
            disabled={signingIn}
            onClick={signInWithGoogle}
            className="mt-6 w-full inline-flex items-center justify-center gap-3 px-4 py-2.5 bg-slate-900 hover:bg-slate-800 disabled:opacity-60 text-white text-sm font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap"
          >
            <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
              <path
                fill="currentColor"
                d="M21.35 11.1h-9.17v2.73h6.51c-.33 3.81-3.5 5.44-6.5 5.44C8.36 19.27 5 16.25 5 12c0-4.1 3.2-7.27 7.2-7.27c3.09 0 4.9 1.97 4.9 1.97L19 4.72S16.56 2 12.1 2C6.42 2 2.03 6.8 2.03 12c0 5.05 4.13 10 10.22 10c5.35 0 9.25-3.67 9.25-9.09c0-1.15-.15-1.81-.15-1.81Z"
              />
            </svg>
            <span>{signingIn ? 'Signing in...' : 'Continue with Google'}</span>
          </button>

          <div className="mt-6 pt-5 border-t border-slate-200 space-y-2 text-xs text-slate-500">
            <p className="font-medium text-slate-700">Access Roles</p>
            <p>CEO / Super Admin: Full staffing, budget, payroll CSV export, and approvals.</p>
            <p>Department Head: Requisition, pipeline, onboarding, and request submissions.</p>
          </div>
        </div>
      </div>
    </div>
  );
};
