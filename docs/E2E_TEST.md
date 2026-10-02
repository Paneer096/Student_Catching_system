# Makerove (EduGraph) End-to-End Verification Guide

This document outlines the step-by-step verification procedures for the 5 core end-to-end data workflows in Makerove. Every workflow traces data from raw CSV files into SQLite database records, through NetworkX and statistical engines, and into the frontend UI.

---

## Prerequisites

1. **Start Backend Server:**
   ```bash
   cd backend
   python -m uvicorn app.main:app --reload --port 8000
   ```

2. **Start Frontend Server:**
   ```bash
   cd frontend
   npm run dev
   ```
   Frontend runs on `http://localhost:5173`.

---

## Workflow 1: Ingest Attendance CSV &rarr; See Students in Graph

### Objective
Verify that uploading an authentic attendance CSV creates records in the SQLite database and populates the social knowledge graph with computed nodes, edges, and PageRank scores.

### Step-by-Step UI Verification
1. Navigate to `http://localhost:5173`.
2. Open the **Data Ingestion** tab from the left navigation bar.
3. Select **Attendance Register** as the dataset type.
4. Upload `sample_data/attendance_cs3b_oct.csv` or click **Load Sample Data (Dev Only)**.
5. Verify that a success confirmation appears indicating records were inserted.
6. Check the **Ingestion Audit History** table: a new entry with status `SUCCESS` and row count is added.
7. Navigate to the **Social Knowledge Graph** tab.
8. Verify that 12 real students appear with calculated coordinates, co-absence edges, and PageRank labels.

### API / Curl Verification
```bash
# 1. Ingest Attendance CSV
curl -X POST "http://localhost:8000/api/v1/ingest/attendance" \
  -H "accept: application/json" \
  -F "file=@../sample_data/attendance_cs3b_oct.csv;type=text/csv"

# Expected Response:
# {"status":"SUCCESS","filename":"attendance_cs3b_oct.csv","records_inserted":110,"total_rows":110,"errors_count":0}

# 2. Query Graph Nodes
curl -X GET "http://localhost:8000/api/v1/graph/nodes?section=CS-3B" \
  -H "accept: application/json"

# Expected Response:
# Contains "nodes" array of 12 students with computed "pagerank", "role", and "edges" array.
```

---

## Workflow 2: Click Student Node &rarr; View Real Dossier

### Objective
Verify that clicking a student node in the social graph calls the backend dossier endpoint and displays their real attendance percentage, role, co-absent peers, and recent sessions.

### Step-by-Step UI Verification
1. Open the **Social Knowledge Graph** view.
2. Click on the node labeled **Varun M. (Roll 21CSB007)** (highlighted as a Structural Anchor).
3. The right-hand inspector panel immediately loads the dossier:
   - Roll Number: `21CSB007`
   - Role: `Structural Anchor (Leader)`
   - Attendance Rate: `76.9%` (10 of 13 sessions attended)
   - PageRank Score: `0.1549`
   - Top Co-Absent Peers: Lists mutual absences with Rohit Sharma, Simran Patel, etc.
   - Recent Sessions: Real timestamped list of attended and absent periods.

### API / Curl Verification
```bash
curl -X GET "http://localhost:8000/api/v1/graph/student/21CSB007" \
  -H "accept: application/json"

# Expected Response:
# {
#   "id": "...",
#   "roll_no": "21CSB007",
#   "name": "Varun Mehta",
#   "attendance_pct": 76.9,
#   "role": "Structural Anchor (Leader)",
#   "pagerank": 0.1549,
#   "peers": [{"roll_no":"21CSB014","name":"Rohit Sharma","mutual_absences":3,...}],
#   "recent_attendance": [...]
# }
```

---

## Workflow 3: Log Intervention &rarr; Reflected in History

### Objective
Verify that teachers can record proactive supportive interventions that are saved directly to the database and immediately appear in the active interventions list.

### Step-by-Step UI Verification
1. Navigate to the **Active Teacher Interventions** view.
2. In the "Log Proactive Intervention" form:
   - Target Cohort: `Physics Lab Focus Group`
   - Target Student Roll Numbers: `21CSB007, 21CSB014`
   - Strategy: `Peer Mentoring (Buddy Pairing)`
   - Action Details: `Assigned collaborative lab project paired with Priya Desai.`
