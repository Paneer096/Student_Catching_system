# Makarov v2: Bunk Detection, Investigation & Prediction

> **How to use this file**
> - Paste everything from "Master Build Prompt" down to the end of section 13 into your coding LLM.
> - The **Appendix: Google Stitch brief** goes into Google Stitch separately.

---

# Master Build Prompt

## 0. Working mode

You are a senior full-stack + data engineer building **Makarov**. Work in the phases listed in section 12.

- After each phase: stop, summarize, list your assumptions, and wait for my "go".
- Do not advance while tests fail.
- If something is ambiguous, state your assumption and continue.
- Every threshold is a named setting with a code comment explaining why it has that value.

## 1. Product purpose

Makarov is a teacher-facing tool that helps a teacher:

1. **Predict** who is likely to bunk.
2. **Detect** who bunks repeatedly, when, and with whom.
3. **See the evidence** behind every flag.
4. **Log actions** and see whether they worked.

The knowledge graph is the **investigation view** for points 2 and 3. It is not the home screen. The home screen is the "Today" watchlist.

## 2. Definitions (build everything on these)

- **Session**: a scheduled class that was actually held (section, subject, teacher, date, period). Classes not held (holiday, teacher absent) are excluded.
- **Attendance record**: (student, session, status). Status is one of `PRESENT | ABSENT | LATE | OD (on-duty) | ML (medical leave)`.
- **Bunk**: unexcused `ABSENT` in a held session while `PRESENT` in at least one other session the same day (a partial-day skip).
- **Full-day absence**: `ABSENT` in every session that day. Tracked separately as a welfare signal, not as a bunk, unless the setting `include_full_day_absence=true`.
- **Degraded mode**: if the data has only one status per day, run in degraded mode (daily absence), say so in the UI, and lower the confidence labels.
- **Mass-absence session**: a session where at least `mass_absence_threshold` (default 40%) of the section is absent. These are excluded from pair analysis (fests, strikes, transport issues).

## 3. Architecture

- **Facts** live in PostgreSQL (SQLite is fine for an MVP): `students, teachers, sections, subjects, sessions, attendance, survey_nominations, observations, interventions, ingestion_runs`.
- **Derived data** lives in an `edges` table (`src, dst, type, weight, props jsonb, derived_from, params_hash, computed_at, evidence`) plus versioned `analysis_snapshots` (groups, patterns, predictions).
- **Graph computation**: NetworkX, per section (up to about 150 students).
- **Neo4j is optional.** If I already use it, project only dimension nodes and derived edges into it. Never store raw attendance rows there.
- **Backend**: FastAPI.
- **Frontend**: React + TypeScript + Cytoscape.js (compound nodes, fcose layout, expand-collapse). Do NOT write custom canvas renderers. Use Sigma.js + graphology only if sections exceed about 500 nodes.

## 4. Graph schema

### Nodes

Each node must be something a teacher can point to.

| Node | Notes |
|---|---|
| Student | Central entity |
| Teacher | |
| Section | |
| Subject | |
| Club | Only if data exists |
| Observation | Teacher-logged event |
| Intervention | Teacher-logged event |

- **Session** is a real entity but too numerous to draw. It is a relational table used for filters and evidence panels.
- **Not allowed as nodes**: Cluster/Group (an analysis result), Risk, Influence, Location.

### Edges

Every edge carries `derived_from`, `computed_at`, and `params_hash`.

| Edge | Direction | Source / derivation | Question it answers |
|---|---|---|---|
| `ENROLLED_IN` | Student → Section | Student master list. Not drawn; shown as container/side panel | Which section is this student in? |
| `TEACHES` | Teacher → Section (prop `subject_code`) | Timetable. Not drawn on the bunk graph; used in filters | Who teaches what here? |
| `SKIPS_WITH` | Student ↔ Student | Derived, statistically validated (section 5.1) | Who bunks together? |
| `NAMED_FRIEND` | Student → Student (directed) | Raw survey nomination. Derived flag `mutual=true` if reciprocated. `STUDIES_WITH` / `HANGS_OUT_WITH` become a property `kind`, not separate edge types | Do bunk groups match friend groups? |
| `MEMBER_OF` | Student → Club | Survey (optional) | What are they engaged in? |
| `OBSERVED` | Teacher → Observation → Student | Teacher action (type, note, timestamp) | What has a teacher noticed? |
| `INTERVENED` | Teacher → Intervention → Student | Teacher action (action, date). Computed props: `bunk_rate_14d_before`, `bunk_rate_14d_after` | Did the intervention work? |
| `LEADS_SKIPS` | Student → Student | EXPERIMENTAL, off by default (section 5.4) | Who tends to skip first? |

