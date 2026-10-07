import React from 'react';

export interface RoleSwitcherModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentRoleKey: string;
  onSelectRole: (roleKey: string) => void;
  isDarkMode?: boolean;
  onToggleTheme?: () => void;
}

export const RoleSwitcherModal: React.FC<RoleSwitcherModalProps> = ({
  isOpen,
  onClose,
  currentRoleKey,
  onSelectRole,
  isDarkMode = false,
  onToggleTheme,
}) => {
  if (!isOpen) return null;

  const roles = [
    {
      key: 'CLASS_TEACHER',
      name: 'Prof. Raghav Sharma',
      roleTitle: 'Class Teacher (AIML Sem 4)',
      clearance: 'Classroom Full Clearance',
      description: 'Full access to section social graph, Louvain cohorts, intervention playbooks, and individual student profiles.',
      badge: 'Teacher Access',
    },
    {
      key: 'SUBJECT_TEACHER',
      name: 'Dr. Anita Mehta',
      roleTitle: 'Subject Teacher (Physics PHY301)',
      clearance: 'Subject Limited Clearance',
      description: 'Attendance analytics and lab slot performance for PHY301. Cross-subject privacy restrictions applied.',
      badge: 'Course Only',
    },
    {
      key: 'HOD_DEAN',
      name: 'Prof. Vikram Kapoor',
      roleTitle: 'HOD / Academic Dean',
      clearance: 'Executive Institutional Level',
      description: 'High-level department summaries, attendance trends across sections, and calendar risk forecasting.',
      badge: 'Dean Access',
    },
    {
      key: 'STUDENT',
      name: 'Rohit Sharma (R.S.)',
      roleTitle: 'Student (AIML Sem 4)',
      clearance: 'Individual Privacy Portal',
      description: 'Access to personal attendance status, absence logs, and opt-out consent controls. No access to peer analytics.',
      badge: 'Student Portal',
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 select-none">
      <div className="bg-surface-container-lowest border border-outline-variant rounded-xl shadow-xl max-w-lg w-full overflow-hidden">
        {/* Modal Header */}
        <div className="p-4 border-b border-outline-variant bg-surface-container-low flex justify-between items-center">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-[20px]">settings</span>
            <h3 className="text-sm font-bold text-primary">System Settings &amp; Personas</h3>
          </div>
          <button
            onClick={onClose}
            className="text-on-surface-variant hover:text-primary transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4 max-h-[70vh] overflow-y-auto">
          {/* Theme Option (Light / Dark) */}
          <div className="p-3.5 rounded-xl border border-outline-variant bg-surface-container-low flex items-center justify-between">
            <div>
              <div className="text-xs font-bold text-on-surface flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[18px] text-primary">
                  {isDarkMode ? 'dark_mode' : 'light_mode'}
                </span>
                <span>Interface Theme</span>
              </div>
              <p className="text-[11px] text-on-surface-variant mt-0.5">
                {isDarkMode
                  ? 'Dark Mode: Obsidian tactical theme active'
                  : 'Light Mode: Jurisdiction corporate theme active'}
              </p>
            </div>
            <button
              type="button"
              onClick={onToggleTheme}
              className="px-3 py-1.5 bg-primary-container text-on-primary-container rounded-lg text-xs font-bold hover:bg-primary transition-colors cursor-pointer flex items-center gap-1.5 shadow-xs"
            >
              <span className="material-symbols-outlined text-[16px]">
                {isDarkMode ? 'light_mode' : 'dark_mode'}
              </span>
              <span>{isDarkMode ? 'Switch to Light' : 'Switch to Dark'}</span>
            </button>
          </div>

          {/* Persona Selection */}
          <div>
            <div className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider mb-2">
              Select Demo Persona / Clearance Role
            </div>
            <div className="space-y-2.5">
              {roles.map((r) => {
                const isSelected = currentRoleKey === r.key;
                return (
                  <div
                    key={r.key}
                    onClick={() => {
                      onSelectRole(r.key);
                      onClose();
                    }}
                    className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
                      isSelected
                        ? 'border-primary bg-secondary-container/20 ring-2 ring-primary/20'
                        : 'border-outline-variant hover:border-secondary hover:bg-surface-container-low'
                    }`}
                  >
                    <div className="flex justify-between items-start mb-1">
                      <div>
                        <div className="text-xs font-bold text-on-surface">{r.name}</div>
                        <div className="text-[11px] font-medium text-primary">{r.roleTitle}</div>
                      </div>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          isSelected
                            ? 'bg-primary-container text-on-primary-container'
                            : 'bg-surface-container text-on-surface-variant'
                        }`}
                      >
                        {r.badge}
                      </span>
                    </div>
                    <p className="text-[11px] text-on-surface-variant leading-relaxed mt-1">
                      {r.description}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-3 bg-surface-container-low border-t border-outline-variant text-right">
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-surface border border-outline-variant rounded-lg text-xs font-semibold text-on-surface hover:bg-surface-container transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
