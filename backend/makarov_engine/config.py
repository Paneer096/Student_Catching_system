"""Every threshold lives here, with the reason it has that value. Nothing is hardcoded elsewhere."""
from __future__ import annotations

import hashlib
import json
from dataclasses import asdict, dataclass
from typing import Optional


@dataclass(frozen=True)
class EngineConfig:
    # --- What counts as one "cell" -------------------------------------------------
    # A cell = one student x one date x one block of periods. Blocks are inclusive period ranges.
    # Why blocks and not single periods: a student who leaves for the afternoon is absent in 4
    # consecutive periods. Treating those as 4 independent events makes two students who left
    # together ONCE look like four coincidences. One block = one decision to skip.
    # Default splits the day at lunch (periods 1-4 | 5-8). Edit to match your timetable.
    blocks: tuple = ((1, 4), (5, 8))

    # --- What counts as a bunk ----------------------------------------------------
    # Absent for the first N periods and present afterwards is far more likely a late arrival
    # than a bunk, so it is excluded (not counted as a bunk, not counted as attended).
    late_arrival_max_periods: int = 2
    treat_late_arrival_as_bunk: bool = False

    # A cell where >= this share of the students who were on campus skipped is a class-wide
    # event (fest, strike, bus failure, a cancelled-in-practice lecture). Shared skipping there
    # says nothing about two students' private ties, so the cell is excluded from tie inference.
    mass_cell_threshold: float = 0.40
    # Do not apply the mass rule to tiny samples (2 of 3 students is not "mass").
    mass_cell_min_students: int = 8

    # --- Data sufficiency (honest empty states) ----------------------------------
    # Fewer school dates than this and no tie can be trusted.
    min_school_dates: int = 15
    # Need >= 2 observed sessions on most student-days, otherwise a bunk cannot be told apart
    # from a full-day absence (see docs: single-teacher registers are not enough).
    min_multi_period_share: float = 0.5

    # --- Pair testing ---------------------------------------------------------------
    # Only students with at least this many bunk cells are tested. A student with fewer than
    # min_co_cells bunks can never be in a tie, so testing them only wastes statistical power.
    # The filter uses each student's own count, which the stratified null holds fixed, so it
    # does not bias the test.
    min_active_bunk_cells: int = 4
    # A pair needs this many cells where both were eligible, or the comparison is meaningless.
    min_shared_cells: int = 20
    # Effect-size / evidence floors on top of the significance test:
    min_co_cells: int = 4      # overlaps needed
    min_co_dates: int = 3      # on at least this many different dates (cells on one date are not independent)
    min_lift: float = 2.0      # observed / expected under the null
    fdr_alpha: float = 0.05    # Benjamini-Hochberg false discovery rate across ALL tested pairs

    # Optional: also hold "which part of the term" fixed (guards against two students who both
    # began skipping after midterms). None = off. Costs power because strata get small.
    time_chunk_weeks: Optional[int] = None

    # --- Groups ----------------------------------------------------------------------
    louvain_resolution: float = 1.0
    min_group_size: int = 3
    seed: int = 7  # fixed so repeated runs give identical groups

    def params_hash(self) -> str:
        blob = json.dumps(asdict(self), sort_keys=True)
        return hashlib.sha256(blob.encode()).hexdigest()[:12]