**Banned edge names**: `CONNECTED_TO`, `ASSOCIATED_WITH`, `KNOWS`, `RELATED_TO`, `INFLUENCES`.

## 5. Derivations

### 5.1 SKIPS_WITH (statistically validated co-bunking)

1. Build matrix **B** (students × eligible sessions), where 1 = bunk. Build an eligibility mask (session held, not excused).
2. For each pair of students:
   - `N` = sessions where both were eligible
   - `a`, `b` = each student's bunk count
   - `c` = co-bunks (both bunked the same session)
   - `expected = a*b/N`
   - `lift = c/expected`
   - `jaccard = c/(a+b-c)`
   - `p` = one-sided hypergeometric / Fisher exact test
3. Apply **Benjamini-Hochberg FDR** correction across all pairs in the section.
4. Create the edge **iff** `c >= min_co_bunks` (default 4) **AND** `lift >= min_lift` (default 2.0) **AND** `q <= fdr_alpha` (default 0.05). Edge `weight = jaccard`.
5. Vectorize: `C = Bm @ Bm.T`. The whole section must compute in under 1 second.
6. Store the co-bunk session ids as `evidence`.
7. Support filters (date range, subject, period, weekday). Filtered runs re-derive on the filtered sessions and are cached by `params_hash`. This powers "Who skips Physics together?".
8. In `docs/METRICS.md`, document why a naive ">= 3 co-absent days" rule fails: two unrelated students who are each absent 15% of 100 days share about 2.25 absent days on average, so about 40% of random pairs would pass.

### 5.2 Bunk groups (analysis result, never a graph node)

- Run Leiden (or Louvain with a fixed seed) on the `SKIPS_WITH` graph, `weight = jaccard`. Minimum group size is 3; pairs are shown as "pairs".
- **Stable IDs**: match each new group to the previous snapshot by member overlap (Jaccard) and inherit the ID.
- Also report overlap with mutual-friend circles (e.g. "4 of 5 members are mutual friends").

### 5.3 Patterns (replace trouble_score / classification)

Rule-based flags. Thresholds live in settings, and each flag has a computed evidence string.

