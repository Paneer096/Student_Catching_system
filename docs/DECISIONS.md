# Makerove — Decisions Log

Assumptions, trade-offs, and design decisions made during development.

---

## Phase 0 — Foundations

### D001: SQLite as Default Database
- **Decision:** Use SQLite (via aiosqlite) as the default database.
- **Rationale:** A college section has ~60 students (department ≈ 200–500). SQLite handles this easily, and the project can run with `pip install` + `npm install` alone. PostgreSQL-ready via SQLAlchemy abstraction.
- **Trade-off:** No concurrent writes from multiple processes. Acceptable for single-process dev/demo.

### D002: Session Cookies over JWT
- **Decision:** Use signed httpOnly session cookies, not JWTs in localStorage.
- **Rationale:** Per §3.3 — no tokens in sessionStorage/localStorage. Server-side sessions enable immediate invalidation (logout, lockout).

### D003: 404 over 403 for Unauthorized Resource Access
- **Decision:** Return HTTP 404 (not 403) when a user requests a resource outside their scope.
- **Rationale:** Prevents IDOR — an attacker cannot distinguish "exists but you can't see it" from "doesn't exist". Per §3.3.

### D004: Gemini Model IDs
- **Decision:** Using `gemini-2.5-flash` as primary and `gemini-2.0-flash-lite` as fallback.
- **Rationale:** The spec mentioned `gemini-3.5-flash` which doesn't exist as of build date. Using current stable models. These are configurable via `.env`.

### D005: Project Name
- **Decision:** Renamed from "EduGraph" to "Makerove" per user instruction.
- **Rationale:** User preference. All code, UI text, and documentation use "Makerove".
