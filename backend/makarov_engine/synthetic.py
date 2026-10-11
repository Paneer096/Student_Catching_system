"""Synthetic register generator for TESTS AND CLEARLY-LABELLED DEMOS ONLY.
It plants known bunk groups so the engine can be scored against ground truth, and it plants the
confounds that fool naive methods (Friday-afternoon habits, class-wide skip days, illness, late
arrival, approved leave, partial-day bunks). Never import this from a production code path."""
from __future__ import annotations

import itertools

import numpy as np
import pandas as pd

WEEKDAY_MULT = np.array([0.8, 0.8, 0.9, 1.0, 2.0])      # Mon..Fri: Friday is the favourite
BLOCK_MULT = np.array([0.5, 1.5])                          # afternoon skipped more than morning
SUBJECTS = ["CS301", "CS302", "CS303", "MA301", "PHY101", "CS305L", "EN201", "CS304"]


def make_register(seed=0, n_students=60, weeks=16, groups=(), joint_events=12, join_prob=0.9,
                  friday_habit_share=0.3, mass_events=3, base_rate=0.07, illness_rate=0.008,
                  late_rate=0.01, leave_rate=0.004):
    rng = np.random.default_rng(seed)
    rolls = [f"21CSB{i:03d}" for i in range(1, n_students + 1)]
    start = pd.Timestamp("2026-07-27")  # a Monday
    dates = [start + pd.Timedelta(days=7 * w + d) for w in range(weeks) for d in range(5)]
    D = len(dates)
    base = rng.beta(1.2, 1.2 / base_rate - 1.2, size=n_students)
    habit = rng.random(n_students) < friday_habit_share

    # skip[s, d, b]: student intends to skip block b on day d
    skip = np.zeros((n_students, D, 2), bool)
    for s in range(n_students):
        for d, date in enumerate(dates):
            w = date.weekday()
            for b in range(2):
                pr = base[s] * WEEKDAY_MULT[w] * BLOCK_MULT[b]
                if habit[s] and w == 4 and b == 1:
                    pr = min(0.5, pr + 0.25)
                skip[s, d, b] = rng.random() < min(pr, 0.9)

    planted_pairs, events = set(), []
    idx = {r: i for i, r in enumerate(rolls)}
    for g in groups:
        members = [idx[m] if isinstance(m, str) else m for m in g]
        planted_pairs |= {frozenset((rolls[a], rolls[b])) for a, b in itertools.combinations(members, 2)}
        for d in rng.choice(D, size=min(joint_events, D), replace=False):
            b = 1 if rng.random() < 0.8 else 0
            for m in members:
                if rng.random() < join_prob:
                    skip[m, d, b] = True
            events.append((int(d), b, tuple(rolls[m] for m in members)))

    mass_cells = set()
    for _ in range(mass_events):
        d, b = int(rng.integers(D)), 1
        mass_cells.add((d, b))
        skip[rng.random(n_students) < 0.55, d, b] = True

    rows = []
    status = {}
    for s in range(n_students):
        ill = np.zeros(D, bool)
        leave = np.zeros(D, bool)
        late = np.zeros(D, bool)
        d = 0
        while d < D:
            if rng.random() < illness_rate:
                ill[d:d + int(rng.integers(1, 4))] = True
            if rng.random() < leave_rate:
                leave[d:d + int(rng.integers(1, 3))] = True
            if rng.random() < late_rate:
                late[d] = True
            d += 1
        for d, date in enumerate(dates):
            for p in range(1, 9):
                b = 0 if p <= 4 else 1
                st = "PRESENT"
                if ill[d]:
                    st = "ABSENT"
                elif leave[d]:
                    st = "MEDICAL_LEAVE"
                elif late[d] and p <= 2:
                    st = "ABSENT"
                elif skip[s, d, b]:
                    # sometimes only part of the block is skipped
                    st = "ABSENT" if (b == 1 or rng.random() < 0.7 or p <= 2) else "PRESENT"
                rows.append((rolls[s], date, p, SUBJECTS[(p - 1 + date.weekday()) % 8], st))
    att = pd.DataFrame(rows, columns=["roll_no", "date", "period", "subject_code", "status"])
    truth = dict(planted_pairs=planted_pairs, events=events, habit_students={rolls[i] for i in np.where(habit)[0]},
                 mass_cells=mass_cells, rolls=rolls, dates=dates)
    return att, truth


def naive_edges(att: pd.DataFrame, min_days=3) -> set:
    """The rule the old system used: any two students absent together on >= min_days dates."""
    ab = att[att.status == "ABSENT"].groupby("roll_no")["date"].apply(lambda s: set(s))
    out = set()
    for a, b in itertools.combinations(ab.index, 2):
        if len(ab[a] & ab[b]) >= min_days:
            out.add(frozenset((a, b)))
    return out
