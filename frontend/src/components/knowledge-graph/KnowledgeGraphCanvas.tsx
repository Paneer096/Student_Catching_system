import { useRef, useEffect, useState, useMemo, useCallback, forwardRef, useImperativeHandle } from 'react';
import ForceGraph2D from 'react-force-graph-2d';

export interface CanvasNode {
  id: string;
  label: string;
  type: string;
  community?: number;
  pagerank?: number;
  degree?: number;
  properties?: Record<string, any>;
  color?: string;
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
  fx?: number | null;
  fy?: number | null;
  [key: string]: any;
}

export interface CanvasEdge {
  source: string | CanvasNode;
  target: string | CanvasNode;
  type: string;
  weight?: number;
  timestamp?: string;
  properties?: Record<string, any>;
  [key: string]: any;
}

export interface KnowledgeGraphCanvasProps {
  nodes: CanvasNode[];
  edges: CanvasEdge[];
  nodeTypesMap: Record<string, { color: string; icon: string; description: string }>;
  selectedNode: CanvasNode | null;
  onSelectNode: (node: CanvasNode | null) => void;
  hoveredNode: CanvasNode | null;
  onHoverNode: (node: CanvasNode | null) => void;
  searchQuery?: string;
  highlightedPath?: { nodes: string[]; edges: any[] } | null;
  layoutMode: 'force' | 'hierarchical' | 'radial';
  isPhysicsPaused: boolean;
  isParticlesEnabled: boolean;
  onSelectEdge?: (edge: any) => void;
  anonymizeNames?: boolean;
}

export interface KnowledgeGraphCanvasRef {
  zoomIn: () => void;
  zoomOut: () => void;
  zoomToFit: () => void;
  focusNode: (nodeId: string) => void;
  exportImage: () => void;
  exportJson: () => void;
}

