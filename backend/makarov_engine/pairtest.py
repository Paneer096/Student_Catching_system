"""Exact stratified test: do two students skip the same half-days more often than chance?

Null hypothesis (in one sentence a teacher can read): "If each student's skip days were shuffled
among days of the same weekday and the same time of day, would these two still overlap this often?"

Within one stratum (say 'Friday afternoon') with n eligible cells, student A skipped a of them and
B skipped b. If unrelated, the overlap is Hypergeometric(n, a, b). Strata are independent, so the
exact null distribution of the TOTAL overlap is the convolution of the per-stratum pmfs. No
Monte-Carlo noise, so tiny p-values stay resolvable and multiple-testing correction works.
"""
from __future__ import annotations

import numpy as np
import pandas as pd
from scipy.stats import hypergeom

from .config import EngineConfig


def bh_qvalues(p: np.ndarray, m: int) -> np.ndarray:
    """Benjamini-Hochberg adjusted p-values. `p` are the computed p-values; `m` is the TOTAL number
    of hypotheses tested (untested pairs count as p = 1 and sit at the bottom of the ranking, so
    they only need to be in m)."""
    p = np.asarray(p, float)
    if p.size == 0:
        return p
    if m < p.size:
        raise ValueError("m must be >= number of p-values")
    order = np.argsort(p, kind="stable")
    ranked = p[order] * m / np.arange(1, p.size + 1)
    q_sorted = np.minimum.accumulate(ranked[::-1])[::-1]
    q = np.empty_like(p)
    q[order] = np.clip(q_sorted, 0.0, 1.0)
    return q


def stratified_overlap_pvalue(n_s, a_s, b_s, c_obs: int) -> tuple[float, float]:
    """P(total overlap >= c_obs) and E[total overlap] for per-stratum (n, a, b) triples."""
    pmf = np.array([1.0])
    expected = 0.0
    for n, a, b in zip(n_s, a_s, b_s):
        if n <= 0 or a <= 0 or b <= 0:
            continue
        expected += a * b / n
        k = np.arange(0, min(a, b) + 1)
        pmf = np.convolve(pmf, hypergeom.pmf(k, n, a, b))
    if c_obs >= pmf.size:
        return 0.0, expected
    return float(np.clip(pmf[c_obs:].sum(), 0.0, 1.0)), expected


def test_pairs(Y: np.ndarray, E: np.ndarray, strata: np.ndarray, date_idx: np.ndarray,
               students: list, cfg: EngineConfig) -> pd.DataFrame:
    """Return one row per CANDIDATE pair (overlap >= min_co_cells) with p and BH q.
    q is computed against ALL active pairs, not just candidates."""
    cols = ["student_a", "student_b", "c_cells", "co_dates", "n_shared", "a_bunks", "b_bunks",
            "expected", "lift", "jaccard", "p_value", "q_value", "tests_run"]
    active = np.where(Y.sum(1) >= cfg.min_active_bunk_cells)[0]
    n = len(active)
    if n < 2:
        return pd.DataFrame(columns=cols)
    m_tests = n * (n - 1) // 2
    Ya, Ea = Y[active].astype(np.float32), E[active].astype(np.float32)

    n_tot = Ea @ Ea.T
    a_tot = Ya @ Ea.T          # a_tot[i, j] = i's bunks on cells where j was also eligible
    c_tot = Ya @ Ya.T
    uniq = np.unique(strata)
    n_s, a_s = [], []
    for s in uniq:
        cols_s = np.where(strata == s)[0]
        Ys, Es = Ya[:, cols_s], Ea[:, cols_s]
        n_s.append(Es @ Es.T)
        a_s.append(Ys @ Es.T)

    rows = []
    iu, ju = np.triu_indices(n, k=1)
    keep = (c_tot[iu, ju] >= cfg.min_co_cells) & (n_tot[iu, ju] >= cfg.min_shared_cells)
    for i, j in zip(iu[keep], ju[keep]):
        ns = [int(M[i, j]) for M in n_s]
        as_ = [int(M[i, j]) for M in a_s]
        bs = [int(M[j, i]) for M in a_s]
        c = int(c_tot[i, j])
        p, exp = stratified_overlap_pvalue(ns, as_, bs, c)
        co_cells = np.where((Ya[i] > 0) & (Ya[j] > 0))[0]
        a_i, b_j = int(a_tot[i, j]), int(a_tot[j, i])
        rows.append(dict(
            student_a=students[active[i]], student_b=students[active[j]], c_cells=c,
            co_dates=int(np.unique(date_idx[co_cells]).size), n_shared=int(n_tot[i, j]),
            a_bunks=a_i, b_bunks=b_j, expected=exp, lift=(c / exp) if exp > 0 else np.inf,
            jaccard=c / (a_i + b_j - c) if (a_i + b_j - c) > 0 else 0.0, p_value=p))
    out = pd.DataFrame(rows, columns=cols[:-2])
    if out.empty:
        return pd.DataFrame(columns=cols)
    out["q_value"] = bh_qvalues(out["p_value"].to_numpy(), m_tests)
    out["tests_run"] = m_tests
    return out[cols]
