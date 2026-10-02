import React from 'react';

export interface TopHeaderProps {
  currentUser?: {
    name: string;
    role: string;
    roleKey: string;
  };
  activeSection: string;
  onSectionChange: (section: string) => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  onNotificationsClick: () => void;
  onExportReport: () => void;
  onOpenIngest: () => void;
  unreadCount?: number;
  isDarkMode?: boolean;
  onToggleTheme?: () => void;
}

export const TopHeader: React.FC<TopHeaderProps> = ({
  activeSection,
  onSectionChange,
  searchQuery,
  onSearchChange,
  onNotificationsClick,
  onExportReport,
  onOpenIngest,
  unreadCount = 3,
  isDarkMode = false,
  onToggleTheme,
}) => {
  return (
    <header className="bg-surface-container-lowest/90 backdrop-blur-md h-[60px] fixed top-0 right-0 left-[260px] border-b border-outline-variant/70 shadow-2xs flex justify-between items-center px-5 z-20 text-xs">
      {/* ─── Left: Cohort Context ──────────────────────────────────────────────── */}
      <div className="flex items-center gap-2.5">
        <div className="flex items-center gap-2 bg-surface-container-low/90 hover:bg-surface-container border border-outline-variant/80 px-3 py-1.5 rounded-lg transition-colors shadow-2xs">
          <span className="material-symbols-outlined text-[15px] text-primary">school</span>
          <span className="text-[10px] font-mono uppercase tracking-wider text-on-surface-variant font-semibold">
            Cohort
          </span>
          <select
            value={activeSection}
            onChange={(e) => onSectionChange(e.target.value)}
            className="bg-transparent text-xs font-bold text-on-surface font-mono focus:outline-none cursor-pointer pr-1"
          >
            <option value="CS-3B">AIML Sem 4 (CS-3B)</option>
            <option value="CS-3A">AIML Sem 4 (CS-3A)</option>
            <option value="ME-2A">ME Sem 4 (ME-2A)</option>
          </select>
        </div>

        <div className="hidden sm:inline-flex items-center gap-1.5 text-[10px] font-mono text-on-surface-variant/70 px-2 py-1 rounded-md bg-surface-container-low/60 border border-outline-variant/40">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          <span>Live Sync</span>
        </div>
      </div>

      {/* ─── Center: Quick Search Input ─────────────────────────────────────────── */}
      <div className="hidden lg:flex items-center relative max-w-sm w-full mx-4">
        <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-[16px] pointer-events-none">
          search
        </span>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search student roll, cohort clique, subject..."
          className="w-full pl-8 pr-12 py-1.5 bg-surface-container-low/90 border border-outline-variant/70 rounded-lg text-xs text-on-surface placeholder:text-on-surface-variant/60 focus:outline-none focus:border-primary/60 focus:bg-surface-container transition-all"
        />
        <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center pointer-events-none">
          <kbd className="text-[9px] font-mono px-1 py-0.2 rounded bg-surface-container border border-outline-variant/70 text-on-surface-variant">
            ⌘K
          </kbd>
        </div>
      </div>

      {/* ─── Right: Actions & User Persona Profile ──────────────────────────────── */}
      <div className="flex items-center gap-2">
        {/* Quick action: Ingest */}
        <button
          onClick={onOpenIngest}
          className="hidden md:flex items-center gap-1.5 px-2.5 py-1.5 bg-surface-container-low hover:bg-surface-container border border-outline-variant/80 rounded-lg text-on-surface hover:text-primary text-xs font-medium transition-all shadow-2xs cursor-pointer"
          title="Upload attendance registers, marks, timetables"
        >
          <span className="material-symbols-outlined text-[15px] text-primary">upload_file</span>
          <span>Ingest</span>
        </button>

        {/* Quick action: Export */}
        <button
          onClick={onExportReport}
          className="hidden md:flex items-center gap-1.5 px-2.5 py-1.5 bg-surface-container-low hover:bg-surface-container border border-outline-variant/80 rounded-lg text-on-surface hover:text-primary text-xs font-medium transition-all shadow-2xs cursor-pointer"
          title="Download verifiable JSON intelligence dossier"
        >
          <span className="material-symbols-outlined text-[15px] text-primary">download</span>
          <span>Export</span>
        </button>

        {/* Theme Toggle Button */}
        <button
          onClick={onToggleTheme}
          className="w-8 h-8 rounded-lg border border-outline-variant/60 bg-surface-container-low/60 hover:bg-surface-container flex items-center justify-center text-on-surface-variant hover:text-on-surface transition-colors cursor-pointer"
          title={isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          aria-label="Toggle theme"
        >
          <span className="material-symbols-outlined text-[17px]">
            {isDarkMode ? 'light_mode' : 'dark_mode'}
          </span>
        </button>

        {/* Notification Bell */}
        <button
          onClick={onNotificationsClick}
          className="w-8 h-8 rounded-lg border border-outline-variant/60 bg-surface-container-low/60 hover:bg-surface-container flex items-center justify-center text-on-surface-variant hover:text-on-surface transition-colors relative cursor-pointer"
          title="View Alerts"
        >
          <span className="material-symbols-outlined text-[17px]">notifications</span>
          {unreadCount > 0 && (
            <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-rose-500 rounded-full ring-2 ring-surface-container-lowest" />
          )}
        </button>
      </div>
    </header>
  );
};
