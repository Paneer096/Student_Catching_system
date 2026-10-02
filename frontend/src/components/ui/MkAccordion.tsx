import React, { useState } from 'react';

export interface MkAccordionChildItem {
  id: string;
  name: string;
  subtitle?: string;
  badge?: string;
}

export interface MkAccordionProps {
  id: string;
  title: string;
  count: number;
  color?: string;
  icon?: string;
  isVisible?: boolean;
  onToggleVisibility?: () => void;
  items?: MkAccordionChildItem[];
  selectedItemId?: string;
  onSelectItem?: (item: MkAccordionChildItem) => void;
}

export const MkAccordion: React.FC<MkAccordionProps> = ({
  title,
  count,
  color = '#00b4ff',
  icon = 'folder',
  isVisible = true,
  onToggleVisibility,
  items = [],
  selectedItemId,
  onSelectItem,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="border border-[#2d2d2d] bg-[#121212] rounded-sm overflow-hidden transition-colors font-mono select-none">
      {/* Header Row */}
      <div
        className={`flex items-center justify-between px-2.5 py-1.5 cursor-pointer transition-all duration-150 ${
          isVisible ? 'bg-[#181818] hover:bg-[#222222]' : 'bg-[#101010] opacity-60 hover:opacity-80'
        }`}
      >
        <div className="flex items-center gap-2 overflow-hidden flex-1">
          {/* Checkbox toggle */}
          {onToggleVisibility && (
            <div
              onClick={(e) => {
                e.stopPropagation();
                onToggleVisibility();
              }}
              className={`w-4 h-4 border rounded-sm flex items-center justify-center shrink-0 transition-all duration-150 cursor-pointer ${
                isVisible ? 'bg-[#00b4ff] border-[#00b4ff]' : 'border-[#555] hover:border-[#888]'
              }`}
              title={isVisible ? 'Hide from view' : 'Show in view'}
            >
              {isVisible && (
                <span className="material-symbols-outlined text-black text-[12px] font-bold">
                  check
                </span>
              )}
            </div>
          )}

          {/* Color Swatch Dot */}
          <div
            className="w-2.5 h-2.5 rounded-full shrink-0"
            style={{
              backgroundColor: color,
              boxShadow: isVisible ? `0 0 6px ${color}` : 'none',
            }}
          />

          {/* Label & Icon */}
          <div
            className="flex items-center gap-1.5 overflow-hidden flex-1"
            onClick={() => setIsExpanded(!isExpanded)}
          >
            <span className="material-symbols-outlined text-[15px] text-[#888888] shrink-0">
              {icon}
            </span>
            <span
              className={`text-[11px] font-bold uppercase tracking-wider truncate ${
                isVisible ? 'text-white' : 'text-[#777777]'
              }`}
            >
              {title}
            </span>
          </div>
        </div>

        {/* Count & Expand Arrow */}
        <div className="flex items-center gap-1.5 shrink-0">
          <span
            className={`text-[10px] font-mono px-1.5 py-0.2 border rounded-sm ${
              isVisible ? 'border-[#444444] text-[#c4c7c8]' : 'border-[#333333] text-[#555555]'
            }`}
          >
            {count}
          </span>
          {items.length > 0 && (
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="w-5 h-5 flex items-center justify-center text-[#888888] hover:text-white transition-colors cursor-pointer"
            >
              <span className="material-symbols-outlined text-[14px]">
                {isExpanded ? 'expand_less' : 'expand_more'}
              </span>
            </button>
          )}
        </div>
      </div>

      {/* Accordion List Body */}
      {isExpanded && items.length > 0 && (
        <div className="bg-[#0b0b0b] border-t border-[#222222] p-1.5 space-y-1 max-h-44 overflow-y-auto custom-scrollbar">
          {items.map((item) => {
            const isSelected = selectedItemId === item.id;
            return (
              <div
                key={item.id}
                onClick={() => onSelectItem?.(item)}
                className={`flex items-center justify-between p-1.5 rounded-sm text-[10px] group transition-colors cursor-pointer ${
                  isSelected
                    ? 'bg-[#222222] border-l-2 border-[#00b4ff] text-white'
                    : 'hover:bg-[#181818] text-[#c4c7c8]'
                }`}
              >
                <div className="overflow-hidden flex-1 mr-2">
                  <div className="font-bold truncate">{item.name}</div>
                  {item.subtitle && (
                    <div className="text-[9px] text-[#777777] truncate">
                      {item.subtitle}
                    </div>
                  )}
                </div>
                {item.badge && (
                  <span className="text-[9px] px-1 py-0.2 border border-[#333] text-[#888] rounded-sm font-mono shrink-0">
                    {item.badge}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
