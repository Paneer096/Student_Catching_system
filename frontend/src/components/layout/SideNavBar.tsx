import React from 'react';

export interface SideNavBarProps {
  activeView: string;
  onViewChange: (view: string) => void;
  currentUser: {
    name: string;
    role: string;
    roleKey: string;
    clearance: string;
  };
  onRoleClick: () => void;
  unreadAlertsCount?: number;
  isDarkMode?: boolean;
  onToggleTheme?: () => void;
}

export const SideNavBar: React.FC<SideNavBarProps> = ({
  activeView,
  onViewChange,
  currentUser,
  onRoleClick,
  unreadAlertsCount = 4,
  isDarkMode = false,
  onToggleTheme,
}) => {
  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: 'dashboard' },
    { id: 'graph', label: 'Network Analysis', icon: 'hub' },
    { id: 'ingestion', label: 'Data Ingestion', icon: 'upload_file' },
    { id: 'alerts', label: 'Classroom Alerts', icon: 'notifications_active', badge: unreadAlertsCount },
    { id: 'interventions', label: 'Interventions (Cases)', icon: 'folder_open' },
    { id: 'students', label: 'Students (Roster)', icon: 'groups' },
    { id: 'calendar', label: 'Calendar Risk', icon: 'calendar_month' },
    { id: 'audit', label: 'Audit & Trust Log', icon: 'verified_user' },
  ];

  return (
    <nav className="bg-surface w-[260px] h-screen fixed left-0 top-0 border-r border-outline-variant flex flex-col py-6 px-4 z-20 select-none">
      {/* Header / Identity */}
      <div className="mb-5 px-1 pb-4 border-b border-outline-variant/60">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-surface-container-highest border border-outline-variant flex items-center justify-center text-primary shadow-2xs">
            <span className="material-symbols-outlined text-[18px]">hub</span>
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-extrabold text-base text-on-surface tracking-tight font-mono uppercase">
                Makerov
              </span>
              <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-surface-container-high text-on-surface-variant border border-outline-variant/60 font-semibold">
                v2.6
              </span>
            </div>
            <div className="text-[10px] font-mono text-on-surface-variant tracking-wide">
              Classroom Intelligence
            </div>
          </div>
        </div>
      </div>

      {/* User profile / Clearance Badge */}
      <div
        onClick={onRoleClick}
        className="mb-5 p-2.5 rounded-xl bg-surface-container-low border border-outline-variant hover:border-secondary transition-all cursor-pointer flex items-center gap-3 group"
        title="Click to switch demo role / persona"
      >
        <div className="w-9 h-9 rounded-full bg-primary-container text-on-primary flex items-center justify-center font-bold text-xs shrink-0 shadow-sm">
          {currentUser.name.split(' ').map((n) => n[0]).join('').slice(0, 2)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-xs font-semibold text-on-surface truncate group-hover:text-primary transition-colors">
            {currentUser.name}
          </div>
          <div className="text-[11px] text-on-surface-variant truncate">
            {currentUser.role}
          </div>
        </div>
        <span className="material-symbols-outlined text-[18px] text-on-surface-variant group-hover:text-primary transition-colors">
          swap_horiz
        </span>
      </div>

      {/* Navigation Links */}
      <ul className="flex flex-col gap-1 flex-1 overflow-y-auto pr-1">
        {navItems.map((item) => {
          const isActive = activeView === item.id;
          return (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => onViewChange(item.id)}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-lg font-medium text-sm transition-all duration-150 cursor-pointer ${
                  isActive
                    ? 'bg-secondary-container text-on-secondary-container font-semibold shadow-xs'
                    : 'text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface'
                }`}
              >
                <div className="flex items-center gap-3">
                  <span
                    className={`material-symbols-outlined text-[20px] ${
                      isActive ? 'fill-icon' : ''
                    }`}
                  >
                    {item.icon}
                  </span>
                  <span>{item.label}</span>
                </div>
                {item.badge && item.badge > 0 ? (
                  <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-error text-on-error">
                    {item.badge}
                  </span>
                ) : null}
              </button>
            </li>
          );
        })}
      </ul>

      {/* Footer / Settings, Dark Mode & Live Status */}
      <div className="mt-auto flex flex-col gap-1 border-t border-outline-variant pt-3">
        {/* Dark Mode Toggle */}
        <button
          type="button"
          onClick={onToggleTheme}
          className="flex items-center justify-between px-3 py-1.5 text-on-surface-variant hover:bg-surface-container-high rounded-lg text-sm transition-colors cursor-pointer"
          title={isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
        >
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-[18px]">
              {isDarkMode ? 'light_mode' : 'dark_mode'}
            </span>
            <span>{isDarkMode ? 'Light Mode' : 'Dark Mode'}</span>
          </div>
          <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-surface-container text-on-surface-variant">
            {isDarkMode ? 'DARK' : 'LIGHT'}
          </span>
        </button>

        <button
          type="button"
          onClick={() => onViewChange('settings')}
          className={`flex items-center gap-3 px-3 py-1.5 text-on-surface-variant hover:bg-surface-container-high rounded-lg text-sm transition-colors cursor-pointer ${
            activeView === 'settings' ? 'bg-surface-container font-medium text-primary' : ''
          }`}
        >
          <span className="material-symbols-outlined text-[18px]">settings</span>
          <span>System Settings</span>
        </button>

        <a
          href="https://github.com"
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-3 px-3 py-1.5 text-on-surface-variant hover:bg-surface-container-high rounded-lg text-sm transition-colors"
        >
          <span className="material-symbols-outlined text-[18px]">help</span>
          <span>Help &amp; Support</span>
        </a>

        {/* Status Pill matching Stitch reference */}
        <div className="mt-2.5 px-3 flex items-center gap-2 text-on-tertiary-container text-xs font-medium bg-tertiary-fixed-dim/20 py-2 rounded-lg justify-center border border-tertiary-fixed">
          <span className="w-2 h-2 rounded-full bg-on-tertiary-container animate-pulse"></span>
          <span>System Status: Active</span>
        </div>
      </div>
    </nav>
  );
};
