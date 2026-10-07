# Handover Notes: Makarov v2 Compliance Work

## Context & Objective
The repository is being refactored to strictly adhere to the Makarov master specification ([`makarov_master_prompt.md`](./makarov_master_prompt.md)).
A forensic audit identified 80+ structural and conceptual deviations across all 13 spec sections.
The full findings and 6-phase remediation sequence are documented in [`makarov_audit_report.md`](./makarov_audit_report.md).

---

## Completed Milestones

### Phase 1: Schemas, Models & Database (Complete ✅)
1. **Enums & Vocabulary (`backend/app/models/enums.py`)**:
   - Removed all stigmatizing terminology ("ringleader", "delinquent anchor", "troublemaker").
   - Added spec edge types (`SKIPS_WITH`, `NAMED_FRIEND`, `SIBLING_OF`, `MUTUAL_PAIR`, `SECTION_PEER`).
   - Added pattern flags per §5.3 (`SOLO_BURST`, `CHRONIC_DISENGAGED`, `CO_BUNKER`, `PEER_INFLUENCED`, etc.).
2. **ORM Models (`backend/app/models/orm.py`)**:
   - Added `AcademicSession` (scheduled held classes per §2) and renamed auth sessions to `AuthSession`.
   - Re-architected `Edge` table with `derived_from`, `params_hash`, `evidence`, and `props`.
   - Added `AnalysisSnapshot` (versioned groups/predictions) and `StudentPattern`.
   - Added aliases for backward compatibility.
3. **Pydantic Schemas (`backend/app/models/schemas.py`)**:
   - Added spec request/response models.
4. **Thresholds Configuration (`backend/app/config/thresholds.yaml`)**:
   - Aligned with §5.1 parameters (`min_co_bunks=4`, `min_lift=2.0`, `fdr_alpha=0.05`, `mass_absence_threshold=0.40`).
5. **Database Initialization**:
   - SQLite tables created cleanly and all 10 backend tests passing (`10 passed in 5.00s`).

### Phase 2: Statistical Derivation & Interactive Knowledge Graph (Complete ✅)
1. **Mathematical Engine (`backend/app/graph/statistical_derivation.py`)**:
   - Vectorized matrix co-bunk analysis ($C = B \cdot B^T$).
   - Exclusion of mass absence sessions ($\ge 40\%$ absence).
   - One-sided hypergeometric survival function ($p$-value calculation).
   - Benjamini-Hochberg False Discovery Rate correction ($q \le 0.05$).
   - Validated `SKIPS_WITH` edges with Jaccard weight, Lift, and plain-language explanation.
   - Theoretical documentation created in [`docs/METRICS.md`](./METRICS.md).
2. **Network Builder (`backend/app/graph/bunk_network.py`)**:
   - Louvain community detection on `SKIPS_WITH` graph (cliques of $\ge 3$ form compound Bunk Groups).
   - Node visual encodings (30-day bunk rate).
   - Isolated students extraction ("No bunk partners found").
3. **Interactive Cytoscape.js Frontend (`frontend/src/components/graph/CytoscapeBunkGraph.tsx`)**:
   - Integrated Cytoscape.js with `fcose` physics layout.
   - Compound group containers with dashed bounding boxes.
   - Interactive node focus mode (1-hop 100% opacity, 2-hop 35%, rest faded to 12%).
   - Interactive edge click opening **Statistical Evidence Drawer** with plain-language explanation and session table.
   - Projector privacy mode toggle ("Anonymize Names").
   - Isolated students slide-out drawer.
   - Switcher between Bunk Network (Cytoscape.js) and Administrative Hierarchy in `frontend/src/views/GraphView.tsx`.
   - Frontend builds cleanly (`npm run build` succeeds).

---

## Next Steps for Future Work

1. **Phase 4: Prediction Engine (§6 - "Core Feature")**
   - Implement `backend/app/prediction/risk_predictor.py` computing Day Risk, Student Bunk Probability $P(B_i)$, and Group Co-Bunk Probability $P(G_k)$.
   - Connect to the Today's Watchlist screen (`frontend/src/views/DashboardView.tsx`).

2. **Phase 5: API & Strict RBAC Enforcement (§7, §8)**
   - Wire role-based scoping (Director vs HOD vs Class Teacher) across all remaining endpoints.

3. **Phase 6: UI Polish & Cold-Start Scenarios (§9)**
   - Ingestion dry-run mode and error reporting for unknown rolls.
