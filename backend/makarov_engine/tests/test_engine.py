import time

import pandas as pd
import pytest

from makarov_engine.config import EngineConfig
from makarov_engine.engine import match_group_ids, pair_evidence, partner_pressure, run_engine
from makarov_engine.synthetic import make_register, naive_edges

GROUPS = [(0, 1, 2, 3), (10, 11, 12), (20, 21, 22, 23, 24)]


def edge_set(res):
    return {frozenset((r.student_a, r.student_b)) for r in res.edges.itertuples()}


def test_pure_noise_produces_no_ties_even_with_strong_friday_afternoon_habits():
    """Negative control. 12 noise registers, 60% of students share a Friday-afternoon habit."""
    for seed in range(12):
        att, _ = make_register(seed=900 + seed, groups=(), friday_habit_share=0.6)
        assert edge_set(run_engine(att)) == set(), f"false edge on seed {seed}"


def test_planted_groups_are_recovered_and_false_discovery_rate_is_controlled():
    """BH guarantees the AVERAGE share of false ties is <= alpha (5%), not that none ever appear.
    Measured over 20 seeds in development: 3 false of 273 ties (1.1%)."""
    tp = fp = planted = 0
    for seed in range(6):
        att, truth = make_register(seed=40 + seed, groups=GROUPS, joint_events=14)
        found = edge_set(run_engine(att))
        tp += len(found & truth["planted_pairs"])
        fp += len(found - truth["planted_pairs"])
        planted += len(truth["planted_pairs"])
    assert fp / max(tp + fp, 1) <= 0.05
    assert tp / planted >= 0.6          # measured ~0.65-0.7 at 14 joint events; see the power table in the docs


def test_old_naive_rule_would_have_linked_most_of_the_class():
    att, truth = make_register(seed=1, groups=GROUPS)
    naive = naive_edges(att)
    assert len(naive) > 500                           # of 1,770 possible pairs
    assert len(edge_set(run_engine(att))) < 20


def test_one_shared_afternoon_never_creates_a_tie():
    att, truth = make_register(seed=3, groups=[(5, 6)], joint_events=1)
    assert frozenset(("21CSB006", "21CSB007")) not in edge_set(run_engine(att))


def test_results_are_deterministic():
    att, _ = make_register(seed=7, groups=GROUPS)
    a, b = run_engine(att), run_engine(att)
    pd.testing.assert_frame_equal(a.edges, b.edges)
    assert a.groups == b.groups


def test_time_chunk_option_still_finds_ties_and_stays_clean_on_noise():
    cfg = EngineConfig(time_chunk_weeks=8)
    att, _ = make_register(seed=5, groups=(), friday_habit_share=0.6)
    assert edge_set(run_engine(att, cfg)) == set()
    att, truth = make_register(seed=41, groups=GROUPS, joint_events=16)
    found = edge_set(run_engine(att, cfg))
    assert found and not (found - truth["planted_pairs"])


def test_evidence_lists_exactly_the_dates_that_were_counted():
    att, truth = make_register(seed=40, groups=GROUPS, joint_events=14)
    res = run_engine(att)
    r = res.edges.iloc[0]
    ev = pair_evidence(res, r.student_a, r.student_b)
    assert len(ev["sessions"]) == r.c_cells
    assert len({s["date"] for s in ev["sessions"]}) == r.co_dates
    assert ev["validated"] and "not why" in ev["plain_language"]
    assert all(s["periods_a"] and s["periods_b"] for s in ev["sessions"])


def test_groups_come_from_validated_edges_only_and_have_stable_ids():
    att, truth = make_register(seed=40, groups=GROUPS, joint_events=14)
    res = run_engine(att)
    members = {m for g in res.groups for m in g["members"]}
    assert members <= {x for e in edge_set(res) for x in e}
    prev = {g["group_id"]: set(g["members"]) for g in res.groups}
    again = run_engine(att, prev_groups=prev)
    assert {g["group_id"]: set(g["members"]) for g in again.groups} == prev


def test_group_id_matching_rules():
    prev = {1: {"A", "B", "C"}, 2: {"X", "Y", "Z"}}
    ids = match_group_ids(prev, [{"X", "Y", "Z", "W"}, {"A", "B", "C"}, {"P", "Q", "R"}])
    assert ids[0] == 2 and ids[1] == 1 and ids[2] not in (1, 2)


def test_nodes_table_has_facts_only_no_roles_or_influence_scores():
    att, _ = make_register(seed=40, groups=GROUPS, joint_events=14)
    res = run_engine(att)
    assert set(res.nodes.columns) == {"roll_no", "bunk_cells", "eligible_cells", "bunk_rate", "n_ties", "group_id"}


def test_partner_pressure_counts_validated_partners_already_absent():
    att, _ = make_register(seed=40, groups=GROUPS, joint_events=14)
    res = run_engine(att)
    r = res.edges.iloc[0]
    assert partner_pressure(res.edges, {r.student_b})[r.student_a] >= 1


def test_runtime_for_a_large_section_is_well_under_five_seconds():
    att, _ = make_register(seed=11, n_students=120, groups=[tuple(range(0, 6)), tuple(range(30, 35))], joint_events=14)
    t = time.time()
    res = run_engine(att)
    assert time.time() - t < 5.0 and res.status == "OK"


def test_insufficient_data_returns_honest_status_not_fake_edges():
    att, _ = make_register(seed=2, weeks=2, groups=GROUPS)
    res = run_engine(att)
    assert res.status == "INSUFFICIENT_DATA" and res.edges.empty


def test_evidence_subjects_never_contain_blank_codes():
    att, _ = make_register(seed=40, groups=GROUPS, joint_events=14)
    att["subject_code"] = ""
    res = run_engine(att)
    r = res.edges.iloc[0]
    assert all(s["subjects"] == [] for s in pair_evidence(res, r.student_a, r.student_b)["sessions"])


def test_pairs_tested_is_reported_even_when_no_candidate_pair_exists():
    att, _ = make_register(seed=2, groups=(), base_rate=0.03)
    res = run_engine(att)
    assert res.quality["pairs_tested"] == res.quality["active_students"] * (res.quality["active_students"] - 1) // 2


def test_engine_accepts_filters_and_reports_that_it_was_filtered():
    att, _ = make_register(seed=40, groups=GROUPS, joint_events=14)
    full = run_engine(att)
    fri = run_engine(att, weekdays=[4])
    assert fri.status in ("OK", "INSUFFICIENT_DATA") and fri.quality["filtered"] is True
    assert fri.cells.E.sum() < full.cells.E.sum()
