import React from 'react';

export interface MkTabItem {
  id: string;
  label: string;
  count?: number;
  icon?: string;
}

export interface MkTabsProps {
  tabs: MkTabItem[];
  activeTab: string;
  onTabChange: (id: string) => void;
  className?: string;
}

export const MkTabs: React.FC<MkTabsProps> = ({
  tabs,
  activeTab,
  onTabChange,
  className = '',
}) => {
  return (
    <div className={`flex border-b border-[#333333] bg-[#141313] font-mono select-none ${className}`}>
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={`flex-1 py-2 text-[10px] font-mono font-bold uppercase tracking-widest transition-colors flex items-center justify-center gap-1.5 cursor-pointer ${
              isActive
                ? 'text-white border-b-2 border-[#00b4ff] bg-[#1a1a1a]'
                : 'text-[#c4c7c8] hover:text-white hover:bg-[#181818]'
            }`}
          >
            {tab.icon && (
              <span className="material-symbols-outlined text-[13px]">
                {tab.icon}
              </span>
            )}
            <span>{tab.label}</span>
            {tab.count !== undefined && (
              <span
                className={`text-[9px] px-1 rounded-sm ${
                  isActive ? 'bg-[#00b4ff]/20 text-[#00b4ff]' : 'bg-[#222] text-[#888]'
                }`}
              >
                {tab.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
};
