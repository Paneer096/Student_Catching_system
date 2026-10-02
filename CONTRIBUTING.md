# Contributing to Makerove (EduGraph)

Makerove is an authentic, production-grade Classroom Intelligence Platform designed to empower educators with data-driven insights. To maintain zero-compromise code integrity and prevent "vibecoded" demo-ware patterns, all contributors must strictly adhere to these rules.

---

## Anti-Patterns to Eliminate Forever

### 1. Never Hardcode a Number That Represents Data
If a value is a score, centrality, count, percentage, date, or graph coordinate, it must be derived from database records or analytical algorithms (`networkx.pagerank`, Louvain community detection, SQL aggregations).
- **Prohibited:** `const attendanceRate = 84.6;` or `<div>PageRank: 0.82</div>`
- **Required:** Fetch from `/api/v1/dashboard/summary` or `/api/v1/graph/nodes`.

### 2. Never Use `Math.random()` or `random.` Outside Test Fixtures
Unpredictable or pseudo-random data generators in production paths are strictly forbidden. Every metric must be mathematically repeatable and traceable to real ingested data.
- **Prohibited:** `const riskScore = Math.floor(Math.random() * 50) + 50;`
- **Required:** Calculate risk via documented formulas in `app/calendar_risk/` or `app/detection/`.

### 3. Never Leave a Button Without a Handler
Every `<button>`, `<Link>`, or clickable element in the UI must do real work:
- Trigger an API request with success/error handling, OR
- Perform a legitimate client-side operation (e.g. theme toggle, modal open, file download).
- If a feature is not yet built, **remove the button**. A missing button is honest; a dead button is fraudulent.

### 4. Never Catch an Exception Silently
Do not write empty catch blocks that swallow failures:
- **Prohibited:**
  ```python
  try:
      compute_metrics()
  except Exception:
      pass
  ```
- **Required:**
  ```python
  try:
      compute_metrics()
  except Exception as e:
      logger.error("compute_metrics failed: {err}", err=str(e))
      raise HTTPException(status_code=500, detail=f"Analytical calculation failed: {str(e)}")
  ```

### 5. Never Render Fake Content to Fill Empty Space
When the database is unpopulated or has no data for a given section, components must render an **honest empty state** (e.g. *"No attendance records ingested yet. [Upload CSV]"*). Never show fake student rosters or fabricated charts to make the interface look full.

### 6. Never Import Mock Data into Production Components
Files like `mockData.ts`, `sampleData.json`, or demo constants are prohibited in production bundles. Sample data belongs exclusively in `sample_data/` and may only enter the system via the dev-only loader endpoint (`POST /api/v1/admin/load-sample-data`) gated behind `ENV=development`.

### 7. Never Commit a Chart or Metric Without a Data Source Comment
Every metric, chart, or analytical card in frontend components must contain a traceability comment documenting its source:
```tsx
// Source: GET /api/v1/dashboard/summary -> weekly_activity (computed from SQLite attendance table)
<div className="bar-chart">...</div>
```

---

## Code Quality Standards

1. **Backend Testing:** Run `python -m pytest` in `backend/` before submitting PRs. All tests must pass.
2. **Frontend Type Checking:** Run `npm run build` in `frontend/` to ensure zero TypeScript errors (`tsc -b`).
3. **Data Verification:** Verify that any new endpoint provides full traceability to the underlying SQLite schema.
