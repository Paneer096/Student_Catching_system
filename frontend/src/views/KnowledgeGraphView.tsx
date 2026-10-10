import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { api } from '../api/client';
import { DOMAIN_PRESETS, DomainPreset } from '../components/knowledge-graph/domainPresets';
import {
  KnowledgeGraphCanvas,
  KnowledgeGraphCanvasRef,
  CanvasNode,
  CanvasEdge,
} from '../components/knowledge-graph/KnowledgeGraphCanvas';
import { FloatingNodeHud } from '../components/knowledge-graph/FloatingNodeHud';
import { OperationsSidebar } from '../components/knowledge-graph/OperationsSidebar';
import { TopTacticalBar } from '../components/knowledge-graph/TopTacticalBar';
import { CanvasToolDock } from '../components/knowledge-graph/CanvasToolDock';

export interface KnowledgeGraphViewProps {
  onNavigate: (viewId: string, params?: any) => void;
  activeSection?: string;
  onSelectStudent?: (studentId: string) => void;
  initialStudentId?: string;
}

export const KnowledgeGraphView: React.FC<KnowledgeGraphViewProps> = ({
  onNavigate,
  activeSection = 'CS-3B',
  onSelectStudent,
  initialStudentId,
}) => {
  const canvasRef = useRef<KnowledgeGraphCanvasRef>(null);

  // Active Domain Preset
  const [activeDomain, setActiveDomain] = useState<DomainPreset>(DOMAIN_PRESETS.academic);
  const [currentSection, setCurrentSection] = useState<string>(activeSection);

  // Graph Data State
  const [rawNodes, setRawNodes] = useState<CanvasNode[]>([]);
  const [rawEdges, setRawEdges] = useState<CanvasEdge[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Interaction State
  const [selectedNode, setSelectedNode] = useState<CanvasNode | null>(null);
  const [hoveredNode, setHoveredNode] = useState<CanvasNode | null>(null);
  const [isPinned, setIsPinned] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Auto-focus initial student if passed from dashboard or roster
  useEffect(() => {
    if (!initialStudentId || rawNodes.length === 0) return;
    const target = rawNodes.find(
      (n) =>
        n.id === initialStudentId ||
        n.properties?.roll_no === initialStudentId ||
        n.label?.toLowerCase().includes(initialStudentId.toLowerCase())
    );
    if (target) {
      setSelectedNode(target);
      setTimeout(() => {
        canvasRef.current?.focusNode(target.id);
      }, 250);
    }
  }, [initialStudentId, rawNodes]);

  // Visualization & Layout Controls
  const [layoutMode, setLayoutMode] = useState<'force' | 'hierarchical' | 'radial'>('force');
  const [isPhysicsPaused, setIsPhysicsPaused] = useState<boolean>(false);
  const [isParticlesEnabled, setIsParticlesEnabled] = useState<boolean>(true);

  // Neat Graph & Edge Filtering Controls
  const [neatMode, setNeatMode] = useState<boolean>(true);
  const [minCoabsenceWeight, setMinCoabsenceWeight] = useState<number>(3);
  const [enabledEdgeTypes, setEnabledEdgeTypes] = useState<Set<string>>(
    () => new Set(DOMAIN_PRESETS.academic.edgeTypes)
  );

  // Entity Type Filtering
  const [enabledNodeTypes, setEnabledNodeTypes] = useState<Set<string>>(
    () => new Set(Object.keys(DOMAIN_PRESETS.academic.nodeTypes))
  );

  // Pathfinder State
  const [pathSource, setPathSource] = useState<string>('');
  const [pathTarget, setPathTarget] = useState<string>('');
  const [highlightedPath, setHighlightedPath] = useState<{ nodes: string[]; edges: any[] } | null>(null);
  const [pathError, setPathError] = useState<string | null>(null);

  // Timeline State
  const [timelineVal, setTimelineVal] = useState<number>(Date.now());
  const [isTimelinePlaying, setIsTimelinePlaying] = useState<boolean>(false);

  // Load Graph Data based on active domain & section
  const loadDomainData = useCallback(async (preset: DomainPreset, sectionCode: string) => {
    setLoading(true);
    setSelectedNode(null);
    setHoveredNode(null);
    setHighlightedPath(null);
    setPathError(null);

    // Initialize enabled node and edge types for this preset
    setEnabledNodeTypes(new Set(Object.keys(preset.nodeTypes)));
    setEnabledEdgeTypes(new Set(preset.edgeTypes));

    if (preset.id === 'academic') {
      try {
        // Fetch live from FastAPI backend with NetworkX metrics and neat threshold
        const liveData = await api.getKnowledgeGraphData(sectionCode, minCoabsenceWeight, neatMode);
        if (liveData && liveData.nodes && liveData.nodes.length > 0) {
          const liveNodeIds = new Set(liveData.nodes.map((n) => n.id));
          const liveStudentCount = liveData.nodes.filter((n) => n.type === 'Student').length;

          // Avoid ghost duplicate students from presets if live students already exist
          const extraNodes = preset.nodes.filter((n) => {
            if (liveStudentCount > 0 && n.type === 'Student') return false;
            return !liveNodeIds.has(n.id);
          });
          const allNodes = [...liveData.nodes, ...extraNodes];
          const allNodeIdSet = new Set(allNodes.map((n) => n.id));

          // Index live students by roll number for re-mapping preset edges
          const rollToLiveId = new Map<string, string>();
          liveData.nodes.forEach((n) => {
            const roll = n.properties?.roll_no || (n.label?.match(/\(([^)]+)\)/)?.[1]) || n.id;
            if (roll) {
              const cleaned = roll.trim().toUpperCase();
              rollToLiveId.set(cleaned, n.id);
              const m = cleaned.match(/\d+$/);
              if (m) rollToLiveId.set(m[0], n.id);
            }
          });

          const liveEdges = (liveData.edges || []).filter(
            (e) => allNodeIdSet.has(String(e.source)) && allNodeIdSet.has(String(e.target))
          );

          // Remap preset relational ties (e.g. course enrollment, club memberships, mentorships)
          const mappedExtraEdges: CanvasEdge[] = [];
          preset.edges.forEach((e) => {
            let src = e.source;
            let tgt = e.target;
            if (src.startsWith('stu-')) {
              const suffix = src.replace('stu-', '');
              const liveId = rollToLiveId.get(`21CSB${suffix}`) || rollToLiveId.get(suffix);
              if (liveId) src = liveId;
            }
            if (tgt.startsWith('stu-')) {
              const suffix = tgt.replace('stu-', '');
              const liveId = rollToLiveId.get(`21CSB${suffix}`) || rollToLiveId.get(suffix);
              if (liveId) tgt = liveId;
            }
            if (allNodeIdSet.has(src) && allNodeIdSet.has(tgt)) {
              mappedExtraEdges.push({ ...e, source: src, target: tgt });
            }
          });

          setRawNodes(allNodes);
          setRawEdges([...liveEdges, ...mappedExtraEdges]);
          setLoading(false);
          return;
        }
      } catch (err) {
        console.warn('Backend live graph load notice (using rich preset fallback):', err);
      }
    }

    // Default to domain preset data
    setRawNodes(preset.nodes);
    setRawEdges(preset.edges);
    setLoading(false);
  }, [minCoabsenceWeight, neatMode]);

  useEffect(() => {
    loadDomainData(activeDomain, currentSection);
  }, [activeDomain, currentSection, loadDomainData]);

  // Compute Timeline timestamps
  const timelineRange = useMemo(() => {
    if (rawEdges.length === 0) return null;
    let minTime = Infinity;
    let maxTime = -Infinity;

    rawEdges.forEach((e) => {
      if (e.timestamp) {
        const t = new Date(e.timestamp).getTime();
        if (!isNaN(t)) {
          if (t < minTime) minTime = t;
          if (t > maxTime) maxTime = t;
        }
      }
    });

    if (minTime === Infinity || maxTime === -Infinity || minTime === maxTime) {
      const now = Date.now();
      return { min: now - 30 * 86400000, max: now, current: timelineVal };
    }

    return { min: minTime, max: maxTime, current: Math.min(maxTime, Math.max(minTime, timelineVal)) };
  }, [rawEdges, timelineVal]);

  // Timeline animation player
  useEffect(() => {
    if (!isTimelinePlaying || !timelineRange) return;
    const step = (timelineRange.max - timelineRange.min) / 40;
    const interval = setInterval(() => {
      setTimelineVal((prev) => {
        const next = prev + step;
        if (next >= timelineRange.max) {
          setIsTimelinePlaying(false);
          return timelineRange.max;
        }
        return next;
      });
    }, 450);

    return () => clearInterval(interval);
  }, [isTimelinePlaying, timelineRange]);

  // Filtered Nodes & Edges based on Entity Types, Edge Types & Timeline
  const filteredData = useMemo(() => {
    const activeNodes = rawNodes.filter((n) => enabledNodeTypes.has(n.type));
    const activeNodeIdSet = new Set(activeNodes.map((n) => n.id));

    const activeEdges = rawEdges.filter((e) => {
      const srcId = String(typeof e.source === 'object' ? e.source.id : e.source);
      const tgtId = String(typeof e.target === 'object' ? e.target.id : e.target);
      if (!activeNodeIdSet.has(srcId) || !activeNodeIdSet.has(tgtId)) return false;

      // Filter by edge type
      const isCoabsence = e.type === 'BUNKS_WITH' || e.type === 'CO_ABSENT' || e.type === 'coabsence';
      if (isCoabsence) {
        if (!enabledEdgeTypes.has('BUNKS_WITH') && !enabledEdgeTypes.has('CO_ABSENT')) {
          return false;
        }
        const weight = e.weight ?? 1;
        if (weight < minCoabsenceWeight) {
          return false;
        }
        if (neatMode && weight < 3) {
          return false;
        }
      } else {
        if (enabledEdgeTypes.size > 0 && !enabledEdgeTypes.has(e.type)) {
          return false;
        }
      }

      // Filter by timeline timestamp if valid
      if (timelineRange && e.timestamp) {
        const edgeTime = new Date(e.timestamp).getTime();
        if (!isNaN(edgeTime) && edgeTime > timelineRange.current) {
          return false;
        }
      }
      return true;
    });

    // Compute degrees for active nodes
    const degreeMap: Record<string, number> = {};
    activeEdges.forEach((e) => {
      const srcId = String(typeof e.source === 'object' ? e.source.id : e.source);
      const tgtId = String(typeof e.target === 'object' ? e.target.id : e.target);
      degreeMap[srcId] = (degreeMap[srcId] || 0) + 1;
      degreeMap[tgtId] = (degreeMap[tgtId] || 0) + 1;
    });

    const enrichedNodes = activeNodes.map((n) => ({
      ...n,
      degree: degreeMap[n.id] || 0,
    }));

    return { nodes: enrichedNodes, edges: activeEdges };
  }, [rawNodes, rawEdges, enabledNodeTypes, enabledEdgeTypes, minCoabsenceWeight, neatMode, timelineRange]);

  const prunedEdgeCount = useMemo(() => {
    return Math.max(0, rawEdges.length - filteredData.edges.length);
  }, [rawEdges.length, filteredData.edges.length]);

  // Shortest Path Calculation (Dijkstra / BFS with Backend or Client Fallback)
  const handleCalculatePath = async (sourceId: string, targetId: string) => {
    setPathError(null);
    if (!sourceId || !targetId || sourceId === targetId) return;

    // 1. Try FastAPI backend shortest-path endpoint first if in academic mode
    if (activeDomain.id === 'academic') {
      try {
        const res = await api.getKnowledgeGraphShortestPath(sourceId, targetId, currentSection);
        if (res && res.found && res.nodes.length > 0) {
          setHighlightedPath({ nodes: res.nodes, edges: res.edges });
          return;
        }
      } catch {
        // Fallback to client-side graph algorithm
      }
    }

    // 2. Client-side BFS shortest path algorithm
    const adj = new Map<string, Array<{ neighbor: string; edge: CanvasEdge }>>();
    filteredData.edges.forEach((e) => {
      const u = String(typeof e.source === 'object' ? e.source.id : e.source);
      const v = String(typeof e.target === 'object' ? e.target.id : e.target);
      if (!adj.has(u)) adj.set(u, []);
      if (!adj.has(v)) adj.set(v, []);
      adj.get(u)!.push({ neighbor: v, edge: e });
      adj.get(v)!.push({ neighbor: u, edge: e });
    });

    const queue: string[] = [sourceId];
    const visited = new Set<string>([sourceId]);
    const parent = new Map<string, { prev: string; edge: CanvasEdge }>();

    let found = false;
    while (queue.length > 0) {
      const curr = queue.shift()!;
      if (curr === targetId) {
        found = true;
        break;
      }
      const neighbors = adj.get(curr) || [];
      for (const { neighbor, edge } of neighbors) {
        if (!visited.has(neighbor)) {
          visited.add(neighbor);
          parent.set(neighbor, { prev: curr, edge });
          queue.push(neighbor);
        }
      }
    }

    if (!found) {
      setPathError('No path exists between these two entities in the current network.');
      setHighlightedPath(null);
      return;
    }

    // Reconstruct path
    const pathNodes: string[] = [];
    const pathEdges: CanvasEdge[] = [];
    let curr = targetId;
    while (curr !== sourceId) {
      pathNodes.unshift(curr);
      const step = parent.get(curr)!;
      pathEdges.unshift(step.edge);
      curr = step.prev;
    }
    pathNodes.unshift(sourceId);

    setHighlightedPath({ nodes: pathNodes, edges: pathEdges });
  };

  // Node Injection handler
  const handleInjectNode = async (newNode: {
    id: string;
    label: string;
    type: string;
    properties?: Record<string, any>;
  }) => {
    const nodeObj: CanvasNode = {
      id: newNode.id,
      label: newNode.label,
      type: newNode.type,
      community: 1,
      pagerank: 0.05,
      degree: 0,
      properties: newNode.properties || {},
      color: activeDomain.nodeTypes[newNode.type]?.color || '#00b4ff',
    };

    setRawNodes((prev) => [nodeObj, ...prev]);

    // Persist to backend if possible
    if (activeDomain.id === 'academic') {
      try {
        await api.createKnowledgeGraphNode({
          id: newNode.id,
          label: newNode.label,
          type: newNode.type,
          properties: newNode.properties,
        });
      } catch (e) {
        console.warn('Backend node injection notice:', e);
      }
    }
  };

  // Edge Injection handler
  const handleInjectEdge = async (newEdge: {
    source: string;
    target: string;
    type: string;
    weight?: number;
  }) => {
    const edgeObj: CanvasEdge = {
      source: newEdge.source,
      target: newEdge.target,
      type: newEdge.type,
      weight: newEdge.weight || 1.0,
      timestamp: new Date().toISOString(),
      properties: { weight: newEdge.weight || 1.0 },
    };

    setRawEdges((prev) => [edgeObj, ...prev]);

    // Persist to backend if possible
    if (activeDomain.id === 'academic') {
      try {
        await api.createKnowledgeGraphEdge({
          source: newEdge.source,
          target: newEdge.target,
          type: newEdge.type,
          weight: newEdge.weight,
        });
      } catch (e) {
        console.warn('Backend edge injection notice:', e);
      }
    }
  };

  // Ego network / Neighbor filter
  const handleFilterNeighbors = (nodeId: string) => {
    const neighborSet = new Set<string>([nodeId]);
    rawEdges.forEach((e) => {
      const u = String(typeof e.source === 'object' ? e.source.id : e.source);
      const v = String(typeof e.target === 'object' ? e.target.id : e.target);
      if (u === nodeId) neighborSet.add(v);
      if (v === nodeId) neighborSet.add(u);
    });

    setRawNodes((prev) => prev.filter((n) => neighborSet.has(n.id)));
  };

  // Node selection logic
  const handleSelectNode = (node: CanvasNode | null) => {
    setSelectedNode(node);
    if (node && onSelectStudent && node.type === 'Student') {
      const roll = node.properties?.roll_no || node.id;
      onSelectStudent(roll);
    }
  };

  const hudTargetNode = isPinned ? selectedNode : (hoveredNode || selectedNode);

  return (
    <div className="w-full h-[calc(100vh-64px)] -m-6 relative flex flex-col overflow-hidden bg-[#070709] text-white">
      {/* ── Top Tactical Header Bar ── */}
      <TopTacticalBar
        nodeCount={filteredData.nodes.length}
        edgeCount={filteredData.edges.length}
        activeDomain={activeDomain}
        onSelectDomain={(preset) => {
          setActiveDomain(preset);
        }}
        activeSection={currentSection}
        onSectionChange={setCurrentSection}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        nodes={filteredData.nodes}
        onSelectNode={handleSelectNode}
        onFocusNode={(nodeId) => canvasRef.current?.focusNode(nodeId)}
        neatMode={neatMode}
        onToggleNeatMode={() => setNeatMode((prev) => !prev)}
      />

      {/* ── Main Canvas Viewport ── */}
      <div className="flex-1 relative overflow-hidden">
        {loading ? (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-[#070709] text-cyan-400 gap-3">
            <div className="w-10 h-10 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
            <span className="font-mono text-xs uppercase tracking-widest text-gray-300">
              SYNCHRONIZING GRAPH ENGINE...
            </span>
          </div>
        ) : (
          <KnowledgeGraphCanvas
            ref={canvasRef}
            nodes={filteredData.nodes}
            edges={filteredData.edges}
            nodeTypesMap={activeDomain.nodeTypes}
            selectedNode={selectedNode}
            onSelectNode={handleSelectNode}
            hoveredNode={hoveredNode}
            onHoverNode={(node) => {
              if (!isPinned) setHoveredNode(node);
            }}
            searchQuery={searchQuery}
            highlightedPath={highlightedPath}
            layoutMode={layoutMode}
            isPhysicsPaused={isPhysicsPaused}
            isParticlesEnabled={isParticlesEnabled}
          />
        )}

        {/* ── Floating Draggable Node Summary HUD Card ── */}
        <FloatingNodeHud
          node={hudTargetNode}
          edges={filteredData.edges}
          nodeTypesMap={activeDomain.nodeTypes}
          isPinned={isPinned}
          onTogglePin={() => setIsPinned((prev) => !prev)}
          onClose={() => {
            setSelectedNode(null);
            setHoveredNode(null);
            setIsPinned(false);
          }}
          onFocusNode={(nodeId) => canvasRef.current?.focusNode(nodeId)}
          onSelectAsPathSource={(nodeId) => {
            setPathSource(nodeId);
          }}
          onFilterNeighbors={handleFilterNeighbors}
          onOpenDetail={(targetNode) => {
            if (targetNode.type === 'Student') {
              const roll = targetNode.properties?.roll_no || targetNode.id;
              onNavigate('students', { studentId: roll });
            } else {
              canvasRef.current?.focusNode(targetNode.id);
            }
          }}
        />

        {/* ── Left Tactical Operations Sidebar ── */}
        <OperationsSidebar
          nodes={filteredData.nodes}
          edges={filteredData.edges}
          nodeTypesMap={activeDomain.nodeTypes}
          edgeTypesList={activeDomain.edgeTypes}
          enabledNodeTypes={enabledNodeTypes}
          onToggleNodeType={(type) => {
            setEnabledNodeTypes((prev) => {
              const next = new Set(prev);
              if (next.has(type)) next.delete(type);
              else next.add(type);
              return next;
            });
          }}
          onSelectAllNodeTypes={() => {
            setEnabledNodeTypes(new Set(Object.keys(activeDomain.nodeTypes)));
          }}
          onClearAllNodeTypes={() => {
            setEnabledNodeTypes(new Set());
          }}
          neatMode={neatMode}
          onToggleNeatMode={() => setNeatMode((prev) => !prev)}
          minCoabsenceWeight={minCoabsenceWeight}
          onMinCoabsenceWeightChange={setMinCoabsenceWeight}
          enabledEdgeTypes={enabledEdgeTypes}
          onToggleEdgeType={(type) => {
            setEnabledEdgeTypes((prev) => {
              const next = new Set(prev);
              if (next.has(type)) next.delete(type);
              else next.add(type);
              return next;
            });
          }}
          onSelectAllEdgeTypes={() => {
            setEnabledEdgeTypes(new Set(activeDomain.edgeTypes));
          }}
          onClearAllEdgeTypes={() => {
            setEnabledEdgeTypes(new Set());
          }}
          prunedEdgeCount={prunedEdgeCount}
          pathSource={pathSource}
          onSetPathSource={setPathSource}
          pathTarget={pathTarget}
          onSetPathTarget={setPathTarget}
          onCalculatePath={handleCalculatePath}
          highlightedPath={highlightedPath}
          onClearPath={() => setHighlightedPath(null)}
          pathError={pathError}
          onInjectNode={handleInjectNode}
          onInjectEdge={handleInjectEdge}
          timelineRange={timelineRange}
          onTimelineChange={setTimelineVal}
          isTimelinePlaying={isTimelinePlaying}
          onToggleTimelinePlay={() => setIsTimelinePlaying((prev) => !prev)}
        />

        {/* ── Floating Canvas Tool Controls Dock ── */}
        <CanvasToolDock
          onZoomIn={() => canvasRef.current?.zoomIn()}
          onZoomOut={() => canvasRef.current?.zoomOut()}
          onZoomToFit={() => canvasRef.current?.zoomToFit()}
          isPhysicsPaused={isPhysicsPaused}
          onTogglePhysics={() => setIsPhysicsPaused((prev) => !prev)}
          isParticlesEnabled={isParticlesEnabled}
          onToggleParticles={() => setIsParticlesEnabled((prev) => !prev)}
          layoutMode={layoutMode}
          onLayoutModeChange={setLayoutMode}
          onExportImage={() => canvasRef.current?.exportImage()}
          onExportJson={() => canvasRef.current?.exportJson()}
        />
      </div>
    </div>
  );
};
