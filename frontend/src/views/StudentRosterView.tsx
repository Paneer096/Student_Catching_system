import React, { useState, useEffect } from 'react';
import { api, StudentRosterItem, StudentDossier } from '../api/client';

export interface StudentRosterViewProps {
  onNavigate: (viewId: string, params?: any) => void;
  onSelectStudent?: (studentId: string) => void;
  initialStudentId?: string;
  activeSection?: string;
}

export const StudentRosterView: React.FC<StudentRosterViewProps> = ({
  onNavigate,
  onSelectStudent,
  initialStudentId,
  activeSection = 'CS-3B',
}) => {
  const [students, setStudents] = useState<StudentRosterItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Selected student & detailed profile dossier
  const [selectedRollNo, setSelectedRollNo] = useState<string | null>(initialStudentId || null);
  const [dossier, setDossier] = useState<StudentDossier | null>(null);
  const [dossierLoading, setDossierLoading] = useState(false);

  // Filter & Search
  const [filterType, setFilterType] = useState<'all' | 'anchors' | 'at_risk' | 'good'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Fetch full student roster
  const fetchRoster = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getStudentsRoster(activeSection);
      setStudents(data);

      // Determine initial selection
      if (data.length > 0) {
        const target =
          (selectedRollNo && data.find((s) => s.roll_no === selectedRollNo)) ||
          (initialStudentId && data.find((s) => s.roll_no === initialStudentId)) ||
          data[0];
        if (target) {
          setSelectedRollNo(target.roll_no);
          loadDossier(target.roll_no);
        }
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to load students roster');
    } finally {
      setLoading(false);
    }
  };

  // Load detailed profile for selected student
  const loadDossier = async (rollNo: string) => {
    setDossierLoading(true);
    try {
      const profile = await api.getStudentProfile(rollNo);
      setDossier(profile);
    } catch (err: any) {
      console.error('Failed to load profile for', rollNo, err);
    } finally {
      setDossierLoading(false);
    }
  };

  useEffect(() => {
    fetchRoster();
  }, [activeSection]);

  // When user clicks a student in the roster
  const handleSelectStudent = (rollNo: string) => {
    setSelectedRollNo(rollNo);
    onSelectStudent?.(rollNo);
    loadDossier(rollNo);
  };

  // Filter logic
  const filteredStudents = students.filter((s) => {
    const attPct = Math.round(s.attendance_pct ?? s.attendance ?? 0);
    const isAnchor =
      s.role?.toLowerCase().includes('anchor') ||
      s.is_delinquent ||
      s.role?.toLowerCase().includes('delinquent');

    if (filterType === 'anchors' && !isAnchor) return false;
    if (filterType === 'at_risk' && attPct >= 75) return false;
    if (filterType === 'good' && attPct < 75) return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchRoll = s.roll_no?.toLowerCase().includes(q);
      const matchName = s.name?.toLowerCase().includes(q);
      const matchCohort = s.cohort?.toLowerCase().includes(q);
      const matchRole = s.role?.toLowerCase().includes(q);
      if (!matchRoll && !matchName && !matchCohort && !matchRole) return false;
    }

    return true;
  });

  const totalCount = students.length;
  const atRiskCount = students.filter((s) => (s.attendance_pct ?? s.attendance ?? 0) < 75).length;
  const anchorCount = students.filter(
    (s) => s.role?.toLowerCase().includes('anchor') || s.is_delinquent
  ).length;
  const goodCount = students.filter((s) => (s.attendance_pct ?? s.attendance ?? 0) >= 85).length;
  const avgAttendance =
    totalCount > 0
      ? Math.round(
          students.reduce((acc, s) => acc + (s.attendance_pct ?? s.attendance ?? 0), 0) / totalCount
        )
      : 0;

  // Extract initials helper
  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((part) => part[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();
  };

  // Loading state
  if (loading && students.length === 0) {
    return (
      <div className="h-[calc(100vh-120px)] flex flex-col items-center justify-center space-y-3">
        <div className="w-10 h-10 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        <p className="text-xs font-medium text-on-surface-variant">
          Loading student roster &amp; attendance profiles for AIML Sem 4...
        </p>
      </div>
    );
  }

  // Error state
  if (error && students.length === 0) {
    return (
      <div className="h-[calc(100vh-120px)] flex items-center justify-center p-6">
        <div className="p-8 bg-surface-container-lowest border border-error/30 rounded-2xl text-center space-y-3 shadow-xs max-w-md">
          <span className="material-symbols-outlined text-[36px] text-error">warning</span>
          <h2 className="text-base font-bold text-on-surface">Failed to load student roster</h2>
          <p className="text-xs text-on-surface-variant">{error}</p>
          <button
            onClick={fetchRoster}
            className="px-4 py-2 bg-primary text-on-primary rounded-xl text-xs font-semibold hover:opacity-90 transition-opacity cursor-pointer inline-flex items-center gap-1.5"
          >
            <span className="material-symbols-outlined text-[16px]">refresh</span> Retry
          </button>
        </div>
      </div>
    );
  }

  // Empty state
  if (students.length === 0) {
    return (
      <div className="h-[calc(100vh-120px)] flex items-center justify-center p-6">
        <div className="max-w-md text-center space-y-4 bg-surface-container-lowest border border-outline-variant p-8 rounded-2xl">
          <div className="w-12 h-12 rounded-2xl bg-secondary-container/40 text-primary flex items-center justify-center mx-auto">
            <span className="material-symbols-outlined text-[28px]">group_off</span>
          </div>
          <div>
            <h2 className="text-base font-bold text-on-surface">No Students Enrolled in AIML Sem 4</h2>
            <p className="text-xs text-on-surface-variant mt-1.5 leading-relaxed">
              No student profiles have been imported yet. Upload a Student Roster CSV to register students and track attendance intelligence.
            </p>
          </div>
          <button
            onClick={() => onNavigate('ingestion')}
            className="px-4 py-2 bg-primary text-on-primary rounded-xl text-xs font-semibold hover:opacity-90 inline-flex items-center gap-1.5 cursor-pointer shadow-xs"
          >
            <span className="material-symbols-outlined text-[16px]">upload_file</span>
            Upload Student Roster CSV
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-112px)] min-h-[580px] flex flex-col space-y-3 overflow-hidden">
      {/* ─── Top Control Bar & Quick Stats ────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3 shrink-0 px-1">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
            <span className="material-symbols-outlined text-[20px]">badge</span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold text-on-surface tracking-tight">Student Roster &amp; Profiles</h1>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-primary/10 text-primary font-bold border border-primary/20">
                AIML Sem 4
              </span>
            </div>
            <p className="text-[11px] text-on-surface-variant">
              Click any student to view their live attendance profile and peer circle on the left.
            </p>
          </div>
        </div>

        {/* Minimalist Summary Badges */}
        <div className="flex items-center gap-2 text-xs">
          <div className="px-2.5 py-1 rounded-lg bg-surface-container-lowest border border-outline-variant flex items-center gap-1.5 shadow-2xs">
            <span className="text-[10px] uppercase font-mono text-on-surface-variant">Total</span>
            <span className="font-bold text-on-surface">{totalCount}</span>
          </div>
          <div className="px-2.5 py-1 rounded-lg bg-surface-container-lowest border border-outline-variant flex items-center gap-1.5 shadow-2xs">
            <span className="text-[10px] uppercase font-mono text-on-surface-variant">Avg Attn</span>
            <span className={`font-bold ${avgAttendance < 75 ? 'text-rose-600 dark:text-rose-400' : 'text-primary'}`}>
              {avgAttendance}%
            </span>
          </div>
          <div className="px-2.5 py-1 rounded-lg bg-rose-500/10 border border-rose-500/25 flex items-center gap-1.5 shadow-2xs">
            <span className="text-[10px] uppercase font-mono text-rose-600 dark:text-rose-400 font-bold">At Risk</span>
            <span className="font-bold text-rose-600 dark:text-rose-400">{atRiskCount}</span>
          </div>
          <button
            onClick={fetchRoster}
            className="p-1.5 rounded-lg border border-outline-variant bg-surface-container-lowest text-on-surface-variant hover:text-primary hover:bg-surface-container transition-colors cursor-pointer"
            title="Refresh student roster"
          >
            <span className="material-symbols-outlined text-[16px]">refresh</span>
          </button>
        </div>
      </div>

      {/* ─── Main Master-Detail Layout (Profile on Left, Roster on Right) ───────────── */}
      <div className="flex-1 min-h-0 flex flex-col lg:flex-row gap-3.5 overflow-hidden">
        
        {/* ─── LEFT PANEL: Student Profile Dossier (~380px wide) ──────────────────── */}
        <div className="w-full lg:w-[380px] xl:w-[410px] shrink-0 h-full flex flex-col bg-surface-container-lowest border border-outline-variant rounded-2xl shadow-xs overflow-hidden">
          {/* Profile Header */}
          <div className="p-3.5 border-b border-outline-variant/70 flex items-center justify-between bg-surface-container-low/50 shrink-0">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px] text-primary">account_circle</span>
              <span className="text-xs font-bold text-on-surface uppercase tracking-wider font-mono">
                Student Profile Dossier
              </span>
            </div>
            {dossierLoading ? (
              <div className="flex items-center gap-1 text-[11px] text-primary">
                <div className="w-3 h-3 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                <span>Loading...</span>
              </div>
            ) : (
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-surface-container text-on-surface-variant border border-outline-variant">
                AIML
              </span>
            )}
          </div>

          {/* Profile Scrollable Content Area */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {!dossier && !dossierLoading ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-6 text-on-surface-variant space-y-2">
                <span className="material-symbols-outlined text-[40px] opacity-40">person_search</span>
                <p className="text-xs font-medium">Select a student from the roster to inspect their profile.</p>
              </div>
            ) : (
              <>
                {/* 1. Identity & Role Card */}
                <div className="p-3.5 bg-surface-container-low rounded-xl border border-outline-variant/60 space-y-3">
                  <div className="flex items-start gap-3">
                    {/* Avatar Initials with Status Ring */}
                    <div
                      className={`w-12 h-12 rounded-2xl flex items-center justify-center font-bold text-base shadow-2xs shrink-0 border-2 ${
                        (dossier?.attendance_pct ?? 0) < 75
                          ? 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500'
                          : (dossier?.attendance_pct ?? 0) >= 85
                          ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500'
                          : 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500'
                      }`}
                    >
                      {dossier ? getInitials(dossier.name) : '??'}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <h2 className="text-sm font-bold text-on-surface truncate">
                          {dossier?.name || 'Loading...'}
                        </h2>
                      </div>
                      <div className="text-xs font-mono font-semibold text-primary mt-0.5">
                        {dossier?.roll_no}
                      </div>
                      <div className="text-[11px] text-on-surface-variant mt-0.5">
                        {dossier?.branch || 'AIML'} • Year {dossier?.year || 2} (Sem 4)
                      </div>
                    </div>
                  </div>

                  {/* Status Pills */}
                  <div className="flex items-center gap-1.5 flex-wrap pt-1 border-t border-outline-variant/40">
                    {/* Delinquency / CR Role */}
                    {dossier?.is_delinquent ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30">
                        <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
                        Delinquent Anchor
                      </span>
                    ) : dossier?.role?.includes('CR') ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                        <span className="material-symbols-outlined text-[12px]">star</span>
                        Class Representative (CR)
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-surface-container text-on-surface-variant">
                        Student
                      </span>
                    )}

                    {/* Friend Group / Cohort */}
                    {dossier?.cohort && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-surface-container-high text-on-surface border border-outline-variant/50 max-w-[200px] truncate">
                        <span
                          className="w-2 h-2 rounded-full shrink-0"
                          style={{ backgroundColor: dossier.cohort_color || '#6366f1' }}
                        />
                        <span className="truncate">{dossier.cohort.replace('Friend Group: ', '')}</span>
                      </span>
                    )}
                  </div>
                </div>

                {/* 2. Attendance Gauge & Critical Metric Card */}
                <div className="p-3.5 bg-surface-container-low rounded-xl border border-outline-variant/60 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono uppercase tracking-wider text-on-surface-variant font-bold">
                      Attendance Standing
                    </span>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                        (dossier?.attendance_pct ?? 0) < 75
                          ? 'bg-rose-500/15 text-rose-600 dark:text-rose-400'
                          : (dossier?.attendance_pct ?? 0) >= 85
                          ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                          : 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
                      }`}
                    >
                      {(dossier?.attendance_pct ?? 0) < 75 ? 'Critical Warning (<75%)' : 'Good Standing'}
                    </span>
                  </div>

                  {/* Attendance Visual Bar */}
                  <div>
                    <div className="flex items-baseline justify-between mb-1.5">
                      <span className="text-2xl font-bold text-on-surface">
                        {Math.round(dossier?.attendance_pct ?? 0)}%
                      </span>
                      <span className="text-[11px] font-mono text-on-surface-variant">
                        Required: 75% Min.
                      </span>
                    </div>

                    <div className="w-full bg-surface-container-high h-2.5 rounded-full overflow-hidden relative">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${
                          (dossier?.attendance_pct ?? 0) < 75
                            ? 'bg-rose-500'
                            : (dossier?.attendance_pct ?? 0) >= 85
                            ? 'bg-emerald-500'
                            : 'bg-amber-500'
                        }`}
                        style={{ width: `${Math.min(100, Math.max(0, dossier?.attendance_pct ?? 0))}%` }}
                      />
                      {/* 75% threshold guide marker */}
                      <div
                        className="absolute top-0 bottom-0 w-0.5 bg-on-surface/40 pointer-events-none"
                        style={{ left: '75%' }}
                        title="Mandatory 75% Threshold"
                      />
                    </div>
                  </div>

                  {/* Class Stats Triplet */}
                  <div className="grid grid-cols-3 gap-2 pt-2 border-t border-outline-variant/40 text-center">
                    <div className="p-2 rounded-lg bg-surface-container-lowest border border-outline-variant/40">
                      <span className="text-[9px] font-mono uppercase text-on-surface-variant block">Absences</span>
                      <span className={`text-sm font-bold ${(dossier?.absences ?? 0) > 3 ? 'text-rose-600 dark:text-rose-400' : 'text-on-surface'}`}>
                        {dossier?.absences ?? 0}
                      </span>
                    </div>

                    <div className="p-2 rounded-lg bg-surface-container-lowest border border-outline-variant/40">
                      <span className="text-[9px] font-mono uppercase text-on-surface-variant block">Attended</span>
                      <span className="text-sm font-bold text-on-surface">
                        {(dossier?.total_classes ?? 0) - (dossier?.absences ?? 0)}
                      </span>
                    </div>

                    <div className="p-2 rounded-lg bg-surface-container-lowest border border-outline-variant/40">
                      <span className="text-[9px] font-mono uppercase text-on-surface-variant block">Total Held</span>
                      <span className="text-sm font-bold text-on-surface font-mono">
                        {dossier?.total_classes ?? 0}
                      </span>
                    </div>
                  </div>
                </div>

                {/* 3. Frequent Bunk Partners (Co-Absent Peers) */}
                <div className="p-3.5 bg-surface-container-low rounded-xl border border-outline-variant/60 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-[16px] text-primary">groups</span>
                      <span className="text-[10px] font-mono uppercase tracking-wider text-on-surface-variant font-bold">
                        Frequent Bunk Partners
                      </span>
                    </div>
                    <span className="text-[10px] text-on-surface-variant font-mono">
                      {dossier?.peers?.length || 0} Connected
                    </span>
                  </div>

                  {dossier?.peers && dossier.peers.length > 0 ? (
                    <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                      {dossier.peers.map((peer) => (
                        <div
                          key={peer.roll_no}
                          onClick={() => handleSelectStudent(peer.roll_no)}
                          className="p-2 rounded-lg bg-surface-container-lowest border border-outline-variant/50 flex items-center justify-between hover:border-primary transition-all cursor-pointer group"
                          title="Click to view this peer's profile"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <div className="w-6 h-6 rounded-md bg-secondary-container/40 text-primary flex items-center justify-center text-[10px] font-bold">
                              {getInitials(peer.name)}
                            </div>
                            <div className="min-w-0">
                              <div className="text-xs font-semibold text-on-surface truncate group-hover:text-primary transition-colors">
                                {peer.name}
                              </div>
                              <div className="text-[10px] font-mono text-on-surface-variant">
                                {peer.roll_no}
                              </div>
                            </div>
                          </div>

                          <div className="shrink-0 text-right">
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 font-mono">
                              {peer.mutual_absences} mutual bunks
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-on-surface-variant italic py-1 text-center bg-surface-container-lowest rounded-lg border border-outline-variant/40">
                      No correlated bunk partners detected. Regular attendance pattern.
                    </p>
                  )}
                </div>

                {/* 4. Recent Class Attendance Timeline */}
                <div className="p-3.5 bg-surface-container-low rounded-xl border border-outline-variant/60 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-[16px] text-primary">calendar_month</span>
                      <span className="text-[10px] font-mono uppercase tracking-wider text-on-surface-variant font-bold">
                        Recent Class Attendance
                      </span>
                    </div>
                    <span className="text-[10px] text-on-surface-variant font-mono">
                      Last {dossier?.recent_attendance?.length || 0} Slots
                    </span>
                  </div>

                  {dossier?.recent_attendance && dossier.recent_attendance.length > 0 ? (
                    <div className="space-y-1.5 max-h-44 overflow-y-auto pr-1">
                      {dossier.recent_attendance.map((rec, idx) => {
                        const isAbsent = rec.status === 'ABSENT';
                        return (
                          <div
                            key={idx}
                            className="p-2 rounded-lg bg-surface-container-lowest border border-outline-variant/50 flex items-center justify-between text-xs"
                          >
                            <div className="flex items-center gap-2">
                              <span
                                className={`w-2 h-2 rounded-full ${
                                  isAbsent ? 'bg-rose-500' : 'bg-emerald-500'
                                }`}
                              />
                              <span className="font-mono text-[11px] text-on-surface-variant">
                                {rec.date}
                              </span>
                              <span className="font-medium text-on-surface">
                                P{rec.period} • {rec.subject_code}
                              </span>
                            </div>

                            <span
                              className={`text-[9px] font-bold px-1.5 py-0.5 rounded font-mono ${
                                isAbsent
                                  ? 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30'
                                  : 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                              }`}
                            >
                              {rec.status}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-xs text-on-surface-variant italic py-1 text-center bg-surface-container-lowest rounded-lg border border-outline-variant/40">
                      No recent attendance records found.
                    </p>
                  )}
                </div>
              </>
            )}
          </div>

          {/* Profile Actions Footer */}
          {dossier && (
            <div className="p-3 border-t border-outline-variant/70 bg-surface-container-low/60 shrink-0 flex items-center gap-2">
              <button
                onClick={() => onNavigate('interventions', { studentId: dossier.roll_no })}
                className="flex-1 py-2 px-3 rounded-xl bg-primary text-on-primary text-xs font-semibold hover:opacity-90 transition-opacity cursor-pointer inline-flex items-center justify-center gap-1.5 shadow-xs"
              >
                <span className="material-symbols-outlined text-[16px]">flag</span>
                Schedule Intervention
              </button>

              {/* Explicit button to view in Knowledge Graph if the teacher deliberately wants it */}
              <button
                onClick={() => onNavigate('knowledge-graph', { studentId: dossier.roll_no })}
                className="py-2 px-3 rounded-xl border border-outline-variant bg-surface-container-lowest text-on-surface text-xs font-semibold hover:bg-surface-container transition-colors cursor-pointer inline-flex items-center gap-1"
                title="Open in Knowledge Graph"
              >
                <span className="material-symbols-outlined text-[16px]">account_tree</span>
                <span>Graph</span>
              </button>
            </div>
          )}
        </div>

        {/* ─── RIGHT PANEL: Simplified, Easy-to-Understand Student Roster ─────────── */}
        <div className="flex-1 min-w-0 h-full flex flex-col bg-surface-container-lowest border border-outline-variant rounded-2xl shadow-xs overflow-hidden">
          
          {/* Roster Controls Header */}
          <div className="p-3 border-b border-outline-variant/70 flex flex-wrap items-center justify-between gap-2.5 bg-surface-container-low/40 shrink-0">
            {/* Real-time Search */}
            <div className="relative w-48 sm:w-64">
              <input
                type="text"
                placeholder="Search name, roll, cohort..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg text-xs px-2.5 py-1.5 pl-8 text-on-surface focus:outline-none focus:border-primary transition-all"
              />
              <span className="material-symbols-outlined text-[16px] text-on-surface-variant absolute left-2 top-2 pointer-events-none">
                search
              </span>
            </div>

            {/* Intuitive Filter Tabs */}
            <div className="flex items-center bg-surface-container border border-outline-variant/60 rounded-lg p-0.5 text-xs font-medium">
              <button
                onClick={() => setFilterType('all')}
                className={`px-2.5 py-1 rounded transition-all cursor-pointer ${
                  filterType === 'all'
                    ? 'bg-primary text-on-primary font-bold shadow-2xs'
                    : 'text-on-surface-variant hover:text-on-surface'
                }`}
              >
                All ({totalCount})
              </button>
              <button
                onClick={() => setFilterType('at_risk')}
                className={`px-2.5 py-1 rounded transition-all flex items-center gap-1 cursor-pointer ${
                  filterType === 'at_risk'
                    ? 'bg-amber-500 text-white font-bold shadow-2xs'
                    : 'text-amber-600 dark:text-amber-400 hover:bg-amber-500/10'
                }`}
              >
                At Risk ({atRiskCount})
              </button>
              <button
                onClick={() => setFilterType('anchors')}
                className={`px-2.5 py-1 rounded transition-all flex items-center gap-1 cursor-pointer ${
                  filterType === 'anchors'
                    ? 'bg-rose-500 text-white font-bold shadow-2xs'
                    : 'text-rose-600 dark:text-rose-400 hover:bg-rose-500/10'
                }`}
              >
                Anchors ({anchorCount})
              </button>
              <button
                onClick={() => setFilterType('good')}
                className={`px-2.5 py-1 rounded transition-all cursor-pointer ${
                  filterType === 'good'
                    ? 'bg-emerald-600 text-white font-bold shadow-2xs'
                    : 'text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10'
                }`}
              >
                On Track ({goodCount})
              </button>
            </div>
          </div>

          {/* Roster Table with Dedicated Internal Scroll and Sticky Header */}
          <div className="flex-1 overflow-y-auto overflow-x-auto relative">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="sticky top-0 bg-surface-container-low border-b border-outline-variant z-10 text-[10px] font-mono uppercase text-on-surface-variant tracking-wider shadow-2xs">
                <tr>
                  <th className="py-2.5 px-3">Roll No</th>
                  <th className="py-2.5 px-3">Student Name</th>
                  <th className="py-2.5 px-3">Attendance</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3">Friend Group / Cohort</th>
                  <th className="py-2.5 px-3">Absences</th>
                  <th className="py-2.5 px-3 text-right">Selection</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/50">
                {filteredStudents.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-xs text-on-surface-variant">
                      No students match your filter criteria.
                    </td>
                  </tr>
                ) : (
                  filteredStudents.map((s) => {
                    const isSelected = selectedRollNo === s.roll_no;
                    const attPct = Math.round(s.attendance_pct ?? s.attendance ?? 0);
                    const isLowAttendance = attPct < 75;
                    const isGoodAttendance = attPct >= 85;
                    const isAnchor =
                      s.role?.toLowerCase().includes('anchor') ||
                      s.is_delinquent ||
                      s.role?.toLowerCase().includes('delinquent');
                    const totalClasses = s.total_classes ?? 9;
                    const absences = s.absences ?? 0;

                    return (
                      <tr
                        key={s.id || s.roll_no}
                        onClick={() => handleSelectStudent(s.roll_no)}
                        className={`transition-colors cursor-pointer group ${
                          isSelected
                            ? 'bg-primary/10 dark:bg-primary/15 border-l-4 border-l-primary font-medium'
                            : 'hover:bg-surface-container-low'
                        }`}
                      >
                        {/* Roll Number */}
                        <td className="py-2.5 px-3 font-mono font-bold text-primary whitespace-nowrap">
                          {s.roll_no}
                        </td>

                        {/* Student Name & Avatar */}
                        <td className="py-2.5 px-3">
                          <div className="flex items-center gap-2">
                            <div
                              className={`w-6 h-6 rounded-md flex items-center justify-center text-[10px] font-bold shrink-0 ${
                                isSelected
                                  ? 'bg-primary text-on-primary'
                                  : 'bg-surface-container text-on-surface'
                              }`}
                            >
                              {getInitials(s.name)}
                            </div>
                            <span className="font-semibold text-on-surface">{s.name}</span>
                          </div>
                        </td>

                        {/* Attendance Percentage & Mini Progress Bar */}
                        <td className="py-2.5 px-3 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <span
                              className={`font-mono font-bold text-xs ${
                                isLowAttendance
                                  ? 'text-rose-600 dark:text-rose-400'
                                  : isGoodAttendance
                                  ? 'text-emerald-600 dark:text-emerald-400'
                                  : 'text-amber-600 dark:text-amber-400'
                              }`}
                            >
                              {attPct}%
                            </span>
                            <div className="w-14 bg-surface-container-high h-1.5 rounded-full overflow-hidden shrink-0">
                              <div
                                className={`h-full rounded-full ${
                                  isLowAttendance
                                    ? 'bg-rose-500'
                                    : isGoodAttendance
                                    ? 'bg-emerald-500'
                                    : 'bg-amber-500'
                                }`}
                                style={{ width: `${Math.min(100, attPct)}%` }}
                              />
                            </div>
                          </div>
                        </td>

                        {/* Friendly Status Tag */}
                        <td className="py-2.5 px-3 whitespace-nowrap">
                          {isAnchor ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30">
                              <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                              Bunk Anchor
                            </span>
                          ) : isLowAttendance ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30">
                              At Risk
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                              Good Standing
                            </span>
                          )}
                        </td>

                        {/* Friend Group / Cohort */}
                        <td className="py-2.5 px-3">
                          <span className="inline-flex items-center gap-1.5 text-[11px] text-on-surface truncate max-w-[170px]">
                            <span
                              className="w-2 h-2 rounded-full shrink-0"
                              style={{ backgroundColor: s.cohort_color || '#6366f1' }}
                            />
                            <span className="truncate">{s.cohort?.replace('Friend Group: ', '') || 'General'}</span>
                          </span>
                        </td>

                        {/* Absences Count */}
                        <td className="py-2.5 px-3 font-mono whitespace-nowrap">
                          <span className={absences > 3 ? 'text-rose-600 dark:text-rose-400 font-bold' : 'text-on-surface'}>
                            {absences}
                          </span>
                          <span className="text-on-surface-variant"> / {totalClasses} classes</span>
                        </td>

                        {/* Selection Indicator */}
                        <td className="py-2.5 px-3 text-right whitespace-nowrap">
                          {isSelected ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-primary text-on-primary text-[10px] font-bold">
                              <span className="material-symbols-outlined text-[13px]">check</span>
                              Viewing
                            </span>
                          ) : (
                            <span className="text-[11px] text-on-surface-variant group-hover:text-primary transition-colors flex items-center justify-end gap-0.5">
                              <span>Profile</span>
                              <span className="material-symbols-outlined text-[14px]">chevron_right</span>
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Roster Footer with Quick Hint */}
          <div className="p-2 px-3 border-t border-outline-variant/60 bg-surface-container-low/40 shrink-0 flex items-center justify-between text-[11px] text-on-surface-variant">
            <span>
              Showing {filteredStudents.length} of {students.length} students enrolled in Section AIML Sem 4
            </span>
            <span className="flex items-center gap-1 text-[10px] font-mono">
              <span className="material-symbols-outlined text-[13px]">touch_app</span>
              Click row to view profile
            </span>
          </div>
        </div>

      </div>
    </div>
  );
};
