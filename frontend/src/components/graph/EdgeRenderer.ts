/**
 * EdgeRenderer.ts
 * Curved quadratic Bezier curves, directional arrows, opacity by relevance,
 * hierarchical edge aggregation, and selective particle animations.
 * Implements Section 2 (Edge Rendering Rules).
 */

export type EdgeTypeKey =
  | 'HIERARCHICAL'
  | 'FRIENDS_WITH'
  | 'BUNKS_WITH'
  | 'STUDIES_WITH'
  | 'TAGGED_AS'
  | 'INTERVENED_ON'
  | 'MEMBER_OF'
  | 'ATTENDS'
  | 'AGGREGATE_CROSS_CLUSTER';

export interface RenderableEdge {
  id: string;
  source: string;
  target: string;
  sourceX: number;
  sourceY: number;
  targetX: number;
  targetY: number;
  type: EdgeTypeKey;
  weight: number;
  color: string;
  label?: string;
  count?: number;
  isAggregated?: boolean;
}

export const EDGE_TYPE_CONFIG: Record<
  EdgeTypeKey,
  { label: string; color: string; defaultVisible: boolean; description: string }
> = {
  HIERARCHICAL: {
    label: 'Hierarchical (Section → Cluster → Student)',
    color: '#64748b',
    defaultVisible: true,
    description: 'Structural containment and governance links',
  },
  FRIENDS_WITH: {
    label: 'FRIENDS_WITH (Peer Survey)',
    color: '#4ade80',
    defaultVisible: false,
    description: 'Mutual friendships verified by peer responses',
  },
  BUNKS_WITH: {
    label: 'BUNKS_WITH (Co-absences)',
    color: '#ef4444',
    defaultVisible: false,
    description: 'Mutual absence clusters across academic periods',
  },
  STUDIES_WITH: {
    label: 'STUDIES_WITH (Study Partners)',
    color: '#3b82f6',
    defaultVisible: false,
    description: 'Lab and academic study collaborations',
  },
  TAGGED_AS: {
    label: 'TAGGED_AS (Teacher Observations)',
    color: '#f59e0b',
    defaultVisible: false,
    description: 'Faculty observation notices and behavioral notes',
  },
  INTERVENED_ON: {
    label: 'INTERVENED_ON (Support Cases)',
    color: '#a855f7',
    defaultVisible: false,
    description: 'Mentorship and counseling action cases',
  },
  MEMBER_OF: {
    label: 'MEMBER_OF (Clubs & Societies)',
    color: '#06b6d4',
    defaultVisible: false,
    description: 'Participation in official extracurricular clubs',
  },
  ATTENDS: {
    label: 'ATTENDS (Subject Courses)',
    color: '#818cf8',
    defaultVisible: false,
    description: 'Classroom subject period attendance',
  },
  AGGREGATE_CROSS_CLUSTER: {
    label: 'Cross-Circle Bundles',
    color: '#94a3b8',
    defaultVisible: true,
    description: 'Thick bundled connections between friend groups',
  },
};

export class EdgeRenderer {
  /**
   * Calculate quadratic Bezier curved path: M sx,sy Q cx,cy tx,ty
   * Curvature is offset perpendicular to the line to prevent straight line overlaps.
   */
  static calculateBezierPath(
    sx: number,
    sy: number,
    tx: number,
    ty: number,
    curveFactor = 0.15,
    indexOffset = 0
  ): { path: string; midX: number; midY: number } {
    const dx = tx - sx;
    const dy = ty - sy;
    const dist = Math.hypot(dx, dy);

    if (dist < 1) {
      return { path: `M ${sx},${sy} L ${tx},${ty}`, midX: sx, midY: sy };
    }

    // Midpoint between source and target
    const mx = (sx + tx) / 2;
    const my = (sy + ty) / 2;

    // Normal vector perpendicular to line
    const nx = -dy / dist;
    const ny = dx / dist;

    // Offset control point based on distance and index
    const offset = (dist * curveFactor + indexOffset * 10);
    const cx = mx + nx * offset;
    const cy = my + ny * offset;

    // Point along curve for label placing (t=0.5 on quadratic bezier: B(0.5) = 0.25*P0 + 0.5*P1 + 0.25*P2)
    const curveMidX = 0.25 * sx + 0.5 * cx + 0.25 * tx;
    const curveMidY = 0.25 * sy + 0.5 * cy + 0.25 * ty;

    return {
      path: `M ${sx} ${sy} Q ${cx} ${cy} ${tx} ${ty}`,
      midX: curveMidX,
      midY: curveMidY,
    };
  }

  /**
   * Determine edge opacity based on relevance to selected/hovered focus.
   * Section 2: Rule 4
   */
  static getEdgeOpacity(
    sourceId: string,
    targetId: string,
    selectedNodeId: string | null,
    hoveredNodeId: string | null,
    neighborIds: Set<string>
  ): number {
    const focusId = hoveredNodeId || selectedNodeId;

    if (!focusId) {
      // Default rest opacity
      return 0.45;
    }

    // Directly connected to the focused node
    if (sourceId === focusId || targetId === focusId) {
      return 1.0;
    }

    // Connected between neighbors of the focused node
    if (neighborIds.has(sourceId) && neighborIds.has(targetId)) {
      return 0.35;
    }

    // Background edge: faded to prevent visual noise
    return 0.06;
  }

  /**
   * Get stroke width scaled by weight or aggregated count.
   */
  static getEdgeStrokeWidth(
    edge: RenderableEdge,
    isDirectlyConnected: boolean
  ): number {
    if (edge.isAggregated) {
      const count = edge.count || edge.weight || 2;
      return Math.min(8, Math.max(2.5, 1.8 + Math.log2(count) * 1.5));
    }

    const base = Math.min(4.5, 1.2 + (edge.weight - 1) * 0.4);
    return isDirectlyConnected ? base * 1.6 : base;
  }

  /**
   * Get color for edge type.
   */
  static getEdgeColor(type: EdgeTypeKey): string {
    return EDGE_TYPE_CONFIG[type]?.color || '#64748b';
  }
}
