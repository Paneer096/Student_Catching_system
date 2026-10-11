"""Ties that come from REAL, NAMED sources (survey, seating, institution-assigned groups, transport, clubs).
Nothing here is inferred. Each tie keeps its source_type so the UI can say exactly where it came from.

Design rule: these are stored as MEMBERSHIPS (student -> key), never as pre-built pairs, so a lab batch of
60 does not explode into 1,770 edges. Pairs are only materialised for students already on screen.
"""
from __future__ import annotations

import itertools

import pandas as pd

# tie_type -> (kind, source_type).  SOCIAL ties suggest a relationship. CONTEXT ties are shared
# circumstances that can explain skipping together WITHOUT any friendship (same bus, same lab batch).
TIE_TYPES = {
    "NAMED_FRIEND":        ("SOCIAL",  "SURVEY"),
    "NAMED_STUDY_PARTNER": ("SOCIAL",  "SURVEY"),
    "SITS_WITH":           ("SOCIAL",  "INSTITUTION_ASSIGNED"),
    "PROJECT_TEAM":        ("SOCIAL",  "INSTITUTION_ASSIGNED"),
    "SAME_CLUB":           ("SOCIAL",  "INSTITUTION_ASSIGNED"),
    "SHARES_ROUTE":        ("CONTEXT", "INSTITUTION_ASSIGNED"),
    "LAB_BATCH":           ("CONTEXT", "INSTITUTION_ASSIGNED"),
    "ELECTIVE":            ("CONTEXT", "INSTITUTION_ASSIGNED"),
    "TUTORIAL":            ("CONTEXT", "INSTITUTION_ASSIGNED"),
    "MENTOR_GROUP":        ("CONTEXT", "INSTITUTION_ASSIGNED"),
}
MEMBERSHIP_COLS = ["roll_no", "tie_type", "key", "valid_from", "valid_to"]


def _norm(s):
    return s.astype(str).str.strip().str.upper()


def memberships_from_seating(df: pd.DataFrame) -> pd.DataFrame:
    """seating: roll_no, bench_id, [section_code, effective_from, effective_to].
    Two students share a SITS_WITH tie when they have the same bench (within the same section) at overlapping dates."""
    bench = df["bench_id"].astype(str).str.strip().str.upper()
    if "section_code" in df.columns:
        bench = df["section_code"].astype(str).str.strip().str.upper() + "|" + bench
    out = pd.DataFrame({"roll_no": _norm(df["roll_no"]), "tie_type": "SITS_WITH", "key": bench})
    out["valid_from"] = pd.to_datetime(df.get("effective_from"), errors="coerce")
    out["valid_to"] = pd.to_datetime(df.get("effective_to"), errors="coerce")
    return out[MEMBERSHIP_COLS]


def memberships_from_groups(df: pd.DataFrame) -> pd.DataFrame:
    """groups: roll_no, group_type, group_code, [subject_code, effective_from, effective_to]."""
    gt = df["group_type"].astype(str).str.strip().str.upper()
    bad = set(gt) - set(TIE_TYPES)
    if bad:
        raise ValueError(f"unknown group_type: {sorted(bad)}")
    out = pd.DataFrame({"roll_no": _norm(df["roll_no"]), "tie_type": gt,
                        "key": _norm(df["group_code"])})
    out["valid_from"] = pd.to_datetime(df.get("effective_from"), errors="coerce")
    out["valid_to"] = pd.to_datetime(df.get("effective_to"), errors="coerce")
    return out[MEMBERSHIP_COLS]


def memberships_from_transport(df: pd.DataFrame) -> pd.DataFrame:
    """transport: roll_no, mode (BUS|HOSTEL|OWN), route_or_block. OWN has no shared key and is dropped."""
    d = df[df["mode"].astype(str).str.upper() != "OWN"]
    out = pd.DataFrame({"roll_no": _norm(d["roll_no"]), "tie_type": "SHARES_ROUTE",
                        "key": _norm(d["mode"]) + "|" + _norm(d["route_or_block"])})
    out["valid_from"] = pd.NaT
    out["valid_to"] = pd.NaT
    return out[MEMBERSHIP_COLS]


def memberships_from_clubs(df: pd.DataFrame) -> pd.DataFrame:
    """clubs: roll_no, club_name, [role, from_date, to_date]."""
    out = pd.DataFrame({"roll_no": _norm(df["roll_no"]), "tie_type": "SAME_CLUB", "key": _norm(df["club_name"])})
    out["valid_from"] = pd.to_datetime(df.get("from_date"), errors="coerce")
    out["valid_to"] = pd.to_datetime(df.get("to_date"), errors="coerce")
    return out[MEMBERSHIP_COLS]


