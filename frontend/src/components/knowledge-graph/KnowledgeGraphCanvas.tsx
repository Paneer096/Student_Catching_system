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
  isParticlesEnabled,
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
        Threat_Actor: 0,
        Disease: 0,
        Factory: 0,
        Faculty: 1,
        Vulnerability_CVE: 1,
        Gene: 1,
        Supplier: 1,
        Author: 1,
        Course: 2,
        Malware_Hash: 2,
        Drug_Compound: 2,
        Shipping_Route: 2,
        Paper: 2,
        Student: 3,
        Host_Machine: 3,
        Patient: 3,
        Warehouse: 3,
        Topic: 3,
        Incident: 4,
        IP_Address: 4,
        Clinical_Trial: 4,
        Raw_Material: 4,
        Patent: 4,
        Club: 4,
        Domain_Name: 4,
        Symptom: 4,
        Disruption_Event: 4,
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
      if (chargeForce) chargeForce.strength(-280);
      const linkForce = fg.d3Force('link');
      if (linkForce) linkForce.distance(70);
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

    // Base radius dynamically scaled by degree or centrality
    const degree = node.degree ?? (node.__degree || 2);
    const baseRadius = Math.max(6, Math.min(20, 7 + Math.sqrt(degree) * 2.2));
    const radius = isSelected ? baseRadius * 1.3 : isHovered ? baseRadius * 1.2 : baseRadius;

    const nodeColor = node.color || '#00b4ff';

    ctx.save();

    // Dimmed effect when pathfinding is active and node is unrelated
    if (isDimmed) {
      ctx.globalAlpha = 0.2;
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
    ctx.fillStyle = nodeColor;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const glyph = (node.type || 'N').charAt(0).toUpperCase();
    ctx.fillText(glyph, node.x, node.y + 0.5);

    // Crown / Hub Badge for top PageRank entities
    const isHub = (node.pagerank || 0) >= 0.072 || node.type === 'Classroom' || node.type === 'Threat_Actor';
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

    // High-DPI Crisp Label beneath the node, dynamically scaled
    // Ensure labels remain legible when zoomed in or out
    const fontSize = Math.max(9, Math.min(14, 11 / Math.sqrt(globalScale)));
    ctx.font = `600 ${fontSize}px Inter, monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';

    const labelText = node.label || node.id;
    const textY = node.y + radius + 4;

    // Dark background pill behind text for high legibility
    const textWidth = ctx.measureText(labelText).width;
    const pillPad = 3;
    ctx.fillStyle = 'rgba(7, 8, 12, 0.85)';
    ctx.fillRect(
      node.x - textWidth / 2 - pillPad,
      textY - 1,
      textWidth + pillPad * 2,
      fontSize + 3
    );

    ctx.fillStyle = isSelected ? '#ffffff' : isHovered ? '#00b4ff' : '#d1d5db';
    ctx.fillText(labelText, node.x, textY);

    ctx.restore();
  }, [selectedNode, hoveredNode, searchMatchedNodeIds, pathNodeIds]);

  // Pointer area paint: sets accurate hitboxes matching the custom node radius
  const paintPointerArea = useCallback((node: any, paintColor: string, ctx: CanvasRenderingContext2D) => {
    const degree = node.degree ?? 2;
    const baseRadius = Math.max(6, Math.min(20, 7 + Math.sqrt(degree) * 2.2));
    ctx.fillStyle = paintColor;
    ctx.beginPath();
    ctx.arc(node.x, node.y, baseRadius + 4, 0, 2 * Math.PI);
    ctx.fill();
  }, []);

  // Custom Link Canvas Renderer
  const renderCustomLink = useCallback((link: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
    const src = link.source;
    const tgt = link.target;
    if (!src || !tgt || src.x === undefined || tgt.x === undefined) return;

    const isPathEdge = link.isPathEdge;
    const isDimmed = pathEdgePairs !== null && !isPathEdge;

    ctx.save();

    if (isDimmed) {
      ctx.globalAlpha = 0.12;
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 1 / globalScale;
    } else if (isPathEdge) {
      ctx.globalAlpha = 1.0;
      ctx.strokeStyle = '#00b4ff';
      ctx.lineWidth = 3.5 / globalScale;
      ctx.shadowColor = '#00b4ff';
      ctx.shadowBlur = 14;
    } else {
      ctx.globalAlpha = 0.45;
      ctx.strokeStyle = '#475569';
      ctx.lineWidth = Math.max(1, (link.weight || 1) * 1.5) / globalScale;
    }

    // Draw edge line
    ctx.beginPath();
    ctx.moveTo(src.x, src.y);
    ctx.lineTo(tgt.x, tgt.y);
    ctx.stroke();

    // Render consolidated link label centered on edge angle with dark pill background
    if (globalScale > 0.85 && !isDimmed && link.type) {
      const midX = (src.x + tgt.x) / 2;
      const midY = (src.y + tgt.y) / 2;
      const angle = Math.atan2(tgt.y - src.y, tgt.x - src.x);

      ctx.save();
      ctx.translate(midX, midY);

      // Rotate text along link angle (flip if upside down)
      let textAngle = angle;
      if (textAngle > Math.PI / 2 || textAngle < -Math.PI / 2) {
        textAngle += Math.PI;
      }
      ctx.rotate(textAngle);

      const labelFontSize = Math.max(7, Math.min(10, 8.5 / Math.sqrt(globalScale)));
      ctx.font = `600 ${labelFontSize}px Inter, monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      const labelText = link.type;
      const labelWidth = ctx.measureText(labelText).width;
      const h = labelFontSize + 4;
      const w = labelWidth + 6;

      ctx.fillStyle = 'rgba(10, 10, 15, 0.9)';
      ctx.fillRect(-w / 2, -h / 2, w, h);

      ctx.strokeStyle = isPathEdge ? '#00b4ff' : 'rgba(255, 255, 255, 0.12)';
      ctx.lineWidth = 1 / globalScale;
      ctx.strokeRect(-w / 2, -h / 2, w, h);

      ctx.fillStyle = isPathEdge ? '#00b4ff' : '#94a3b8';
      ctx.fillText(labelText, 0, 0);

      ctx.restore();
    }

    ctx.restore();
  }, [pathEdgePairs]);

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
        linkDirectionalParticles={isParticlesEnabled ? (link: any) => (link.isPathEdge ? 4 : 2) : 0}
        linkDirectionalParticleSpeed={(link: any) => (link.isPathEdge ? 0.012 : 0.005)}
        linkDirectionalParticleWidth={(link: any) => (link.isPathEdge ? 3 : 2)}
        linkDirectionalParticleColor={(link: any) => (link.isPathEdge ? '#00b4ff' : '#39ff14')}
        onNodeClick={(node: any) => {
          onSelectNode(node);
          if (fgRef.current && node.x !== undefined && node.y !== undefined) {
            fgRef.current.centerAt(node.x, node.y, 500);
          }
        }}
        onNodeHover={(node: any) => onHoverNode(node || null)}
        onBackgroundClick={() => onSelectNode(null)}
        cooldownTicks={120}
        warmupTicks={30}
      />
    </div>
  );
});

KnowledgeGraphCanvas.displayName = 'KnowledgeGraphCanvas';
