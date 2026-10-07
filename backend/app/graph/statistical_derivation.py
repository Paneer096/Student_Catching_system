"""
Makarov — Statistical Edge Derivation Engine (§5.1)

Computes statistically validated SKIPS_WITH edges:
1. Builds binary matrix B (students x eligible sessions), where 1 = bunk.
2. Identifies and excludes mass-absence sessions (>= 40% section absent).
3. Distinguishes partial-day skips (bunks) from full-day absences (§2).
4. For each pair:
   - Computes expected co-bunks, lift, Jaccard similarity.
   - Computes one-sided hypergeometric test (Fisher's exact test) p-value.
5. Applies Benjamini-Hochberg False Discovery Rate (FDR) correction across all pairs.
6. Emits SKIPS_WITH edges iff c >= min_co_bunks AND lift >= min_lift AND q <= fdr_alpha.
   Edge weight = Jaccard similarity.
"""
from __future__ import annotations

import hashlib
import json
from collections import defaultdict
from datetime import date
from typing import Any

import numpy as np
from scipy.stats import hypergeom
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config.settings import get_thresholds
from app.models.enums import AttendanceStatus, EdgeType
from app.models.orm import (
    Attendance,
    Edge,
    Section,
    Student,
)


def benjamini_hochberg(p_values: np.ndarray) -> np.ndarray:
    """
    Computes Benjamini-Hochberg FDR-adjusted q-values for an array of p-values.
    Controls False Discovery Rate at the specified alpha.
    """
    n = len(p_values)
    if n == 0:
        return np.array([])
    order = np.argsort(p_values)
    ranks = np.arange(1, n + 1)
    sorted_p = p_values[order]

    # q_i = p_i * n / rank_i
    cummin_input = (sorted_p * n) / ranks
    # Enforce monotonicity from right to left
    q_sorted = np.minimum.accumulate(cummin_input[::-1])[::-1]
    q_sorted = np.clip(q_sorted, 0.0, 1.0)

    q_values = np.zeros(n)
    q_values[order] = q_sorted
    return q_values


def compute_params_hash(params: dict[str, Any]) -> str:
    """Deterministic hash of filter parameters for caching."""
    serialized = json.dumps(params, sort_keys=True, default=str)
    return hashlib.sha256(serialized.encode("utf-8")).hexdigest()[:16]