def nominations_from_survey(df: pd.DataFrame, known_rolls: set | None = None) -> pd.DataFrame:
    """peer_survey: respondent_roll_no, nominee_roll_no, relation (FRIEND|STUDY_PARTNER), survey_date, consent.
    Only rows with consent == Y are used. Self-nominations and unknown nominees are dropped.
    Returns DIRECTED nominations plus a `mutual` flag (the nominee also named the respondent, same relation)."""
    d = df.copy()
    d["respondent"] = _norm(d["respondent_roll_no"])
    d["nominee"] = _norm(d["nominee_roll_no"])
    d["relation"] = d["relation"].astype(str).str.strip().str.upper()
    d = d[d["consent"].astype(str).str.strip().str.upper().isin(["Y", "YES", "TRUE", "1"])]
    d = d[d["respondent"] != d["nominee"]]
    if known_rolls is not None:
        d = d[d["respondent"].isin(known_rolls) & d["nominee"].isin(known_rolls)]
    d = d.drop_duplicates(["respondent", "nominee", "relation"])
    pairs = set(zip(d["respondent"], d["nominee"], d["relation"]))
    d["mutual"] = [(n, r, rel) in pairs for r, n, rel in zip(d["respondent"], d["nominee"], d["relation"])]
    d["tie_type"] = d["relation"].map({"FRIEND": "NAMED_FRIEND", "STUDY_PARTNER": "NAMED_STUDY_PARTNER"})
    d = d.dropna(subset=["tie_type"])
    return d[["respondent", "nominee", "tie_type", "mutual", "survey_date"]].reset_index(drop=True)


def _overlap(a_from, a_to, b_from, b_to) -> bool:
    af = a_from if pd.notna(a_from) else pd.Timestamp.min
    bf = b_from if pd.notna(b_from) else pd.Timestamp.min
    at = a_to if pd.notna(a_to) else pd.Timestamp.max
    bt = b_to if pd.notna(b_to) else pd.Timestamp.max
    return max(af, bf) <= min(at, bt)


def shared_ties(a: str, b: str, memberships: pd.DataFrame | None, nominations: pd.DataFrame | None) -> list:
    """Every real tie two students share. Never merged into a score; returned as a list so the UI can show badges."""
    a, b = a.upper(), b.upper()
    out = []
    if memberships is not None and len(memberships):
        ma, mb = memberships[memberships.roll_no == a], memberships[memberships.roll_no == b]
        for r in ma.merge(mb, on=["tie_type", "key"], suffixes=("_a", "_b")).itertuples():
            if _overlap(r.valid_from_a, r.valid_to_a, r.valid_from_b, r.valid_to_b):
                kind, src = TIE_TYPES[r.tie_type]
                out.append(dict(tie_type=r.tie_type, kind=kind, source_type=src, detail=r.key))
    if nominations is not None and len(nominations):
        n = nominations[((nominations.respondent == a) & (nominations.nominee == b)) |
                        ((nominations.respondent == b) & (nominations.nominee == a))]
        for tt, g in n.groupby("tie_type"):
            kind, src = TIE_TYPES[tt]
            both = {a, b} <= set(g.respondent) and {a, b} <= set(g.nominee)
            out.append(dict(tie_type=tt, kind=kind, source_type=src, detail="mutual" if both else "one-way"))
    return out


def corroborate(edges: pd.DataFrame, memberships=None, nominations=None) -> pd.DataFrame:
    """Attach, to each validated bunk edge, the real ties the same two students also share.
    corroboration is evidence ABOUT the relationship; it never changes the edge weight."""
    e = edges.copy()
    ties = [shared_ties(r.student_a, r.student_b, memberships, nominations) for r in e.itertuples()]
    e["shared_ties"] = ties
    e["has_social_tie"] = [any(t["kind"] == "SOCIAL" for t in ts) for ts in ties]
    e["has_context_tie"] = [any(t["kind"] == "CONTEXT" for t in ts) for ts in ties]
    return e


def overlay_edges(visible: list, memberships=None, nominations=None, tie_types: set | None = None) -> pd.DataFrame:
    """Optional overlay edges between students ALREADY on screen only (bounds the drawing to a few hundred pairs)."""
    rows = []
    for a, b in itertools.combinations(sorted(set(x.upper() for x in visible)), 2):
        for t in shared_ties(a, b, memberships, nominations):
            if tie_types is None or t["tie_type"] in tie_types:
                rows.append(dict(student_a=a, student_b=b, type=t["tie_type"], kind=t["kind"],
                                 source_type=t["source_type"], detail=t["detail"]))
    return pd.DataFrame(rows, columns=["student_a", "student_b", "type", "kind", "source_type", "detail"])
