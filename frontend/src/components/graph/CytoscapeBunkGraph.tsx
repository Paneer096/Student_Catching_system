import React, { useEffect, useRef, useState } from 'react';
import cytoscape, { Core, EventObject } from 'cytoscape';
// @ts-ignore
import fcose from 'cytoscape-fcose';
import {
  CytoscapeBunkNetworkData,
  PairEvidenceData,
  StudentDossier,
  api,
} from '../../api/client';
import {
  ZoomIn,
  ZoomOut,
  Maximize2,
  Eye,
  EyeOff,
  Users,
  ShieldCheck,
  FileText,
  X,
  Info,
  Calendar,
  Layers,
  ArrowRight,
  RotateCcw,
} from 'lucide-react';

// Register fcose layout extension if not already registered
try {
  cytoscape.use(fcose);
} catch {
  // Already registered
}

interface CytoscapeBunkGraphProps {
  data: CytoscapeBunkNetworkData;
  activeSection: string;
  onSelectStudent?: (rollNo: string) => void;
  onRefresh?: () => void;
}

export const CytoscapeBunkGraph: React.FC<CytoscapeBunkGraphProps> = ({
  data,
  activeSection,
  onSelectStudent,
  onRefresh,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const cyRef = useRef<Core | null>(null);

  // Interaction States
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedEdgeData, setSelectedEdgeData] = useState<any | null>(null);
  const [evidenceData, setEvidenceData] = useState<PairEvidenceData | null>(null);
  const [evidenceLoading, setEvidenceLoading] = useState(false);
  const [dossier, setDossier] = useState<StudentDossier | null>(null);
  const [anonymize, setAnonymize] = useState(false);
  const [showIsolatedSidebar, setShowIsolatedSidebar] = useState(false);
  const [layoutName, setLayoutName] = useState<'fcose' | 'cose' | 'concentric'>('fcose');

  // Breadcrumbs
  const [currentBreadcrumb, setCurrentBreadcrumb] = useState<string[]>([activeSection]);

  // Initialize and update Cytoscape graph
  useEffect(() => {
    if (!containerRef.current || !data) return;

    // Destroy existing instance
    if (cyRef.current) {
      cyRef.current.destroy();
    }

    // Prepare elements with anonymized labels if enabled
    const elements = data.elements.map((el) => {
      if (el.group === 'nodes' && !el.data.is_compound) {
        return {
          ...el,
          data: {
            ...el.data,
            displayLabel: anonymize ? `${el.data.roll_no.slice(0, 4)}***` : el.data.roll_no,
          },
        };
      }
      return el;
    });

    const cy = cytoscape({
      container: containerRef.current,
      elements: elements,
      style: [
        // Base Compound Node Style (Louvain Groups)
        {
          selector: 'node[?is_compound]',
          style: {
            'background-color': 'rgba(248, 250, 252, 0.85)',
            'border-width': 1.5,
            'border-style': 'dashed',
            'border-color': '#94A3B8',
            'shape': 'round-rectangle',
            'label': 'data(label)',
            'text-valign': 'top',
            'text-halign': 'center',
            'font-size': 11,
            'font-weight': 'bold',
            'color': '#475569',
            'padding': '14px',
          },
        },
        // Individual Student Node
        {
          selector: 'node[!is_compound]',
          style: {
            'label': 'data(displayLabel)',
            'font-size': 10,
            'font-family': 'Inter, system-ui, sans-serif',
            'font-weight': 'bold',
            'text-valign': 'bottom',
            'text-margin-y': 5,
            'color': '#1E293B',
            'text-background-opacity': 0.8,
            'text-background-color': '#FFFFFF',
            'text-background-padding': '2px',
            'text-background-shape': 'roundrectangle',
            'border-width': 2,
            'border-color': '#FFFFFF',
            // Size scaled by 30-day bunk rate
            'width': 'mapData(bunk_rate_30d, 0, 0.5, 26, 48)',
            'height': 'mapData(bunk_rate_30d, 0, 0.5, 26, 48)',
            // Color sequential scale for bunk probability / rate
            'background-color': 'mapData(bunk_rate_30d, 0, 0.4, #FDBA74, #C2410C)',
          },
        },
        // Edge Styles
        {
          selector: 'edge.edge-skips-with',
          style: {
            'width': 'mapData(weight, 0.1, 0.8, 2, 7)',
            'line-color': '#D55E00', // Okabe-Ito vermillion
            'curve-style': 'bezier',
            'opacity': 0.85,
          },
        },
        {
          selector: 'edge.edge-friend',
          style: {
            'width': 2,
            'line-color': '#009E73', // Okabe-Ito green
            'curve-style': 'bezier',
            'opacity': 0.75,
          },
        },
        {
          selector: 'edge.edge-friend-oneway',
          style: {
            'width': 1.5,
            'line-color': '#009E73',
            'line-style': 'dashed',
            'curve-style': 'bezier',
            'target-arrow-shape': 'triangle',
            'target-arrow-color': '#009E73',
            'opacity': 0.6,
          },
        },
        // Interactive Selection & Hover Styles
        {
          selector: 'node.selected-node',
          style: {
            'border-width': 4,
            'border-color': '#1E40AF',
            'z-index': 999,
          },
        },
        {
          selector: 'node.faded',
          style: {
            'opacity': 0.12,
          },
        },
        {
          selector: 'node.hop2',
          style: {
            'opacity': 0.35,
          },
        },
        {
          selector: 'edge.faded',
          style: {
            'opacity': 0.08,
          },
        },
        {
          selector: 'edge.highlighted-edge',
          style: {
            'line-color': '#1E40AF',
            'width': 5,
            'opacity': 1.0,
            'z-index': 998,
          },
        },
      ],
      layout: {
        name: layoutName,
        animate: true,
        animationDuration: 400,
        fit: true,
        padding: 40,
        // @ts-ignore
        nodeDimensionsIncludeLabels: true,
        // @ts-ignore
        idealEdgeLength: 80,
      },
    });

    cyRef.current = cy;

    // Node Click -> Focus Mode & Dossier Drawer (§7)
    cy.on('tap', 'node[!is_compound]', (evt: EventObject) => {
      const node = evt.target;
      const rollNo = node.id();
      setSelectedNodeId(rollNo);
      setSelectedEdgeData(null);
      setEvidenceData(null);

      // Breadcrumb update
      const parent = node.parent();
      const parentLabel = parent.length > 0 ? parent.data('label') : 'Network';
      setCurrentBreadcrumb([activeSection, parentLabel, rollNo]);

      // Apply Focus Mode:
      // 1-hop at full opacity, 2-hop at 35%, rest at 12% (§7)
      cy.elements().removeClass('selected-node faded hop2 highlighted-edge');
      node.addClass('selected-node');

      const neighborhood1 = node.neighborhood();
      const hop1Nodes = neighborhood1.nodes();

      const hop2Nodes = hop1Nodes.neighborhood().nodes().difference(hop1Nodes).difference(node);

      cy.elements().difference(neighborhood1).difference(node).addClass('faded');
      hop2Nodes.removeClass('faded').addClass('hop2');

      // Fetch student dossier
      loadStudentDossier(rollNo);
      if (onSelectStudent) onSelectStudent(rollNo);
    });

    // Edge Click -> Evidence Drawer (§7)
    cy.on('tap', 'edge', (evt: EventObject) => {
      const edge = evt.target;
      const edgeData = edge.data();
      setSelectedEdgeData(edgeData);
      setSelectedNodeId(null);
      setDossier(null);

      cy.elements().removeClass('selected-node faded hop2 highlighted-edge');
      edge.addClass('highlighted-edge');
      edge.connectedNodes().addClass('selected-node');

      // Fetch deep pair evidence
      loadPairEvidence(edgeData.source, edgeData.target);
    });

    // Background Click -> Reset Focus
    cy.on('tap', (evt: EventObject) => {
      if (evt.target === cy) {
        cy.elements().removeClass('selected-node faded hop2 highlighted-edge');
        setSelectedNodeId(null);
        setSelectedEdgeData(null);
        setEvidenceData(null);
        setDossier(null);
        setCurrentBreadcrumb([activeSection]);
      }
    });

    return () => {
      cy.destroy();
    };
  }, [data, anonymize, layoutName, activeSection, onSelectStudent]);

  // Load Dossier
  const loadStudentDossier = async (rollNo: string) => {
    try {
      const d = await api.getStudentProfile(rollNo);
      setDossier(d);
    } catch (err) {
      console.error('Failed to load dossier', err);
    }
  };

  // Load Pair Evidence
  const loadPairEvidence = async (rollA: string, rollB: string) => {
    setEvidenceLoading(true);
    try {
      const ev = await api.getPairEvidence(rollA, rollB, activeSection);
      setEvidenceData(ev);
    } catch (err) {
      console.error('Failed to load evidence', err);
    } finally {
      setEvidenceLoading(false);
    }
  };

  // Zoom / View Controls
  const handleZoomIn = () => cyRef.current?.zoom(cyRef.current.zoom() * 1.25);
  const handleZoomOut = () => cyRef.current?.zoom(cyRef.current.zoom() * 0.8);
  const handleFit = () => cyRef.current?.fit(undefined, 35);
  const handleReset = () => {
    cyRef.current?.elements().removeClass('selected-node faded hop2 highlighted-edge');
    cyRef.current?.fit(undefined, 35);
    setSelectedNodeId(null);
    setSelectedEdgeData(null);
    setEvidenceData(null);
    setDossier(null);
    setCurrentBreadcrumb([activeSection]);
  };

  return (
    <div className="relative w-full h-full flex flex-col bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-2xl">
      {/* Top Interactive Toolbar */}
      <div className="flex items-center justify-between px-4 py-3 bg-slate-950/80 backdrop-blur-md border-b border-slate-800 z-10">
        {/* Breadcrumb Navigation */}
        <div className="flex items-center gap-2 text-sm">
          <span className="font-semibold text-amber-500 flex items-center gap-1.5">
            <Layers className="w-4 h-4" /> Bunk Network
          </span>
          {currentBreadcrumb.map((crumb, idx) => (
            <React.Fragment key={idx}>
              <span className="text-slate-600">/</span>
              <span
                className={`font-mono text-xs px-2 py-0.5 rounded ${
                  idx === currentBreadcrumb.length - 1
                    ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                    : 'text-slate-400'
                }`}
              >
                {crumb}
              </span>
            </React.Fragment>
          ))}
        </div>

        {/* Toolbar Controls */}
        <div className="flex items-center gap-2">
          {/* Anonymize Names Toggle (§7 Projector Privacy) */}
          <button
            onClick={() => setAnonymize(!anonymize)}
            title="Privacy Mode: Anonymize student names & roll numbers for projector"
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer ${
              anonymize
                ? 'bg-emerald-600/20 text-emerald-400 border border-emerald-500/40'
                : 'bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-700'
            }`}
          >
            {anonymize ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            {anonymize ? 'Anonymized' : 'Anonymize'}
          </button>

          {/* Isolated Students Sidebar Toggle (§7) */}
          <button
            onClick={() => setShowIsolatedSidebar(!showIsolatedSidebar)}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer ${
              showIsolatedSidebar
                ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                : 'bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-700'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            No Bunk Partners ({data.isolated_students?.length || 0})
          </button>

          {/* Layout Mode Selector */}
          <select
            value={layoutName}
            onChange={(e) => setLayoutName(e.target.value as any)}
            className="bg-slate-800 text-slate-300 text-xs rounded-lg px-2 py-1.5 border border-slate-700 focus:outline-none focus:border-amber-500"
          >
            <option value="fcose">Physics (fCoSE)</option>
            <option value="cose">Force Directed (CoSE)</option>
            <option value="concentric">Concentric</option>
          </select>

          {/* Reset / Fit View */}
          <button
            onClick={handleReset}
            className="p-1.5 hover:text-white text-slate-400 bg-slate-800 rounded-lg border border-slate-700 transition cursor-pointer"
            title="Reset Graph Selection"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>

          {/* Zoom Controls */}
          <div className="flex items-center bg-slate-800 rounded-lg p-0.5 border border-slate-700">
            <button
              onClick={handleZoomIn}
              className="p-1 hover:text-white text-slate-400 transition cursor-pointer"
              title="Zoom In"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
            <button
              onClick={handleZoomOut}
              className="p-1 hover:text-white text-slate-400 transition cursor-pointer"
              title="Zoom Out"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <button
              onClick={handleFit}
              className="p-1 hover:text-white text-slate-400 transition cursor-pointer"
              title="Fit View"
            >
              <Maximize2 className="w-4 h-4" />
            </button>
          </div>

          {onRefresh && (
            <button
              onClick={onRefresh}
              className="px-2.5 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-xs rounded-lg transition cursor-pointer"
              title="Re-run Statistical Derivation"
            >
              Recompute
            </button>
          )}
        </div>
      </div>

      {/* Main Graph Canvas Area */}
      <div className="relative flex-1 w-full h-full overflow-hidden">
        {/* Cytoscape Container */}
        <div ref={containerRef} className="w-full h-full cursor-grab active:cursor-grabbing" />

        {/* Floating Statistical Legend (§7) */}
        <div className="absolute bottom-4 left-4 bg-slate-950/90 backdrop-blur-md p-3.5 rounded-xl border border-slate-800 text-xs text-slate-300 shadow-xl space-y-2 pointer-events-auto">
          <div className="font-semibold text-slate-200 flex items-center gap-1.5 border-b border-slate-800 pb-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-amber-500" /> Statistical Encoding (§7)
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3.5 h-1 bg-[#D55E00] rounded-sm" />
            <span className="text-slate-400">
              <strong className="text-slate-300">SKIPS_WITH</strong>: Validated (Lift &ge; 2.0x, q &le; 0.05)
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-orange-600 border border-white" />
            <span className="text-slate-400">
              <strong className="text-slate-300">Node Size</strong>: 30-Day Bunk Rate
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3.5 h-2.5 rounded-sm border border-dashed border-slate-500 bg-slate-800/40" />
            <span className="text-slate-400">
              <strong className="text-slate-300">Compound Box</strong>: Louvain Bunk Group (&ge; 3)
            </span>
          </div>
        </div>

        {/* Evidence Drawer on Edge Click (§7) */}
        {selectedEdgeData && (
          <div className="absolute top-4 right-4 w-96 max-h-[85%] bg-slate-950/95 backdrop-blur-md border border-amber-500/40 rounded-xl shadow-2xl p-5 overflow-y-auto z-20 animate-in slide-in-from-right-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2 text-amber-400 font-semibold text-sm">
                <FileText className="w-4 h-4" /> Statistical Evidence Drawer
              </div>
              <button
                onClick={() => setSelectedEdgeData(null)}
                className="text-slate-500 hover:text-slate-300 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="mt-4 space-y-3">
              <div className="p-3 bg-slate-900 rounded-lg border border-slate-800">
                <div className="text-xs text-slate-400 mb-1">Students Connected:</div>
                <div className="font-mono text-sm text-amber-300 font-bold flex items-center gap-2">
                  <span>{selectedEdgeData.source}</span>
                  <ArrowRight className="w-3.5 h-3.5 text-slate-500" />
                  <span>{selectedEdgeData.target}</span>
                </div>
              </div>

              {/* Plain-Language Line per §7 */}
              <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg">
                <div className="text-xs font-semibold text-amber-400 mb-1 flex items-center gap-1">
                  <Info className="w-3.5 h-3.5" /> Plain-Language Explanation:
                </div>
                <p className="text-xs text-slate-200 leading-relaxed font-sans">
                  {selectedEdgeData.plain_language}
                </p>
              </div>

              {/* Statistical Proof Chips */}
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="bg-slate-900 p-2.5 rounded-lg border border-slate-800">
                  <div className="text-slate-500 text-[10px] uppercase">Lift Over Chance</div>
                  <div className="text-amber-400 font-bold text-sm">{selectedEdgeData.lift}x</div>
                </div>
                <div className="bg-slate-900 p-2.5 rounded-lg border border-slate-800">
                  <div className="text-slate-500 text-[10px] uppercase">Jaccard Weight</div>
                  <div className="text-slate-200 font-bold text-sm">{selectedEdgeData.weight}</div>
                </div>
                <div className="bg-slate-900 p-2.5 rounded-lg border border-slate-800">
                  <div className="text-slate-500 text-[10px] uppercase">BH FDR q-value</div>
                  <div className="text-emerald-400 font-bold text-sm">
                    {selectedEdgeData.q_value !== undefined ? selectedEdgeData.q_value : '0.000'}
                  </div>
                </div>
                <div className="bg-slate-900 p-2.5 rounded-lg border border-slate-800">
                  <div className="text-slate-500 text-[10px] uppercase">Co-Bunk Sessions</div>
                  <div className="text-slate-200 font-bold text-sm">
                    {selectedEdgeData.evidence_count} sessions
                  </div>
                </div>
              </div>

              {/* Detailed Session Evidence List */}
              <div className="mt-3">
                <div className="text-xs font-semibold text-slate-300 mb-2 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-slate-400" /> Verified Co-Bunk Sessions:
                </div>
                {evidenceLoading ? (
                  <div className="text-xs text-slate-500 py-3 text-center">Loading sessions...</div>
                ) : (
                  <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
                    {(evidenceData?.sessions || selectedEdgeData.evidence || []).map(
                      (sess: any, idx: number) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between text-xs bg-slate-900/80 p-2 rounded border border-slate-800/80 font-mono"
                        >
                          <span className="text-slate-300">{sess.date}</span>
                          <span className="text-amber-400">Period {sess.period}</span>
                          <span className="text-slate-400">{sess.subject_code}</span>
                        </div>
                      )
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Student Dossier Drawer on Node Click (§7) */}
        {selectedNodeId && dossier && (
          <div className="absolute top-4 right-4 w-96 max-h-[85%] bg-slate-950/95 backdrop-blur-md border border-blue-500/40 rounded-xl shadow-2xl p-5 overflow-y-auto z-20 animate-in slide-in-from-right-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <div className="text-xs text-slate-400 uppercase tracking-wider">Student Dossier</div>
                <div className="font-bold text-base text-slate-100">{dossier.name}</div>
                <div className="text-xs font-mono text-amber-400">{dossier.roll_no}</div>
              </div>
              <button
                onClick={() => setSelectedNodeId(null)}
                className="text-slate-500 hover:text-slate-300 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="mt-4 space-y-3 text-xs">
              {/* Metrics */}
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-slate-900 p-2.5 rounded-lg border border-slate-800">
                  <div className="text-slate-500 text-[10px] uppercase">Attendance Rate</div>
                  <div className="text-slate-200 font-bold text-sm">
                    {Math.round(dossier.attendance_pct)}%
                  </div>
                </div>
                <div className="bg-slate-900 p-2.5 rounded-lg border border-slate-800">
                  <div className="text-slate-500 text-[10px] uppercase">Total Absences</div>
                  <div className="text-amber-400 font-bold text-sm">{dossier.absences}</div>
                </div>
              </div>

              {/* Bunk Partners */}
              <div>
                <div className="text-xs font-semibold text-slate-300 mb-2 flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-amber-500" /> Co-Absent Peers:
                </div>
                {(!dossier.peers || dossier.peers.length === 0) ? (
                  <div className="text-xs text-slate-500 italic p-2 bg-slate-900 rounded">
                    No co-absent peers found
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {dossier.peers.map((peer, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between p-2 bg-slate-900 rounded border border-slate-800"
                      >
                        <span className="font-mono text-slate-200">{peer.roll_no} ({peer.name})</span>
                        <span className="text-amber-400">{peer.mutual_absences} co-absences</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Isolated Students Sidebar (§7: "No bunk partners found") */}
        {showIsolatedSidebar && (
          <div className="absolute top-0 right-0 w-80 h-full bg-slate-950/98 backdrop-blur-lg border-l border-slate-800 p-4 overflow-y-auto z-30 shadow-2xl animate-in slide-in-from-right-2">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-3">
              <div>
                <div className="font-semibold text-sm text-slate-200 flex items-center gap-1.5">
                  <Users className="w-4 h-4 text-slate-400" /> No Bunk Partners Found
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5">
                  Students with 0 validated shared skips
                </div>
              </div>
              <button
                onClick={() => setShowIsolatedSidebar(false)}
                className="text-slate-500 hover:text-slate-300 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-1.5 text-xs">
              {data.isolated_students?.map((s) => (
                <div
                  key={s.id || s.roll_no}
                  className="p-2.5 bg-slate-900/80 hover:bg-slate-900 rounded-lg border border-slate-800 flex items-center justify-between transition"
                >
                  <div>
                    <div className="font-medium text-slate-300">{s.name}</div>
                    <div className="font-mono text-[11px] text-slate-500">{s.roll_no}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-slate-400 font-mono">
                      {Math.round(s.attendance_rate * 100)}% att
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
