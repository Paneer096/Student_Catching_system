import React, { useState, useEffect } from 'react';
import { api, CalendarRiskDay, CalendarEvent, CalibratedPredictionResult } from '../api/client';

export interface CalendarRiskViewProps {
  onNavigate: (viewId: string, params?: any) => void;
  activeSection?: string;
}

export const CalendarRiskView: React.FC<CalendarRiskViewProps> = ({
  onNavigate,
  activeSection = 'CS-3B',
}) => {
  const [riskSchedule, setRiskSchedule] = useState<CalendarRiskDay[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Month navigation & Policy state
  const [currentYear, setCurrentYear] = useState(2026);
  const [currentMonth, setCurrentMonth] = useState(10); // 1-indexed (10 = October)
  const [selectedDateStr, setSelectedDateStr] = useState<string>('2026-10-19');
  const [filterMode, setFilterMode] = useState<'all' | 'high_risk' | 'holidays'>('all');
  const [viewMode, setViewMode] = useState<'calendar' | 'agenda'>('calendar');
  const [weekendPolicy, setWeekendPolicy] = useState<'sat_sun' | 'sunday_only' | 'alt_sat'>('sat_sun');
  const [perspectiveMode, setPerspectiveMode] = useState<'overall_day' | 'subject_walkout' | 'combined'>('overall_day');

  // Teacher Holiday Management Modal
  const [manageModalOpen, setManageModalOpen] = useState(false);
  const [modalTab, setModalTab] = useState<'add' | 'list'>('add');
  const [allEvents, setAllEvents] = useState<CalendarEvent[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(false);

  // Calibrated Prediction Calculator State
  const [calcModalOpen, setCalcModalOpen] = useState(false);
  const [calcDay, setCalcDay] = useState('Friday');
  const [calcPeriod, setCalcPeriod] = useState(5);
  const [calcSubject, setCalcSubject] = useState('CS302');
  const [calcIsLab, setCalcIsLab] = useState(false);
  const [calcBridgeDays, setCalcBridgeDays] = useState(1);
  const [calcPreHoliday, setCalcPreHoliday] = useState(false);
  const [calcExamProximity, setCalcExamProximity] = useState(false);
  const [calcCohortTier, setCalcCohortTier] = useState<'low' | 'medium' | 'high'>('medium');
  const [calcIsLeastFavourable, setCalcIsLeastFavourable] = useState(false);
  const [calcLoading, setCalcLoading] = useState(false);
  const [calcResult, setCalcResult] = useState<CalibratedPredictionResult | null>(null);

  const runPredictionCalculation = async (overrides?: any) => {
    setCalcLoading(true);
    try {
      const payload = {
        day_of_week: overrides?.day_of_week ?? calcDay,
        period: overrides?.period ?? calcPeriod,
        subject_code: overrides?.subject_code ?? calcSubject,
        is_lab: overrides?.is_lab !== undefined ? overrides.is_lab : calcIsLab,
        bridge_days_gained: overrides?.bridge_days_gained ?? calcBridgeDays,
        is_pre_holiday: overrides?.is_pre_holiday !== undefined ? overrides.is_pre_holiday : calcPreHoliday,
        is_exam_proximity: overrides?.is_exam_proximity !== undefined ? overrides.is_exam_proximity : calcExamProximity,
        cohort_risk_tier: overrides?.cohort_risk_tier ?? calcCohortTier,
        is_least_favourable: overrides?.is_least_favourable !== undefined ? overrides.is_least_favourable : calcIsLeastFavourable,
        section: activeSection,
      };
      const res = await api.predictProbability(payload);
      setCalcResult(res);
    } catch (err) {
      console.error('Failed to compute calibrated prediction', err);
    } finally {
      setCalcLoading(false);
    }
  };

  const syncFromSelectedDay = () => {
    const dayObj = riskSchedule.find((d) => d.date === selectedDateStr) || riskSchedule[0];
    if (!dayObj) return;
    const dow = dayObj.day || 'Friday';
    const firstPeriod = dayObj.periods?.[0];
    const pNum = firstPeriod ? firstPeriod.period : 5;
    const subj = firstPeriod ? firstPeriod.subject : 'CS302';
    const isLab = dayObj.has_lab || (firstPeriod?.is_lab ?? false);
    const bridge = dayObj.consecutive_days_gained ?? 0;
    const isPre = (dayObj.following_off_days ?? 0) >= 1;
    const isLeastFav = dayObj.least_favourable_subject != null;

    setCalcDay(dow);
    setCalcPeriod(pNum);
    setCalcSubject(subj);
    setCalcIsLab(isLab);
    setCalcBridgeDays(bridge);
    setCalcPreHoliday(isPre);
    setCalcIsLeastFavourable(isLeastFav);

    runPredictionCalculation({
      day_of_week: dow,
      period: pNum,
      subject_code: subj,
      is_lab: isLab,
      bridge_days_gained: bridge,
      is_pre_holiday: isPre,
      is_exam_proximity: calcExamProximity,
      cohort_risk_tier: calcCohortTier,
      is_least_favourable: isLeastFav,
    });
  };

  // Bulk Holiday Form inputs
  const [bulkName, setBulkName] = useState('Diwali Vacation Break');
  const [rangeMode, setRangeMode] = useState<'range' | 'single'>('range');
  const [bulkStartDate, setBulkStartDate] = useState('2026-10-21');
  const [bulkEndDate, setBulkEndDate] = useState('2026-10-23');
  const [bulkType, setBulkType] = useState('HOLIDAY');
  const [bulkSubmitting, setBulkSubmitting] = useState(false);
  const [formFeedback, setFormFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // AI Draft Reminder Modal
  const [aiDraftOpen, setAiDraftOpen] = useState(false);
  const [draftNoticeText, setDraftNoticeText] = useState(
    'Dear Section CS-3B students, this is a reminder that Monday Period 1 and Friday Period 5 practical sessions are mandatory for internal assessment credits. Punctual attendance is strictly tracked. Let us maintain 100% presence.'
  );

  const monthStr = `${currentYear}-${currentMonth < 10 ? '0' + currentMonth : currentMonth}`;

  const fetchRisk = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getCalendarRisk(activeSection, monthStr, weekendPolicy);
      setRiskSchedule(data);

      // Default selected date to highest risk day or Oct 19 / Oct 23
      const peak =
        data.find((d) => d.date === selectedDateStr) ||
        data.find((d) => d.date === '2026-10-19') ||
        data.find((d) => d.date === '2026-10-23') ||
        data.find((d) => d.risk_level === 'HIGH') ||
        data[0];
      if (peak) setSelectedDateStr(peak.date);
    } catch (err: any) {
      setError(err?.message || 'Failed to calculate calendar risk schedule');
    } finally {
      setLoading(false);
    }
  };

  const loadEvents = async () => {
    setLoadingEvents(true);
    try {
      const events = await api.getCalendarEvents();
      setAllEvents(events);
    } catch (err) {
      console.error('Failed to load calendar events', err);
    } finally {
      setLoadingEvents(false);
    }
  };

  useEffect(() => {
    fetchRisk();
  }, [activeSection, monthStr, weekendPolicy]);

  const selectedDay = riskSchedule.find((d) => d.date === selectedDateStr) || riskSchedule[0];

  // Month title
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  const monthTitle = `${monthNames[currentMonth - 1]} ${currentYear}`;

  const handlePrevMonth = () => {
    if (currentMonth === 1) {
      setCurrentMonth(12);
      setCurrentYear((y) => y - 1);
    } else {
      setCurrentMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (currentMonth === 12) {
      setCurrentMonth(1);
      setCurrentYear((y) => y + 1);
    } else {
      setCurrentMonth((m) => m + 1);
    }
  };

  const handleResetToTerm = () => {
    setCurrentYear(2026);
    setCurrentMonth(10);
  };

  // Calendar Grid math: determine starting weekday of the month (0 = Sun, 1 = Mon, ..., 6 = Sat)
  const firstDayDate = new Date(currentYear, currentMonth - 1, 1);
  const firstWeekday = firstDayDate.getDay(); // 0 is Sunday
  const leadingBlankDays = Array.from({ length: firstWeekday });

  const isDayElevated = (d: CalendarRiskDay) => {
    if (perspectiveMode === 'overall_day') {
      return (d.overall_day_risk ?? d.risk_score) >= 65;
    }
    if (perspectiveMode === 'subject_walkout') {
      return (d.subject_walkout_risk ?? 0) >= 65;
    }
    return d.risk_level === 'HIGH' || Boolean(d.predicted_mass_bunk) || Boolean(d.has_detected_bunk);
  };

  // Filtered days
  const filteredSchedule = riskSchedule.filter((d) => {
    if (filterMode === 'high_risk') return isDayElevated(d);
    if (filterMode === 'holidays') return d.is_holiday;
    return true;
  });

  const highRiskCount = riskSchedule.filter((d) => isDayElevated(d)).length;
  const holidayCount = riskSchedule.filter((d) => d.is_holiday).length;

  // Handle Bulk Holiday Submission
  const handleBulkSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bulkName.trim()) {
      setFormFeedback({ type: 'error', text: 'Please enter a holiday title.' });
      return;
    }
    setBulkSubmitting(true);
    setFormFeedback(null);
    try {
      const payload = {
        name: bulkName.trim(),
        start_date: bulkStartDate,
        end_date: rangeMode === 'range' ? bulkEndDate : bulkStartDate,
        type: bulkType,
        is_holiday: true,
      };
      const res = await api.addBulkHolidays(payload);
      setFormFeedback({ type: 'success', text: res.message });
      await fetchRisk();
      await loadEvents();
      setTimeout(() => setFormFeedback(null), 3000);
    } catch (err: any) {
      setFormFeedback({ type: 'error', text: err?.message || 'Failed to add holidays' });
    } finally {
      setBulkSubmitting(false);
    }
  };

  // Handle Delete Holiday
  const handleDeleteHoliday = async (dateStr: string) => {
    try {
      await api.deleteHoliday(dateStr);
      await fetchRisk();
      await loadEvents();
    } catch (err: any) {
      alert(`Failed to delete holiday: ${err?.message}`);
    }
  };

  // Handle Reset to Defaults
  const handleResetDefaults = async () => {
    if (!window.confirm('Reset academic calendar to official 2026 university gazetted defaults?')) return;
    try {
      await api.resetCalendarDefaults();
      await fetchRisk();
      await loadEvents();
      alert('Academic calendar restored to 2026 defaults.');
    } catch (err: any) {
      alert(`Failed to reset: ${err?.message}`);
    }
  };

  // Apply Quick Preset
  const applyPreset = (name: string, start: string, end: string) => {
    setBulkName(name);
    setBulkStartDate(start);
    setBulkEndDate(end);
    setRangeMode('range');
  };

  if (loading && riskSchedule.length === 0) {
    return (
      <div className="h-[calc(100vh-120px)] flex flex-col items-center justify-center space-y-3">
        <div className="w-10 h-10 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        <p className="text-xs font-medium text-on-surface-variant tracking-wide">
          Computing academic calendar vacation-gain math &amp; mass bunk risk for Section {activeSection}...
        </p>
      </div>
    );
  }

  if (error && riskSchedule.length === 0) {
    return (
      <div className="h-[calc(100vh-120px)] flex flex-col items-center justify-center p-6">
        <div className="p-6 bg-surface-container-lowest border border-error/30 rounded-2xl text-center max-w-md space-y-4 shadow-sm">
          <span className="material-symbols-outlined text-[36px] text-error">calendar_clock</span>
          <h2 className="text-base font-bold text-on-surface">Failed to load calendar forecast</h2>
          <p className="text-xs text-on-surface-variant">{error}</p>
          <button
            onClick={fetchRisk}
            className="px-4 py-2 bg-primary text-on-primary rounded-xl text-xs font-semibold hover:opacity-90 transition-opacity cursor-pointer inline-flex items-center gap-1.5"
          >
            <span className="material-symbols-outlined text-[16px]">refresh</span> Retry Computation
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-100px)] flex flex-col space-y-2 pb-2">
      {/* ─── Header Toolbar ───────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap justify-between items-center gap-2 px-1">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
            <span className="material-symbols-outlined text-[18px]">calendar_month</span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold text-on-surface tracking-tight">Academic Calendar &amp; Absence Probabilities</h1>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-surface-container text-on-surface-variant border border-outline-variant">
                Section {activeSection}
              </span>
              {highRiskCount > 0 && (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30">
                  <span className="material-symbols-outlined text-[12px]">local_fire_department</span>
                  {highRiskCount} Elevated Risk Dates
                </span>
              )}
            </div>
            <p className="text-[11px] text-on-surface-variant">
              Calibrated probabilistic modeling of vacation blocks, bridge days, and absence likelihoods
            </p>
          </div>
        </div>

        {/* Toolbar Controls */}
        <div className="flex items-center flex-wrap gap-2">
          {/* Calibrated Prediction Calculator Button */}
          <button
            onClick={() => {
              setCalcModalOpen(true);
              if (!calcResult) runPredictionCalculation();
            }}
            className="px-2.5 py-1 text-xs font-semibold rounded-lg border border-indigo-500/40 bg-indigo-500/10 hover:bg-indigo-500 hover:text-white text-indigo-600 dark:text-indigo-400 transition-all cursor-pointer flex items-center gap-1.5 shadow-2xs"
            title="Open calibrated empirical absence prediction calculator"
          >
            <span className="material-symbols-outlined text-[15px]">calculate</span>
            Prediction Calculator
          </button>

          {/* Weekend Policy Dropdown */}
          <div className="flex items-center bg-surface-container-lowest border border-outline-variant rounded-lg px-2 py-1 text-xs shadow-2xs">
            <span className="material-symbols-outlined text-[14px] text-primary mr-1">weekend</span>
            <span className="text-[10px] font-medium text-on-surface-variant mr-1.5 hidden sm:inline">Schedule:</span>
            <select
              value={weekendPolicy}
              onChange={(e) => setWeekendPolicy(e.target.value as any)}
              className="bg-transparent text-on-surface text-xs font-semibold focus:outline-none cursor-pointer"
              title="College weekend policy for recalculating absence probabilities"
            >
              <option value="sat_sun">5-Day Week (Sat + Sun Off)</option>
              <option value="sunday_only">6-Day Week (Sunday Only Off)</option>
              <option value="alt_sat">Alternate (2nd &amp; 4th Sat Off)</option>
            </select>
          </div>

          {/* Manage Holidays Button */}
          <button
            onClick={() => {
              setManageModalOpen(true);
              loadEvents();
            }}
            className="px-2.5 py-1 text-xs font-semibold rounded-lg border border-primary/40 bg-primary/10 hover:bg-primary hover:text-on-primary text-primary transition-all cursor-pointer flex items-center gap-1.5 shadow-2xs"
            title="Adjust institutional holidays in bulk or single days"
          >
            <span className="material-symbols-outlined text-[15px]">edit_calendar</span>
            Manage Holidays
          </button>

          {/* Month Switcher */}
          <div className="flex items-center bg-surface-container-lowest border border-outline-variant rounded-lg p-0.5 shadow-2xs">
            <button
              onClick={handlePrevMonth}
              className="p-1 rounded hover:bg-surface-container text-on-surface-variant hover:text-on-surface transition-colors cursor-pointer"
              title="Previous Month"
            >
              <span className="material-symbols-outlined text-[16px]">chevron_left</span>
            </button>
            <span className="text-xs font-bold text-on-surface px-2 select-none">{monthTitle}</span>
            <button
              onClick={handleNextMonth}
              className="p-1 rounded hover:bg-surface-container text-on-surface-variant hover:text-on-surface transition-colors cursor-pointer"
              title="Next Month"
            >
              <span className="material-symbols-outlined text-[16px]">chevron_right</span>
            </button>
          </div>

          <button
            onClick={handleResetToTerm}
            className="px-2 py-1 text-xs font-semibold rounded-lg border border-outline-variant bg-surface-container-lowest hover:bg-surface-container text-on-surface-variant hover:text-primary transition-colors cursor-pointer"
            title="Jump to current active term"
          >
            Term (Oct 2026)
          </button>

          {/* Filter Pills */}
          <div className="flex items-center bg-surface-container-lowest border border-outline-variant rounded-lg p-0.5 text-xs font-medium">
            <button
              onClick={() => setFilterMode('all')}
              className={`px-2 py-0.5 rounded transition-all cursor-pointer ${
                filterMode === 'all'
                  ? 'bg-primary text-on-primary font-bold shadow-2xs'
                  : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setFilterMode('high_risk')}
              className={`px-2 py-0.5 rounded transition-all flex items-center gap-1 cursor-pointer ${
                filterMode === 'high_risk'
                  ? 'bg-rose-500 text-white font-bold shadow-2xs'
                  : 'text-rose-600 dark:text-rose-400 hover:bg-rose-500/10'
              }`}
            >
              <span className="material-symbols-outlined text-[12px]">local_fire_department</span>
              Elevated Risk ({highRiskCount})
            </button>
            <button
              onClick={() => setFilterMode('holidays')}
              className={`px-2 py-0.5 rounded transition-all cursor-pointer ${
                filterMode === 'holidays'
                  ? 'bg-sky-500 text-white font-bold shadow-2xs'
                  : 'text-sky-600 dark:text-sky-400 hover:bg-sky-500/10'
              }`}
            >
              Holidays ({holidayCount})
            </button>
          </div>

          {/* View Toggle */}
          <div className="flex items-center bg-surface-container-lowest border border-outline-variant rounded-lg p-0.5">
            <button
              onClick={() => setViewMode('calendar')}
              className={`p-1 rounded cursor-pointer transition-colors ${
                viewMode === 'calendar'
                  ? 'bg-secondary-container text-on-secondary-container'
                  : 'text-on-surface-variant hover:text-on-surface'
              }`}
              title="Calendar Grid View"
            >
              <span className="material-symbols-outlined text-[16px]">grid_view</span>
            </button>
            <button
              onClick={() => setViewMode('agenda')}
              className={`p-1 rounded cursor-pointer transition-colors ${
                viewMode === 'agenda'
                  ? 'bg-secondary-container text-on-secondary-container'
                  : 'text-on-surface-variant hover:text-on-surface'
              }`}
              title="Agenda List View"
            >
              <span className="material-symbols-outlined text-[16px]">view_agenda</span>
            </button>
          </div>
        </div>
      </div>

      {/* ─── Perspective Switcher Bar (Overall Day vs Most Likely Subject) ────── */}
      <div className="flex flex-wrap items-center justify-between gap-2 p-1.5 px-3 bg-surface-container-lowest border border-outline-variant rounded-xl shadow-2xs">
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider mr-1 hidden sm:inline">
            View Mode:
          </span>

          <button
            onClick={() => setPerspectiveMode('overall_day')}
            className={`px-3 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
              perspectiveMode === 'overall_day'
                ? 'bg-primary text-on-primary shadow-xs font-bold'
                : 'text-on-surface-variant hover:bg-surface-container hover:text-on-surface'
            }`}
            title="Focus on whole-day student absence driven by calendar structure, long weekends & bridge days"
          >
            <span className="material-symbols-outlined text-[15px]">calendar_today</span>
            <span>Overall Day Bunk</span>
          </button>

          <button
            onClick={() => setPerspectiveMode('subject_walkout')}
            className={`px-3 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
              perspectiveMode === 'subject_walkout'
                ? 'bg-amber-600 text-white shadow-xs font-bold'
                : 'text-on-surface-variant hover:bg-surface-container hover:text-amber-600 dark:hover:text-amber-400'
            }`}
            title="Focus on individual lectures: Highlights the #1 specific subject most likely to be mass-bunked"
          >
            <span className="material-symbols-outlined text-[15px]">menu_book</span>
            <span>Most Likely Subject to Bunk</span>
          </button>

          <button
            onClick={() => setPerspectiveMode('combined')}
            className={`px-3 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
              perspectiveMode === 'combined'
                ? 'bg-secondary-container text-on-secondary-container shadow-xs font-bold border border-outline-variant'
                : 'text-on-surface-variant hover:bg-surface-container hover:text-on-surface'
            }`}
            title="Combined View: See both overall day probability and subject walkout hazard together"
          >
            <span className="material-symbols-outlined text-[15px]">splitscreen</span>
            <span>Combined Dual View</span>
          </button>
        </div>

        <div className="text-[11px] text-on-surface-variant flex items-center gap-2 font-medium">
          {perspectiveMode === 'overall_day' && (
            <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              Whole-Day Travel &amp; Bridge Focus (Normal teaching days calm &amp; green)
            </span>
          )}
          {perspectiveMode === 'subject_walkout' && (
            <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400 font-semibold">
              <span className="w-2 h-2 rounded-full bg-amber-500"></span>
              Highlights the #1 specific lecture vulnerable to cohort walkout each day
            </span>
          )}
          {perspectiveMode === 'combined' && (
            <span className="flex items-center gap-1 text-primary">
              <span className="w-2 h-2 rounded-full bg-primary"></span>
              Full Analytical Lens: Whole-day travel incentives &amp; closing lecture cuts
            </span>
          )}
        </div>
      </div>

      {/* ─── Minimalist Classroom Alert Banner ───────────────────────────────────── */}
      {highRiskCount > 0 && (
        <div className="p-2 px-3 rounded-xl bg-surface-container-lowest border border-outline-variant flex items-center justify-between text-xs shadow-2xs">
          <div className="flex items-center gap-2">
            <span
              className={`w-5 h-5 rounded-md flex items-center justify-center shrink-0 ${
                perspectiveMode === 'subject_walkout'
                  ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
                  : 'bg-rose-500/15 text-rose-600 dark:text-rose-400'
              }`}
            >
              <span className="material-symbols-outlined text-[14px]">
                {perspectiveMode === 'subject_walkout' ? 'menu_book' : 'local_fire_department'}
              </span>
            </span>
            <span className="font-semibold text-on-surface shrink-0">
              {perspectiveMode === 'subject_walkout' ? 'Lecture Walkout Focus:' : 'Classroom Risk Alert:'}
            </span>
            <span className="text-on-surface-variant truncate">
              {perspectiveMode === 'subject_walkout' ? (
                <>CS304 (Period 4 closing lecture) is the #1 most vulnerable subject to be mass-bunked across Section {activeSection} timetable (94.2% historical attendance, 76 bunks).</>
              ) : (
                <>{highRiskCount} dates in {monthTitle} carry elevated travel bridge incentives • Oct 19 (+4d Dussehra Bridge), Oct 23 (+4d Pre-Diwali Departure), Oct 1 (+4d Gandhi Jayanti Bridge). Normal mid-week dates remain low-risk.</>
              )}
            </span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => {
                setSelectedDateStr('2026-10-19');
                setFilterMode('high_risk');
              }}
              className="text-[11px] font-bold text-primary hover:underline cursor-pointer"
            >
              Inspect Peak Date &rarr;
            </button>
          </div>
        </div>
      )}

      {/* ─── Main Workspace: 75% Calendar Grid / 25% Day Inspector ───────────────── */}
      <div className="flex-1 flex flex-col lg:flex-row gap-3 min-h-0 overflow-hidden">
        {/* Left: Actual Interactive Calendar Grid */}
        <div className="w-full lg:w-[75%] h-full bg-surface-container-lowest border border-outline-variant rounded-2xl p-3 flex flex-col shadow-xs overflow-hidden">
          {viewMode === 'calendar' ? (
            <div className="flex-1 flex flex-col min-h-0">
              {/* 7-Day Column Headers */}
              <div className="grid grid-cols-7 gap-1.5 pb-2 border-b border-outline-variant text-center">
                {['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'].map((w, idx) => (
                  <span
                    key={w}
                    className={`text-[10px] font-bold tracking-wider ${
                      idx === 0
                        ? 'text-rose-500/80'
                        : idx === 6
                        ? weekendPolicy === 'sat_sun'
                          ? 'text-rose-500/80'
                          : 'text-primary/80'
                        : 'text-on-surface-variant'
                    }`}
                  >
                    {w}
                  </span>
                ))}
              </div>

              {/* Calendar Month Days Grid */}
              <div className="flex-1 grid grid-cols-7 grid-rows-5 gap-1.5 pt-2 min-h-0 overflow-y-auto">
                {/* Leading blank offset days */}
                {leadingBlankDays.map((_, idx) => (
                  <div
                    key={`blank-${idx}`}
                    className="rounded-xl border border-dashed border-outline-variant/30 bg-surface-container-low/20 p-2 opacity-30 select-none"
                  />
                ))}

                {/* Actual Days of the Month */}
                {riskSchedule.map((day) => {
                  const isSelected = selectedDateStr === day.date;
                  const isHoliday = day.is_holiday;
                  const gainedDays = day.consecutive_days_gained ?? 0;

                  // Overall Day Metrics
                  const dayRisk = day.overall_day_risk ?? day.risk_score;
                  const isDayHigh = dayRisk >= 65;
                  const isDayMed = dayRisk >= 35 && dayRisk < 65;

                  // Subject Walkout Metrics
                  const vuln = day.most_vulnerable_subject;
                  const isSubjHigh = vuln?.walkout_level === 'HIGH';
                  const isSubjMed = vuln?.walkout_level === 'MEDIUM';

                  // Dynamic Card Border & Styling based on Perspective Mode
                  let cellStyle = 'border-outline-variant/60 bg-surface-container-lowest hover:border-primary/50';

                  if (isHoliday) {
                    cellStyle = 'border-sky-500/30 bg-sky-500/5 hover:border-sky-500';
                  } else if (perspectiveMode === 'overall_day') {
                    if (isDayHigh) {
                      cellStyle = 'border-rose-500/50 bg-rose-500/10 dark:bg-rose-500/15 hover:border-rose-500 shadow-xs';
                    } else if (isDayMed) {
                      cellStyle = 'border-amber-500/40 bg-amber-500/5 hover:border-amber-500';
                    } else {
                      cellStyle = 'border-outline-variant/60 bg-surface-container-lowest hover:border-emerald-500/50';
                    }
                  } else if (perspectiveMode === 'subject_walkout') {
                    if (isSubjHigh) {
                      cellStyle = 'border-amber-500/50 bg-amber-500/10 dark:bg-amber-500/15 hover:border-amber-500 shadow-xs';
                    } else if (isSubjMed) {
                      cellStyle = 'border-sky-500/30 bg-sky-500/5 hover:border-sky-500';
                    } else {
                      cellStyle = 'border-outline-variant/60 bg-surface-container-lowest hover:border-primary/40';
                    }
                  } else {
                    // Combined Mode
                    if (isDayHigh || isSubjHigh) {
                      cellStyle = 'border-rose-500/40 bg-rose-500/5 hover:border-rose-500';
                    } else if (isDayMed || isSubjMed) {
                      cellStyle = 'border-amber-500/30 bg-amber-500/5 hover:border-amber-500';
                    }
                  }

                  if (isSelected) {
                    cellStyle += ' ring-2 ring-primary/40 border-primary bg-surface-container shadow-xs scale-[1.01] z-10';
                  }

                  return (
                    <div
                      key={day.date}
                      onClick={() => setSelectedDateStr(day.date)}
                      className={`rounded-xl p-2 flex flex-col justify-between transition-all cursor-pointer border relative select-none ${cellStyle}`}
                    >
                      {/* Top Header in Day Cell */}
                      <div className="flex items-center justify-between">
                        <span
                          className={`text-xs font-bold font-mono ${
                            isSelected
                              ? 'text-primary'
                              : isHoliday
                              ? 'text-sky-600 dark:text-sky-400'
                              : perspectiveMode === 'overall_day' && isDayHigh
                              ? 'text-rose-600 dark:text-rose-400 font-extrabold'
                              : perspectiveMode === 'subject_walkout' && isSubjHigh
                              ? 'text-amber-700 dark:text-amber-300 font-extrabold'
                              : 'text-on-surface'
                          }`}
                        >
                          {day.day_num}
                        </span>

                        {/* Top Badges */}
                        <div className="flex items-center gap-1">
                          {isHoliday && (
                            <span className="text-sky-600 dark:text-sky-400" title={day.holiday_name || 'Holiday'}>
                              <span className="material-symbols-outlined text-[13px]">beach_access</span>
                            </span>
                          )}

                          {!isHoliday && perspectiveMode === 'overall_day' && (
                            <>
                              {isDayHigh && (
                                <span className="flex items-center text-rose-600 dark:text-rose-400" title="Whole-day bridge day hazard">
                                  <span className="material-symbols-outlined text-[15px]">local_fire_department</span>
                                </span>
                              )}
                              {isDayMed && (
                                <span className="flex items-center text-amber-600 dark:text-amber-400" title="Pre-weekend departure pull">
                                  <span className="material-symbols-outlined text-[14px]">trending_up</span>
                                </span>
                              )}
                            </>
                          )}

                          {!isHoliday && perspectiveMode === 'subject_walkout' && (
                            <>
                              {isSubjHigh && (
                                <span className="flex items-center text-amber-600 dark:text-amber-400" title="Vulnerable closing lecture">
                                  <span className="material-symbols-outlined text-[14px]">warning</span>
                                </span>
                              )}
                              {isSubjMed && (
                                <span className="flex items-center text-sky-600 dark:text-sky-400" title="Secondary walkout risk">
                                  <span className="material-symbols-outlined text-[13px]">menu_book</span>
                                </span>
                              )}
                            </>
                          )}

                          {!isHoliday && perspectiveMode === 'combined' && (
                            <>
                              {day.predicted_mass_bunk && (
                                <span className="flex items-center text-rose-600 dark:text-rose-400" title="Mass Bunk Hazard Flagged">
                                  <span className="material-symbols-outlined text-[14px]">groups</span>
                                </span>
                              )}
                            </>
                          )}
                        </div>
                      </div>

                      {/* Middle / Bottom Content in Day Cell */}
                      <div className="mt-1 space-y-0.5">
                        {isHoliday ? (
                          <div className="text-[9px] font-medium text-sky-600 dark:text-sky-400 truncate">
                            {day.holiday_name || 'Closed'}
                          </div>
                        ) : perspectiveMode === 'overall_day' ? (
                          /* Overall Day Mode: Calm, Realistic, Whole-Day Focus */
                          isDayHigh ? (
                            <div className="space-y-0.5">
                              <div className="flex items-center justify-between text-[9px] font-bold px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-600 dark:text-rose-400 truncate">
                                <span>{dayRisk}% RISK</span>
                                <span className="font-mono text-[8px] bg-rose-500 text-white px-1 rounded">+{gainedDays}d</span>
                              </div>
                              <div className="text-[8px] font-semibold text-rose-600 dark:text-rose-400 truncate">
                                Bridge Day Hazard
                              </div>
                            </div>
                          ) : isDayMed ? (
                            <div className="space-y-0.5">
                              <div className="flex items-center justify-between text-[9px] font-semibold px-1 py-0.5 rounded bg-amber-500/15 text-amber-700 dark:text-amber-300 truncate">
                                <span>{dayRisk}% Departure</span>
                                {gainedDays >= 2 && <span className="font-mono text-[8px] bg-amber-500/20 px-1 rounded">+{gainedDays}d</span>}
                              </div>
                              <div className="text-[8px] text-amber-600 dark:text-amber-400 truncate">
                                Pre-Weekend Pull
                              </div>
                            </div>
                          ) : (
                            <div className="space-y-0.5">
                              <div className="flex items-center justify-between text-[9px] font-medium text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded truncate">
                                <span>Normal Day</span>
                                <span className="font-mono text-[8px]">{dayRisk}%</span>
                              </div>
                              <div className="text-[8px] text-on-surface-variant font-mono truncate">
                                {day.periods?.length ?? 4} classes scheduled
                              </div>
                            </div>
                          )
                        ) : perspectiveMode === 'subject_walkout' ? (
                          /* Subject Walkout Mode: Highlights the #1 Vulnerable Subject */
                          vuln ? (
                            isSubjHigh ? (
                              <div className="space-y-0.5">
                                <div className="flex items-center justify-between text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-800 dark:text-amber-200 truncate">
                                  <span>{vuln.subject_code} (P{vuln.period})</span>
                                  <span className="font-mono">{vuln.walkout_score}%</span>
                                </div>
                                <div className="text-[8px] text-amber-700 dark:text-amber-300 font-semibold truncate flex items-center justify-between">
                                  <span>#1 Bunk Target</span>
                                  <span className="font-mono">{vuln.attendance_pct}% att</span>
                                </div>
                              </div>
                            ) : isSubjMed ? (
                              <div className="space-y-0.5">
                                <div className="flex items-center justify-between text-[9px] font-semibold px-1 py-0.5 rounded bg-sky-500/15 text-sky-700 dark:text-sky-300 truncate">
                                  <span>{vuln.subject_code} (P{vuln.period})</span>
                                  <span className="font-mono">{vuln.walkout_score}%</span>
                                </div>
                                <div className="text-[8px] text-on-surface-variant font-mono truncate">
                                  Moderate walkout risk
                                </div>
                              </div>
                            ) : (
                              <div className="space-y-0.5">
                                <div className="text-[9px] font-medium text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 px-1 py-0.5 rounded truncate">
                                  All Lectures Stable
                                </div>
                                <div className="text-[8px] text-on-surface-variant font-mono truncate">
                                  Low bunk likelihood
                                </div>
                              </div>
                            )
                          ) : (
                            <div className="text-[9px] text-on-surface-variant font-mono truncate">
                              No classes scheduled
                            </div>
                          )
                        ) : (
                          /* Combined View: Dual Perspective */
                          <div className="space-y-0.5">
                            <div className="flex items-center justify-between text-[8px] font-mono text-on-surface-variant">
                              <span>Day: {dayRisk}%</span>
                              {gainedDays >= 3 && <span className="font-bold text-primary">+{gainedDays}d</span>}
                            </div>
                            {vuln ? (
                              <div
                                className={`text-[8px] font-bold px-1 py-0.5 rounded truncate flex items-center justify-between ${
                                  isSubjHigh
                                    ? 'bg-amber-500/20 text-amber-800 dark:text-amber-200'
                                    : 'bg-surface-container text-on-surface'
                                }`}
                              >
                                <span>{vuln.subject_code} (P{vuln.period})</span>
                                <span>{vuln.walkout_score}%</span>
                              </div>
                            ) : (
                              <div className="text-[8px] text-on-surface-variant font-mono truncate">
                                {day.periods?.length ?? 4} classes
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            /* Agenda List View */
            <div className="flex-1 overflow-y-auto pr-1 space-y-2">
              {filteredSchedule.map((day) => {
                const isSelected = selectedDateStr === day.date;
                const dayRisk = day.overall_day_risk ?? day.risk_score;
                const vuln = day.most_vulnerable_subject;
                const isOverallHigh = dayRisk >= 65;
                const isOverallMed = dayRisk >= 35 && dayRisk < 65;
                const isSubjHigh = vuln?.walkout_level === 'HIGH';
                const isSubjMed = vuln?.walkout_level === 'MEDIUM';

                const isItemElevated =
                  perspectiveMode === 'overall_day'
                    ? isOverallHigh
                    : perspectiveMode === 'subject_walkout'
                    ? isSubjHigh
                    : day.risk_level === 'HIGH' || Boolean(day.predicted_mass_bunk);

                return (
                  <div
                    key={day.date}
                    onClick={() => setSelectedDateStr(day.date)}
                    className={`p-3 rounded-xl border flex items-center justify-between transition-all cursor-pointer ${
                      isSelected
                        ? 'border-primary bg-primary/5 ring-2 ring-primary/20'
                        : isItemElevated
                        ? perspectiveMode === 'subject_walkout'
                          ? 'border-amber-500/40 bg-amber-500/5 hover:border-amber-500'
                          : 'border-rose-500/40 bg-rose-500/5 hover:border-rose-500'
                        : 'border-outline-variant bg-surface-container-lowest hover:border-primary/40'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-9 h-9 rounded-lg flex flex-col items-center justify-center font-mono ${
                          day.is_holiday
                            ? 'bg-sky-500/20 text-sky-600'
                            : isItemElevated
                            ? perspectiveMode === 'subject_walkout'
                              ? 'bg-amber-500 text-white font-bold'
                              : 'bg-rose-500 text-white font-bold'
                            : 'bg-surface-container text-on-surface'
                        }`}
                      >
                        <span className="text-[9px] leading-none uppercase">{day.day.slice(0, 3)}</span>
                        <span className="text-xs font-bold leading-none mt-0.5">{day.day_num}</span>
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-on-surface">{day.date}</span>

                          {day.is_holiday ? (
                            <span className="text-[9px] font-medium px-1.5 py-0.2 rounded bg-sky-500/15 text-sky-600">
                              {day.holiday_name || 'Holiday / Campus Closed'}
                            </span>
                          ) : perspectiveMode === 'overall_day' ? (
                            <>
                              <span
                                className={`text-[9px] font-bold px-1.5 py-0.2 rounded ${
                                  isOverallHigh
                                    ? 'bg-rose-500/15 text-rose-600 dark:text-rose-400'
                                    : isOverallMed
                                    ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300'
                                    : 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400'
                                }`}
                              >
                                {dayRisk}% DAY BUNK RISK
                              </span>
                              {(day.consecutive_days_gained ?? 0) >= 3 && (
                                <span className="text-[9px] font-mono px-1 py-0.2 rounded bg-surface-container text-primary font-bold">
                                  +{day.consecutive_days_gained}d Break
                                </span>
                              )}
                            </>
                          ) : perspectiveMode === 'subject_walkout' ? (
                            <>
                              {vuln ? (
                                <span
                                  className={`text-[9px] font-bold px-1.5 py-0.2 rounded flex items-center gap-1 ${
                                    isSubjHigh
                                      ? 'bg-amber-500/20 text-amber-700 dark:text-amber-300'
                                      : isSubjMed
                                      ? 'bg-sky-500/15 text-sky-700 dark:text-sky-300'
                                      : 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400'
                                  }`}
                                >
                                  <span className="material-symbols-outlined text-[12px]">menu_book</span>
                                  {vuln.subject_code} (P{vuln.period}) • {vuln.walkout_score}% Hazard
                                </span>
                              ) : (
                                <span className="text-[9px] font-medium px-1.5 py-0.2 rounded bg-surface-container text-on-surface-variant">
                                  No Classes
                                </span>
                              )}
                            </>
                          ) : (
                            <>
                              <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-surface-container text-on-surface">
                                Day: {dayRisk}%
                              </span>
                              {vuln && (
                                <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-700 dark:text-amber-300 font-semibold">
                                  Top Target: {vuln.subject_code} (P{vuln.period} • {vuln.walkout_score}%)
                                </span>
                              )}
                            </>
                          )}
                        </div>
                        <p className="text-[11px] text-on-surface-variant truncate max-w-lg mt-0.5">
                          {perspectiveMode === 'subject_walkout' && vuln
                            ? `${vuln.subject_code} in Period ${vuln.period}: ${vuln.reason} (${vuln.attendance_pct}% attendance)`
                            : day.reason}
                        </p>
                      </div>
                    </div>

                    <span className="material-symbols-outlined text-[16px] text-on-surface-variant">chevron_right</span>
                  </div>
                );
              })}
            </div>
          )}

          {/* Legend & Policy Status */}
          <div className="pt-2 border-t border-outline-variant flex flex-wrap items-center justify-between text-[11px] text-on-surface-variant mt-auto">
            <div className="flex items-center gap-3">
              {perspectiveMode === 'overall_day' ? (
                <>
                  <span className="flex items-center gap-1 font-semibold text-rose-600 dark:text-rose-400">
                    <span className="w-2.5 h-2.5 rounded-full bg-rose-500" /> Elevated Bridge Day (≥65%)
                  </span>
                  <span className="flex items-center gap-1 font-medium text-amber-600 dark:text-amber-400">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-500" /> Departure Pull (35%-64%)
                  </span>
                  <span className="flex items-center gap-1 font-medium text-emerald-600 dark:text-emerald-400">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> Normal Class Day (&lt;35%)
                  </span>
                  <span className="flex items-center gap-1 font-medium text-sky-600 dark:text-sky-400">
                    <span className="w-2.5 h-2.5 rounded-full bg-sky-500" /> Holiday / Off
                  </span>
                </>
              ) : perspectiveMode === 'subject_walkout' ? (
                <>
                  <span className="flex items-center gap-1 font-semibold text-amber-600 dark:text-amber-400">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-500" /> #1 Mass Bunk Target (≥65%)
                  </span>
                  <span className="flex items-center gap-1 font-medium text-sky-600 dark:text-sky-400">
                    <span className="w-2.5 h-2.5 rounded-full bg-sky-500" /> Moderate Walkout (35%-64%)
                  </span>
                  <span className="flex items-center gap-1 font-medium text-emerald-600 dark:text-emerald-400">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> Stable Lecture (&lt;35%)
                  </span>
                </>
              ) : (
                <>
                  <span className="flex items-center gap-1 font-semibold text-rose-600 dark:text-rose-400">
                    <span className="w-2.5 h-2.5 rounded-full bg-rose-500" /> Elevated Risk (≥65%)
                  </span>
                  <span className="flex items-center gap-1 font-medium text-amber-600 dark:text-amber-400">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-500" /> Moderate Risk (35%-64%)
                  </span>
                  <span className="flex items-center gap-1 font-medium text-emerald-600 dark:text-emerald-400">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> Low Risk (&lt;35%)
                  </span>
                  <span className="flex items-center gap-1 font-medium text-sky-600 dark:text-sky-400">
                    <span className="w-2.5 h-2.5 rounded-full bg-sky-500" /> Holiday / Weekend
                  </span>
                </>
              )}
            </div>

            <span className="text-[10px] font-mono text-on-surface-variant">
              Active: {weekendPolicy === 'sat_sun' ? '5-Day Week (Sat+Sun Off)' : weekendPolicy === 'sunday_only' ? '6-Day Week' : 'Alt Saturdays'} • Click any date to inspect.
            </span>
          </div>
        </div>

        {/* ─── Right: Docked Day Inspector Panel ─────────────────────────────────── */}
        <div className="w-full lg:w-[25%] h-full bg-surface-container-lowest border border-outline-variant rounded-2xl shadow-xs flex flex-col overflow-hidden">
          {selectedDay ? (
            <div className="flex-1 flex flex-col p-4 overflow-y-auto space-y-3.5">
              {/* Day Header Badge */}
              <div className="border-b border-outline-variant pb-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-secondary-container text-on-secondary-container">
                    {selectedDay.day}
                  </span>
                  {selectedDay.is_holiday ? (
                    <span className="text-[9px] font-bold px-2 py-0.5 rounded bg-sky-500/15 text-sky-600 dark:text-sky-400">
                      HOLIDAY / OFF
                    </span>
                  ) : perspectiveMode === 'overall_day' ? (
                    <span
                      className={`text-[9px] font-bold px-2 py-0.5 rounded flex items-center gap-1 ${
                        (selectedDay.overall_day_risk ?? selectedDay.risk_score) >= 65
                          ? 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30'
                          : (selectedDay.overall_day_risk ?? selectedDay.risk_score) >= 35
                          ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30'
                          : 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30'
                      }`}
                    >
                      {(selectedDay.overall_day_risk ?? selectedDay.risk_score)}% OVERALL DAY RISK
                    </span>
                  ) : perspectiveMode === 'subject_walkout' ? (
                    <span
                      className={`text-[9px] font-bold px-2 py-0.5 rounded flex items-center gap-1 ${
                        selectedDay.most_vulnerable_subject?.walkout_level === 'HIGH'
                          ? 'bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/30'
                          : selectedDay.most_vulnerable_subject?.walkout_level === 'MEDIUM'
                          ? 'bg-sky-500/15 text-sky-700 dark:text-sky-300 border border-sky-500/30'
                          : 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30'
                      }`}
                    >
                      {selectedDay.most_vulnerable_subject
                        ? `${selectedDay.most_vulnerable_subject.walkout_score}% WALKOUT HAZARD`
                        : '0% (NO LECTURES)'}
                    </span>
                  ) : (
                    <span
                      className={`text-[9px] font-bold px-2 py-0.5 rounded flex items-center gap-1 ${
                        selectedDay.risk_level === 'HIGH' || selectedDay.has_detected_bunk
                          ? 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30'
                          : 'bg-surface-container text-on-surface-variant'
                      }`}
                    >
                      {selectedDay.risk_score}% PROBABILITY
                    </span>
                  )}
                </div>
                <h3 className="text-base font-bold text-on-surface mt-1.5">{selectedDay.date}</h3>
                <p className="text-[11px] text-on-surface-variant">
                  {selectedDay.is_holiday
                    ? selectedDay.holiday_name
                    : `Section ${activeSection} Timetable Schedule`}
                </p>
              </div>

              {/* ─── Mode Specific Primary Card ─── */}
              {!selectedDay.is_holiday && perspectiveMode === 'overall_day' && (
                <div
                  className={`p-3 rounded-xl border space-y-1.5 text-xs ${
                    (selectedDay.overall_day_risk ?? selectedDay.risk_score) >= 65
                      ? 'bg-rose-500/10 border-rose-500/30 text-rose-600 dark:text-rose-400'
                      : (selectedDay.overall_day_risk ?? selectedDay.risk_score) >= 35
                      ? 'bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-300'
                      : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-400'
                  }`}
                >
                  <div className="flex items-center justify-between font-bold">
                    <span className="flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-[16px]">
                        {(selectedDay.overall_day_risk ?? selectedDay.risk_score) >= 65
                          ? 'local_fire_department'
                          : (selectedDay.overall_day_risk ?? selectedDay.risk_score) >= 35
                          ? 'trending_up'
                          : 'check_circle'}
                      </span>
                      {(selectedDay.overall_day_risk ?? selectedDay.risk_score) >= 65
                        ? 'Critical Bridge Day Hazard'
                        : (selectedDay.overall_day_risk ?? selectedDay.risk_score) >= 35
                        ? 'Pre-Weekend Departure Pull'
                        : 'Normal Academic Attendance'}
                    </span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded font-extrabold bg-current/15">
                      {selectedDay.overall_day_risk ?? selectedDay.risk_score}% Risk
                    </span>
                  </div>
                  <p className="text-[11px] text-on-surface leading-snug">
                    {(selectedDay.overall_day_risk ?? selectedDay.risk_score) >= 65 ? (
                      <>
                        Absenteeism on this single date yields a contiguous{' '}
                        <span className="font-bold text-rose-600 dark:text-rose-400">
                          +{selectedDay.consecutive_days_gained} Days Off block
                        </span>. High travel leverage heavily incentivizes students to skip the entire day.
                      </>
                    ) : (selectedDay.overall_day_risk ?? selectedDay.risk_score) >= 35 ? (
                      <>
                        Friday/Monday proximity to weekend creates moderate departure pressure ({selectedDay.overall_day_risk}%), but core classes proceed normally.
                      </>
                    ) : (
                      <>
                        Calm mid-week academic session. Expected cohort classroom retention &gt;96%. Zero holiday bridge incentives.
                      </>
                    )}
                  </p>
                </div>
              )}

              {!selectedDay.is_holiday && perspectiveMode === 'subject_walkout' && (
                <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 space-y-2 text-xs text-amber-700 dark:text-amber-300">
                  <div className="flex items-center justify-between font-bold">
                    <span className="flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-[16px]">menu_book</span>
                      #1 Most Likely Subject to Bunk
                    </span>
                    {selectedDay.most_vulnerable_subject && (
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500 text-white font-extrabold">
                        {selectedDay.most_vulnerable_subject.walkout_score}% Cut Risk
                      </span>
                    )}
                  </div>

                  {selectedDay.most_vulnerable_subject ? (
                    <div className="space-y-1.5 text-on-surface">
                      <div className="flex items-center justify-between text-xs bg-surface-container-low p-2 rounded-lg border border-outline-variant/60">
                        <div>
                          <span className="font-bold text-amber-600 dark:text-amber-400 text-sm block">
                            {selectedDay.most_vulnerable_subject.subject_code}
                          </span>
                          <span className="text-[10px] text-on-surface-variant">
                            Period {selectedDay.most_vulnerable_subject.period} (Closing Lecture)
                          </span>
                        </div>
                        <div className="text-right font-mono text-[11px]">
                          <span className="font-bold text-rose-600 dark:text-rose-400 block">
                            {selectedDay.most_vulnerable_subject.attendance_pct}% att
                          </span>
                          <span className="text-[9px] text-on-surface-variant">
                            {selectedDay.most_vulnerable_subject.bunk_count} cuts recorded
                          </span>
                        </div>
                      </div>
                      <p className="text-[11px] text-on-surface-variant leading-tight">
                        {selectedDay.most_vulnerable_subject.reason}
                      </p>
                    </div>
                  ) : (
                    <p className="text-[11px] text-on-surface-variant">
                      No vulnerable subjects identified for this day. All scheduled lectures show stable historical retention.
                    </p>
                  )}
                </div>
              )}

              {/* Consecutive Vacation Gain Math Card */}
              {!selectedDay.is_holiday && (selectedDay.consecutive_days_gained ?? 0) >= 2 && (
                <div className="p-3 rounded-xl bg-primary/10 border border-primary/20 space-y-1.5 text-xs">
                  <div className="flex items-center justify-between font-bold text-primary">
                    <span className="flex items-center gap-1">
                      <span className="material-symbols-outlined text-[15px]">flight_takeoff</span>
                      Vacation Block Gain
                    </span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-primary text-on-primary">
                      +{selectedDay.consecutive_days_gained} Days Off
                    </span>
                  </div>
                  <p className="text-[11px] text-on-surface leading-snug">
                    Absence on this day converts surrounding off-days into a contiguous{' '}
                    <span className="font-bold text-primary">{selectedDay.consecutive_days_gained}-day break</span>.
                  </p>
                  {selectedDay.vacation_dates && selectedDay.vacation_dates.length > 0 && (
                    <div className="text-[10px] font-mono text-on-surface-variant flex items-center gap-1 pt-1 border-t border-primary/20">
                      <span>Span:</span>
                      <span className="font-semibold text-primary">{selectedDay.vacation_dates[0]}</span>
                      <span>&rarr;</span>
                      <span className="font-semibold text-primary">
                        {selectedDay.vacation_dates[selectedDay.vacation_dates.length - 1]}
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* High Co-Absence Event Card (If date had real co-absence) */}
              {selectedDay.bunk_details && (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 space-y-1.5 text-xs text-rose-600 dark:text-rose-400">
                  <div className="flex items-center gap-1.5 font-bold">
                    <span className="material-symbols-outlined text-[15px]">analytics</span>
                    <span>High Co-Absence Event (P = {selectedDay.risk_score}%)</span>
                  </div>
                  <div className="text-[11px] text-on-surface space-y-0.5">
                    <div>
                      Absentees:{' '}
                      <span className="font-bold text-rose-600 dark:text-rose-400">
                        {selectedDay.bunk_details.absent_count} of {selectedDay.bunk_details.total_enrolled} students (50%)
                      </span>
                    </div>
                    <div>
                      Period:{' '}
                      <span className="font-semibold">
                        Period {selectedDay.bunk_details.period} ({selectedDay.bunk_details.subject})
                      </span>
                    </div>
                    {selectedDay.bunk_details.anchor && (
                      <div>Key Anchor: <span className="font-bold">{selectedDay.bunk_details.anchor}</span></div>
                    )}
                  </div>
                </div>
              )}

              {/* Predicted Mass Bunk Hazard Banner (Combined View or Scope view) */}
              {perspectiveMode === 'combined' && (selectedDay.predicted_mass_bunk || selectedDay.mass_bunk_scope) && (
                <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/40 space-y-1.5 text-xs text-rose-600 dark:text-rose-400 shadow-2xs">
                  <div className="flex items-center justify-between font-bold">
                    <span className="flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-[16px]">groups</span>
                      Mass Bunk Hazard Flagged
                    </span>
                    <span className="text-[9px] font-mono uppercase px-1.5 py-0.2 rounded bg-rose-500 text-white font-extrabold">
                      {selectedDay.mass_bunk_scope === 'SPECIFIC_LECTURE'
                        ? 'Specific Lecture'
                        : selectedDay.mass_bunk_scope === 'WHOLE_DAY'
                        ? 'Whole Day'
                        : 'Compound Hazard'}
                    </span>
                  </div>
                  <p className="text-[11px] text-on-surface leading-snug">
                    {selectedDay.mass_bunk_scope === 'SPECIFIC_LECTURE' ? (
                      <>
                        <span className="font-bold text-rose-600 dark:text-rose-400">Specific Lecture Walkout:</span>{' '}
                        Students attend campus but selectively skip{' '}
                        <span className="font-bold">
                          Period {selectedDay.target_lecture?.period} ({selectedDay.target_lecture?.subject_code})
                        </span>.
                      </>
                    ) : selectedDay.mass_bunk_scope === 'WHOLE_DAY' ? (
                      <>
                        <span className="font-bold text-rose-600 dark:text-rose-400">Whole-Day Mass Bunk:</span>{' '}
                        High travel leverage (+{selectedDay.consecutive_days_gained}d break) incentivizes staying home for the entire academic schedule.
                      </>
                    ) : (
                      <>
                        <span className="font-bold text-rose-600 dark:text-rose-400">Compound Hazard:</span>{' '}
                        High full-day travel absenteeism risk, plus targeted walkout hazard during closing{' '}
                        <span className="font-bold">
                          Period {selectedDay.target_lecture?.period} ({selectedDay.target_lecture?.subject_code})
                        </span>.
                      </>
                    )}
                  </p>
                </div>
              )}

              {/* Risk Attribution & Reason */}
              <div className="p-3 bg-surface-container-low rounded-xl border border-outline-variant space-y-1.5 text-xs">
                <span className="text-[10px] font-bold text-primary uppercase tracking-wider block">
                  Empirical Risk Attribution &amp; Probabilities
                </span>
                <p className="text-[11px] text-on-surface leading-relaxed">{selectedDay.reason}</p>
                <div className="pt-1.5 border-t border-outline-variant/60 text-[10px] text-on-surface-variant">
                  <span className="font-semibold text-on-surface">Guidance: </span>
                  {selectedDay.recommendation}
                </div>
              </div>

              {/* Scheduled Periods for this Day & Walkout Ranking */}
              <div className="flex-1">
                <h4 className="text-xs font-bold text-on-surface mb-2 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[15px] text-primary">schedule</span>
                    Timetable Slots &amp; Walkout Ranking
                  </span>
                  <span className="text-[10px] font-mono text-on-surface-variant font-normal">
                    {selectedDay.periods?.length ?? 0} slots
                  </span>
                </h4>

                {selectedDay.is_holiday ? (
                  <div className="p-3 rounded-xl bg-surface-container text-center text-xs text-on-surface-variant">
                    Campus closed. No academic periods scheduled.
                  </div>
                ) : !selectedDay.periods || selectedDay.periods.length === 0 ? (
                  <div className="p-3 rounded-xl bg-surface-container text-center text-xs text-on-surface-variant">
                    No timetable periods mapped for this day.
                  </div>
                ) : (
                  <div className="space-y-1.5 max-h-48 overflow-y-auto pr-0.5">
                    {selectedDay.periods.map((slot, idx) => {
                      const isTopVuln =
                        selectedDay.most_vulnerable_subject?.subject_code === slot.subject &&
                        selectedDay.most_vulnerable_subject?.period === slot.period;
                      const isModerate = slot.subject === 'CS303';
                      const isHighRetention = slot.subject === 'CS301' || slot.subject === 'CS302';

                      return (
                        <div
                          key={idx}
                          className={`p-2 rounded-xl border text-xs flex items-center justify-between transition-all ${
                            isTopVuln
                              ? 'bg-amber-500/10 border-amber-500/40 shadow-2xs'
                              : slot.is_lab
                              ? 'bg-rose-500/5 border-rose-500/30'
                              : 'bg-surface-container border-outline-variant/60'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <span
                              className={`w-6 h-6 rounded-md flex items-center justify-center font-bold text-[10px] ${
                                isTopVuln
                                  ? 'bg-amber-500 text-white font-extrabold'
                                  : 'bg-surface-container-highest text-on-surface'
                              }`}
                            >
                              P{slot.period}
                            </span>
                            <div>
                              <div className="flex items-center gap-1.5">
                                <span className="font-semibold text-on-surface text-[11px] block">{slot.subject}</span>
                                {isTopVuln && (
                                  <span className="text-[8px] font-extrabold px-1.5 py-0.2 rounded bg-amber-500 text-white tracking-wide uppercase">
                                    #1 Bunk Target
                                  </span>
                                )}
                              </div>
                              <span className="text-[9px] text-on-surface-variant flex items-center gap-1">
                                <span>{slot.room}</span>
                                {isTopVuln && (
                                  <span className="font-semibold text-amber-700 dark:text-amber-300">
                                    • {selectedDay.most_vulnerable_subject?.attendance_pct}% att
                                  </span>
                                )}
                                {isModerate && (
                                  <span className="text-sky-600 dark:text-sky-400">
                                    • 95.5% att (moderate)
                                  </span>
                                )}
                                {isHighRetention && (
                                  <span className="text-emerald-600 dark:text-emerald-400">
                                    • 97%+ att (safe)
                                  </span>
                                )}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-1">
                            {slot.is_lab && (
                              <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-rose-500/15 text-rose-600 dark:text-rose-400">
                                LAB
                              </span>
                            )}
                            {isTopVuln ? (
                              <span className="text-[9px] font-mono font-bold px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-800 dark:text-amber-200">
                                {selectedDay.most_vulnerable_subject?.walkout_score}% Hazard
                              </span>
                            ) : isModerate ? (
                              <span className="text-[9px] font-mono text-on-surface-variant px-1.5 py-0.2 rounded bg-surface-container-highest">
                                45% Hazard
                              </span>
                            ) : (
                              <span className="text-[9px] font-mono text-emerald-700 dark:text-emerald-400 px-1.5 py-0.2 rounded bg-emerald-500/10">
                                Safe
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Quick Single Day Holiday Toggle */}
              <div className="pt-2 border-t border-outline-variant">
                {selectedDay.is_holiday ? (
                  <button
                    onClick={() => handleDeleteHoliday(selectedDay.date)}
                    className="w-full py-1.5 bg-surface-container hover:bg-error/10 hover:text-error text-on-surface border border-outline-variant text-[11px] font-semibold rounded-xl transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                    title="Convert this day back to an academic working day"
                  >
                    <span className="material-symbols-outlined text-[14px]">event_busy</span>
                    Remove Holiday Status
                  </button>
                ) : (
                  <button
                    onClick={() => {
                      setBulkName('Institutional Holiday');
                      setBulkStartDate(selectedDay.date);
                      setBulkEndDate(selectedDay.date);
                      setRangeMode('single');
                      setManageModalOpen(true);
                    }}
                    className="w-full py-1.5 bg-surface-container hover:bg-sky-500/10 hover:text-sky-600 text-on-surface border border-outline-variant text-[11px] font-semibold rounded-xl transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                    title="Mark this day as a holiday"
                  >
                    <span className="material-symbols-outlined text-[14px]">beach_access</span>
                    Mark as Institutional Holiday
                  </button>
                )}
              </div>

              {/* Proactive Action Buttons */}
              <div className="space-y-2">
                <button
                  onClick={() => {
                    syncFromSelectedDay();
                    setCalcModalOpen(true);
                  }}
                  className="w-full py-2 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/30 text-xs font-semibold rounded-xl hover:bg-indigo-500 hover:text-white transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <span className="material-symbols-outlined text-[15px]">calculate</span>
                  Analyze in Prediction Calculator
                </button>

                <button
                  onClick={() => onNavigate('interventions', { date: selectedDay.date })}
                  className="w-full py-2 bg-primary text-on-primary text-xs font-semibold rounded-xl hover:opacity-90 transition-opacity flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <span className="material-symbols-outlined text-[14px]">flag</span>
                  Schedule Proactive Intervention
                </button>

                <button
                  onClick={() => setAiDraftOpen(true)}
                  className="w-full py-1.5 bg-surface-container text-on-surface border border-outline-variant text-xs font-medium rounded-xl hover:bg-surface-container-high transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[14px]">mail</span>
                  Draft Student Notice
                </button>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-xs text-on-surface-variant space-y-2">
              <span className="material-symbols-outlined text-[28px] text-outline">calendar_today</span>
              <p>Select any day on the calendar to view timetable periods and calibrated absence risk analysis.</p>
            </div>
          )}
        </div>
      </div>

      {/* ─── Manage Academic Holidays Modal (Bulk + Range) ─────────────────────────── */}
      {manageModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl max-w-xl w-full p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-outline-variant pb-2.5">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                  <span className="material-symbols-outlined text-[18px]">edit_calendar</span>
                </div>
                <div>
                  <h3 className="text-sm font-bold text-on-surface">Manage Academic Holidays</h3>
                  <p className="text-[11px] text-on-surface-variant">
                    Adjust holidays manually in bulk or single days. Hazards immediately recalculate.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setManageModalOpen(false)}
                className="text-on-surface-variant hover:text-on-surface p-1 rounded-lg cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Modal Tabs */}
            <div className="flex border-b border-outline-variant text-xs font-semibold">
              <button
                onClick={() => setModalTab('add')}
                className={`pb-2 px-3 border-b-2 cursor-pointer transition-colors ${
                  modalTab === 'add'
                    ? 'border-primary text-primary'
                    : 'border-transparent text-on-surface-variant hover:text-on-surface'
                }`}
              >
                Add Holidays (Bulk / Range)
              </button>
              <button
                onClick={() => {
                  setModalTab('list');
                  loadEvents();
                }}
                className={`pb-2 px-3 border-b-2 cursor-pointer transition-colors ${
                  modalTab === 'list'
                    ? 'border-primary text-primary'
                    : 'border-transparent text-on-surface-variant hover:text-on-surface'
                }`}
              >
                Configured Holidays ({allEvents.length})
              </button>
            </div>

            {/* Feedback notification */}
            {formFeedback && (
              <div
                className={`p-2.5 rounded-xl text-xs flex items-center gap-2 ${
                  formFeedback.type === 'success'
                    ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                    : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/30'
                }`}
              >
                <span className="material-symbols-outlined text-[16px]">
                  {formFeedback.type === 'success' ? 'check_circle' : 'error'}
                </span>
                <span>{formFeedback.text}</span>
              </div>
            )}

            {modalTab === 'add' ? (
              <form onSubmit={handleBulkSubmit} className="space-y-3.5">
                {/* Holiday Title */}
                <div>
                  <label className="text-[11px] font-semibold text-on-surface block mb-1">
                    Holiday / Event Title
                  </label>
                  <input
                    type="text"
                    required
                    value={bulkName}
                    onChange={(e) => setBulkName(e.target.value)}
                    placeholder="e.g. Diwali Festival Break, Sports Day, Prep Leave"
                    className="w-full bg-surface-container-low border border-outline-variant rounded-xl px-3 py-1.5 text-xs text-on-surface focus:outline-none focus:border-primary"
                  />
                </div>

                {/* Range Mode Switcher */}
                <div className="flex items-center gap-4 text-xs">
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="rangeMode"
                      checked={rangeMode === 'range'}
                      onChange={() => setRangeMode('range')}
                      className="text-primary"
                    />
                    <span className="font-medium text-on-surface">Date Range (Multi-day block)</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="rangeMode"
                      checked={rangeMode === 'single'}
                      onChange={() => setRangeMode('single')}
                      className="text-primary"
                    />
                    <span className="font-medium text-on-surface">Single Day</span>
                  </label>
                </div>

                {/* Dates */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-semibold text-on-surface block mb-1">
                      {rangeMode === 'range' ? 'Start Date' : 'Holiday Date'}
                    </label>
                    <input
                      type="date"
                      required
                      value={bulkStartDate}
                      onChange={(e) => setBulkStartDate(e.target.value)}
                      className="w-full bg-surface-container-low border border-outline-variant rounded-xl px-3 py-1.5 text-xs text-on-surface focus:outline-none focus:border-primary"
                    />
                  </div>

                  {rangeMode === 'range' && (
                    <div>
                      <label className="text-[11px] font-semibold text-on-surface block mb-1">
                        End Date (Inclusive)
                      </label>
                      <input
                        type="date"
                        required
                        value={bulkEndDate}
                        onChange={(e) => setBulkEndDate(e.target.value)}
                        className="w-full bg-surface-container-low border border-outline-variant rounded-xl px-3 py-1.5 text-xs text-on-surface focus:outline-none focus:border-primary"
                      />
                    </div>
                  )}
                </div>

                {/* Type & Presets */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-semibold text-on-surface block mb-1">Category</label>
                    <select
                      value={bulkType}
                      onChange={(e) => setBulkType(e.target.value)}
                      className="w-full bg-surface-container-low border border-outline-variant rounded-xl px-3 py-1.5 text-xs text-on-surface focus:outline-none focus:border-primary cursor-pointer"
                    >
                      <option value="HOLIDAY">HOLIDAY (No classes)</option>
                      <option value="EVENT">ACADEMIC EVENT (Symposium / Fest)</option>
                      <option value="EXAM">EXAMINATION PERIOD</option>
                    </select>
                  </div>

                  {/* Quick Presets */}
                  <div>
                    <label className="text-[11px] font-semibold text-on-surface block mb-1">Quick Presets</label>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <button
                        type="button"
                        onClick={() => applyPreset('Diwali Vacation Break', '2026-10-21', '2026-10-23')}
                        className="text-[10px] px-2 py-0.5 rounded bg-surface-container hover:bg-primary/20 text-on-surface hover:text-primary transition-colors cursor-pointer"
                      >
                        Diwali Break (3d)
                      </button>
                      <button
                        type="button"
                        onClick={() => applyPreset('College Sports Day', '2026-10-14', '2026-10-15')}
                        className="text-[10px] px-2 py-0.5 rounded bg-surface-container hover:bg-primary/20 text-on-surface hover:text-primary transition-colors cursor-pointer"
                      >
                        Sports Fest (2d)
                      </button>
                    </div>
                  </div>
                </div>

                {/* Form Buttons */}
                <div className="flex justify-between items-center pt-2 border-t border-outline-variant">
                  <span className="text-[10px] text-on-surface-variant font-mono">
                    Saves to database &amp; triggers instant risk recalculation
                  </span>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setManageModalOpen(false)}
                      className="px-3 py-1.5 text-xs text-on-surface-variant hover:bg-surface-container rounded-lg cursor-pointer"
                    >
                      Close
                    </button>
                    <button
                      type="submit"
                      disabled={bulkSubmitting}
                      className="px-4 py-1.5 bg-primary text-on-primary text-xs font-semibold rounded-xl hover:opacity-90 flex items-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-50"
                    >
                      <span className="material-symbols-outlined text-[15px]">save</span>
                      {bulkSubmitting ? 'Saving...' : 'Apply Holidays & Recalculate'}
                    </button>
                  </div>
                </div>
              </form>
            ) : (
              /* Configured Holidays List Tab */
              <div className="space-y-3">
                <div className="max-h-64 overflow-y-auto divide-y divide-outline-variant/60 border border-outline-variant rounded-xl">
                  {loadingEvents ? (
                    <div className="py-8 text-center text-xs text-on-surface-variant">Loading holidays...</div>
                  ) : allEvents.length === 0 ? (
                    <div className="py-8 text-center text-xs text-on-surface-variant">No holidays configured.</div>
                  ) : (
                    allEvents.map((evt) => (
                      <div
                        key={evt.id || evt.date}
                        className="p-2.5 flex items-center justify-between text-xs hover:bg-surface-container-low transition-colors"
                      >
                        <div className="flex items-center gap-2.5">
                          <span className="font-mono text-[11px] font-bold text-primary">{evt.date}</span>
                          <span className="font-semibold text-on-surface">{evt.name}</span>
                          <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-surface-container text-on-surface-variant">
                            {evt.type}
                          </span>
                        </div>

                        <button
                          onClick={() => handleDeleteHoliday(evt.date)}
                          className="p-1 rounded text-on-surface-variant hover:text-error hover:bg-error/10 transition-colors cursor-pointer"
                          title={`Delete holiday on ${evt.date}`}
                        >
                          <span className="material-symbols-outlined text-[16px]">delete</span>
                        </button>
                      </div>
                    ))
                  )}
                </div>

                <div className="flex justify-between items-center pt-2 border-t border-outline-variant">
                  <button
                    onClick={handleResetDefaults}
                    className="text-xs text-error font-medium hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[14px]">restore</span>
                    Restore 2026 University Defaults
                  </button>

                  <button
                    onClick={() => setManageModalOpen(false)}
                    className="px-3.5 py-1.5 bg-surface-container hover:bg-surface-container-high text-xs font-semibold rounded-lg cursor-pointer"
                  >
                    Done
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── Draft Student Reminder Notice Modal ──────────────────────────────────── */}
      {aiDraftOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl max-w-lg w-full p-5 space-y-3 shadow-xl">
            <div className="flex items-center justify-between border-b border-outline-variant pb-2.5">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-[18px]">auto_awesome</span>
                <h3 className="text-sm font-bold text-on-surface">Class Attendance Notice ({selectedDay?.date})</h3>
              </div>
              <button
                onClick={() => setAiDraftOpen(false)}
                className="text-on-surface-variant hover:text-on-surface p-1 rounded-lg cursor-pointer"
              >
                ✕
              </button>
            </div>

            <p className="text-[11px] text-on-surface-variant">
              Prepared for announcement to Section {activeSection} to deter absenteeism before high-risk period.
            </p>

            <textarea
              rows={4}
              value={draftNoticeText}
              onChange={(e) => setDraftNoticeText(e.target.value)}
              className="w-full bg-surface-container-low border border-outline-variant rounded-xl p-3 text-xs text-on-surface focus:outline-none focus:border-primary font-sans leading-relaxed"
            />

            <div className="flex justify-end gap-2 pt-1">
              <button
                onClick={() => setAiDraftOpen(false)}
                className="px-3 py-1.5 text-xs text-on-surface-variant hover:bg-surface-container rounded-lg cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  navigator.clipboard?.writeText(draftNoticeText);
                  alert('Class notice copied to clipboard!');
                  setAiDraftOpen(false);
                }}
                className="px-3.5 py-1.5 bg-primary text-on-primary text-xs font-semibold rounded-lg hover:opacity-90 flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <span className="material-symbols-outlined text-[15px]">content_copy</span>
                Copy Notice
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Calibrated Prediction Calculator Modal ─────────────────────────────── */}
      {calcModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl max-w-4xl w-full p-6 space-y-4 shadow-2xl max-h-[92vh] flex flex-col overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-outline-variant pb-3 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                  <span className="material-symbols-outlined text-[20px]">calculate</span>
                </div>
                <div>
                  <h3 className="text-base font-bold text-on-surface">Calibrated Absence Prediction Calculator</h3>
                  <p className="text-[11px] text-on-surface-variant">
                    Exact empirical log-odds model with additive feature attribution (SHAP-style). Zero vague guesswork.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setCalcModalOpen(false)}
                className="text-on-surface-variant hover:text-on-surface p-1.5 rounded-lg cursor-pointer transition-colors"
              >
                ✕
              </button>
            </div>

            {/* Body: 2 Columns */}
            <div className="grid grid-cols-12 gap-5 flex-1 overflow-y-auto pr-1">
              {/* Left Column: Configurable Scenario Inputs (Col 5) */}
              <div className="col-span-12 lg:col-span-5 space-y-3.5 bg-surface-container-low/40 p-4 rounded-xl border border-outline-variant/60 text-xs">
                <div className="flex items-center justify-between pb-2 border-b border-outline-variant/60">
                  <span className="font-bold text-on-surface text-[11px] uppercase tracking-wider">
                    Session Parameters
                  </span>
                  <button
                    type="button"
                    onClick={syncFromSelectedDay}
                    className="text-[10px] font-semibold text-primary hover:underline flex items-center gap-1 cursor-pointer"
                    title="Load date, period, and bridge status from calendar selection"
                  >
                    <span className="material-symbols-outlined text-[13px]">sync</span>
                    Sync from Calendar ({selectedDateStr.slice(5)})
                  </button>
                </div>

                {/* Day of Week */}
                <div>
                  <label className="text-[11px] font-semibold text-on-surface block mb-1">Day of Week</label>
                  <select
                    value={calcDay}
                    onChange={(e) => {
                      setCalcDay(e.target.value);
                      runPredictionCalculation({ day_of_week: e.target.value });
                    }}
                    className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-2.5 py-1.5 text-xs text-on-surface cursor-pointer focus:outline-none focus:border-primary"
                  >
                    <option value="Monday">Monday (Weekend return lag)</option>
                    <option value="Tuesday">Tuesday (Mid-week steady state)</option>
                    <option value="Wednesday">Wednesday (Mid-week baseline)</option>
                    <option value="Thursday">Thursday (Pre-weekend threshold)</option>
                    <option value="Friday">Friday (Pre-weekend departure pull)</option>
                  </select>
                </div>

                {/* Academic Period */}
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="text-[11px] font-semibold text-on-surface">Timetable Period</label>
                    <span className="text-[10px] font-mono text-primary font-bold">Period {calcPeriod}</span>
                  </div>
                  <div className="grid grid-cols-8 gap-1">
                    {[1, 2, 3, 4, 5, 6, 7, 8].map((p) => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => {
                          setCalcPeriod(p);
                          runPredictionCalculation({ period: p });
                        }}
                        className={`py-1 rounded text-center font-mono text-xs font-bold transition-all cursor-pointer ${
                          calcPeriod === p
                            ? 'bg-primary text-on-primary shadow-xs'
                            : 'bg-surface-container-lowest text-on-surface-variant hover:bg-surface-container border border-outline-variant/60'
                        }`}
                      >
                        P{p}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Subject Code */}
                <div>
                  <label className="text-[11px] font-semibold text-on-surface block mb-1">Subject Code</label>
                  <input
                    type="text"
                    value={calcSubject}
                    onChange={(e) => setCalcSubject(e.target.value)}
                    onBlur={() => runPredictionCalculation()}
                    placeholder="e.g. CS302, CS304, PHY301"
                    className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-2.5 py-1.5 text-xs text-on-surface uppercase font-mono focus:outline-none focus:border-primary"
                  />
                </div>

                {/* Laboratory / Practical Session Toggle */}
                <div className="flex items-center justify-between p-2.5 rounded-lg bg-surface-container-lowest border border-outline-variant/60">
                  <div>
                    <span className="font-semibold text-on-surface block text-[11px]">Laboratory Practical</span>
                    <span className="text-[10px] text-on-surface-variant">Mandatory logbook &amp; graded viva (-14.0% deterrence)</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={calcIsLab}
                    onChange={(e) => {
                      setCalcIsLab(e.target.checked);
                      runPredictionCalculation({ is_lab: e.target.checked });
                    }}
                    className="w-4 h-4 text-primary rounded cursor-pointer"
                  />
                </div>

                {/* Consecutive Vacation Days Gained */}
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="text-[11px] font-semibold text-on-surface">Vacation Block Gained (If Absent)</label>
                    <span className="text-[10px] font-mono text-primary font-bold">
                      {calcBridgeDays === 0 ? '0 days (Normal)' : `+${calcBridgeDays} days break`}
                    </span>
                  </div>
                  <div className="grid grid-cols-5 gap-1 text-[11px]">
                    {[0, 1, 2, 3, 4].map((bd) => (
                      <button
                        key={bd}
                        type="button"
                        onClick={() => {
                          setCalcBridgeDays(bd);
                          runPredictionCalculation({ bridge_days_gained: bd });
                        }}
                        className={`py-1 rounded text-center font-mono font-bold transition-all cursor-pointer ${
                          calcBridgeDays === bd
                            ? 'bg-rose-500 text-white shadow-xs'
                            : 'bg-surface-container-lowest text-on-surface-variant hover:bg-surface-container border border-outline-variant/60'
                        }`}
                      >
                        {bd === 4 ? '4+d' : `${bd}d`}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Pre-Holiday / Long Weekend Departure */}
                <div className="flex items-center justify-between p-2.5 rounded-lg bg-surface-container-lowest border border-outline-variant/60">
                  <div>
                    <span className="font-semibold text-on-surface block text-[11px]">Pre-Holiday Departure Day</span>
                    <span className="text-[10px] text-on-surface-variant">Immediate eve of gazetted university festival (+19.0%)</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={calcPreHoliday}
                    onChange={(e) => {
                      setCalcPreHoliday(e.target.checked);
                      runPredictionCalculation({ is_pre_holiday: e.target.checked });
                    }}
                    className="w-4 h-4 text-primary rounded cursor-pointer"
                  />
                </div>

                {/* Exam Proximity */}
                <div className="flex items-center justify-between p-2.5 rounded-lg bg-surface-container-lowest border border-outline-variant/60">
                  <div>
                    <span className="font-semibold text-on-surface block text-[11px]">Midterm / IA Exam Proximity</span>
                    <span className="text-[10px] text-on-surface-variant">Within 7 days of internal examinations (-26.0% deterrence)</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={calcExamProximity}
                    onChange={(e) => {
                      setCalcExamProximity(e.target.checked);
                      runPredictionCalculation({ is_exam_proximity: e.target.checked });
                    }}
                    className="w-4 h-4 text-primary rounded cursor-pointer"
                  />
                </div>

                {/* Cohort Social Risk Tier */}
                <div>
                  <label className="text-[11px] font-semibold text-on-surface block mb-1">Cohort Social Influence Tier</label>
                  <div className="grid grid-cols-3 gap-1">
                    {(['low', 'medium', 'high'] as const).map((tier) => (
                      <button
                        key={tier}
                        type="button"
                        onClick={() => {
                          setCalcCohortTier(tier);
                          runPredictionCalculation({ cohort_risk_tier: tier });
                        }}
                        className={`py-1 px-1 rounded text-center text-[10px] font-bold uppercase transition-all cursor-pointer ${
                          calcCohortTier === tier
                            ? tier === 'high'
                              ? 'bg-rose-500 text-white'
                              : tier === 'low'
                              ? 'bg-emerald-600 text-white'
                              : 'bg-amber-500 text-white'
                            : 'bg-surface-container-lowest text-on-surface-variant hover:bg-surface-container border border-outline-variant/60'
                        }`}
                      >
                        {tier === 'low' ? 'Low (-8%)' : tier === 'medium' ? 'Median (+3%)' : 'High (+16%)'}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Least Favourable Subject (High Bunk Propensity) Toggle */}
                <div className="flex items-center justify-between p-2.5 rounded-lg bg-surface-container-lowest border border-outline-variant/60">
                  <div>
                    <span className="font-semibold text-on-surface block text-[11px]">Least Favourable Subject</span>
                    <span className="text-[10px] text-on-surface-variant">Low cohort attendance / high historical bunks (+14.5%)</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={calcIsLeastFavourable}
                    onChange={(e) => {
                      setCalcIsLeastFavourable(e.target.checked);
                      runPredictionCalculation({ is_least_favourable: e.target.checked });
                    }}
                    className="w-4 h-4 text-primary rounded cursor-pointer"
                  />
                </div>

                <button
                  type="button"
                  disabled={calcLoading}
                  onClick={() => runPredictionCalculation()}
                  className="w-full py-2 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700 transition-colors flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 shadow-xs"
                >
                  <span className={`material-symbols-outlined text-[16px] ${calcLoading ? 'animate-spin' : ''}`}>
                    {calcLoading ? 'sync' : 'auto_graph'}
                  </span>
                  {calcLoading ? 'Computing Calibrated Odds...' : 'Recalculate Absence Probability'}
                </button>
              </div>

              {/* Right Column: Precision Mathematical Results (Col 7) */}
              <div className="col-span-12 lg:col-span-7 space-y-4">
                {calcResult ? (
                  <>
                    {/* Primary Prediction Metric Card */}
                    <div className="p-4 rounded-xl border border-outline-variant bg-surface-container-lowest space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">
                          Calibrated Absence Probability
                        </span>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            calcResult.risk_level === 'HIGH'
                              ? 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30'
                              : calcResult.risk_level === 'MEDIUM'
                              ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30'
                              : 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                          }`}
                        >
                          {calcResult.risk_level} ABSENCE PROBABILITY
                        </span>
                      </div>

                      <div className="flex items-baseline gap-3">
                        <span className="text-4xl font-extrabold font-mono tracking-tight text-on-surface">
                          {calcResult.probability}%
                        </span>
                        <span className="text-xs font-mono text-on-surface-variant">
                          95% CI: [{calcResult.confidence_interval[0]}% – {calcResult.confidence_interval[1]}%] (±{calcResult.margin_of_error}%)
                        </span>
                      </div>

                      {/* Progress Bar */}
                      <div className="w-full h-2 rounded-full bg-surface-container overflow-hidden">
                        <div
                          className={`h-full transition-all duration-300 rounded-full ${
                            calcResult.probability >= 65
                              ? 'bg-rose-500'
                              : calcResult.probability >= 35
                              ? 'bg-amber-500'
                              : 'bg-emerald-500'
                          }`}
                          style={{ width: `${calcResult.probability}%` }}
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-3 pt-2 border-t border-outline-variant/60 text-xs font-mono">
                        <div>
                          <span className="text-[10px] text-on-surface-variant block">Institutional Baseline Rate:</span>
                          <span className="font-bold text-on-surface">{calcResult.baseline_rate}%</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-on-surface-variant block">Net Factor Attribution Impact:</span>
                          <span className={`font-bold ${calcResult.net_factor_impact >= 0 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600'}`}>
                            {calcResult.net_factor_impact >= 0 ? `+${calcResult.net_factor_impact}%` : `${calcResult.net_factor_impact}%`}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Attribution Waterfall / Breakdown */}
                    <div className="rounded-xl border border-outline-variant bg-surface-container-lowest overflow-hidden">
                      <div className="p-3 bg-surface-container-low border-b border-outline-variant flex justify-between items-center">
                        <span className="text-[11px] font-bold text-on-surface uppercase tracking-wider">
                          Feature Attribution Waterfall (SHAP-Style)
                        </span>
                        <span className="text-[10px] font-mono text-on-surface-variant">
                          Linear Log-Odds Additive Breakdown
                        </span>
                      </div>

                      <div className="divide-y divide-outline-variant/60 text-xs">
                        {calcResult.attributions.map((attr, idx) => {
                          const isPos = attr.impact > 0;
                          const isZero = attr.impact === 0;
                          return (
                            <div key={idx} className="p-2.5 flex items-center justify-between gap-2 hover:bg-surface-container-low/40 transition-colors">
                              <div className="space-y-0.5 max-w-[70%]">
                                <span className="font-semibold text-on-surface block text-[11px]">
                                  {attr.factor}
                                </span>
                                <span className="text-[10px] text-on-surface-variant block">
                                  {attr.description}
                                </span>
                              </div>

                              <div className="text-right shrink-0">
                                <span
                                  className={`font-mono text-xs font-bold px-1.5 py-0.5 rounded ${
                                    isZero
                                      ? 'bg-surface-container text-on-surface-variant'
                                      : isPos
                                      ? 'bg-rose-500/15 text-rose-600 dark:text-rose-400 font-extrabold'
                                      : 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-extrabold'
                                  }`}
                                >
                                  {attr.impact > 0 ? `+${attr.impact.toFixed(1)}%` : `${attr.impact.toFixed(1)}%`}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Mathematical Integrity Callout */}
                    <div className="p-3 bg-primary/5 rounded-xl border border-primary/20 text-xs space-y-1">
                      <div className="flex items-center gap-1.5 font-bold text-primary text-[11px]">
                        <span className="material-symbols-outlined text-[15px]">verified</span>
                        <span>Verifiable Empirical Formula</span>
                      </div>
                      <p className="text-[11px] text-on-surface-variant leading-relaxed">
                        Model: <code className="bg-surface-container px-1 py-0.5 rounded font-mono text-[10px]">{calcResult.mathematical_model}</code>. All probabilities reflect historical class registers and peer cohort influence metrics.
                      </p>
                    </div>
                  </>
                ) : (
                  <div className="p-12 text-center text-xs text-on-surface-variant flex flex-col items-center justify-center space-y-2">
                    <span className="material-symbols-outlined text-[28px] animate-spin text-primary">sync</span>
                    <span>Computing initial calibrated scenario...</span>
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex justify-between items-center pt-3 border-t border-outline-variant shrink-0">
              <span className="text-[11px] text-on-surface-variant">
                Section: <span className="font-semibold text-on-surface">{activeSection}</span> • Institutional Baseline: <span className="font-semibold text-on-surface">14.2%</span>
              </span>
              <button
                type="button"
                onClick={() => setCalcModalOpen(false)}
                className="px-4 py-1.5 bg-surface-container hover:bg-surface-container-high text-xs font-semibold rounded-lg cursor-pointer transition-colors"
              >
                Close Calculator
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
