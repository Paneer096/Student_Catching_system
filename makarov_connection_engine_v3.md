# Makarov Connection Engine v3: build spec for Antigravity

> **What this file is.** A from-scratch replacement for Makarov's connection logic, plus the extra data imports that make the connections real, plus the UI behaviour that goes with them.
> **Status.** The Python in section 8 was written, run and tested before being put here: **60 automated tests pass**, including negative controls on pure-noise registers and recovery of planted bunk groups. Measured results are in section 9, known limits in section 10, and the log of mistakes I found in my own first draft is in section 11.
> **How to use it.** Paste the whole file into Antigravity as the task brief. Section 0 is written to the agent.

---

## 0. Instructions to the coding agent (read first)

1. **Replace, do not patch.** The current graph and connection logic is being removed. Copy the `makarov_engine/` package from section 8 into the backend **verbatim**, keeping file names. Do not "improve" thresholds: every threshold lives in `EngineConfig` with a comment explaining it.
2. **Delete all of this** from the existing project:
   - every code path that creates `PEER_OF`, `MENTORS`, `SUPERVISES`, `Incident` or `Club` edges/nodes from anything other than the uploads in section 3;
   - hardcoded cluster names ("Study Circle Alpha", "Tech/Lab circle", "Backbenchers") and hardcoded cluster colours;
   - PageRank roles (Anchor, Bridge, Associate, crown badge), the Dijkstra "Pathfinder", and the merging/averaging of parallel edges;
   - the "Entity Injector" ability to create arbitrary ties (teacher notes remain, see section 2);
   - glow, particle, pulse and "tactical HUD" styling;
   - the status normaliser that falls back to `PRESENT`, the roster defaults (`gender="M"`, `strength=60`, `room="Room 201"`, `semester=year*2-1`), `dob` collection, `errors="replace"` when decoding, and the router that always returns `"status": "SUCCESS"`;
   - the API defaults `validated_only=false` and `min_weight=3`.
3. **Hard rules.**
   - An edge may exist only if it comes from (a) the engine's `BUNKS_WITH` derivation or (b) an upload listed in section 3. Teacher notes are stored as observations and are never drawn as ties.
   - Every edge carries `source_type` and `derived_from`. The frontend never computes ties; it renders the payload from `build_graph_payload`.
   - No mock data in production paths. `synthetic.py` is for tests and a clearly bannered demo mode only.
   - Unknown or ambiguous input is **rejected with a line number and reason**, never guessed.
4. **Order of work.** (1) add the package and run its tests; (2) create DB tables and ingestion endpoints using the validators; (3) engine job and cache; (4) API; (5) ingestion screen; (6) graph screen. Stop after each step and run the tests.
5. **Dependencies:** `numpy`, `pandas`, `scipy`, `networkx>=3.0`, `pytest`.

---

## 1. What was wrong, and what replaces it

| Problem in the old system | Replacement |
|---|---|
| `PEER_OF`, clubs, incidents, mentors have no data source in the 4 CSVs | Removed. Social ties now come only from explicit uploads (survey, seating, groups, transport, clubs) and are labelled with their source. |
| "Study Circle", "Backbenchers" names invented for numbered communities | Groups are numbered "Bunk group 1, 2, 3" and described only by computed facts. |
| Co-absence rule (>=3 shared days) links ~40% of unrelated pairs | Exact stratified significance test with false-discovery control (section 5). |
| Four consecutive periods counted as four coincidences | One decision to skip = one **cell** (a block of periods). Ties also need overlaps on >=3 different dates. |
| Everyone who skips Friday afternoon looks connected | The test holds weekday and time of day fixed. |
| Illness, leave, cancelled classes, fests counted as bunking | Excluded explicitly (section 5). |
| "Anchor", "follower", "if the anchor bunks the pod follows" | Removed. A co-occurrence graph has no direction. Nodes show plain counts only. |
| Weight averaging of unrelated edge types | Real ties are never merged into the bunk weight. They are shown as **corroboration** badges. |
| Status `A` / `AB` silently became `PRESENT` | Strict status mapping; unknown tokens are rejected (section 4). |

---

## 2. Tie types (the semantic contract)

Each row is a sentence a teacher can verify. If a tie cannot be explained in one sentence with a named source, it must not exist.

| Tie type | Sentence | Source | Kind | Drawn by default? |
|---|---|---|---|---|
| `BUNKS_WITH` | "A and B skipped the same block of the day more often than chance explains." | **Derived** from attendance by the engine | Behavioural | **Yes** (the main edge) |
| `NAMED_FRIEND` | "A (and/or B) named the other as a friend." | `peer_survey` upload, consent required | Social | Overlay |
| `NAMED_STUDY_PARTNER` | "A (and/or B) named the other as someone they study with." | `peer_survey` upload | Social | Overlay |
| `SITS_WITH` | "A and B were assigned the same bench in overlapping dates." | `seating` upload | Social | Overlay |
| `PROJECT_TEAM` | "A and B are in the same project team." | `groups` upload | Social | Overlay |
| `SAME_CLUB` | "A and B are in the same club." | `clubs` upload | Social | Overlay |
| `SHARES_ROUTE` | "A and B use the same bus route or hostel block." | `transport` upload | **Context** | Badge only |
| `LAB_BATCH`, `ELECTIVE`, `TUTORIAL`, `MENTOR_GROUP` | "A and B were put in the same batch/group by the institution." | `groups` upload | **Context** | Badge only |

- **Social** ties suggest a relationship. **Context** ties are shared circumstances (same bus, same lab batch) that can explain skipping together *without* any friendship; the UI flags them as "may explain".
- Survey ties are self-reported. Show them as "named by the student", never as fact.
- **Teacher notes** ("I saw A and B together") live in the student dossier as observations with author and date. They are not edges.
- Not implemented on purpose: direction/leadership, friendship scores, risk labels like "ringleader". Attendance data cannot show them.

---

## 3. Datasets to ingest

Three are required for any result. The rest each make the graph more accurate or add real, independent ties.

| Dataset | Tier | What it unlocks | Required columns | Optional columns |
|---|---|---|---|---|
| `attendance` | **Core** | Everything. Must include **all periods** of the day (merged registers). | `date, roll_no, period, subject_code, status` | `marked_by` |
| `roster` | **Core** | Students and sections. | `roll_no, name, section_code` | `branch, year, batch_code` |
| `timetable` | **Core** | Coverage checks (sessions with no attendance). | keep existing columns | leave unknown fields empty; **no invented defaults** |
| `calendar` | Accuracy | Holidays; attendance rows on holidays are flagged. | keep existing columns | |
| `session_events` | Accuracy | Cancelled / teacher-absent sessions are removed so they are not read as mass absence. Test and assignment dates are stored for the prediction phase. | `date, event_type` | `period` (blank = all), `section_code`, `note` |
| `leaves` | Accuracy | Approved medical / on-duty leave is excused, never a bunk. | `roll_no, from_date, to_date, leave_type` | |
| `seating` | Real ties | `SITS_WITH`. | `roll_no, bench_id` | `section_code, effective_from, effective_to` |
| `groups` | Real ties + context | Project teams (social); lab batches, electives, tutorials, mentor groups (context). | `roll_no, group_type, group_code` | `effective_from, effective_to` |
| `transport` | Context | `SHARES_ROUTE`; explains co-skipping caused by a shared bus/hostel. | `roll_no, mode, route_or_block` | |
| `clubs` | Real ties | `SAME_CLUB`. | `roll_no, club_name` | `role, from_date, to_date` |
| `peer_survey` | Real ties | `NAMED_FRIEND`, `NAMED_STUDY_PARTNER`. | `respondent_roll_no, nominee_roll_no, relation, survey_date, consent` | |

Allowed values:
- `status`: `P, PRESENT, A, AB, ABS, ABSENT, LATE, ML, MEDICAL, OD, ON_DUTY` (case-insensitive). **Anything else, including `L`, is rejected until the user maps it** in the import screen.
- `event_type`: `CANCELLED, TEACHER_ABSENT, SUBSTITUTE, TEST, ASSIGNMENT_DUE, COLLEGE_EVENT`. Only `CANCELLED` and `TEACHER_ABSENT` remove sessions.
- `leave_type`: `MEDICAL, ON_DUTY, APPROVED_PERSONAL`.
- `group_type`: `LAB_BATCH, PROJECT_TEAM, ELECTIVE, TUTORIAL, MENTOR_GROUP`.
- `mode`: `BUS, HOSTEL, OWN` (`route_or_block` required for BUS and HOSTEL; `OWN` creates no tie).
- `relation`: `FRIEND, STUDY_PARTNER`. `consent`: `Y` required; rows with anything else are rejected and never stored. At most 5 nominations per student per relation.

Templates (one example row each):

```
attendance:   date,roll_no,period,subject_code,status
              2026-10-09,21CSB007,5,CS305L,A
roster:       roll_no,name,section_code,branch,year,batch_code
              21CSB007,Rohan Patil,CS-3B,CSE,3,B1
session_events: date,period,section_code,event_type,note
              2026-10-09,6,CS-3B,CANCELLED,Teacher on duty
leaves:       roll_no,from_date,to_date,leave_type
              21CSB007,2026-10-05,2026-10-07,MEDICAL
seating:      roll_no,section_code,bench_id,effective_from,effective_to
              21CSB007,CS-3B,B4,2026-08-01,2026-10-31
groups:       roll_no,group_type,group_code,effective_from,effective_to
              21CSB007,LAB_BATCH,B1,2026-08-01,
transport:    roll_no,mode,route_or_block
              21CSB007,BUS,R12
clubs:        roll_no,club_name,role,from_date,to_date
              21CSB007,ACM,member,2026-08-01,
peer_survey:  respondent_roll_no,nominee_roll_no,relation,survey_date,consent
              21CSB007,21CSB011,FRIEND,2026-09-01,Y
```

Practical way to collect `peer_survey`: a Google Form ("Who do you usually spend free time with? Up to 5"; "Who do you study with? Up to 5"; a mandatory consent checkbox) exported to CSV and reshaped to the template. Do not run it without institutional approval and student consent (section 7).

---

## 4. Ingestion screen (Data Import)

**Layout.** One page, three groups of cards: **Core**, **Improves accuracy**, **Adds real ties**. A readiness panel sits on top.

**Readiness panel** (computed, not decorative). Each line is pass / warn / missing with a fix link:
- attendance covers at least 15 school dates;
- at least 50% of student-days have 2 or more observed periods (otherwise bunks cannot be told apart from full-day absence);
- `register_sanity` shows no "absentees-only list" or "missing students" warning;
- roster matches the students found in attendance;
- optional: leaves uploaded, session events uploaded, and which tie sources are present ("No seating data: `SITS_WITH` unavailable").

**Dataset card.** Name, one-line "what this unlocks", required columns, **Download template** button, last upload (date, accepted/rejected row counts), **Upload** button.

**Upload wizard (4 steps).**
1. **File.** CSV or XLSX. Decode CSV as UTF-8 strictly; if that fails, show an encoding picker instead of silently replacing bytes. Hash the **raw bytes** (SHA-256). Refuse a byte-identical file already imported for the same dataset.
2. **Mapping.** Show detected headers with suggestions from `suggest_column_map`; the user confirms every mapping. A **date format selector** (`YYYY-MM-DD`, `DD-MM-YYYY`, `DD/MM/YYYY`, `MM/DD/YYYY`) with three parsed sample dates. For attendance, a **status token table**: every distinct unknown token with a dropdown (`PRESENT / ABSENT / LATE / MEDICAL_LEAVE / ON_DUTY / reject rows`).
3. **Dry run.** Calls the validator without writing. Shows: accepted, rejected, will-insert, will-update, unchanged. First 50 errors with **file line number, column, reason**; full errors as a downloadable CSV. Warnings from `register_sanity`. Blocking problems disable Confirm; warnings do not.
4. **Confirm.** Idempotent upsert on natural keys, wrapped in one transaction per file. Status is `ACCEPTED`, `PARTIAL` (some rows rejected) or `REJECTED` (nothing imported); never a hardcoded success. A re-upload that **changes** a stored value writes the old value to a history table.

**Peer survey card** additionally shows a consent notice, a required checkbox "Students consented to share these nominations", a retention period field, and "rows without `consent=Y` are rejected and not stored".

**After commit,** the backend recomputes the engine for the affected sections as a background job and the card shows "Recomputing ties..." then the new result summary.

---

## 5. How `BUNKS_WITH` is derived (plain language)

All of this is implemented and tested in section 8; this section explains it so reviewers can check it.

**Cell.** One student on one date in one **block** of periods. Default blocks: periods 1-4 and 5-8 (split at lunch; editable). A student who leaves for the afternoon makes **one** decision, so it is **one** cell, not four.

**Bunk.** A cell where the student skipped (unexcused `ABSENT`) while demonstrably on campus that day (present in at least one other period).

**Not a bunk, and excluded from the analysis:**
- full-day absence (not on campus);
- up to 2 leading absent periods followed by presence (late arrival; configurable);
- `MEDICAL_LEAVE` / `ON_DUTY`, or a date inside an approved leave;
- sessions marked cancelled / teacher absent;
- **class-wide skip cells**: if 40% or more of the students on campus (and at least 8 students) skipped the same block, that cell says nothing about private ties. It is excluded from tie inference and **listed** on screen as a class-wide skip event.

**The question asked of each pair.** "If each student's skip days were shuffled among days of the *same weekday and same time of day*, would these two still overlap this often?" Inside one weekday-and-block group with `n` shared cells where A skipped `a` and B skipped `b`, the chance overlap follows a hypergeometric distribution. The groups are independent, so the exact distribution of the total overlap is the convolution of the per-group distributions. That gives an exact p-value with no random sampling. Holding weekday and time of day fixed is what stops "everyone skips Friday afternoon" from creating ties.

**A tie exists only if all of these hold:**

| Condition | Default | Why |
|---|---|---|
| overlaps `c_cells` | >= 4 | enough evidence to say anything |
| distinct dates of those overlaps `co_dates` | >= 3 | two blocks on one date are not independent |
| lift = observed / expected | >= 2.0 | effect-size floor (measured: not the bottleneck; see section 9) |
| adjusted p-value `q` (Benjamini-Hochberg across **all** pairs of students with >= 4 bunk cells) | <= 0.05 | controls the share of false ties |

The tie `weight` is the Jaccard overlap, `c / (a + b - c)`, a plain "how much of their skipping is shared" number.

**Sensitivity presets** (all just `fdr_alpha`): Strict 0.05 (default), Balanced 0.10, Exploratory 0.20. Label Exploratory in the UI: "may include links that are coincidence".

**Groups.** Louvain community detection (fixed seed) on the validated ties only. Groups of 3+ are shown as groups; two-person ties are listed as pairs. Group ids are carried over between uploads by member overlap. Groups are an analysis result and are **not** stored as graph nodes.

**Filters** (date range, subject, periods, weekdays) are applied **after** the day-level facts are computed, so "Who skips Physics together?" works: the student's other periods still prove they were on campus.

**Corroboration.** For each validated tie, the engine lists the real ties the same two students also share (same club, same bench, named as friends, same bus, same lab batch). This is evidence **about** the relationship. It never changes the weight.

---

## 6. Graph screen (Bunk Network)

**Source of truth:** the JSON from `build_graph_payload`. The frontend draws it and nothing else.

**Status handling.** If `status` is not `OK`, show `message` and a link to Data Import instead of a graph:
- `INSUFFICIENT_DATA`: fewer than 15 school dates (or filters left no data);
- `PERIOD_DATA_REQUIRED`: single-period registers.

