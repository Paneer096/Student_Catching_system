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
