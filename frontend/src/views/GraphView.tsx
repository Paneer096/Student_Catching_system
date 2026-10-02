import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  api,
  HierarchicalGraphData,
  HierarchicalStudent,
  StudentDossier,
} from '../api/client';
import { ClassroomGraph } from '../components/graph/ClassroomGraph';
import { GraphBreadcrumb, BreadcrumbSegment } from '../components/graph/GraphBreadcrumb';
import { EdgeTypeFilter } from '../components/graph/EdgeTypeFilter';
import { EdgeTypeKey } from '../components/graph/EdgeRenderer';
import { LayoutMode } from '../components/graph/useHierarchicalLayout';
import { RenderableNode, NodeRenderer } from '../components/graph/NodeRenderer';

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
  // Graph Data & Loading States
  const [data, setData] = useState<HierarchicalGraphData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Progressive Disclosure Layers:
  // 0 = Institution, 1 = Section (Default), 2 = Cluster, 3 = Student
  const [activeLayer, setActiveLayer] = useState<number>(1);
  const [expandedClusterId, setExpandedClusterId] = useState<string | null>(null);
  const [selectedNode, setSelectedNode] = useState<RenderableNode | null>(null);

  // Student Dossier State
  const [dossier, setDossier] = useState<StudentDossier | null>(null);
  const [dossierLoading, setDossierLoading] = useState<boolean>(false);

  // Toolbar & Visualization Controls
  const [zoomScale, setZoomScale] = useState<number>(1.0);
  const [layoutMode, setLayoutMode] = useState<LayoutMode>('Hierarchical');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [delinquentsOnly, setDelinquentsOnly] = useState<boolean>(false);

  // Edge Type Filter: Rule 1: By default ONLY Hierarchical and Aggregates are shown!
  const [enabledEdgeTypes, setEnabledEdgeTypes] = useState<Set<EdgeTypeKey>>(
    new Set(['HIERARCHICAL', 'AGGREGATE_CROSS_CLUSTER'])
  );

  // Fetch Hierarchical Graph Data from Backend
  const fetchGraphData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const graphData = await api.getGraphHierarchy(activeSection);
      setData(graphData);

      // Handle initial student target if passed via URL or navigation
      if (initialStudentId) {
        // Find student in clusters
        for (const cl of graphData.clusters) {
          const matched = cl.members.find(
            (m) => m.roll_no === initialStudentId || m.id === initialStudentId
          );
          if (matched) {
            setExpandedClusterId(cl.id);
            setActiveLayer(3);
            loadStudentDossier(matched.roll_no);
            break;
          }
        }
      } else {
        // Default landing view: Layer 1 Section view with clusters
        setActiveLayer(1);
        setExpandedClusterId(null);
        setSelectedNode(null);
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to construct hierarchical graph');
    } finally {
      setLoading(false);
    }
  }, [activeSection, initialStudentId]);

  useEffect(() => {
    fetchGraphData();
  }, [fetchGraphData]);

  // Load Dossier for a student
  const loadStudentDossier = async (rollNo: string) => {
    setDossierLoading(true);
    try {
      const prof = await api.getStudentProfile(rollNo);
      setDossier(prof);
    } catch (err: any) {
      console.error('Failed to load dossier:', err);
    } finally {
      setDossierLoading(false);
    }
  };

  // Node Selection Handler with Toggle Support
  const handleSelectNode = (node: RenderableNode | null) => {
    if (!node) {
      // Clicked on empty space: return to previous layer
      setSelectedNode(null);
      setDossier(null);
      if (activeLayer === 3) {
        setActiveLayer(expandedClusterId ? 2 : 1);
      } else if (activeLayer === 2) {
        setExpandedClusterId(null);
        setActiveLayer(1);
      }
      return;
    }

    // Toggle: clicking the already selected node deselects / closes it!
    if (selectedNode && selectedNode.id === node.id) {
      setSelectedNode(null);
      setDossier(null);
      if (node.kind === 'cluster') {
        setExpandedClusterId(null);
        setActiveLayer(1);
      } else if (node.kind === 'student') {
        setActiveLayer(expandedClusterId ? 2 : 1);
      }
      return;
    }

    setSelectedNode(node);

    if (node.kind === 'student') {
      setActiveLayer(3);
      if (node.data?.roll_no) {
        loadStudentDossier(node.data.roll_no);
      }
    } else if (node.kind === 'cluster') {
      setActiveLayer(2);
      setExpandedClusterId(node.id);
    } else if (node.kind === 'section') {
      setActiveLayer(1);
      setExpandedClusterId(null);
    }
  };

  // Cluster Selection / Toggle
  const handleSelectCluster = (clusterId: string | null) => {
    if (!clusterId || clusterId === expandedClusterId) {
      setExpandedClusterId(null);
      setActiveLayer(1);
      setSelectedNode(null);
      setDossier(null);
    } else {
      setExpandedClusterId(clusterId);
      setActiveLayer(2);
      if (data && data.clusters) {
        const cl = data.clusters.find((c) => c.id === clusterId);
        if (cl) {
          setSelectedNode({
            id: cl.id,
            kind: 'cluster',
            x: 0,
            y: 0,
            label: cl.name,
            subLabel: `${cl.member_count} members`,
            radius: NodeRenderer.getNodeRadius('cluster', cl),
            color: cl.risk_color,
            strokeColor: cl.risk_color,
            strokeWidth: 2,
            opacity: 1,
            data: cl,
          });
        }
      }
    }
  };

  // Breadcrumb Segments Construction
  const breadcrumbSegments: BreadcrumbSegment[] = useMemo(() => {
    const segments: BreadcrumbSegment[] = [
      {
        level: 0,
        id: 'inst-root',
        label: data?.institution?.name || 'College',
      },
      {
        level: 1,
        id: `sec-${activeSection}`,
        label: `Section ${activeSection}`,
        subLabel: `${data?.section?.student_count || 0} students`,
      },
    ];

    if (expandedClusterId && data?.clusters) {
      const cl = data.clusters.find((c) => c.id === expandedClusterId);
      if (cl) {
        segments.push({
          level: 2,
          id: cl.id,
          label: cl.name,
          color: cl.risk_color,
          subLabel: `${cl.member_count} members`,
        });
      }
    }

    if (selectedNode && selectedNode.kind === 'student') {
      segments.push({
        level: 3,
        id: selectedNode.id,
        label: selectedNode.label,
        subLabel: selectedNode.subLabel,
        color: selectedNode.color,
      });
    }

    return segments;
  }, [data, activeSection, expandedClusterId, selectedNode]);

  // Handle Clicking on Breadcrumb Segment
  const handleSelectBreadcrumb = (level: number, id: string) => {
    if (level === 0) {
      setActiveLayer(0);
      setExpandedClusterId(null);
      setSelectedNode(null);
    } else if (level === 1) {
      setActiveLayer(1);
      setExpandedClusterId(null);
      setSelectedNode(null);
    } else if (level === 2) {
      setActiveLayer(2);
      setExpandedClusterId(id);
      setSelectedNode(null);
    } else if (level === 3) {
      setActiveLayer(3);
    }
  };

  const handleStepBack = () => {
    if (activeLayer === 3) {
      setActiveLayer(expandedClusterId ? 2 : 1);
      setSelectedNode(null);
    } else if (activeLayer === 2) {
      setActiveLayer(1);
      setExpandedClusterId(null);
      setSelectedNode(null);
    } else if (activeLayer === 1) {
      setActiveLayer(0);
    }
  };

  // Edge Type Toggle Handlers
  const handleToggleEdgeType = (type: EdgeTypeKey) => {
    setEnabledEdgeTypes((prev) => {
      const next = new Set(prev);
      if (next.has(type)) {
        next.delete(type);
      } else {
        next.add(type);
      }
      return next;
    });
  };

  const handleSetEdgePreset = (types: EdgeTypeKey[]) => {
    setEnabledEdgeTypes(new Set(types));
  };

  // Search Jump to Student
  const handleSearchSelect = (rollNo: string) => {
    if (!data) return;
    for (const cl of data.clusters) {
      const student = cl.members.find(
        (m) => m.roll_no.toLowerCase() === rollNo.toLowerCase() || m.name.toLowerCase().includes(rollNo.toLowerCase())
      );
      if (student) {
        setExpandedClusterId(cl.id);
        setActiveLayer(3);
        loadStudentDossier(student.roll_no);
        setSearchQuery('');
        break;
      }
    }
  };

  // Export JSON dossier
  const handleExportJson = () => {
    if (!data) return;
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Hierarchical_Graph_${activeSection}_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Filtered students for quick search autocomplete
  const searchMatches = useMemo(() => {
    if (!data || !searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase();
    const results: HierarchicalStudent[] = [];
    data.clusters.forEach((cl) => {
      cl.members.forEach((m) => {
        if (m.name.toLowerCase().includes(q) || m.roll_no.toLowerCase().includes(q)) {
          results.push(m);
        }
      });
    });
    return results.slice(0, 6);
  }, [data, searchQuery]);

  // Edge type counts for filter badge
  const edgeTypeCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    if (!data?.edges) return counts;
    data.edges.forEach((e) => {
      counts[e.type] = (counts[e.type] || 0) + 1;
    });
    counts['AGGREGATE_CROSS_CLUSTER'] = data.aggregate_edges?.length || 0;
    return counts;
  }, [data]);

  // Loading Screen
  if (loading) {
    return (
      <div className="h-[calc(100vh-100px)] flex flex-col items-center justify-center space-y-3">
        <div className="w-10 h-10 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        <p className="text-xs font-mono text-on-surface-variant tracking-wide">
          Running Louvain community detection & building layered graph for Section {activeSection}...
        </p>
      </div>
    );
  }

  // Error Screen
  if (error || !data) {
    return (
      <div className="h-[calc(100vh-100px)] flex flex-col items-center justify-center p-6">
        <div className="p-8 bg-surface-container-lowest border border-error/30 rounded-2xl text-center max-w-md space-y-4 shadow-sm">
          <span className="material-symbols-outlined text-[36px] text-error">hub</span>
          <h2 className="text-base font-bold text-on-surface">Knowledge Graph Error</h2>
          <p className="text-xs text-on-surface-variant leading-relaxed">{error}</p>
          <button
            onClick={fetchGraphData}
            className="px-4 py-2 bg-primary text-on-primary rounded-xl text-xs font-semibold hover:opacity-90 transition-opacity cursor-pointer inline-flex items-center gap-1.5"
          >
            <span className="material-symbols-outlined text-[16px]">refresh</span> Retry Computation
          </button>
        </div>
      </div>
    );
  }

  const delinquentCount = data.summary?.delinquents_count || 0;

  return (
    <div className="h-[calc(100vh-112px)] flex flex-col space-y-2 pb-0">
      {/* ─── Top Graph Control Toolbar (Section 5) ─────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-1">
        {/* Left: Breadcrumb Navigation & Layer Status */}
        <div className="flex items-center gap-2">
          <GraphBreadcrumb
            segments={breadcrumbSegments}
            onSelectSegment={handleSelectBreadcrumb}
            onStepBack={handleStepBack}
          />

          {/* Delinquency Count Indicator */}
          {delinquentCount > 0 && (
            <button
              onClick={() => {
                setDelinquentsOnly(!delinquentsOnly);
                if (!delinquentsOnly) {
                  // Find high risk cluster and expand it
                  const highRiskCl = data.clusters.find((c) => c.aggregate_risk === 'HIGH');
                  if (highRiskCl) {
                    setExpandedClusterId(highRiskCl.id);
                    setActiveLayer(2);
                  }
                }
              }}
              className={`hidden sm:inline-flex items-center gap-1.5 text-[11px] font-mono font-bold px-2.5 py-1.5 rounded-xl border transition-all cursor-pointer shadow-2xs ${
                delinquentsOnly
                  ? 'bg-rose-500 text-white border-rose-600 shadow-rose-500/20'
                  : 'bg-rose-500/10 text-rose-500 border-rose-500/30 hover:bg-rose-500/20'
              }`}
              title="Highlight delinquent attendance patterns"
            >
              <span className="material-symbols-outlined text-[14px]">local_fire_department</span>
              <span>{delinquentCount} Delinquents</span>
            </button>
          )}
        </div>

        {/* Right: Controls & Search */}
        <div className="flex items-center gap-2">
          {/* Student Search Bar */}
          <div className="relative">
            <div className="flex items-center relative">
              <span className="material-symbols-outlined absolute left-2.5 text-on-surface-variant text-[15px] pointer-events-none">
                search
              </span>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search student or roll..."
                className="w-48 sm:w-56 pl-8 pr-3 py-1.5 bg-surface-container-low border border-outline-variant/80 rounded-xl text-xs text-on-surface placeholder:text-on-surface-variant/60 focus:outline-none focus:border-primary transition-all font-mono"
              />
            </div>

            {/* Autocomplete dropdown */}
            {searchMatches.length > 0 && (
              <div className="absolute left-0 right-0 mt-1 bg-surface-container-lowest border border-outline-variant rounded-xl shadow-xl z-50 p-1 font-sans">
                {searchMatches.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => handleSearchSelect(m.roll_no)}
                    className="w-full px-2.5 py-1.5 text-left rounded-lg hover:bg-surface-container flex items-center justify-between text-xs cursor-pointer"
                  >
                    <div>
                      <div className="font-semibold text-on-surface">{m.name}</div>
                      <div className="text-[10px] font-mono text-on-surface-variant">{m.roll_no}</div>
                    </div>
                    <span
                      className="text-[9px] font-mono px-1.5 py-0.5 rounded font-bold"
                      style={{ color: m.risk_color, backgroundColor: `${m.risk_color}18` }}
                    >
                      {m.attendance_pct}%
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Layout Mode Selector */}
          <div className="flex items-center bg-surface-container-low border border-outline-variant/80 rounded-xl p-0.5 shadow-2xs">
            {(['Hierarchical', 'Radial', 'Force', 'Circular'] as LayoutMode[]).map((mode) => (
              <button
                key={mode}
                onClick={() => setLayoutMode(mode)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-mono transition-all cursor-pointer ${
                  layoutMode === mode
                    ? 'bg-surface-container-highest text-on-surface font-bold shadow-2xs'
                    : 'text-on-surface-variant hover:text-on-surface'
                }`}
                title={`Switch layout to ${mode}`}
              >
                {mode}
              </button>
            ))}
          </div>

          {/* Edge Type Selector Dropdown */}
          <EdgeTypeFilter
            enabledTypes={enabledEdgeTypes}
            onToggleType={handleToggleEdgeType}
            onSetPreset={handleSetEdgePreset}
            edgeCounts={edgeTypeCounts}
          />

          {/* Zoom Controls Capsule */}
          <div className="flex items-center bg-surface-container-low border border-outline-variant/80 rounded-xl px-1.5 py-1 text-xs shadow-2xs font-mono">
            <button
              onClick={() => setZoomScale((z) => Math.max(0.2, Math.round((z - 0.15) * 100) / 100))}
              className="w-6 h-6 rounded flex items-center justify-center hover:bg-surface-container text-on-surface-variant cursor-pointer transition-colors"
              title="Zoom out"
            >
              <span className="material-symbols-outlined text-[15px]">remove</span>
            </button>
            <span className="text-[10px] px-1.5 select-none text-on-surface font-bold min-w-[42px] text-center">
              {Math.round(zoomScale * 100)}%
            </span>
            <button
              onClick={() => setZoomScale((z) => Math.min(2.8, Math.round((z + 0.15) * 100) / 100))}
              className="w-6 h-6 rounded flex items-center justify-center hover:bg-surface-container text-on-surface-variant cursor-pointer transition-colors"
              title="Zoom in"
            >
              <span className="material-symbols-outlined text-[15px]">add</span>
            </button>
            <button
              onClick={() => setZoomScale(1.0)}
              className="w-6 h-6 rounded flex items-center justify-center hover:bg-surface-container text-on-surface-variant hover:text-on-surface cursor-pointer transition-colors ml-0.5"
              title="Fit to Screen (100%)"
            >
              <span className="material-symbols-outlined text-[14px]">fit_screen</span>
            </button>
          </div>

          {/* Export JSON Button */}
          <button
            onClick={handleExportJson}
            className="p-1.5 rounded-xl border border-outline-variant/80 bg-surface-container-low hover:bg-surface-container text-on-surface-variant hover:text-on-surface transition-colors cursor-pointer shadow-2xs"
            title="Export Graph Dossier JSON"
          >
            <span className="material-symbols-outlined text-[17px]">download</span>
          </button>

          {/* Refresh Computation */}
          <button
            onClick={fetchGraphData}
            className="p-1.5 rounded-xl border border-outline-variant/80 bg-surface-container-low hover:bg-surface-container text-on-surface-variant hover:text-primary transition-colors cursor-pointer shadow-2xs"
            title="Refresh Knowledge Graph"
          >
            <span className="material-symbols-outlined text-[17px]">refresh</span>
          </button>
        </div>
      </div>

      {/* ─── 78% Knowledge Graph Canvas / 22% Dedicated Dossier Workspace ────────── */}
      <div className="flex-1 flex flex-col lg:flex-row gap-2.5 min-h-0 overflow-hidden">
        {/* ─── 78% Multi-Layer Knowledge Graph Canvas ────────────────────────────── */}
        <div className="w-full lg:w-[77%] h-full bg-surface-container-lowest border border-outline-variant/80 rounded-2xl relative overflow-hidden shadow-xs flex flex-col">
          <ClassroomGraph
            data={data}
            activeLayer={activeLayer}
            expandedClusterId={expandedClusterId}
            selectedNodeId={selectedNode?.id || null}
            onSelectNode={handleSelectNode}
            onSelectCluster={handleSelectCluster}
            enabledEdgeTypes={enabledEdgeTypes}
            layoutMode={layoutMode}
            zoomScale={zoomScale}
            onZoomChange={setZoomScale}
          />
        </div>

        {/* ─── 23% Dedicated Focus & Dossier Inspector Panel ─────────────────────── */}
        <div className="w-full lg:w-[23%] h-full bg-surface-container-lowest border border-outline-variant/80 rounded-2xl shadow-xs flex flex-col overflow-hidden">
          {dossierLoading ? (
            <div className="flex-1 flex flex-col items-center justify-center space-y-2 p-4">
              <div className="w-7 h-7 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              <span className="text-xs font-mono text-on-surface-variant">
                Querying student dossier & peer ties...
              </span>
            </div>
          ) : selectedNode && selectedNode.kind === 'student' && dossier ? (
            /* Student Deep-Dive Dossier */
            <div className="flex-1 flex flex-col p-4 overflow-y-auto space-y-3.5 custom-scrollbar">
              {/* Header Profile Badge */}
              <div className="border-b border-outline-variant/60 pb-3">
                <div className="flex items-center justify-between gap-1 mb-1">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-primary/10 text-primary border border-primary/20">
                      {dossier.roll_no}
                    </span>
                    <span
                      className={`text-[9px] font-bold px-2 py-0.5 rounded ${
                        dossier.is_delinquent
                          ? 'bg-rose-500/15 text-rose-500 border border-rose-500/30'
                          : 'bg-surface-container text-on-surface-variant'
                      }`}
                    >
                      {dossier.delinquency_label || dossier.role}
                    </span>
                  </div>
                  <button
                    onClick={() => handleSelectNode(null)}
                    className="p-1 rounded-lg hover:bg-surface-container text-on-surface-variant hover:text-on-surface transition-colors cursor-pointer"
                    title="Close Dossier"
                  >
                    <span className="material-symbols-outlined text-[15px]">close</span>
                  </button>
                </div>
                <h3 className="text-sm font-bold text-on-surface leading-snug font-sans">
                  {dossier.name}
                </h3>
                <p className="text-[11px] text-on-surface-variant font-mono">
                  {dossier.cohort} · {dossier.branch}
                </p>
              </div>

              {/* Delinquency Warning Box */}
              {dossier.is_delinquent && (
                <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400 space-y-1">
                  <div className="flex items-center gap-1.5 font-bold text-xs font-mono">
                    <span className="material-symbols-outlined text-[15px]">local_fire_department</span>
                    <span>Delinquency Alert</span>
                  </div>
                  <p className="text-[11px] text-on-surface-variant leading-relaxed">
                    Student has missed {dossier.absences} sessions with recurrent mutual absences in their peer circle.
                  </p>
                </div>
              )}

              {/* Attendance & PageRank Metrics */}
              <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                <div className="p-2.5 bg-surface-container-low rounded-xl border border-outline-variant/60">
                  <div className="text-[9px] font-bold text-on-surface-variant uppercase tracking-wider">
                    Attendance
                  </div>
                  <div
                    className={`text-base font-extrabold mt-0.5 ${
                      dossier.attendance_pct < 75 ? 'text-rose-500' : 'text-primary'
                    }`}
                  >
                    {dossier.attendance_pct}%
                  </div>
                  <div className="text-[10px] text-on-surface-variant/80 mt-0.5">
                    {dossier.absences} absences
                  </div>
                </div>

                <div className="p-2.5 bg-surface-container-low rounded-xl border border-outline-variant/60">
                  <div className="text-[9px] font-bold text-on-surface-variant uppercase tracking-wider">
                    PageRank
                  </div>
                  <div className="text-base font-extrabold text-primary mt-0.5">
                    {dossier.pagerank.toFixed(3)}
                  </div>
                  <div className="text-[10px] text-on-surface-variant/80 mt-0.5">
                    Centrality Rank
                  </div>
                </div>
              </div>

              {/* Top Co-Absent Peers */}
              {dossier.peers && dossier.peers.length > 0 && (
                <div>
                  <h4 className="text-xs font-bold text-on-surface mb-1.5 flex items-center gap-1.5 font-mono">
                    <span className="material-symbols-outlined text-[14px] text-primary">groups</span>
                    Direct Co-Absent Peers
                  </h4>
                  <div className="space-y-1 max-h-36 overflow-y-auto pr-0.5">
                    {dossier.peers.map((peer, idx) => (
                      <div
                        key={idx}
                        onClick={() => handleSearchSelect(peer.roll_no)}
                        className="p-1.5 rounded-lg bg-surface-container-low border border-outline-variant/60 flex items-center justify-between text-xs hover:border-primary/60 transition-all cursor-pointer group"
                      >
                        <div>
                          <div className="font-semibold text-on-surface group-hover:text-primary transition-colors text-[11px]">
                            {peer.name}
                          </div>
                          <div className="text-[9px] text-on-surface-variant font-mono">
                            {peer.roll_no}
                          </div>
                        </div>
                        <span className="text-[10px] font-bold text-rose-500 px-1.5 py-0.5 rounded bg-rose-500/10 font-mono">
                          {peer.mutual_absences}x mutual
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Action Button */}
              <div className="pt-2 border-t border-outline-variant/60">
                <button
                  onClick={() => onNavigate('interventions', { studentId: dossier.roll_no })}
                  className="w-full py-2.5 bg-primary text-on-primary text-xs font-semibold rounded-xl hover:opacity-90 transition-opacity flex items-center justify-center gap-1.5 cursor-pointer shadow-xs font-sans"
                >
                  <span className="material-symbols-outlined text-[15px]">folder_special</span>
                  Log Proactive Intervention
                </button>
              </div>
            </div>
          ) : selectedNode && selectedNode.kind === 'cluster' ? (
            /* Cluster Focus Inspector */
            <div className="flex-1 flex flex-col p-4 overflow-y-auto space-y-3.5 custom-scrollbar">
              <div className="border-b border-outline-variant/60 pb-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-secondary-container text-on-secondary-container">
                    Friend Circle {selectedNode.data?.cluster_idx}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <span
                      className="text-[9px] font-bold px-2 py-0.5 rounded uppercase font-mono"
                      style={{
                        color: selectedNode.data?.risk_color,
                        backgroundColor: `${selectedNode.data?.risk_color}18`,
                      }}
                    >
                      {selectedNode.data?.aggregate_risk} RISK
                    </span>
                    <button
                      onClick={() => handleSelectCluster(null)}
                      className="p-1 rounded-lg hover:bg-surface-container text-on-surface-variant hover:text-on-surface transition-colors cursor-pointer"
                      title="Close Cluster View"
                    >
                      <span className="material-symbols-outlined text-[15px]">close</span>
                    </button>
                  </div>
                </div>
                <h3 className="text-sm font-bold text-on-surface mt-1 leading-snug">
                  {selectedNode.label}
                </h3>
                <p className="text-[11px] text-on-surface-variant font-mono mt-0.5">
                  {selectedNode.data?.dominant_classification}
                </p>
              </div>

              {/* Cluster Stats */}
              <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                <div className="p-2.5 bg-surface-container-low rounded-xl border border-outline-variant/60">
                  <div className="text-[9px] font-bold text-on-surface-variant uppercase">Members</div>
                  <div className="text-base font-extrabold text-on-surface mt-0.5">
                    {selectedNode.data?.member_count}
                  </div>
                </div>
                <div className="p-2.5 bg-surface-container-low rounded-xl border border-outline-variant/60">
                  <div className="text-[9px] font-bold text-on-surface-variant uppercase">Avg Att.</div>
                  <div className="text-base font-extrabold text-primary mt-0.5">
                    {selectedNode.data?.avg_attendance}%
                  </div>
                </div>
              </div>

              {/* Members List */}
              <div className="flex-1">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-bold text-on-surface font-mono">Members Roster</span>
                  <span className="text-[10px] text-on-surface-variant font-mono">
                    {selectedNode.data?.members?.length} students
                  </span>
                </div>
                <div className="space-y-1 max-h-56 overflow-y-auto pr-0.5">
                  {selectedNode.data?.members?.map((m: HierarchicalStudent) => (
                    <div
                      key={m.id}
                      onClick={() => handleSearchSelect(m.roll_no)}
                      className="p-2 rounded-lg bg-surface-container-low hover:bg-surface-container border border-outline-variant/50 flex items-center justify-between text-xs cursor-pointer transition-all"
                    >
                      <div>
                        <div className="font-semibold text-on-surface text-[11px]">{m.name}</div>
                        <div className="text-[9px] font-mono text-on-surface-variant">{m.roll_no}</div>
                      </div>
                      <span
                        className="text-[10px] font-bold font-mono px-1.5 py-0.5 rounded"
                        style={{ color: m.risk_color, backgroundColor: `${m.risk_color}18` }}
                      >
                        {m.attendance_pct}%
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Toggle Expansion Button */}
              <div className="pt-2 border-t border-outline-variant/60">
                <button
                  onClick={() => handleSelectCluster(expandedClusterId === selectedNode.id ? null : selectedNode.id)}
                  className="w-full py-2 bg-surface-container-highest hover:bg-surface-container text-on-surface text-xs font-semibold rounded-xl transition-colors flex items-center justify-center gap-1.5 cursor-pointer border border-outline-variant"
                >
                  <span className="material-symbols-outlined text-[15px]">
                    {expandedClusterId === selectedNode.id ? 'compress' : 'expand'}
                  </span>
                  <span>
                    {expandedClusterId === selectedNode.id ? 'Collapse Circle' : 'Expand Orbitally'}
                  </span>
                </button>
              </div>
            </div>
          ) : (
            /* Default Section & Guidance Card */
            <div className="flex-1 flex flex-col p-4 overflow-y-auto space-y-4 text-xs font-sans">
              <div className="border-b border-outline-variant/60 pb-3">
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-primary/10 text-primary border border-primary/20">
                  Section {activeSection}
                </span>
                <h3 className="text-sm font-bold text-on-surface mt-1.5 leading-snug">
                  {data.section?.name || `Classroom ${activeSection}`}
                </h3>
                <p className="text-[11px] text-on-surface-variant font-mono mt-0.5">
                  {data.section?.department} · {data.section?.student_count} Enrolled Students
                </p>
              </div>

              {/* Section Health Summary */}
              <div className="p-3 bg-surface-container-low rounded-xl border border-outline-variant/60 space-y-2 font-mono">
                <div className="flex justify-between items-center text-[11px]">
                  <span className="text-on-surface-variant">Class Average Att:</span>
                  <span className="font-bold text-primary">{data.section?.avg_attendance}%</span>
                </div>
                <div className="flex justify-between items-center text-[11px]">
                  <span className="text-on-surface-variant">Social Circles (Louvain):</span>
                  <span className="font-bold text-on-surface">{data.clusters?.length}</span>
                </div>
                <div className="flex justify-between items-center text-[11px]">
                  <span className="text-on-surface-variant">Delinquency Flags:</span>
                  <span className="font-bold text-rose-500">{data.summary?.delinquents_count}</span>
                </div>
              </div>

              {/* Guidance / Progressive Disclosure Instructions */}
              <div className="p-3 rounded-xl bg-surface-container-low/70 border border-outline-variant/40 space-y-1.5 text-on-surface-variant text-[11px] leading-relaxed">
                <div className="font-bold text-on-surface flex items-center gap-1.5 font-mono">
                  <span className="material-symbols-outlined text-[15px] text-primary">info</span>
                  <span>How to navigate:</span>
                </div>
                <ul className="space-y-1 pl-4 list-disc text-[10.5px]">
                  <li>Click any <strong>Friend Circle</strong> to expand student nodes radially.</li>
                  <li>Click an individual <strong>Student</strong> for deep-dive focus and mutual absence analysis.</li>
                  <li>Use the <strong>Edges dropdown</strong> to toggle BUNKS_WITH or FRIENDS_WITH.</li>
                </ul>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
