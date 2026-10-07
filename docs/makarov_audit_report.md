# Makarov v2 — Master Prompt Compliance Audit

> Audit of current codebase in `d:\Makerov\Actual project\` against [`makarov_master_prompt.md`](file:///d:/Makerov/makarov_master_prompt.md)

---

## Executive Summary

The current project ("Makerove") has significant structural and conceptual deviations from the master prompt. The core statistical derivation engine (§5.1 SKIPS_WITH) is **not implemented**. The graph engine uses naive co-absence counting instead of the required hypergeometric test + FDR correction. The project conflates terminology, uses stigmatizing labels ("ringleader", "delinquent"), includes unauthorized node/edge types, and has numerous UI screens that don't match the spec. The prediction system (§6) is entirely missing.

### Severity Legend
- 🔴 **CRITICAL** — Violates a non-negotiable requirement or produces incorrect results
- 🟠 **MAJOR** — Significant deviation from spec, must be fixed
- 🟡 **MINOR** — Cosmetic or low-impact deviation

---

## 1. Naming & Terminology

| # | Issue | Severity | Spec Reference | Current State |
|---|-------|----------|----------------|---------------|
| 1.1 | Project named "Makerove" everywhere | 🟡 | §0: "Makarov" | All files, classes, DB name use "Makerove" |
| 1.2 | Stigmatizing labels | 🔴 | §5.3: "No labels like 'ringleader' or 'troublemaker'" | [`graph_engine.py`](file:///d:/Makerov/Actual%20project/backend/app/graph/graph_engine.py#L338-L344): Uses "Delinquent Anchor (Leader)", "Delinquent Associate", "High-Risk Bunk Anchor", "delinquency_label", "is_delinquent", "Absence Anchor / Key Influencer" |
| 1.3 | "Anchor" concept | 🔴 | §5.3: No composite trouble score; §13: No node type "Cluster/Group" | [`orm.py`](file:///d:/Makerov/Actual%20project/backend/app/models/orm.py#L383-L401): `AnchorScore` table with `pagerank_norm`, `betweenness_norm`, `leadlag_norm` — this is a banned composite score |
| 1.4 | "Backbenchers" label | 🔴 | §10: "Flags are 'reasons to check in', never verdicts" | [`graph_engine.py`](file:///d:/Makerov/Actual%20project/backend/app/graph/graph_engine.py#L159): `"Friend Group: Backbenchers (High Risk)"` |

## 2. Definitions (§2) — Bunk Detection Logic

| # | Issue | Severity | Details |
|---|-------|----------|---------|
| 2.1 | **Bunk definition not implemented** | 🔴 | §2: Bunk = ABSENT in a held session while PRESENT in ≥1 other session same day. Current code simply counts raw ABSENTs — no partial-day check |
| 2.2 | Full-day absence not distinguished | 🔴 | §2: Full-day absence tracked separately as welfare signal, not bunk. Current code makes no distinction |
| 2.3 | No "Session" entity | 🟠 | §2: Session = scheduled class that was actually held. Current code uses raw Attendance rows, no session validation |
| 2.4 | Degraded mode missing | 🟠 | §2: If only one status/day → degraded mode with lowered confidence. Not implemented |
| 2.5 | Mass-absence session exclusion missing | 🔴 | §2: Sessions where ≥40% section absent → excluded from pair analysis. [`mass_bunk_detector.py`](file:///d:/Makerov/Actual%20project/backend/app/detection/mass_bunk_detector.py) detects them but doesn't exclude from edge derivation |

## 3. Architecture (§3)

| # | Issue | Severity | Details |
|---|-------|----------|---------|
| 3.1 | Missing `edges` table fields | 🟠 | §3: edges table needs `props jsonb, derived_from, params_hash, computed_at, evidence`. Current [`Edge`](file:///d:/Makerov/Actual%20project/backend/app/models/orm.py#L343-L358) model has `evidence_count`, `p_value`, `q_value` but **no** `derived_from`, `params_hash`, `evidence` (list of session IDs) |
| 3.2 | Missing `analysis_snapshots` table | 🟠 | §3: Versioned snapshots for groups, patterns, predictions. Not present |
| 3.3 | Missing `sessions` table | 🟠 | §3: Facts include `sessions` (scheduled classes). Current code has `Session` but it's for **auth sessions**, not academic sessions |
| 3.4 | `survey_nominations` table missing | 🟡 | §3: Listed in facts tables. Partially covered by `SurveyResponse` |
| 3.5 | `ingestion_runs` table missing | 🟡 | §3: Listed in facts. Partially covered by `IngestionBatch` |
| 3.6 | Neo4j boundary respected | ✅ | No Neo4j used |

## 4. Graph Schema (§4) — Nodes

| # | Issue | Severity | Details |
|---|-------|----------|---------|
| 4.1 | **Banned node types in use** | 🔴 | §4: "Not allowed as nodes: Cluster/Group, Risk, Influence, Location". Current code has `classroom`, `cr`, `anchor`, `associate` node types + Louvain clusters rendered as graph nodes |
| 4.2 | Missing Observation/Intervention as nodes | 🟠 | §4: Observation and Intervention are node types. Current code treats them only as edges (`TAGGED_AS`) |
| 4.3 | "Level" concept not in spec | 🟡 | §4 defines flat node types. Current code uses Level 1-4 hierarchy that doesn't exist in spec |

## 5. Graph Schema (§4) — Edges

| # | Issue | Severity | Details |
|---|-------|----------|---------|
| 5.1 | `SKIPS_WITH` not implemented | 🔴 | §4/§5.1: The core validated edge type. Current code uses `CO_ABSENT`/`BUNKS_WITH`/`coabsence` with naive ≥2 co-absence threshold — **no hypergeometric test, no FDR, no lift, no jaccard** |
| 5.2 | `NAMED_FRIEND` not implemented | 🟠 | §4: Survey nominations become `NAMED_FRIEND` edges with `mutual` flag and `kind` property. Current code uses `FRIENDS_WITH`/`STUDIES_WITH` as separate edge types |
| 5.3 | `ENROLLED_IN` missing | 🟡 | §4: Student→Section edge (not drawn). Not present |
| 5.4 | `TEACHES` edge missing | 🟡 | §4: Teacher→Section with `subject_code` prop. Not present as edge |
| 5.5 | `OBSERVED`/`INTERVENED` wrong direction | 🟠 | §4: Teacher→Observation→Student, Teacher→Intervention→Student (through intermediate node). Current code uses direct Teacher→Student edges |
| 5.6 | `LEADS_SKIPS` missing | 🟡 | §4: Experimental, off by default. Not implemented (acceptable since experimental) |
| 5.7 | Banned edge names in use | 🟠 | §4: Banned: `CONNECTED_TO`, `ASSOCIATED_WITH`, `KNOWS`, `RELATED_TO`, `INFLUENCES`. Current code uses `HIERARCHICAL`, `AGGREGATE_CROSS_CLUSTER`, `TAGGED_AS` — not banned but also not in spec |
| 5.8 | Missing `derived_from` + `evidence` on edges | 🔴 | §13: "Every edge has `derived_from` + `evidence`". Not implemented |

## 6. Derivations — §5.1 SKIPS_WITH (Statistically Validated)

| # | Issue | Severity | Details |
|---|-------|----------|---------|
| 6.1 | **No bunk matrix B** | 🔴 | §5.1 step 1: Build matrix B (students × eligible sessions). Not implemented |
| 6.2 | **No hypergeometric/Fisher test** | 🔴 | §5.1 step 2: One-sided hypergeometric for each pair. Not implemented |
| 6.3 | **No Benjamini-Hochberg FDR** | 🔴 | §5.1 step 3: FDR correction across all pairs. Not implemented |
| 6.4 | **No min_co_bunks / min_lift / fdr_alpha gate** | 🔴 | §5.1 step 4: Edge only if c≥4 AND lift≥2.0 AND q≤0.05. Current code creates edge at ≥2 raw co-absences |
| 6.5 | **No vectorized computation** | 🟠 | §5.1 step 5: C = Bm @ Bm.T, under 1 second. Not implemented |
| 6.6 | No co-bunk session IDs as evidence | 🔴 | §5.1 step 6: Store session IDs. Not stored |
| 6.7 | No filter support (date/subject/period/weekday) | 🔴 | §5.1 step 7: Filtered runs re-derive with `params_hash` caching. Not implemented |
| 6.8 | No `docs/METRICS.md` | 🟠 | §5.1 step 8: Document why naive "≥3" rule fails. Missing |

## 7. Derivations — §5.2 Bunk Groups

| # | Issue | Severity | Details |
|---|-------|----------|---------|
| 7.1 | Leiden/Louvain runs on wrong graph | 🟠 | §5.2: Run on `SKIPS_WITH` graph, weight=jaccard. Current Louvain runs on combined co-absence+survey graph |
| 7.2 | No stable IDs | 🟠 | §5.2: Match new groups to previous snapshot by member Jaccard overlap. Not implemented |
| 7.3 | No friend-circle overlap reporting | 🟡 | §5.2: Report "4 of 5 members are mutual friends". Not implemented |
| 7.4 | Groups rendered as graph nodes | 🔴 | §4: "Not allowed as nodes: Cluster/Group (an analysis result)". Current code renders clusters as first-class nodes |

## 8. Derivations — §5.3 Patterns

| # | Issue | Severity | Details |
|---|-------|----------|---------|
| 8.1 | `BELOW_MIN_ATTENDANCE` pattern missing | 🟠 | §5.3: Show "can still miss N sessions". Not implemented |
| 8.2 | `SUDDEN_DROP` pattern missing | 🟠 | §5.3: Two-proportion z-test, 14d vs 60d. Not implemented |
| 8.3 | `SLOT_CONCENTRATION` pattern missing | 🟠 | §5.3: Chi-square for subject/period/weekday concentration. Not implemented |
| 8.4 | `GROUP_SKIPPER` pattern missing | 🟠 | §5.3: Member of bunk group flag. Not implemented |
| 8.5 | `LONG_ABSENCE` pattern missing | 🟠 | §5.3: Consecutive full-day absences → welfare check-in. Not implemented |
| 8.6 | `IMPROVING` pattern missing | 🟠 | §5.3: Bunk rate falling significantly. Not implemented |
| 8.7 | **Composite "trouble score" present** | 🔴 | §5.3: "No composite trouble score". Current code has `AnchorScore`, `ScoreSnapshot`, `score` fields, `risk_score` everywhere |

## 9. Prediction (§6) — The Core Feature

| # | Issue | Severity | Details |
|---|-------|----------|---------|
| 9.1 | **Prediction system entirely missing** | 🔴 | §6: P(bunk) per (student, upcoming session) — baseline, logistic regression, LightGBM. **None implemented** |
| 9.2 | No feature engineering | 🔴 | §6: Rolling bunk rates, same-weekday×period rate, streak, graph features. None built |
| 9.3 | No walk-forward validation | 🔴 | §6: Walk-forward time split, PR-AUC, precision@10, Brier score. Not implemented |
| 9.4 | No `docs/MODEL_CARD.md` | 🔴 | §12 phase 3 deliverable. Missing |
| 9.5 | No watchlist with probability bands | 🔴 | §6: Per-period ranked watchlist with probability bands + top-3 reason chips. Not implemented |
| 9.6 | No cold-start fallback | 🟠 | §6: Rule-based fallback labeled "low confidence" when <4 weeks data |

## 10. UI/UX (§7)

| # | Issue | Severity | Details |
|---|-------|----------|---------|
| 10.1 | **Home screen is wrong** | 🔴 | §1: "The home screen is the 'Today' watchlist". Current home is `DashboardView` with KPIs, not the prediction watchlist |
| 10.2 | Missing "Today watchlist" screen | 🔴 | §7 screen 1: Ranked watchlist of students likely to bunk. Not implemented (requires §6 prediction) |
| 10.3 | "Section overview" partially there | 🟠 | §7 screen 2: Needs weekday×period bunk **heatmap**, per-subject bunk rate bar chart. Current dashboard has basic weekly activity but no heatmap |
| 10.4 | Graph uses wrong technology | 🔴 | §3/§7: "React + Cytoscape.js (compound nodes, fcose layout, expand-collapse)". Current uses custom canvas rendering, not Cytoscape |
| 10.5 | Student dossier incomplete | 🟠 | §7 screen 4: Needs timeline, patterns, partners, observations, interventions with before/after bunk rate, prediction. Currently has basic attendance + peers |
| 10.6 | No "Settings" screen for thresholds | 🟠 | §7 screen 6: Thresholds with plain-language explanations. Missing from UI |
| 10.7 | Extra unauthorized screens | 🟡 | Current app has: CalendarRiskView, AuditLogView, AlertsView, CalendarView — not in §7 spec |

## 11. Bunk Network Behavior (§7)

| # | Issue | Severity | Details |
|---|-------|----------|---------|
| 11.1 | **Landing view wrong** | 🔴 | §7: Landing = validated SKIPS_WITH subgraph only, no-edge students in sidebar. Current shows hierarchical tree with all students |
| 11.2 | No compound containers for bunk groups | 🔴 | §7: Cytoscape compound containers. Not using Cytoscape at all |
| 11.3 | No focus mode | 🟠 | §7: 1-hop full opacity, 2-hop 30%, rest 10%. Not implemented per spec |
| 11.4 | No evidence drawer on edge click | 🔴 | §7: Click edge → list co-bunk sessions + "Skipped together 7 times; if independent we'd expect about 2." Not implemented |
| 11.5 | No breadcrumbs (Section>Group>Student) | 🟠 | §7: Breadcrumb navigation. Partially implemented but wrong structure |
| 11.6 | Overlay toggle wrong | 🟠 | §7: Friends (mutual), Observations, Interventions. Max 3. Current has HIERARCHICAL, FRIENDS_WITH, BUNKS_WITH, STUDIES_WITH, TAGGED_AS, MEMBER_OF |
| 11.7 | No time scrubber | 🟡 | §7: Replay by week. Not implemented |
| 11.8 | No anonymize names toggle | 🟠 | §7/§10: Privacy toggle for projector use. Referenced in Stitch brief but not implemented |

## 12. Visual Encoding (§7)

| # | Issue | Severity | Details |
|---|-------|----------|---------|
| 12.1 | Student color wrong | 🔴 | §7: Single-hue sequential scale for predicted bunk probability. Current uses traffic-light red/green/yellow risk colors |
| 12.2 | Student size wrong | 🟠 | §7: Size = bunk rate over last 30 days. Not implemented |
| 12.3 | Edge colors wrong | 🔴 | §7: Okabe-Ito colour-blind safe palette: SKIPS_WITH #D55E00, Friends #009E73, Observations #E69F00, Interventions #CC79A7. Current uses #ef4444, #4ade80, #3b82f6, #f59e0b — NOT colour-blind safe |
| 12.4 | Ambient animation | 🟡 | §7: "No ambient animation. Layout runs once, freezes". Current state unclear |

## 13. API (§8)

| # | Issue | Severity | Details |
|---|-------|----------|---------|
| 13.1 | **API structure doesn't match spec** | 🟠 | §8 specifies exact endpoints. Current uses `/api/v1/` prefix (spec uses `/api/`), different route structure |
| 13.2 | Missing `GET /api/today` | 🔴 | §8: Today watchlist endpoint. Not implemented |
| 13.3 | Missing `GET /api/sections/{id}/bunk-graph` | 🟠 | §8: With filter params `from, to, subject, period, weekday, overlays`. Not implemented per spec |
| 13.4 | Missing `GET /api/pairs/{roll_a}/{roll_b}/evidence` | 🔴 | §8: Evidence for a student pair. Not implemented |
| 13.5 | Missing `GET /api/students/{roll}/timeline` | 🟠 | §8: Student timeline. Not separate endpoint |
| 13.6 | Missing `POST /api/flags/{id}/dismiss` | 🟠 | §8: False-positive feedback. Not implemented |
| 13.7 | Ingest endpoint wrong | 🟡 | §8: `POST /api/ingest/attendance` (async, dry-run, idempotent). Current has `/api/v1/ingest/attendance` without dry-run mode |

## 14. Ingestion (§9)

| # | Issue | Severity | Details |
|---|-------|----------|---------|
| 14.1 | Column format uses student_id not roll_no | 🟠 | §9: Columns are `roll_no, date, period, subject_code, status`. Current uses student_id FK |
| 14.2 | Status codes wrong | 🟠 | §9: Statuses `P / A / L / OD / ML`. Current enums: `PRESENT / ABSENT / LATE / MEDICAL_LEAVE / APPROVED_LEAVE / ON_DUTY` — mapping exists but input format not matched |
| 14.3 | No idempotent upsert on (roll_no, date, period) | 🟠 | §9: Idempotent. Current has unique constraint but unclear if true upsert |
| 14.4 | No post-ingest recomputation | 🔴 | §9: After ingest, recompute SKIPS_WITH, groups, patterns, predictions in <5s. Not implemented |

## 15. Privacy & Ethics (§10) — Non-Negotiable

| # | Issue | Severity | Details |
|---|-------|----------|---------|
| 15.1 | **RBAC not enforced** | 🔴 | §10: Teacher sees only sections they teach. Current code has role concepts but no actual enforcement — all data accessible |
| 15.2 | No audit-log per view | 🟠 | §10: Audit-log every view, tag, export. Audit log exists but not triggered on reads |
| 15.3 | Stigmatizing language | 🔴 | §10: Flags are "reasons to check in", never verdicts. Current uses "delinquent", "ringleader", "anchor" language |
| 15.4 | Students can see labels | 🟠 | §10: Students never see labels. Current `StudentMyDataView` may expose classification data |
| 15.5 | No DPDP Act compliance flags | 🟡 | §10: India's DPDP Act 2023 items flagged for legal review. Not documented |

## 16. Testing & Validation (§11)

| # | Issue | Severity | Details |
|---|-------|----------|---------|
| 16.1 | No synthetic data generator per spec | 🟠 | §11: Must plant known bunk groups, random absences, mass-absence days. Current `seed_60_students.py` is a demo seeder, not a proper synthetic generator |
| 16.2 | No acceptance tests | 🔴 | §11: Planted groups recovered with precision≥0.9, recall≥0.8; random data yields ≤fdr_alpha edges. Not implemented |
| 16.3 | No unit tests for derivations | 🟠 | §11: Unit tests for every derivation. Current tests cover auth/audit/dev but not derivations |
| 16.4 | No prediction backtest | 🔴 | §11: Prediction backtest vs baseline. Not implemented (no prediction system) |

## 17. Missing Documentation (§12)

| # | Issue | Severity | Details |
|---|-------|----------|---------|
| 17.1 | No `docs/SCHEMA.md` | 🟠 | §12 phase 1: Every node, edge, formula, threshold, worked example |
| 17.2 | No `docs/METRICS.md` | 🟠 | §12 phase 1: Formulas and why naive rule fails |
| 17.3 | No `docs/MODEL_CARD.md` | 🔴 | §12 phase 3: Prediction model card |
| 17.4 | No `docs/QUALITY.md` | 🟡 | §12 phase 6: Audit against §13 checklist |

## 18. Acceptance Checklist (§13) Status

| Checklist Item | Status |
|---|---|
| No SKIPS_WITH edge unless c, lift, FDR all pass | ❌ Not implemented |
| Random-only synthetic data → ~0 edges | ❌ Not testable |
| Every edge has `derived_from` + `evidence` | ❌ Missing |
| "Who skips Physics together?" in ≤2 interactions | ❌ No subject filter on graph |
| Landing graph never draws students without a validated edge | ❌ All students drawn |
| No more than 3 edge types at once; colour-blind safe | ❌ 6+ edge types; wrong palette |
| Glow on selected node only; no ambient animation | ⚠️ Unclear |
| Prediction beats baseline or UI says it doesn't | ❌ No prediction |
| RBAC + audit log enforced; anonymize toggle works | ❌ Not enforced |
| No mock data in production paths | ⚠️ Hardcoded names exist |

---

## 19. Extra/Unauthorized Features (to Remove or Refactor)

| Feature | Location | Issue |
|---|---|---|
| `AnchorScore` table | [`orm.py:383-401`](file:///d:/Makerov/Actual%20project/backend/app/models/orm.py#L383-L401) | Composite score — banned by §5.3 |
| `ScoreSnapshot` table | [`orm.py:404-418`](file:///d:/Makerov/Actual%20project/backend/app/models/orm.py#L404-L418) | "support_priority" / "strengths" bands — not in spec |
| `CalendarRisk` table/view | [`orm.py:421-437`](file:///d:/Makerov/Actual%20project/backend/app/models/orm.py#L421-L437) | Not a spec feature |
| `Marks` / `CGPASnapshot` tables | [`orm.py:210-237`](file:///d:/Makerov/Actual%20project/backend/app/models/orm.py#L210-L237) | Not in spec (no marks data) |
| `LLMCallLog` table | [`orm.py:517-529`](file:///d:/Makerov/Actual%20project/backend/app/models/orm.py#L517-L529) | Gemini integration not in spec |
| `CalendarRiskView` | Frontend | Not a spec screen |
| `AuditView` | Frontend | Not a spec screen (audit log is internal) |
| Hardcoded roll numbers | Graph engine | `"21CSB007"`, `"21CSB033"`, etc. hardcoded as cohort reps |
| Hardcoded teacher name | Graph engine | `"Prof. Raghav Sharma"` scattered throughout |

---

## Recommended Fix Sequence

Following the phased approach from §12:

### Phase 1: Schema & Documentation
1. Rename project to "Makarov" everywhere
2. Create proper `sessions` table (academic, not auth)
3. Add `derived_from`, `params_hash`, `evidence` to `edges` table  
4. Add `analysis_snapshots` table
5. Remove `AnchorScore`, `ScoreSnapshot`, `CalendarRisk`, `Marks`, `CGPASnapshot`
6. Rename edge types: `CO_ABSENT`→`SKIPS_WITH`, `FRIENDS_WITH`→`NAMED_FRIEND`
7. Write `docs/SCHEMA.md` and `docs/METRICS.md`

### Phase 2: Derivations & Testing
8. Implement proper bunk detection (partial-day check per §2)
9. Implement `SKIPS_WITH` derivation with hypergeometric test + BH-FDR (§5.1)
10. Implement Leiden/Louvain on SKIPS_WITH graph only (§5.2)
11. Implement all 6 pattern flags (§5.3) — remove all "trouble scores"
12. Remove all stigmatizing labels (§1.2, §1.3, §1.4)
13. Build synthetic data generator with planted groups (§11)
14. Write acceptance + unit tests

### Phase 3: Prediction
15. Build feature engineering pipeline (§6)
16. Implement baseline + logistic regression + LightGBM
17. Walk-forward validation, write `docs/MODEL_CARD.md`

### Phase 4: API
18. Restructure API to match §8 endpoints exactly
19. Add filter params for bunk-graph endpoint
20. Add evidence endpoint, today endpoint, dismiss endpoint

### Phase 5: Frontend
21. Replace custom canvas with Cytoscape.js + fcose layout
22. Implement "Today watchlist" as home screen
23. Fix visual encoding (single-hue sequential, Okabe-Ito edges)
24. Implement evidence drawer, focus mode, compound containers
25. Add anonymize toggle
26. Remove unauthorized screens

### Phase 6: Quality
27. Write `docs/QUALITY.md` auditing against §13
28. Run full acceptance checklist

---

> [!CAUTION]
> **0 out of 10** acceptance checklist items currently pass. The statistical core (SKIPS_WITH) and prediction system (§6) are the two highest-priority gaps, as every downstream feature depends on them.