**What is drawn.**
- Only students with at least one validated tie. Everyone else appears in a side list "No bunk partner found" (with their bunk-cell count). Do not draw isolated dots.
- Bunk groups as containers (Cytoscape.js compound nodes). Two-person ties drawn plainly.
- Node **size** = `bunk_rate` (the only thing size means). Node fill is neutral. Label on hover/selection; a top-bar **Anonymize names** toggle shows initials/roll numbers for projector use.
- `BUNKS_WITH` edge: colour `#D55E00`, thickness = `weight`.
- Overlays (checkbox list, **maximum two at a time**, so at most three edge types are on screen): `NAMED_FRIEND` `#009E73` (solid if mutual, dashed if one-way), `SITS_WITH` `#0072B2`, `SAME_CLUB` `#CC79A7`, `PROJECT_TEAM` `#E69F00`. Overlay edges appear only between students already drawn.
- A small badge on a `BUNKS_WITH` edge when it is corroborated by a social tie, and a different badge when a context tie "may explain" it.
- No glow, particles, pulsing or ambient animation. Only the selected node gets an outline. The layout runs once and freezes; it re-runs only when the user changes filters or presses "Re-layout".

**Filter bar.** Date range, subject, period, weekday, sensitivity preset, "show dismissed". Changing a filter calls the API with those parameters (cached by parameters and data version).

**Click an edge: Evidence drawer.**
1. `plain_language` sentence from `pair_evidence` (rendered as is; it is template text, not generated).
2. Table of the exact overlapping sessions: date, weekday, periods each student skipped, subjects.
3. Numbers: overlaps, expected by chance, lift, adjusted p-value.
4. Shared real ties, grouped **"Relationship evidence"** (social) and **"Shared circumstances that may explain this"** (context).
5. **Dismiss as not a real tie**, with a reason dropdown (Same bus / transport problem; Same lab batch or timetable clash; Approved activity; Other). Dismissals hide the edge and are stored; they never change the statistics.

**Click a node: focus mode.** Neighbours at full opacity, everything else at 15%. A dossier panel shows bunk and eligible cell counts, partners with evidence links, and teacher observations.

**Side panel "Class-wide skip days"**: the excluded mass-skip cells (date, block, how many skipped). This is real information for a teacher.

**Honest copy to include.** "These ties show students skipping together, not why. More attendance data finds more ties: with about 8 joint skips per pair in a term only about 1 in 5 pairs is detected."

**Empty state.** "No bunk groups are detectable in this data." with the shuffle-control result link (section 7).


---

## 7. Wiring into the backend

### 7.1 Tables (names are suggestions; keep the columns)

| Table | Columns |
|---|---|
| `ingestion_batches` | `batch_id, dataset, file_sha256 (raw bytes), rows_total, rows_ok, rows_rejected, status (ACCEPTED/PARTIAL/REJECTED), uploaded_by, uploaded_at` |
| `students` | `roll_no PK, name, section_code, branch, year, batch_code` |
| `attendance` | `roll_no, date, period, subject_code, status, batch_id`, PK `(roll_no, date, period)` |
| `attendance_history` | `roll_no, date, period, old_status, new_status, batch_id, changed_at` |
| `session_events`, `leaves` | the columns in section 3, plus `batch_id` |
| `membership_ties` | `roll_no, tie_type, key, valid_from, valid_to, batch_id` (output of the `memberships_from_*` functions) |
| `peer_nominations` | `respondent, nominee, tie_type, mutual, survey_date, batch_id` (output of `nominations_from_survey`) |
| `engine_runs` | `run_id, section_code, params_hash, filters_json, data_version, status, quality_json, computed_at` |
| `derived_edges` | `run_id, student_a, student_b, c_cells, co_dates, expected, lift, p_value, q_value, weight, source_type, derived_from, evidence_json` |
| `edge_dismissals` | `section_code, student_a, student_b, reason, dismissed_by, dismissed_at` |
| `audit_log` | `who, action, object, at` |

Remove `dob` and `gender` from the roster. Nothing in this system uses them.

### 7.2 Engine job

```python
from makarov_engine.config import EngineConfig
from makarov_engine.engine import run_engine
from makarov_engine.payload import build_graph_payload

SENSITIVITY = {"strict": 0.05, "balanced": 0.10, "exploratory": 0.20}

def compute_graph(section_code, sensitivity="strict", filters=None, names=None, overlays=()):
    att = load_attendance(section_code)                  # canonical statuses only
    cancelled = load_session_events(section_code, types={"CANCELLED", "TEACHER_ABSENT"})
    leaves = load_leaves(section_code)
    mem, nom = load_membership_ties(section_code), load_peer_nominations(section_code)
    cfg = EngineConfig(fdr_alpha=SENSITIVITY[sensitivity])
    filters = filters or {}                              # subject=, periods=[..], weekdays=[0..6], date_from=, date_to=
    prev = load_previous_groups(section_code) if not filters else None
    res = run_engine(att, cfg, cancelled, leaves, prev, **filters)
    if not filters and sensitivity == "strict":
        save_previous_groups(section_code, {g["group_id"]: set(g["members"]) for g in res.groups})
    return res, build_graph_payload(res, names, mem, nom, overlays=overlays, dismissed=load_dismissals(section_code))
```

- Run **per section**, passing only that section's students.
- Trigger after any commit to `attendance`, `leaves` or `session_events`. Debounce bursts of uploads.
- Cache key: `(section, params_hash, filters, sensitivity, data_version)`, where `data_version` is the highest batch id among attendance/leaves/events.
- Only the unfiltered Strict run updates the stored group ids.

### 7.3 API

```
GET  /api/ingest/datasets                              cards + readiness panel
GET  /api/ingest/{dataset}/template.csv
POST /api/ingest/{dataset}/dry-run                     file + mapping JSON -> counts, errors, sanity warnings
POST /api/ingest/{dataset}/commit                      {dry_run_id}
GET  /api/ingest/batches
GET  /api/sections/{code}/bunk-graph                   ?sensitivity=&subject=&period=&weekday=&from=&to=&overlays=&include_dismissed=
GET  /api/sections/{code}/pairs/{a}/{b}/evidence       pair_evidence(...)
POST /api/sections/{code}/pairs/{a}/{b}/dismiss        {reason}
GET  /api/sections/{code}/diagnostics/shuffle-control  async job, shuffle_control(...)
```

### 7.4 Access and privacy (required)

- A teacher sees only sections they teach. Admin/HOD see more. Log every graph view, evidence view, dismissal and export in `audit_log`.
- India's DPDP Act 2023 applies to student data, including verifiable parental consent for under-18s. Treat consent, retention limits and purpose limitation as requirements and get institutional / legal review before collecting survey or transport data.
- Evidence drawers are for teachers only. Never put a co-bunk partner's attendance in a message to parents or students.
- A tie is a reason to talk to the student, not a verdict. Long full-day absences go to a welfare check-in flow, not a discipline flow.

### 7.5 Prove it on your real data

Run `shuffle_control` on a real section before trusting any graph. It scrambles each student's skip days within weekday and time of day (each student keeps their own habits) and counts how many ties survive:

```python
from makarov_engine.diagnostics import shuffle_control
print(shuffle_control(att, cancelled=cancelled, leaves=leaves, n_runs=20))
# {'real_edges': 12, 'shuffled_edges_per_run': [0, 0, 1, ...], 'verdict': 'Real ties exceed the shuffled baseline.'}
```

If `real_edges` is not clearly above the shuffled maximum, the data has no detectable bunk groups. That is a valid result; show the empty state.

---

## 8. The code

Layout:

```
backend/makarov_engine/
  __init__.py  config.py  statuses.py  cells.py  pairtest.py  engine.py
  ties.py  validators.py  payload.py  diagnostics.py  synthetic.py
  tests/  conftest.py  test_statuses_validators.py  test_cells.py  test_pairtest.py
          test_engine.py  test_ties.py  test_payload.py  test_diagnostics.py
```

Run the tests from `backend/`: `pytest makarov_engine/tests -q` (expect 60 passed).

#### `makarov_engine/__init__.py`

```python
"""Makarov connection engine: statistically validated bunk ties + real-source social ties."""
ENGINE_VERSION = "3.0.0"
```

#### `makarov_engine/config.py`

```python
"""Every threshold lives here, with the reason it has that value. Nothing is hardcoded elsewhere."""
from __future__ import annotations

import hashlib
import json
from dataclasses import asdict, dataclass
from typing import Optional


@dataclass(frozen=True)
class EngineConfig:
    # --- What counts as one "cell" -------------------------------------------------
    # A cell = one student x one date x one block of periods. Blocks are inclusive period ranges.
    # Why blocks and not single periods: a student who leaves for the afternoon is absent in 4
    # consecutive periods. Treating those as 4 independent events makes two students who left
    # together ONCE look like four coincidences. One block = one decision to skip.
    # Default splits the day at lunch (periods 1-4 | 5-8). Edit to match your timetable.
    blocks: tuple = ((1, 4), (5, 8))

    # --- What counts as a bunk ----------------------------------------------------
    # Absent for the first N periods and present afterwards is far more likely a late arrival
    # than a bunk, so it is excluded (not counted as a bunk, not counted as attended).
    late_arrival_max_periods: int = 2
    treat_late_arrival_as_bunk: bool = False

    # A cell where >= this share of the students who were on campus skipped is a class-wide
    # event (fest, strike, bus failure, a cancelled-in-practice lecture). Shared skipping there
    # says nothing about two students' private ties, so the cell is excluded from tie inference.
    mass_cell_threshold: float = 0.40
    # Do not apply the mass rule to tiny samples (2 of 3 students is not "mass").
    mass_cell_min_students: int = 8

    # --- Data sufficiency (honest empty states) ----------------------------------
    # Fewer school dates than this and no tie can be trusted.
    min_school_dates: int = 15
    # Need >= 2 observed sessions on most student-days, otherwise a bunk cannot be told apart
    # from a full-day absence (see docs: single-teacher registers are not enough).
    min_multi_period_share: float = 0.5

    # --- Pair testing ---------------------------------------------------------------
    # Only students with at least this many bunk cells are tested. A student with fewer than
    # min_co_cells bunks can never be in a tie, so testing them only wastes statistical power.
    # The filter uses each student's own count, which the stratified null holds fixed, so it
    # does not bias the test.
    min_active_bunk_cells: int = 4
    # A pair needs this many cells where both were eligible, or the comparison is meaningless.
    min_shared_cells: int = 20
    # Effect-size / evidence floors on top of the significance test:
    min_co_cells: int = 4      # overlaps needed
    min_co_dates: int = 3      # on at least this many different dates (cells on one date are not independent)
    min_lift: float = 2.0      # observed / expected under the null
    fdr_alpha: float = 0.05    # Benjamini-Hochberg false discovery rate across ALL tested pairs

    # Optional: also hold "which part of the term" fixed (guards against two students who both
    # began skipping after midterms). None = off. Costs power because strata get small.
    time_chunk_weeks: Optional[int] = None

    # --- Groups ----------------------------------------------------------------------
    louvain_resolution: float = 1.0
    min_group_size: int = 3
    seed: int = 7  # fixed so repeated runs give identical groups

    def params_hash(self) -> str:
        blob = json.dumps(asdict(self), sort_keys=True)
        return hashlib.sha256(blob.encode()).hexdigest()[:12]
```

#### `makarov_engine/statuses.py`

```python
"""Strict attendance status normalisation. Unknown tokens are REJECTED, never guessed."""
from __future__ import annotations

import pandas as pd

CANONICAL = ("PRESENT", "ABSENT", "LATE", "MEDICAL_LEAVE", "ON_DUTY")

# Deliberately NOT mapped: "L" (late or leave?), "LV", "X", "-", "". The UI must make the
# user map these explicitly; guessing silently corrupts attendance.
DEFAULT_ALIASES = {
    "P": "PRESENT", "PRES": "PRESENT", "PRESENT": "PRESENT",
    "A": "ABSENT", "AB": "ABSENT", "ABS": "ABSENT", "ABSENT": "ABSENT",
    "LATE": "LATE",
    "ML": "MEDICAL_LEAVE", "MEDICAL": "MEDICAL_LEAVE", "MEDICAL_LEAVE": "MEDICAL_LEAVE",
    "OD": "ON_DUTY", "ON_DUTY": "ON_DUTY", "ON DUTY": "ON_DUTY",
}


def normalize_statuses(raw: pd.Series, user_map: dict | None = None):
    """Return (canonical Series with NaN for unknown, DataFrame of unknown tokens with counts)."""
    mapping = dict(DEFAULT_ALIASES)
    if user_map:
        bad = {v for v in user_map.values() if v not in CANONICAL}
        if bad:
            raise ValueError(f"user_map targets must be one of {CANONICAL}; got {sorted(bad)}")
        mapping.update({str(k).strip().upper(): v for k, v in user_map.items()})
    token = raw.astype("string").str.strip().str.upper()
    canon = token.map(mapping)
    unk = token[canon.isna()].fillna("<EMPTY>").replace("", "<EMPTY>")
    unknown = unk.value_counts().rename_axis("token").reset_index(name="rows")
    return canon.astype(object).where(canon.notna(), None), unknown
```

#### `makarov_engine/cells.py`

