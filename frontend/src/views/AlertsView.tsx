import React, { useState, useEffect } from 'react';
import { api, MassBunkEvent } from '../api/client';

export interface AlertsViewProps {
  onNavigate: (viewId: string, params?: any) => void;
  activeSection?: string;
}

export const AlertsView: React.FC<AlertsViewProps> = ({
  onNavigate,
  activeSection = 'CS-3B',
}) => {
  const [bunks, setBunks] = useState<MassBunkEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterSeverity, setFilterSeverity] = useState<'all' | 'critical' | 'moderate'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const fetchBunks = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getMassBunks(activeSection);
      setBunks(data);
    } catch (err: any) {
      setError(err?.message || 'Failed to load detected mass bunks');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBunks();
  }, [activeSection]);

  const filteredBunks = bunks.filter((b) => {
    const isCritical = b.risk_score >= 50 || b.absent_percentage >= 40;
    if (filterSeverity === 'critical' && !isCritical) return false;
    if (filterSeverity === 'moderate' && isCritical) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchSubj = b.subject_code.toLowerCase().includes(q);
      const matchDay = b.day.toLowerCase().includes(q);
      const matchDate = b.date.includes(q);
      const matchAnchor = b.structural_anchor?.name.toLowerCase().includes(q) || b.structural_anchor?.roll_no.toLowerCase().includes(q);
      const matchRoll = b.participating_roll_numbers.some((r) => r.toLowerCase().includes(q));
      if (!matchSubj && !matchDay && !matchDate && !matchAnchor && !matchRoll) return false;
    }
    return true;
  });

  if (loading) {
    return (
      <div className="h-[calc(100vh-140px)] flex flex-col items-center justify-center space-y-3">
        <div className="w-10 h-10 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        <p className="text-xs font-medium text-on-surface-variant">Scanning attendance registers for coordinated absences...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-4xl mx-auto py-12">
        <div className="p-6 bg-surface-container-lowest border border-error/30 rounded-2xl text-center space-y-3 shadow-xs">
          <span className="material-symbols-outlined text-[36px] text-error">warning</span>
          <h2 className="text-base font-bold text-on-surface">Detection Error</h2>
          <p className="text-xs text-on-surface-variant max-w-md mx-auto">{error}</p>
          <button
            onClick={fetchBunks}
            className="px-4 py-2 bg-primary text-on-primary rounded-xl text-xs font-semibold hover:opacity-90 transition-opacity cursor-pointer inline-flex items-center gap-1.5"
          >
            <span className="material-symbols-outlined text-[16px]">refresh</span> Retry Detection
          </button>
        </div>
      </div>
    );
  }

  // Honest Empty State
  if (bunks.length === 0) {
    return (
      <div className="max-w-2xl mx-auto py-16 text-center space-y-4">
        <div className="w-12 h-12 rounded-2xl bg-secondary-container/40 text-primary flex items-center justify-center mx-auto">
          <span className="material-symbols-outlined text-[28px]">verified</span>
        </div>
        <div>
          <h2 className="text-base font-bold text-on-surface">No Coordinated Mass Bunks Detected</h2>
          <p className="text-xs text-on-surface-variant mt-1.5 leading-relaxed">
            All attendance sessions for Section {activeSection} remain within normal dispersion limits (&lt; 25% coordinated absenteeism).
          </p>
        </div>
        <button
          onClick={() => onNavigate('dashboard')}
          className="px-4 py-2 bg-primary text-on-primary rounded-xl text-xs font-semibold hover:opacity-90 inline-flex items-center gap-1.5 cursor-pointer shadow-xs"
        >
          <span className="material-symbols-outlined text-[16px]">dashboard</span> Return to Dashboard
        </button>
      </div>
    );
  }

  const criticalCount = bunks.filter((b) => b.risk_score >= 50 || b.absent_percentage >= 40).length;

  return (
    <div className="max-w-5xl mx-auto space-y-3 pb-8">
      {/* ─── Minimalist Header Bar ──────────────────────────────────────────────── */}
      <div className="flex flex-wrap justify-between items-center gap-2 px-1">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-base font-bold text-on-surface tracking-tight">Classroom Mass Bunk Alerts</h1>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-surface-container text-on-surface-variant border border-outline-variant">
              Section {activeSection}
            </span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30">
              {criticalCount} Critical Episodes
            </span>
          </div>
          <p className="text-[11px] text-on-surface-variant mt-0.5">
            Algorithmic group absence detection verified from attendance logs
          </p>
        </div>

        {/* Minimal Controls */}
        <div className="flex items-center gap-2">
          {/* Quick Search */}
          <div className="relative">
            <input
              type="text"
              placeholder="Search roll, subject..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-surface-container-lowest border border-outline-variant rounded-lg text-xs px-2.5 py-1 pl-7 text-on-surface w-40 focus:w-52 transition-all focus:outline-none focus:border-primary"
            />
            <span className="material-symbols-outlined text-[15px] text-on-surface-variant absolute left-2 top-1.5 pointer-events-none">
              search
            </span>
          </div>

          {/* Severity Filter Pills */}
          <div className="flex items-center bg-surface-container-lowest border border-outline-variant rounded-lg p-0.5 text-xs">
            <button
              onClick={() => setFilterSeverity('all')}
              className={`px-2 py-0.5 rounded transition-all cursor-pointer ${
                filterSeverity === 'all'
                  ? 'bg-primary text-on-primary font-bold shadow-2xs'
                  : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              All ({bunks.length})
            </button>
            <button
              onClick={() => setFilterSeverity('critical')}
              className={`px-2 py-0.5 rounded transition-all cursor-pointer ${
                filterSeverity === 'critical'
                  ? 'bg-rose-500 text-white font-bold shadow-2xs'
                  : 'text-rose-600 dark:text-rose-400 hover:bg-rose-500/10'
              }`}
            >
              Critical ({criticalCount})
            </button>
          </div>

          <button
            onClick={fetchBunks}
            className="p-1 rounded-lg border border-outline-variant bg-surface-container-lowest text-on-surface-variant hover:text-primary transition-colors cursor-pointer"
            title="Refresh alerts"
          >
            <span className="material-symbols-outlined text-[18px]">refresh</span>
          </button>
        </div>
      </div>

      {/* ─── Minimalist Dense Alert List ────────────────────────────────────────── */}
      <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl divide-y divide-outline-variant/60 shadow-xs overflow-hidden">
        {filteredBunks.length === 0 ? (
          <div className="py-8 text-center text-xs text-on-surface-variant">
            No alerts match your filter criteria.
          </div>
        ) : (
          filteredBunks.map((bunk) => {
            const isCritical = bunk.risk_score >= 50 || bunk.absent_percentage >= 40;

            return (
              <div
                key={bunk.id}
                className="p-3.5 hover:bg-surface-container-low transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
              >
                {/* Left: Severity dot, timing & subject */}
                <div className="flex items-start gap-3 min-w-0">
                  <div
                    className={`w-2.5 h-2.5 rounded-full mt-1.5 shrink-0 ${
                      isCritical ? 'bg-rose-500 ring-4 ring-rose-500/20' : 'bg-amber-500 ring-4 ring-amber-500/20'
                    }`}
                    title={isCritical ? 'Critical Severity' : 'Moderate Severity'}
                  />

                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-on-surface text-xs">
                        {bunk.day}, Period {bunk.period}
                      </span>
                      <span className="font-mono text-[10px] px-1.5 py-0.2 rounded bg-surface-container text-on-surface-variant border border-outline-variant/60">
                        {bunk.subject_code}
                      </span>
                      <span className="text-[10px] font-mono text-on-surface-variant">
                        {bunk.date}
                      </span>
                      <span
                        className={`text-[9px] font-bold px-1.5 py-0.2 rounded ${
                          isCritical
                            ? 'bg-rose-500/15 text-rose-600 dark:text-rose-400'
                            : 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
                        }`}
                      >
                        {bunk.absent_count}/{bunk.total_enrolled} Absent ({Math.round(bunk.absent_percentage)}%)
                      </span>
                    </div>

                    {/* Anchor & summary in a clean one-liner */}
                    <div className="flex items-center gap-2 text-[11px] text-on-surface-variant mt-1 truncate">
                      {bunk.structural_anchor && (
                        <span>
                          Anchor: <span className="font-semibold text-on-surface">{bunk.structural_anchor.name}</span>{' '}
                          <span className="font-mono text-[10px]">({bunk.structural_anchor.roll_no})</span>
                        </span>
                      )}
                      <span>•</span>
                      <span className="truncate">{bunk.reason}</span>
                    </div>
                  </div>
                </div>

                {/* Right: Quick Minimalist Actions */}
                <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                  <button
                    onClick={() => {
                      if (bunk.structural_anchor) {
                        onNavigate('knowledge-graph', { studentId: bunk.structural_anchor.roll_no });
                      } else {
                        onNavigate('knowledge-graph');
                      }
                    }}
                    className="px-2.5 py-1 text-[11px] font-semibold text-primary hover:bg-primary/10 rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[14px]">account_tree</span>
                    Graph
                  </button>

                  <button
                    onClick={() => onNavigate('interventions', { date: bunk.date })}
                    className="px-2.5 py-1 text-[11px] font-semibold bg-primary text-on-primary rounded-lg hover:opacity-90 transition-opacity flex items-center gap-1 cursor-pointer shadow-2xs"
                  >
                    <span className="material-symbols-outlined text-[13px]">flag</span>
                    Intervene
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

