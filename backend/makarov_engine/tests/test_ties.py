import pandas as pd

from makarov_engine.ties import (corroborate, memberships_from_clubs, memberships_from_groups,
                                 memberships_from_seating, memberships_from_transport, nominations_from_survey,
                                 overlay_edges, shared_ties)


def survey():
    return pd.DataFrame({"respondent_roll_no": ["R1", "R2", "R3", "R4", "R1"], "nominee_roll_no": ["R2", "R1", "R1", "R4", "R3"],
                         "relation": ["FRIEND", "FRIEND", "FRIEND", "FRIEND", "STUDY_PARTNER"],
                         "survey_date": ["2026-09-01"] * 5, "consent": ["Y", "Y", "Y", "Y", "N"]})


def test_survey_mutual_flag_consent_and_self_nominations():
    n = nominations_from_survey(survey(), known_rolls={"R1", "R2", "R3", "R4"})
    pairs = {(r.respondent, r.nominee): r.mutual for r in n.itertuples()}
    assert pairs[("R1", "R2")] and pairs[("R2", "R1")]               # reciprocated -> mutual
    assert pairs[("R3", "R1")] is False                              # one-way stays one-way (no invented 0.4 weight)
    assert ("R4", "R4") not in pairs                                 # self-nomination dropped
    assert ("R1", "R3") not in pairs                                 # no consent -> not used


def test_memberships_and_shared_ties_with_date_overlap():
    seat = pd.DataFrame({"roll_no": ["R1", "R2", "R3"], "bench_id": ["B4", "B4", "B4"],
                         "effective_from": ["2026-08-01", "2026-08-01", "2026-10-01"],
                         "effective_to": ["2026-09-15", "2026-09-15", "2026-11-30"]})
    m = memberships_from_seating(seat)
    assert [t["tie_type"] for t in shared_ties("R1", "R2", m, None)] == ["SITS_WITH"]
    assert shared_ties("R1", "R3", m, None) == []                   # same bench number, different terms
    groups = pd.DataFrame({"roll_no": ["R1", "R2"], "group_type": ["LAB_BATCH", "LAB_BATCH"], "group_code": ["B1", "B1"]})
    t = shared_ties("R1", "R2", memberships_from_groups(groups), None)
    assert t[0]["kind"] == "CONTEXT"


def test_own_transport_creates_no_tie():
    tr = pd.DataFrame({"roll_no": ["R1", "R2", "R3", "R4"], "mode": ["BUS", "BUS", "OWN", "OWN"],
                       "route_or_block": ["R12", "R12", None, None]})
    m = memberships_from_transport(tr)
    assert len(shared_ties("R1", "R2", m, None)) == 1 and shared_ties("R3", "R4", m, None) == []


def test_corroboration_labels_social_vs_context_and_never_changes_weight():
    edges = pd.DataFrame({"student_a": ["R1", "R1"], "student_b": ["R2", "R3"], "weight": [0.5, 0.4]})
    clubs = pd.DataFrame({"roll_no": ["R1", "R2"], "club_name": ["ACM", "ACM"]})
    tr = pd.DataFrame({"roll_no": ["R1", "R3"], "mode": ["BUS", "BUS"], "route_or_block": ["R7", "R7"]})
    import pandas as pd2
    mem = pd2.concat([memberships_from_clubs(clubs), memberships_from_transport(tr)], ignore_index=True)
    out = corroborate(edges, mem, None)
    assert out["has_social_tie"].tolist() == [True, False] and out["has_context_tie"].tolist() == [False, True]
    assert out["weight"].tolist() == [0.5, 0.4]


def test_overlay_is_limited_to_visible_students():
    clubs = pd.DataFrame({"roll_no": [f"R{i}" for i in range(50)], "club_name": ["ACM"] * 50})
    o = overlay_edges(["R1", "R2", "R3"], memberships_from_clubs(clubs), None)
    assert len(o) == 3 and set(o["type"]) == {"SAME_CLUB"}
