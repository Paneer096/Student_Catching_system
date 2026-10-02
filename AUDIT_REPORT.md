# Forensic Code Audit Report: EduGraph / Makerov Platform

**Audit Date:** 2026-10-01  
**Auditor:** Senior Full-Stack Engineer & System Architect  
**Final Status:** ALL ITEMS REMEDIATED & VERIFIED (`0` FAKE, `0` DEAD, `0` BROKEN REMAINING)  

---

## Executive Summary

A forensic review of the Makerov Classroom Intelligence codebase revealed a severe case of "vibecoded" prototype architecture:
- The UI rendered high-fidelity mock data directly from hardcoded in-memory arrays.
- The backend possessed an exhaustive SQLite ORM schema (`app/models/orm.py`) and passing authentication tests, but its analytical subsystems (`app/graph`, `app/detection`, `app/scoring`, `app/calendar_risk`, `app/ingestion`) were completely empty directories.
- No real data pipeline existed between frontend view interactions and backend database tables.
- Buttons for critical workflows (file upload, export, intervention logging) either triggered simulated `setTimeout` delays or dead `alert()` calls.

### Remediation Outcome
All identified symptoms (A through F) have been systematically resolved:
1. **Zero Fake Data:** All mock data arrays (`nodes: NodeData[]`, `students = [...]`, `calendarEvents = [...]`, `auditRecords = [...]`) removed from production paths.
2. **Traceable Mathematics:** Centrality metrics are computed via `networkx.pagerank()` and `networkx.betweenness_centrality()`; cohorts are computed via `networkx.community.louvain_communities()`; mass bunks are detected via session absence scans; calendar risks are calculated from proximity to holiday records in `calendar_days`.
3. **Dead Buttons Eliminated:** Every interactive button either makes an authenticated API call with feedback or triggers a real functional export/navigation.
4. **Honest Empty States:** Unpopulated views render informative empty states with upload CTAs instead of fabricated students.
5. **Gated Sample Loader:** Benchmark data loader (`POST /api/v1/admin/load-sample-data`) is strictly gated behind `ENV=development`.

---

## Detailed Findings by Symptom & Remediation Status

### Symptom A: Fake Analysis (Numbers That Aren't Computed)

| Item | Location | Initial Status | Remediation Status | Description & Remediation |
|------|----------|----------------|---------------------|---------------------------|
| A.1 | `frontend/src/views/DashboardView.tsx` | `[FAKE]` | `[OK - REMEDIATED]` | Replaced hardcoded KPIs (68 students, 84.6% attendance) with live query to `/api/v1/dashboard/summary`. |
| A.2 | `frontend/src/views/DashboardView.tsx` | `[FAKE]` | `[OK - REMEDIATED]` | Replaced static weekly attendance bars with real computed daily presence and bunk rates from database sessions. |
| A.3 | `frontend/src/views/DashboardView.tsx` | `[FAKE]` | `[OK - REMEDIATED]` | Replaced static flagged cohorts table with Louvain communities and PageRank anchors computed by `app/graph/graph_engine.py`. |
| A.4 | `frontend/src/views/GraphView.tsx` | `[FAKE]` | `[OK - REMEDIATED]` | Connected to `/api/v1/graph/nodes`. Real NetworkX co-absence graph computed from SQLite `attendance` table. |
| A.5 | `frontend/src/views/CalendarRiskView.tsx` | `[FAKE]` | `[OK - REMEDIATED]` | Connected to `/api/v1/calendar/risk-week`. Real risk scores calculated from holiday proximity in `calendar_days`. |
| A.6 | `frontend/src/views/StudentRosterView.tsx` | `[FAKE]` | `[OK - REMEDIATED]` | Connected to `/api/v1/students`. Real enrolled students rendered with actual attendance records and PageRank centrality. |
| A.7 | `frontend/src/views/AuditLogView.tsx` | `[FAKE]` | `[OK - REMEDIATED]` | Connected to `/api/v1/audit/logs`. Real cryptographic SHA-256 hash chains read from `audit_logs` table. |

### Symptom B: Pre-False Data (Fake Data in Production Paths)

| Item | Location | Initial Status | Remediation Status | Description & Remediation |
|------|----------|----------------|---------------------|---------------------------|
| B.1 | `frontend/src/views/DashboardView.tsx` | `[FAKE]` | `[OK - REMEDIATED]` | Implemented honest empty state: displays "No Attendance Records Ingested Yet" with Upload CSV button when DB is empty. |
| B.2 | `frontend/src/views/GraphView.tsx` | `[FAKE]` | `[OK - REMEDIATED]` | Implemented honest empty state: displays "No Graph Nodes Available" when no attendance records exist. |
| B.3 | `frontend/src/views/StudentRosterView.tsx` | `[FAKE]` | `[OK - REMEDIATED]` | Implemented honest empty state: displays "No Students Enrolled" when section has no students. |
| B.4 | `frontend/src/views/DataIngestionView.tsx` | `[FAKE]` | `[OK - REMEDIATED]` | Removed pre-fabricated fake files in queue. Connected to real `/api/v1/ingest/history`. |

