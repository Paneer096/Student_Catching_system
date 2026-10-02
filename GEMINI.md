# Makerove — Operating Rules & Guardrails

> **Tagline:** "A teacher's sixth sense — support before sanction."
> **Architecture:** Social Knowledge Graph for Classroom Intelligence (DPDP 2023 / Rules 2025 Compliant)

---

## 0. Operating Rules (R1–R11)

- **R1 — Phases, not a big bang.** Build in the phases of §15. Never start the next phase until the current one is green.
- **R2 — No placeholders in delivered code.** No `TODO`/`FIXME`, no `pass` bodies, no `NotImplementedError`, no production functions returning hard-coded fake data.
- **R3 — Verify, don't assume.** Confirm dependency versions and APIs before implementing. Pin in lockfiles.
- **R4 — Determinism.** All randomness is seeded (`RANDOM_SEED=42`), including Louvain community detection.
- **R5 — No magic numbers.** Every weight, threshold, and window lives in `backend/app/config/thresholds.yaml` with documentation comments.
- **R6 — No black boxes.** Every flag carries evidence (counts, dates), per-factor contributions, confidence, data window, and limits note ("signals, not verdicts").
- **R7 — Guardrails win.** Guardrails G1–G14 override any feature described elsewhere. Conflicts are recorded in `docs/DECISIONS.md`.
- **R8 — Secrets and data.** Secrets come from `.env` and are never committed or logged. Repositories contain only synthetic data.
- **R9 — Quality gates.** Backend: `ruff` and `mypy` clean. Frontend: `tsc -b` and ESLint clean. All tests green. Logging via loguru with strict **PII scrubbing** (UUIDs only, no names or roll numbers).
- **R10 — Decisions log.** Log architectural decisions in `docs/DECISIONS.md`.
- **R11 — Persist these rules.** Keep this file at repo root.

---

## 1. System Guardrails (G1–G14)

| ID | Guardrail | Enforcement |
|---|---|---|
| **G1** | **No forecasting of individuals.** Calendar forecasts are section and period level only. | Schema test: calendar responses contain zero student identifiers. |
| **G2** | **Excused absences never count.** Medical, approved leave, on-duty are removed from numerators and denominators. | Eligibility filters exclude excused leaves from all metrics. |
| **G3** | **Evidence or silence.** Minimum sample thresholds, chance correction, and FDR control must be met before displaying flags. | Detection tests verify decoy resistance. |
| **G4** | **Teacher-in-the-loop.** Suggestions only; humans decide. Dismissals require recorded reasons. | Outbound email/SMS to students/parents disabled by default. |
| **G5** | **Student transparency and rights.** Students inspect their own scores, contributions, and who accessed their data (access log). Peer identities are never revealed. | Student `/me` contract tests. |
| **G6** | **Minors Protection (DPDP §9).** Students under 18 excluded from peer-edge inference by default. | Minors Decoy D8 verification. |
| **G7** | **De-identify before Gemini.** Zero names, roll numbers, or free text sent to LLM. Only anonymized aggregates. | Payload inspection gate. |
| **G8** | **Data minimization.** Ingest only authorized attendance, timetable, roster, marks, calendar. | Strict schema allow-list. |
| **G9** | **No permanent labels.** Rolling windows (30/60/90 days). Recovering students automatically cleared. | Rolling expiry tests. |
| **G10** | **Immutable audit.** Hash-chained append-only SHA-256 audit ledger. `/admin/audit/verify` verifies chain. | Tamper detection test. |
| **G11** | **Security baseline.** Argon2id hashing, signed httpOnly cookies, CSRF tokens, rate limiting. | RBAC role × endpoint matrix tests. |
| **G12** | **Privacy by default in UI.** Student names masked to initials by default. Reveal is audited. Idle blur after 5 min. | Frontend UI contract tests. |
| **G13** | **Fairness audit.** Regular statistical audit of flag rates across optional groups and teachers. | Skew alerts to admin only. |
| **G14** | **Consent and notice.** Versioned DPDP notice on first login; opt-in peer surveys; consent withdrawal removes peer edges. | Consent lifecycle tests. |

---

## 2. Vocabulary Restrictions

| Prohibited Word | Mandated Makerove Term |
|---|---|
| troublemaker, trouble_score | `support_priority` ("Needs outreach") |
| ringleader | `group_anchor` |
| mass bunk | "Group absence" |
| critical / crime / offender / officer | "High attention" / "Watch" / "Noted" / "Teacher" |
| dual influence | `bridge_opportunity` |
| silent ringleader | `unnoticed_connector` |
| negative influence | "absence-pattern centrality" |
| isolated | "possible withdrawal" |
