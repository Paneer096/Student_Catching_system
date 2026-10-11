import json

import pandas as pd
import pytest

from makarov_engine.engine import run_engine
from makarov_engine.payload import build_graph_payload
from makarov_engine.synthetic import make_register
from makarov_engine.ties import memberships_from_clubs

GROUPS = [(0, 1, 2, 3), (10, 11, 12), (20, 21, 22, 23, 24)]


def test_payload_draws_only_students_with_validated_ties_and_every_edge_has_provenance():
    att, _ = make_register(seed=40, groups=GROUPS, joint_events=14)
    res = run_engine(att)
    p = build_graph_payload(res)
    json.dumps(p)                                               # must be JSON-serialisable
    ids = {n["roll_no"] for n in p["nodes"]}
    assert ids == {x for e in p["edges"] for x in (e["student_a"], e["student_b"])}
    assert all(e["source_type"] and e["derived_from"] for e in p["edges"])
    assert len(ids) < 60 and p["students_without_ties"] is not None


def test_overlays_are_limited_and_validated():
    att, _ = make_register(seed=40, groups=GROUPS, joint_events=14)
    res = run_engine(att)
    with pytest.raises(ValueError):
        build_graph_payload(res, overlays=["SAME_CLUB", "SITS_WITH", "NAMED_FRIEND"])      # 4 types on screen
    with pytest.raises(ValueError):
        build_graph_payload(res, overlays=["BESTIES"])


def test_overlay_edges_only_between_students_already_drawn_and_dismissals_hide_edges():
    att, _ = make_register(seed=40, groups=GROUPS, joint_events=14)
    res = run_engine(att)
    clubs = pd.DataFrame({"roll_no": res.nodes.roll_no, "club_name": "ACM"})
    mem = memberships_from_clubs(clubs)
    p = build_graph_payload(res, memberships=mem, overlays=["SAME_CLUB"])
    drawn = {n["roll_no"] for n in p["nodes"]}
    ov = [e for e in p["edges"] if e["type"] == "SAME_CLUB"]
    assert ov and all(e["student_a"] in drawn and e["student_b"] in drawn for e in ov)
    first = res.edges.iloc[0]
    p2 = build_graph_payload(res, dismissed={frozenset((first.student_a, first.student_b))})
    assert len([e for e in p2["edges"] if e["type"] == "BUNKS_WITH"]) == len(res.edges) - 1


def test_non_ok_status_returns_empty_graph_with_reason():
    att, _ = make_register(seed=2, weeks=2, groups=GROUPS)
    p = build_graph_payload(run_engine(att))
    assert p["status"] == "INSUFFICIENT_DATA" and p["nodes"] == [] and p["message"]
