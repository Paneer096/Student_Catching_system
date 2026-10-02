import React, { useState, useEffect } from 'react';
import { api, DashboardSummary } from '../api/client';

export interface DashboardViewProps {
  onNavigate: (viewId: string, params?: any) => void;
  onSelectStudent?: (studentId: string) => void;
  activeSection?: string;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  onNavigate,
  onSelectStudent,
  activeSection = 'CS-3B',
}) => {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isDevLoading, setIsDevLoading] = useState(false);

  const fetchSummary = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getDashboardSummary(activeSection);
      setSummary(data);
    } catch (err: any) {
      setError(err?.message || 'Failed to connect to backend server');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSummary();
  }, [activeSection]);

  const handleDevLoadSample = async () => {
    setIsDevLoading(true);
    try {
      await api.loadSampleData();
      await fetchSummary();
    } catch (err: any) {
      alert(`Failed to load sample data: ${err.message}`);
    } finally {
      setIsDevLoading(false);
    }
  };

  const handleExportReport = () => {
    if (!summary) return;
    const blob = new Blob([JSON.stringify(summary, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Makerove_Report_${activeSection}_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="h-[60vh] flex flex-col items-center justify-center space-y-3">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        <p className="text-xs font-medium text-on-surface-variant">Loading classroom intelligence...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-xl mx-auto py-16 text-center space-y-4">
        <div className="p-8 bg-surface-container-lowest border border-error/30 rounded-2xl shadow-xs space-y-3">
          <span className="material-symbols-outlined text-[36px] text-error">cloud_off</span>
          <h2 className="text-base font-bold text-on-surface">Unable to load dashboard data</h2>
          <p className="text-xs text-on-surface-variant">{error}</p>
          <button
            onClick={fetchSummary}
            className="px-4 py-2 bg-primary text-on-primary rounded-xl text-xs font-semibold hover:opacity-90 transition-opacity cursor-pointer inline-flex items-center gap-1.5"
          >
            <span className="material-symbols-outlined text-[16px]">refresh</span> Retry
          </button>
        </div>
      </div>
    );
  }

  // Honest Empty State
  if (!summary || !summary.has_data || summary.total_students === 0) {
    return (
      <div className="max-w-xl mx-auto py-16 text-center space-y-5">
        <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-10 space-y-4 shadow-xs">
          <div className="w-14 h-14 rounded-2xl bg-secondary-container/40 text-primary flex items-center justify-center mx-auto">
            <span className="material-symbols-outlined text-[32px]">folder_off</span>
          </div>
          <div>
            <h2 className="text-base font-bold text-on-surface">No Records Ingested for Section {activeSection}</h2>
            <p className="text-xs text-on-surface-variant mt-1.5 leading-relaxed">
              Upload an attendance register to view live classroom metrics, social cohorts, and mass bunk predictions.
            </p>
          </div>

          <div className="flex flex-wrap justify-center gap-2.5 pt-2">
            <button
              onClick={() => onNavigate('ingestion')}
              className="px-4 py-2 bg-primary text-on-primary rounded-xl text-xs font-semibold hover:opacity-90 transition-all flex items-center gap-2 shadow-xs cursor-pointer"
            >
              <span className="material-symbols-outlined text-[16px]">upload_file</span>
              Upload Attendance CSV
            </button>

            {import.meta.env.DEV && (
              <button
                onClick={handleDevLoadSample}
                disabled={isDevLoading}
                className="px-4 py-2 bg-secondary-container text-on-secondary-container border border-secondary/30 rounded-xl text-xs font-semibold hover:opacity-90 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-[16px]">
                  {isDevLoading ? 'sync' : 'science'}
                </span>
                {isDevLoading ? 'Loading...' : 'Load Sample Data'}
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-5 pb-6">
      {/* Minimal Header */}
      <div className="flex flex-wrap justify-between items-center gap-3">
        <div>
          <h1 className="text-xl font-bold text-primary tracking-tight">Classroom Overview</h1>
          <p className="text-xs text-on-surface-variant mt-0.5">
            Key attendance metrics and absence risk alerts for Section {activeSection}.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => onNavigate('graph')}
            className="px-3 py-1.5 bg-primary text-on-primary rounded-lg text-xs font-semibold hover:opacity-90 transition-all flex items-center gap-1.5 shadow-xs cursor-pointer"
          >
            <span className="material-symbols-outlined text-[16px]">hub</span>
            Open Knowledge Graph
          </button>
          <button
            onClick={handleExportReport}
            className="px-3 py-1.5 bg-surface-container-lowest border border-outline-variant rounded-lg text-on-surface-variant hover:text-primary text-xs font-medium transition-colors shadow-2xs flex items-center gap-1.5 cursor-pointer"
            title="Download JSON Report"
          >
            <span className="material-symbols-outlined text-[16px]">download</span>
            Export
          </button>
        </div>
      </div>

      {/* ─── 4 Clean, High-Impact Metric Cards ───────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        {/* Attendance Rate */}
        <div className="p-4 bg-surface-container-lowest border border-outline-variant rounded-xl shadow-2xs flex flex-col justify-between">
          <span className="text-[11px] font-medium text-on-surface-variant uppercase tracking-wider">
            Attendance Rate
          </span>
          <div className="mt-1 flex items-baseline gap-2">
            <span
              className={`text-2xl font-bold ${
                summary.attendance_rate < 75 ? 'text-error' : 'text-primary'
              }`}
            >
              {summary.attendance_rate}%
            </span>
          </div>
          <span className="text-[10px] text-on-surface-variant mt-1.5">Across all enrolled slots</span>
        </div>

        {/* Mass Bunk Events */}
        <div
          onClick={() => onNavigate('alerts')}
          className="p-4 bg-surface-container-lowest border border-outline-variant hover:border-error/50 rounded-xl shadow-2xs flex flex-col justify-between cursor-pointer transition-colors group"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-on-surface-variant uppercase tracking-wider">
              Mass Bunk Events
            </span>
            <span className="material-symbols-outlined text-[16px] text-error">priority_high</span>
          </div>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="text-2xl font-bold text-error">{summary.mass_bunks_count}</span>
            <span className="text-[11px] text-on-surface-variant">detected</span>
          </div>
          <span className="text-[10px] text-primary group-hover:underline mt-1.5 flex items-center gap-0.5">
            View coordinated sessions &rarr;
          </span>
        </div>

        {/* Priority Absence Cohorts */}
        <div
          onClick={() => onNavigate('graph')}
          className="p-4 bg-surface-container-lowest border border-outline-variant hover:border-primary/50 rounded-xl shadow-2xs flex flex-col justify-between cursor-pointer transition-colors group"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-on-surface-variant uppercase tracking-wider">
              Student Cohorts
            </span>
            <span className="material-symbols-outlined text-[16px] text-primary">hub</span>
          </div>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="text-2xl font-bold text-primary">{summary.cohorts_count}</span>
            <span className="text-[11px] text-on-surface-variant">cliques</span>
          </div>
          <span className="text-[10px] text-primary group-hover:underline mt-1.5 flex items-center gap-0.5">
            Inspect network graph &rarr;
          </span>
        </div>

        {/* Enrolled Students */}
        <div
          onClick={() => onNavigate('students')}
          className="p-4 bg-surface-container-lowest border border-outline-variant hover:border-primary/50 rounded-xl shadow-2xs flex flex-col justify-between cursor-pointer transition-colors group"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-on-surface-variant uppercase tracking-wider">
              Enrolled Students
            </span>
            <span className="material-symbols-outlined text-[16px] text-outline">groups</span>
          </div>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="text-2xl font-bold text-on-surface">{summary.total_students}</span>
            <span className="text-[11px] text-on-surface-variant">active</span>
          </div>
          <span className="text-[10px] text-primary group-hover:underline mt-1.5 flex items-center gap-0.5">
            View student roster &rarr;
          </span>
        </div>
      </div>

      {/* ─── Two-Column Action Layout: Left (Priority Cohorts) / Right (Weekly + Alerts) ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left Column: Flagged Student Cohorts & Anchors (Col 7) */}
        <div className="lg:col-span-7 bg-surface-container-lowest border border-outline-variant rounded-xl shadow-xs flex flex-col overflow-hidden">
          <div className="px-4 py-3 bg-surface-container-low border-b border-outline-variant flex justify-between items-center">
            <h2 className="text-xs font-bold text-on-surface uppercase tracking-wider flex items-center gap-1.5">
              <span className="material-symbols-outlined text-primary text-[16px]">group_alert</span>
              Flagged Co-Absence Cohorts
            </h2>
            <button
              onClick={() => onNavigate('graph')}
              className="text-[11px] text-primary font-semibold hover:underline flex items-center"
            >
              Graph View &rarr;
            </button>
          </div>

          <div className="p-4 flex-1">
            {!summary.flagged_cohorts || summary.flagged_cohorts.length === 0 ? (
              <div className="py-12 text-center text-xs text-on-surface-variant">
                No high-density co-absence cliques detected. Students attend classes independently.
              </div>
            ) : (
              <div className="space-y-2.5">
                {summary.flagged_cohorts.slice(0, 4).map((cohort, idx) => {
                  const membersList = cohort.members || [];
                  const displaySize = cohort.size || membersList.length || 1;
                  const anchorDisplay = cohort.top_peer || cohort.anchor_name || cohort.anchor_roll;
                  const isHigh = cohort.risk === 'HIGH' || cohort.risk_level === 'High';

                  return (
                    <div
                      key={`${cohort.id || 'cohort'}-${cohort.anchor_roll || idx}`}
                      className="p-3 rounded-lg bg-surface border border-outline-variant/70 hover:border-primary/50 transition-all flex items-center justify-between gap-3 text-xs"
                    >
                      <div className="space-y-0.5 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-on-surface">{cohort.name}</span>
                          <span
                            className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${
                              isHigh
                                ? 'bg-rose-500/15 text-rose-600 dark:text-rose-400'
                                : 'bg-secondary-container text-on-secondary-container'
                            }`}
                          >
                            {isHigh ? 'High Risk' : 'Medium Risk'}
                          </span>
                        </div>
                        <div className="text-[11px] text-on-surface-variant truncate">
                          Anchor: <span className="font-semibold text-primary">{anchorDisplay}</span> • {displaySize} students
                        </div>
                      </div>

                      <button
                        onClick={() => {
                          onSelectStudent?.(cohort.anchor_roll || cohort.top_peer);
                          onNavigate('graph', { studentId: cohort.anchor_roll });
                        }}
                        className="px-2.5 py-1 bg-surface-container hover:bg-primary hover:text-on-primary rounded text-[11px] font-semibold text-on-surface transition-colors cursor-pointer shrink-0"
                      >
                        Inspect
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Weekly Presence Rhythm & Recent Mass Bunks (Col 5) */}
        <div className="lg:col-span-5 space-y-4">
          {/* Weekly Presence Rhythm */}
          <div className="p-4 bg-surface-container-lowest border border-outline-variant rounded-xl shadow-xs">
            <div className="flex justify-between items-center mb-3">
              <span className="text-xs font-bold text-on-surface uppercase tracking-wider">
                Weekly Attendance Trend
              </span>
              <span className="text-[10px] font-mono text-on-surface-variant">By Timetable Day</span>
            </div>

            <div className="h-28 flex items-end justify-between gap-2 px-1 border-b border-outline-variant pb-2">
              {(summary.weekly_activity || []).map((w, idx) => {
                const attRate = w.attendance ?? w.rate ?? 0;
                const heightPct = Math.max(8, Math.min(100, Math.round(attRate)));
                const hasBunks = (w.bunk_count ?? 0) > 0 || Boolean(w.is_peak_risk);
                const dayName = (w.day || '').slice(0, 3);

                return (
                  <div key={idx} className="flex-1 flex flex-col items-center justify-end h-full group relative">
                    <div
                      style={{ height: `${heightPct}%` }}
                      className={`w-full max-w-[28px] rounded-t-sm transition-all ${
                        hasBunks
                          ? 'bg-rose-500 hover:bg-rose-600'
                          : 'bg-primary/75 hover:bg-primary'
                      }`}
                      title={`${dayName}: ${attRate}% attendance (${w.bunk_count ?? 0} bunks)`}
                    />
                    <div className="absolute -top-6 bg-inverse-surface text-inverse-on-surface text-[9px] px-1.5 py-0.5 rounded hidden group-hover:block whitespace-nowrap z-10 pointer-events-none">
                      {attRate}%
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex justify-between text-[11px] text-on-surface-variant font-medium px-1 mt-1.5">
              {(summary.weekly_activity || []).map((w, idx) => (
                <span
                  key={idx}
                  className={(w.bunk_count ?? 0) > 0 || w.is_peak_risk ? 'font-bold text-rose-500' : ''}
                >
                  {(w.day || '').slice(0, 3)}
                </span>
              ))}
            </div>
          </div>

          {/* Recent Mass Bunk Alerts */}
          <div className="bg-surface-container-lowest border border-outline-variant rounded-xl shadow-xs overflow-hidden">
            <div className="px-4 py-2.5 bg-surface-container-low border-b border-outline-variant flex justify-between items-center">
              <span className="text-xs font-bold text-on-surface uppercase tracking-wider flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-rose-500" /> Recent Mass Bunks
              </span>
              <button
                onClick={() => onNavigate('alerts')}
                className="text-[11px] text-primary font-semibold hover:underline"
              >
                All Alerts &rarr;
              </button>
            </div>

            <div className="p-3 divide-y divide-outline-variant/60 text-xs">
              {!summary.recent_alerts || summary.recent_alerts.length === 0 ? (
                <div className="py-4 text-center text-on-surface-variant text-[11px]">
                  No mass bunks detected in this window.
                </div>
              ) : (
                summary.recent_alerts.slice(0, 3).map((alert, idx) => (
                  <div
                    key={alert.id || idx}
                    onClick={() => onNavigate('alerts')}
                    className="py-2.5 first:pt-1 last:pb-1 hover:bg-surface-container-low transition-colors cursor-pointer rounded px-2 -mx-2"
                  >
                    <div className="flex justify-between items-center">
                      <span className="font-semibold text-on-surface">{alert.title}</span>
                      <span className="text-[10px] font-mono text-on-surface-variant">
                        {alert.date || alert.time}
                      </span>
                    </div>
                    <div className="text-[11px] text-on-surface-variant flex justify-between mt-0.5">
                      <span>{alert.absentees ?? 0} coordinated absentees</span>
                      <span className="text-rose-500 font-bold text-[10px]">INSPECT</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