```python
"""Turn a raw attendance register into 'cells' (student x date x block) with two flags:
   eligible  - the student was expected and observed, so a bunk was possible
   bunk      - the student skipped while demonstrably on campus that day
Everything downstream (tie tests, evidence, node sizes) reads only from these arrays.
"""
from __future__ import annotations

from dataclasses import dataclass

import numpy as np
import pandas as pd

from .config import EngineConfig
from .statuses import CANONICAL

REQUIRED = ("roll_no", "date", "period", "status")


@dataclass
class CellData:
    status: str                  # OK | INSUFFICIENT_DATA | PERIOD_DATA_REQUIRED
    message: str
    students: list
    cells: pd.DataFrame          # K rows: date, block, weekday, date_idx, stratum
    Y: np.ndarray                # (N, K) bool  bunk
    E: np.ndarray                # (N, K) bool  eligible   (Y implies E)
    detail: pd.DataFrame         # one row per bunked session: roll_no, date, block, period, subject_code
    mass_cells: pd.DataFrame     # class-wide skip events that were excluded
    quality: dict


def _empty(status, message, quality, students=()):
    return CellData(status, message, list(students), pd.DataFrame(), np.zeros((len(students), 0), bool),
                    np.zeros((len(students), 0), bool), pd.DataFrame(), pd.DataFrame(), quality)


def build_cells(att: pd.DataFrame, cfg: EngineConfig, cancelled: pd.DataFrame | None = None,
                leaves: pd.DataFrame | None = None, subject: str | None = None, periods=None, weekdays=None,
                date_from=None, date_to=None) -> CellData:
    """Filters (subject, periods, weekdays, date range) are applied AFTER the day-level facts are computed.
    That matters: if you filtered the raw rows to 'Physics' first, a student who skipped the afternoon
    would look absent all day (their morning rows would be gone) and every bunk would vanish."""
    missing = [c for c in REQUIRED if c not in att.columns]
    if missing:
        raise ValueError(f"attendance is missing columns: {missing}")
    if len(cfg.blocks) > 10:
        raise ValueError("at most 10 blocks are supported")

    df = att.copy()
    if "subject_code" not in df.columns:
        df["subject_code"] = ""
    df["roll_no"] = df["roll_no"].astype(str).str.strip().str.upper()
    df["date"] = pd.to_datetime(df["date"]).dt.normalize()
    df["period"] = df["period"].astype(int)
    unknown_status = ~df["status"].isin(CANONICAL)
    if unknown_status.any():
        raise ValueError("engine accepts only canonical statuses; normalise at ingestion "
                         f"(found {sorted(df.loc[unknown_status, 'status'].astype(str).unique())[:5]})")
    df = df.drop_duplicates(["roll_no", "date", "period"], keep="last").reset_index(drop=True)
    q: dict = {"rows_in": int(len(df))}
    all_students = sorted(df["roll_no"].unique())

    # 1) sessions that were not held
    q["rows_cancelled"] = 0
    if cancelled is not None and len(cancelled):
        c = cancelled.copy()
        c["date"] = pd.to_datetime(c["date"]).dt.normalize()
        whole_days = c.loc[c["period"].isna(), "date"].unique()
        part = (c.dropna(subset=["period"]).assign(period=lambda x: x["period"].astype(int))
                [["date", "period"]].drop_duplicates().assign(_cx=1))
        before = len(df)
        df = df[~df["date"].isin(whole_days)]
        df = df.merge(part, on=["date", "period"], how="left")
        df = df[df["_cx"].isna()].drop(columns="_cx").reset_index(drop=True)
        q["rows_cancelled"] = int(before - len(df))

    # 2) approved leave turns ABSENT into an excused status (never a bunk)
    q["rows_excused_by_leave"] = 0
    if leaves is not None and len(leaves):
        lv = leaves.copy()
        lv["roll_no"] = lv["roll_no"].astype(str).str.strip().str.upper()
        lv["from_date"] = pd.to_datetime(lv["from_date"]).dt.normalize()
        lv["to_date"] = pd.to_datetime(lv["to_date"]).dt.normalize()
        lv["_kind"] = np.where(lv["leave_type"].astype(str).str.upper().eq("ON_DUTY"), "ON_DUTY", "MEDICAL_LEAVE")
        ab = df.loc[df["status"] == "ABSENT", ["roll_no", "date"]].reset_index().rename(columns={"index": "_row"})
        m = ab.merge(lv[["roll_no", "from_date", "to_date", "_kind"]], on="roll_no")
        m = m[(m["date"] >= m["from_date"]) & (m["date"] <= m["to_date"])].drop_duplicates("_row")
        df.loc[m["_row"].to_numpy(), "status"] = m["_kind"].to_numpy()
        q["rows_excused_by_leave"] = int(len(m))

    # 3) map periods to blocks (periods outside every block are ignored, and counted)
    block = np.full(len(df), -1, dtype=int)
    per = df["period"].to_numpy()
    for b, (lo, hi) in enumerate(cfg.blocks):
        block[(per >= lo) & (per <= hi)] = b
    q["rows_outside_blocks"] = int((block < 0).sum())
    df["block"] = block
    df = df[df["block"] >= 0].sort_values(["roll_no", "date", "period"]).reset_index(drop=True)

    q["n_school_dates"] = int(df["date"].nunique())
    q["n_students"] = len(all_students)

    # 4) day-level facts per student
    df["present"] = df["status"].isin(["PRESENT", "LATE"])
    df["absent"] = df["status"].eq("ABSENT")
    df["excused"] = df["status"].isin(["MEDICAL_LEAVE", "ON_DUTY"])
    keys = [df["roll_no"], df["date"]]
    pres_int = df["present"].astype(int)
    df["n_obs"] = df.groupby(keys)["period"].transform("size")
    df["n_present"] = pres_int.groupby(keys).transform("sum")
    df["n_absent"] = df["absent"].astype(int).groupby(keys).transform("sum")
    df["cum_present"] = pres_int.groupby(keys).cumsum()

    day = df.drop_duplicates(["roll_no", "date"])
    q["multi_period_share"] = float((day["n_obs"] >= 2).mean()) if len(day) else 0.0
    q["full_day_absent_student_days"] = int(((day["n_present"] == 0) & (day["n_absent"] >= 1)).sum())

    if q["n_school_dates"] < cfg.min_school_dates:
        return _empty("INSUFFICIENT_DATA",
                      f"Only {q['n_school_dates']} school dates; need at least {cfg.min_school_dates} "
                      "before any tie can be trusted.", q, all_students)
    if q["multi_period_share"] < cfg.min_multi_period_share:
        return _empty("PERIOD_DATA_REQUIRED",
                      "Most student-days have a single observed period, so a bunk cannot be told apart from "
                      "a full-day absence. Upload the merged day register (all periods) or all teachers' registers.",
                      q, all_students)

    # 5) late arrivals: absent for the first few periods, present afterwards
    lead = df["cum_present"] == 0
    n_lead = lead.groupby(keys).transform("sum")
    late = lead & df["absent"] & (n_lead <= cfg.late_arrival_max_periods) & (df["n_present"] >= 1)
    if cfg.treat_late_arrival_as_bunk:
        late = pd.Series(False, index=df.index)
    df["late_arrival"] = late
    q["late_arrival_rows"] = int(late.sum())

    # 6) the two row-level flags
    on_campus = df["n_present"] >= 1                       # full-day absences are not bunks and not eligible
    df["exp_row"] = on_campus & ~df["excused"] & ~df["late_arrival"]
    df["bunk_row"] = df["exp_row"] & df["absent"]

    sel = pd.Series(True, index=df.index)
    if subject:
        sel &= df["subject_code"].astype(str).str.upper().eq(str(subject).upper())
    if periods:
        sel &= df["period"].isin(list(periods))
    if weekdays is not None:
        sel &= df["date"].dt.weekday.isin(list(weekdays))
    if date_from is not None:
        sel &= df["date"] >= pd.Timestamp(date_from)
    if date_to is not None:
        sel &= df["date"] <= pd.Timestamp(date_to)
    q["filtered"] = bool(not sel.all())
    dff = df[sel]
    agg = (dff.groupby(["roll_no", "date", "block"], sort=False)
              .agg(elig=("exp_row", "any"), bunk=("bunk_row", "any")).reset_index())
    agg = agg[agg["elig"]]

    # 7) class-wide skip events are excluded (and reported, because they are information in themselves)
    cell_tot = agg.groupby(["date", "block"]).agg(n_elig=("elig", "sum"), n_bunk=("bunk", "sum")).reset_index()
    cell_tot["rate"] = cell_tot["n_bunk"] / cell_tot["n_elig"]
    cell_tot["mass"] = (cell_tot["n_elig"] >= cfg.mass_cell_min_students) & (cell_tot["rate"] >= cfg.mass_cell_threshold)
    mass = cell_tot[cell_tot["mass"]][["date", "block", "n_elig", "n_bunk", "rate"]].reset_index(drop=True)
    q["mass_cells"] = int(len(mass))
    agg = agg.merge(cell_tot[["date", "block", "mass"]], on=["date", "block"])
    agg = agg[~agg["mass"]].drop(columns="mass")
    if agg.empty:
        return _empty("INSUFFICIENT_DATA", "No eligible cells remain after exclusions and filters.", q, all_students)

    # 8) dense arrays
    cells = (agg[["date", "block"]].drop_duplicates().sort_values(["date", "block"]).reset_index(drop=True))
    cells["weekday"] = cells["date"].dt.weekday
    cells["date_idx"] = (cells["date"] - cells["date"].min()).dt.days
    chunk = (cells["date_idx"] // (7 * cfg.time_chunk_weeks)) if cfg.time_chunk_weeks else 0
    cells["stratum"] = pd.factorize(chunk * 100 + cells["weekday"] * 10 + cells["block"])[0]
    cells["cell_idx"] = np.arange(len(cells))
    agg = agg.merge(cells[["date", "block", "cell_idx"]], on=["date", "block"])
    sidx = pd.Index(all_students).get_indexer(agg["roll_no"])
    E = np.zeros((len(all_students), len(cells)), bool)
    Y = np.zeros_like(E)
    E[sidx, agg["cell_idx"].to_numpy()] = True
    Y[sidx, agg["cell_idx"].to_numpy()] = agg["bunk"].to_numpy()

    detail = dff[dff["bunk_row"]][["roll_no", "date", "block", "period", "subject_code"]]
    detail = detail.merge(cells[["date", "block"]], on=["date", "block"])  # drops mass cells
    q["n_cells"] = int(len(cells))
    q["eligible_cell_share"] = float(E.mean())
    return CellData("OK", "", all_students, cells, Y, E, detail.reset_index(drop=True), mass, q)
```

#### `makarov_engine/pairtest.py`

```python
"""Exact stratified test: do two students skip the same half-days more often than chance?

Null hypothesis (in one sentence a teacher can read): "If each student's skip days were shuffled
among days of the same weekday and the same time of day, would these two still overlap this often?"

Within one stratum (say 'Friday afternoon') with n eligible cells, student A skipped a of them and
B skipped b. If unrelated, the overlap is Hypergeometric(n, a, b). Strata are independent, so the
exact null distribution of the TOTAL overlap is the convolution of the per-stratum pmfs. No
Monte-Carlo noise, so tiny p-values stay resolvable and multiple-testing correction works.
"""
from __future__ import annotations

import numpy as np
import pandas as pd
from scipy.stats import hypergeom

from .config import EngineConfig


def bh_qvalues(p: np.ndarray, m: int) -> np.ndarray:
    """Benjamini-Hochberg adjusted p-values. `p` are the computed p-values; `m` is the TOTAL number
    of hypotheses tested (untested pairs count as p = 1 and sit at the bottom of the ranking, so
    they only need to be in m)."""
    p = np.asarray(p, float)
    if p.size == 0:
        return p
    if m < p.size:
        raise ValueError("m must be >= number of p-values")
    order = np.argsort(p, kind="stable")
    ranked = p[order] * m / np.arange(1, p.size + 1)
    q_sorted = np.minimum.accumulate(ranked[::-1])[::-1]
    q = np.empty_like(p)
    q[order] = np.clip(q_sorted, 0.0, 1.0)
    return q


def stratified_overlap_pvalue(n_s, a_s, b_s, c_obs: int) -> tuple[float, float]:
    """P(total overlap >= c_obs) and E[total overlap] for per-stratum (n, a, b) triples."""
    pmf = np.array([1.0])
    expected = 0.0
    for n, a, b in zip(n_s, a_s, b_s):
        if n <= 0 or a <= 0 or b <= 0:
            continue
        expected += a * b / n
        k = np.arange(0, min(a, b) + 1)
        pmf = np.convolve(pmf, hypergeom.pmf(k, n, a, b))
    if c_obs >= pmf.size:
        return 0.0, expected
    return float(np.clip(pmf[c_obs:].sum(), 0.0, 1.0)), expected


def test_pairs(Y: np.ndarray, E: np.ndarray, strata: np.ndarray, date_idx: np.ndarray,
               students: list, cfg: EngineConfig) -> pd.DataFrame:
    """Return one row per CANDIDATE pair (overlap >= min_co_cells) with p and BH q.
    q is computed against ALL active pairs, not just candidates."""
    cols = ["student_a", "student_b", "c_cells", "co_dates", "n_shared", "a_bunks", "b_bunks",
            "expected", "lift", "jaccard", "p_value", "q_value", "tests_run"]
    active = np.where(Y.sum(1) >= cfg.min_active_bunk_cells)[0]
    n = len(active)
    if n < 2:
        return pd.DataFrame(columns=cols)
    m_tests = n * (n - 1) // 2
    Ya, Ea = Y[active].astype(np.float32), E[active].astype(np.float32)

    n_tot = Ea @ Ea.T
    a_tot = Ya @ Ea.T          # a_tot[i, j] = i's bunks on cells where j was also eligible
    c_tot = Ya @ Ya.T
    uniq = np.unique(strata)
    n_s, a_s = [], []
    for s in uniq:
        cols_s = np.where(strata == s)[0]
        Ys, Es = Ya[:, cols_s], Ea[:, cols_s]
        n_s.append(Es @ Es.T)
        a_s.append(Ys @ Es.T)

    rows = []
    iu, ju = np.triu_indices(n, k=1)
    keep = (c_tot[iu, ju] >= cfg.min_co_cells) & (n_tot[iu, ju] >= cfg.min_shared_cells)
    for i, j in zip(iu[keep], ju[keep]):
        ns = [int(M[i, j]) for M in n_s]
        as_ = [int(M[i, j]) for M in a_s]
        bs = [int(M[j, i]) for M in a_s]
        c = int(c_tot[i, j])
        p, exp = stratified_overlap_pvalue(ns, as_, bs, c)
        co_cells = np.where((Ya[i] > 0) & (Ya[j] > 0))[0]
        a_i, b_j = int(a_tot[i, j]), int(a_tot[j, i])
        rows.append(dict(
            student_a=students[active[i]], student_b=students[active[j]], c_cells=c,
            co_dates=int(np.unique(date_idx[co_cells]).size), n_shared=int(n_tot[i, j]),
            a_bunks=a_i, b_bunks=b_j, expected=exp, lift=(c / exp) if exp > 0 else np.inf,
            jaccard=c / (a_i + b_j - c) if (a_i + b_j - c) > 0 else 0.0, p_value=p))
    out = pd.DataFrame(rows, columns=cols[:-2])
    if out.empty:
        return pd.DataFrame(columns=cols)
    out["q_value"] = bh_qvalues(out["p_value"].to_numpy(), m_tests)
    out["tests_run"] = m_tests
    return out[cols]
```

#### `makarov_engine/engine.py`