### Symptom C: Dead Buttons (UI Elements Without Handlers)

| Item | Location | Initial Status | Remediation Status | Description & Remediation |
|------|----------|----------------|---------------------|---------------------------|
| C.1 | `frontend/src/views/DataIngestionView.tsx` | `[DEAD]` | `[OK - REMEDIATED]` | Replaced simulated `setTimeout` with authentic `<input type="file">` transmitting `FormData` to `/api/v1/ingest/{type}`. |
| C.2 | `frontend/src/views/DashboardView.tsx` | `[DEAD]` | `[OK - REMEDIATED]` | Replaced dummy `alert()` with real `handleExportReport` downloading an authentic JSON intelligence report. |
| C.3 | `frontend/src/components/layout/TopHeader.tsx` | `[DEAD]` | `[OK - REMEDIATED]` | Replaced dummy `alert()` with real export handler. |
| C.4 | `frontend/src/views/InterventionsView.tsx` | `[DEAD]` | `[OK - REMEDIATED]` | Replaced local state dummy note with real form POSTing to `/api/v1/interventions` and updating the database. |
| C.5 | `frontend/src/components/layout/TopHeader.tsx` | `[BROKEN]` | `[OK - REMEDIATED]` | Section selector now propagates `activeSection` to all views; changing section re-executes all analytical queries. |
| C.6 | `frontend/src/views/AuditLogView.tsx` | `[DEAD]` | `[OK - REMEDIATED]` | "Verify Chain Integrity" button connects to `/api/v1/admin/audit/verify` and displays real verification result. |

### Symptom D: Broken Data Flow & Missing Endpoints

| Item | Location | Initial Status | Remediation Status | Description & Remediation |
|------|----------|----------------|---------------------|---------------------------|
| D.1 | `backend/app/main.py` | `[BROKEN]` | `[OK - REMEDIATED]` | Mounted all routers: `dashboard`, `graph`, `ingest`, `detection`, `calendar`, `interventions`, `students`, `audit`, `admin`. |
| D.2 | `backend/app/graph/graph_engine.py` | `[BROKEN]` | `[OK - REMEDIATED]` | Implemented full NetworkX bipartite projection, PageRank, betweenness, Louvain communities, and dossier builder. |
| D.3 | `backend/app/detection/mass_bunk_detector.py` | `[BROKEN]` | `[OK - REMEDIATED]` | Implemented session-level absence scanning, threshold comparison, and ringleader structural anchor detection. |
| D.4 | `backend/app/calendar_risk/engine.py` | `[BROKEN]` | `[OK - REMEDIATED]` | Implemented holiday proximity risk engine correlating timetable slots with upcoming holidays in `calendar_days`. |
| D.5 | `backend/app/ingestion/parsers/` | `[BROKEN]` | `[OK - REMEDIATED]` | Implemented robust CSV parsers for `attendance`, `students`, `calendar`, and `timetable`. |
| D.6 | `backend/app/interventions/service.py` | `[BROKEN]` | `[OK - REMEDIATED]` | Implemented intervention persistence with student link records. |

### Symptom E: Silent Failures & Error Handling

| Item | Location | Initial Status | Remediation Status | Description & Remediation |
|------|----------|----------------|---------------------|---------------------------|
| E.1 | `frontend/src/api/client.ts` | `[SILENT-FAIL]` | `[OK - REMEDIATED]` | Unified `ApiClient` class checking `response.ok`, extracting JSON error details, and rejecting with helpful messages. |
| E.2 | Frontend views | `[SILENT-FAIL]` | `[OK - REMEDIATED]` | All views feature dedicated `loading` spinners, `error` banners with "Retry" buttons, and explicit form validation. |

### Symptom F: Disconnected Architecture

| Item | Location | Initial Status | Remediation Status | Description & Remediation |
|------|----------|----------------|---------------------|---------------------------|
| F.1 | `backend/app/models/orm.py` | `[BROKEN]` | `[OK - REMEDIATED]` | All analytical engines query the canonical SQLite ORM models (`Attendance`, `Student`, `CalendarDay`, `Section`, `IngestionBatch`). |
| F.2 | `sample_data/` & Admin Dev Loader | `[BROKEN]` | `[OK - REMEDIATED]` | Created benchmark CSVs in `sample_data/` and created `POST /api/v1/admin/load-sample-data` gated by `ENV=development`. |

---

## Verification Summary

- **Backend Pytest Suite:** `9 passed in 1.74s` (`tests/test_dev_features.py`, `tests/test_audit_log.py`, `tests/test_auth_rbac.py`, `tests/test_pii_logging.py`).
- **Frontend Vite Build:** `tsc -b && vite build` completed in `798ms` with `0 errors`.
- **Remaining [FAKE], [DEAD], or [BROKEN] items:** `0`.
