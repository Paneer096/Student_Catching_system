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