```python
"""Orchestration: attendance -> validated BUNKS_WITH edges -> groups -> evidence."""
from __future__ import annotations

from dataclasses import dataclass, field

import networkx as nx
import numpy as np
import pandas as pd

from . import ENGINE_VERSION
from .cells import CellData, build_cells
from .config import EngineConfig
from .pairtest import test_pairs


@dataclass
class EngineResult:
    status: str
    message: str
    edges: pd.DataFrame          # validated BUNKS_WITH edges only
    tested: pd.DataFrame         # every candidate pair with p / q (audit trail, incl. rejected)
    groups: list                 # [{group_id, members, n_edges, mean_weight}]
    pairs_only: list             # two-person ties (not groups)
    nodes: pd.DataFrame          # per-student facts (no roles, no "influence")
    quality: dict
    params_hash: str
    cells: CellData = field(repr=False, default=None)


def _validated(tested: pd.DataFrame, cfg: EngineConfig, params_hash: str) -> pd.DataFrame:
    if tested.empty:
        return tested.assign(type=[], weight=[], source_type=[], derived_from=[])
    ok = ((tested["c_cells"] >= cfg.min_co_cells) & (tested["co_dates"] >= cfg.min_co_dates)
          & (tested["lift"] >= cfg.min_lift) & (tested["q_value"] <= cfg.fdr_alpha))
    e = tested[ok].copy()
    e["type"] = "BUNKS_WITH"
    e["weight"] = e["jaccard"]
    e["source_type"] = "DERIVED_ATTENDANCE"
    e["derived_from"] = f"makarov_engine:{ENGINE_VERSION}:{params_hash}"
    return e.sort_values("weight", ascending=False).reset_index(drop=True)


def match_group_ids(prev: dict | None, new_groups: list) -> list:
    """Give each new group the id of the previous group it overlaps most (Jaccard >= 0.5),
    otherwise a fresh id. Keeps ids stable between uploads. prev = {group_id: set(members)}."""
    prev = prev or {}
    used, out = set(), []
    next_id = (max(prev) + 1) if prev else 1
    scored = []
    for gi, members in enumerate(new_groups):
        for pid, pm in prev.items():
            j = len(members & pm) / len(members | pm)
            if j >= 0.5:
                scored.append((j, gi, pid))
    assigned = {}
    for j, gi, pid in sorted(scored, reverse=True):
        if gi not in assigned and pid not in used:
            assigned[gi] = pid
            used.add(pid)
    for gi, members in enumerate(new_groups):
        if gi not in assigned:
            while next_id in used or next_id in prev:
                next_id += 1
            assigned[gi] = next_id
            used.add(next_id)
        out.append(assigned[gi])
    return out


def build_groups(edges: pd.DataFrame, cfg: EngineConfig, prev_groups: dict | None = None):
    """Groups are an ANALYSIS RESULT computed from validated edges, never stored as graph nodes."""
    if edges.empty:
        return [], []
    g = nx.Graph()
    for r in edges.itertuples():
        g.add_edge(r.student_a, r.student_b, weight=float(r.weight))
    comms = nx.community.louvain_communities(g, weight="weight", resolution=cfg.louvain_resolution, seed=cfg.seed)
    comms = sorted((set(c) for c in comms), key=lambda c: (-len(c), sorted(c)[0]))
    big = [c for c in comms if len(c) >= cfg.min_group_size]
    small = [sorted(c) for c in comms if len(c) == 2]
    ids = match_group_ids(prev_groups, big)
    groups = []
    for gid, members in zip(ids, big):
        sub = g.subgraph(members)
        w = [d["weight"] for _, _, d in sub.edges(data=True)]
        groups.append(dict(group_id=gid, members=sorted(members), n_edges=sub.number_of_edges(),
                           mean_weight=float(np.mean(w)) if w else 0.0))
    return groups, small


def run_engine(att: pd.DataFrame, cfg: EngineConfig | None = None, cancelled=None, leaves=None,
               prev_groups: dict | None = None, **filters) -> EngineResult:
    """filters: subject=, periods=, weekdays=, date_from=, date_to=  (see build_cells). Include them in your cache key."""
    cfg = cfg or EngineConfig()
    ph = cfg.params_hash()
    cd = build_cells(att, cfg, cancelled, leaves, **filters)
    empty = pd.DataFrame()
    if cd.status != "OK":
        return EngineResult(cd.status, cd.message, empty, empty, [], [], empty, cd.quality, ph, cd)
    tested = test_pairs(cd.Y, cd.E, cd.cells["stratum"].to_numpy(), cd.cells["date_idx"].to_numpy(),
                        cd.students, cfg)
    edges = _validated(tested, cfg, ph)
    groups, pairs_only = build_groups(edges, cfg, prev_groups)
    gid_of = {m: g["group_id"] for g in groups for m in g["members"]}
    deg = pd.concat([edges["student_a"], edges["student_b"]]).value_counts() if len(edges) else pd.Series(dtype=int)
    nodes = pd.DataFrame({
        "roll_no": cd.students,
        "bunk_cells": cd.Y.sum(1),
        "eligible_cells": cd.E.sum(1),
    })
    nodes["bunk_rate"] = np.where(nodes["eligible_cells"] > 0, nodes["bunk_cells"] / nodes["eligible_cells"].clip(lower=1), np.nan)
    nodes["n_ties"] = nodes["roll_no"].map(deg).fillna(0).astype(int)
    nodes["group_id"] = nodes["roll_no"].map(gid_of)
    n_active = int((cd.Y.sum(1) >= cfg.min_active_bunk_cells).sum())
    cd.quality["active_students"] = n_active
    cd.quality["pairs_tested"] = n_active * (n_active - 1) // 2
    return EngineResult("OK", "", edges, tested, groups, pairs_only, nodes, cd.quality, ph, cd)


BLOCK_LABEL = lambda cfg, b: f"periods {cfg.blocks[b][0]}-{cfg.blocks[b][1]}"


def pair_evidence(res: EngineResult, a: str, b: str, cfg: EngineConfig | None = None) -> dict:
    """Everything a teacher needs to judge one tie: the exact dates and the plain-language claim.
    The sentence is a template filled from computed numbers; no generated text."""
    cfg = cfg or EngineConfig()
    a, b = a.upper(), b.upper()
    row = res.tested[((res.tested.student_a == a) & (res.tested.student_b == b)) |
                     ((res.tested.student_a == b) & (res.tested.student_b == a))]
    if row.empty:
        raise KeyError("pair was not a candidate (fewer than the minimum overlaps)")
    r = row.iloc[0]
    d = res.cells.detail
    da, db = d[d.roll_no == a], d[d.roll_no == b]
    shared = da.merge(db, on=["date", "block"], suffixes=("_a", "_b"))
    keys = shared[["date", "block"]].drop_duplicates().sort_values(["date", "block"])
    items = []
    for k in keys.itertuples():
        pa = sorted(da[(da.date == k.date) & (da.block == k.block)].period)
        pb = sorted(db[(db.date == k.date) & (db.block == k.block)].period)
        subj = sorted((set(da[(da.date == k.date) & (da.block == k.block)].subject_code) |
                       set(db[(db.date == k.date) & (db.block == k.block)].subject_code)) - {""})
        items.append(dict(date=str(k.date.date()), weekday=k.date.day_name(), block=BLOCK_LABEL(cfg, k.block),
                          periods_a=[int(x) for x in pa], periods_b=[int(x) for x in pb], subjects=subj))
    one_in = "more than 1,000,000" if r.p_value < 1e-6 else f"{int(round(1 / max(r.p_value, 1e-12))):,}"
    sentence = (f"{a} and {b} both skipped the same block of the day on {int(r.c_cells)} occasions across {int(r.co_dates)} "
                f"different dates. Given how often each skips, and which weekdays and times of day they usually "
                f"skip, about {r.expected:.1f} overlaps would be expected by chance. The chance of this many or more "
                f"by luck alone is about 1 in {one_in}. This shows they skip together, not why.")
    return dict(student_a=a, student_b=b, plain_language=sentence, co_cells=int(r.c_cells), co_dates=int(r.co_dates),
                expected=float(r.expected), lift=float(r.lift), p_value=float(r.p_value), q_value=float(r.q_value),
                jaccard=float(r.jaccard), validated=bool(((res.edges.student_a == r.student_a) &
                                                          (res.edges.student_b == r.student_b)).any()),
                sessions=items)


def partner_pressure(edges: pd.DataFrame, absent_now: set) -> dict:
    """Feature for the prediction model: how many validated bunk partners are already absent now."""
    out: dict = {}
    for r in edges.itertuples():
        for x, y in ((r.student_a, r.student_b), (r.student_b, r.student_a)):
            out[x] = out.get(x, 0) + (1 if y in absent_now else 0)
    return out
```

#### `makarov_engine/ties.py`

```python
"""Ties that come from REAL, NAMED sources (survey, seating, institution-assigned groups, transport, clubs).
Nothing here is inferred. Each tie keeps its source_type so the UI can say exactly where it came from.

Design rule: these are stored as MEMBERSHIPS (student -> key), never as pre-built pairs, so a lab batch of
60 does not explode into 1,770 edges. Pairs are only materialised for students already on screen.
"""
from __future__ import annotations

import itertools

import pandas as pd

# tie_type -> (kind, source_type).  SOCIAL ties suggest a relationship. CONTEXT ties are shared
# circumstances that can explain skipping together WITHOUT any friendship (same bus, same lab batch).
TIE_TYPES = {
    "NAMED_FRIEND":        ("SOCIAL",  "SURVEY"),
    "NAMED_STUDY_PARTNER": ("SOCIAL",  "SURVEY"),
    "SITS_WITH":           ("SOCIAL",  "INSTITUTION_ASSIGNED"),
    "PROJECT_TEAM":        ("SOCIAL",  "INSTITUTION_ASSIGNED"),
    "SAME_CLUB":           ("SOCIAL",  "INSTITUTION_ASSIGNED"),
    "SHARES_ROUTE":        ("CONTEXT", "INSTITUTION_ASSIGNED"),
    "LAB_BATCH":           ("CONTEXT", "INSTITUTION_ASSIGNED"),
    "ELECTIVE":            ("CONTEXT", "INSTITUTION_ASSIGNED"),
    "TUTORIAL":            ("CONTEXT", "INSTITUTION_ASSIGNED"),
    "MENTOR_GROUP":        ("CONTEXT", "INSTITUTION_ASSIGNED"),
}
MEMBERSHIP_COLS = ["roll_no", "tie_type", "key", "valid_from", "valid_to"]


def _norm(s):
    return s.astype(str).str.strip().str.upper()


def memberships_from_seating(df: pd.DataFrame) -> pd.DataFrame:
    """seating: roll_no, bench_id, [section_code, effective_from, effective_to].
    Two students share a SITS_WITH tie when they have the same bench (within the same section) at overlapping dates."""
    bench = df["bench_id"].astype(str).str.strip().str.upper()
    if "section_code" in df.columns:
        bench = df["section_code"].astype(str).str.strip().str.upper() + "|" + bench
    out = pd.DataFrame({"roll_no": _norm(df["roll_no"]), "tie_type": "SITS_WITH", "key": bench})
    out["valid_from"] = pd.to_datetime(df.get("effective_from"), errors="coerce")
    out["valid_to"] = pd.to_datetime(df.get("effective_to"), errors="coerce")
    return out[MEMBERSHIP_COLS]


def memberships_from_groups(df: pd.DataFrame) -> pd.DataFrame:
    """groups: roll_no, group_type, group_code, [subject_code, effective_from, effective_to]."""
    gt = df["group_type"].astype(str).str.strip().str.upper()
    bad = set(gt) - set(TIE_TYPES)
    if bad:
        raise ValueError(f"unknown group_type: {sorted(bad)}")
    out = pd.DataFrame({"roll_no": _norm(df["roll_no"]), "tie_type": gt,
                        "key": _norm(df["group_code"])})
    out["valid_from"] = pd.to_datetime(df.get("effective_from"), errors="coerce")
    out["valid_to"] = pd.to_datetime(df.get("effective_to"), errors="coerce")
    return out[MEMBERSHIP_COLS]


def memberships_from_transport(df: pd.DataFrame) -> pd.DataFrame:
    """transport: roll_no, mode (BUS|HOSTEL|OWN), route_or_block. OWN has no shared key and is dropped."""
    d = df[df["mode"].astype(str).str.upper() != "OWN"]
    out = pd.DataFrame({"roll_no": _norm(d["roll_no"]), "tie_type": "SHARES_ROUTE",
                        "key": _norm(d["mode"]) + "|" + _norm(d["route_or_block"])})
    out["valid_from"] = pd.NaT
    out["valid_to"] = pd.NaT
    return out[MEMBERSHIP_COLS]


def memberships_from_clubs(df: pd.DataFrame) -> pd.DataFrame:
    """clubs: roll_no, club_name, [role, from_date, to_date]."""
    out = pd.DataFrame({"roll_no": _norm(df["roll_no"]), "tie_type": "SAME_CLUB", "key": _norm(df["club_name"])})
    out["valid_from"] = pd.to_datetime(df.get("from_date"), errors="coerce")
    out["valid_to"] = pd.to_datetime(df.get("to_date"), errors="coerce")
    return out[MEMBERSHIP_COLS]


def nominations_from_survey(df: pd.DataFrame, known_rolls: set | None = None) -> pd.DataFrame:
    """peer_survey: respondent_roll_no, nominee_roll_no, relation (FRIEND|STUDY_PARTNER), survey_date, consent.
    Only rows with consent == Y are used. Self-nominations and unknown nominees are dropped.
    Returns DIRECTED nominations plus a `mutual` flag (the nominee also named the respondent, same relation)."""
    d = df.copy()
    d["respondent"] = _norm(d["respondent_roll_no"])
    d["nominee"] = _norm(d["nominee_roll_no"])
    d["relation"] = d["relation"].astype(str).str.strip().str.upper()
    d = d[d["consent"].astype(str).str.strip().str.upper().isin(["Y", "YES", "TRUE", "1"])]
    d = d[d["respondent"] != d["nominee"]]
    if known_rolls is not None:
        d = d[d["respondent"].isin(known_rolls) & d["nominee"].isin(known_rolls)]
    d = d.drop_duplicates(["respondent", "nominee", "relation"])
    pairs = set(zip(d["respondent"], d["nominee"], d["relation"]))
    d["mutual"] = [(n, r, rel) in pairs for r, n, rel in zip(d["respondent"], d["nominee"], d["relation"])]
    d["tie_type"] = d["relation"].map({"FRIEND": "NAMED_FRIEND", "STUDY_PARTNER": "NAMED_STUDY_PARTNER"})
    d = d.dropna(subset=["tie_type"])
    return d[["respondent", "nominee", "tie_type", "mutual", "survey_date"]].reset_index(drop=True)


def _overlap(a_from, a_to, b_from, b_to) -> bool:
    af = a_from if pd.notna(a_from) else pd.Timestamp.min
    bf = b_from if pd.notna(b_from) else pd.Timestamp.min
    at = a_to if pd.notna(a_to) else pd.Timestamp.max
    bt = b_to if pd.notna(b_to) else pd.Timestamp.max
    return max(af, bf) <= min(at, bt)


def shared_ties(a: str, b: str, memberships: pd.DataFrame | None, nominations: pd.DataFrame | None) -> list:
    """Every real tie two students share. Never merged into a score; returned as a list so the UI can show badges."""
    a, b = a.upper(), b.upper()
    out = []
    if memberships is not None and len(memberships):
        ma, mb = memberships[memberships.roll_no == a], memberships[memberships.roll_no == b]
        for r in ma.merge(mb, on=["tie_type", "key"], suffixes=("_a", "_b")).itertuples():
            if _overlap(r.valid_from_a, r.valid_to_a, r.valid_from_b, r.valid_to_b):
                kind, src = TIE_TYPES[r.tie_type]
                out.append(dict(tie_type=r.tie_type, kind=kind, source_type=src, detail=r.key))
    if nominations is not None and len(nominations):
        n = nominations[((nominations.respondent == a) & (nominations.nominee == b)) |
                        ((nominations.respondent == b) & (nominations.nominee == a))]
        for tt, g in n.groupby("tie_type"):
            kind, src = TIE_TYPES[tt]
            both = {a, b} <= set(g.respondent) and {a, b} <= set(g.nominee)
            out.append(dict(tie_type=tt, kind=kind, source_type=src, detail="mutual" if both else "one-way"))
    return out


def corroborate(edges: pd.DataFrame, memberships=None, nominations=None) -> pd.DataFrame:
    """Attach, to each validated bunk edge, the real ties the same two students also share.
    corroboration is evidence ABOUT the relationship; it never changes the edge weight."""
    e = edges.copy()
    ties = [shared_ties(r.student_a, r.student_b, memberships, nominations) for r in e.itertuples()]
    e["shared_ties"] = ties
    e["has_social_tie"] = [any(t["kind"] == "SOCIAL" for t in ts) for ts in ties]
    e["has_context_tie"] = [any(t["kind"] == "CONTEXT" for t in ts) for ts in ties]
    return e


def overlay_edges(visible: list, memberships=None, nominations=None, tie_types: set | None = None) -> pd.DataFrame:
    """Optional overlay edges between students ALREADY on screen only (bounds the drawing to a few hundred pairs)."""
    rows = []
    for a, b in itertools.combinations(sorted(set(x.upper() for x in visible)), 2):
        for t in shared_ties(a, b, memberships, nominations):
            if tie_types is None or t["tie_type"] in tie_types:
                rows.append(dict(student_a=a, student_b=b, type=t["tie_type"], kind=t["kind"],
                                 source_type=t["source_type"], detail=t["detail"]))
    return pd.DataFrame(rows, columns=["student_a", "student_b", "type", "kind", "source_type", "detail"])
```

#### `makarov_engine/validators.py`

