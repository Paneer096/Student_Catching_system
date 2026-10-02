import React from 'react';

export interface BreadcrumbSegment {
  level: number; // 0 = Institution, 1 = Section, 2 = Cluster, 3 = Student
  id: string;
  label: string;
  subLabel?: string;
  color?: string;
}

export interface GraphBreadcrumbProps {
  segments: BreadcrumbSegment[];
  onSelectSegment: (level: number, id: string) => void;
  onStepBack?: () => void;
}

export const GraphBreadcrumb: React.FC<GraphBreadcrumbProps> = ({
  segments,
  onSelectSegment,
  onStepBack,
}) => {
  return (
    <nav className="flex items-center gap-1.5 px-3 py-1.5 bg-surface-container-low/90 backdrop-blur-md rounded-xl border border-outline-variant/70 shadow-2xs text-xs font-mono select-none overflow-x-auto custom-scrollbar">
      {/* Back button */}
      {segments.length > 2 && onStepBack && (
        <button
          type="button"
          onClick={onStepBack}
          className="flex items-center justify-center w-6 h-6 rounded-lg bg-surface-container hover:bg-surface-container-high border border-outline-variant text-on-surface-variant hover:text-on-surface transition-colors cursor-pointer mr-1 shrink-0"
          title="Zoom out one layer (Esc)"
        >
          <span className="material-symbols-outlined text-[15px]">arrow_back</span>
        </button>
      )}

      {segments.map((seg, idx) => {
        const isLast = idx === segments.length - 1;
        const icon =
          seg.level === 0
            ? 'account_balance'
            : seg.level === 1
            ? 'school'
            : seg.level === 2
            ? 'hub'
            : 'person';

        return (
          <React.Fragment key={`${seg.level}-${seg.id}`}>
            {idx > 0 && (
              <span className="text-outline-variant/80 text-[11px] select-none shrink-0">
                /
              </span>
            )}

            <button
              type="button"
              onClick={() => onSelectSegment(seg.level, seg.id)}
              className={`flex items-center gap-1.5 px-2 py-1 rounded-lg transition-all shrink-0 cursor-pointer ${
                isLast
                  ? 'bg-surface-container-highest text-on-surface font-bold border border-outline-variant shadow-2xs'
                  : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container font-medium'
              }`}
            >
              <span
                className="material-symbols-outlined text-[14px]"
                style={seg.color ? { color: seg.color } : undefined}
              >
                {icon}
              </span>
              <span className="truncate max-w-[140px] sm:max-w-[180px]">
                {seg.label}
              </span>
              {seg.subLabel && (
                <span className="text-[10px] text-on-surface-variant/70 font-normal hidden md:inline">
                  ({seg.subLabel})
                </span>
              )}
            </button>
          </React.Fragment>
        );
      })}
    </nav>
  );
};
