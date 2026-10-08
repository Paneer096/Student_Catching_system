import React, { useState, useMemo } from 'react';
import { CanvasNode, CanvasEdge } from './KnowledgeGraphCanvas';

export interface OperationsSidebarProps {
  nodes: CanvasNode[];
  edges: CanvasEdge[];
  nodeTypesMap: Record<string, { color: string; icon: string; description: string }>;
  edgeTypesList: string[];
  enabledNodeTypes: Set<string>;
  onToggleNodeType: (type: string) => void;
  onSelectAllNodeTypes: () => void;
  onClearAllNodeTypes: () => void;
  // Neat Mode & Edge Filtering
  neatMode?: boolean;
  onToggleNeatMode?: () => void;
  minCoabsenceWeight?: number;
  onMinCoabsenceWeightChange?: (w: number) => void;
  enabledEdgeTypes?: Set<string>;
  onToggleEdgeType?: (type: string) => void;
  onSelectAllEdgeTypes?: () => void;
  onClearAllEdgeTypes?: () => void;
  prunedEdgeCount?: number;
  // Pathfinder
  pathSource: string;
  onSetPathSource: (id: string) => void;
  pathTarget: string;
  onSetPathTarget: (id: string) => void;
  onCalculatePath: (source: string, target: string) => void;
  highlightedPath: { nodes: string[]; edges: any[] } | null;
  onClearPath: () => void;
  pathError: string | null;
  // Editor
  onInjectNode: (node: { id: string; label: string; type: string; properties?: Record<string, any> }) => void;
  onInjectEdge: (edge: { source: string; target: string; type: string; weight?: number }) => void;
  // Timeline
  timelineRange: { min: number; max: number; current: number } | null;
  onTimelineChange: (val: number) => void;
  isTimelinePlaying: boolean;
  onToggleTimelinePlay: () => void;
}

