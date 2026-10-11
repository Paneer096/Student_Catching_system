import itertools

import numpy as np
import pytest
from scipy.stats import hypergeom

from makarov_engine.engine import _validated
from makarov_engine.config import EngineConfig
from makarov_engine.pairtest import bh_qvalues, stratified_overlap_pvalue


def brute_force_tail(strata, c):
    """Enumerate every placement of B's skips inside each stratum (A's fixed): the exact permutation null."""
    dists = []
    for n, a, b in strata:
        counts = {}
        for combo in itertools.combinations(range(n), b):
            overlap = sum(1 for x in combo if x < a)       # A occupies positions 0..a-1
            counts[overlap] = counts.get(overlap, 0) + 1
        tot = sum(counts.values())
        dists.append({k: v / tot for k, v in counts.items()})
    total = {0: 1.0}
    for d in dists:
        nxt = {}
        for k1, p1 in total.items():
            for k2, p2 in d.items():
                nxt[k1 + k2] = nxt.get(k1 + k2, 0) + p1 * p2
        total = nxt
    return sum(p for k, p in total.items() if k >= c)


@pytest.mark.parametrize("strata,c", [([(6, 3, 3), (5, 2, 2)], 3), ([(8, 3, 4), (7, 2, 3), (6, 3, 2)], 4),
                                      ([(10, 4, 4)], 3), ([(5, 5, 2), (6, 1, 1)], 3)])
def test_convolution_matches_brute_force_permutation_distribution(strata, c):
    n, a, b = zip(*strata)
    p, _ = stratified_overlap_pvalue(n, a, b, c)
    assert p == pytest.approx(brute_force_tail(strata, c), rel=1e-9, abs=1e-12)


def test_single_stratum_equals_scipy_hypergeometric_tail():
    p, exp = stratified_overlap_pvalue([40], [10], [12], 6)
    assert p == pytest.approx(hypergeom.sf(5, 40, 10, 12))
    assert exp == pytest.approx(10 * 12 / 40)


def test_impossible_overlap_gives_zero_and_degenerate_strata_are_ignored():
    p, _ = stratified_overlap_pvalue([10, 10], [0, 3], [4, 3], 99)
    assert p == 0.0
    p, _ = stratified_overlap_pvalue([10, 10], [0, 3], [4, 3], 0)
    assert p == pytest.approx(1.0)


def test_bh_known_values_and_monotonicity():
    q = bh_qvalues(np.array([0.01, 0.04, 0.03, 0.005]), m=4)
    assert q.tolist() == pytest.approx([0.02, 0.04, 0.04, 0.02])
    q = bh_qvalues(np.array([0.001, 0.2, 0.9]), m=100)      # untested pairs only enlarge m
    assert q[0] == pytest.approx(0.1) and (q <= 1).all()
    with pytest.raises(ValueError):
        bh_qvalues(np.array([0.1, 0.2]), m=1)


def test_evidence_floors_stop_a_single_outing_from_becoming_a_tie():
    import pandas as pd
    t = pd.DataFrame([dict(student_a="A", student_b="B", c_cells=4, co_dates=2, n_shared=80, a_bunks=4, b_bunks=4,
                           expected=0.2, lift=20.0, jaccard=1.0, p_value=1e-9, q_value=1e-7, tests_run=100)])
    assert _validated(t, EngineConfig(), "h").empty                       # 4 cells but only 2 dates
    t.loc[0, "co_dates"] = 4
    assert len(_validated(t, EngineConfig(), "h")) == 1
    t.loc[0, "q_value"] = 0.2
    assert _validated(t, EngineConfig(), "h").empty                       # not significant after correction