```python
"""Strict CSV validators for every dataset. Each returns (clean_df, errors_df).
Rules: never guess, never silently drop. Every rejected row is reported with its file line number and a reason.
`errors_df` columns: line, column, message. Line numbers count the header as line 1."""
from __future__ import annotations

from typing import NamedTuple

import pandas as pd

from .statuses import normalize_statuses


class Validated(NamedTuple):
    """Every validator returns this. `clean` = accepted rows, `errors` = rejected rows with line + reason,
    `extras` = dataset-specific diagnostics (e.g. unknown status tokens for attendance)."""
    clean: pd.DataFrame
    errors: pd.DataFrame
    extras: dict

DATE_FORMATS = {"YYYY-MM-DD": "%Y-%m-%d", "DD-MM-YYYY": "%d-%m-%Y", "DD/MM/YYYY": "%d/%m/%Y", "MM/DD/YYYY": "%m/%d/%Y"}
ERR_COLS = ["line", "column", "message"]

COLUMN_SYNONYMS = {  # used by the UI's column-mapping step
    "roll_no": ["roll_no", "roll no", "rollno", "roll", "reg no", "regno", "registration number", "enrollment no", "enrolment no", "prn"],
    "date": ["date", "attendance date", "class date"],
    "period": ["period", "slot", "lecture", "lecture no", "hour"],
    "subject_code": ["subject_code", "subject code", "course code", "subject", "course"],
    "status": ["status", "attendance", "present/absent", "mark", "att"],
    "section_code": ["section_code", "section", "division", "div", "class"],
    "name": ["name", "student name", "full name"],
}


def suggest_column_map(headers: list, wanted: list) -> dict:
    """Best-effort header -> canonical column suggestion. The UI shows it and the user confirms; it is never applied silently."""
    norm = {h: str(h).strip().lower().replace("_", " ") for h in headers}
    out = {}
    for w in wanted:
        for h, n in norm.items():
            if n in [s.replace("_", " ") for s in COLUMN_SYNONYMS.get(w, [w])]:
                out[w] = h
                break
    return out


def _errors(rows):
    return pd.DataFrame(rows, columns=ERR_COLS)


def _missing(df, cols):
    return [c for c in cols if c not in df.columns]


def _dates(series: pd.Series, fmt: str, column: str, errs: list, required=True):
    parsed = pd.to_datetime(series.astype("string").str.strip(), format=DATE_FORMATS[fmt], errors="coerce")
    bad = parsed.isna() & (series.notna() & (series.astype("string").str.strip() != "") if not required else True)
    for i in series.index[bad]:
        errs.append((int(i) + 2, column, f"'{series[i]}' is not a valid date in format {fmt}"))
    return parsed


def _rolls(series, known, errs, column="roll_no"):
    r = series.astype("string").str.strip().str.upper()
    for i in r.index[r.isna() | (r == "")]:
        errs.append((int(i) + 2, column, "roll number is empty"))
    if known is not None:
        unk = ~r.isin(known) & r.notna() & (r != "")
        for i in r.index[unk]:
            errs.append((int(i) + 2, column, f"roll number '{r[i]}' is not in the student roster"))
    return r


def _finish(df, errs, keep_cols):
    errors = _errors(errs)
    bad_lines = set(errors["line"]) if len(errors) else set()
    ok = df[[(int(i) + 2) not in bad_lines for i in df.index]]
    return Validated(ok[keep_cols].reset_index(drop=True), errors, {})


def validate_attendance(df, date_format="YYYY-MM-DD", status_map=None, known_rolls=None, max_period=12):
    need = ["date", "roll_no", "period", "subject_code", "status"]
    m = _missing(df, need)
    if m:
        raise ValueError(f"missing required columns: {m}")
    errs: list = []
    d = df.copy()
    d["date"] = _dates(d["date"], date_format, "date", errs)
    d["roll_no"] = _rolls(d["roll_no"], known_rolls, errs)
    per = pd.to_numeric(d["period"], errors="coerce")
    for i in d.index[per.isna() | (per < 1) | (per > max_period) | (per % 1 != 0)]:
        errs.append((int(i) + 2, "period", f"'{d.at[i, 'period']}' is not an integer from 1 to {max_period}"))
    d["period"] = per
    canon, unknown = normalize_statuses(d["status"], status_map)
    for i in d.index[canon.isna()]:
        errs.append((int(i) + 2, "status", f"unrecognised status '{d.at[i, 'status']}' (map it in the import screen)"))
    d["status"] = canon
    d["subject_code"] = d["subject_code"].astype("string").str.strip().str.upper()
    # conflicting duplicates are errors; identical duplicates are collapsed
    key = ["roll_no", "date", "period"]
    clean_rows = d.dropna(subset=["date", "period", "status"])
    conflict = clean_rows.groupby(key)["status"].transform("nunique") > 1
    for i in clean_rows.index[conflict]:
        errs.append((int(i) + 2, "status", "same student/date/period appears with different statuses in this file"))
    ok, errors, _ = _finish(d, errs, ["date", "roll_no", "period", "subject_code", "status"])
    ok["period"] = ok["period"].astype(int)
    ok = ok.drop_duplicates(key).reset_index(drop=True)
    return Validated(ok, errors, {"unknown_status_tokens": unknown})


def validate_roster(df, known_sections=None):
    m = _missing(df, ["roll_no", "name", "section_code"])
    if m:
        raise ValueError(f"missing required columns: {m}")
    errs: list = []
    d = df.copy()
    d["roll_no"] = _rolls(d["roll_no"], None, errs)
    d["section_code"] = d["section_code"].astype("string").str.strip().str.upper()
    for i in d.index[d["name"].isna() | (d["name"].astype("string").str.strip() == "")]:
        errs.append((int(i) + 2, "name", "name is empty"))
    for i in d.index[d["section_code"].isna() | (d["section_code"] == "")]:
        errs.append((int(i) + 2, "section_code", "section_code is empty"))
    if known_sections is not None:
        for i in d.index[~d["section_code"].isin(known_sections)]:
            errs.append((int(i) + 2, "section_code", f"section '{d.at[i, 'section_code']}' does not exist; create it first, it is never auto-created"))
    dup = d.duplicated("roll_no", keep=False) & d.groupby("roll_no")["section_code"].transform("nunique").gt(1)
    for i in d.index[dup]:
        errs.append((int(i) + 2, "roll_no", "roll number appears in more than one section"))
    for c in ("branch", "year", "batch_code"):
        if c not in d:
            d[c] = pd.NA
    ok, errors, _ = _finish(d, errs, ["roll_no", "name", "section_code", "branch", "year", "batch_code"])
    return Validated(ok.drop_duplicates("roll_no").reset_index(drop=True), errors, {})


EVENT_TYPES = {"CANCELLED", "TEACHER_ABSENT", "SUBSTITUTE", "TEST", "ASSIGNMENT_DUE", "COLLEGE_EVENT"}


def validate_session_events(df, date_format="YYYY-MM-DD"):
    m = _missing(df, ["date", "event_type"])
    if m:
        raise ValueError(f"missing required columns: {m}")
    errs: list = []
    d = df.copy()
    d["date"] = _dates(d["date"], date_format, "date", errs)
    d["event_type"] = d["event_type"].astype("string").str.strip().str.upper()
    for i in d.index[~d["event_type"].isin(EVENT_TYPES)]:
        errs.append((int(i) + 2, "event_type", f"must be one of {sorted(EVENT_TYPES)}"))
    for c in ("period", "section_code", "note"):
        if c not in d:
            d[c] = pd.NA
    per = pd.to_numeric(d["period"], errors="coerce")
    for i in d.index[d["period"].notna() & per.isna()]:
        errs.append((int(i) + 2, "period", "period must be a number or blank (blank = all periods)"))
    d["period"] = per
    return _finish(d, errs, ["date", "period", "section_code", "event_type", "note"])


def validate_leaves(df, date_format="YYYY-MM-DD", known_rolls=None):
    m = _missing(df, ["roll_no", "from_date", "to_date", "leave_type"])
    if m:
        raise ValueError(f"missing required columns: {m}")
    errs: list = []
    d = df.copy()
    d["roll_no"] = _rolls(d["roll_no"], known_rolls, errs)
    d["from_date"] = _dates(d["from_date"], date_format, "from_date", errs)
    d["to_date"] = _dates(d["to_date"], date_format, "to_date", errs)
    d["leave_type"] = d["leave_type"].astype("string").str.strip().str.upper()
    for i in d.index[~d["leave_type"].isin(["MEDICAL", "ON_DUTY", "APPROVED_PERSONAL"])]:
        errs.append((int(i) + 2, "leave_type", "must be MEDICAL, ON_DUTY or APPROVED_PERSONAL"))
    for i in d.index[(d["from_date"] > d["to_date"]).fillna(False)]:
        errs.append((int(i) + 2, "to_date", "to_date is before from_date"))
    return _finish(d, errs, ["roll_no", "from_date", "to_date", "leave_type"])


def _effective_dates(d, errs, date_format, a="effective_from", b="effective_to"):
    for c in (a, b):
        d[c] = _dates(d[c], date_format, c, errs, required=False) if c in d else pd.NaT
    for i in d.index[(d[a] > d[b]).fillna(False)]:
        errs.append((int(i) + 2, b, f"{b} is before {a}"))


def validate_seating(df, date_format="YYYY-MM-DD", known_rolls=None):
    m = _missing(df, ["roll_no", "bench_id"])
    if m:
        raise ValueError(f"missing required columns: {m}")
    errs: list = []
    d = df.copy()
    d["roll_no"] = _rolls(d["roll_no"], known_rolls, errs)
    for i in d.index[d["bench_id"].isna() | (d["bench_id"].astype("string").str.strip() == "")]:
        errs.append((int(i) + 2, "bench_id", "bench_id is empty"))
    _effective_dates(d, errs, date_format)
    keep = ["roll_no", "bench_id", "effective_from", "effective_to"]
    if "section_code" in d:
        keep.insert(1, "section_code")
    return _finish(d, errs, keep)


GROUP_TYPES = {"LAB_BATCH", "PROJECT_TEAM", "ELECTIVE", "TUTORIAL", "MENTOR_GROUP"}


def validate_groups(df, date_format="YYYY-MM-DD", known_rolls=None):
    m = _missing(df, ["roll_no", "group_type", "group_code"])
    if m:
        raise ValueError(f"missing required columns: {m}")
    errs: list = []
    d = df.copy()
    d["roll_no"] = _rolls(d["roll_no"], known_rolls, errs)
    d["group_type"] = d["group_type"].astype("string").str.strip().str.upper()
    for i in d.index[~d["group_type"].isin(GROUP_TYPES)]:
        errs.append((int(i) + 2, "group_type", f"must be one of {sorted(GROUP_TYPES)}"))
    for i in d.index[d["group_code"].isna() | (d["group_code"].astype("string").str.strip() == "")]:
        errs.append((int(i) + 2, "group_code", "group_code is empty"))
    _effective_dates(d, errs, date_format)
    return _finish(d, errs, ["roll_no", "group_type", "group_code", "effective_from", "effective_to"])


def validate_transport(df, known_rolls=None):
    m = _missing(df, ["roll_no", "mode"])
    if m:
        raise ValueError(f"missing required columns: {m}")
    errs: list = []
    d = df.copy()
    d["roll_no"] = _rolls(d["roll_no"], known_rolls, errs)
    d["mode"] = d["mode"].astype("string").str.strip().str.upper()
    if "route_or_block" not in d:
        d["route_or_block"] = pd.NA
    for i in d.index[~d["mode"].isin(["BUS", "HOSTEL", "OWN"])]:
        errs.append((int(i) + 2, "mode", "must be BUS, HOSTEL or OWN"))
    for i in d.index[d["mode"].isin(["BUS", "HOSTEL"]) & d["route_or_block"].isna()]:
        errs.append((int(i) + 2, "route_or_block", "required for BUS and HOSTEL"))
    return _finish(d, errs, ["roll_no", "mode", "route_or_block"])


def validate_clubs(df, date_format="YYYY-MM-DD", known_rolls=None):
    m = _missing(df, ["roll_no", "club_name"])
    if m:
        raise ValueError(f"missing required columns: {m}")
    errs: list = []
    d = df.copy()
    d["roll_no"] = _rolls(d["roll_no"], known_rolls, errs)
    for i in d.index[d["club_name"].isna() | (d["club_name"].astype("string").str.strip() == "")]:
        errs.append((int(i) + 2, "club_name", "club_name is empty"))
    _effective_dates(d, errs, date_format, "from_date", "to_date")
    for c in ("role",):
        if c not in d:
            d[c] = pd.NA
    return _finish(d, errs, ["roll_no", "club_name", "role", "from_date", "to_date"])


def validate_peer_survey(df, date_format="YYYY-MM-DD", known_rolls=None, max_nominations=5):
    m = _missing(df, ["respondent_roll_no", "nominee_roll_no", "relation", "survey_date", "consent"])
    if m:
        raise ValueError(f"missing required columns: {m}")
    errs: list = []
    d = df.copy()
    d["respondent_roll_no"] = _rolls(d["respondent_roll_no"], known_rolls, errs, "respondent_roll_no")
    d["nominee_roll_no"] = _rolls(d["nominee_roll_no"], known_rolls, errs, "nominee_roll_no")
    d["relation"] = d["relation"].astype("string").str.strip().str.upper()
    d["survey_date"] = _dates(d["survey_date"], date_format, "survey_date", errs)
    cons = d["consent"].astype("string").str.strip().str.upper()
    for i in d.index[~cons.isin(["Y", "YES", "TRUE", "1"])]:
        errs.append((int(i) + 2, "consent", "no consent recorded; row rejected and never stored"))
    for i in d.index[~d["relation"].isin(["FRIEND", "STUDY_PARTNER"])]:
        errs.append((int(i) + 2, "relation", "must be FRIEND or STUDY_PARTNER"))
    for i in d.index[d["respondent_roll_no"] == d["nominee_roll_no"]]:
        errs.append((int(i) + 2, "nominee_roll_no", "a student cannot nominate themselves"))
    rank = d.groupby(["respondent_roll_no", "relation"]).cumcount()
    for i in d.index[rank >= max_nominations]:
        errs.append((int(i) + 2, "nominee_roll_no", f"more than {max_nominations} nominations for this relation"))
    return _finish(d, errs, ["respondent_roll_no", "nominee_roll_no", "relation", "survey_date", "consent"])


def register_sanity(att: pd.DataFrame, section_strength: int) -> dict:
    """Catch registers that only list absentees or only some students (both break bunk detection)."""
    per = att.groupby(["date", "period", "subject_code"]).agg(rows=("status", "size"),
                                                              absent_share=("status", lambda s: (s == "ABSENT").mean()))
    low_cov = float((per["rows"] / max(section_strength, 1) < 0.8).mean())
    mostly_abs = float((per["absent_share"] >= 0.9).mean())
    warnings = []
    if mostly_abs > 0.3:
        warnings.append("Most sessions are >=90% ABSENT: this looks like an absentees-only list. Upload the full register.")
    if low_cov > 0.3:
        warnings.append("Over 30% of sessions cover fewer than 80% of the section: some students may be missing from the register.")
    return dict(sessions=int(len(per)), low_coverage_share=low_cov, mostly_absent_share=mostly_abs, warnings=warnings)
```

#### `makarov_engine/payload.py`

