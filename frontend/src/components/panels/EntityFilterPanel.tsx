import React from 'react';
import { MkAccordion } from '../ui/MkAccordion';

export interface CategoryGroup {
  id: string;
  name: string;
  count: number;
  color: string;
  icon: string;
  items?: { id: string; name: string; subtitle?: string; badge?: string }[];
}

export interface EntityFilterPanelProps {
  title?: string;
  categories: CategoryGroup[];
  selectedCategoryIds: string[];
  onToggleCategory: (id: string) => void;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  selectedItemId?: string;
  onSelectItem?: (item: any) => void;
  className?: string;
}

export const EntityFilterPanel: React.FC<EntityFilterPanelProps> = ({
  title = 'STUDENT COHORTS & CLUSTERS',
  categories,
  selectedCategoryIds,
  onToggleCategory,
  onSelectAll,
  onDeselectAll,
  selectedItemId,
  onSelectItem,
  className = '',
}) => {
  const allSelected = categories.length > 0 && selectedCategoryIds.length === categories.length;

  return (
    <div className={`p-3 font-mono flex flex-col ${className}`}>
      {/* Title & Count Header */}
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-xs font-bold text-[#c4c7c8] uppercase tracking-widest">
          {title}
        </h2>
        <span className="text-[9px] font-mono text-[#c4c7c8]">
          {selectedCategoryIds.length}/{categories.length}
        </span>
      </div>

      {/* Select All / Deselect All Controls */}
      <div className="flex items-center justify-between mb-3 pb-2 border-b border-[#333333]">
        <button
          onClick={allSelected ? onDeselectAll : onSelectAll}
          className="text-[9px] font-bold text-[#00b4ff] hover:text-white uppercase tracking-wider transition-colors flex items-center gap-1 cursor-pointer"
        >
          <span className="material-symbols-outlined text-[13px]">
            {allSelected ? 'deselect' : 'select_all'}
          </span>
          {allSelected ? 'DESELECT ALL' : 'SELECT ALL'}
        </button>
      </div>

      {/* Accordion Categories List */}
      <div className="space-y-1.5 overflow-y-auto custom-scrollbar flex-1">
        {categories.map((cat) => (
          <MkAccordion
            key={cat.id}
            id={cat.id}
            title={cat.name}
            count={cat.count}
            color={cat.color}
            icon={cat.icon}
            isVisible={selectedCategoryIds.includes(cat.id)}
            onToggleVisibility={() => onToggleCategory(cat.id)}
            items={cat.items}
            selectedItemId={selectedItemId}
            onSelectItem={onSelectItem}
          />
        ))}
      </div>
    </div>
  );
};