export const KnowledgeGraphCanvas = forwardRef<KnowledgeGraphCanvasRef, KnowledgeGraphCanvasProps>(({
  nodes,
  edges,
  nodeTypesMap,
  selectedNode,
  onSelectNode,
  hoveredNode,
  onHoverNode,
  searchQuery = '',
  highlightedPath = null,
  layoutMode,
  isPhysicsPaused,
  isParticlesEnabled: _isParticlesEnabled,
  onSelectEdge,
  anonymizeNames = false,
}, ref) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const fgRef = useRef<any>(null);
  const [dimensions, setDimensions] = useState<{ width: number; height: number }>({ width: 800, height: 600 });

  // Keep track of search matches for glowing ring halo
  const searchMatchedNodeIds = useMemo(() => {
    if (!searchQuery.trim()) return new Set<string>();
    const q = searchQuery.toLowerCase().trim();
    const matched = new Set<string>();
    nodes.forEach((n) => {
      if (
        n.label.toLowerCase().includes(q) ||
        n.id.toLowerCase().includes(q) ||
        n.type.toLowerCase().includes(q)
      ) {
        matched.add(n.id);
      }
    });
    return matched;
  }, [nodes, searchQuery]);

  // Set of node and edge IDs in the highlighted path
  const pathNodeIds = useMemo(() => {
    if (!highlightedPath || !highlightedPath.nodes) return null;
    return new Set(highlightedPath.nodes);
  }, [highlightedPath]);

  const pathEdgePairs = useMemo(() => {
    if (!highlightedPath || !highlightedPath.edges) return null;
    const pairs = new Set<string>();
    highlightedPath.edges.forEach((e) => {
      const u = typeof e.source === 'object' ? e.source.id : e.source;
      const v = typeof e.target === 'object' ? e.target.id : e.target;
      pairs.add(`${u}__${v}`);
      pairs.add(`${v}__${u}`);
    });
    return pairs;
  }, [highlightedPath]);

  // Multi-edge deduplication: consolidate parallel links between same pair of nodes
  const consolidatedGraphData = useMemo(() => {
    const pairMap = new Map<string, {
      source: string;
      target: string;
      types: Set<string>;
      weights: number[];
      rawEdges: CanvasEdge[];
    }>();

    edges.forEach((e) => {
      const u = String(typeof e.source === 'object' ? e.source.id : e.source);
      const v = String(typeof e.target === 'object' ? e.target.id : e.target);
      const key = u < v ? `${u}__${v}` : `${v}__${u}`;

      if (!pairMap.has(key)) {
        pairMap.set(key, {
          source: u,
          target: v,
          types: new Set([e.type]),
          weights: [e.weight ?? 1],
          rawEdges: [e],
        });
      } else {
        const item = pairMap.get(key)!;
        item.types.add(e.type);
        item.weights.push(e.weight ?? 1);
        item.rawEdges.push(e);
      }
    });

    const links = Array.from(pairMap.values()).map((item) => {
      const isPathEdge = pathEdgePairs ? pathEdgePairs.has(`${item.source}__${item.target}`) : false;
      const avgWeight = item.weights.reduce((a, b) => a + b, 0) / item.weights.length;
      return {
        source: item.source,
        target: item.target,
        type: Array.from(item.types).join(' • '),
        weight: avgWeight,
        isPathEdge,
        rawEdges: item.rawEdges,
      };
    });

    return {
      nodes: nodes.map((n) => ({
        ...n,
        color: nodeTypesMap[n.type]?.color || '#00b4ff',
      })),
      links,
    };
  }, [nodes, edges, nodeTypesMap, pathEdgePairs]);

  // Handle window resizing safely with ResizeObserver to prevent crashes
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0) {
          setDimensions({ width: Math.floor(width), height: Math.floor(height) });
        }
      }
    });

    ro.observe(container);
    return () => ro.disconnect();
  }, []);

  // Update physics pause/resume
  useEffect(() => {
    if (!fgRef.current) return;
    if (isPhysicsPaused) {
      fgRef.current.pauseAnimation();
    } else {
      fgRef.current.resumeAnimation();
    }
  }, [isPhysicsPaused]);

  // Adjust forces or layout based on layoutMode
  useEffect(() => {
    if (!fgRef.current) return;
    const fg = fgRef.current;

    if (layoutMode === 'hierarchical') {
      // Position nodes in horizontal/vertical layers according to node type or community
      const layerOrder: Record<string, number> = {
        Classroom: 0,
        Institution: 0,
        Faculty: 1,
        Course: 2,
        Student: 3,
        Incident: 4,
        Club: 4,
      };

      const nodesByLayer: Record<number, CanvasNode[]> = {};
      consolidatedGraphData.nodes.forEach((n) => {
        const lvl = layerOrder[n.type] ?? 2;
        if (!nodesByLayer[lvl]) nodesByLayer[lvl] = [];
        nodesByLayer[lvl].push(n);
      });

      const totalLayers = Math.max(1, Object.keys(nodesByLayer).length);
      const layerSpacing = (dimensions.height * 0.75) / (totalLayers + 1);

      Object.entries(nodesByLayer).forEach(([lvlStr, layerNodes]) => {
        const lvl = parseInt(lvlStr, 10);
        const y = (lvl - totalLayers / 2) * layerSpacing;
        const xStep = Math.min(120, (dimensions.width * 0.8) / (layerNodes.length + 1));
        const startX = -((layerNodes.length - 1) * xStep) / 2;

        layerNodes.forEach((node, idx) => {
          node.fx = startX + idx * xStep;
          node.fy = y;
        });
      });
      fg.d3ReheatSimulation();
    } else if (layoutMode === 'radial') {
      // Concentric rings centered around highest pagerank hub
      const sorted = [...consolidatedGraphData.nodes].sort((a, b) => (b.pagerank || 0) - (a.pagerank || 0));
      const centerNode = sorted[0];

      if (centerNode) {
        centerNode.fx = 0;
        centerNode.fy = 0;

        const ringRadii = [120, 240, 360, 480];
        const remaining = sorted.slice(1);
        const nodesPerRing = Math.ceil(remaining.length / ringRadii.length);

        remaining.forEach((node, idx) => {
          const ringIdx = Math.min(ringRadii.length - 1, Math.floor(idx / nodesPerRing));
          const r = ringRadii[ringIdx];
          const countInRing = Math.min(nodesPerRing, remaining.length - ringIdx * nodesPerRing);
          const angle = ((idx % nodesPerRing) / countInRing) * 2 * Math.PI;
          node.fx = r * Math.cos(angle);
          node.fy = r * Math.sin(angle);
        });
      }
      fg.d3ReheatSimulation();
    } else {
      // Organic Force-Directed
      consolidatedGraphData.nodes.forEach((n) => {
        n.fx = null;
        n.fy = null;
      });
      const chargeForce = fg.d3Force('charge');
      if (chargeForce) chargeForce.strength(-520);
      const linkForce = fg.d3Force('link');
      if (linkForce) linkForce.distance(110);
      fg.d3ReheatSimulation();
    }
  }, [layoutMode, consolidatedGraphData.nodes, dimensions]);

  // Imperative ref API for camera controls & export
  useImperativeHandle(ref, () => ({
    zoomIn: () => {
      if (!fgRef.current) return;
      const current = fgRef.current.zoom();
      fgRef.current.zoom(current * 1.35, 350);
    },
    zoomOut: () => {
      if (!fgRef.current) return;
      const current = fgRef.current.zoom();
      fgRef.current.zoom(current / 1.35, 350);
    },
    zoomToFit: () => {
      if (!fgRef.current) return;
      fgRef.current.zoomToFit(400, 50);
    },
    focusNode: (nodeId: string) => {
      const node = consolidatedGraphData.nodes.find((n) => n.id === nodeId);
      if (node && node.x !== undefined && node.y !== undefined && fgRef.current) {
        fgRef.current.centerAt(node.x, node.y, 600);
        fgRef.current.zoom(2.5, 600);
        onSelectNode(node);
      }
    },
    exportImage: () => {
      const canvas = containerRef.current?.querySelector('canvas');
      if (!canvas) return;
      const url = canvas.toDataURL('image/png');
      const a = document.createElement('a');
      a.href = url;
      a.download = `Knowledge_Graph_Snapshot_${Date.now()}.png`;
      a.click();
    },
    exportJson: () => {
      const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(consolidatedGraphData, null, 2));
      const a = document.createElement('a');
      a.href = dataStr;
      a.download = `Knowledge_Graph_Export_${Date.now()}.json`;
      a.click();
    },
  }));

  // Custom Node Canvas Renderer
  const renderCustomNode = useCallback((node: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
    const isSelected = selectedNode?.id === node.id;
    const isHovered = hoveredNode?.id === node.id;
    const isSearchMatched = searchMatchedNodeIds.has(node.id);
    const isPathNode = pathNodeIds ? pathNodeIds.has(node.id) : true;
    const isDimmed = pathNodeIds !== null && !isPathNode;

    // Node size = bunk_rate (only thing size means per spec §6)
    const bunkRate = typeof node.bunk_rate === 'number' ? node.bunk_rate : (node.properties?.bunk_rate ?? 0.08);
    const baseRadius = Math.max(8, Math.min(26, 8 + bunkRate * 45));
    const radius = isSelected ? baseRadius * 1.25 : isHovered ? baseRadius * 1.15 : baseRadius;

    const nodeColor = node.color || '#6366f1';

    ctx.save();

    // Dimmed effect when focus mode is active and node is not related
    if (isDimmed) {
      ctx.globalAlpha = 0.15;
    } else if (selectedNode && selectedNode.id !== node.id) {
      // Check if neighbor
      const isNeighbor = edges.some((e) => {
        const u = typeof e.source === 'object' ? e.source.id : e.source;
        const v = typeof e.target === 'object' ? e.target.id : e.target;
        return (u === selectedNode.id && v === node.id) || (v === selectedNode.id && u === node.id);
      });
      if (!isNeighbor) {
        ctx.globalAlpha = 0.15;
      }
    }

    // Glowing halo ring around selected, hovered, or search-matched nodes
    if (isSelected || isSearchMatched || isHovered) {
      const pulseTime = performance.now() * 0.003;
      const pulseExpand = Math.sin(pulseTime) * 3;
      const haloRadius = radius + 6 + pulseExpand;

      ctx.beginPath();
      ctx.arc(node.x, node.y, Math.max(radius + 2, haloRadius), 0, 2 * Math.PI);
      ctx.strokeStyle = isSelected ? '#00b4ff' : isSearchMatched ? '#39ff14' : '#ffd700';
      ctx.lineWidth = 2.5 / globalScale;
      ctx.shadowColor = ctx.strokeStyle;
      ctx.shadowBlur = 18;
      ctx.stroke();
    }

    // Outer Glow Shadow
    ctx.shadowColor = nodeColor;
    ctx.shadowBlur = isSelected ? 22 : isHovered ? 16 : 8;

    // Node Circle Body
    ctx.beginPath();
    ctx.arc(node.x, node.y, radius, 0, 2 * Math.PI);
    ctx.fillStyle = nodeColor;
    ctx.fill();

    // Dark inset circle for tactical dual-ring effect
    ctx.shadowBlur = 0;
    ctx.beginPath();
    ctx.arc(node.x, node.y, radius * 0.8, 0, 2 * Math.PI);
    ctx.fillStyle = 'rgba(10, 12, 16, 0.7)';
    ctx.fill();

    // Center Inner Glyph or Letter
    ctx.font = `bold ${Math.max(7, Math.floor(radius * 0.85))}px Inter, sans-serif`;
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const glyph = (node.roll_no || node.label || 'S').slice(-2);
    ctx.fillText(glyph, node.x, node.y + 0.5);

    // Crown / Hub Badge for top bunk entities or groups
    const isHub = (node.n_ties || 0) >= 3 || node.group_id;
    if (isHub && !isDimmed) {
      ctx.beginPath();
      const badgeY = node.y - radius - 5;
      ctx.arc(node.x, badgeY, 3.5, 0, 2 * Math.PI);
      ctx.fillStyle = '#ffd700';
      ctx.shadowColor = '#ffd700';
      ctx.shadowBlur = 10;
      ctx.fill();
      ctx.shadowBlur = 0;
    }

    // High-DPI Crisp Label beneath the node
    const fontSize = Math.max(9, Math.min(13, 11 / Math.sqrt(globalScale)));
    ctx.font = `600 ${fontSize}px Inter, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';

    const labelText = anonymizeNames
      ? (node.properties?.roll_no || node.roll_no || node.id)
      : (node.label || node.name || node.properties?.name || node.id);
    const textY = node.y + radius + 4;

    const textWidth = ctx.measureText(labelText).width;
    const pillPad = 3;
    ctx.fillStyle = 'rgba(15, 23, 42, 0.90)';
    ctx.fillRect(
      node.x - textWidth / 2 - pillPad,
      textY - 1,
      textWidth + pillPad * 2,
      fontSize + 3
    );

    ctx.fillStyle = isSelected ? '#ffffff' : isHovered ? '#38bdf8' : '#e2e8f0';
    ctx.fillText(labelText, node.x, textY);

    ctx.restore();
  }, [selectedNode, hoveredNode, searchMatchedNodeIds, pathNodeIds, edges, anonymizeNames]);

  // Pointer area paint: sets accurate hitboxes matching the custom node radius
  const paintPointerArea = useCallback((node: any, paintColor: string, ctx: CanvasRenderingContext2D) => {
    const bunkRate = typeof node.bunk_rate === 'number' ? node.bunk_rate : 0.08;
    const baseRadius = Math.max(8, Math.min(26, 8 + bunkRate * 45));
    ctx.fillStyle = paintColor;
    ctx.beginPath();
    ctx.arc(node.x, node.y, baseRadius + 4, 0, 2 * Math.PI);
    ctx.fill();
  }, []);

  // Custom Link Canvas Renderer (§6 spec colors and thickness)
  const renderCustomLink = useCallback((link: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
    const src = link.source;
    const tgt = link.target;
    if (!src || !tgt || src.x === undefined || tgt.x === undefined) return;

    const srcId = String(typeof src === 'object' ? src.id : src);
    const tgtId = String(typeof tgt === 'object' ? tgt.id : tgt);

    const isPathEdge = link.isPathEdge;
    const isSelectedEdge = selectedNode ? (srcId === selectedNode.id || tgtId === selectedNode.id) : false;
    const isHoveredEdge = hoveredNode ? (srcId === hoveredNode.id || tgtId === hoveredNode.id) : false;
    const isDirectlyFocused = isPathEdge || isSelectedEdge || isHoveredEdge;
    const isDimmed = selectedNode && !isSelectedEdge;

    // Spec color contract (§6):
    // BUNKS_WITH: #D55E00 (vermilion), NAMED_FRIEND: #009E73, SITS_WITH: #0072B2, SAME_CLUB: #CC79A7, PROJECT_TEAM: #E69F00
    let strokeColor = '#D55E00';
    const edgeType = link.type || (link.rawEdges?.[0]?.type ?? 'BUNKS_WITH');
    if (edgeType.includes('NAMED_FRIEND')) strokeColor = '#009E73';
    else if (edgeType.includes('SITS_WITH')) strokeColor = '#0072B2';
    else if (edgeType.includes('SAME_CLUB')) strokeColor = '#CC79A7';
    else if (edgeType.includes('PROJECT_TEAM')) strokeColor = '#E69F00';
    else if (edgeType.includes('BUNKS_WITH')) strokeColor = '#D55E00';

    const weight = link.weight ?? (link.rawEdges?.[0]?.weight ?? 0.5);
    const thickness = Math.max(1.5, Math.min(6, weight * 5.5)) / globalScale;

    ctx.save();

    if (isDimmed) {
      ctx.globalAlpha = 0.15;
    } else {
      ctx.globalAlpha = isDirectlyFocused ? 1.0 : 0.85;
    }

    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = isDirectlyFocused ? thickness * 1.4 : thickness;

    // Dashed if one-way overlay tie
    if (link.rawEdges?.[0]?.kind === 'one_way') {
      ctx.setLineDash([5 / globalScale, 5 / globalScale]);
    } else {
      ctx.setLineDash([]);
    }

    ctx.beginPath();
    ctx.moveTo(src.x, src.y);
    ctx.lineTo(tgt.x, tgt.y);
    ctx.stroke();

    // Corroboration badge (§6): small badge on BUNKS_WITH edge when corroborated
    const raw0 = link.rawEdges?.[0];
    if (raw0 && (raw0.has_social_tie || raw0.has_context_tie) && !isDimmed) {
      const midX = (src.x + tgt.x) / 2;
      const midY = (src.y + tgt.y) / 2;
      ctx.beginPath();
      ctx.arc(midX, midY, 4 / globalScale, 0, 2 * Math.PI);
      ctx.fillStyle = raw0.has_social_tie ? '#009E73' : '#0072B2';
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1 / globalScale;
      ctx.stroke();
    }

    ctx.restore();
  }, [selectedNode, hoveredNode]);

  // Link Pointer Area: wide clickable area for easy edge selection
  const linkPointerAreaPaint = useCallback((link: any, paintColor: string, ctx: CanvasRenderingContext2D) => {
    const src = link.source;
    const tgt = link.target;
    if (!src || !tgt || src.x === undefined || tgt.x === undefined) return;
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(src.x, src.y);
    ctx.lineTo(tgt.x, tgt.y);
    ctx.strokeStyle = paintColor;
    ctx.lineWidth = 12;
    ctx.stroke();
    ctx.restore();
  }, []);

  return (
    <div
      ref={containerRef}
      className="w-full h-full relative overflow-hidden bg-[#070709] select-none"
      style={{
        backgroundImage: `radial-gradient(#1c212e 1.2px, transparent 1.2px)`,
        backgroundSize: '24px 24px',
      }}
    >
      <ForceGraph2D
        ref={fgRef}
        width={dimensions.width}
        height={dimensions.height}
        graphData={consolidatedGraphData}
        nodeId="id"
        linkSource="source"
        linkTarget="target"
        backgroundColor="transparent"
        nodeCanvasObject={renderCustomNode}
        nodePointerAreaPaint={paintPointerArea}
        linkCanvasObject={renderCustomLink}
        linkPointerAreaPaint={linkPointerAreaPaint}
        linkDirectionalParticles={(link: any) => {
          const sId = String(typeof link.source === 'object' ? link.source.id : link.source);
          const tId = String(typeof link.target === 'object' ? link.target.id : link.target);
          const isSel = selectedNode ? (sId === selectedNode.id || tId === selectedNode.id) : false;
          const isHov = hoveredNode ? (sId === hoveredNode.id || tId === hoveredNode.id) : false;
          if (isSel || isHov) return 4;
          return 2;
        }}
        linkDirectionalParticleSpeed={() => 0.009}
        linkDirectionalParticleWidth={() => 2.5}
        linkDirectionalParticleColor={(link: any) => {
          const isBunk = link.type?.includes('BUNKS_WITH');
          return isBunk ? '#D55E00' : '#38bdf8';
        }}
        onNodeClick={(node: any) => {
          onSelectNode(node);
          if (fgRef.current && node.x !== undefined && node.y !== undefined) {
            fgRef.current.centerAt(node.x, node.y, 400);
          }
        }}
        onLinkClick={(link: any) => {
          const raw = link?.rawEdges?.[0] || link;
          onSelectEdge?.(raw);
        }}
        onNodeHover={(node: any) => onHoverNode(node || null)}
        onBackgroundClick={() => {
          onSelectNode(null);
          onSelectEdge?.(null);
        }}
        cooldownTicks={100}
        warmupTicks={25}
      />
    </div>
  );
});

KnowledgeGraphCanvas.displayName = 'KnowledgeGraphCanvas';