```python
"""Build the JSON the frontend draws. The frontend never computes ties; it only renders this."""
from __future__ import annotations

import pandas as pd

from . import ENGINE_VERSION
from .engine import EngineResult
from .ties import TIE_TYPES, corroborate, overlay_edges

MAX_EDGE_TYPES_ON_SCREEN = 3   # BUNKS_WITH + at most two overlays


def build_graph_payload(res: EngineResult, names: dict | None = None, memberships=None, nominations=None,
                        overlays=(), dismissed: set | None = None, include_dismissed: bool = False) -> dict:
    names = names or {}
    overlays = list(overlays)
    unknown = [o for o in overlays if o not in TIE_TYPES]
    if unknown:
        raise ValueError(f"unknown overlay tie types: {unknown}")
    if 1 + len(overlays) > MAX_EDGE_TYPES_ON_SCREEN:
        raise ValueError(f"at most {MAX_EDGE_TYPES_ON_SCREEN - 1} overlays can be shown with BUNKS_WITH")

    base = dict(status=res.status, message=res.message, engine_version=ENGINE_VERSION, params_hash=res.params_hash,
                quality=_py(res.quality), nodes=[], edges=[], groups=[], pairs_only=[], students_without_ties=[],
                mass_skip_events=[])
    if res.status != "OK":
        return base

    dismissed = dismissed or set()
    e = corroborate(res.edges, memberships, nominations) if len(res.edges) else res.edges.assign(shared_ties=[], has_social_tie=[], has_context_tie=[])
    e = e.assign(dismissed=[frozenset((a, b)) in dismissed for a, b in zip(e.student_a, e.student_b)]) if len(e) else e.assign(dismissed=[])
    shown = e if include_dismissed else e[~e["dismissed"]]

    edges = []
    for r in shown.itertuples():
        edges.append(dict(
            id=f"{r.student_a}|{r.student_b}", type="BUNKS_WITH", student_a=r.student_a, student_b=r.student_b,
            weight=float(r.weight), co_cells=int(r.c_cells), co_dates=int(r.co_dates), expected=float(r.expected),
            lift=float(r.lift), q_value=float(r.q_value), source_type=r.source_type, derived_from=r.derived_from,
            shared_ties=[dict(tie_type=t["tie_type"], kind=t["kind"], source_type=t["source_type"], detail=t["detail"]) for t in r.shared_ties],
            has_social_tie=bool(r.has_social_tie), has_context_tie=bool(r.has_context_tie), dismissed=bool(r.dismissed)))

    in_graph = sorted({x for ed in edges for x in (ed["student_a"], ed["student_b"])})
    if overlays and in_graph:
        ov = overlay_edges(in_graph, memberships, nominations, set(overlays))
        for r in ov.itertuples():
            edges.append(dict(id=f"{r.student_a}|{r.student_b}|{r.type}", type=r.type, student_a=r.student_a, student_b=r.student_b,
                              kind=r.kind, source_type=r.source_type, detail=r.detail, derived_from=f"source:{r.source_type}"))

    nd = res.nodes.set_index("roll_no")
    nodes = [dict(roll_no=s, name=names.get(s, s), bunk_rate=float(nd.at[s, "bunk_rate"]), bunk_cells=int(nd.at[s, "bunk_cells"]),
                  eligible_cells=int(nd.at[s, "eligible_cells"]), n_ties=int(nd.at[s, "n_ties"]),
                  group_id=None if pd.isna(nd.at[s, "group_id"]) else int(nd.at[s, "group_id"])) for s in in_graph]
    without = [dict(roll_no=s, name=names.get(s, s), bunk_cells=int(nd.at[s, "bunk_cells"]))
               for s in nd.index if s not in set(in_graph) and nd.at[s, "bunk_cells"] > 0]
    mass = [dict(date=str(r.date.date()), block=int(r.block), skipped=int(r.n_bunk), present=int(r.n_elig)) for r in res.cells.mass_cells.itertuples()]
    base.update(nodes=nodes, edges=edges, groups=_py(res.groups), pairs_only=_py(res.pairs_only),
                students_without_ties=without, mass_skip_events=mass)
    return base


def _py(o):
    if isinstance(o, dict):
        return {k: _py(v) for k, v in o.items()}
    if isinstance(o, (list, tuple)):
        return [_py(v) for v in o]
    if hasattr(o, "item"):
        return o.item()
    return o
```

#### `makarov_engine/diagnostics.py`

```python
"""Run this on YOUR real data before trusting the graph.

shuffle_control() scrambles every student's skip days among cells of the same weekday and time of day
(each student keeps their own rate and habits, but all links BETWEEN students are destroyed), then
runs the exact same pipeline. A trustworthy engine finds ~0 ties in the shuffled copies. If the real
register shows clearly more ties than the shuffles, the ties are real signal; if it doesn't, the
class simply has no detectable bunk groups yet (which is a valid answer)."""
from __future__ import annotations

import numpy as np

from .cells import build_cells
from .config import EngineConfig
from .engine import _validated
from .pairtest import test_pairs


def shuffle_control(att, cfg: EngineConfig | None = None, n_runs: int = 20, seed: int = 0, cancelled=None, leaves=None) -> dict:
    cfg = cfg or EngineConfig()
    cd = build_cells(att, cfg, cancelled, leaves)
    if cd.status != "OK":
        return dict(status=cd.status, message=cd.message)
    strata = cd.cells["stratum"].to_numpy()
    didx = cd.cells["date_idx"].to_numpy()
    real = _validated(test_pairs(cd.Y, cd.E, strata, didx, cd.students, cfg), cfg, "diag")
    rng = np.random.default_rng(seed)
    counts = []
    groups = [np.where(strata == s)[0] for s in np.unique(strata)]
    for _ in range(n_runs):
        Yp = np.zeros_like(cd.Y)
        for i in range(cd.Y.shape[0]):
            for cols in groups:
                el = cols[cd.E[i, cols]]
                if el.size:
                    Yp[i, el] = rng.permutation(cd.Y[i, el])
        counts.append(len(_validated(test_pairs(Yp, cd.E, strata, didx, cd.students, cfg), cfg, "diag")))
    return dict(status="OK", real_edges=int(len(real)), shuffled_edges_per_run=counts,
                shuffled_mean=float(np.mean(counts)), shuffled_max=int(np.max(counts)),
                verdict=("Real ties exceed the shuffled baseline." if len(real) > max(counts) else
                         "No more ties than chance: treat the graph as empty for this data."))
```

#### `makarov_engine/synthetic.py`

```python
"""Synthetic register generator for TESTS AND CLEARLY-LABELLED DEMOS ONLY.
It plants known bunk groups so the engine can be scored against ground truth, and it plants the
confounds that fool naive methods (Friday-afternoon habits, class-wide skip days, illness, late
arrival, approved leave, partial-day bunks). Never import this from a production code path."""
from __future__ import annotations

import itertools

import numpy as np
import pandas as pd

WEEKDAY_MULT = np.array([0.8, 0.8, 0.9, 1.0, 2.0])      # Mon..Fri: Friday is the favourite
BLOCK_MULT = np.array([0.5, 1.5])                          # afternoon skipped more than morning
SUBJECTS = ["CS301", "CS302", "CS303", "MA301", "PHY101", "CS305L", "EN201", "CS304"]


def make_register(seed=0, n_students=60, weeks=16, groups=(), joint_events=12, join_prob=0.9,
                  friday_habit_share=0.3, mass_events=3, base_rate=0.07, illness_rate=0.008,
                  late_rate=0.01, leave_rate=0.004):
    rng = np.random.default_rng(seed)
    rolls = [f"21CSB{i:03d}" for i in range(1, n_students + 1)]
    start = pd.Timestamp("2026-07-27")  # a Monday
    dates = [start + pd.Timedelta(days=7 * w + d) for w in range(weeks) for d in range(5)]
    D = len(dates)
    base = rng.beta(1.2, 1.2 / base_rate - 1.2, size=n_students)
    habit = rng.random(n_students) < friday_habit_share

    # skip[s, d, b]: student intends to skip block b on day d
    skip = np.zeros((n_students, D, 2), bool)
    for s in range(n_students):
        for d, date in enumerate(dates):
            w = date.weekday()
            for b in range(2):
                pr = base[s] * WEEKDAY_MULT[w] * BLOCK_MULT[b]
                if habit[s] and w == 4 and b == 1:
                    pr = min(0.5, pr + 0.25)
                skip[s, d, b] = rng.random() < min(pr, 0.9)

    planted_pairs, events = set(), []
    idx = {r: i for i, r in enumerate(rolls)}
    for g in groups:
        members = [idx[m] if isinstance(m, str) else m for m in g]
        planted_pairs |= {frozenset((rolls[a], rolls[b])) for a, b in itertools.combinations(members, 2)}
        for d in rng.choice(D, size=min(joint_events, D), replace=False):
            b = 1 if rng.random() < 0.8 else 0
            for m in members:
                if rng.random() < join_prob:
                    skip[m, d, b] = True
            events.append((int(d), b, tuple(rolls[m] for m in members)))

    mass_cells = set()
    for _ in range(mass_events):
        d, b = int(rng.integers(D)), 1
        mass_cells.add((d, b))
        skip[rng.random(n_students) < 0.55, d, b] = True

    rows = []
    status = {}
    for s in range(n_students):
        ill = np.zeros(D, bool)
        leave = np.zeros(D, bool)
        late = np.zeros(D, bool)
        d = 0
        while d < D:
            if rng.random() < illness_rate:
                ill[d:d + int(rng.integers(1, 4))] = True
            if rng.random() < leave_rate:
                leave[d:d + int(rng.integers(1, 3))] = True
            if rng.random() < late_rate:
                late[d] = True
            d += 1
        for d, date in enumerate(dates):
            for p in range(1, 9):
                b = 0 if p <= 4 else 1
                st = "PRESENT"
                if ill[d]:
                    st = "ABSENT"
                elif leave[d]:
                    st = "MEDICAL_LEAVE"
                elif late[d] and p <= 2:
                    st = "ABSENT"
                elif skip[s, d, b]:
                    # sometimes only part of the block is skipped
                    st = "ABSENT" if (b == 1 or rng.random() < 0.7 or p <= 2) else "PRESENT"
                rows.append((rolls[s], date, p, SUBJECTS[(p - 1 + date.weekday()) % 8], st))
    att = pd.DataFrame(rows, columns=["roll_no", "date", "period", "subject_code", "status"])
    truth = dict(planted_pairs=planted_pairs, events=events, habit_students={rolls[i] for i in np.where(habit)[0]},
                 mass_cells=mass_cells, rolls=rolls, dates=dates)
    return att, truth


def naive_edges(att: pd.DataFrame, min_days=3) -> set:
    """The rule the old system used: any two students absent together on >= min_days dates."""
    ab = att[att.status == "ABSENT"].groupby("roll_no")["date"].apply(lambda s: set(s))
    out = set()
    for a, b in itertools.combinations(ab.index, 2):
        if len(ab[a] & ab[b]) >= min_days:
            out.add(frozenset((a, b)))
    return out
```

#### `makarov_engine/tests/__init__.py`

```python

```

#### `makarov_engine/tests/conftest.py`

```python
import pandas as pd
import pytest

from makarov_engine.config import EngineConfig


@pytest.fixture
def loose_cfg():
    """Config for hand-built micro registers (tiny data would otherwise trip the sufficiency guards)."""
    return EngineConfig(min_school_dates=1, min_multi_period_share=0.0, mass_cell_min_students=8)


def day(roll, date, pattern, subjects=None):
    """pattern: 8-char string over P/A/L/M/O for periods 1..8 -> rows"""
    m = {"P": "PRESENT", "A": "ABSENT", "L": "LATE", "M": "MEDICAL_LEAVE", "O": "ON_DUTY"}
    return [(roll, pd.Timestamp(date), i + 1, (subjects or ["S"] * 8)[i], m[ch]) for i, ch in enumerate(pattern)]


def register(rows):
    return pd.DataFrame(rows, columns=["roll_no", "date", "period", "subject_code", "status"])
```

#### `makarov_engine/tests/test_statuses_validators.py`

```python
import pandas as pd
import pytest

from makarov_engine.statuses import normalize_statuses
from makarov_engine.validators import (validate_attendance, validate_peer_survey, validate_roster,
                                       validate_transport, suggest_column_map, register_sanity)


def test_common_register_marks_are_absent_not_present():
    canon, unknown = normalize_statuses(pd.Series(["A", "AB", "ABS", "absent", "P", "Present", "ML", "OD"]))
    assert list(canon) == ["ABSENT", "ABSENT", "ABSENT", "ABSENT", "PRESENT", "PRESENT", "MEDICAL_LEAVE", "ON_DUTY"]
    assert unknown.empty


def test_unknown_and_ambiguous_tokens_are_rejected_never_guessed():
    canon, unknown = normalize_statuses(pd.Series(["L", "X", "", "P"]))
    assert canon.tolist() == [None, None, None, "PRESENT"]
    assert set(unknown["token"]) == {"L", "X", "<EMPTY>"}


def test_user_map_resolves_ambiguous_token_and_validates_targets():
    canon, _ = normalize_statuses(pd.Series(["L"]), {"L": "LATE"})
    assert canon.tolist() == ["LATE"]
    with pytest.raises(ValueError):
        normalize_statuses(pd.Series(["L"]), {"L": "PRESENT_ISH"})


def _att(rows):
    return pd.DataFrame(rows, columns=["date", "roll_no", "period", "subject_code", "status"])


def test_attendance_rejects_with_line_numbers_and_keeps_good_rows():
    df = _att([("2026-10-01", "21CSB001", 1, "CS301", "A"),
               ("2026-10-01", "21CSB999", 1, "CS301", "P"),      # unknown roll
               ("2026-10-01", "21CSB001", 2, "CS301", "L"),      # ambiguous status
               ("01-10-2026", "21CSB001", 3, "CS301", "P"),      # wrong date format
               ("2026-10-01", "21CSB001", 9, "CS301", "P")])
    ok, err, extras = validate_attendance(df, known_rolls={"21CSB001"}, max_period=8)
    assert len(ok) == 1 and ok.iloc[0]["status"] == "ABSENT"
    assert sorted(err["line"]) == [3, 4, 5, 6]          # file lines: header is line 1
    assert set(err["column"]) == {"roll_no", "status", "date", "period"}


def test_attendance_accepts_dd_mm_yyyy_when_selected():
    ok, err, _ = validate_attendance(_att([("09-10-2026", "R1", 1, "S", "P")]), date_format="DD-MM-YYYY")
    assert err.empty and ok.iloc[0]["date"] == pd.Timestamp("2026-10-09")


def test_conflicting_duplicates_rejected_identical_collapsed():
    df = _att([("2026-10-01", "R1", 1, "S", "P"), ("2026-10-01", "R1", 1, "S", "P"),
               ("2026-10-01", "R2", 1, "S", "P"), ("2026-10-01", "R2", 1, "S", "A")])
    ok, err, _ = validate_attendance(df)
    assert len(ok) == 1 and ok.iloc[0]["roll_no"] == "R1" and len(err) == 2


def test_roster_never_autocreates_sections_and_has_no_gender_default():
    df = pd.DataFrame({"roll_no": ["R1", "R2"], "name": ["A", "B"], "section_code": ["CS-3B", "NOPE"]})
    ok, err, _ = validate_roster(df, known_sections={"CS-3B"})
    assert list(ok["roll_no"]) == ["R1"] and len(err) == 1
    assert "gender" not in ok.columns and "dob" not in ok.columns


def test_peer_survey_without_consent_is_rejected_not_stored():
    df = pd.DataFrame({"respondent_roll_no": ["R1", "R2"], "nominee_roll_no": ["R2", "R1"], "relation": ["FRIEND", "FRIEND"],
                       "survey_date": ["2026-09-01"] * 2, "consent": ["Y", "N"]})
    ok, err, _ = validate_peer_survey(df)
    assert list(ok["respondent_roll_no"]) == ["R1"] and "consent" in set(err["column"])


def test_peer_survey_caps_nominations():
    df = pd.DataFrame({"respondent_roll_no": ["R1"] * 7, "nominee_roll_no": [f"R{i}" for i in range(2, 9)],
                       "relation": ["FRIEND"] * 7, "survey_date": ["2026-09-01"] * 7, "consent": ["Y"] * 7})
    ok, err, _ = validate_peer_survey(df, max_nominations=5)
    assert len(ok) == 5 and len(err) == 2


def test_transport_requires_route_for_bus():
    ok, err, _ = validate_transport(pd.DataFrame({"roll_no": ["R1", "R2"], "mode": ["BUS", "OWN"], "route_or_block": [None, None]}))
    assert list(ok["roll_no"]) == ["R2"] and len(err) == 1


def test_column_suggestions_are_suggestions():
    assert suggest_column_map(["Reg No", "Attendance Date", "Hour", "Mark"], ["roll_no", "date", "period", "status"]) == \
        {"roll_no": "Reg No", "date": "Attendance Date", "period": "Hour", "status": "Mark"}


def test_absentee_only_register_is_flagged():
    rows = [("2026-10-01", f"R{i}", 1, "S", "ABSENT") for i in range(3)] + \
           [("2026-10-02", f"R{i}", 1, "S", "ABSENT") for i in range(3)]
    w = register_sanity(_att(rows).assign(date=lambda d: pd.to_datetime(d["date"])), section_strength=60)
    assert w["warnings"]
```