- `BELOW_MIN_ATTENDANCE`: attendance below `min_attendance` (default 75%; confirm your university's rule). Show "can still miss N sessions".
- `SUDDEN_DROP`: bunk rate over the last 14 days vs the prior 60 days, two-proportion z-test, p < 0.05.
- `SLOT_CONCENTRATION`: bunks concentrated in one subject / period / weekday (chi-square vs uniform, minimum 5 bunks).
- `GROUP_SKIPPER`: member of a bunk group.
- `LONG_ABSENCE`: at least `k` consecutive full-day absences. Route to a **welfare check-in**, not discipline.
- `IMPROVING`: bunk rate falling significantly.

There is **no composite "trouble score"**. The only numeric risk is the prediction probability (section 6). No labels like "ringleader" or "troublemaker".

### 5.4 LEADS_SKIPS (experimental, off by default)

- Only with period-level data. On days a pair co-bunks, count who bunked the earlier period.
- Require at least 8 ordered co-bunk days and a one-sided binomial test vs 0.5 (p < 0.05).
- Display text: "tends to skip earlier in the day". Never "influences".

## 6. Prediction (the core feature)

- **Target**: P(bunk) for each (student, upcoming session).
- **Features**:
  - rolling bunk rate (7 / 30 / 90 days)
  - same weekday × period rate
  - same-subject rate
  - current streak and days since last bunk
  - earlier status today
  - day before/after a holiday
  - lab vs theory
  - attendance margin to `min_attendance`
  - graph features: number of top `SKIPS_WITH` partners already absent today, group membership, partner bunk rates
- **Models**:
  1. Baseline = the student's smoothed historical rate for that slot
  2. Logistic regression
  3. LightGBM

  Choose by evidence, not preference.
- **Validation**: walk-forward time split only (never a random split). Report PR-AUC, precision@10 per day, Brier score / calibration, and lift over baseline in `docs/MODEL_CARD.md`.
- **Output**: a per-period ranked watchlist with probability bands and top-3 reason chips (coefficients or SHAP).
- **Cold start** (under 4 weeks of data): rule-based fallback labelled "low confidence".
- Retrain weekly and log drift.

## 7. UI / UX

### Screens

1. Today watchlist
2. Section overview (KPIs, weekday × period bunk heatmap, per-subject bunk rate)
3. Bunk Network (graph)
4. Student dossier (timeline, patterns, partners, observations, interventions, prediction)
5. Ingest & data quality
6. Settings

**Global filter bar**: date range, subject, period, weekday, include/exclude excused.

### Bunk Network behavior

- **Landing view** = validated `SKIPS_WITH` subgraph only. Students with no edges are not drawn; they appear in a sidebar list "No bunk partners found".
- Bunk groups are Cytoscape **compound containers**. Click one to expand/focus.
- Click a student for **focus mode**: 1-hop neighbors at full opacity, 2-hop at 30%, everything else at 10%. The dossier opens.
- Click an edge to open an **Evidence drawer** listing the co-bunk sessions (date, period, subject) and a plain-language line, e.g. "Skipped together 7 times; if independent we'd expect about 2."
- **Navigation**: breadcrumbs (Section > Group > Student) plus Back. Zoom/pan are geometric only (no semantic zoom).
- **Overlays (toggle)**: Friends (mutual), Observations, Interventions. Never show more than 3 edge types at once. Structural edges are not drawn.
- **Time scrubber**: replay by week. This is the only animation permitted besides the focus-fade (150-300 ms).
- Honest empty states.
- A privacy toggle, "anonymize names", for projector use.

### Visual encoding (every visual property must carry information)

- **Student color**: single-hue sequential scale (light to dark) for predicted bunk probability. No red/green traffic lights. Patterns are shown as a small icon or ring, not extra colors.
- **Student size**: bunk rate over the last 30 days. Hover shows the number.
- **Other node types**: distinct shapes (diamond = teacher, square = subject, hexagon = club), fixed size, labelled on hover and in a legend.
- **Edge colors** (Okabe-Ito, colour-blind safe):
  - `SKIPS_WITH` `#D55E00` (thickness = jaccard)
  - Friends `#009E73` (dashed if one-way)
  - Observations `#E69F00`
  - Interventions `#CC79A7`
- **Glow** on the selected node only. No ambient animation. The layout runs once, freezes, and re-runs only on user action.

### Google Stitch workflow

- Generate screens 1, 2, 4, 5, 6 (and the app shell around screen 3) in Google Stitch from the brief in the appendix.
- Export HTML/CSS/Tailwind (or go via Figma), then convert to React components.
- Stitch does not produce graph logic: leave a placeholder `div` for the canvas and implement it in Cytoscape.

## 8. API

Filters are query params. Real DB data only. Empty arrays when there is no data.

```
GET  /api/today?date=&period=
GET  /api/sections
GET  /api/sections/{id}/summary
GET  /api/sections/{id}/bunk-graph?from=&to=&subject=&period=&weekday=&overlays=
GET  /api/sections/{id}/groups
GET  /api/pairs/{roll_a}/{roll_b}/evidence
GET  /api/students/{roll}/profile
GET  /api/students/{roll}/timeline
POST /api/observations
POST /api/interventions
POST /api/flags/{id}/dismiss        (false-positive feedback)
POST /api/ingest/attendance         (async job, dry-run mode, idempotent)
GET  /api/ingest/{run_id}
```

## 9. Ingestion

- Columns: `roll_no, date, period, subject_code, status`. Statuses: `P / A / L / OD / ML`.
- Idempotent upsert on `(roll_no, date, period)`.
- Unknown roll numbers go into an error report. They are never silently dropped.
- Times are in IST.
- After ingest, recompute `SKIPS_WITH`, groups, patterns and predictions for the affected sections in **under 5 seconds** (150 students × 120 days × 7 periods).

## 10. Privacy & ethics (non-negotiable)

- **Role-based access**: a teacher sees only sections they teach (via `TEACHES`). Admin/HOD have broader access. Audit-log every view, tag and export.
- **India's DPDP Act 2023**: consent for survey data, data minimization, retention limits, verifiable parental consent for under-18 students. Flag these items for legal review.
- Flags are "reasons to check in", never verdicts. A human decides, and the UI shows uncertainty.
- Students never see labels.
- Long or sudden absence routes to welfare support.

## 11. Testing & validation

- **Synthetic data generator**, flagged `synthetic=true`, never reachable from production paths, with a visible demo banner. It plants known bunk groups, random absences, mass-absence days, excused leaves and partial-day bunks.
- **Acceptance**:
  - planted groups recovered with precision >= 0.9 and recall >= 0.8
  - pure-random data yields edges at a rate <= `fdr_alpha`
  - the naive ">= 3" rule demonstrably fails the same test
- Unit tests for every derivation, ingestion idempotency, API contract tests, and a prediction backtest vs baseline.

## 12. Phases

1. `docs/SCHEMA.md` + `docs/METRICS.md` (every node, edge, formula, threshold, and one worked example each) + DDL. **STOP.**
2. Ingestion + synthetic generator + derivations + tests. **STOP.**
3. Prediction + `docs/MODEL_CARD.md`. **STOP.**
4. API. **STOP.**
5. Frontend (using Stitch exports) + graph canvas. **STOP.**
6. `docs/QUALITY.md`: audit against section 13.

## 13. Acceptance checklist

- [ ] No `SKIPS_WITH` edge exists unless the `c`, `lift` and FDR criteria all pass.
- [ ] Random-only synthetic data produces about 0 edges.
- [ ] Every edge has `derived_from` + `evidence`; every pattern has an evidence string.
- [ ] "Who skips Physics together?" is answerable in 2 interactions or fewer (set the subject filter, view the graph).
- [ ] The landing graph never draws students without a validated edge.
- [ ] No more than 3 edge types visible at once; the palette is colour-blind safe.
- [ ] Glow on the selected node only; no ambient animation.
- [ ] Prediction beats the baseline on a walk-forward backtest, or the UI says it doesn't.
- [ ] RBAC + audit log enforced; the anonymize toggle works.
- [ ] No mock data reachable in production paths.

---

# Appendix: Google Stitch brief

Paste this into Google Stitch separately.

```
Design a desktop web app for college teachers called Makarov, which detects and predicts class bunking.
Style: calm, clean, data-dense, light theme, neutral grays with one blue accent; avoid red/green status colors,
use a single-hue orange scale for risk. Left sidebar nav: Today, Sections, Bunk Network, Students, Data Import, Settings.
Screens:
1) Today: ranked watchlist table of students likely to bunk in the next period; columns: name, probability band,
   top 3 reason chips, last bunk date; filter bar (period, subject).
2) Section overview: KPI cards (attendance %, bunk rate, students below 75%), a weekday x period heatmap,
   and a bar chart of bunk rate per subject.
3) Bunk Network: full-width empty canvas area (I will implement the graph in code), filter bar on top
   (date range, subject, period, weekday), edge-type toggles on the left, legend, and a collapsible right panel.
4) Student dossier: attendance timeline, pattern chips with evidence, bunk partners list, observations,
   interventions with before/after bunk rate, a "log observation" form.
5) Data import: CSV drag-drop, validation report with errors per row, import history.
6) Settings: thresholds with plain-language explanations.
Include an "anonymize names" toggle in the top bar.
```