export const OperationsSidebar: React.FC<OperationsSidebarProps> = ({
  nodes,
  edges,
  nodeTypesMap,
  edgeTypesList,
  enabledNodeTypes,
  onToggleNodeType,
  onSelectAllNodeTypes,
  onClearAllNodeTypes,
  neatMode = true,
  onToggleNeatMode,
  minCoabsenceWeight = 3,
  onMinCoabsenceWeightChange,
  enabledEdgeTypes = new Set(),
  onToggleEdgeType,
  onSelectAllEdgeTypes,
  onClearAllEdgeTypes,
  prunedEdgeCount = 0,
  pathSource,
  onSetPathSource,
  pathTarget,
  onSetPathTarget,
  onCalculatePath,
  highlightedPath,
  onClearPath,
  pathError,
  onInjectNode,
  onInjectEdge,
  timelineRange,
  onTimelineChange,
  isTimelinePlaying,
  onToggleTimelinePlay,
}) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [activeTab, setActiveTab] = useState<'entities' | 'pathfinder' | 'editor' | 'timeline'>('entities');

  // Form states for Editor tab
  const [newNodeId, setNewNodeId] = useState('');
  const [newNodeLabel, setNewNodeLabel] = useState('');
  const [newNodeType, setNewNodeType] = useState<string>(() => Object.keys(nodeTypesMap)[0] || 'Entity');
  const [newNodePropKey, setNewNodePropKey] = useState('');
  const [newNodePropVal, setNewNodePropVal] = useState('');

  const [newEdgeSource, setNewEdgeSource] = useState('');
  const [newEdgeTarget, setNewEdgeTarget] = useState('');
  const [newEdgeType, setNewEdgeType] = useState<string>(() => edgeTypesList[0] || 'CONNECTED_TO');
  const [newEdgeWeight, setNewEdgeWeight] = useState('1.0');

  // Node type counts
  const nodeTypeCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    nodes.forEach((n) => {
      counts[n.type] = (counts[n.type] || 0) + 1;
    });
    return counts;
  }, [nodes]);

  const handleCreateNode = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNodeId.trim() || !newNodeLabel.trim()) return;
    const properties: Record<string, any> = {};
    if (newNodePropKey.trim() && newNodePropVal.trim()) {
      properties[newNodePropKey.trim()] = newNodePropVal.trim();
    }
    onInjectNode({
      id: newNodeId.trim(),
      label: newNodeLabel.trim(),
      type: newNodeType,
      properties,
    });
    setNewNodeId('');
    setNewNodeLabel('');
    setNewNodePropKey('');
    setNewNodePropVal('');
  };

  const handleCreateEdge = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEdgeSource.trim() || !newEdgeTarget.trim()) return;
    onInjectEdge({
      source: newEdgeSource.trim(),
      target: newEdgeTarget.trim(),
      type: newEdgeType,
      weight: parseFloat(newEdgeWeight) || 1.0,
    });
    setNewEdgeSource('');
    setNewEdgeTarget('');
  };

  if (isCollapsed) {
    return (
      <div className="absolute left-4 top-20 z-20">
        <button
          onClick={() => setIsCollapsed(false)}
          className="p-2.5 rounded-xl bg-black/80 backdrop-blur-xl border border-white/10 text-cyan-400 hover:text-white hover:border-cyan-500/50 shadow-2xl transition-all flex items-center gap-1.5 font-mono text-xs"
          title="Open Tactical Operations Sidebar"
        >
          <span className="material-symbols-outlined text-[18px]">menu_open</span>
          <span className="hidden sm:inline font-bold">OPERATIONS</span>
        </button>
      </div>
    );
  }

  return (
    <div className="absolute left-4 top-20 z-20 w-[320px] max-h-[calc(100vh-100px)] flex flex-col bg-black/85 backdrop-blur-2xl border border-white/10 rounded-2xl shadow-2xl overflow-hidden font-sans select-none">
      {/* Header & Tabs */}
      <div className="p-3 border-b border-white/10 bg-white/[0.02]">
        <div className="flex items-center justify-between mb-2.5">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-cyan-400 text-[18px]">terminal</span>
            <span className="text-xs font-bold text-white uppercase tracking-wider font-mono">
              Operations Dock
            </span>
          </div>
          <button
            onClick={() => setIsCollapsed(true)}
            className="p-1 rounded text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
            title="Collapse Sidebar"
          >
            <span className="material-symbols-outlined text-[17px]">chevron_left</span>
          </button>
        </div>

        {/* Tab Buttons */}
        <div className="grid grid-cols-4 gap-1 p-1 bg-white/[0.04] rounded-xl border border-white/5 font-mono text-[11px]">
          <button
            onClick={() => setActiveTab('entities')}
            className={`py-1 rounded-lg font-semibold transition-all ${
              activeTab === 'entities'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-xs'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Entities
          </button>
          <button
            onClick={() => setActiveTab('pathfinder')}
            className={`py-1 rounded-lg font-semibold transition-all ${
              activeTab === 'pathfinder'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-xs'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Path
          </button>
          <button
            onClick={() => setActiveTab('editor')}
            className={`py-1 rounded-lg font-semibold transition-all ${
              activeTab === 'editor'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-xs'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Editor
          </button>
          <button
            onClick={() => setActiveTab('timeline')}
            className={`py-1 rounded-lg font-semibold transition-all ${
              activeTab === 'timeline'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-xs'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Time
          </button>
        </div>
      </div>

      {/* Tab Contents */}
      <div className="p-3.5 overflow-y-auto space-y-3 flex-1 text-xs">
        {/* ── 1. ENTITIES TAB ── */}
        {activeTab === 'entities' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-[11px] font-mono text-gray-400">
              <span className="font-semibold uppercase tracking-wider">Entity Filter</span>
              <div className="flex gap-2">
                <button
                  onClick={onSelectAllNodeTypes}
                  className="hover:text-cyan-400 transition-colors"
                >
                  All
                </button>
                <span>·</span>
                <button
                  onClick={onClearAllNodeTypes}
                  className="hover:text-rose-400 transition-colors"
                >
                  None
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              {Object.entries(nodeTypesMap).map(([typeKey, meta]) => {
                const count = nodeTypeCounts[typeKey] || 0;
                const isChecked = enabledNodeTypes.has(typeKey);
                return (
                  <label
                    key={typeKey}
                    className={`flex items-center justify-between p-2 rounded-xl border cursor-pointer transition-all ${
                      isChecked
                        ? 'bg-white/[0.04] border-white/10 hover:border-white/20'
                        : 'bg-white/[0.01] border-transparent opacity-50 hover:opacity-75'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 overflow-hidden">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => onToggleNodeType(typeKey)}
                        className="rounded accent-cyan-500"
                      />
                      <span
                        className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                        style={{ backgroundColor: meta.color, boxShadow: `0 0 6px ${meta.color}` }}
                      />
                      <span className="text-gray-200 font-medium truncate text-[11px]">
                        {typeKey}
                      </span>
                    </div>
                    <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-white/10 text-gray-300 font-semibold">
                      {count}
                    </span>
                  </label>
                );
              })}
            </div>

            {/* ── Co-Absence Density & Neat Controls ── */}
            <div className="pt-2.5 border-t border-white/10 space-y-2.5">
              <div className="flex items-center justify-between text-[11px] font-mono">
                <span className="text-gray-400 font-semibold uppercase tracking-wider flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[14px] text-emerald-400">auto_awesome</span>
                  Graph Tidiness
                </span>
                {onToggleNeatMode && (
                  <button
                    onClick={onToggleNeatMode}
                    className={`px-2 py-0.5 rounded-lg text-[10px] font-semibold border transition-all ${
                      neatMode
                        ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
                        : 'bg-white/[0.04] border-white/10 text-gray-400 hover:text-white'
                    }`}
                  >
                    {neatMode ? 'NEAT ON' : 'DENSE'}
                  </button>
                )}
              </div>

              {/* Threshold Slider */}
              {onMinCoabsenceWeightChange && (
                <div className="p-2.5 rounded-xl bg-white/[0.03] border border-white/5 space-y-2">
                  <div className="flex justify-between items-center text-[10px] font-mono text-gray-300">
                    <span>Min Co-Absence Tie:</span>
                    <span className="text-cyan-400 font-bold bg-cyan-950/60 px-1.5 py-0.5 rounded border border-cyan-500/30">
                      ≥ {minCoabsenceWeight} mutual skips
                    </span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="6"
                    step="1"
                    value={minCoabsenceWeight}
                    onChange={(e) => onMinCoabsenceWeightChange(parseInt(e.target.value, 10))}
                    className="w-full accent-cyan-400 cursor-pointer h-1.5 bg-gray-800 rounded-lg"
                  />
                  <div className="flex justify-between text-[9px] font-mono text-gray-400">
                    <span>1 (Raw/Messy)</span>
                    <span className="text-emerald-400 font-semibold">3 (Neat)</span>
                    <span>6 (Strict)</span>
                  </div>
                </div>
              )}

              {/* Edge Types Filter */}
              {onToggleEdgeType && (
                <div className="space-y-1.5 pt-1">
                  <div className="flex items-center justify-between text-[11px] font-mono text-gray-400">
                    <span className="font-semibold uppercase tracking-wider">Edge Types</span>
                    <div className="flex gap-2 text-[10px]">
                      {onSelectAllEdgeTypes && (
                        <button onClick={onSelectAllEdgeTypes} className="hover:text-cyan-400 transition-colors">
                          All
                        </button>
                      )}
                      <span>·</span>
                      {onClearAllEdgeTypes && (
                        <button onClick={onClearAllEdgeTypes} className="hover:text-rose-400 transition-colors">
                          None
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="space-y-1">
                    {edgeTypesList.map((etype) => {
                      const isChecked = enabledEdgeTypes.size === 0 || enabledEdgeTypes.has(etype);
                      const isBunkType = etype === 'BUNKS_WITH' || etype === 'CO_ABSENT';
                      return (
                        <label
                          key={etype}
                          className={`flex items-center justify-between p-1.5 px-2 rounded-lg border cursor-pointer transition-all ${
                            isChecked
                              ? 'bg-white/[0.03] border-white/10 hover:border-white/20'
                              : 'bg-white/[0.01] border-transparent opacity-40 hover:opacity-70'
                          }`}
                        >
                          <div className="flex items-center gap-2 overflow-hidden">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => onToggleEdgeType(etype)}
                              className="rounded accent-cyan-500 text-[10px]"
                            />
                            <span
                              className="w-2 h-2 rounded-full flex-shrink-0"
                              style={{ backgroundColor: isBunkType ? '#f43f5e' : '#38bdf8' }}
                            />
                            <span className="text-gray-300 font-mono text-[10px] truncate">
                              {etype}
                            </span>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            <div className="pt-2 border-t border-white/10 flex justify-between items-center text-[10px] font-mono text-gray-400">
              <span>Active Relational Edges:</span>
              <span className="text-cyan-400 font-bold">{edges.length}</span>
            </div>
            {prunedEdgeCount > 0 && (
              <div className="flex justify-between items-center text-[9.5px] font-mono text-emerald-400/90 bg-emerald-950/30 px-2 py-1 rounded-lg border border-emerald-500/20">
                <span>Filtered Noise Ties:</span>
                <span className="font-bold">+{prunedEdgeCount} casual pairs hidden</span>
              </div>
            )}
          </div>
        )}

        {/* ── 2. PATHFINDER TAB ── */}
        {activeTab === 'pathfinder' && (
          <div className="space-y-3">
            <div className="text-[11px] font-mono text-gray-400 font-semibold uppercase tracking-wider">
              Shortest Connection Path
            </div>
            <p className="text-[11px] text-gray-400 leading-relaxed">
              Find shortest relational hops between any two entities in the knowledge graph.
            </p>

            <div className="space-y-2">
              <div>
                <label className="text-[10px] font-mono text-gray-400 uppercase tracking-wide block mb-1">
                  Source Entity
                </label>
                <select
                  value={pathSource}
                  onChange={(e) => onSetPathSource(e.target.value)}
                  className="w-full bg-white/[0.05] border border-white/10 rounded-xl px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-500"
                >
                  <option value="" className="bg-gray-900 text-gray-400">
                    -- Select Source --
                  </option>
                  {nodes.map((n) => (
                    <option key={n.id} value={n.id} className="bg-gray-900 text-white">
                      {n.label} ({n.type})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[10px] font-mono text-gray-400 uppercase tracking-wide block mb-1">
                  Target Entity
                </label>
                <select
                  value={pathTarget}
                  onChange={(e) => onSetPathTarget(e.target.value)}
                  className="w-full bg-white/[0.05] border border-white/10 rounded-xl px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-500"
                >
                  <option value="" className="bg-gray-900 text-gray-400">
                    -- Select Target --
                  </option>
                  {nodes.map((n) => (
                    <option key={n.id} value={n.id} className="bg-gray-900 text-white">
                      {n.label} ({n.type})
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex gap-2 pt-1">
                <button
                  onClick={() => onCalculatePath(pathSource, pathTarget)}
                  disabled={!pathSource || !pathTarget || pathSource === pathTarget}
                  className="flex-1 py-1.5 rounded-xl bg-cyan-500 text-black font-bold hover:bg-cyan-400 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-1.5 text-xs"
                >
                  <span className="material-symbols-outlined text-[16px]">alt_route</span>
                  <span>Calculate Path</span>
                </button>
                {highlightedPath && (
                  <button
                    onClick={onClearPath}
                    className="p-1.5 rounded-xl bg-white/10 text-gray-300 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                    title="Clear Path"
                  >
                    <span className="material-symbols-outlined text-[17px]">clear</span>
                  </button>
                )}
              </div>
            </div>

            {pathError && (
              <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-[11px]">
                {pathError}
              </div>
            )}

            {highlightedPath && (
              <div className="p-3 rounded-xl bg-cyan-950/40 border border-cyan-500/40 space-y-2">
                <div className="flex justify-between items-center text-[11px] font-mono">
                  <span className="text-cyan-400 font-bold">PATH FOUND</span>
                  <span className="text-gray-300">
                    {highlightedPath.nodes.length - 1} hops ({highlightedPath.nodes.length} nodes)
                  </span>
                </div>
                <div className="divide-y divide-white/5 max-h-36 overflow-y-auto pr-1">
                  {highlightedPath.nodes.map((nid, idx) => {
                    const matchNode = nodes.find((n) => n.id === nid);
                    return (
                      <div key={idx} className="py-1 flex items-center gap-2 text-[11px]">
                        <span className="font-mono text-cyan-400 font-bold text-[10px]">
                          {idx + 1}.
                        </span>
                        <span className="text-gray-200 truncate">
                          {matchNode?.label || nid}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── 3. EDITOR TAB ── */}
        {activeTab === 'editor' && (
          <div className="space-y-4">
            {/* Inject Node */}
            <form onSubmit={handleCreateNode} className="space-y-2">
              <div className="text-[11px] font-mono text-gray-400 font-semibold uppercase tracking-wider">
                Inject Node
              </div>
              <input
                type="text"
                placeholder="Node ID (e.g., stu-999)"
                value={newNodeId}
                onChange={(e) => setNewNodeId(e.target.value)}
                className="w-full bg-white/[0.05] border border-white/10 rounded-xl px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-500"
              />
              <input
                type="text"
                placeholder="Entity Label (e.g., Sarah Chen)"
                value={newNodeLabel}
                onChange={(e) => setNewNodeLabel(e.target.value)}
                className="w-full bg-white/[0.05] border border-white/10 rounded-xl px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-500"
              />
              <select
                value={newNodeType}
                onChange={(e) => setNewNodeType(e.target.value)}
                className="w-full bg-white/[0.05] border border-white/10 rounded-xl px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-500"
              >
                {Object.keys(nodeTypesMap).map((k) => (
                  <option key={k} value={k} className="bg-gray-900 text-white">
                    {k}
                  </option>
                ))}
              </select>
              <div className="grid grid-cols-2 gap-1.5">
                <input
                  type="text"
                  placeholder="Property Key"
                  value={newNodePropKey}
                  onChange={(e) => setNewNodePropKey(e.target.value)}
                  className="w-full bg-white/[0.05] border border-white/10 rounded-xl px-2 py-1 text-[11px] text-white"
                />
                <input
                  type="text"
                  placeholder="Value"
                  value={newNodePropVal}
                  onChange={(e) => setNewNodePropVal(e.target.value)}
                  className="w-full bg-white/[0.05] border border-white/10 rounded-xl px-2 py-1 text-[11px] text-white"
                />
              </div>
              <button
                type="submit"
                className="w-full py-1.5 rounded-xl bg-cyan-500/20 border border-cyan-500/40 text-cyan-300 font-bold hover:bg-cyan-500/30 transition-colors text-xs"
              >
                + Inject Entity
              </button>
            </form>

            <div className="border-t border-white/10" />

            {/* Inject Edge */}
            <form onSubmit={handleCreateEdge} className="space-y-2">
              <div className="text-[11px] font-mono text-gray-400 font-semibold uppercase tracking-wider">
                Inject Edge (Relationship)
              </div>
              <select
                value={newEdgeSource}
                onChange={(e) => setNewEdgeSource(e.target.value)}
                className="w-full bg-white/[0.05] border border-white/10 rounded-xl px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-500"
              >
                <option value="" className="bg-gray-900 text-gray-400">
                  -- Source Node --
                </option>
                {nodes.map((n) => (
                  <option key={n.id} value={n.id} className="bg-gray-900 text-white">
                    {n.label}
                  </option>
                ))}
              </select>
              <select
                value={newEdgeTarget}
                onChange={(e) => setNewEdgeTarget(e.target.value)}
                className="w-full bg-white/[0.05] border border-white/10 rounded-xl px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-500"
              >
                <option value="" className="bg-gray-900 text-gray-400">
                  -- Target Node --
                </option>
                {nodes.map((n) => (
                  <option key={n.id} value={n.id} className="bg-gray-900 text-white">
                    {n.label}
                  </option>
                ))}
              </select>
              <select
                value={newEdgeType}
                onChange={(e) => setNewEdgeType(e.target.value)}
                className="w-full bg-white/[0.05] border border-white/10 rounded-xl px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-500"
              >
                {edgeTypesList.map((et) => (
                  <option key={et} value={et} className="bg-gray-900 text-white">
                    {et}
                  </option>
                ))}
              </select>
              <input
                type="number"
                step="0.1"
                min="0.1"
                max="10"
                placeholder="Weight (default 1.0)"
                value={newEdgeWeight}
                onChange={(e) => setNewEdgeWeight(e.target.value)}
                className="w-full bg-white/[0.05] border border-white/10 rounded-xl px-2.5 py-1 text-xs text-white"
              />
              <button
                type="submit"
                className="w-full py-1.5 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 font-bold hover:bg-emerald-500/30 transition-colors text-xs"
              >
                + Connect Relationship
              </button>
            </form>
          </div>
        )}

        {/* ── 4. TIMELINE TAB ── */}
        {activeTab === 'timeline' && (
          <div className="space-y-3">
            <div className="text-[11px] font-mono text-gray-400 font-semibold uppercase tracking-wider">
              Temporal Timeline Filter
            </div>
            <p className="text-[11px] text-gray-400 leading-relaxed">
              Playback network event propagation and filter transactions or relationships over time.
            </p>

            {timelineRange ? (
              <div className="space-y-3 p-3 rounded-xl bg-white/[0.03] border border-white/10">
                <div className="flex justify-between items-center text-xs font-mono">
                  <span className="text-gray-400">Active Timestamp:</span>
                  <span className="text-cyan-400 font-bold">
                    {new Date(timelineRange.current).toLocaleDateString()}
                  </span>
                </div>

                <input
                  type="range"
                  min={timelineRange.min}
                  max={timelineRange.max}
                  value={timelineRange.current}
                  onChange={(e) => onTimelineChange(Number(e.target.value))}
                  className="w-full accent-cyan-500 cursor-pointer"
                />

                <div className="flex justify-between text-[10px] font-mono text-gray-500">
                  <span>{new Date(timelineRange.min).toLocaleDateString()}</span>
                  <span>{new Date(timelineRange.max).toLocaleDateString()}</span>
                </div>

                <div className="pt-1">
                  <button
                    onClick={onToggleTimelinePlay}
                    className="w-full py-1.5 rounded-xl bg-cyan-500/20 border border-cyan-500/40 text-cyan-300 font-bold hover:bg-cyan-500/30 transition-colors flex items-center justify-center gap-1.5 text-xs"
                  >
                    <span className="material-symbols-outlined text-[16px]">
                      {isTimelinePlaying ? 'pause' : 'play_arrow'}
                    </span>
                    <span>{isTimelinePlaying ? 'Pause Simulation' : 'Play Timeline'}</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="p-3 rounded-xl bg-white/[0.03] text-gray-400 text-[11px] text-center font-mono">
                Temporal dates active for current view
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
