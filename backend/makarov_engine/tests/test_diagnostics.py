from makarov_engine.diagnostics import shuffle_control
from makarov_engine.synthetic import make_register

GROUPS = [(0, 1, 2, 3), (10, 11, 12), (20, 21, 22, 23, 24)]


def test_shuffle_control_separates_real_ties_from_chance():
    att, _ = make_register(seed=40, groups=GROUPS, joint_events=14)
    d = shuffle_control(att, n_runs=8)
    assert d["real_edges"] >= 8 and d["shuffled_max"] <= 1 and "exceed" in d["verdict"]


def test_shuffle_control_says_nothing_found_when_there_is_nothing():
    att, _ = make_register(seed=77, groups=(), friday_habit_share=0.6)
    d = shuffle_control(att, n_runs=8)
    assert d["real_edges"] == 0 and "chance" in d["verdict"]
