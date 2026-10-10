import React, { useState, useRef, useEffect } from 'react';
import { CanvasNode } from './KnowledgeGraphCanvas';
import { DomainPreset } from './domainPresets';

export interface TopTacticalBarProps {
  nodeCount: number;
  edgeCount: number;
  activeDomain: DomainPreset;
  activeSection: string;
  onSectionChange: (sec: string) => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  nodes: CanvasNode[];
  onSelectNode: (node: CanvasNode) => void;
  onFocusNode: (nodeId: string) => void;
  neatMode?: boolean;
  onToggleNeatMode?: () => void;
}

export const TopTacticalBar: React.FC<TopTacticalBarProps> = ({
  nodeCount,
  edgeCount,
  activeDomain,
  activeSection,
  onSectionChange,
  searchQuery,
  onSearchChange,
  nodes,
  onSelectNode,
  onFocusNode,
  neatMode = true,
  onToggleNeatMode,
}) => {
  const [searchCategory, setSearchCategory] = useState<'all' | 'primary' | 'connections'>('all');
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  // Filter autocomplete search candidates
  const searchResults = React.useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase().trim();
    return nodes
      .filter((n) => {
        const matchesText =
          n.label.toLowerCase().includes(q) ||
          n.id.toLowerCase().includes(q) ||
          n.type.toLowerCase().includes(q);
        if (!matchesText) return false;

        if (searchCategory === 'primary') {
          return (n.pagerank || 0) >= 0.06 || n.type === 'Classroom' || n.type === 'Faculty';
        }
        if (searchCategory === 'connections') {
          return (n.degree || 0) >= 3;
        }
        return true;
      })
      .slice(0, 8);
  }, [nodes, searchQuery, searchCategory]);

  // Click outside listener for search autocomplete
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setIsSearchFocused(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="h-14 px-4 bg-black/85 backdrop-blur-2xl border-b border-white/10 flex items-center justify-between z-30 select-none">
      {/* Left: System Title & Live Status Indicator */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shadow-[0_0_15px_rgba(0,180,255,0.2)]">
            <span className="material-symbols-outlined text-[19px]">account_tree</span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-xs text-white tracking-wider font-mono uppercase">
                Knowledge Graph
              </span>
              <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-cyan-950/70 text-cyan-400 border border-cyan-500/30 font-semibold tracking-wider">
                TACTICAL HUD
              </span>
            </div>
            <div className="flex items-center gap-2 text-[10px] font-mono text-gray-400 mt-0.5">
              <span className="flex items-center gap-1 text-emerald-400 font-semibold">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                SYSTEM ONLINE
              </span>
              <span>·</span>
              <span className="text-gray-300 font-semibold">{nodeCount} NODES</span>
              <span>·</span>
              <span className="text-gray-300 font-semibold">{edgeCount} EDGES</span>
            </div>
          </div>
        </div>
      </div>

      {/* Center: Global Search Bar with Category Filter & Autocomplete */}
      <div ref={searchContainerRef} className="relative w-80 lg:w-96">
        <div className="flex items-center bg-white/[0.05] border border-white/10 rounded-xl px-2.5 py-1.5 focus-within:border-cyan-500/60 focus-within:bg-black/60 transition-all">
          <span className="material-symbols-outlined text-[17px] text-gray-400 mr-2">search</span>
          <input
            type="text"
            placeholder="Search entities, roles, indicators..."
            value={searchQuery}
            onChange={(e) => {
              onSearchChange(e.target.value);
              setIsSearchFocused(true);
            }}
            onFocus={() => setIsSearchFocused(true)}
            className="flex-1 bg-transparent text-xs text-white placeholder-gray-500 focus:outline-none"
          />
          {searchQuery && (
            <button
              onClick={() => onSearchChange('')}
              className="text-gray-400 hover:text-white mr-1.5"
            >
              <span className="material-symbols-outlined text-[15px]">close</span>
            </button>
          )}

          {/* Category Dropdown Pill */}
          <select
            value={searchCategory}
            onChange={(e) => setSearchCategory(e.target.value as any)}
            className="bg-white/10 text-gray-300 text-[10px] font-mono rounded px-1.5 py-0.5 border border-white/10 focus:outline-none cursor-pointer"
          >
            <option value="all" className="bg-gray-900 text-white">All</option>
            <option value="primary" className="bg-gray-900 text-white">Hubs</option>
            <option value="connections" className="bg-gray-900 text-white">Ties</option>
          </select>
        </div>

        {/* Autocomplete Dropdown */}
        {isSearchFocused && searchResults.length > 0 && (
          <div className="absolute left-0 right-0 top-full mt-1 bg-black/90 backdrop-blur-2xl border border-white/15 rounded-xl shadow-2xl overflow-hidden z-50 divide-y divide-white/5">
            {searchResults.map((item) => (
              <div
                key={item.id}
                onClick={() => {
                  onSelectNode(item);
                  onFocusNode(item.id);
                  setIsSearchFocused(false);
                }}
                className="p-2.5 hover:bg-white/[0.08] cursor-pointer flex items-center justify-between transition-colors"
              >
                <div className="flex items-center gap-2 overflow-hidden">
                  <span
                    className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                    style={{ backgroundColor: item.color || '#00b4ff' }}
                  />
                  <div className="overflow-hidden">
                    <div className="text-xs font-bold text-white truncate font-mono">
                      {item.label}
                    </div>
                    <div className="text-[10px] text-gray-400 font-mono">
                      {item.type} · ID: {item.id}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-cyan-950/60 text-cyan-300 border border-cyan-500/30">
                    PR {(item.pagerank || 0).toFixed(2)}
                  </span>
                  <span className="material-symbols-outlined text-[15px] text-gray-400">
                    center_focus_strong
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Right: Domain Preset Switcher & Section Selector */}
      <div className="flex items-center gap-2">
        {/* Academic section picker if academic domain */}
        {activeDomain.id === 'academic' && (
          <div className="flex items-center bg-white/[0.05] border border-white/10 rounded-xl px-2 py-1 text-xs font-mono">
            <span className="text-gray-400 text-[10px] uppercase mr-1.5">Section:</span>
            <select
              value={activeSection}
              onChange={(e) => onSectionChange(e.target.value)}
              className="bg-transparent text-cyan-400 font-bold focus:outline-none cursor-pointer"
            >
              <option value="CS-3B" className="bg-gray-900 text-white">CS-3B</option>
              <option value="CS-3A" className="bg-gray-900 text-white">CS-3A</option>
              <option value="EC-4A" className="bg-gray-900 text-white">EC-4A</option>
            </select>
          </div>
        )}

        {/* Neat Graph Quick Toggle */}
        {onToggleNeatMode && (
          <button
            onClick={onToggleNeatMode}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-mono font-semibold border transition-all ${
              neatMode
                ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300 shadow-[0_0_12px_rgba(16,185,129,0.2)]'
                : 'bg-white/[0.04] border-white/10 text-gray-400 hover:text-white'
            }`}
            title={neatMode ? 'Neat Mode Active (Filtering casual co-absence noise)' : 'Dense Mode (Showing all raw co-absences)'}
          >
            <span className="material-symbols-outlined text-[15px] text-emerald-400">
              {neatMode ? 'auto_awesome' : 'scatter_plot'}
            </span>
            <span className="hidden sm:inline">
              {neatMode ? 'NEAT VIEW' : 'DENSE VIEW'}
            </span>
          </button>
        )}

        {/* Domain Indicator (Dedicated to Classroom & Academic Intelligence) */}
        <div className="flex items-center gap-2 bg-white/[0.06] border border-white/15 px-3 py-1.5 rounded-xl text-xs font-semibold text-white shadow-xs">
          <span className="material-symbols-outlined text-[17px] text-cyan-400">
            school
          </span>
          <span className="truncate hidden sm:inline text-cyan-300">
            Classroom & Academic Intelligence
          </span>
        </div>
      </div>
    </div>
  );
};