3. Click **Record Intervention in Log**.
4. A green confirmation banner appears: `Intervention successfully logged (ID: ...)`.
5. The intervention appears immediately in the "Recorded Interventions" list on the right.

### API / Curl Verification
```bash
curl -X POST "http://localhost:8000/api/v1/interventions" \
  -H "Content-Type: application/json" \
  -d '{
    "student_ids": ["21CSB007", "21CSB014"],
    "type": "PEER_MENTORING",
    "trigger_context": "Physics Lab Focus Group",
    "notes": "Assigned collaborative lab project paired with Priya Desai.",
    "assigned_to": "Class Teacher"
  }'

# Expected Response:
# {"status":"SUCCESS","id":"...","message":"Intervention recorded successfully"}
```

---

## Workflow 4: Calendar Risk &rarr; Real Holiday Proximity Forecast

### Objective
Verify that the calendar risk engine calculates mathematical absence hazard scores based on holiday proximity and long weekends from the database.

### Step-by-Step UI Verification
1. Navigate to the **Academic Calendar & Risk Proximity** view.
2. Verify that calendar days are loaded from `calendar_days`:
   - Friday October 25, 2024: Flagged as `HIGH RISK` with statistical reasoning: `"Friday before 3-day holiday weekend (Diwali). Historically high mass bunk hazard."`
   - Thursday October 31, 2024: Flagged with `Diwali Festival (Official Holiday) (College Closed)`.
3. Each card provides an option to directly schedule an intervention.

### API / Curl Verification
```bash
curl -X GET "http://localhost:8000/api/v1/calendar/risk-week?section=CS-3B" \
  -H "accept: application/json"

# Expected Response:
# [
#   {
#     "date": "2024-10-25",
#     "day": "Friday",
#     "risk_level": "HIGH",
#     "risk_score": 75,
#     "reason": "Friday before 3-day holiday weekend (Diwali). Historically high mass bunk hazard.",
#     "is_holiday": false,
#     "holiday_name": null
#   },
#   ...
# ]
```

---

## Workflow 5: Mass Bunk Detection &rarr; Coordinated Absence Alert

### Objective
Verify that the detection engine scans session-level attendance records, identifies coordinated absences >= 40%, pinpoints the structural anchor, and highlights participants.

### Step-by-Step UI Verification
1. Navigate to the **Mass Bunk Alerts** view.
2. Verify that detected events are rendered:
   - Example Event: `Coordinated Absence: Friday, Period 5 (PHY101)`
   - Absent: 6 of 12 students (50%)
   - Risk Score: `55.0`
   - Structural Anchor: `Varun Mehta (21CSB007)`
   - Participating Students: Lists all 6 absent roll numbers.
3. Click **Inspect in Graph**:
   - The UI routes directly to the Social Knowledge Graph with `21CSB007` selected and their co-absent connections highlighted.

### API / Curl Verification
```bash
curl -X GET "http://localhost:8000/api/v1/detection/mass-bunks?section=CS-3B" \
  -H "accept: application/json"

# Expected Response:
# [
#   {
#     "id": "MB-20241025-P5",
#     "date": "2024-10-25",
#     "day": "Friday",
#     "period": 5,
#     "subject_code": "PHY101",
#     "absent_count": 6,
#     "total_enrolled": 12,
#     "absent_percentage": 50.0,
#     "risk_score": 55.0,
#     "structural_anchor": {"roll_no": "21CSB007", "name": "Varun Mehta"},
#     "participating_roll_numbers": ["21CSB007", "21CSB041", "21CSB014", "21CSB052", "21CSB029", "21CSB022"],
#     "reason": "6 of 12 students (50%) coordinated absence on Friday Period 5."
#   }
# ]
```

---

## Automated Pytest Suite

To execute automated tests for all workflows:
```bash
cd backend
python -m pytest tests/test_dev_features.py -v
```

All tests must pass with `0` failures.