#### `makarov_engine/tests/test_cells.py`

```python
import numpy as np
import pandas as pd
import pytest

from makarov_engine.cells import build_cells
from makarov_engine.config import EngineConfig
from .conftest import day, register


def cell(cd, roll, date, block):
    k = cd.cells[(cd.cells.date == pd.Timestamp(date)) & (cd.cells.block == block)]
    if k.empty:
        return None
    i, j = cd.students.index(roll), int(k.cell_idx.iloc[0])
    return bool(cd.E[i, j]), bool(cd.Y[i, j])


def test_afternoon_bunk_is_a_bunk_and_morning_is_a_normal_attended_cell(loose_cfg):
    cd = build_cells(register(day("R1", "2026-10-05", "PPPPAAAA")), loose_cfg)
    assert cell(cd, "R1", "2026-10-05", 0) == (True, False)
    assert cell(cd, "R1", "2026-10-05", 1) == (True, True)


def test_full_day_absence_is_not_a_bunk_and_is_not_eligible(loose_cfg):
    rows = day("R1", "2026-10-05", "AAAAAAAA") + day("R2", "2026-10-05", "PPPPPPPP")
    cd = build_cells(register(rows), loose_cfg)
    assert cell(cd, "R1", "2026-10-05", 0) in (None, (False, False)) and cell(cd, "R1", "2026-10-05", 1) in (None, (False, False))
    assert cd.Y[cd.students.index("R1")].sum() == 0 and cd.E[cd.students.index("R1")].sum() == 0


def test_leading_absence_up_to_two_periods_is_late_arrival_not_bunk(loose_cfg):
    cd = build_cells(register(day("R1", "2026-10-05", "AAPPPPPP")), loose_cfg)
    # the two leading absences are set aside; periods 3-4 were attended, so the morning is a normal attended cell
    assert cell(cd, "R1", "2026-10-05", 0) == (True, False)
    assert cd.Y.sum() == 0 and cd.quality["late_arrival_rows"] == 2
    cd2 = build_cells(register(day("R1", "2026-10-05", "AAPPPPPP")), EngineConfig(min_school_dates=1, min_multi_period_share=0, treat_late_arrival_as_bunk=True))
    assert cell(cd2, "R1", "2026-10-05", 0) == (True, True)


def test_three_leading_absences_exceed_late_arrival_limit(loose_cfg):
    cd = build_cells(register(day("R1", "2026-10-05", "AAAPPPPP")), loose_cfg)
    assert cell(cd, "R1", "2026-10-05", 0) == (True, True)


def test_medical_leave_status_and_leave_table_make_absence_excused(loose_cfg):
    cd = build_cells(register(day("R1", "2026-10-05", "PPPPMMMM")), loose_cfg)
    assert cell(cd, "R1", "2026-10-05", 1) in (None, (False, False)) and cd.Y.sum() == 0
    leaves = pd.DataFrame({"roll_no": ["R1"], "from_date": ["2026-10-05"], "to_date": ["2026-10-06"], "leave_type": ["ON_DUTY"]})
    cd = build_cells(register(day("R1", "2026-10-05", "PPPPAAAA")), loose_cfg, leaves=leaves)
    assert cd.Y.sum() == 0 and cd.quality["rows_excused_by_leave"] == 4


def test_cancelled_sessions_are_removed(loose_cfg):
    cancelled = pd.DataFrame({"date": ["2026-10-05"], "period": [8]})
    cd = build_cells(register(day("R1", "2026-10-05", "PPPPPPPA")), loose_cfg, cancelled=cancelled)
    assert cd.Y.sum() == 0 and cd.quality["rows_cancelled"] == 1


def test_class_wide_skip_is_excluded_and_reported(loose_cfg):
    rows = []
    for i in range(10):
        rows += day(f"R{i}", "2026-10-05", "PPPPAAAA" if i < 5 else "PPPPPPPP")   # 50% skip the afternoon
    cd = build_cells(register(rows), loose_cfg)
    assert len(cd.mass_cells) == 1 and cd.Y.sum() == 0
    assert cd.quality["mass_cells"] == 1


def test_small_group_skipping_is_not_mass(loose_cfg):
    rows = []
    for i in range(20):
        rows += day(f"R{i}", "2026-10-05", "PPPPAAAA" if i < 3 else "PPPPPPPP")
    cd = build_cells(register(rows), loose_cfg)
    assert len(cd.mass_cells) == 0 and cd.Y.sum() == 3


def test_noncanonical_status_is_refused(loose_cfg):
    df = register(day("R1", "2026-10-05", "PPPPPPPP")).assign(status="A")
    with pytest.raises(ValueError):
        build_cells(df, loose_cfg)


def test_too_little_data_is_reported_honestly():
    cd = build_cells(register(day("R1", "2026-10-05", "PPPPAAAA")), EngineConfig(min_multi_period_share=0))
    assert cd.status == "INSUFFICIENT_DATA"


def test_single_period_registers_are_refused_with_explanation():
    rows = [("R1", pd.Timestamp("2026-10-05") + pd.Timedelta(days=d), 1, "S", "PRESENT") for d in range(30)]
    cd = build_cells(register(rows), EngineConfig())
    assert cd.status == "PERIOD_DATA_REQUIRED" and "full-day absence" in cd.message


def test_subject_filter_keeps_day_level_facts_so_afternoon_bunks_survive(loose_cfg):
    """Regression for a design flaw: filtering raw rows to one subject first would turn this into a full-day absence."""
    subs = ["MA", "MA", "MA", "MA", "CS", "PHY", "CS", "CS"]
    rows = day("R1", "2026-10-05", "PPPPAAAA", subs)
    cd = build_cells(register(rows), loose_cfg, subject="PHY")
    assert cell(cd, "R1", "2026-10-05", 1) == (True, True)
    assert cell(cd, "R1", "2026-10-05", 0) is None            # no Physics session in the morning block
    assert cd.detail["period"].tolist() == [6]


def test_weekday_and_date_filters_restrict_cells(loose_cfg):
    rows = day("R1", "2026-10-05", "PPPPAAAA") + day("R1", "2026-10-09", "PPPPAAAA")   # a Monday and a Friday
    cd = build_cells(register(rows), loose_cfg, weekdays=[4])
    assert set(cd.cells.weekday) == {4}
    cd = build_cells(register(rows), loose_cfg, date_to="2026-10-06")
    assert set(cd.cells.date) == {pd.Timestamp("2026-10-05")}
```

#### `makarov_engine/tests/test_pairtest.py`

```python
import itertools

import numpy as np
import pytest
from scipy.stats import hypergeom

from makarov_engine.engine import _validated
from makarov_engine.config import EngineConfig
from makarov_engine.pairtest import bh_qvalues, stratified_overlap_pvalue


def brute_force_tail(strata, c):
    """Enumerate every placement of B's skips inside each stratum (A's fixed): the exact permutation null."""
    dists = []
    for n, a, b in strata:
        counts = {}
        for combo in itertools.combinations(range(n), b):
            overlap = sum(1 for x in combo if x < a)       # A occupies positions 0..a-1
            counts[overlap] = counts.get(overlap, 0) + 1
        tot = sum(counts.values())
        dists.append({k: v / tot for k, v in counts.items()})
    total = {0: 1.0}
    for d in dists:
        nxt = {}
        for k1, p1 in total.items():
            for k2, p2 in d.items():
                nxt[k1 + k2] = nxt.get(k1 + k2, 0) + p1 * p2
        total = nxt
    return sum(p for k, p in total.items() if k >= c)


@pytest.mark.parametrize("strata,c", [([(6, 3, 3), (5, 2, 2)], 3), ([(8, 3, 4), (7, 2, 3), (6, 3, 2)], 4),
                                      ([(10, 4, 4)], 3), ([(5, 5, 2), (6, 1, 1)], 3)])
def test_convolution_matches_brute_force_permutation_distribution(strata, c):
    n, a, b = zip(*strata)
    p, _ = stratified_overlap_pvalue(n, a, b, c)
    assert p == pytest.approx(brute_force_tail(strata, c), rel=1e-9, abs=1e-12)


def test_single_stratum_equals_scipy_hypergeometric_tail():
    p, exp = stratified_overlap_pvalue([40], [10], [12], 6)
    assert p == pytest.approx(hypergeom.sf(5, 40, 10, 12))
    assert exp == pytest.approx(10 * 12 / 40)


def test_impossible_overlap_gives_zero_and_degenerate_strata_are_ignored():
    p, _ = stratified_overlap_pvalue([10, 10], [0, 3], [4, 3], 99)
    assert p == 0.0
    p, _ = stratified_overlap_pvalue([10, 10], [0, 3], [4, 3], 0)
    assert p == pytest.approx(1.0)


def test_bh_known_values_and_monotonicity():
    q = bh_qvalues(np.array([0.01, 0.04, 0.03, 0.005]), m=4)
    assert q.tolist() == pytest.approx([0.02, 0.04, 0.04, 0.02])
    q = bh_qvalues(np.array([0.001, 0.2, 0.9]), m=100)      # untested pairs only enlarge m
    assert q[0] == pytest.approx(0.1) and (q <= 1).all()
    with pytest.raises(ValueError):
        bh_qvalues(np.array([0.1, 0.2]), m=1)


def test_evidence_floors_stop_a_single_outing_from_becoming_a_tie():
    import pandas as pd
    t = pd.DataFrame([dict(student_a="A", student_b="B", c_cells=4, co_dates=2, n_shared=80, a_bunks=4, b_bunks=4,
                           expected=0.2, lift=20.0, jaccard=1.0, p_value=1e-9, q_value=1e-7, tests_run=100)])
    assert _validated(t, EngineConfig(), "h").empty                       # 4 cells but only 2 dates
    t.loc[0, "co_dates"] = 4
    assert len(_validated(t, EngineConfig(), "h")) == 1
    t.loc[0, "q_value"] = 0.2
    assert _validated(t, EngineConfig(), "h").empty                       # not significant after correction
```

#### `makarov_engine/tests/test_engine.py`

```python
import time

import pandas as pd
import pytest

from makarov_engine.config import EngineConfig
from makarov_engine.engine import match_group_ids, pair_evidence, partner_pressure, run_engine
from makarov_engine.synthetic import make_register, naive_edges

GROUPS = [(0, 1, 2, 3), (10, 11, 12), (20, 21, 22, 23, 24)]


def edge_set(res):
    return {frozenset((r.student_a, r.student_b)) for r in res.edges.itertuples()}


def test_pure_noise_produces_no_ties_even_with_strong_friday_afternoon_habits():
    """Negative control. 12 noise registers, 60% of students share a Friday-afternoon habit."""
    for seed in range(12):
        att, _ = make_register(seed=900 + seed, groups=(), friday_habit_share=0.6)
        assert edge_set(run_engine(att)) == set(), f"false edge on seed {seed}"


def test_planted_groups_are_recovered_and_false_discovery_rate_is_controlled():
    """BH guarantees the AVERAGE share of false ties is <= alpha (5%), not that none ever appear.
    Measured over 20 seeds in development: 3 false of 273 ties (1.1%)."""
    tp = fp = planted = 0
    for seed in range(6):
        att, truth = make_register(seed=40 + seed, groups=GROUPS, joint_events=14)
        found = edge_set(run_engine(att))
        tp += len(found & truth["planted_pairs"])
        fp += len(found - truth["planted_pairs"])
        planted += len(truth["planted_pairs"])
    assert fp / max(tp + fp, 1) <= 0.05
    assert tp / planted >= 0.6          # measured ~0.65-0.7 at 14 joint events; see the power table in the docs


def test_old_naive_rule_would_have_linked_most_of_the_class():
    att, truth = make_register(seed=1, groups=GROUPS)
    naive = naive_edges(att)
    assert len(naive) > 500                           # of 1,770 possible pairs
    assert len(edge_set(run_engine(att))) < 20


def test_one_shared_afternoon_never_creates_a_tie():
    att, truth = make_register(seed=3, groups=[(5, 6)], joint_events=1)
    assert frozenset(("21CSB006", "21CSB007")) not in edge_set(run_engine(att))


def test_results_are_deterministic():
    att, _ = make_register(seed=7, groups=GROUPS)
    a, b = run_engine(att), run_engine(att)
    pd.testing.assert_frame_equal(a.edges, b.edges)
    assert a.groups == b.groups


def test_time_chunk_option_still_finds_ties_and_stays_clean_on_noise():
    cfg = EngineConfig(time_chunk_weeks=8)
    att, _ = make_register(seed=5, groups=(), friday_habit_share=0.6)
    assert edge_set(run_engine(att, cfg)) == set()
    att, truth = make_register(seed=41, groups=GROUPS, joint_events=16)
    found = edge_set(run_engine(att, cfg))
    assert found and not (found - truth["planted_pairs"])


def test_evidence_lists_exactly_the_dates_that_were_counted():
    att, truth = make_register(seed=40, groups=GROUPS, joint_events=14)
    res = run_engine(att)
    r = res.edges.iloc[0]
    ev = pair_evidence(res, r.student_a, r.student_b)
    assert len(ev["sessions"]) == r.c_cells
    assert len({s["date"] for s in ev["sessions"]}) == r.co_dates
    assert ev["validated"] and "not why" in ev["plain_language"]
    assert all(s["periods_a"] and s["periods_b"] for s in ev["sessions"])


def test_groups_come_from_validated_edges_only_and_have_stable_ids():
    att, truth = make_register(seed=40, groups=GROUPS, joint_events=14)
    res = run_engine(att)
    members = {m for g in res.groups for m in g["members"]}
    assert members <= {x for e in edge_set(res) for x in e}
    prev = {g["group_id"]: set(g["members"]) for g in res.groups}
    again = run_engine(att, prev_groups=prev)
    assert {g["group_id"]: set(g["members"]) for g in again.groups} == prev


def test_group_id_matching_rules():
    prev = {1: {"A", "B", "C"}, 2: {"X", "Y", "Z"}}
    ids = match_group_ids(prev, [{"X", "Y", "Z", "W"}, {"A", "B", "C"}, {"P", "Q", "R"}])
    assert ids[0] == 2 and ids[1] == 1 and ids[2] not in (1, 2)


def test_nodes_table_has_facts_only_no_roles_or_influence_scores():
    att, _ = make_register(seed=40, groups=GROUPS, joint_events=14)
    res = run_engine(att)
    assert set(res.nodes.columns) == {"roll_no", "bunk_cells", "eligible_cells", "bunk_rate", "n_ties", "group_id"}


def test_partner_pressure_counts_validated_partners_already_absent():
    att, _ = make_register(seed=40, groups=GROUPS, joint_events=14)
    res = run_engine(att)
    r = res.edges.iloc[0]
    assert partner_pressure(res.edges, {r.student_b})[r.student_a] >= 1


def test_runtime_for_a_large_section_is_well_under_five_seconds():
    att, _ = make_register(seed=11, n_students=120, groups=[tuple(range(0, 6)), tuple(range(30, 35))], joint_events=14)
    t = time.time()
    res = run_engine(att)
    assert time.time() - t < 5.0 and res.status == "OK"


def test_insufficient_data_returns_honest_status_not_fake_edges():
    att, _ = make_register(seed=2, weeks=2, groups=GROUPS)
    res = run_engine(att)
    assert res.status == "INSUFFICIENT_DATA" and res.edges.empty


def test_evidence_subjects_never_contain_blank_codes():
    att, _ = make_register(seed=40, groups=GROUPS, joint_events=14)
    att["subject_code"] = ""
    res = run_engine(att)
    r = res.edges.iloc[0]
    assert all(s["subjects"] == [] for s in pair_evidence(res, r.student_a, r.student_b)["sessions"])


def test_pairs_tested_is_reported_even_when_no_candidate_pair_exists():
    att, _ = make_register(seed=2, groups=(), base_rate=0.03)
    res = run_engine(att)
    assert res.quality["pairs_tested"] == res.quality["active_students"] * (res.quality["active_students"] - 1) // 2


def test_engine_accepts_filters_and_reports_that_it_was_filtered():
    att, _ = make_register(seed=40, groups=GROUPS, joint_events=14)
    full = run_engine(att)
    fri = run_engine(att, weekdays=[4])
    assert fri.status in ("OK", "INSUFFICIENT_DATA") and fri.quality["filtered"] is True
    assert fri.cells.E.sum() < full.cells.E.sum()
```

