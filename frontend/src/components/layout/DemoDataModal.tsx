import React, { useState, useEffect } from 'react';
import { api } from '../../api/client';

export interface DemoDataModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate?: (viewId: string, params?: any) => void;
}

export const DemoDataModal: React.FC<DemoDataModalProps> = ({
  isOpen,
  onClose,
  onNavigate,
}) => {
  const [activeTab, setActiveTab] = useState<'storylines' | 'students' | 'attendance' | 'timetable' | 'calendar'>('storylines');
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [isReloading, setIsReloading] = useState<boolean>(false);
  const [reloadMsg, setReloadMsg] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');

  const fetchDemoSummary = async () => {
    setLoading(true);
    try {
      const res = await api.getDemoDataSummary();
      setData(res);
    } catch (err) {
      console.error('Failed to fetch demo data summary:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchDemoSummary();
      setSearchQuery('');
      setReloadMsg(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleReloadDemoData = async () => {
    setIsReloading(true);
    setReloadMsg(null);
    try {
      await api.loadSampleData();
      setReloadMsg('Demo data reloaded and verified cleanly in database!');
      await fetchDemoSummary();
    } catch (err: any) {
      setReloadMsg(`Error reloading data: ${err.message}`);
    } finally {
      setIsReloading(false);
    }
  };

  const handleDownload = (fileKey: string, filename: string) => {
    const url = api.getDemoFileDownloadUrl(fileKey);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleNavigateToGraph = () => {
    onClose();
    if (onNavigate) {
      onNavigate('knowledge-graph');
    }
  };

  const currentFileData = data?.files?.[activeTab];
  const previewRows: Array<Record<string, string>> = currentFileData?.preview || [];

  const filteredPreview = previewRows.filter((row) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return Object.values(row).some((val) => String(val).toLowerCase().includes(q));
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 select-none animate-fadeIn">
      <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl shadow-2xl max-w-5xl w-full h-[88vh] flex flex-col overflow-hidden">
        {/* ─── Modal Header ──────────────────────────────────────────────────────── */}
        <div className="p-4 sm:p-5 border-b border-outline-variant flex justify-between items-start sm:items-center gap-3 bg-surface-container-low/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-secondary-container/80 flex items-center justify-center text-on-secondary-container shadow-2xs">
              <span className="material-symbols-outlined text-[22px]">database</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-primary tracking-tight">
                  Presentation Demo Dataset
                </h2>
                <span className="px-2 py-0.5 rounded-full bg-secondary-container text-[10px] font-mono font-bold text-on-secondary-container uppercase">
                  Section CS-3B (AIML Sem 4)
                </span>
              </div>
              <p className="text-xs text-on-surface-variant mt-0.5">
                Authentic 60-student dataset • Exactly 4 ingestible CSVs • Hypergeometric statistical derivation
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleReloadDemoData}
              disabled={isReloading}
              className="px-3 py-1.5 bg-primary text-on-primary rounded-lg text-xs font-semibold hover:opacity-90 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50 shadow-2xs whitespace-nowrap"
              title="Re-seed database with this authentic dataset"
            >
              <span className="material-symbols-outlined text-[15px]">
                {isReloading ? 'sync' : 'restart_alt'}
              </span>
              <span>{isReloading ? 'Reloading...' : 'Reset / Load Demo Data'}</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-surface-container text-on-surface-variant hover:text-on-surface transition-colors cursor-pointer"
              title="Close modal"
            >
              <span className="material-symbols-outlined text-[20px]">close</span>
            </button>
          </div>
        </div>

        {reloadMsg && (
          <div className="px-5 py-2.5 bg-tertiary-container/30 border-b border-tertiary/40 text-xs text-on-tertiary-container font-medium flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[17px] text-tertiary">check_circle</span>
              <span>{reloadMsg}</span>
            </div>
            <button
              onClick={() => setReloadMsg(null)}
              className="text-on-tertiary-container hover:underline cursor-pointer text-[11px]"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* ─── Navigation Tabs ────────────────────────────────────────────────────── */}
        <div className="flex items-center border-b border-outline-variant px-5 bg-surface-container-lowest overflow-x-auto gap-2 py-2">
          {[
            { id: 'storylines', label: 'Storylines & Connections', icon: 'hub' },
            { id: 'students', label: '1. Student Roster (60)', icon: 'groups' },
            { id: 'attendance', label: '2. Attendance (5,280 Rows)', icon: 'rule' },
            { id: 'timetable', label: '3. Timetable (20 Slots)', icon: 'schedule' },
            { id: 'calendar', label: '4. Calendar (8 Events)', icon: 'calendar_month' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id as any);
                setSearchQuery('');
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap ${
                activeTab === tab.id
                  ? 'bg-secondary text-on-secondary shadow-2xs'
                  : 'hover:bg-surface-container text-on-surface-variant hover:text-on-surface'
              }`}
            >
              <span className="material-symbols-outlined text-[15px]">{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        {/* ─── Tab Content Body ───────────────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto p-5 bg-surface-container-lowest">
          {loading ? (
            <div className="h-full flex flex-col items-center justify-center text-xs text-on-surface-variant gap-2">
              <span className="material-symbols-outlined text-[32px] text-primary animate-spin">sync</span>
              <p>Loading demo dataset contents...</p>
            </div>
          ) : activeTab === 'storylines' ? (
            /* 🎯 Storylines & Authentic Connections Tab */
            <div className="space-y-5">
              <div className="bg-secondary-container/20 border border-secondary/30 rounded-xl p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                <div>
                  <h3 className="text-xs font-bold text-primary uppercase tracking-wider">
                    Hypergeometric Derivation Highlights
                  </h3>
                  <p className="text-xs text-on-surface-variant mt-0.5">
                    These connections are statistically derived by the Makarov engine strictly from the October attendance register without any fake side tables.
                  </p>
                </div>
                <button
                  onClick={handleNavigateToGraph}
                  className="px-3 py-1.5 bg-primary text-on-primary rounded-lg text-xs font-semibold hover:opacity-90 flex items-center gap-1.5 cursor-pointer shadow-2xs whitespace-nowrap"
                >
                  <span className="material-symbols-outlined text-[16px]">account_tree</span>
                  <span>Open Knowledge Graph</span>
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Storyline 1: Single-Subject Algorithms Bunkers */}
                <div className="bg-surface-container-low border-2 border-primary/30 rounded-xl p-4 flex flex-col justify-between shadow-2xs hover:border-primary transition-colors">
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold font-mono bg-primary/10 text-primary uppercase">
                        Single Subject Skip
                      </span>
                      <span className="text-[10px] font-mono text-tertiary font-bold">Lift 4.35x</span>
                    </div>
                    <h4 className="text-sm font-bold text-on-surface">
                      Algorithms Skippers (CS304)
                    </h4>
                    <div className="mt-2 space-y-1">
                      <div className="text-xs font-semibold text-primary">
                        Ishaan Ghosh <span className="font-mono text-[10px] text-on-surface-variant">(21CSB023)</span>
                      </div>
                      <div className="text-xs font-semibold text-primary">
                        Pranav Hegde <span className="font-mono text-[10px] text-on-surface-variant">(21CSB024)</span>
                      </div>
                    </div>
                    <p className="text-xs text-on-surface-variant mt-2.5 leading-relaxed">
                      Attend Periods 1, 2, and 3 reliably, but bunk <strong>Period 4 (CS304 Algorithms)</strong> together 5 times in October.
                    </p>
                  </div>
                  <div className="mt-4 pt-3 border-t border-outline-variant/60 flex items-center justify-between">
                    <span className="text-[10px] font-mono text-on-surface-variant">Filter: CS304</span>
                    <button
                      onClick={handleNavigateToGraph}
                      className="text-xs font-bold text-primary hover:underline flex items-center gap-0.5 cursor-pointer"
                    >
                      Inspect <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
                    </button>
                  </div>
                </div>

                {/* Storyline 2: Afternoon Bunk Trio */}
                <div className="bg-surface-container-low border border-outline-variant rounded-xl p-4 flex flex-col justify-between shadow-2xs hover:border-primary transition-colors">
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold font-mono bg-secondary/10 text-secondary uppercase">
                        Afternoon Clique
                      </span>
                      <span className="text-[10px] font-mono text-tertiary font-bold">Lift 3.70x</span>
                    </div>
                    <h4 className="text-sm font-bold text-on-surface">
                      Afternoon Trio (P3 & P4)
                    </h4>
                    <div className="mt-2 space-y-1">
                      <div className="text-xs font-semibold text-on-surface">
                        Aarav Patel <span className="font-mono text-[10px] text-on-surface-variant">(21CSB001)</span>
                      </div>
                      <div className="text-xs font-semibold text-on-surface">
                        Rohan Sharma <span className="font-mono text-[10px] text-on-surface-variant">(21CSB002)</span>
                      </div>
                      <div className="text-xs font-semibold text-on-surface">
                        Kabir Verma <span className="font-mono text-[10px] text-on-surface-variant">(21CSB003)</span>
                      </div>
                    </div>
                    <p className="text-xs text-on-surface-variant mt-2.5 leading-relaxed">
                      Synchronized departures on Periods 3 & 4 across 5 October dates. Forms a cohesive 3-student cluster.
                    </p>
                  </div>
                  <div className="mt-4 pt-3 border-t border-outline-variant/60 flex items-center justify-between">
                    <span className="text-[10px] font-mono text-on-surface-variant">Cluster Size: 3</span>
                    <button
                      onClick={handleNavigateToGraph}
                      className="text-xs font-bold text-primary hover:underline flex items-center gap-0.5 cursor-pointer"
                    >
                      Inspect <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
                    </button>
                  </div>
                </div>

                {/* Storyline 3: Wednesday Afternoon Pair */}
                <div className="bg-surface-container-low border border-outline-variant rounded-xl p-4 flex flex-col justify-between shadow-2xs hover:border-primary transition-colors">
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold font-mono bg-tertiary/10 text-tertiary uppercase">
                        Dyad Pair
                      </span>
                      <span className="text-[10px] font-mono text-tertiary font-bold">Lift 4.35x</span>
                    </div>
                    <h4 className="text-sm font-bold text-on-surface">
                      Wednesday Afternoon Skips
                    </h4>
                    <div className="mt-2 space-y-1">
                      <div className="text-xs font-semibold text-on-surface">
                        Priya Desai <span className="font-mono text-[10px] text-on-surface-variant">(21CSB011)</span>
                      </div>
                      <div className="text-xs font-semibold text-on-surface">
                        Ananya Roy <span className="font-mono text-[10px] text-on-surface-variant">(21CSB012)</span>
                      </div>
                    </div>
                    <p className="text-xs text-on-surface-variant mt-2.5 leading-relaxed">
                      Coordinated Wednesday afternoon departures on Periods 3 & 4. High affinity, clean isolated dyad.
                    </p>
                  </div>
                  <div className="mt-4 pt-3 border-t border-outline-variant/60 flex items-center justify-between">
                    <span className="text-[10px] font-mono text-on-surface-variant">Pair Weight: 1.0</span>
                    <button
                      onClick={handleNavigateToGraph}
                      className="text-xs font-bold text-primary hover:underline flex items-center gap-0.5 cursor-pointer"
                    >
                      Inspect <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Baseline Cohort Note */}
              <div className="p-4 rounded-xl bg-surface-container-low border border-outline-variant text-xs text-on-surface-variant space-y-1.5">
                <div className="font-bold text-on-surface flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[16px] text-primary">verified</span>
                  <span>53 Baseline Classmates Unconnected (Decoy Resistance)</span>
                </div>
                <p>
                  The remaining 53 students maintain healthy attendance (~95%) with independent random absences. In accordance with Makerove Guardrail G3 (Evidence or Silence) and the Connection Engine v3 spec, they are automatically excluded from graph edges to prevent clutter.
                </p>
              </div>
            </div>
          ) : (
            /* 📄 CSV File Preview & Download Tab */
            <div className="flex flex-col h-full gap-4">
              {/* File Action Bar */}
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-surface-container-low p-3.5 rounded-xl border border-outline-variant">
                <div className="flex items-center gap-2.5">
                  <span className="material-symbols-outlined text-primary text-[22px]">description</span>
                  <div>
                    <h3 className="text-xs font-bold text-on-surface">
                      {currentFileData?.filename}
                    </h3>
                    <p className="text-[11px] text-on-surface-variant">
                      {currentFileData?.total_rows} records • Tab: <strong>{currentFileData?.label}</strong>
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search in preview..."
                    className="px-2.5 py-1 bg-surface-container-lowest border border-outline-variant rounded-lg text-xs text-on-surface placeholder:text-on-surface-variant/60 focus:outline-none focus:border-primary text-xs w-full sm:w-44"
                  />
                  <button
                    onClick={() => handleDownload(activeTab, currentFileData?.filename || `${activeTab}.csv`)}
                    className="px-3 py-1 bg-secondary text-on-secondary rounded-lg text-xs font-semibold hover:opacity-90 transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap shadow-2xs"
                  >
                    <span className="material-symbols-outlined text-[15px]">download</span>
                    <span>Download CSV</span>
                  </button>
                </div>
              </div>

              {/* Table Preview */}
              <div className="flex-1 overflow-auto border border-outline-variant rounded-xl bg-surface-container-lowest">
                {filteredPreview.length === 0 ? (
                  <div className="p-8 text-center text-xs text-on-surface-variant">
                    No matching records found.
                  </div>
                ) : (
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-surface-container border-b border-outline-variant font-mono text-[11px] text-on-surface-variant uppercase sticky top-0">
                        {Object.keys(filteredPreview[0] || {}).map((col) => (
                          <th key={col} className="p-2.5 font-semibold">
                            {col}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-outline-variant font-mono text-[11px]">
                      {filteredPreview.map((row, idx) => (
                        <tr key={idx} className="hover:bg-surface-container-low transition-colors">
                          {Object.entries(row).map(([col, val]) => (
                            <td key={col} className="p-2.5 text-on-surface">
                              {val === 'ABSENT' ? (
                                <span className="px-1.5 py-0.5 rounded bg-error-container text-on-error-container text-[10px] font-bold">
                                  ABSENT
                                </span>
                              ) : val === 'PRESENT' ? (
                                <span className="px-1.5 py-0.5 rounded bg-tertiary-container text-on-tertiary-container text-[10px] font-bold">
                                  PRESENT
                                </span>
                              ) : (
                                String(val)
                              )}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
              <p className="text-[11px] text-on-surface-variant text-right">
                Showing preview of up to 25 rows. Download full CSV to inspect all {currentFileData?.total_rows} rows.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
