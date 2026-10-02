import React, { useRef, useState, useEffect, useMemo } from 'react';
import { HierarchicalGraphData } from '../../api/client';
import { RenderableNode, NodeRenderer, FocusState } from './NodeRenderer';
import { EdgeRenderer, EdgeTypeKey } from './EdgeRenderer';
import { useHierarchicalLayout, LayoutMode } from './useHierarchicalLayout';

export interface ClassroomGraphProps {
  data: HierarchicalGraphData;
  activeLayer: number; // 0 = Institution, 1 = Section, 2 = Cluster, 3 = Student
  expandedClusterId: string | null;
  selectedNodeId: string | null;
  onSelectNode: (node: RenderableNode | null) => void;
  onSelectCluster: (clusterId: string | null) => void;
  onSelectSection?: (sectionCode: string) => void;
  enabledEdgeTypes: Set<EdgeTypeKey>;
  layoutMode: LayoutMode;
  searchFilter?: string;
  zoomScale: number;
  onZoomChange: (scale: number) => void;
}

export const ClassroomGraph: React.FC<ClassroomGraphProps> = ({
  data,
  activeLayer,
  expandedClusterId,
  selectedNodeId,
  onSelectNode,
  onSelectCluster,
  onSelectSection,
  enabledEdgeTypes,
  layoutMode,
  searchFilter = '',
  zoomScale,
  onZoomChange,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 900, height: 600 });
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [hoverTooltip, setHoverTooltip] = useState<{ x: number; y: number; node: RenderableNode } | null>(null);

  // Pan offsets
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef({ x: 0, y: 0 });

  const { computeLayout } = useHierarchicalLayout();

  // Resize observer to keep SVG responsive
  useEffect(() => {
    if (!containerRef.current) return;
    const updateDimensions = () => {
      if (containerRef.current) {
        setDimensions({
          width: containerRef.current.clientWidth || 900,
          height: containerRef.current.clientHeight || 600,
        });
      }
    };
    updateDimensions();
    const observer = new ResizeObserver(updateDimensions);
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // Compute Layout Positions
  const { nodes, edges } = useMemo(() => {
    return computeLayout(data, {
      width: dimensions.width,
      height: dimensions.height,
      expandedClusterId,
      focusedStudentId: selectedNodeId,
      layoutMode,
      showTeachers: true,
      showClubs: true,
      showSubjects: true,
    });
  }, [data, dimensions, expandedClusterId, selectedNodeId, layoutMode, computeLayout]);

  // Compute Neighbors of the focused/hovered node
  const activeFocusId = hoveredNodeId || selectedNodeId;
  const neighborIds = useMemo(() => {
    const set = new Set<string>();
    if (!activeFocusId) return set;

    edges.forEach((e) => {
      if (e.source === activeFocusId) set.add(e.target);
      if (e.target === activeFocusId) set.add(e.source);
    });
    return set;
  }, [activeFocusId, edges]);

  // Filter visible edges according to enabled types AND node visibility
  const visibleEdges = useMemo(() => {
    const visibleNodeIds = new Set<string>();
    nodes.forEach((n) => {
      if (n.kind !== 'student' || n.opacity > 0) {
        visibleNodeIds.add(n.id);
      }
    });

    return edges.filter((e) => {
      // Both endpoints must be visible
      if (!visibleNodeIds.has(e.source) || !visibleNodeIds.has(e.target)) {
        return false;
      }
      if (e.isAggregated) {
        // Show aggregated cross-cluster edge only when clusters are collapsed
        return enabledEdgeTypes.has('AGGREGATE_CROSS_CLUSTER') && !expandedClusterId;
      }
      return enabledEdgeTypes.has(e.type);
    });
  }, [edges, nodes, enabledEdgeTypes, expandedClusterId]);

  // Focus state for styling
  const focusState: FocusState = {
    selectedNodeId,
    hoveredNodeId,
    neighborIds,
    zoomLevel: zoomScale,
    currentLayer: activeLayer,
    expandedClusterId,
  };

  // ─── Mouse Interactions (Pan & Zoom) ───────────────────────────────────────
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return; // Only primary button
    isDraggingRef.current = true;
    dragStartRef.current = { x: e.clientX - panOffset.x, y: e.clientY - panOffset.y };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDraggingRef.current) {
      setPanOffset({
        x: e.clientX - dragStartRef.current.x,
        y: e.clientY - dragStartRef.current.y,
      });
    }
  };

  const handleMouseUp = () => {
    isDraggingRef.current = false;
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 1.12 : 0.89;
    const newZoom = Math.max(0.2, Math.min(2.8, zoomScale * zoomFactor));
    onZoomChange(Math.round(newZoom * 100) / 100);
  };

  // Node Click Handlers per Layer with full toggle support
  const handleNodeClick = (node: RenderableNode, e: React.MouseEvent) => {
    e.stopPropagation();

    if (node.kind === 'cluster') {
      // Toggle cluster expansion & selection
      if (expandedClusterId === node.id) {
        onSelectCluster(null);
        onSelectNode(null);
      } else {
        onSelectCluster(node.id);
        onSelectNode(node);
      }
    } else if (node.kind === 'student') {
      // Toggle student deep focus
      if (selectedNodeId === node.id) {
        onSelectNode(null);
      } else {
        onSelectNode(node);
      }
    } else if (node.kind === 'section') {
      if (selectedNodeId === node.id) {
        onSelectNode(null);
      } else {
        onSelectCluster(null);
        onSelectNode(node);
        if (onSelectSection && node.data?.code) {
          onSelectSection(node.data.code);
        }
      }
    } else {
      if (selectedNodeId === node.id) {
        onSelectNode(null);
      } else {
        onSelectNode(node);
      }
    }
  };

  return (
    <div
      ref={containerRef}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onWheel={handleWheel}
      className="w-full h-full relative overflow-hidden select-none bg-[#090d16] cursor-grab active:cursor-grabbing"
    >
      {/* Dynamic Background Micro-Dot Grid */}
      <div
        className="absolute inset-0 pointer-events-none opacity-20"
        style={{
          backgroundImage: 'radial-gradient(rgba(148, 163, 184, 0.4) 1px, transparent 1px)',
          backgroundSize: `${Math.max(16, 24 * zoomScale)}px ${Math.max(16, 24 * zoomScale)}px`,
          transform: `translate(${panOffset.x % 24}px, ${panOffset.y % 24}px)`,
        }}
      />

      {/* SVG Rendering Layer */}
      <svg
        className="w-full h-full absolute inset-0 pointer-events-auto"
        onClick={() => {
          if (selectedNodeId) {
            onSelectNode(null);
          } else if (expandedClusterId) {
            onSelectCluster(null);
          }
          setHoveredNodeId(null);
          setHoverTooltip(null);
        }}
      >
        <defs>
          {/* Arrowhead Markers for directional curved edges */}
          <marker
            id="arrow-default"
            viewBox="0 0 10 10"
            refX="20"
            refY="5"
            markerWidth="5"
            markerHeight="5"
            orient="auto"
          >
            <path d="M 0 1 L 9 5 L 0 9 z" fill="#64748b" />
          </marker>
          <marker
            id="arrow-friends"
            viewBox="0 0 10 10"
            refX="18"
            refY="5"
            markerWidth="5"
            markerHeight="5"
            orient="auto"
          >
            <path d="M 0 1 L 9 5 L 0 9 z" fill="#4ade80" />
          </marker>
          <marker
            id="arrow-bunks"
            viewBox="0 0 10 10"
            refX="18"
            refY="5"
            markerWidth="5"
            markerHeight="5"
            orient="auto"
          >
            <path d="M 0 1 L 9 5 L 0 9 z" fill="#ef4444" />
          </marker>
          <marker
            id="arrow-studies"
            viewBox="0 0 10 10"
            refX="18"
            refY="5"
            markerWidth="5"
            markerHeight="5"
            orient="auto"
          >
            <path d="M 0 1 L 9 5 L 0 9 z" fill="#3b82f6" />
          </marker>
          <marker
            id="arrow-tagged"
            viewBox="0 0 10 10"
            refX="18"
            refY="5"
            markerWidth="5"
            markerHeight="5"
            orient="auto"
          >
            <path d="M 0 1 L 9 5 L 0 9 z" fill="#f59e0b" />
          </marker>
        </defs>

        {/* Viewport Transform Group: Pan & Center-Based Zoom */}
        <g
          transform={`translate(${panOffset.x}, ${panOffset.y}) translate(${dimensions.width / 2}, ${dimensions.height / 2}) scale(${zoomScale}) translate(${-dimensions.width / 2}, ${-dimensions.height / 2})`}
          style={{ transition: isDraggingRef.current ? 'none' : 'transform 0.1s ease-out' }}
        >
          {/* ─── 1. Curved Quadratic Bezier Edges ──────────────────────────────── */}
          <g className="edges-group">
          {visibleEdges.map((edge) => {
            const opacity = EdgeRenderer.getEdgeOpacity(
              edge.source,
              edge.target,
              selectedNodeId,
              hoveredNodeId,
              neighborIds
            );
            const isDirectlyConnected =
              activeFocusId === edge.source || activeFocusId === edge.target;
            const strokeWidth = EdgeRenderer.getEdgeStrokeWidth(edge, isDirectlyConnected);
            const { path, midX, midY } = EdgeRenderer.calculateBezierPath(
              edge.sourceX,
              edge.sourceY,
              edge.targetX,
              edge.targetY,
              0.12
            );

            const markerId =
              edge.type === 'BUNKS_WITH'
                ? 'url(#arrow-bunks)'
                : edge.type === 'FRIENDS_WITH'
                ? 'url(#arrow-friends)'
                : edge.type === 'STUDIES_WITH'
                ? 'url(#arrow-studies)'
                : edge.type === 'TAGGED_AS'
                ? 'url(#arrow-tagged)'
                : 'url(#arrow-default)';

            return (
              <g key={edge.id}>
                <path
                  d={path}
                  fill="none"
                  stroke={edge.color}
                  strokeWidth={strokeWidth}
                  strokeOpacity={opacity}
                  strokeDasharray={edge.type === 'HIERARCHICAL' ? '4 3' : undefined}
                  markerEnd={edge.type !== 'AGGREGATE_CROSS_CLUSTER' ? markerId : undefined}
                  className="transition-opacity duration-200"
                />

                {/* Aggregated Edge Connection Badge */}
                {edge.isAggregated && edge.count && edge.count > 1 && (
                  <g
                    transform={`translate(${midX}, ${midY})`}
                    className="cursor-pointer"
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectCluster(edge.source);
                    }}
                  >
                    <rect
                      x="-38"
                      y="-10"
                      width="76"
                      height="20"
                      rx="10"
                      fill="#1e293b"
                      stroke="#94a3b8"
                      strokeWidth="1.2"
                      opacity={opacity}
                    />
                    <text
                      x="0"
                      y="3.5"
                      textAnchor="middle"
                      fill="#f1f5f9"
                      fontSize="9"
                      fontFamily="monospace"
                      fontWeight="bold"
                      opacity={opacity}
                    >
                      {edge.count} ties
                    </text>
                  </g>
                )}
              </g>
            );
          })}
        </g>

        {/* ─── 2. Node Elements & Badges ────────────────────────────────────── */}
        <g className="nodes-group">
          {nodes.map((node) => {
            // Hide students when their parent cluster is not expanded
            if (node.kind === 'student' && node.opacity === 0) {
              return null;
            }

            const isSelected = selectedNodeId === node.id;
            const isHovered = hoveredNodeId === node.id;
            const isNeighbor = neighborIds.has(node.id);
            const isMatchSearch = Boolean(
              searchFilter &&
                searchFilter.trim() &&
                (node.label.toLowerCase().includes(searchFilter.toLowerCase()) ||
                  node.id.toLowerCase().includes(searchFilter.toLowerCase()))
            );
            const focusStyle = NodeRenderer.getFocusStyle(node.id, focusState);
            const isBackgroundFaded = focusStyle.opacity < 0.3;

            const labelRule = NodeRenderer.shouldShowLabel(
              node.kind,
              zoomScale,
              isSelected || isHovered || isNeighbor || isMatchSearch,
              isBackgroundFaded
            );

            return (
              <g
                key={node.id}
                transform={`translate(${node.x}, ${node.y})`}
                onClick={(e) => handleNodeClick(node, e)}
                onMouseEnter={() => {
                  setHoveredNodeId(node.id);
                  setHoverTooltip({ x: node.x, y: node.y, node });
                }}
                onMouseLeave={() => {
                  setHoveredNodeId(null);
                  setHoverTooltip(null);
                }}
                className="cursor-pointer transition-opacity duration-200"
                style={{ opacity: isMatchSearch ? 1 : focusStyle.opacity }}
              >
                {/* Outer Glow Halo for Selected / Hovered / Search Match */}
                {(isSelected || isHovered || isMatchSearch) && (
                  <circle
                    r={node.radius + (isSelected ? 7 : isMatchSearch ? 6 : 5)}
                    fill="none"
                    stroke={isSelected ? '#facc15' : isMatchSearch ? '#38bdf8' : '#ffffff'}
                    strokeWidth={isSelected ? 3 : 2}
                    strokeOpacity={0.7}
                    strokeDasharray={isMatchSearch && !isSelected ? '4 3' : undefined}
                    className="animate-pulse"
                  />
                )}

                {/* Node Main Circle Body */}
                <circle
                  r={node.radius}
                  fill={node.color}
                  stroke={focusStyle.strokeColor || node.strokeColor}
                  strokeWidth={focusStyle.strokeWidth}
                />

                {/* Inside Node Icon / Initials */}
                {node.kind === 'section' && (
                  <text
                    textAnchor="middle"
                    dy="5"
                    fill="#f8fafc"
                    fontSize="13"
                    fontFamily="monospace"
                    fontWeight="extrabold"
                  >
                    {node.data?.code || 'SEC'}
                  </text>
                )}

                {node.kind === 'cluster' && (
                  <text
                    textAnchor="middle"
                    dy="4"
                    fill="#f8fafc"
                    fontSize={node.radius > 32 ? '13' : '11'}
                    fontFamily="monospace"
                    fontWeight="bold"
                  >
                    {node.data?.member_count || ''}
                  </text>
                )}

                {node.kind === 'student' && (
                  <text
                    textAnchor="middle"
                    dy="3.5"
                    fill="#f8fafc"
                    fontSize={node.radius > 11 ? '9' : '8'}
                    fontFamily="monospace"
                    fontWeight="bold"
                  >
                    {node.initials || 'ST'}
                  </text>
                )}

                {node.kind === 'teacher' && (
                  <text
                    textAnchor="middle"
                    dy="4"
                    fill="#93c5fd"
                    fontSize="10"
                    fontFamily="monospace"
                    fontWeight="bold"
                  >
                    FA
                  </text>
                )}

                {/* Risk Warning Badge for High Concern Students */}
                {node.hasRiskBadge && (
                  <g transform={`translate(${node.radius * 0.7}, ${-node.radius * 0.7})`}>
                    <circle r="5" fill="#ef4444" stroke="#ffffff" strokeWidth="1" />
                    <text
                      textAnchor="middle"
                      dy="2.5"
                      fill="#ffffff"
                      fontSize="6"
                      fontWeight="bold"
                    >
                      !
                    </text>
                  </g>
                )}

                {/* Cluster Count Expand Badge */}
                {node.kind === 'cluster' && (
                  <g transform={`translate(0, ${node.radius + 12})`}>
                    <rect
                      x="-34"
                      y="-7"
                      width="68"
                      height="16"
                      rx="8"
                      fill="#0f172a"
                      stroke={node.strokeColor}
                      strokeWidth="0.8"
                    />
                    <text
                      textAnchor="middle"
                      dy="3.5"
                      fill="#e2e8f0"
                      fontSize="8"
                      fontFamily="monospace"
                      fontWeight="bold"
                    >
                      {expandedClusterId === node.id ? 'Close ✕' : 'Click to open'}
                    </text>
                  </g>
                )}

                {/* Semantic Labels below Node (or above if cluster expanded) */}
                {labelRule.show && (
                  <g
                    transform={`translate(0, ${
                      node.kind === 'cluster' && expandedClusterId === node.id
                        ? -(node.radius + 14)
                        : node.radius + (node.kind === 'cluster' ? 24 : 14)
                    })`}
                  >
                    <text
                      textAnchor="middle"
                      fill="#f8fafc"
                      fontSize="10"
                      fontFamily="monospace"
                      fontWeight={isSelected ? 'bold' : 'normal'}
                      className="drop-shadow-md select-none"
                    >
                      {labelRule.detailLevel === 'initials' && node.subLabel
                        ? node.subLabel
                        : node.label}
                    </text>
                    {labelRule.detailLevel === 'full' && node.subLabel && (
                      <text
                        y="11"
                        textAnchor="middle"
                        fill="#94a3b8"
                        fontSize="8.5"
                        fontFamily="sans-serif"
                        className="select-none"
                      >
                        {node.subLabel}
                      </text>
                    )}
                  </g>
                )}
              </g>
            );
          })}
        </g>
        </g>
      </svg>

      {/* Floating Hover Tooltip (Interactive Focus Preview) */}
      {hoverTooltip && (
        <div
          className="absolute pointer-events-none z-30 px-3 py-2 rounded-xl bg-surface-container-lowest/95 backdrop-blur-xl border border-outline-variant shadow-xl text-xs font-sans max-w-xs transition-opacity duration-150"
          style={{
            left: `${Math.min(dimensions.width - 240, Math.max(10, (hoverTooltip.x - dimensions.width / 2) * zoomScale + dimensions.width / 2 + panOffset.x + 15))}px`,
            top: `${Math.min(dimensions.height - 130, Math.max(10, (hoverTooltip.y - dimensions.height / 2) * zoomScale + dimensions.height / 2 + panOffset.y - 15))}px`,
          }}
        >
          <div className="flex items-center gap-2 mb-1">
            <span
              className="w-2.5 h-2.5 rounded-full shrink-0"
              style={{ backgroundColor: hoverTooltip.node.strokeColor }}
            />
            <span className="font-bold text-on-surface truncate">
              {hoverTooltip.node.label}
            </span>
            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-surface-container text-on-surface-variant uppercase ml-auto">
              {hoverTooltip.node.kind}
            </span>
          </div>
          {hoverTooltip.node.subLabel && (
            <p className="text-[11px] text-on-surface-variant font-mono mb-1">
              {hoverTooltip.node.subLabel}
            </p>
          )}
          {hoverTooltip.node.data?.dominant_classification && (
            <p className="text-[10px] text-primary font-mono mt-1 pt-1 border-t border-outline-variant/50">
              {hoverTooltip.node.data.dominant_classification}
            </p>
          )}
          {hoverTooltip.node.data?.role && (
            <p className="text-[10px] text-on-surface-variant/80 mt-0.5">
              Role: {hoverTooltip.node.data.role}
            </p>
          )}
        </div>
      )}

      {/* Navigation Helper Indicator in Canvas Corner */}
      <div className="absolute bottom-3 left-3 pointer-events-none text-[10px] font-mono text-on-surface-variant/70 bg-surface-container-lowest/80 px-2 py-1 rounded-md border border-outline-variant/40 flex items-center gap-2">
        <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
        <span>Drag to pan · Scroll to semantic zoom · Click cluster to expand</span>
      </div>
    </div>
  );
};
