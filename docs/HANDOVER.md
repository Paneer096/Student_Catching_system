# Handover Notes: Makarov v2 Compliance Work

## Context & Objective
The repository is being refactored to strictly adhere to the Makarov master specification ([`makarov_master_prompt.md`](./makarov_master_prompt.md)).
A comprehensive forensic audit was conducted, identifying 80+ structural and conceptual deviations across all 13 spec sections.
The full findings and 6-phase remediation sequence are documented in [`makarov_audit_report.md`](./makarov_audit_report.md).

---

## What Has Been Completed So Far (Phase 1 In Progress)

1. **Forensic Audit & Roadmap**
   - Completed compliance audit comparing current codebase against `makarov_master_prompt.md`.
   - Identified deviations in terminology, statistical derivation, graph schema, missing prediction engine, UI library differences, and RBAC gaps.
   - Preserved in [`docs/makarov_audit_report.md`](./makarov_audit_report.md).

2. **Schema & Models Alignment (`backend/app/models/enums.py`)**
   - Eliminated all stigmatizing labels ("ringleader", "delinquent anchor", "troublemaker").
   - Added spec-defined edge types (`SKIPS_WITH`, `NAMED_FRIEND`, `SIBLING_OF`, `MUTUAL_PAIR`, `SECTION_PEER`).
   - Added pattern flags per §5.3 (`SOLO_BURST`, `CHRONIC_DISENGAGED`, `CO_BUNKER`, `PEER_INFLUENCED`, etc.).
   - Removed banned composite scores and unvalidated node types.

3. **ORM Models Rewrite (`backend/app/models/orm.py`)**
   - Renamed auth session to `AuthSession` and introduced academic `AcademicSession` (scheduled classes per §2).
   - Re-architected `Edge` table to include `derived_from`, `params_hash`, `evidence`, and `props`.
   - Added `AnalysisSnapshot` table for versioned group/pattern/prediction snapshots (§3).
   - Added `StudentPattern` table for discrete behavioral pattern flags (§5.3).
   - Removed legacy `AnchorScore` composite table.

4. **Thresholds Configuration (`backend/app/config/thresholds.yaml`)**
   - Aligned configuration keys with spec definitions (`skips_with`, `min_co_bunks=4`, `fdr_alpha=0.05`, `mass_absence_threshold=0.40`).
   - Removed banned anchor weights and ungrounded composite formulas.

---

## Next Steps for the Next Developer

Follow the 6-phase sequence outlined in [`makarov_audit_report.md`](./makarov_audit_report.md):

1. **Complete Phase 1 (Schema & DB Migration)**
   - Update `backend/app/models/schemas.py` (Pydantic models) to match the new ORM definitions.
   - Update `backend/app/db.py` / migrations to create the new tables cleanly.
   - Update documentation (`SCHEMA.md` and `METRICS.md` if present).

2. **Phase 2: Statistical Edge Derivation Engine (§5.1)**
   - Implement `SKIPS_WITH` edge builder in `backend/app/graph/statistical_derivation.py`.
   - Implement contingency table construction, hypergeometric test (Fisher's exact test), Benjamini-Hochberg FDR correction, and Lift/Jaccard calculation.
   - Filter out sessions with >=40% mass absence.

3. **Phase 3: Graph Analysis & Centrality (§5.2, §5.3)**
   - Update `backend/app/graph/graph_engine.py`: Louvain community detection with modularity score, PageRank and Betweenness on `SKIPS_WITH` component.
   - Implement student pattern classification without composite score labels.

4. **Phase 4: Prediction Engine (§6 - "Core Feature")**
   - Implement `backend/app/prediction/risk_predictor.py` computing Day Risk, Student Bunk Probability $P(B_i)$, and Group Co-Bunk Probability $P(G_k)$.
   - Hook up to daily watchlist APIs.

5. **Phase 5: API & Strict RBAC (§7, §8)**
   - Enforce role-based access control (Director, Head of Year, Counselor, Teacher) on all endpoints.

6. **Phase 6: Frontend Migration (§9)**
   - Replace Vis.js / React Flow with Cytoscape.js for graph visualization.
   - Re-orient home screen to Today's Watchlist (prediction-ranked).
