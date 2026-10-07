import React, { useState, useRef, useEffect, useCallback } from 'react';
import { CanvasNode, CanvasEdge } from './KnowledgeGraphCanvas';

export interface FloatingNodeHudProps {
  node: CanvasNode | null;
  edges: CanvasEdge[];
  nodeTypesMap: Record<string, { color: string; icon: string; description: string }>;
  isPinned: boolean;
  onTogglePin: () => void;
  onClose: () => void;
  onFocusNode: (nodeId: string) => void;
  onSelectAsPathSource: (nodeId: string) => void;
  onFilterNeighbors: (nodeId: string) => void;
  onOpenDetail?: (node: CanvasNode) => void;
}

export const FloatingNodeHud: React.FC<FloatingNodeHudProps> = ({
  node,
  edges,
  nodeTypesMap,
  isPinned,
  onTogglePin,
  onClose,
  onFocusNode,
  onSelectAsPathSource,
  onFilterNeighbors,
  onOpenDetail,
}) => {
  const [isMinimized, setIsMinimized] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);
  const [pos, setPos] = useState<{ x: number; y: number }>({ x: 28, y: 88 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef<{ mouseX: number; mouseY: number; startX: number; startY: number }>({
    mouseX: 0,
    mouseY: 0,
    startX: 28,
    startY: 88,
  });

  const nodeColor = node ? (nodeTypesMap[node.type]?.color || '#00b4ff') : '#00b4ff';

  // Find neighbors connected to this node
  const neighborInfo = React.useMemo(() => {
    if (!node) return [];
    const neighbors: Array<{ id: string; type: string; edgeType: string }> = [];
    edges.forEach((e) => {
      const srcId = String(typeof e.source === 'object' ? e.source.id : e.source);
      const tgtId = String(typeof e.target === 'object' ? e.target.id : e.target);
      if (srcId === node.id) {
        neighbors.push({ id: tgtId, type: 'Target', edgeType: e.type });
      } else if (tgtId === node.id) {
        neighbors.push({ id: srcId, type: 'Source', edgeType: e.type });
      }
    });
    return neighbors.slice(0, 8); // limit preview
  }, [node, edges]);

  // Handle Dragging
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    // Only allow dragging on header
    if ((e.target as HTMLElement).closest('button')) return;
    setIsDragging(true);
    dragStartRef.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      startX: pos.x,
      startY: pos.y,
    };
  }, [pos]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      const dx = e.clientX - dragStartRef.current.mouseX;
      const dy = e.clientY - dragStartRef.current.mouseY;
      setPos({
        x: Math.max(10, dragStartRef.current.startX + dx),
        y: Math.max(10, dragStartRef.current.startY + dy),
      });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

  if (!node) return null;

  return (
    <div
      style={{
        transform: isMaximized
          ? 'translate(-50%, -50%)'
          : `translate(${pos.x}px, ${pos.y}px)`,
        top: isMaximized ? '50%' : 0,
        left: isMaximized ? '50%' : 0,
        width: isMaximized ? 'min(760px, 92vw)' : isMinimized ? '320px' : '360px',
        maxHeight: isMaximized ? '85vh' : '80vh',
      }}
      className={`fixed z-30 transition-shadow duration-200 select-none ${
        isMaximized
          ? 'bg-black/90 backdrop-blur-2xl border border-white/20 shadow-[0_0_50px_rgba(0,180,255,0.25)] rounded-2xl flex flex-col overflow-hidden'
          : 'bg-black/80 backdrop-blur-xl border border-white/10 shadow-2xl rounded-2xl flex flex-col overflow-hidden'
      }`}
    >
      {/* Draggable Header */}
      <div
        onMouseDown={handleMouseDown}
        className="p-3.5 border-b border-white/10 flex items-center justify-between cursor-move bg-white/[0.03]"
      >
        <div className="flex items-center gap-2.5 overflow-hidden">
          <span
            className="w-3.5 h-3.5 rounded-full flex-shrink-0 shadow-sm"
            style={{ backgroundColor: nodeColor, boxShadow: `0 0 10px ${nodeColor}` }}
          />
          <div className="overflow-hidden">
            <div className="flex items-center gap-1.5">
              <span
                className="text-[10px] font-mono font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border"
                style={{
                  color: nodeColor,
                  borderColor: `${nodeColor}40`,
                  backgroundColor: `${nodeColor}15`,
                }}
              >
                {node.type}
              </span>
              {isPinned && (
                <span className="text-[10px] font-mono text-cyan-400 bg-cyan-950/60 border border-cyan-500/40 px-1 rounded flex items-center gap-0.5">
                  <span className="material-symbols-outlined text-[11px]">push_pin</span>
                  PINNED
                </span>
              )}
            </div>
            <h4 className="text-sm font-bold text-white truncate mt-0.5" title={node.label}>
              {node.label}
            </h4>
          </div>
        </div>

        {/* Window controls */}
        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            onClick={onTogglePin}
            className={`p-1 rounded hover:bg-white/10 transition-colors ${
              isPinned ? 'text-cyan-400' : 'text-gray-400 hover:text-white'
            }`}
            title={isPinned ? 'Unpin HUD' : 'Pin HUD (keep open on hover)'}
          >
            <span className="material-symbols-outlined text-[17px]">
              {isPinned ? 'push_pin' : 'keep'}
            </span>
          </button>
          <button
            onClick={() => setIsMinimized((prev) => !prev)}
            className="p-1 rounded text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
            title={isMinimized ? 'Expand' : 'Minimize'}
          >
            <span className="material-symbols-outlined text-[17px]">
              {isMinimized ? 'expand_more' : 'expand_less'}
            </span>
          </button>
          <button
            onClick={() => setIsMaximized((prev) => !prev)}
            className="p-1 rounded text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
            title={isMaximized ? 'Restore' : 'Maximize'}
          >
            <span className="material-symbols-outlined text-[17px]">
              {isMaximized ? 'close_fullscreen' : 'open_in_full'}
            </span>
          </button>
          <button
            onClick={onClose}
            className="p-1 rounded text-gray-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
            title="Close"
          >
            <span className="material-symbols-outlined text-[17px]">close</span>
          </button>
        </div>
      </div>

      {/* Card Body (Collapsible) */}
      {!isMinimized && (
        <div className="p-4 overflow-y-auto space-y-4 text-xs font-sans">
          {/* Metrics Grid */}
          <div className="grid grid-cols-3 gap-2 font-mono">
            <div className="p-2.5 rounded-xl bg-white/[0.04] border border-white/5 flex flex-col">
              <span className="text-[10px] text-gray-400 uppercase tracking-wider">Degree</span>
              <span className="text-base font-extrabold text-white mt-0.5">
                {node.degree ?? neighborInfo.length}
              </span>
              <span className="text-[9px] text-gray-500">Connections</span>
            </div>
            <div className="p-2.5 rounded-xl bg-white/[0.04] border border-white/5 flex flex-col">
              <span className="text-[10px] text-gray-400 uppercase tracking-wider">Community</span>
              <span className="text-base font-extrabold text-emerald-400 mt-0.5">
                #{node.community ?? 1}
              </span>
              <span className="text-[9px] text-gray-500">Louvain Cluster</span>
            </div>
            <div className="p-2.5 rounded-xl bg-white/[0.04] border border-white/5 flex flex-col">
              <span className="text-[10px] text-gray-400 uppercase tracking-wider">PageRank</span>
              <span className="text-base font-extrabold text-cyan-400 mt-0.5">
                {(node.pagerank || 0).toFixed(3)}
              </span>
              <span className="text-[9px] text-gray-500">Centrality</span>
            </div>
          </div>

          {/* Quick Action Buttons */}
          <div className="grid grid-cols-3 gap-2">
            <button
              onClick={() => onFocusNode(node.id)}
              className="py-1.5 px-2 rounded-lg bg-cyan-500/15 border border-cyan-500/30 text-cyan-300 hover:bg-cyan-500/25 transition-colors font-medium flex items-center justify-center gap-1 text-[11px]"
              title="Center camera on this node"
            >
              <span className="material-symbols-outlined text-[15px]">center_focus_strong</span>
              <span>Focus</span>
            </button>
            <button
              onClick={() => onSelectAsPathSource(node.id)}
              className="py-1.5 px-2 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/25 transition-colors font-medium flex items-center justify-center gap-1 text-[11px]"
              title="Set as source in Pathfinder tab"
            >
              <span className="material-symbols-outlined text-[15px]">alt_route</span>
              <span>Pathfinder</span>
            </button>
            <button
              onClick={() => onFilterNeighbors(node.id)}
              className="py-1.5 px-2 rounded-lg bg-purple-500/15 border border-purple-500/30 text-purple-300 hover:bg-purple-500/25 transition-colors font-medium flex items-center justify-center gap-1 text-[11px]"
              title="Isolate 1-hop ego network"
            >
              <span className="material-symbols-outlined text-[15px]">filter_center_focus</span>
              <span>Neighbors</span>
            </button>

            {onOpenDetail && (
              <button
                onClick={() => onOpenDetail(node)}
                className="col-span-3 py-1.5 px-2 rounded-lg bg-white/[0.06] hover:bg-white/[0.12] border border-white/10 text-cyan-300 hover:text-white transition-colors font-medium flex items-center justify-center gap-1.5 text-[11px]"
              >
                <span className="material-symbols-outlined text-[15px]">open_in_new</span>
                <span>Inspect in System Roster / Dossier</span>
              </button>
            )}
          </div>

          {/* Properties Table */}
          {node.properties && Object.keys(node.properties).length > 0 && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-[11px] font-mono text-gray-400 font-semibold uppercase tracking-wider">
                <span>Property Inspector</span>
                <span className="text-[10px] text-gray-500">
                  {Object.keys(node.properties).length} items
                </span>
              </div>
              <div className="bg-white/[0.03] border border-white/5 rounded-xl divide-y divide-white/5 overflow-hidden font-mono text-[11px]">
                {Object.entries(node.properties).map(([key, val]) => (
                  <div key={key} className="flex justify-between items-center px-3 py-1.5">
                    <span className="text-gray-400 capitalize">{key.replace(/_/g, ' ')}:</span>
                    <span className="text-gray-200 font-medium text-right truncate max-w-[190px]">
                      {typeof val === 'boolean' ? (val ? 'YES' : 'NO') : String(val)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Connected Neighbors List */}
          {neighborInfo.length > 0 && (
            <div className="space-y-1.5">
              <div className="text-[11px] font-mono text-gray-400 font-semibold uppercase tracking-wider">
                Connected Ties ({neighborInfo.length})
              </div>
              <div className="space-y-1 max-h-36 overflow-y-auto pr-1">
                {neighborInfo.map((n, idx) => (
                  <div
                    key={idx}
                    onClick={() => onFocusNode(n.id)}
                    className="p-1.5 rounded-lg bg-white/[0.02] hover:bg-white/[0.06] border border-white/5 flex items-center justify-between cursor-pointer transition-colors"
                  >
                    <div className="flex items-center gap-1.5 overflow-hidden">
                      <span className="text-[9px] font-mono px-1 rounded bg-white/10 text-gray-300">
                        {n.edgeType}
                      </span>
                      <span className="text-gray-300 text-[11px] truncate font-mono">
                        {n.id}
                      </span>
                    </div>
                    <span className="material-symbols-outlined text-[13px] text-gray-500">
                      arrow_forward
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
