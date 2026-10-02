import React from 'react';
import { MkDropdown } from '../ui/MkDropdown';

export interface FloatingToolbarProps {
  onRefresh?: () => void;
  onFilter?: () => void;
  onExport?: () => void;
  isLoading?: boolean;
  layoutMode?: string;
  onLayoutModeChange?: (mode: string) => void;
  className?: string;
}

export const FloatingToolbar: React.FC<FloatingToolbarProps> = ({
  onRefresh,
  onFilter,
  onExport,
  isLoading = false,
  layoutMode = 'force',
  onLayoutModeChange,
  className = '',
}) => {
  return (
    <div className={`absolute top-3 left-3 z-20 flex items-center gap-2 font-mono select-none ${className}`}>
      {/* Action Buttons Cluster */}
      <div className="flex flex-col gap-1 bg-[#121212] border border-[#333333] p-1 rounded-sm shadow-lg">
        {onRefresh && (
          <button
            onClick={onRefresh}
            className="w-8 h-8 flex items-center justify-center text-[#c4c7c8] hover:text-white hover:bg-[#333333] bg-transparent transition-colors rounded-sm cursor-pointer"
            title="Refresh Knowledge Graph"
          >
            <span
              className={`material-symbols-outlined text-lg ${
                isLoading ? 'animate-spin' : ''
              }`}
            >
              refresh
            </span>
          </button>
        )}

        {onFilter && (
          <button
            onClick={onFilter}
            className="w-8 h-8 flex items-center justify-center text-[#c4c7c8] hover:text-white hover:bg-[#333333] bg-transparent transition-colors rounded-sm cursor-pointer"
            title="Filter Layers"
          >
            <span className="material-symbols-outlined text-lg">filter_list</span>
          </button>
        )}

        {onExport && (
          <button
            onClick={onExport}
            className="w-8 h-8 flex items-center justify-center text-[#c4c7c8] hover:text-white hover:bg-[#333333] bg-transparent transition-colors rounded-sm cursor-pointer"
            title="Export Support Summary (PDF)"
          >
            <span className="material-symbols-outlined text-lg">download</span>
          </button>
        )}
      </div>

      {/* Layout Mode Selector */}
      {onLayoutModeChange && (
        <MkDropdown
          options={[
            { value: 'force', label: 'Force-Directed' },
            { value: 'community', label: 'Community Centroid' },
            { value: 'support-band', label: 'Support Priority' },
            { value: 'strengths', label: 'Strengths Matrix' },
          ]}
          value={layoutMode}
          onChange={onLayoutModeChange}
          icon="account_tree"
        />
      )}
    </div>
  );
};
