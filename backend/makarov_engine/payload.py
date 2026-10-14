"""Build the JSON the frontend draws. The frontend never computes ties; it only renders this."""
from __future__ import annotations

import pandas as pd

from . import ENGINE_VERSION
from .engine import EngineResult
from .ties import TIE_TYPES, corroborate, overlay_edges

MAX_EDGE_TYPES_ON_SCREEN = 3   # BUNKS_WITH + at most two overlays


def build_graph_payload(res: EngineResult, names: dict | None = None, memberships=None, nominations=None,
                        overlays=(), dismissed: set | None = None, include_dismissed: bool = False,
                        manual_connections: list | None = None) -> dict:
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
            has_social_tie=bool(r.has_social_tie), has_context_tie=bool(r.has_context_tie), dismissed=bool(r.dismissed),
            is_manual=False))

    # Incorporate Teacher Manual Connections (§4, G4)
    if manual_connections:
        for mc in manual_connections:
            m_a = str(mc.student_a if hasattr(mc, "student_a") else mc["student_a"]).strip().upper()
            m_b = str(mc.student_b if hasattr(mc, "student_b") else mc["student_b"]).strip().upper()
            m_type = str(mc.connection_type if hasattr(mc, "connection_type") else mc.get("connection_type", "STUDIES_WITH")).strip().upper()
            m_weight = float(mc.weight if hasattr(mc, "weight") else mc.get("weight", 1.0))
            m_notes = str((mc.notes if hasattr(mc, "notes") else mc.get("notes")) or "")
            m_by = str(mc.created_by if hasattr(mc, "created_by") else mc.get("created_by", "teacher"))
            m_id = str(mc.id if hasattr(mc, "id") else mc.get("id", f"{m_a}|{m_b}|{m_type}"))
            m_at = mc.created_at.isoformat() if hasattr(mc, "created_at") and hasattr(mc.created_at, "isoformat") else str(getattr(mc, "created_at", ""))

            edges.append(dict(
                id=f"{m_a}|{m_b}|{m_type}",
                type=m_type,
                student_a=m_a,
                student_b=m_b,
                weight=m_weight,
                co_cells=0,
                co_dates=0,
                expected=0.0,
                lift=1.0,
                q_value=0.0,
                source_type="TEACHER_MANUAL",
                derived_from=f"teacher:{m_by}",
                detail=m_notes or "Teacher manual connection",
                notes=m_notes,
                created_by=m_by,
                created_at=m_at,
                connection_id=m_id,
                is_manual=True,
                shared_ties=[dict(tie_type=m_type, kind="SOCIAL", source_type="TEACHER_OBSERVATION", detail=m_notes or "Teacher observation")],
                has_social_tie=True,
                has_context_tie=False,
                dismissed=False,
            ))

    in_graph = sorted({x for ed in edges for x in (ed["student_a"], ed["student_b"])})
    if overlays and in_graph:
        ov = overlay_edges(in_graph, memberships, nominations, set(overlays))
        for r in ov.itertuples():
            edges.append(dict(id=f"{r.student_a}|{r.student_b}|{r.type}", type=r.type, student_a=r.student_a, student_b=r.student_b,
                              kind=r.kind, source_type=r.source_type, detail=r.detail, derived_from=f"source:{r.source_type}",
                              is_manual=False))

    nd = res.nodes.set_index("roll_no") if hasattr(res, "nodes") and res.nodes is not None and not res.nodes.empty else pd.DataFrame().set_index(pd.Index([]))
    nodes = []
    for s in in_graph:
        if s in nd.index:
            nodes.append(dict(
                roll_no=s,
                name=names.get(s, s),
                bunk_rate=float(nd.at[s, "bunk_rate"]),
                bunk_cells=int(nd.at[s, "bunk_cells"]),
                eligible_cells=int(nd.at[s, "eligible_cells"]),
                n_ties=int(nd.at[s, "n_ties"]),
                group_id=None if pd.isna(nd.at[s, "group_id"]) else int(nd.at[s, "group_id"]),
            ))
        else:
            st_ties = sum(1 for ed in edges if ed.get("student_a") == s or ed.get("student_b") == s)
            nodes.append(dict(
                roll_no=s,
                name=names.get(s, s),
                bunk_rate=0.0,
                bunk_cells=0,
                eligible_cells=60,
                n_ties=st_ties,
                group_id=None,
            ))

    without = [dict(roll_no=s, name=names.get(s, s), bunk_cells=int(nd.at[s, "bunk_cells"]))
               for s in nd.index if s not in set(in_graph) and nd.at[s, "bunk_cells"] > 0]
    mass = (
        [dict(date=str(r.date.date()), block=int(r.block), skipped=int(r.n_bunk), present=int(r.n_elig))
         for r in res.cells.mass_cells.itertuples()]
        if getattr(res, "cells", None) is not None and hasattr(res.cells, "mass_cells") and res.cells.mass_cells is not None
        else []
    )
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
