/**
 * NodeRenderer.ts
 * Visual styling, sizing, color mapping, and label rules for the Hierarchical Knowledge Graph.
 * Implements Section 3 (Node Rendering Rules) & Section 7 (Semantic Zoom).
 */

export type NodeKind = 'section' | 'cluster' | 'student' | 'teacher' | 'club' | 'subject';

export interface RenderableNode {
  id: string;
  kind: NodeKind;
  x: number;
  y: number;
  vx?: number;
  vy?: number;
  label: string;
  subLabel?: string;
  initials?: string;
  radius: number;
  color: string;
  strokeColor: string;
  strokeWidth: number;
  glow?: string;
  opacity: number;
  isDelinquent?: boolean;
  hasRiskBadge?: boolean;
  clusterId?: string;
  data: any;
}

export interface FocusState {
  selectedNodeId: string | null;
  hoveredNodeId: string | null;
  neighborIds: Set<string>;
  zoomLevel: number; // 0.1 to 2.5
  currentLayer: number; // 0 = Institution, 1 = Section, 2 = Cluster, 3 = Student
  expandedClusterId: string | null;
}

export class NodeRenderer {
  /**
   * Determine radius for each node kind based on metrics and focus level.
   */
  static getNodeRadius(kind: NodeKind, data?: any): number {
    switch (kind) {
      case 'section':
        return 32; // Compact anchor
      case 'cluster': {
        const count = data?.member_count || data?.members?.length || 6;
        return Math.max(22, Math.min(28, 18 + count * 0.7));
      }
      case 'student': {
        return 11; // Clean initials, excellent clearance
      }
      case 'teacher':
        return 14;
      case 'club':
        return 13;
      case 'subject':
        return 11;
      default:
        return 11;
    }
  }

  /**
   * Determine semantic color based on node type and risk/classification.
   */
  static getNodeColor(kind: NodeKind, data?: any): { fill: string; stroke: string } {
    switch (kind) {
      case 'section':
        return { fill: '#1e293b', stroke: '#cbd5e1' }; // Clean slate anchor

      case 'cluster': {
        const risk = data?.aggregate_risk || 'LOW';
        if (risk === 'CRITICAL' || risk === 'HIGH') {
          return { fill: '#450a0a', stroke: '#ef4444' };
        }
        if (risk === 'MEDIUM' || risk === 'ORANGE') {
          return { fill: '#431407', stroke: '#f97316' };
        }
        if (risk === 'WATCH' || risk === 'YELLOW') {
          return { fill: '#422006', stroke: '#eab308' };
        }
        return { fill: '#064e3b', stroke: '#10b981' };
      }

      case 'student': {
        const classification = data?.classification || 'good_standing';
        switch (classification) {
          case 'high_concern':
            return { fill: '#7f1d1d', stroke: '#ef4444' };
          case 'at_risk':
            return { fill: '#7c2d12', stroke: '#f97316' };
          case 'watch':
            return { fill: '#713f12', stroke: '#eab308' };
          case 'dual_influence':
            return { fill: '#581c87', stroke: '#a855f7' };
          case 'isolated':
            return { fill: '#334155', stroke: '#94a3b8' };
          case 'good_standing':
          default:
            return { fill: '#064e3b', stroke: '#10b981' };
        }
      }

      case 'teacher':
        return { fill: '#1e3a8a', stroke: '#3b82f6' }; // Faculty Blue

      case 'club':
        return { fill: '#164e63', stroke: '#06b6d4' }; // Club Cyan

      case 'subject':
        return { fill: '#701a75', stroke: '#d946ef' }; // Subject Magenta

      default:
        return { fill: '#1e293b', stroke: '#64748b' };
    }
  }

  /**
   * Calculate opacity and focus styling (glow, border) based on selection & hover.
   */
  static getFocusStyle(
    nodeId: string,
    state: FocusState
  ): { opacity: number; strokeWidth: number; strokeColor?: string; glow?: string } {
    const { selectedNodeId, hoveredNodeId, neighborIds } = state;
    const isSelected = selectedNodeId === nodeId;
    const isHovered = hoveredNodeId === nodeId;
    const isNeighbor = neighborIds.has(nodeId);
    const hasFocus = selectedNodeId !== null || hoveredNodeId !== null;

    if (isSelected) {
      return {
        opacity: 1.0,
        strokeWidth: 3.5,
        strokeColor: '#facc15',
        glow: '0 0 16px rgba(250, 204, 21, 0.8)',
      };
    }

    if (isHovered) {
      return {
        opacity: 1.0,
        strokeWidth: 2.5,
        strokeColor: '#ffffff',
        glow: '0 0 12px rgba(255, 255, 255, 0.7)',
      };
    }

    if (hasFocus) {
      if (isNeighbor) {
        return {
          opacity: 0.85,
          strokeWidth: 1.5,
          strokeColor: '#ffffff',
          glow: '0 0 6px rgba(255, 255, 255, 0.4)',
        };
      }
      // Faded background context (Section 1: Rule 2: 15% opacity)
      return {
        opacity: 0.12,
        strokeWidth: 1.0,
      };
    }

    // Default neutral state
    return {
      opacity: 0.95,
      strokeWidth: 1.5,
    };
  }

  /**
   * Determine label visibility according to Semantic Zoom specification.
   */
  static shouldShowLabel(
    kind: NodeKind,
    zoomLevel: number,
    isFocusedOrNeighbor: boolean,
    isBackgroundFaded: boolean
  ): { show: boolean; detailLevel: 'full' | 'initials' | 'count_only' } {
    if (isBackgroundFaded) {
      return { show: false, detailLevel: 'initials' };
    }

    if (isFocusedOrNeighbor) {
      return { show: true, detailLevel: 'full' };
    }

    switch (kind) {
      case 'section':
        return { show: true, detailLevel: 'full' };

      case 'cluster':
        // Show cluster labels from 25% zoom upwards
        return { show: zoomLevel >= 0.25, detailLevel: 'full' };

      case 'student':
        if (zoomLevel >= 0.75) {
          return { show: true, detailLevel: 'full' };
        }
        if (zoomLevel >= 0.5) {
          return { show: true, detailLevel: 'initials' };
        }
        return { show: false, detailLevel: 'initials' };

      case 'teacher':
      case 'club':
      case 'subject':
        return { show: zoomLevel >= 0.4, detailLevel: 'full' };

      default:
        return { show: false, detailLevel: 'initials' };
    }
  }

  /**
   * Get 2-letter initials from full student name.
   */
  static getInitials(name: string): string {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
    }
    return (name.slice(0, 2) || 'ST').toUpperCase();
  }
}
