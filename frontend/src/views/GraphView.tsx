import React, { useState, useEffect } from 'react';
import { api, GraphNode, GraphEdge, StudentDossier } from '../api/client';

export interface GraphViewProps {
  initialStudentId?: string;
  onNavigate: (viewId: string, params?: any) => void;
  activeSection?: string;
}

export const GraphView: React.FC<GraphViewProps> = ({
  initialStudentId,
  onNavigate,
  activeSection = 'CS-3B',
}) => {
  const [nodes, setNodes] = useState<GraphNode[]>([]);
  const [edges, setEdges] = useState<GraphEdge[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [hoveredNode, setHoveredNode] = useState<GraphNode | null>(null);
  const [dossier, setDossier] = useState<StudentDossier | null>(null);
  const [dossierLoading, setDossierLoading] = useState(false);

  const [zoomScale, setZoomScale] = useState(1);
  const [filterCohort, setFilterCohort] = useState<string>('all');
  const [showDelinquentsOnly, setShowDelinquentsOnly] = useState<boolean>(false);

  const fetchGraph = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getGraphNodes(activeSection);
      setNodes(data.nodes);
      setEdges(data.edges);
      setSummary(data.summary);

      if (data.nodes.length > 0) {
        const target =
          (initialStudentId &&
            data.nodes.find((n) => n.id === initialStudentId || n.roll_no === initialStudentId)) ||
          data.nodes.find((n) => n.level === 1) ||
          data.nodes[0];
        setSelectedNode(target);
        loadDossier(target.roll_no);
      } else {
        setSelectedNode(null);
        setDossier(null);
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to load graph data');
    } finally {
      setLoading(false);
    }
  };

  const loadDossier = async (rollNo: string) => {
    setDossierLoading(true);
    try {
      const profile = await api.getStudentProfile(rollNo);
      setDossier(profile);
    } catch (err: any) {
      console.error('Failed to load dossier:', err);
    } finally {
      setDossierLoading(false);
    }
  };

  useEffect(() => {
    fetchGraph();
  }, [activeSection]);

  const handleNodeClick = (node: GraphNode) => {
    setSelectedNode(node);
    loadDossier(node.roll_no);
  };

  // Extract cohorts for Level 4 students
  const cohorts = Array.from(
    new Set(nodes.filter((n) => n.level === 4).map((n) => n.cohort).filter(Boolean))
  );

  // Filter nodes: Keep hierarchy nodes (levels 1, 2, 3) always visible, filter Level 4 students
  const visibleNodes = nodes.filter((n) => {
    if (n.level < 4) return true;
    if (showDelinquentsOnly && !n.is_delinquent) return false;
    if (filterCohort !== 'all' && n.cohort !== filterCohort) return false;
    return true;
  });

  const visibleNodeIds = new Set(visibleNodes.map((n) => n.id));
  const visibleEdges = edges.filter((e) => visibleNodeIds.has(e.source) && visibleNodeIds.has(e.target));

  // Connected neighbor IDs for active/hovered node
  const activeFocusNode = hoveredNode || selectedNode;
  const connectedNodeIds = new Set<string>();
  if (activeFocusNode) {
    connectedNodeIds.add(activeFocusNode.id);
    for (const e of edges) {
      if (e.source === activeFocusNode.id) connectedNodeIds.add(e.target);
      if (e.target === activeFocusNode.id) connectedNodeIds.add(e.source);
    }
  }

  const getInitials = (name: string) => {
    const clean = name.replace('(CR)', '').trim();
    const parts = clean.split(' ');
    if (parts.length >= 2) return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
    return (clean.slice(0, 2) || 'ST').toUpperCase();
  };

  if (loading) {
    return (
      <div className="h-[calc(100vh-120px)] flex flex-col items-center justify-center space-y-3">
        <div className="w-10 h-10 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        <p className="text-xs font-medium text-on-surface-variant tracking-wide">
          Constructing hierarchical knowledge graph for Section {activeSection}...
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-[calc(100vh-120px)] flex flex-col items-center justify-center p-6">
        <div className="p-8 bg-surface-container-lowest border border-error/30 rounded-2xl text-center max-w-md space-y-4 shadow-sm">
          <span className="material-symbols-outlined text-[36px] text-error">hub</span>
          <h2 className="text-base font-bold text-on-surface">Knowledge Graph Error</h2>
          <p className="text-xs text-on-surface-variant leading-relaxed">{error}</p>
          <button
            onClick={fetchGraph}
            className="px-4 py-2 bg-primary text-on-primary rounded-xl text-xs font-semibold hover:opacity-90 transition-opacity cursor-pointer inline-flex items-center gap-1.5"
          >
            <span className="material-symbols-outlined text-[16px]">refresh</span> Retry Computation
          </button>
        </div>
      </div>
    );
  }

  if (nodes.length === 0) {
    return (
      <div className="h-[calc(100vh-120px)] flex flex-col items-center justify-center p-6">
        <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-12 text-center max-w-lg space-y-5 shadow-xs">
          <div className="w-14 h-14 rounded-2xl bg-secondary-container/40 text-primary flex items-center justify-center mx-auto">
            <span className="material-symbols-outlined text-[32px]">account_tree</span>
          </div>
          <div>
            <h2 className="text-base font-bold text-on-surface">No Graph Data for Section {activeSection}</h2>
            <p className="text-xs text-on-surface-variant mt-2 leading-relaxed">
              Upload attendance register and student roster CSV files to build the hierarchical knowledge network.
            </p>
          </div>
          <button
            onClick={() => onNavigate('ingestion')}
            className="px-4 py-2.5 bg-primary text-on-primary rounded-xl text-xs font-semibold hover:opacity-90 transition-all inline-flex items-center gap-2 shadow-xs cursor-pointer"
          >
            <span className="material-symbols-outlined text-[18px]">upload_file</span>
            Upload Attendance Register
          </button>
        </div>
      </div>
    );
  }

  const delinquentCount = nodes.filter((n) => n.is_delinquent).length;

  return (
    <div className="h-[calc(100vh-100px)] flex flex-col space-y-2.5 pb-2">
      {/* Sleek Minimalist Sub-Header */}
      <div className="flex flex-wrap justify-between items-center px-1">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
            <span className="material-symbols-outlined text-[18px]">account_tree</span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold text-on-surface tracking-tight">Hierarchical Knowledge Graph</h1>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-surface-container text-on-surface-variant border border-outline-variant">
                Section {activeSection}
              </span>
              {delinquentCount > 0 && (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30">
                  <span className="material-symbols-outlined text-[12px]">local_fire_department</span>
                  {delinquentCount} Delinquents
                </span>
              )}
            </div>
            <p className="text-[11px] text-on-surface-variant">
              Classroom (Root) → Teacher → Class Rep (CR) → Peer Friend Groups
            </p>
          </div>
        </div>

        {/* Minimal Controls */}
        <div className="flex items-center gap-2">
          {/* Delinquent Quick Toggle */}
          <button
            onClick={() => setShowDelinquentsOnly(!showDelinquentsOnly)}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold border flex items-center gap-1.5 transition-all cursor-pointer ${
              showDelinquentsOnly
                ? 'bg-rose-500 text-white border-rose-600 shadow-xs'
                : 'bg-surface-container-lowest text-on-surface-variant border-outline-variant hover:text-rose-600 hover:border-rose-400'
            }`}
            title="Toggle delinquent students highlight"
          >
            <span className="material-symbols-outlined text-[15px]">local_fire_department</span>
            <span>Delinquents Only</span>
          </button>

          {/* Minimal Cohort Filter */}
          <select
            value={filterCohort}
            onChange={(e) => setFilterCohort(e.target.value)}
            className="bg-surface-container-lowest border border-outline-variant rounded-lg text-xs font-medium px-2.5 py-1 text-on-surface cursor-pointer focus:outline-none focus:border-primary"
          >
            <option value="all">All Friend Groups</option>
            {cohorts.map((c) => (
              <option key={c} value={c}>
                {c.replace('Friend Group: ', '')}
              </option>
            ))}
          </select>

          <button
            onClick={fetchGraph}
            className="p-1 rounded-lg border border-outline-variant bg-surface-container-lowest text-on-surface-variant hover:text-primary hover:bg-surface-container transition-colors cursor-pointer"
            title="Refresh Graph"
          >
            <span className="material-symbols-outlined text-[18px]">refresh</span>
          </button>
        </div>
      </div>

      {/* ─── 78% Knowledge Graph / 22% Dossier Workspace ───────────────────────────── */}
      <div className="flex-1 flex flex-col lg:flex-row gap-3 min-h-0 overflow-hidden">
        {/* ─── 78% Dedicated Knowledge Graph Canvas ──────────────────────────────── */}
        <div className="w-full lg:w-[78%] h-full bg-surface-container-lowest border border-outline-variant rounded-2xl relative overflow-hidden shadow-xs flex flex-col">
          {/* Subtle Hierarchical Level Guides in Background */}
          <div className="absolute inset-0 pointer-events-none select-none flex flex-col justify-between py-2 px-4 opacity-35 dark:opacity-20 text-[10px] font-mono tracking-wider text-on-surface-variant">
            <div className="flex items-center justify-between border-b border-dashed border-outline-variant/40 pb-1">
              <span>LEVEL 1 • INSTITUTIONAL / CLASSROOM ROOT</span>
              <span className="text-[9px]">Administrative Apex</span>
            </div>
            <div className="flex items-center justify-between border-b border-dashed border-outline-variant/40 pb-1">
              <span>LEVEL 2 • FACULTY / CLASS TEACHER</span>
              <span className="text-[9px]">Academic Leadership</span>
            </div>
            <div className="flex items-center justify-between border-b border-dashed border-outline-variant/40 pb-1">
              <span>LEVEL 3 • STUDENT COUNCIL / CLASS REPRESENTATIVE (CR)</span>
              <span className="text-[9px]">Peer Liaison</span>
            </div>
            <div className="flex items-center justify-between pt-1">
              <span>LEVEL 4 • PEER FRIEND GROUPS & COHORTS</span>
              <span className="text-[9px]">Social Graph & Co-Absence</span>
            </div>
          </div>

          {/* Micro-dot canvas background */}
          <div
            className="absolute inset-0 pointer-events-none opacity-30 dark:opacity-15"
            style={{
              backgroundImage: 'radial-gradient(var(--color-outline-variant) 1px, transparent 1px)',
              backgroundSize: '24px 24px',
            }}
          />

          {/* SVG Canvas for Hierarchy & Co-Absence Edges */}
          <svg
            className="w-full h-full absolute inset-0 transition-transform duration-150 ease-out"
            style={{ transform: `scale(${zoomScale})` }}
          >
            <defs>
              {/* Arrowhead marker for hierarchy links */}
              <marker
                id="hierarchy-arrow"
                viewBox="0 0 10 10"
                refX="6"
                refY="5"
                markerWidth="5"
                markerHeight="5"
                orient="auto-start-reverse"
              >
                <path d="M 0 1 L 8 5 L 0 9 z" fill="rgba(99, 102, 241, 0.6)" />
              </marker>
            </defs>

            {visibleEdges.map((e, idx) => {
              const sourceNode = nodes.find((n) => n.id === e.source);
              const targetNode = nodes.find((n) => n.id === e.target);
              if (!sourceNode || !targetNode) return null;

              const isDirectlyConnected =
                activeFocusNode &&
                (activeFocusNode.id === e.source || activeFocusNode.id === e.target);

              const isHierarchy = e.type === 'hierarchy';

              if (isHierarchy) {
                // Hierarchy Edge (Classroom -> Teacher -> CR -> Cohort Hubs)
                return (
                  <line
                    key={`h-edge-${idx}`}
                    x1={`${sourceNode.x}%`}
                    y1={`${sourceNode.y}%`}
                    x2={`${targetNode.x}%`}
                    y2={`${targetNode.y}%`}
                    stroke="rgba(99, 102, 241, 0.55)"
                    strokeWidth={2}
                    strokeDasharray="4 3"
                    strokeOpacity={isDirectlyConnected ? 1 : 0.6}
                    markerEnd="url(#hierarchy-arrow)"
                    className="transition-all duration-200"
                  />
                );
              }

              // Co-Absence Edge (Student <-> Student)
              const strokeColor = isDirectlyConnected
                ? 'var(--color-primary)'
                : sourceNode.is_delinquent || targetNode.is_delinquent
                ? 'rgba(244, 63, 94, 0.45)'
                : 'var(--color-outline-variant)';

              const strokeOpacity = activeFocusNode
                ? isDirectlyConnected
                  ? 0.95
                  : 0.1
                : 0.35;

              const strokeWidth = isDirectlyConnected ? Math.min(3.5, 1.2 + e.weight * 0.4) : 1.2;

              return (
                <line
                  key={`edge-${idx}`}
                  x1={`${sourceNode.x}%`}
                  y1={`${sourceNode.y}%`}
                  x2={`${targetNode.x}%`}
                  y2={`${targetNode.y}%`}
                  stroke={strokeColor}
                  strokeWidth={strokeWidth}
                  strokeOpacity={strokeOpacity}
                  strokeLinecap="round"
                  className="transition-all duration-200"
                />
              );
            })}
          </svg>

          {/* HTML Overlay for Interactive Hierarchical Nodes */}
          <div
            className="w-full h-full absolute inset-0 transition-transform duration-150 ease-out pointer-events-none"
            style={{ transform: `scale(${zoomScale})` }}
          >
            {visibleNodes.map((node) => {
              const isSelected = selectedNode?.id === node.id;
              const isHovered = hoveredNode?.id === node.id;
              const isConnected = connectedNodeIds.has(node.id);
              const isDimmed = activeFocusNode && !isConnected;

              // ─── Level 1: Classroom Root Node ──────────────────────────────
              if (node.level === 1) {
                return (
                  <div
                    key={node.id}
                    onClick={() => handleNodeClick(node)}
                    onMouseEnter={() => setHoveredNode(node)}
                    onMouseLeave={() => setHoveredNode(null)}
                    style={{ left: `${node.x}%`, top: `${node.y}%` }}
                    className={`absolute transform -translate-x-1/2 -translate-y-1/2 pointer-events-auto cursor-pointer transition-all duration-200 ${
                      isSelected
                        ? 'scale-110 z-30'
                        : isHovered
                        ? 'scale-105 z-20'
                        : isDimmed
                        ? 'opacity-40 z-0'
                        : 'z-10'
                    }`}
                  >
                    <div
                      className={`px-4 py-2 rounded-2xl flex items-center gap-2.5 shadow-sm border-2 transition-all ${
                        isSelected
                          ? 'bg-primary text-on-primary border-primary ring-4 ring-primary/25'
                          : 'bg-surface-container-lowest border-indigo-500/60 text-on-surface hover:border-indigo-600'
                      }`}
                    >
                      <div className="w-8 h-8 rounded-xl bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold">
                        <span className="material-symbols-outlined text-[20px]">school</span>
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-xs">{node.name}</span>
                          <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 font-semibold">
                            ROOT
                          </span>
                        </div>
                        <div className="text-[10px] text-on-surface-variant font-mono">
                          {summary?.student_count ?? 12} Students • {node.attendance_pct}% Avg Attendance
                        </div>
                      </div>
                    </div>
                  </div>
                );
              }

              // ─── Level 2: Class Teacher Node ────────────────────────────────
              if (node.level === 2) {
                return (
                  <div
                    key={node.id}
                    onClick={() => handleNodeClick(node)}
                    onMouseEnter={() => setHoveredNode(node)}
                    onMouseLeave={() => setHoveredNode(null)}
                    style={{ left: `${node.x}%`, top: `${node.y}%` }}
                    className={`absolute transform -translate-x-1/2 -translate-y-1/2 pointer-events-auto cursor-pointer transition-all duration-200 ${
                      isSelected
                        ? 'scale-110 z-30'
                        : isHovered
                        ? 'scale-105 z-20'
                        : isDimmed
                        ? 'opacity-40 z-0'
                        : 'z-10'
                    }`}
                  >
                    <div
                      className={`px-3.5 py-1.5 rounded-2xl flex items-center gap-2 shadow-sm border-2 transition-all ${
                        isSelected
                          ? 'bg-primary text-on-primary border-primary ring-4 ring-primary/25'
                          : 'bg-surface-container-lowest border-sky-500/60 text-on-surface hover:border-sky-600'
                      }`}
                    >
                      <div className="w-7 h-7 rounded-lg bg-sky-500/15 text-sky-600 dark:text-sky-400 flex items-center justify-center font-bold">
                        <span className="material-symbols-outlined text-[17px]">supervisor_account</span>
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-xs">{node.name}</span>
                          <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-sky-500/20 text-sky-600 dark:text-sky-400 font-semibold">
                            TEACHER
                          </span>
                        </div>
                        <div className="text-[10px] text-on-surface-variant">Class Teacher • AIML Sem 4</div>
                      </div>
                    </div>
                  </div>
                );
              }

              // ─── Level 3: Class Representative (CR) Node ───────────────────
              if (node.level === 3) {
                return (
                  <div
                    key={node.id}
                    onClick={() => handleNodeClick(node)}
                    onMouseEnter={() => setHoveredNode(node)}
                    onMouseLeave={() => setHoveredNode(null)}
                    style={{ left: `${node.x}%`, top: `${node.y}%` }}
                    className={`absolute transform -translate-x-1/2 -translate-y-1/2 pointer-events-auto cursor-pointer transition-all duration-200 ${
                      isSelected
                        ? 'scale-115 z-30'
                        : isHovered
                        ? 'scale-108 z-20'
                        : isDimmed
                        ? 'opacity-40 z-0'
                        : 'z-10'
                    }`}
                  >
                    <div
                      className={`px-3 py-1.5 rounded-2xl flex items-center gap-2 shadow-sm border-2 transition-all ${
                        isSelected
                          ? 'bg-emerald-600 text-white border-emerald-500 ring-4 ring-emerald-500/30'
                          : 'bg-surface-container-lowest border-emerald-500/60 text-on-surface hover:border-emerald-600'
                      }`}
                    >
                      <div className="w-7 h-7 rounded-lg bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold">
                        <span className="material-symbols-outlined text-[17px]">badge</span>
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-xs">{node.name}</span>
                          <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-semibold">
                            CR
                          </span>
                        </div>
                        <div className="text-[10px] text-on-surface-variant font-mono">
                          {node.roll_no} • {node.attendance_pct}% Att.
                        </div>
                      </div>
                    </div>
                  </div>
                );
              }

              // ─── Level 4: Students (Friend Groups + Delinquents) ───────────
              const isDelinquent = node.is_delinquent;
              const cohortColor = node.cohort_color || '#64748b';

              return (
                <div
                  key={node.id}
                  onClick={() => handleNodeClick(node)}
                  onMouseEnter={() => setHoveredNode(node)}
                  onMouseLeave={() => setHoveredNode(null)}
                  style={{
                    left: `${node.x}%`,
                    top: `${node.y}%`,
                  }}
                  className={`absolute transform -translate-x-1/2 -translate-y-1/2 pointer-events-auto cursor-pointer transition-all duration-200 ${
                    isSelected
                      ? 'scale-120 z-30'
                      : isHovered
                      ? 'scale-112 z-20'
                      : isDimmed
                      ? 'opacity-30 scale-95 z-0'
                      : 'opacity-100 scale-100 z-10'
                  }`}
                >
                  {/* Student Avatar */}
                  <div
                    className={`w-11 h-11 rounded-full flex items-center justify-center font-bold text-xs shadow-sm transition-all border-2 relative ${
                      isSelected
                        ? 'bg-primary text-on-primary border-primary ring-4 ring-primary/25'
                        : isDelinquent
                        ? 'bg-rose-500/15 border-rose-500 text-rose-600 dark:text-rose-400 ring-4 ring-rose-500/30 shadow-[0_0_16px_rgba(244,63,94,0.45)]'
                        : 'bg-surface-container-lowest text-on-surface hover:scale-105'
                    }`}
                    style={
                      !isSelected && !isDelinquent
                        ? { borderColor: cohortColor, boxShadow: `0 0 0 2px ${cohortColor}25` }
                        : undefined
                    }
                  >
                    <span>{getInitials(node.name)}</span>

                    {/* Fiery Delinquent Flame Badge */}
                    {isDelinquent && (
                      <span
                        className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-rose-500 text-white flex items-center justify-center shadow-xs"
                        title={node.delinquency_label || 'Delinquent Student'}
                      >
                        <span className="material-symbols-outlined text-[11px]">local_fire_department</span>
                      </span>
                    )}
                  </div>

                  {/* Clean Minimalist Label (Name + Status) */}
                  <div className="absolute top-12 left-1/2 transform -translate-x-1/2 whitespace-nowrap text-center pointer-events-none">
                    <span
                      className={`text-[10px] font-semibold px-1.5 py-0.5 rounded shadow-2xs transition-colors flex items-center gap-1 ${
                        isSelected
                          ? 'bg-primary text-on-primary font-bold'
                          : isDelinquent
                          ? 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/40 font-bold'
                          : 'bg-surface-container-lowest/95 text-on-surface border border-outline-variant/60'
                      }`}
                    >
                      {node.name.split(' ')[0]} ({node.roll_no.slice(-3)})
                    </span>

                    <div className="text-[9px] font-mono text-on-surface-variant mt-0.5 flex items-center justify-center gap-1">
                      {isDelinquent ? (
                        <span className="text-rose-600 dark:text-rose-400 font-bold">
                          {node.absences} abs
                        </span>
                      ) : (
                        <span>{node.attendance_pct}%</span>
                      )}
                      <span>•</span>
                      <span>PR: {node.pagerank.toFixed(3)}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Floating Minimalist Legend (Bottom-Left) */}
          <div className="absolute bottom-3 left-3 bg-surface-container-lowest/90 backdrop-blur-md border border-outline-variant/80 rounded-xl px-3 py-1.5 flex flex-wrap items-center gap-3 text-[11px] text-on-surface-variant shadow-xs">
            <span className="flex items-center gap-1 font-semibold text-rose-600 dark:text-rose-400">
              <span className="material-symbols-outlined text-[13px]">local_fire_department</span>
              Delinquents / Backbenchers
            </span>
            <span className="flex items-center gap-1 font-medium">
              <span className="w-2.5 h-2.5 rounded-full bg-violet-500" /> Study Circle
            </span>
            <span className="flex items-center gap-1 font-medium">
              <span className="w-2.5 h-2.5 rounded-full bg-cyan-500" /> Tech & Lab Circle
            </span>
            <span className="flex items-center gap-1 font-medium text-emerald-600 dark:text-emerald-400">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> Class Rep (CR)
            </span>
            <span className="flex items-center gap-1 font-medium text-sky-600 dark:text-sky-400">
              <span className="w-2.5 h-2.5 rounded-full bg-sky-500" /> Teacher
            </span>
          </div>

          {/* Floating Minimal Zoom Capsule (Bottom-Right) */}
          <div className="absolute bottom-3 right-3 bg-surface-container-lowest/90 backdrop-blur-md border border-outline-variant/80 rounded-xl px-1.5 py-1 flex items-center gap-1 text-xs shadow-xs">
            <button
              onClick={() => setZoomScale((z) => Math.max(0.6, z - 0.1))}
              className="w-6 h-6 rounded flex items-center justify-center hover:bg-surface-container text-on-surface-variant cursor-pointer transition-colors"
              title="Zoom out"
            >
              <span className="material-symbols-outlined text-[15px]">remove</span>
            </button>
            <span className="text-[10px] font-mono px-1 select-none text-on-surface-variant">
              {Math.round(zoomScale * 100)}%
            </span>
            <button
              onClick={() => setZoomScale((z) => Math.min(1.8, z + 0.1))}
              className="w-6 h-6 rounded flex items-center justify-center hover:bg-surface-container text-on-surface-variant cursor-pointer transition-colors"
              title="Zoom in"
            >
              <span className="material-symbols-outlined text-[15px]">add</span>
            </button>
            <button
              onClick={() => setZoomScale(1)}
              className="w-6 h-6 rounded flex items-center justify-center hover:bg-surface-container text-on-surface-variant cursor-pointer transition-colors ml-0.5"
              title="Reset scale"
            >
              <span className="material-symbols-outlined text-[14px]">restart_alt</span>
            </button>
          </div>
        </div>

        {/* ─── 22% Focused Dossier Inspector Panel ────────────────────────────────── */}
        <div className="w-full lg:w-[22%] h-full bg-surface-container-lowest border border-outline-variant rounded-2xl shadow-xs flex flex-col overflow-hidden">
          {dossierLoading ? (
            <div className="flex-1 flex flex-col items-center justify-center space-y-2">
              <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              <span className="text-xs text-on-surface-variant">Loading dossier...</span>
            </div>
          ) : dossier ? (
            <div className="flex-1 flex flex-col p-3.5 overflow-y-auto space-y-3.5">
              {/* Header Badge */}
              <div className="border-b border-outline-variant pb-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-secondary-container text-on-secondary-container">
                    {dossier.roll_no}
                  </span>
                  <span
                    className={`text-[9px] font-bold px-2 py-0.5 rounded ${
                      dossier.is_delinquent
                        ? 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30'
                        : dossier.type === 'classroom'
                        ? 'bg-indigo-500/15 text-indigo-600 dark:text-indigo-400'
                        : dossier.type === 'teacher'
                        ? 'bg-sky-500/15 text-sky-600 dark:text-sky-400'
                        : dossier.type === 'cr'
                        ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                        : 'bg-surface-container text-on-surface-variant'
                    }`}
                  >
                    {dossier.delinquency_label || dossier.role}
                  </span>
                </div>
                <h3 className="text-sm font-bold text-on-surface mt-1.5 leading-snug">{dossier.name}</h3>
                <p className="text-[11px] text-on-surface-variant mt-0.5">{dossier.cohort}</p>
              </div>

              {/* Delinquency Alert Banner (For Delinquent Students) */}
              {dossier.is_delinquent && (
                <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400 space-y-1">
                  <div className="flex items-center gap-1.5 font-bold text-xs">
                    <span className="material-symbols-outlined text-[15px]">local_fire_department</span>
                    <span>Delinquency Warning</span>
                  </div>
                  <p className="text-[11px] text-on-surface-variant leading-relaxed">
                    Student has missed {dossier.absences} sessions with strong co-bunk affinity in the Backbenchers cohort.
                  </p>
                </div>
              )}

              {/* Classroom Context */}
              {dossier.classroom_info && (
                <div className="p-2.5 rounded-xl bg-indigo-500/10 border border-indigo-500/30 space-y-1.5 text-xs">
                  <div className="font-bold text-indigo-600 dark:text-indigo-400 flex items-center gap-1">
                    <span className="material-symbols-outlined text-[15px]">school</span>
                    <span>Classroom Overview</span>
                  </div>
                  <div className="text-[11px] text-on-surface-variant space-y-1">
                    <div>Strength: <span className="font-semibold text-on-surface">{dossier.classroom_info.strength} Enrolled</span></div>
                    <div>Department: <span className="font-semibold text-on-surface">{dossier.classroom_info.department}</span></div>
                    <div>Class Teacher: <span className="font-semibold text-on-surface">{dossier.classroom_info.class_teacher}</span></div>
                  </div>
                </div>
              )}

              {/* Teacher Context */}
              {dossier.teacher_info && (
                <div className="p-2.5 rounded-xl bg-sky-500/10 border border-sky-500/30 space-y-1.5 text-xs">
                  <div className="font-bold text-sky-600 dark:text-sky-400 flex items-center gap-1">
                    <span className="material-symbols-outlined text-[15px]">supervisor_account</span>
                    <span>Faculty Overview</span>
                  </div>
                  <div className="text-[11px] text-on-surface-variant space-y-1">
                    <div>Department: <span className="font-semibold text-on-surface">{dossier.teacher_info.department}</span></div>
                    <div>Subjects: <span className="font-semibold text-on-surface">{dossier.teacher_info.subjects.join(', ')}</span></div>
                  </div>
                </div>
              )}

              {/* Minimal Metrics Grid */}
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="p-2.5 bg-surface-container-low rounded-xl border border-outline-variant">
                  <div className="text-[9px] font-medium text-on-surface-variant uppercase">
                    Attendance
                  </div>
                  <div
                    className={`text-base font-bold mt-0.5 ${
                      dossier.attendance_pct < 75 ? 'text-error' : 'text-primary'
                    }`}
                  >
                    {dossier.attendance_pct}%
                  </div>
                  <div className="text-[9px] text-on-surface-variant mt-0.5">
                    {dossier.absences} absences
                  </div>
                </div>

                <div className="p-2.5 bg-surface-container-low rounded-xl border border-outline-variant">
                  <div className="text-[9px] font-medium text-on-surface-variant uppercase">
                    PageRank
                  </div>
                  <div className="text-base font-bold text-primary mt-0.5">
                    {dossier.pagerank.toFixed(3)}
                  </div>
                  <div className="text-[9px] text-on-surface-variant mt-0.5">
                    Centrality Rank
                  </div>
                </div>
              </div>

              {/* Top Co-Absent Peers */}
              {dossier.peers.length > 0 && (
                <div className="flex-1">
                  <h4 className="text-xs font-bold text-on-surface mb-2 flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[15px] text-primary">groups</span>
                    Top Co-Absent Peers
                  </h4>
                  <div className="space-y-1 max-h-40 overflow-y-auto pr-0.5">
                    {dossier.peers.map((peer, idx) => (
                      <div
                        key={idx}
                        onClick={() => {
                          const n = nodes.find((x) => x.roll_no === peer.roll_no);
                          if (n) handleNodeClick(n);
                        }}
                        className="p-1.5 rounded-lg bg-surface-container border border-outline-variant/60 flex items-center justify-between text-xs hover:border-primary/60 transition-all cursor-pointer group"
                      >
                        <div>
                          <div className="font-semibold text-on-surface group-hover:text-primary transition-colors text-[11px]">
                            {peer.name}
                          </div>
                          <div className="text-[9px] text-on-surface-variant font-mono">
                            {peer.roll_no}
                          </div>
                        </div>
                        <span className="text-[10px] font-bold text-rose-600 dark:text-rose-400 px-1.5 py-0.2 rounded bg-rose-500/10">
                          {peer.mutual_absences}x mutual
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Action */}
              {dossier.type !== 'classroom' && dossier.type !== 'teacher' && (
                <div className="pt-2 border-t border-outline-variant">
                  <button
                    onClick={() => onNavigate('interventions', { studentId: dossier.roll_no })}
                    className="w-full py-2 bg-primary text-on-primary text-xs font-semibold rounded-xl hover:opacity-90 transition-opacity flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                  >
                    <span className="material-symbols-outlined text-[14px]">folder_special</span>
                    Log Proactive Intervention
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-4 text-center text-xs text-on-surface-variant space-y-2">
              <span className="material-symbols-outlined text-[26px] text-outline">touch_app</span>
              <p>Click any node in the hierarchy to inspect its details and connections.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
