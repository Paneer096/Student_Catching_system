# Makarov Build Status & Next Steps

Oct 11, 2026 · @Paneer

## Where things stand

The connection engine and its spec are finished and tested; the backend wiring, both UI screens and the real-data check are still to do. The next step is to give Gemini the continuation prompt together with the spec file.

## What is done

Four deliverables exist, and the engine code inside the spec is the same code that passed its tests.

| Deliverable | What it is | Size and status |
| --- | --- | --- |
| makarov\_connection\_engine\_v3.md | Build spec for Antigravity with the engine code embedded | About 2,250 lines; code re-extracted from the file and re-tested |
| makarov\_engine/ package | Bunk-tie engine, strict validators, graph payload, shuffle-control check | 20 files, about 1,730 lines; 60 tests pass |
| makarov\_master\_prompt.md | Corrected version of the DeepSeek master prompt (earlier version) | Superseded by the v3 spec for connection logic |
| Gemini continuation prompt | Task list that wires the engine into your backend | Filled in with your current state: 38 tables, 4 to migrate, 8 to create |

## What is not done

None of the nine new API routes exist yet, and nothing has been run on real student data.

- **Backend wiring (Gemini tasks 1 to 8):** migrate the students, attendance, ingestion\_batches and audit\_log tables; create eight new tables; build the nine routes under ingest and sections; add the engine job, access checks and audit logging.
- **Legacy cleanup:** remove the old cluster names, PageRank roles, pathfinder, entity injector, status fallback and invented defaults listed in section 0 of the spec.
- **Frontend:** the ingestion screen (spec section 4) and the graph screen with the evidence drawer (section 6).
- **Real-data check:** shuffle\_control has not been run on a real section, so the engine is validated only on my simulator.
- **Prediction model:** not built; the engine only exposes partner pressure as a feature for it.

## What to do next

Back up your database first, then hand the work to Gemini in small, checkable steps.

1. Copy the database file as a backup before any migration: makerove.db in the backend folder.
2. Open Gemini, paste the continuation prompt, and attach makarov\_connection\_engine\_v3.md.
3. Before it changes any table, make it show backend/app/models.py and its migration plan for the four tables.
4. After its first tasks, run the engine tests and ingest the generated test register; both should pass before you go on.
5. Run shuffle\_control on one real section and read the verdict.
6. Only then build the two UI screens.

## Corrections and risks

My earlier status answer had one wrong number and one gap, and there are two risks to watch.

- **Correction:** I said the spec was 1,730+ lines. The spec file is about 2,250 lines; 1,730 is the Python package alone.
- **Gap:** I called the continuation prompt ready without flagging a route prefix problem. Route prefix mismatch: your app uses /api/v1/ but the spec uses /api/.
- **Risk, foreign keys:** moving students to roll\_no as the primary key may break other tables that point at the old student id. I have not seen those tables, so Gemini should check every foreign key before the migration.
- **Risk, real data:** every accuracy figure comes from my simulator. Treat the graph as unproven until shuffle\_control passes on a real section.
