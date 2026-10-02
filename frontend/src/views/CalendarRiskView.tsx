import React, { useState, useEffect } from 'react';
import { api, CalendarRiskDay, CalendarEvent } from '../api/client';

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

  // Teacher Holiday Management Modal
  const [manageModalOpen, setManageModalOpen] = useState(false);
  const [modalTab, setModalTab] = useState<'add' | 'list'>('add');
  const [allEvents, setAllEvents] = useState<CalendarEvent[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(false);

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

  // Filtered days
  const filteredSchedule = riskSchedule.filter((d) => {
    if (filterMode === 'high_risk') return d.risk_level === 'HIGH' || d.has_detected_bunk;
    if (filterMode === 'holidays') return d.is_holiday;
    return true;
  });

  const highRiskCount = riskSchedule.filter((d) => d.risk_level === 'HIGH' || d.has_detected_bunk).length;
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
              <h1 className="text-base font-bold text-on-surface tracking-tight">Academic Calendar &amp; Mass Bunk Hazards</h1>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-surface-container text-on-surface-variant border border-outline-variant">
                Section {activeSection}
              </span>
              {highRiskCount > 0 && (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30">
                  <span className="material-symbols-outlined text-[12px]">local_fire_department</span>
                  {highRiskCount} High Risk Dates
                </span>
              )}
            </div>
            <p className="text-[11px] text-on-surface-variant">
              Deterministic mathematical modeling of contiguous vacation gains, bridge days, and weekend policies
            </p>
          </div>
        </div>

        {/* Toolbar Controls */}
        <div className="flex items-center flex-wrap gap-2">
          {/* Weekend Policy Dropdown */}
          <div className="flex items-center bg-surface-container-lowest border border-outline-variant rounded-lg px-2 py-1 text-xs shadow-2xs">
            <span className="material-symbols-outlined text-[14px] text-primary mr-1">weekend</span>
            <span className="text-[10px] font-medium text-on-surface-variant mr-1.5 hidden sm:inline">Schedule:</span>
            <select
              value={weekendPolicy}
              onChange={(e) => setWeekendPolicy(e.target.value as any)}
              className="bg-transparent text-on-surface text-xs font-semibold focus:outline-none cursor-pointer"
              title="College weekend policy for recalculating bunk hazards"
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
              Bunk Dates
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

      {/* ─── Minimalist Classroom Alert Banner ───────────────────────────────────── */}
      {highRiskCount > 0 && (
        <div className="p-2 px-3 rounded-xl bg-surface-container-lowest border border-rose-500/30 flex items-center justify-between text-xs shadow-2xs">
          <div className="flex items-center gap-2">
            <span className="w-5 h-5 rounded-md bg-rose-500/15 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-[14px]">local_fire_department</span>
            </span>
            <span className="font-semibold text-on-surface shrink-0">
              Classroom Risk Alert:
            </span>
            <span className="text-on-surface-variant truncate">
              {highRiskCount} dates in {monthTitle} carry elevated mass bunk hazards under{' '}
              {weekendPolicy === 'sat_sun' ? '5-Day Week' : weekendPolicy === 'sunday_only' ? '6-Day Week' : 'Alternate Sat'} policy • Oct 2 (Gandhi Jayanti), Oct 16 (Physics Lab), Oct 19 (Bridge Hazard), Oct 23/30.
            </span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => {
                setSelectedDateStr('2026-10-19');
                setFilterMode('high_risk');
              }}
              className="text-[11px] font-bold text-rose-600 dark:text-rose-400 hover:underline cursor-pointer"
            >
              Highlight Bunk Dates &rarr;
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
                  const isHighRisk = day.risk_level === 'HIGH' || day.has_detected_bunk;
                  const isMediumRisk = day.risk_level === 'MEDIUM';
                  const isHoliday = day.is_holiday;
                  const gainedDays = day.consecutive_days_gained ?? 0;

                  return (
                    <div
                      key={day.date}
                      onClick={() => setSelectedDateStr(day.date)}
                      className={`rounded-xl p-2 flex flex-col justify-between transition-all cursor-pointer border relative select-none ${
                        isSelected
                          ? 'border-primary ring-2 ring-primary/40 bg-surface-container shadow-xs scale-[1.01] z-10'
                          : isHighRisk
                          ? 'border-rose-500/50 bg-rose-500/10 dark:bg-rose-500/15 hover:border-rose-500 hover:shadow-xs'
                          : isMediumRisk
                          ? 'border-amber-500/40 bg-amber-500/5 hover:border-amber-500'
                          : isHoliday
                          ? 'border-sky-500/30 bg-sky-500/5 hover:border-sky-500'
                          : 'border-outline-variant/60 bg-surface-container-lowest hover:border-primary/50'
                      }`}
                    >
                      {/* Top Header in Day Cell */}
                      <div className="flex items-center justify-between">
                        <span
                          className={`text-xs font-bold font-mono ${
                            isSelected
                              ? 'text-primary'
                              : isHighRisk
                              ? 'text-rose-600 dark:text-rose-400 font-extrabold'
                              : isHoliday
                              ? 'text-sky-600 dark:text-sky-400'
                              : 'text-on-surface'
                          }`}
                        >
                          {day.day_num}
                        </span>

                        {/* Top Badges */}
                        <div className="flex items-center gap-1">
                          {isHighRisk && (
                            <span
                              className="flex items-center text-rose-600 dark:text-rose-400"
                              title={`Mass Bunk Hazard: ${day.risk_score}%`}
                            >
                              <span className="material-symbols-outlined text-[15px]">local_fire_department</span>
                            </span>
                          )}

                          {isHoliday && !isHighRisk && (
                            <span className="text-sky-600 dark:text-sky-400" title={day.holiday_name || 'Holiday'}>
                              <span className="material-symbols-outlined text-[13px]">beach_access</span>
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Middle / Bottom Content in Day Cell */}
                      <div className="mt-1 space-y-0.5">
                        {isHighRisk && (
                          <div className="flex items-center justify-between gap-1 text-[9px] font-bold px-1 py-0.2 rounded bg-rose-500/15 text-rose-600 dark:text-rose-400 truncate">
                            <span className="truncate">{day.has_detected_bunk ? 'CONFIRMED BUNK' : `${day.risk_score}% RISK`}</span>
                            {gainedDays >= 3 && !day.has_detected_bunk && (
                              <span className="font-mono text-[8px] bg-rose-500 text-white px-1 rounded shrink-0">
                                +{gainedDays}d
                              </span>
                            )}
                          </div>
                        )}

                        {isMediumRisk && (
                          <div className="flex items-center justify-between gap-1 text-[9px] font-semibold px-1 py-0.2 rounded bg-amber-500/15 text-amber-600 dark:text-amber-400 truncate">
                            <span className="truncate">{day.risk_score}% Risk</span>
                            {gainedDays >= 2 && (
                              <span className="font-mono text-[8px] bg-amber-500/30 px-1 rounded shrink-0">
                                +{gainedDays}d
                              </span>
                            )}
                          </div>
                        )}

                        {isHoliday && (
                          <div className="text-[9px] font-medium text-sky-600 dark:text-sky-400 truncate">
                            {day.holiday_name || 'Closed'}
                          </div>
                        )}

                        {!isHoliday && !isHighRisk && !isMediumRisk && (
                          <div className="text-[9px] text-on-surface-variant font-mono truncate">
                            {day.periods?.length ?? 0} classes
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
                const isHighRisk = day.risk_level === 'HIGH' || day.has_detected_bunk;
                return (
                  <div
                    key={day.date}
                    onClick={() => setSelectedDateStr(day.date)}
                    className={`p-3 rounded-xl border flex items-center justify-between transition-all cursor-pointer ${
                      isSelected
                        ? 'border-primary bg-primary/5 ring-2 ring-primary/20'
                        : isHighRisk
                        ? 'border-rose-500/40 bg-rose-500/5 hover:border-rose-500'
                        : 'border-outline-variant bg-surface-container-lowest hover:border-primary/40'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-9 h-9 rounded-lg flex flex-col items-center justify-center font-mono ${
                          isHighRisk
                            ? 'bg-rose-500 text-white font-bold'
                            : day.is_holiday
                            ? 'bg-sky-500/20 text-sky-600'
                            : 'bg-surface-container text-on-surface'
                        }`}
                      >
                        <span className="text-[9px] leading-none uppercase">{day.day.slice(0, 3)}</span>
                        <span className="text-xs font-bold leading-none mt-0.5">{day.day_num}</span>
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-on-surface">{day.date}</span>
                          {isHighRisk && (
                            <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-rose-500/15 text-rose-600 dark:text-rose-400">
                              {day.has_detected_bunk ? 'CONFIRMED BUNK' : `${day.risk_score}% BUNK RISK`}
                            </span>
                          )}
                          {day.is_holiday && (
                            <span className="text-[9px] font-medium px-1.5 py-0.2 rounded bg-sky-500/15 text-sky-600">
                              {day.holiday_name}
                            </span>
                          )}
                          {(day.consecutive_days_gained ?? 0) >= 3 && !day.is_holiday && (
                            <span className="text-[9px] font-mono px-1 py-0.2 rounded bg-surface-container text-primary font-bold">
                              +{day.consecutive_days_gained}d Off Block
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-on-surface-variant truncate max-w-lg mt-0.5">{day.reason}</p>
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
              <span className="flex items-center gap-1 font-semibold text-rose-600 dark:text-rose-400">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500" /> High Bunk Risk (≥65%)
              </span>
              <span className="flex items-center gap-1 font-medium text-amber-600 dark:text-amber-400">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500" /> Moderate (35%-64%)
              </span>
              <span className="flex items-center gap-1 font-medium text-sky-600 dark:text-sky-400">
                <span className="w-2.5 h-2.5 rounded-full bg-sky-500" /> Holiday / Weekend
              </span>
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
                  <span
                    className={`text-[9px] font-bold px-2 py-0.5 rounded flex items-center gap-1 ${
                      selectedDay.risk_level === 'HIGH' || selectedDay.has_detected_bunk
                        ? 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30'
                        : selectedDay.is_holiday
                        ? 'bg-sky-500/15 text-sky-600 dark:text-sky-400'
                        : 'bg-surface-container text-on-surface-variant'
                    }`}
                  >
                    {selectedDay.has_detected_bunk ? (
                      <>
                        <span className="material-symbols-outlined text-[11px]">local_fire_department</span>
                        CONFIRMED BUNK
                      </>
                    ) : selectedDay.is_holiday ? (
                      'HOLIDAY / OFF'
                    ) : (
                      `${selectedDay.risk_score}% RISK`
                    )}
                  </span>
                </div>
                <h3 className="text-base font-bold text-on-surface mt-1.5">{selectedDay.date}</h3>
                <p className="text-[11px] text-on-surface-variant">
                  {selectedDay.is_holiday
                    ? selectedDay.holiday_name
                    : `Section ${activeSection} Timetable Schedule`}
                </p>
              </div>

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
                    Bunking this day converts surrounding off-days into a contiguous{' '}
                    <span className="font-bold text-primary">{selectedDay.consecutive_days_gained}-day vacation block</span>.
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

              {/* Confirmed Mass Bunk Card (If date had real bunk) */}
              {selectedDay.bunk_details && (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 space-y-1.5 text-xs text-rose-600 dark:text-rose-400">
                  <div className="flex items-center gap-1.5 font-bold">
                    <span className="material-symbols-outlined text-[15px]">error</span>
                    <span>Detected Mass Bunk Incident</span>
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

              {/* Risk Attribution & Reason */}
              <div className="p-3 bg-surface-container-low rounded-xl border border-outline-variant space-y-1.5 text-xs">
                <span className="text-[10px] font-bold text-primary uppercase tracking-wider block">
                  Deterministic Attribution
                </span>
                <p className="text-[11px] text-on-surface leading-relaxed">{selectedDay.reason}</p>
                <div className="pt-1.5 border-t border-outline-variant/60 text-[10px] text-on-surface-variant">
                  <span className="font-semibold text-on-surface">Guidance: </span>
                  {selectedDay.recommendation}
                </div>
              </div>

              {/* Scheduled Periods for this Day */}
              <div className="flex-1">
                <h4 className="text-xs font-bold text-on-surface mb-2 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[15px] text-primary">schedule</span>
                    Timetable Slots
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
                  <div className="space-y-1.5 max-h-40 overflow-y-auto pr-0.5">
                    {selectedDay.periods.map((slot, idx) => (
                      <div
                        key={idx}
                        className={`p-2 rounded-lg border text-xs flex items-center justify-between ${
                          slot.is_lab
                            ? 'bg-rose-500/5 border-rose-500/30'
                            : 'bg-surface-container border-outline-variant/60'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span className="w-5 h-5 rounded flex items-center justify-center font-bold text-[10px] bg-surface-container-highest text-on-surface">
                            P{slot.period}
                          </span>
                          <div>
                            <span className="font-semibold text-on-surface text-[11px] block">{slot.subject}</span>
                            <span className="text-[9px] text-on-surface-variant">{slot.room}</span>
                          </div>
                        </div>

                        {slot.is_lab && (
                          <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-rose-500/15 text-rose-600 dark:text-rose-400">
                            LAB SLOT
                          </span>
                        )}
                      </div>
                    ))}
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
              <p>Select any day on the calendar to view timetable periods and mass bunk risk analysis.</p>
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
    </div>
  );
};
