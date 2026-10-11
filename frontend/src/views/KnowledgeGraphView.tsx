import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  api,
  BunkGraphPayload,
  BunkGraphEdge,
  PairEvidenceData,
  StudentRosterItem,
} from '../api/client';
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
import {
  X,
  Ban,
  AlertTriangle,
  RefreshCw,
  Sparkles,
} from 'lucide-react';

export interface KnowledgeGraphViewProps {
  onNavigate: (viewId: string, params?: any) => void;
  activeSection?: string;
  onSelectStudent?: (studentId: string) => void;
  initialStudentId?: string;
}

const GROUP_PALETTE = [
  '#f97316', // Orange / Amber
  '#06b6d4', // Cyan
  '#a855f7', // Purple
  '#10b981', // Emerald
  '#ec4899', // Pink
  '#eab308', // Yellow
  '#3b82f6', // Blue
];

export const KnowledgeGraphView: React.FC<KnowledgeGraphViewProps> = ({
  onNavigate,
  activeSection = 'CS-3B',
  onSelectStudent,
  initialStudentId,
}) => {
  const canvasRef = useRef<KnowledgeGraphCanvasRef>(null);

  // Active Domain Preset (Classroom & Academic Intelligence)
  const activeDomain: DomainPreset = DOMAIN_PRESETS.academic;

  // Section & Mode State
  const [currentSection, setCurrentSection] = useState<string>(activeSection);
  const [showWholeClass, setShowWholeClass] = useState<boolean>(false);
  const [neatMode, setNeatMode] = useState<boolean>(true);
  const [sensitivity, setSensitivity] = useState<'strict' | 'balanced' | 'exploratory'>('strict');
  const [selectedOverlays, setSelectedOverlays] = useState<string[]>([]);
  const [anonymizeNames, setAnonymizeNames] = useState<boolean>(false);
  const [includeDismissed, setIncludeDismissed] = useState<boolean>(false);
  const [subjectFilter, setSubjectFilter] = useState<string>('');
  const [minCoabsenceWeight, setMinCoabsenceWeight] = useState<number>(3);

  // Node & Edge filtering from domain
  const [enabledNodeTypes, setEnabledNodeTypes] = useState<Set<string>>(
    () => new Set(Object.keys(DOMAIN_PRESETS.academic.nodeTypes))
  );
  const [enabledEdgeTypes, setEnabledEdgeTypes] = useState<Set<string>>(
    () => new Set(DOMAIN_PRESETS.academic.edgeTypes)
  );

  // Layout & Simulation State
  const [layoutMode, setLayoutMode] = useState<'force' | 'hierarchical' | 'radial'>('force');
  const [isPhysicsPaused, setIsPhysicsPaused] = useState<boolean>(false);
  const [isParticlesEnabled, setIsParticlesEnabled] = useState<boolean>(true);

  // Search & Navigation
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Graph Data from Engine & Section Roster
  const [payload, setPayload] = useState<BunkGraphPayload | null>(null);
  const [rosterStudents, setRosterStudents] = useState<StudentRosterItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Interaction & HUD State
  const [selectedNode, setSelectedNode] = useState<CanvasNode | null>(null);
  const [hoveredNode, setHoveredNode] = useState<CanvasNode | null>(null);
  const [isPinned, setIsPinned] = useState<boolean>(false);
  const [selectedEdge, setSelectedEdge] = useState<BunkGraphEdge | null>(null);

  // Evidence Drawer State
  const [evidenceData, setEvidenceData] = useState<PairEvidenceData | null>(null);
  const [evidenceLoading, setEvidenceLoading] = useState<boolean>(false);
  const [dismissReason, setDismissReason] = useState<string>('Same bus / transport problem');
  const [isDismissing, setIsDismissing] = useState<boolean>(false);

  // Pathfinder State
  const [pathSource, setPathSource] = useState<string>('');
  const [pathTarget, setPathTarget] = useState<string>('');
  const [highlightedPath, setHighlightedPath] = useState<{ nodes: string[]; edges: any[] } | null>(null);
  const [pathError, setPathError] = useState<string | null>(null);

  // Timeline State
  const [timelineVal, setTimelineVal] = useState<number>(Date.now());
  const [isTimelinePlaying, setIsTimelinePlaying] = useState<boolean>(false);

  // Fetch Graph Data + Section Roster
  const loadData = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);
    setSelectedEdge(null);
    setEvidenceData(null);
    setHighlightedPath(null);

    try {
      const [graphRes, rosterRes] = await Promise.all([
        api.getBunkGraph(currentSection, {
          sensitivity,
          subject: subjectFilter.trim() || undefined,
          overlays: selectedOverlays.length > 0 ? selectedOverlays : undefined,
          include_dismissed: includeDismissed,
        }),
        api.getStudentsRoster(currentSection).catch((err) => {
          console.warn('Roster fetch warning (will proceed with graph data):', err);
          return [] as StudentRosterItem[];
        }),
      ]);

      setPayload(graphRes);
      setRosterStudents(rosterRes || []);

      if (graphRes.status !== 'OK') {
        setErrorMsg(graphRes.message || `Engine status: ${graphRes.status}`);
      }
    } catch (err: any) {
      console.error('Failed to load bunk graph data:', err);
      setErrorMsg(err?.message || 'Failed to connect to Connection Engine');
      setPayload(null);
    } finally {
      setLoading(false);
    }
  }, [
    currentSection,
    sensitivity,
    subjectFilter,
    selectedOverlays,
    includeDismissed,
  ]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Compute Active Canvas Nodes
  const canvasNodes: CanvasNode[] = useMemo(() => {
    if (!payload) return [];

    const tiedMap = new Map<string, any>();
    (payload.nodes || []).forEach((n) => {
      tiedMap.set(n.roll_no.toUpperCase(), n);
    });

    const untiedMap = new Map<string, any>();
    (payload.students_without_ties || []).forEach((s) => {
      untiedMap.set(s.roll_no.toUpperCase(), s);
    });

    // If SHOW WHOLE CLASS is toggled ON:
    if (showWholeClass) {
      // Build nodes for EVERY student in the class roster
      const allClassStudents: CanvasNode[] = [];
      const seenRolls = new Set<string>();

      // 1. Process all students from the section roster
      rosterStudents.forEach((st) => {
        const rollKey = st.roll_no.toUpperCase();
        seenRolls.add(rollKey);

        const tied = tiedMap.get(rollKey);
        if (tied) {
          // Tied bunk partner
          allClassStudents.push({
            id: tied.roll_no,
            label: tied.name || tied.roll_no,
            roll_no: tied.roll_no,
            type: 'Student',
            bunk_rate: tied.bunk_rate,
            bunk_cells: tied.bunk_cells,
            eligible_cells: tied.eligible_cells,
            n_ties: tied.n_ties,
            group_id: tied.group_id,
            community: tied.group_id ?? 1,
            color:
              tied.group_id !== null && tied.group_id !== undefined
                ? GROUP_PALETTE[tied.group_id % GROUP_PALETTE.length]
                : '#00b4ff',
            properties: {
              roll_no: tied.roll_no,
              name: tied.name,
              bunk_rate: `${(tied.bunk_rate * 100).toFixed(1)}%`,
              bunk_cells: tied.bunk_cells,
              eligible_cells: tied.eligible_cells,
              ties: tied.n_ties,
              group: tied.group_id !== null ? `Group #${tied.group_id}` : 'Solo',
              attendance: `${st.attendance_pct ?? 85}%`,
              status: 'Validated Bunk Partner',
            },
          });
        } else {
          // Untied student in the class
          const solo = untiedMap.get(rollKey);
          const attPct = st.attendance_pct ?? 92;
          const bunkRate = solo
            ? Math.max(0.04, solo.bunk_cells / 60)
            : Math.max(0.02, (100 - attPct) / 100);

          allClassStudents.push({
            id: st.roll_no,
            label: st.name || st.roll_no,
            roll_no: st.roll_no,
            type: 'Student',
            bunk_rate: bunkRate,
            bunk_cells: solo?.bunk_cells ?? 0,
            eligible_cells: 60,
            n_ties: 0,
            group_id: null,
            community: 0,
            color: '#475569', // Slate-gray for untied students
            properties: {
              roll_no: st.roll_no,
              name: st.name,
              attendance: `${attPct}%`,
              role: st.role || 'Student',
              status: solo
                ? `Solo Absentee (${solo.bunk_cells} skips, No Partner Ties)`
                : 'Regular Classmate (No Bunk Ties)',
              bunk_cells: solo?.bunk_cells ?? 0,
              ties: 0,
            },
          });
        }
      });

      // 2. Include any tied student that might not have been in the roster array
      (payload.nodes || []).forEach((tied) => {
        if (!seenRolls.has(tied.roll_no.toUpperCase())) {
          allClassStudents.push({
            id: tied.roll_no,
            label: tied.name || tied.roll_no,
            roll_no: tied.roll_no,
            type: 'Student',
            bunk_rate: tied.bunk_rate,
            bunk_cells: tied.bunk_cells,
            eligible_cells: tied.eligible_cells,
            n_ties: tied.n_ties,
            group_id: tied.group_id,
            community: tied.group_id ?? 1,
            color:
              tied.group_id !== null && tied.group_id !== undefined
                ? GROUP_PALETTE[tied.group_id % GROUP_PALETTE.length]
                : '#00b4ff',
            properties: {
              roll_no: tied.roll_no,
              name: tied.name,
              bunk_rate: `${(tied.bunk_rate * 100).toFixed(1)}%`,
              bunk_cells: tied.bunk_cells,
              eligible_cells: tied.eligible_cells,
              ties: tied.n_ties,
              group: tied.group_id !== null ? `Group #${tied.group_id}` : 'Solo',
            },
          });
        }
      });

      return allClassStudents;
    }

    // Default Focused Mode: Render ONLY students with validated ties (§6 spec)
    return (payload.nodes || []).map((node) => ({
      id: node.roll_no,
      label: node.name || node.roll_no,
      roll_no: node.roll_no,
      type: 'Student',
      bunk_rate: node.bunk_rate,
      bunk_cells: node.bunk_cells,
      eligible_cells: node.eligible_cells,
      n_ties: node.n_ties,
      group_id: node.group_id,
      community: node.group_id ?? 1,
      color:
        node.group_id !== null && node.group_id !== undefined
          ? GROUP_PALETTE[node.group_id % GROUP_PALETTE.length]
          : '#00b4ff',
      properties: {
        roll_no: node.roll_no,
        name: node.name,
        bunk_rate: `${(node.bunk_rate * 100).toFixed(1)}%`,
        bunk_cells: node.bunk_cells,
        eligible_cells: node.eligible_cells,
        ties: node.n_ties,
        group: node.group_id !== null ? `Group #${node.group_id}` : 'Solo',
      },
    }));
  }, [payload, rosterStudents, showWholeClass]);

  // Compute Active Canvas Edges
  const canvasEdges: CanvasEdge[] = useMemo(() => {
    if (!payload || !payload.edges) return [];

    const activeNodeIds = new Set(canvasNodes.map((n) => n.id));

    return payload.edges
      .filter((e) => {
        // Ensure both endpoints exist in active canvas nodes
        if (!activeNodeIds.has(e.student_a) || !activeNodeIds.has(e.student_b)) {
          return false;
        }

        // Filter casual ties if neatMode is ON and weight is below threshold
        if (neatMode && (e.weight || e.co_dates || 1) < minCoabsenceWeight) {
          return false;
        }

        return true;
      })
      .map((e) => ({
        id: e.id,
        source: e.student_a,
        target: e.student_b,
        type: e.type || 'BUNKS_WITH',
        weight: e.weight || e.co_dates || 1,
        co_cells: e.co_cells,
        co_dates: e.co_dates,
        lift: e.lift,
        q_value: e.q_value,
        rawEdge: e,
        properties: {
          type: e.type,
          co_cells: e.co_cells,
          co_dates: e.co_dates,
          lift: `${e.lift?.toFixed(2)}x`,
          q_value: e.q_value,
          dismissed: e.dismissed,
        },
      }));
  }, [payload, canvasNodes, neatMode, minCoabsenceWeight]);

  const prunedEdgeCount = useMemo(() => {
    if (!payload?.edges) return 0;
    return Math.max(0, payload.edges.length - canvasEdges.length);
  }, [payload?.edges, canvasEdges.length]);

  // Auto-focus initial student if passed via props
  useEffect(() => {
    if (!initialStudentId || canvasNodes.length === 0) return;
    const target = canvasNodes.find(
      (n) =>
        n.id === initialStudentId ||
        n.roll_no === initialStudentId ||
        n.label?.toLowerCase().includes(initialStudentId.toLowerCase())
    );
    if (target) {
      setSelectedNode(target);
      setTimeout(() => {
        canvasRef.current?.focusNode(target.id);
      }, 300);
    }
  }, [initialStudentId, canvasNodes]);

  // Edge Selection -> Evidence Loader
  const handleSelectEdge = useCallback(
    async (edge: any) => {
      if (!edge) {
        setSelectedEdge(null);
        setEvidenceData(null);
        return;
      }

      const rollA = edge.student_a || (typeof edge.source === 'object' ? edge.source.id : edge.source);
      const rollB = edge.student_b || (typeof edge.target === 'object' ? edge.target.id : edge.target);

      if (!rollA || !rollB) return;

      setSelectedEdge(edge.rawEdge || edge);
      setEvidenceLoading(true);

      try {
        const data = await api.getPairEvidence(rollA, rollB, currentSection);
        setEvidenceData(data);
      } catch (err) {
        console.error('Failed to load pair evidence:', err);
        setEvidenceData(null);
      } finally {
        setEvidenceLoading(false);
      }
    },
    [currentSection]
  );

  // Dismiss Edge Handler (§6 & §7.3)
  const handleDismissEdge = async () => {
    if (!selectedEdge) return;
    const rollA = selectedEdge.student_a;
    const rollB = selectedEdge.student_b;
    if (!rollA || !rollB) return;

    setIsDismissing(true);
    try {
      await api.dismissEdge(currentSection, rollA, rollB, dismissReason);
      setSelectedEdge(null);
      setEvidenceData(null);
      await loadData();
    } catch (err: any) {
      console.error('Failed to dismiss edge:', err);
      alert(`Dismissal failed: ${err?.message || 'Server error'}`);
    } finally {
      setIsDismissing(false);
    }
  };

  // Shortest Path Calculation
  const handleCalculatePath = (sourceId: string, targetId: string) => {
    setPathError(null);
    if (!sourceId || !targetId || sourceId === targetId) return;

    const adj = new Map<string, Array<{ neighbor: string; edge: CanvasEdge }>>();
    canvasEdges.forEach((e) => {
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
      setPathError('No connection path exists between these two students.');
      setHighlightedPath(null);
      return;
    }

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

  // Ego network / Neighbor filter
  const handleFilterNeighbors = (nodeId: string) => {
    canvasRef.current?.focusNode(nodeId);
  };

  const handleSelectNode = (node: CanvasNode | null) => {
    setSelectedNode(node);
    if (node && onSelectStudent && node.type === 'Student') {
      const roll = node.properties?.roll_no || node.id;
      onSelectStudent(roll);
    }
  };

  const hudTargetNode = isPinned ? selectedNode : hoveredNode || selectedNode;

  return (
    <div className="w-full h-[calc(100vh-64px)] -m-6 relative flex flex-col overflow-hidden bg-[#070709] text-white">
      {/* ── Top Tactical Header Bar ── */}
      <TopTacticalBar
        nodeCount={canvasNodes.length}
        edgeCount={canvasEdges.length}
        activeDomain={activeDomain}
        activeSection={currentSection}
        onSectionChange={setCurrentSection}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        nodes={canvasNodes}
        onSelectNode={handleSelectNode}
        onFocusNode={(nodeId) => canvasRef.current?.focusNode(nodeId)}
        neatMode={neatMode}
        onToggleNeatMode={() => setNeatMode((prev) => !prev)}
        showWholeClass={showWholeClass}
        onToggleWholeClass={() => setShowWholeClass((prev) => !prev)}
        totalClassCount={rosterStudents.length || 60}
      />

      {/* ── Main Canvas Viewport ── */}
      <div className="flex-1 relative overflow-hidden">
        {loading ? (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-[#070709] text-cyan-400 gap-3">
            <div className="w-10 h-10 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
            <span className="font-mono text-xs uppercase tracking-widest text-gray-300">
              SYNCHRONIZING CONNECTION ENGINE...
            </span>
          </div>
        ) : errorMsg && (!canvasNodes || canvasNodes.length === 0) ? (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-[#070709] text-rose-400 gap-3 p-6 text-center font-mono">
            <AlertTriangle size={32} className="text-amber-400" />
            <span className="text-sm font-bold text-white uppercase tracking-wider">
              {errorMsg}
            </span>
            <button
              onClick={loadData}
              className="mt-2 px-4 py-2 bg-cyan-500/20 border border-cyan-500/40 text-cyan-300 rounded-xl hover:bg-cyan-500/30 text-xs font-bold transition-all"
            >
              Retry Connection
            </button>
          </div>
        ) : (
          <KnowledgeGraphCanvas
            ref={canvasRef}
            nodes={canvasNodes}
            edges={canvasEdges}
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
            onSelectEdge={handleSelectEdge}
            anonymizeNames={anonymizeNames}
          />
        )}

        {/* ── Floating Draggable Node Summary HUD Card ── */}
        <FloatingNodeHud
          node={hudTargetNode}
          edges={canvasEdges}
          nodeTypesMap={activeDomain.nodeTypes}
          isPinned={isPinned}
          onTogglePin={() => setIsPinned((prev) => !prev)}
          onClose={() => {
            setSelectedNode(null);
            setHoveredNode(null);
            setIsPinned(false);
          }}
          onFocusNode={(nodeId) => canvasRef.current?.focusNode(nodeId)}
          onSelectAsPathSource={(nodeId) => setPathSource(nodeId)}
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
          nodes={canvasNodes}
          edges={canvasEdges}
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
          onInjectNode={() => {}}
          onInjectEdge={() => {}}
          timelineRange={{ min: Date.now() - 30 * 86400000, max: Date.now(), current: timelineVal }}
          onTimelineChange={setTimelineVal}
          isTimelinePlaying={isTimelinePlaying}
          onToggleTimelinePlay={() => setIsTimelinePlaying((prev) => !prev)}
          groups={payload?.groups || []}
          showWholeClass={showWholeClass}
          onToggleWholeClass={() => setShowWholeClass((prev) => !prev)}
          totalClassCount={rosterStudents.length || 60}
          sensitivity={sensitivity}
          onSensitivityChange={setSensitivity}
          selectedOverlays={selectedOverlays}
          onToggleOverlay={(ov) => {
            setSelectedOverlays((prev) =>
              prev.includes(ov) ? prev.filter((x) => x !== ov) : [...prev, ov]
            );
          }}
          studentsWithoutTies={payload?.students_without_ties || []}
          onFocusNode={(nodeId) => canvasRef.current?.focusNode(nodeId)}
          anonymizeNames={anonymizeNames}
          onToggleAnonymizeNames={() => setAnonymizeNames((prev) => !prev)}
          includeDismissed={includeDismissed}
          onToggleIncludeDismissed={() => setIncludeDismissed((prev) => !prev)}
          subjectFilter={subjectFilter}
          onSubjectFilterChange={setSubjectFilter}
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

        {/* ── Slide-Out Pair Evidence Drawer (When Edge is Clicked) ── */}
        {selectedEdge && (
          <aside className="absolute right-4 top-20 bottom-4 w-96 z-30 bg-black/85 backdrop-blur-2xl border border-white/10 rounded-2xl shadow-2xl p-4 flex flex-col overflow-hidden text-white animate-in slide-in-from-right duration-200 select-none">
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-amber-400 text-[18px]">
                  verified_user
                </span>
                <span className="text-xs font-bold uppercase tracking-wider font-mono">
                  Statistical Pair Evidence
                </span>
              </div>
              <button
                onClick={() => {
                  setSelectedEdge(null);
                  setEvidenceData(null);
                }}
                className="p-1 rounded text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
                title="Close Drawer"
              >
                <X size={16} />
              </button>
            </div>

            {evidenceLoading ? (
              <div className="flex-1 flex flex-col items-center justify-center gap-2 text-cyan-400">
                <RefreshCw size={24} className="animate-spin" />
                <span className="font-mono text-xs text-gray-400">
                  Retrieving co-absence sessions...
                </span>
              </div>
            ) : evidenceData ? (
              <div className="flex-1 overflow-y-auto pt-3 space-y-4 text-xs font-sans">
                {/* Plain Language Summary */}
                <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl">
                  <div className="text-[10px] font-mono font-bold text-amber-400 uppercase tracking-wider mb-1 flex items-center gap-1">
                    <Sparkles size={12} />
                    <span>Engine Finding</span>
                  </div>
                  <p className="text-gray-200 leading-relaxed font-sans text-xs">
                    {evidenceData.plain_language}
                  </p>
                </div>

                {/* Metrics Grid */}
                <div className="grid grid-cols-2 gap-2 font-mono">
                  <div className="bg-white/[0.04] p-2.5 rounded-xl border border-white/5">
                    <div className="text-[10px] text-gray-400 uppercase">Co-Skips (Cells)</div>
                    <div className="text-base font-bold text-white mt-0.5">
                      {evidenceData.co_cells}
                    </div>
                  </div>
                  <div className="bg-white/[0.04] p-2.5 rounded-xl border border-white/5">
                    <div className="text-[10px] text-gray-400 uppercase">Distinct Dates</div>
                    <div className="text-base font-bold text-white mt-0.5">
                      {evidenceData.co_dates}
                    </div>
                  </div>
                  <div className="bg-white/[0.04] p-2.5 rounded-xl border border-white/5">
                    <div className="text-[10px] text-gray-400 uppercase">Expected By Chance</div>
                    <div className="text-base font-bold text-gray-300 mt-0.5">
                      {evidenceData.expected.toFixed(2)}
                    </div>
                  </div>
                  <div className="bg-white/[0.04] p-2.5 rounded-xl border border-white/5">
                    <div className="text-[10px] text-gray-400 uppercase">Observed Lift</div>
                    <div className="text-base font-bold text-amber-400 mt-0.5">
                      {evidenceData.lift.toFixed(2)}x
                    </div>
                  </div>
                  <div className="bg-white/[0.04] p-2.5 rounded-xl border border-white/5 col-span-2">
                    <div className="text-[10px] text-gray-400 uppercase">FDR-adjusted p-value (q)</div>
                    <div className="text-sm font-bold text-emerald-400 mt-0.5">
                      {evidenceData.q_value < 0.001
                        ? evidenceData.q_value.toExponential(2)
                        : evidenceData.q_value.toFixed(4)}
                    </div>
                  </div>
                </div>

                {/* Shared Ties Corroboration */}
                <div className="space-y-1.5">
                  <div className="text-[11px] font-mono text-gray-400 font-semibold uppercase tracking-wider">
                    Contextual Ties
                  </div>
                  {!evidenceData.shared_ties || evidenceData.shared_ties.length === 0 ? (
                    <div className="text-gray-400 bg-white/[0.02] p-2.5 rounded-xl border border-white/5 text-[11px]">
                      No recorded social survey or institutional batch ties found.
                    </div>
                  ) : (
                    <div className="space-y-1">
                      {evidenceData.shared_ties.map((t, idx) => (
                        <div
                          key={idx}
                          className="p-2 bg-white/[0.03] rounded-lg border border-white/5 flex items-center justify-between text-[11px]"
                        >
                          <span className="font-medium text-white">{t.tie_type}</span>
                          <span className="text-gray-400 text-[10px]">{t.detail || t.kind}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Overlapping Sessions Table */}
                <div className="space-y-1.5">
                  <div className="text-[11px] font-mono text-gray-400 font-semibold uppercase tracking-wider">
                    Overlapping Bunk Sessions
                  </div>
                  <div className="max-h-40 overflow-y-auto border border-white/10 rounded-xl bg-white/[0.02]">
                    <table className="w-full text-left text-[11px]">
                      <thead className="bg-white/[0.04] text-gray-400 border-b border-white/10 sticky top-0 font-mono text-[10px]">
                        <tr>
                          <th className="p-2">Date</th>
                          <th className="p-2">Day</th>
                          <th className="p-2">Period</th>
                          <th className="p-2">Subject</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5 font-mono">
                        {evidenceData.overlapping_sessions?.map((s, idx) => (
                          <tr key={idx} className="hover:bg-white/[0.04]">
                            <td className="p-2 text-white">{s.date}</td>
                            <td className="p-2 text-gray-300">{s.weekday}</td>
                            <td className="p-2 text-amber-300">{s.periods_a?.join(',') || 'Block'}</td>
                            <td className="p-2 text-gray-400">{s.subjects?.join(',') || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Dismiss As Not Real Tie (§6 & §7.3) */}
                <div className="p-3 bg-rose-950/20 rounded-xl border border-rose-500/30 space-y-2">
                  <div className="font-semibold text-rose-400 flex items-center gap-1.5 text-xs font-mono">
                    <Ban size={14} />
                    <span>Dismiss as not a real tie</span>
                  </div>
                  <p className="text-[10px] text-gray-400 leading-tight">
                    Hides this edge for educators while persisting dismissal reason. Raw statistics remain intact.
                  </p>
                  <select
                    value={dismissReason}
                    onChange={(e) => setDismissReason(e.target.value)}
                    className="w-full bg-black/60 border border-white/15 text-white rounded-lg p-1.5 text-xs focus:outline-none"
                  >
                    <option value="Same bus / transport problem">Same bus / transport problem</option>
                    <option value="Same lab batch or timetable clash">Same lab batch or timetable clash</option>
                    <option value="Approved activity">Approved activity</option>
                    <option value="Other">Other</option>
                  </select>
                  <button
                    onClick={handleDismissEdge}
                    disabled={isDismissing}
                    className="w-full py-1.5 bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/40 text-rose-200 text-xs font-semibold rounded-lg transition-colors flex items-center justify-center gap-1.5"
                  >
                    {isDismissing ? 'Processing Dismissal...' : 'Dismiss Edge'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="p-4 text-center text-gray-400 font-mono text-xs">
                Failed to load pair evidence.
              </div>
            )}
          </aside>
        )}
      </div>
    </div>
  );
};
