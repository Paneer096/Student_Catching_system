/**
 * useHierarchicalLayout.ts
 * Computes deterministic multi-level layout for the knowledge graph:
 * Section (Center) -> Clusters (Ring 1) -> Students (Radial around Cluster Centroid) -> Teachers/Clubs (Outer Ring)
 * Implements Section 4 (Layout Algorithm Changes).
 */

import { useState, useCallback } from 'react';
import { HierarchicalGraphData } from '../../api/client';
import { RenderableNode, NodeRenderer } from './NodeRenderer';
import { RenderableEdge } from './EdgeRenderer';

export type LayoutMode = 'Hierarchical' | 'Radial' | 'Force' | 'Circular';

export interface LayoutOptions {
  width: number;
  height: number;
  expandedClusterId: string | null;
  focusedStudentId?: string | null;
  layoutMode: LayoutMode;
  showTeachers: boolean;
  showClubs: boolean;
  showSubjects?: boolean;
}

export function useHierarchicalLayout() {
  const [isFrozen, setIsFrozen] = useState(false);
  const [simulationIteration, setSimulationIteration] = useState(0);

  /**
   * Compute positions for all nodes and edges based on data, active layer, and layout mode.
   */
  const computeLayout = useCallback(
    (
      data: HierarchicalGraphData,
      options: LayoutOptions
    ): {
      nodes: RenderableNode[];
      edges: RenderableEdge[];
      clusterCentroids: Record<string, { x: number; y: number }>;
    } => {
      const {
        width,
        height,
        expandedClusterId,
        layoutMode,
        showTeachers,
        showClubs,
      } = options;

      const centerX = width / 2;
      const centerY = height / 2;

      const nodes: RenderableNode[] = [];
      const edges: RenderableEdge[] = [];
      const clusterCentroids: Record<string, { x: number; y: number }> = {};

      if (!data || !data.section) {
        return { nodes, edges, clusterCentroids };
      }

      // ─── 1. Section Anchor Node (Top-Center for Hierarchical, Center for Radial) ──
      const sectionX = centerX;
      const sectionY = layoutMode === 'Hierarchical' ? centerY - 130 : centerY;

      const sectionNode: RenderableNode = {
        id: data.section.id,
        kind: 'section',
        x: sectionX,
        y: sectionY,
        label: data.section.name,
        subLabel: `${data.section.student_count} Students · ${data.section.avg_attendance}% Att`,
        radius: NodeRenderer.getNodeRadius('section'),
        color: '#1e293b',
        strokeColor: '#e2e8f0',
        strokeWidth: 3,
        opacity: 1,
        data: data.section,
      };
      nodes.push(sectionNode);

      // ─── 2. Cluster Nodes (Spacious Dual-Row or Wide-Arc Placement) ─────────
      const clusters = data.clusters || [];
      const clusterCount = Math.max(1, clusters.length);

      clusters.forEach((cl, idx) => {
        let cx = centerX;
        let cy = centerY;

        if (layoutMode === 'Hierarchical') {
          if (clusterCount <= 4) {
            const spanX = Math.min(500, (clusterCount - 1) * 180);
            const startX = centerX - spanX / 2;
            const stepX = clusterCount > 1 ? spanX / (clusterCount - 1) : 0;
            cx = startX + idx * stepX;
            cy = centerY + Math.sin((idx / Math.max(1, clusterCount - 1)) * Math.PI) * 35;
          } else {
            // 2 Staggered rows with 190px horizontal spacing and 140px vertical spacing
            const row1Count = Math.ceil(clusterCount / 2);
            const row2Count = clusterCount - row1Count;
            const isRow1 = idx < row1Count;
            const rowIndex = isRow1 ? idx : idx - row1Count;
            const countInThisRow = isRow1 ? row1Count : row2Count;

            const spanX = Math.max(360, (countInThisRow - 1) * 190);
            const startX = centerX - spanX / 2;
            const stepX = countInThisRow > 1 ? spanX / (countInThisRow - 1) : 0;

            cx = startX + rowIndex * stepX;
            // Row 1 sits at centerY - 10, Row 2 sits at centerY + 130
            if (isRow1) {
              cy = centerY - 10 + (rowIndex % 2 === 1 ? -15 : 8);
            } else {
              cy = centerY + 130 + (rowIndex % 2 === 1 ? 15 : -8);
            }
          }
        } else if (layoutMode === 'Circular' || layoutMode === 'Radial') {
          const angle = (2 * Math.PI * idx) / clusterCount - Math.PI / 2;
          const radialDist = Math.max(180, Math.min(width, height) * 0.32);
          cx = centerX + Math.cos(angle) * radialDist;
          cy = centerY + Math.sin(angle) * radialDist;
        } else {
          // Force layout initial seeded positions
          const angle = (2 * Math.PI * idx) / clusterCount;
          const baseRadius = 190;
          cx = centerX + Math.cos(angle) * (baseRadius + (idx % 2) * 30);
          cy = centerY + Math.sin(angle) * (baseRadius + (idx % 2) * 30);
        }

        clusterCentroids[cl.id] = { x: cx, y: cy };

        const colors = NodeRenderer.getNodeColor('cluster', cl);
        const radius = NodeRenderer.getNodeRadius('cluster', cl);

        nodes.push({
          id: cl.id,
          kind: 'cluster',
          x: cx,
          y: cy,
          label: cl.name,
          subLabel: `${cl.member_count} members`,
          radius,
          color: colors.fill,
          strokeColor: colors.stroke,
          strokeWidth: 2.5,
          opacity: 1,
          data: cl,
        });
      });

      // ─── 3. Student Nodes (Radial Orbit around Expanded Cluster Centroid) ───
      clusters.forEach((cl) => {
        const centroid = clusterCentroids[cl.id];
        if (!centroid) return;

        const isExpanded = expandedClusterId === cl.id || expandedClusterId === 'all';
        const members = cl.members || [];
        const memberCount = Math.max(1, members.length);
        const radialExpansionRadius = Math.min(78, Math.max(50, 32 + memberCount * 3.5));

        const sortedMembers = [...members].sort(
          (a, b) => (b.betweenness || 0) - (a.betweenness || 0)
        );

        sortedMembers.forEach((st, sIdx) => {
          let sx = centroid.x;
          let sy = centroid.y;

          if (isExpanded) {
            const angle = (2 * Math.PI * sIdx) / memberCount - Math.PI / 2;
            sx = centroid.x + Math.cos(angle) * radialExpansionRadius;
            sy = centroid.y + Math.sin(angle) * radialExpansionRadius;
          } else {
            sx = centroid.x;
            sy = centroid.y;
          }

          const colors = NodeRenderer.getNodeColor('student', st);
          const radius = NodeRenderer.getNodeRadius('student', st);

          nodes.push({
            id: st.id,
            kind: 'student',
            x: sx,
            y: sy,
            label: st.name,
            subLabel: st.roll_no,
            initials: NodeRenderer.getInitials(st.name),
            radius,
            color: colors.fill,
            strokeColor: colors.stroke,
            strokeWidth: 1.8,
            opacity: isExpanded ? 1 : 0,
            isDelinquent: st.is_delinquent,
            hasRiskBadge: st.classification === 'high_concern' || st.classification === 'at_risk',
            clusterId: cl.id,
            data: st,
          });
        });
      });

      // ─── 4. Faculty (Upper-Left Flank) & Clubs (Upper-Right Flank) ──────────
      if (showTeachers && data.teachers) {
        data.teachers.forEach((tch, idx) => {
          let tx = centerX - 230 - idx * 45;
          let ty = centerY - 125 + (idx % 2) * 28;
          if (layoutMode === 'Radial') {
            const angle = -Math.PI * 0.75 + idx * 0.22;
            tx = centerX + Math.cos(angle) * 280;
            ty = centerY + Math.sin(angle) * 280;
          }

          const colors = NodeRenderer.getNodeColor('teacher', tch);
          nodes.push({
            id: tch.id,
            kind: 'teacher',
            x: tx,
            y: ty,
            label: tch.name,
            subLabel: tch.role,
            radius: NodeRenderer.getNodeRadius('teacher'),
            color: colors.fill,
            strokeColor: colors.stroke,
            strokeWidth: 2,
            opacity: 1,
            data: tch,
          });
        });
      }

      if (showClubs && data.clubs) {
        data.clubs.forEach((club, idx) => {
          let cx = centerX + 230 + idx * 45;
          let cy = centerY - 125 + (idx % 2) * 28;
          if (layoutMode === 'Radial') {
            const angle = -Math.PI * 0.25 - idx * 0.22;
            cx = centerX + Math.cos(angle) * 280;
            cy = centerY + Math.sin(angle) * 280;
          }

          const colors = NodeRenderer.getNodeColor('club', club);
          nodes.push({
            id: club.id,
            kind: 'club',
            x: cx,
            y: cy,
            label: club.name,
            subLabel: `${club.member_count} members`,
            radius: NodeRenderer.getNodeRadius('club'),
            color: colors.fill,
            strokeColor: colors.stroke,
            strokeWidth: 1.8,
            opacity: 1,
            data: club,
          });
        });
      }

      // Map of computed coordinates for fast edge lookup
      const nodePosMap = new Map<string, { x: number; y: number }>();
      nodes.forEach((n) => nodePosMap.set(n.id, { x: n.x, y: n.y }));

      // ─── 5. Edges Mapping ────────────────────────────────────────────────
      // Hierarchical & Granular Typed Edges
      if (data.edges) {
        data.edges.forEach((e, idx) => {
          const sPos = nodePosMap.get(e.source);
          const tPos = nodePosMap.get(e.target);
          if (!sPos || !tPos) return;

          edges.push({
            id: `edge-${idx}`,
            source: e.source,
            target: e.target,
            sourceX: sPos.x,
            sourceY: sPos.y,
            targetX: tPos.x,
            targetY: tPos.y,
            type: e.type,
            weight: e.weight,
            color: e.color || '#64748b',
            label: e.label,
          });
        });
      }

      // Aggregated Inter-Cluster Edges
      if (data.aggregate_edges) {
        data.aggregate_edges.forEach((ae, idx) => {
          const sCentroid = clusterCentroids[ae.source];
          const tCentroid = clusterCentroids[ae.target];
          if (!sCentroid || !tCentroid) return;

          edges.push({
            id: `agg-edge-${idx}`,
            source: ae.source,
            target: ae.target,
            sourceX: sCentroid.x,
            sourceY: sCentroid.y,
            targetX: tCentroid.x,
            targetY: tCentroid.y,
            type: 'AGGREGATE_CROSS_CLUSTER',
            weight: ae.weight,
            color: '#94a3b8',
            label: ae.label,
            count: ae.count,
            isAggregated: true,
          });
        });
      }

      return { nodes, edges, clusterCentroids };
    },
    []
  );

  const stabilize = useCallback(() => {
    setIsFrozen(true);
    setSimulationIteration((prev) => prev + 1);
  }, []);

  const reheat = useCallback(() => {
    setIsFrozen(false);
    setSimulationIteration((prev) => prev + 1);
  }, []);

  return {
    computeLayout,
    isFrozen,
    stabilize,
    reheat,
    simulationIteration,
  };
}