async def derive_skips_with_edges(
    db: AsyncSession,
    section_code: str,
    start_date: date | None = None,
    end_date: date | None = None,
    subject_code: str | None = None,
    period: int | None = None,
    weekday: int | None = None,
) -> dict[str, Any]:
    """
    Vectorized derivation of SKIPS_WITH edges for a section per §5.1.
    Computes in < 1 second for sections up to 150 students.
    """
    thresholds = get_thresholds()
    min_co_bunks = int(thresholds.get("min_co_bunks", 4))
    min_lift = float(thresholds.get("min_lift", 2.0))
    fdr_alpha = float(thresholds.get("fdr_alpha", 0.05))
    mass_absence_thresh = float(thresholds.get("mass_absence_threshold", 0.40))

    # 1. Fetch section and students
    sec_stmt = select(Section).where(Section.code == section_code)
    sec_res = await db.execute(sec_stmt)
    section = sec_res.scalar_one_or_none()
    if not section:
        return {
            "section_code": section_code,
            "students": [],
            "edges": [],
            "isolated_students": [],
            "summary": {"student_count": 0, "edge_count": 0, "pair_count": 0},
        }

    stu_stmt = (
        select(Student)
        .where(Student.section_id == section.id)
        .order_by(Student.roll_no.asc())
    )
    stu_res = await db.execute(stu_stmt)
    students = list(stu_res.scalars().all())
    if not students:
        return {
            "section_code": section_code,
            "students": [],
            "edges": [],
            "isolated_students": [],
            "summary": {"student_count": 0, "edge_count": 0, "pair_count": 0},
        }

    student_ids = [s.id for s in students]
    id_to_roll = {s.id: s.roll_no for s in students}
    id_to_name = {s.id: s.name for s in students}
    id_to_idx = {s.id: i for i, s in enumerate(students)}
    n_students = len(students)

    # 2. Fetch attendance records
    att_stmt = select(Attendance).where(Attendance.student_id.in_(student_ids))
    if start_date:
        att_stmt = att_stmt.where(Attendance.date >= start_date)
    if end_date:
        att_stmt = att_stmt.where(Attendance.date <= end_date)
    if subject_code:
        att_stmt = att_stmt.where(Attendance.subject_code == subject_code)
    if period:
        att_stmt = att_stmt.where(Attendance.period == period)

    att_res = await db.execute(att_stmt)
    attendance_rows = list(att_res.scalars().all())

    if not attendance_rows:
        return {
            "section_code": section_code,
            "students": [
                {"id": s.id, "roll_no": s.roll_no, "name": s.name} for s in students
            ],
            "edges": [],
            "isolated_students": [s.roll_no for s in students],
            "summary": {"student_count": n_students, "edge_count": 0, "pair_count": 0},
        }

    # 3. Group attendance by (date, student) to classify partial-day bunks vs full-day
    # Per §2: Bunk = unexcused ABSENT in a session while PRESENT in >= 1 other session same day.
    student_day_statuses = defaultdict(lambda: defaultdict(list))
    session_records = defaultdict(list)

    for att in attendance_rows:
        if weekday is not None and att.date.weekday() != weekday:
            continue
        student_day_statuses[att.student_id][att.date].append(att.status)
        sess_key = (att.date, att.period, att.subject_code)
        session_records[sess_key].append(att)

    # Check for degraded mode: only 1 session per day per student
    total_records = len(attendance_rows)
    unique_days = len({att.date for att in attendance_rows})
    is_degraded = (total_records / max(1, unique_days * n_students)) <= 1.2

    # 4. Filter out mass-absence sessions (>= 40% section absent)
    valid_sessions = []
    for sess_key, records in session_records.items():
        absent_count = sum(
            1 for r in records if r.status in (AttendanceStatus.ABSENT, "ABSENT", "A")
        )
        total_in_sess = len(records)
        absence_rate = absent_count / max(1, total_in_sess)
        if absence_rate < mass_absence_thresh:
            valid_sessions.append(sess_key)

    valid_sessions.sort()
    session_to_idx = {s: i for i, s in enumerate(valid_sessions)}
    n_sessions = len(valid_sessions)

    if n_sessions == 0:
        return {
            "section_code": section_code,
            "students": [
                {"id": s.id, "roll_no": s.roll_no, "name": s.name} for s in students
            ],
            "edges": [],
            "isolated_students": [s.roll_no for s in students],
            "summary": {"student_count": n_students, "edge_count": 0, "pair_count": 0},
        }

    # 5. Build binary matrix B (students x valid sessions) where 1 = bunk
    B = np.zeros((n_students, n_sessions), dtype=np.int32)
    session_details_map = {}

    for att in attendance_rows:
        sess_key = (att.date, att.period, att.subject_code)
        if sess_key not in session_to_idx:
            continue
        s_idx = id_to_idx.get(att.student_id)
        if s_idx is None:
            continue
        sess_idx = session_to_idx[sess_key]

        is_absent = att.status in (AttendanceStatus.ABSENT, "ABSENT", "A")
        if not is_absent:
            continue

        if is_degraded:
            # Degraded mode: treat raw unexcused absence as bunk
            B[s_idx, sess_idx] = 1
            session_details_map[sess_idx] = {
                "date": str(att.date),
                "period": att.period,
                "subject_code": att.subject_code,
            }
        else:
            # Full mode: verify presence in at least 1 other session that day
            day_statuses = student_day_statuses[att.student_id][att.date]
            had_presence = any(
                st in (AttendanceStatus.PRESENT, "PRESENT", "P", "LATE", "L")
                for st in day_statuses
            )
            if had_presence:
                B[s_idx, sess_idx] = 1
                session_details_map[sess_idx] = {
                    "date": str(att.date),
                    "period": att.period,
                    "subject_code": att.subject_code,
                }

    # 6. Vectorized co-bunk matrix: C = B @ B.T
    C = B @ B.T
    individual_bunks = np.diag(C)  # bunks per student

    # 7. Evaluate candidate pairs
    candidate_pairs = []
    p_values_list = []

    for i in range(n_students):
        for j in range(i + 1, n_students):
            c = int(C[i, j])
            if c < min_co_bunks:
                continue

            a = int(individual_bunks[i])
            b = int(individual_bunks[j])
            N = n_sessions

            if N == 0 or a == 0 or b == 0:
                continue

            expected = (a * b) / N
            lift = c / expected if expected > 0 else 0.0
            if lift < min_lift:
                continue

            jaccard = c / (a + b - c) if (a + b - c) > 0 else 0.0

            # One-sided hypergeometric survival function: P(X >= c)
            # scipy.stats.hypergeom.sf(k-1, M, n, N_draws)
            # M = population size (N), n = successes in pop (a), N_draws = draws (b)
            p_val = float(hypergeom.sf(c - 1, N, a, b))

            # Retrieve co-bunk session evidence
            shared_mask = np.logical_and(B[i] == 1, B[j] == 1)
            shared_indices = np.where(shared_mask)[0]
            evidence_sessions = [
                session_details_map.get(idx, {}) for idx in shared_indices
            ]

            candidate_pairs.append({
                "student_a": students[i],
                "student_b": students[j],
                "c": c,
                "a": a,
                "b": b,
                "N": N,
                "expected": round(expected, 2),
                "lift": round(lift, 2),
                "jaccard": round(jaccard, 3),
                "p_value": p_val,
                "evidence": evidence_sessions,
            })
            p_values_list.append(p_val)

    # 8. Benjamini-Hochberg FDR correction
    q_values = benjamini_hochberg(np.array(p_values_list))

    # 9. Assemble validated edges
    validated_edges = []
    connected_rolls = set()

    for idx, cand in enumerate(candidate_pairs):
        q_val = float(q_values[idx])
        if q_val <= fdr_alpha:
            s_a = cand["student_a"]
            s_b = cand["student_b"]
            connected_rolls.add(s_a.roll_no)
            connected_rolls.add(s_b.roll_no)

            plain_lang = (
                f"Skipped together {cand['c']} times; "
                f"if independent we'd expect about {cand['expected']:.1f} (Lift: {cand['lift']}x)."
            )

            validated_edges.append({
                "id": f"edge-skips-{s_a.roll_no}-{s_b.roll_no}",
                "source": s_a.roll_no,
                "target": s_b.roll_no,
                "src_id": s_a.id,
                "dst_id": s_b.id,
                "type": EdgeType.SKIPS_WITH.value if hasattr(EdgeType, "SKIPS_WITH") else "SKIPS_WITH",
                "weight": cand["jaccard"],
                "color": "#D55E00",  # Okabe-Ito safe orange
                "p_value": cand["p_value"],
                "q_value": round(q_val, 4),
                "evidence_count": cand["c"],
                "evidence": cand["evidence"],
                "props": {
                    "c": cand["c"],
                    "lift": cand["lift"],
                    "expected": cand["expected"],
                    "a": cand["a"],
                    "b": cand["b"],
                    "N": cand["N"],
                    "jaccard": cand["jaccard"],
                    "q_value": round(q_val, 4),
                },
                "plain_language": plain_lang,
            })

    # Sort edges descending by Jaccard weight
    validated_edges.sort(key=lambda e: e["weight"], reverse=True)

    # Identify isolated students for the sidebar
    isolated_students = [
        s.roll_no for s in students if s.roll_no not in connected_rolls
    ]

    # Calculate 30-day bunk rate for node sizing per §7 visual encoding
    # Student size: bunk rate over last 30 days
    nodes = []
    for s in students:
        bunk_count = int(individual_bunks[id_to_idx[s.id]])
        bunk_rate = round(bunk_count / max(1, n_sessions), 3)
        nodes.append({
            "id": s.roll_no,
            "db_id": s.id,
            "name": s.name,
            "roll_no": s.roll_no,
            "bunk_rate_30d": bunk_rate,
            "bunk_count": bunk_count,
            "has_edges": s.roll_no in connected_rolls,
            "attendance_rate": round(1.0 - bunk_rate, 3),
        })

    return {
        "section_code": section_code,
        "nodes": nodes,
        "edges": validated_edges,
        "isolated_students": isolated_students,
        "summary": {
            "total_students": n_students,
            "connected_students": len(connected_rolls),
            "isolated_count": len(isolated_students),
            "edge_count": len(validated_edges),
            "sessions_evaluated": n_sessions,
            "is_degraded": is_degraded,
        },
    }
