import React, { useEffect, useRef, useState } from 'react';
import { Search, X } from 'lucide-react';
import { apiFetch } from '../lib/api';
import { GlobalSearchResult } from '../types';

interface GlobalSearchBarProps {
  onSelectEmployee: (employeeId: number) => void;
  onSelectDepartment: (departmentId: number) => void;
  onSelectRequisition: (requisitionId: number) => void;
}

export const GlobalSearchBar: React.FC<GlobalSearchBarProps> = ({
  onSelectEmployee,
  onSelectDepartment,
  onSelectRequisition,
}) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<GlobalSearchResult | null>(null);
  const [open, setOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      setResults(null);
      setOpen(false);
      return;
    }

    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const data = await apiFetch<GlobalSearchResult>(
          `/api/search?q=${encodeURIComponent(trimmed)}`
        );
        setResults(data);
        setOpen(true);
      } catch (err) {
        console.error('Search error:', err);
      } finally {
        setSearching(false);
      }
    }, 180);

    return () => clearTimeout(timer);
  }, [query]);

  const totalHits =
    (results?.employees.length || 0) +
    (results?.departments.length || 0) +
    (results?.requisitions.length || 0);

  return (
    <div ref={containerRef} className="relative w-full max-w-md">
      <div className="relative flex items-center">
        <Search className="w-4 h-4 text-slate-400 absolute left-3 pointer-events-none" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => {
            if (results && query.trim()) setOpen(true);
          }}
          placeholder="Search employees, roles, or departments..."
          aria-label="Global search across employees, roles, and departments"
          className="w-full pl-9 pr-8 py-1.5 text-sm bg-slate-50 border border-slate-200 rounded-md text-slate-900 placeholder:text-slate-400 focus:outline-none focus:bg-white focus:border-slate-400 transition-colors"
        />
        {query && (
          <button
            type="button"
            onClick={() => {
              setQuery('');
              setResults(null);
              setOpen(false);
            }}
            aria-label="Clear search"
            className="absolute right-2.5 text-slate-400 hover:text-slate-700 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {open && results && (
        <div className="absolute left-0 right-0 mt-1.5 bg-white border border-slate-200 rounded-lg shadow-lg z-40 max-h-96 overflow-y-auto divide-y divide-slate-100">
          {searching && (
            <div className="px-4 py-2.5 text-xs text-slate-500">Searching directory...</div>
          )}

          {!searching && totalHits === 0 && (
            <div className="px-4 py-4 text-xs text-slate-500 text-center">
              No employees, roles, or departments matched &ldquo;{query}&rdquo;.
            </div>
          )}

          {results.employees.length > 0 && (
            <div className="py-1.5">
              <div className="px-3 py-1 text-[11px] font-medium text-slate-400">
                Employees
              </div>
              {results.employees.map((emp) => (
                <button
                  key={emp.id}
                  type="button"
                  onClick={() => {
                    onSelectEmployee(emp.id);
                    setOpen(false);
                  }}
                  className="w-full text-left px-3 py-2 hover:bg-slate-50 flex items-center justify-between gap-3 cursor-pointer"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-900 truncate">{emp.name}</p>
                    <p className="text-xs text-slate-500 truncate">
                      {emp.role} · {emp.location}
                    </p>
                  </div>
                  <span className="text-xs font-mono text-slate-500 shrink-0">
                    {emp.employeeCode}
                  </span>
                </button>
              ))}
            </div>
          )}

          {results.departments.length > 0 && (
            <div className="py-1.5">
              <div className="px-3 py-1 text-[11px] font-medium text-slate-400">
                Departments
              </div>
              {results.departments.map((dept) => (
                <button
                  key={dept.id}
                  type="button"
                  onClick={() => {
                    onSelectDepartment(dept.id);
                    setOpen(false);
                  }}
                  className="w-full text-left px-3 py-2 hover:bg-slate-50 flex items-center justify-between gap-3 cursor-pointer"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-900 truncate">{dept.name}</p>
                    <p className="text-xs text-slate-500 truncate">Lead: {dept.leadName}</p>
                  </div>
                  <span className="text-xs font-mono text-slate-500 shrink-0">{dept.code}</span>
                </button>
              ))}
            </div>
          )}

          {results.requisitions.length > 0 && (
            <div className="py-1.5">
              <div className="px-3 py-1 text-[11px] font-medium text-slate-400">
                Open Roles &amp; Requisitions
              </div>
              {results.requisitions.map((req) => (
                <button
                  key={req.id}
                  type="button"
                  onClick={() => {
                    onSelectRequisition(req.id);
                    setOpen(false);
                  }}
                  className="w-full text-left px-3 py-2 hover:bg-slate-50 flex items-center justify-between gap-3 cursor-pointer"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-900 truncate">{req.roleTitle}</p>
                    <p className="text-xs text-slate-500 truncate">
                      {req.urgency} Urgency · {req.status}
                    </p>
                  </div>
                  <span className="text-xs font-mono text-slate-500 shrink-0">{req.reqCode}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
