"""Run this on YOUR real data before trusting the graph.

shuffle_control() scrambles every student's skip days among cells of the same weekday and time of day
(each student keeps their own rate and habits, but all links BETWEEN students are destroyed), then
runs the exact same pipeline. A trustworthy engine finds ~0 ties in the shuffled copies. If the real
register shows clearly more ties than the shuffles, the ties are real signal; if it doesn't, the
class simply has no detectable bunk groups yet (which is a valid answer)."""
from __future__ import annotations

import numpy as np

from .cells import build_cells
from .config import EngineConfig
from .engine import _validated
from .pairtest import test_pairs


def shuffle_control(att, cfg: EngineConfig | None = None, n_runs: int = 20, seed: int = 0, cancelled=None, leaves=None) -> dict:
    cfg = cfg or EngineConfig()
    cd = build_cells(att, cfg, cancelled, leaves)
    if cd.status != "OK":
        return dict(status=cd.status, message=cd.message)
    strata = cd.cells["stratum"].to_numpy()
    didx = cd.cells["date_idx"].to_numpy()
    real = _validated(test_pairs(cd.Y, cd.E, strata, didx, cd.students, cfg), cfg, "diag")
    rng = np.random.default_rng(seed)
    counts = []
    groups = [np.where(strata == s)[0] for s in np.unique(strata)]
    for _ in range(n_runs):
        Yp = np.zeros_like(cd.Y)
        for i in range(cd.Y.shape[0]):
            for cols in groups:
                el = cols[cd.E[i, cols]]
                if el.size:
                    Yp[i, el] = rng.permutation(cd.Y[i, el])
        counts.append(len(_validated(test_pairs(Yp, cd.E, strata, didx, cd.students, cfg), cfg, "diag")))
    return dict(status="OK", real_edges=int(len(real)), shuffled_edges_per_run=counts,
                shuffled_mean=float(np.mean(counts)), shuffled_max=int(np.max(counts)),
                verdict=("Real ties exceed the shuffled baseline." if len(real) > max(counts) else
                         "No more ties than chance: treat the graph as empty for this data."))