#### `makarov_engine/tests/test_ties.py`

```python
import pandas as pd

from makarov_engine.ties import (corroborate, memberships_from_clubs, memberships_from_groups,
                                 memberships_from_seating, memberships_from_transport, nominations_from_survey,
                                 overlay_edges, shared_ties)


def survey():
    return pd.DataFrame({"respondent_roll_no": ["R1", "R2", "R3", "R4", "R1"], "nominee_roll_no": ["R2", "R1", "R1", "R4", "R3"],
                         "relation": ["FRIEND", "FRIEND", "FRIEND", "FRIEND", "STUDY_PARTNER"],
                         "survey_date": ["2026-09-01"] * 5, "consent": ["Y", "Y", "Y", "Y", "N"]})


def test_survey_mutual_flag_consent_and_self_nominations():
    n = nominations_from_survey(survey(), known_rolls={"R1", "R2", "R3", "R4"})
    pairs = {(r.respondent, r.nominee): r.mutual for r in n.itertuples()}
    assert pairs[("R1", "R2")] and pairs[("R2", "R1")]               # reciprocated -> mutual
    assert pairs[("R3", "R1")] is False                              # one-way stays one-way (no invented 0.4 weight)
    assert ("R4", "R4") not in pairs                                 # self-nomination dropped
    assert ("R1", "R3") not in pairs                                 # no consent -> not used


def test_memberships_and_shared_ties_with_date_overlap():
    seat = pd.DataFrame({"roll_no": ["R1", "R2", "R3"], "bench_id": ["B4", "B4", "B4"],
                         "effective_from": ["2026-08-01", "2026-08-01", "2026-10-01"],
                         "effective_to": ["2026-09-15", "2026-09-15", "2026-11-30"]})
    m = memberships_from_seating(seat)
    assert [t["tie_type"] for t in shared_ties("R1", "R2", m, None)] == ["SITS_WITH"]
    assert shared_ties("R1", "R3", m, None) == []                   # same bench number, different terms
    groups = pd.DataFrame({"roll_no": ["R1", "R2"], "group_type": ["LAB_BATCH", "LAB_BATCH"], "group_code": ["B1", "B1"]})
    t = shared_ties("R1", "R2", memberships_from_groups(groups), None)
    assert t[0]["kind"] == "CONTEXT"


def test_own_transport_creates_no_tie():
    tr = pd.DataFrame({"roll_no": ["R1", "R2", "R3", "R4"], "mode": ["BUS", "BUS", "OWN", "OWN"],
                       "route_or_block": ["R12", "R12", None, None]})
    m = memberships_from_transport(tr)
    assert len(shared_ties("R1", "R2", m, None)) == 1 and shared_ties("R3", "R4", m, None) == []


def test_corroboration_labels_social_vs_context_and_never_changes_weight():
    edges = pd.DataFrame({"student_a": ["R1", "R1"], "student_b": ["R2", "R3"], "weight": [0.5, 0.4]})
    clubs = pd.DataFrame({"roll_no": ["R1", "R2"], "club_name": ["ACM", "ACM"]})
    tr = pd.DataFrame({"roll_no": ["R1", "R3"], "mode": ["BUS", "BUS"], "route_or_block": ["R7", "R7"]})
    import pandas as pd2
    mem = pd2.concat([memberships_from_clubs(clubs), memberships_from_transport(tr)], ignore_index=True)
    out = corroborate(edges, mem, None)
    assert out["has_social_tie"].tolist() == [True, False] and out["has_context_tie"].tolist() == [False, True]
    assert out["weight"].tolist() == [0.5, 0.4]


def test_overlay_is_limited_to_visible_students():
    clubs = pd.DataFrame({"roll_no": [f"R{i}" for i in range(50)], "club_name": ["ACM"] * 50})
    o = overlay_edges(["R1", "R2", "R3"], memberships_from_clubs(clubs), None)
    assert len(o) == 3 and set(o["type"]) == {"SAME_CLUB"}
```

#### `makarov_engine/tests/test_payload.py`

```python
import json

import pandas as pd
import pytest

from makarov_engine.engine import run_engine
from makarov_engine.payload import build_graph_payload
from makarov_engine.synthetic import make_register
from makarov_engine.ties import memberships_from_clubs

GROUPS = [(0, 1, 2, 3), (10, 11, 12), (20, 21, 22, 23, 24)]


def test_payload_draws_only_students_with_validated_ties_and_every_edge_has_provenance():
    att, _ = make_register(seed=40, groups=GROUPS, joint_events=14)
    res = run_engine(att)
    p = build_graph_payload(res)
    json.dumps(p)                                               # must be JSON-serialisable
    ids = {n["roll_no"] for n in p["nodes"]}
    assert ids == {x for e in p["edges"] for x in (e["student_a"], e["student_b"])}
    assert all(e["source_type"] and e["derived_from"] for e in p["edges"])
    assert len(ids) < 60 and p["students_without_ties"] is not None


def test_overlays_are_limited_and_validated():
    att, _ = make_register(seed=40, groups=GROUPS, joint_events=14)
    res = run_engine(att)
    with pytest.raises(ValueError):
        build_graph_payload(res, overlays=["SAME_CLUB", "SITS_WITH", "NAMED_FRIEND"])      # 4 types on screen
    with pytest.raises(ValueError):
        build_graph_payload(res, overlays=["BESTIES"])


def test_overlay_edges_only_between_students_already_drawn_and_dismissals_hide_edges():
    att, _ = make_register(seed=40, groups=GROUPS, joint_events=14)
    res = run_engine(att)
    clubs = pd.DataFrame({"roll_no": res.nodes.roll_no, "club_name": "ACM"})
    mem = memberships_from_clubs(clubs)
    p = build_graph_payload(res, memberships=mem, overlays=["SAME_CLUB"])
    drawn = {n["roll_no"] for n in p["nodes"]}
    ov = [e for e in p["edges"] if e["type"] == "SAME_CLUB"]
    assert ov and all(e["student_a"] in drawn and e["student_b"] in drawn for e in ov)
    first = res.edges.iloc[0]
    p2 = build_graph_payload(res, dismissed={frozenset((first.student_a, first.student_b))})
    assert len([e for e in p2["edges"] if e["type"] == "BUNKS_WITH"]) == len(res.edges) - 1


def test_non_ok_status_returns_empty_graph_with_reason():
    att, _ = make_register(seed=2, weeks=2, groups=GROUPS)
    p = build_graph_payload(run_engine(att))
    assert p["status"] == "INSUFFICIENT_DATA" and p["nodes"] == [] and p["message"]
```

#### `makarov_engine/tests/test_diagnostics.py`

```python
from makarov_engine.diagnostics import shuffle_control
from makarov_engine.synthetic import make_register

GROUPS = [(0, 1, 2, 3), (10, 11, 12), (20, 21, 22, 23, 24)]


def test_shuffle_control_separates_real_ties_from_chance():
    att, _ = make_register(seed=40, groups=GROUPS, joint_events=14)
    d = shuffle_control(att, n_runs=8)
    assert d["real_edges"] >= 8 and d["shuffled_max"] <= 1 and "exceed" in d["verdict"]


def test_shuffle_control_says_nothing_found_when_there_is_nothing():
    att, _ = make_register(seed=77, groups=(), friday_habit_share=0.6)
    d = shuffle_control(att, n_runs=8)
    assert d["real_edges"] == 0 and "chance" in d["verdict"]
```

---

## 9. Measured results

Test bench: simulated section of 60 students, 16 weeks (80 school dates), 8 periods a day. It includes: per-student skip rates; a Friday and afternoon preference; 30-60% of students sharing a Friday-afternoon habit; illness runs; late arrivals; approved leave; 3 class-wide skip events; partial-block skipping. Three planted groups (4, 3 and 5 students = 19 true pairs); each member joins each joint skip with probability 0.9.

| Check | Result |
|---|---|
| Registers with **no** planted ties (60 runs) | 2 of 60 produced one false tie each (3%; the design target is <= 5%) |
| Old rule (>= 3 shared absent days) on the planted registers | links on average **1,145 of 1,770** pairs |
| This engine on the same registers (12 joint skips per group) | **13** ties on average (19 pairs were truly linked) |
| Share of reported ties that were false, all power runs pooled | 3 of 442 (0.7%); 3 of 273 (1.1%) in a separate 20-run check |
| Run time, 60 students | 0.24 s |
| Run time, 120 students | 0.44 s |

**Power: share of the 19 planted pairs detected, by number of joint skips per group in a term (10 registers each).**

| Joint skips | 4 | 6 | 8 | 12 | 16 | 24 |
|---|---|---|---|---|---|---|
| Pairs detected | 2% | 5% | 22% | 56% | 66% | 80% |
| False ties / ties reported | 0/3 | 0/10 | 0/41 | 1/108 | 2/128 | 0/152 |

Reading the table honestly: the engine is deliberately conservative. It rarely reports a false tie, and it needs a real pattern (roughly a dozen joint skips) before it reports a pair. Heavy individual skippers need more evidence than light ones, because chance overlap is higher for them. Lowering the lift floor from 2.0 to 1.5 changed recall by at most two points in a separate test, so the floor is not what limits power; the multiple-testing correction and the amount of data are.

---

## 10. Known limitations (do not hide these in the UI)

1. **Same block, not same period.** Two students count as skipping together if they skipped the same block (default: periods 1-4 or 5-8). Edit `blocks` for finer resolution; the evidence drawer shows the exact periods.
2. **Cells on one date are not fully independent.** Handled by requiring overlaps on at least 3 different dates, not by modelling it.
3. **Behaviour that shifts over the term** (both students start skipping after midterms) can still look like a tie. `time_chunk_weeks` holds the part of term fixed, at a cost in power; it is off by default.
4. **A tie shows co-occurrence only.** Not friendship, not leadership, not cause. The engine never reports direction.
5. **Needs full-day registers.** With one teacher's register, a bunk cannot be separated from a full-day absence; the engine refuses (`PERIOD_DATA_REQUIRED`) rather than guess.
6. **A missing register row means "not observed"**, so that student-period is excluded. If rows are missing because of an upload problem, ties are missed. `register_sanity` flags the common cases.
7. **Late-arrival rule is a heuristic.** Absent for periods 1-2 then present is treated as late arrival. A student who really skipped those two periods is not counted.
8. **Light skippers never get ties.** Students with fewer than 4 bunk cells are not tested.
9. **Class-wide skip cells are excluded from ties** (and listed). A group that skips together on a day when many others also skip is not detected for that day.
10. **Multiple-testing correction** (Benjamini-Hochberg) is valid for independent or positively dependent tests; that is plausible here and supported by the simulations, but it is not a proof.
11. **Validated on a simulator I wrote.** Real students may behave differently. Run `shuffle_control` on real data (section 7.5).
12. **Survey ties are self-reported** and only ever an overlay.
13. **No prediction model is included.** The engine exposes `partner_pressure` (validated partners already absent now) as a feature for the prediction phase.
14. **No daily-attendance mode.** Deliberately: it would blend illness and bunking and produce unreliable ties.

---

## 11. Self-audit log (what I found wrong in my own work, and what I did)

**Design flaws caught before coding the engine**
1. Counting each period separately would recreate the old problem (one shared afternoon = four coincidences). Fixed with block-level cells plus the 3-different-dates rule.
2. A Monte-Carlo permutation test cannot produce p-values small enough to survive correction across 1,000+ pairs. Replaced with an exact stratified test; checked against brute-force enumeration of every possible shuffle (`test_pairtest.py`).
3. Without holding weekday and time of day fixed, a class full of Friday-afternoon skippers looks fully connected. Fixed with strata; verified 0 false ties on classes with 60% such students.
4. Direction ("leader", "anchor") and PageRank roles cannot be derived from co-occurrence. Removed instead of dressed up.
5. Social ties as pre-built pairs would explode (a lab batch of 60 = 1,770 edges). Stored as memberships; pairs materialised only for students already on screen.

**Mistakes found by running and testing**
6. **Design flaw in my planned API:** applying the "subject" filter to raw rows first would make every afternoon bunk look like a full-day absence. Filters now run after the day-level logic, with a regression test.
7. Bug: evidence `subjects` used `a | b - {""}`, which only removed blanks from the second set. Fixed with parentheses and tested.
8. Bug: `pairs_tested` reported 0 when no pair had enough overlaps, hiding how many tests the correction used. Now derived from the number of active students.
9. Bug: the "full-day absent" counter also counted excused leave days. Now counts only days with an unexcused absence and no presence.
10. Bug: empty status tokens were reported as `''` instead of `<EMPTY>`.
11. Inconsistency: validators returned two different tuple shapes. All now return `Validated(clean, errors, extras)`.
12. Inconsistency: the evidence sentence said "half-day" although blocks are configurable. Now says "block of the day".
13. Unclear code: the seating key was built with an opaque conditional. Rewritten.

**Tests I wrote wrongly (the code was right)**
14. Late-arrival test expected the morning block to vanish; it correctly remains as an attended cell because periods 3-4 were attended. Test corrected, behaviour documented.
15. A test required zero false ties in planted runs. The method guarantees an average false share of at most 5%, not zero. The test now checks the rate, and I report what was measured.
16. A test miscounted file line numbers.

**Measured and deliberately left alone**
17. Lowering the lift floor did not raise recall (section 9), so it stays at 2.0.
18. Low power at few joint skips is reported, not hidden by loosening thresholds.

**Deliberately not built:** direction/leadership, a prediction model, a daily-attendance mode, frontend code.

---

## 12. Acceptance checklist

**Engine**
- [ ] `pytest makarov_engine/tests -q` passes (60 tests).
- [ ] `shuffle_control` on a real section shows real ties above the shuffled maximum, or the UI shows the honest empty state.
- [ ] No tie is created from a single outing: pairs with overlaps on fewer than 3 dates never appear.

**Ingestion**
- [ ] Uploading attendance with `A` and `AB` stores them as `ABSENT`; a token such as `L` is rejected until mapped.
- [ ] A file with 5 bad rows imports the good rows, rejects the bad ones, and lists each with file line number and reason.
- [ ] A `DD-MM-YYYY` file imports when that format is selected and is rejected when `YYYY-MM-DD` is selected.
- [ ] `peer_survey` rows without `consent=Y` are rejected and not stored.
- [ ] Batch status is `PARTIAL` or `REJECTED` when appropriate; nothing returns a hardcoded success.
- [ ] A byte-identical second upload is refused; a changed re-upload writes to `attendance_history`.

**Graph**
- [ ] Only students with validated ties are drawn; others appear in the side list.
- [ ] Every edge has `source_type` and `derived_from`; no `PEER_OF` exists in the database.
- [ ] No more than three edge types on screen; overlay edges only between drawn students.
- [ ] Evidence drawer lists exactly `co_cells` sessions and `co_dates` distinct dates.
- [ ] "Who skips Physics together?" works by setting the subject filter and returns ties that are subsets of that subject's sessions.
- [ ] Dismissing an edge hides it without changing any statistic.
- [ ] No glow, particle or pulse effects; only the selected node is outlined.

**Access**
- [ ] A teacher cannot open a section they do not teach; every graph/evidence view is in `audit_log`.
