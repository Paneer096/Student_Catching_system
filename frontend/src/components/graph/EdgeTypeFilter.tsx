import React, { useState, useRef, useEffect } from 'react';
import { EdgeTypeKey, EDGE_TYPE_CONFIG } from './EdgeRenderer';

export interface EdgeTypeFilterProps {
  enabledTypes: Set<EdgeTypeKey>;
  onToggleType: (type: EdgeTypeKey) => void;
  onSetPreset: (types: EdgeTypeKey[]) => void;
  edgeCounts?: Record<string, number>;
  isStudentConnectivityMode?: boolean;
}

export const EdgeTypeFilter: React.FC<EdgeTypeFilterProps> = ({
  enabledTypes,
  onToggleType,
  onSetPreset,
  edgeCounts = {},
  isStudentConnectivityMode = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const activeCount = enabledTypes.size;
  const edgeKeys = Object.keys(EDGE_TYPE_CONFIG) as EdgeTypeKey[];

  return (
    <div className="relative inline-block text-left" ref={containerRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-mono font-medium transition-all cursor-pointer shadow-2xs ${
          isOpen || activeCount > 1
            ? 'bg-surface-container-highest border-primary/60 text-on-surface'
            : 'bg-surface-container-low hover:bg-surface-container border-outline-variant/80 text-on-surface-variant hover:text-on-surface'
        }`}
        title="Filter visible relationship types"
      >
        <span className="material-symbols-outlined text-[17px] text-primary">polyline</span>
        <span>Edges</span>
        <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-surface-container text-on-surface border border-outline-variant">
          {activeCount}
        </span>
        <span className="material-symbols-outlined text-[16px] text-on-surface-variant">
          {isOpen ? 'expand_less' : 'expand_more'}
        </span>
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 rounded-xl bg-surface-container-lowest/98 backdrop-blur-xl border border-outline-variant/80 shadow-lg py-2 z-50 text-xs font-sans animate-in fade-in zoom-in-95 duration-100">
          <div className="px-3 py-2 border-b border-outline-variant/60 flex items-center justify-between">
            <div>
              <div className="font-bold text-on-surface font-mono text-[11px] uppercase tracking-wider">
                Relationship Filters
              </div>
              <p className="text-[10px] text-on-surface-variant">
                {isStudentConnectivityMode ? 'Filter peer ties between students' : 'Select 1–3 types to avoid edge chaos'}
              </p>
            </div>
            <button
              type="button"
              onClick={() =>
                onSetPreset(
                  isStudentConnectivityMode
                    ? ['FRIENDS_WITH', 'BUNKS_WITH', 'STUDIES_WITH']
                    : ['HIERARCHICAL']
                )
              }
              className="text-[10px] text-primary hover:underline font-mono cursor-pointer"
            >
              Reset Default
            </button>
          </div>

          {/* Quick Presets */}
          <div className="px-3 py-1.5 bg-surface-container-low/50 border-b border-outline-variant/40 flex flex-wrap gap-1">
            {isStudentConnectivityMode ? (
              <>
                <button
                  type="button"
                  onClick={() => onSetPreset(['FRIENDS_WITH', 'BUNKS_WITH', 'STUDIES_WITH'])}
                  className="text-[10px] font-mono px-2 py-0.5 rounded bg-surface-container hover:bg-surface-container-high text-on-surface-variant hover:text-on-surface border border-outline-variant/60 cursor-pointer"
                >
                  All Peer Ties
                </button>
                <button
                  type="button"
                  onClick={() => onSetPreset(['FRIENDS_WITH'])}
                  className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-500 border border-emerald-500/30 cursor-pointer"
                >
                  Friends Only
                </button>
                <button
                  type="button"
                  onClick={() => onSetPreset(['BUNKS_WITH'])}
                  className="text-[10px] font-mono px-2 py-0.5 rounded bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 border border-rose-500/30 cursor-pointer"
                >
                  Bunks Only
                </button>
                <button
                  type="button"
                  onClick={() => onSetPreset(['STUDIES_WITH'])}
                  className="text-[10px] font-mono px-2 py-0.5 rounded bg-blue-500/10 hover:bg-blue-500/20 text-blue-500 border border-blue-500/30 cursor-pointer"
                >
                  Study Circles
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => onSetPreset(['HIERARCHICAL'])}
                  className="text-[10px] font-mono px-2 py-0.5 rounded bg-surface-container hover:bg-surface-container-high text-on-surface-variant hover:text-on-surface border border-outline-variant/60 cursor-pointer"
                >
                  Hierarchy Only
                </button>
                <button
                  type="button"
                  onClick={() => onSetPreset(['HIERARCHICAL', 'BUNKS_WITH'])}
                  className="text-[10px] font-mono px-2 py-0.5 rounded bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 border border-rose-500/30 cursor-pointer"
                >
                  Bunks Only
                </button>
                <button
                  type="button"
                  onClick={() => onSetPreset(['HIERARCHICAL', 'FRIENDS_WITH', 'STUDIES_WITH'])}
                  className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-500 border border-emerald-500/30 cursor-pointer"
                >
                  Social Friends
                </button>
              </>
            )}
          </div>

          {/* Checkboxes List */}
          <div className="max-h-64 overflow-y-auto custom-scrollbar p-1">
            {edgeKeys.map((typeKey) => {
              const conf = EDGE_TYPE_CONFIG[typeKey];
              const isChecked = enabledTypes.has(typeKey);
              const count = edgeCounts[typeKey] ?? 0;

              return (
                <label
                  key={typeKey}
                  className="flex items-start gap-2.5 px-3 py-2 rounded-lg hover:bg-surface-container cursor-pointer transition-colors"
                >
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => onToggleType(typeKey)}
                    className="mt-0.5 rounded border-outline-variant text-primary focus:ring-0 cursor-pointer"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <div className="flex items-center gap-1.5 truncate">
                        <span
                          className="w-2.5 h-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: conf.color }}
                        />
                        <span className={`text-xs font-mono font-medium truncate ${isChecked ? 'text-on-surface font-semibold' : 'text-on-surface-variant'}`}>
                          {typeKey}
                        </span>
                      </div>
                      {count > 0 && (
                        <span className="text-[10px] font-mono text-on-surface-variant/70 shrink-0">
                          ({count})
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] text-on-surface-variant/75 mt-0.5 leading-snug">
                      {conf.description}
                    </p>
                  </div>
                </label>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
