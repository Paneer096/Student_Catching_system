import React, { useState } from 'react';
import { MkCard } from '../components/ui/MkCard';
import { MkBadge } from '../components/ui/MkBadge';
import { MkButton } from '../components/ui/MkButton';

export interface CalendarDayRisk {
  date: string;
  dayOfWeek: string;
  isHoliday?: boolean;
  holidayName?: string;
  riskBand: 'green' | 'yellow' | 'orange' | 'red';
  expectedAbsentPct: number; // e.g. 38%
  baselineAbsentPct: number; // e.g. 11%
  periods: {
    period: number;
    subject: string;
    criticality: number;
    riskBand: 'green' | 'yellow' | 'orange' | 'red';
    expectedAbsentPct: number;
  }[];
  counterfactualDrivers: string[];
}

export const CalendarView: React.FC = () => {
  const [selectedDay, setSelectedDay] = useState<CalendarDayRisk>({
    date: '2026-10-02',
    dayOfWeek: 'Friday',
    riskBand: 'red',
    expectedAbsentPct: 38.5,
    baselineAbsentPct: 11.2,
    periods: [
      { period: 1, subject: 'Operating Systems (CS302)', criticality: 4, riskBand: 'yellow', expectedAbsentPct: 22.0 },
      { period: 2, subject: 'Operating Systems (CS302)', criticality: 4, riskBand: 'yellow', expectedAbsentPct: 24.5 },
      { period: 3, subject: 'Data Structures (CS301)', criticality: 4, riskBand: 'orange', expectedAbsentPct: 29.0 },
      { period: 4, subject: 'Database Systems (CS303)', criticality: 3, riskBand: 'orange', expectedAbsentPct: 34.0 },
      { period: 5, subject: 'Physics Practical (CS304)', criticality: 4, riskBand: 'red', expectedAbsentPct: 44.2 },
      { period: 6, subject: 'Library / Mentorship Slot', criticality: 1, riskBand: 'red', expectedAbsentPct: 48.0 },
    ],
    counterfactualDrivers: [
      'Day immediately precedes Gandhi Jayanti (National Holiday) + weekend bridge (+18.4% attribution)',
      'Friday afternoon effect (+8.2% attribution on P5-P6)',
      'High historical group absence recurrence in Period 5 slot (+6.5% attribution)',
    ],
  });

  const [aiDraftReminderOpen, setAiDraftReminderOpen] = useState(false);
  const [generatedReminderText, setGeneratedReminderText] = useState(
    "Dear CS-3B Students, Reminder: We have an essential hands-on Physics practical demonstration this Friday in Period 5 covering key experiment rubrics for Internal Assessment 2. Punctual attendance and active teamwork are expected. Looking forward to seeing everyone there!"
  );

  // Month days sample (October 2026)
  const daysInOctober = [
    { day: 1, band: 'yellow', label: 'Thu' },
    { day: 2, band: 'red', label: 'Fri (Pre-Holiday)' },
    { day: 3, band: 'green', label: 'Sat', isHoliday: true, holiday: 'Weekend' },
    { day: 4, band: 'green', label: 'Sun', isHoliday: true, holiday: 'Weekend' },
    { day: 5, band: 'green', label: 'Mon', isHoliday: true, holiday: 'Gandhi Jayanti (Observed)' },
    { day: 6, band: 'yellow', label: 'Tue (Post-Holiday)' },
    { day: 7, band: 'green', label: 'Wed' },
    { day: 8, band: 'green', label: 'Thu' },
    { day: 9, band: 'orange', label: 'Fri (Afternoon drop)' },
    { day: 10, band: 'green', label: 'Sat' },
    { day: 11, band: 'green', label: 'Sun' },
    { day: 12, band: 'green', label: 'Mon' },
    { day: 13, band: 'green', label: 'Tue' },
    { day: 14, band: 'yellow', label: 'Wed' },
    { day: 15, band: 'orange', label: 'Thu (Pre-Dussehra)' },
    { day: 16, band: 'red', label: 'Fri (Long Weekend Peak)' },
  ];

  return (
    <div className="flex-1 overflow-y-auto custom-scrollbar p-5 space-y-5 font-mono select-none">
      {/* Top Notice: G1 Guardrail Compliance */}
      <div className="p-3 bg-[#121212] border border-[#333333] rounded-sm flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-[#ff8c00] text-lg font-bold">
            calendar_clock
          </span>
          <div>
            <h2 className="text-xs font-bold text-white uppercase tracking-wider">
              ACADEMIC CALENDAR GROUP-ABSENCE RISK FORECAST
            </h2>
            <span className="text-[10px] text-[#888888]">
              Section & period predictions only • Zero individual student forecasting (G1 Guardrail)
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <span className="text-[9px] px-2 py-0.5 bg-[#39ff14]/10 text-[#39ff14] border border-[#39ff14]/30 rounded-xs font-bold">
            G1 ENFORCED
          </span>
          <MkButton
            variant="outline"
            size="sm"
            icon="download"
            onClick={() => alert('Exporting 14-Day Calendar Risk Plan (PDF)')}
          >
            EXPORT WEEK PLAN (PDF)
          </MkButton>
        </div>
      </div>

      {/* Main Split: Calendar Grid on Left, Day Inspection on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left: October 2026 Calendar Grid */}
        <div className="lg:col-span-2 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-white uppercase tracking-wider">
              OCTOBER 2026 RISK HEATMAP (SECTION CS-3B)
            </h3>
            {/* Legend */}
            <div className="flex items-center gap-2 text-[9px]">
              <span className="flex items-center gap-1 text-[#39ff14]">
                <span className="w-2 h-2 rounded-xs bg-[#39ff14]" /> GREEN (LOW)
              </span>
              <span className="flex items-center gap-1 text-[#ffd700]">
                <span className="w-2 h-2 rounded-xs bg-[#ffd700]" /> YELLOW
              </span>
              <span className="flex items-center gap-1 text-[#ff8c00]">
                <span className="w-2 h-2 rounded-xs bg-[#ff8c00]" /> ORANGE
              </span>
              <span className="flex items-center gap-1 text-[#ff4c4c]">
                <span className="w-2 h-2 rounded-xs bg-[#ff4c4c]" /> RED (HIGH)
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {daysInOctober.map((d) => {
              const isSelected = selectedDay.date === `2026-10-${d.day < 10 ? '0' + d.day : d.day}`;
              const borderStyles =
                d.band === 'red'
                  ? 'border-[#ff4c4c]/50 bg-[#ff4c4c]/10'
                  : d.band === 'orange'
                  ? 'border-[#ff8c00]/50 bg-[#ff8c00]/10'
                  : d.band === 'yellow'
                  ? 'border-[#ffd700]/40 bg-[#ffd700]/5'
                  : 'border-[#333333] bg-[#141313]';

              return (
                <div
                  key={d.day}
                  onClick={() => {
                    setSelectedDay({
                      date: `2026-10-${d.day < 10 ? '0' + d.day : d.day}`,
                      dayOfWeek: d.label.split(' ')[0],
                      riskBand: d.band as any,
                      expectedAbsentPct: d.band === 'red' ? 38.5 : d.band === 'orange' ? 28.0 : d.band === 'yellow' ? 19.5 : 8.5,
                      baselineAbsentPct: 11.2,
                      periods: selectedDay.periods,
                      counterfactualDrivers: [
                        `Calendar proximity: ${d.label} (+15% attribution)`,
                        'Afternoon session drop tendency',
                      ],
                    });
                  }}
                  className={`p-3 rounded-sm border cursor-pointer transition-all ${borderStyles} ${
                    isSelected ? 'ring-2 ring-white shadow-lg' : 'hover:border-white/50'
                  }`}
                >
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-sm font-bold text-white">Oct {d.day}</span>
                    <MkBadge
                      label={d.band.toUpperCase()}
                      variant={d.band === 'red' ? 'red' : d.band === 'orange' ? 'orange' : d.band === 'yellow' ? 'gold' : 'green'}
                      size="sm"
                    />
                  </div>
                  <span className="text-[10px] text-[#c4c7c8] block truncate">{d.label}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right: Selected Day Inspector & Period Breakdown */}
        <div className="space-y-4">
          <MkCard
            title={`INSPECTION: ${selectedDay.date} (${selectedDay.dayOfWeek.toUpperCase()})`}
            badge={
              <MkBadge
                label={selectedDay.riskBand.toUpperCase()}
                variant={selectedDay.riskBand === 'red' ? 'red' : 'orange'}
                size="sm"
                pulse={selectedDay.riskBand === 'red'}
              />
            }
          >
            {/* Stat comparison */}
            <div className="p-3 bg-[#0d0d0d] border border-[#222222] rounded-sm mb-3">
              <div className="flex justify-between items-center text-xs">
                <span className="text-[#888888] uppercase">Expected Absent:</span>
                <span className="text-[#ff4c4c] font-bold text-sm">
                  {selectedDay.expectedAbsentPct}% (Usual {selectedDay.baselineAbsentPct}%)
                </span>
              </div>
              <div className="text-[9px] text-[#777777] mt-1">
                Computed via Gradient Boosting + Heuristic Priors (§7.10)
              </div>
            </div>

            {/* Per-period breakdown */}
            <div className="space-y-2 mb-3">
              <span className="text-[10px] text-[#c4c7c8] font-bold uppercase tracking-wider block">
                PERIOD RISK BREAKDOWN:
              </span>
              {selectedDay.periods.map((p) => (
                <div
                  key={p.period}
                  className="flex items-center justify-between p-2 bg-[#121212] border border-[#222] rounded-xs text-xs"
                >
                  <div>
                    <span className="font-bold text-white mr-1.5">P{p.period}.</span>
                    <span className="text-[#c4c7c8] text-[11px]">{p.subject}</span>
                  </div>
                  <div className="text-right">
                    <span
                      className="font-bold"
                      style={{
                        color:
                          p.riskBand === 'red'
                            ? '#ff4c4c'
                            : p.riskBand === 'orange'
                            ? '#ff8c00'
                            : p.riskBand === 'yellow'
                            ? '#ffd700'
                            : '#39ff14',
                      }}
                    >
                      {p.expectedAbsentPct}%
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* Counterfactual Drivers */}
            <div className="p-3 bg-[#0a0a0c] border border-[#222] rounded-sm text-xs space-y-1 mb-3">
              <span className="text-[10px] text-[#00b4ff] font-bold uppercase tracking-wider block mb-1">
                COUNTERFACTUAL DRIVERS:
              </span>
              {selectedDay.counterfactualDrivers.map((d, idx) => (
                <div key={idx} className="text-[#c4c7c8] text-[10px] leading-tight">
                  • {d}
                </div>
              ))}
            </div>

            {/* Proactive Actions */}
            <MkButton
              variant="gold"
              size="md"
              className="w-full"
              icon="mail"
              onClick={() => setAiDraftReminderOpen(true)}
            >
              DRAFT CLASS REMINDER (GEMINI)
            </MkButton>
          </MkCard>
        </div>
      </div>

      {/* AI Draft Reminder Modal */}
      {aiDraftReminderOpen && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#141313] border border-[#ffd700]/50 rounded-md max-w-lg w-full p-5 space-y-4 shadow-[0_0_50px_rgba(255,215,0,0.15)]">
            <div className="flex items-center justify-between border-b border-[#333] pb-2">
              <span className="text-xs font-bold text-[#ffd700] uppercase tracking-wider flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[15px]">auto_awesome</span>
                GEMINI 2.5 DRAFTED CLASS REMINDER
              </span>
              <button
                onClick={() => setAiDraftReminderOpen(false)}
                className="text-[#777] hover:text-white"
              >
                ✕
              </button>
            </div>

            <p className="text-[10px] text-[#888]">
              De-identified prompt sent to Gemini API • Teacher-in-the-loop review required before any distribution.
            </p>

            <textarea
              rows={4}
              value={generatedReminderText}
              onChange={(e) => setGeneratedReminderText(e.target.value)}
              className="w-full bg-[#1c1b1b] border border-[#333333] p-3 text-xs text-white font-mono rounded-sm focus:outline-none focus:border-[#ffd700]"
            />

            <div className="flex gap-2 justify-end">
              <MkButton
                variant="outline"
                size="sm"
                onClick={() => setAiDraftReminderOpen(false)}
              >
                CLOSE
              </MkButton>
              <MkButton
                variant="primary"
                size="sm"
                icon="content_copy"
                onClick={() => {
                  navigator.clipboard?.writeText(generatedReminderText);
                  alert('Class reminder copied to clipboard for announcement!');
                  setAiDraftReminderOpen(false);
                }}
              >
                COPY NOTICE
              </MkButton>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
