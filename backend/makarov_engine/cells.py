"""Turn a raw attendance register into 'cells' (student x date x block) with two flags:
   eligible  - the student was expected and observed, so a bunk was possible
   bunk      - the student skipped while demonstrably on campus that day
Everything downstream (tie tests, evidence, node sizes) reads only from these arrays.
"""
from __future__ import annotations

from dataclasses import dataclass

import numpy as np
import pandas as pd

from .config import EngineConfig
from .statuses import CANONICAL

REQUIRED = ("roll_no", "date", "period", "status")


@dataclass
class CellData:
    status: str                  # OK | INSUFFICIENT_DATA | PERIOD_DATA_REQUIRED
    message: str
    students: list
    cells: pd.DataFrame          # K rows: date, block, weekday, date_idx, stratum
    Y: np.ndarray                # (N, K) bool  bunk
    E: np.ndarray                # (N, K) bool  eligible   (Y implies E)
    detail: pd.DataFrame         # one row per bunked session: roll_no, date, block, period, subject_code
    mass_cells: pd.DataFrame     # class-wide skip events that were excluded
    quality: dict


def _empty(status, message, quality, students=()):
    return CellData(status, message, list(students), pd.DataFrame(), np.zeros((len(students), 0), bool),
                    np.zeros((len(students), 0), bool), pd.DataFrame(), pd.DataFrame(), quality)


def build_cells(att: pd.DataFrame, cfg: EngineConfig, cancelled: pd.DataFrame | None = None,
                leaves: pd.DataFrame | None = None, subject: str | None = None, periods=None, weekdays=None,
                date_from=None, date_to=None) -> CellData:
    """Filters (subject, periods, weekdays, date range) are applied AFTER the day-level facts are computed.
    That matters: if you filtered the raw rows to 'Physics' first, a student who skipped the afternoon
    would look absent all day (their morning rows would be gone) and every bunk would vanish."""
    missing = [c for c in REQUIRED if c not in att.columns]
    if missing:
        raise ValueError(f"attendance is missing columns: {missing}")
    if len(cfg.blocks) > 10:
        raise ValueError("at most 10 blocks are supported")

    df = att.copy()
    if "subject_code" not in df.columns:
        df["subject_code"] = ""
    df["roll_no"] = df["roll_no"].astype(str).str.strip().str.upper()
    df["date"] = pd.to_datetime(df["date"]).dt.normalize()
    df["period"] = df["period"].astype(int)
    unknown_status = ~df["status"].isin(CANONICAL)
    if unknown_status.any():
        raise ValueError("engine accepts only canonical statuses; normalise at ingestion "
                         f"(found {sorted(df.loc[unknown_status, 'status'].astype(str).unique())[:5]})")
    df = df.drop_duplicates(["roll_no", "date", "period"], keep="last").reset_index(drop=True)
    q: dict = {"rows_in": int(len(df))}
    all_students = sorted(df["roll_no"].unique())

    # 1) sessions that were not held
    q["rows_cancelled"] = 0
    if cancelled is not None and len(cancelled):
        c = cancelled.copy()
        c["date"] = pd.to_datetime(c["date"]).dt.normalize()
        whole_days = c.loc[c["period"].isna(), "date"].unique()
        part = (c.dropna(subset=["period"]).assign(period=lambda x: x["period"].astype(int))
                [["date", "period"]].drop_duplicates().assign(_cx=1))
        before = len(df)
        df = df[~df["date"].isin(whole_days)]
        df = df.merge(part, on=["date", "period"], how="left")
        df = df[df["_cx"].isna()].drop(columns="_cx").reset_index(drop=True)
        q["rows_cancelled"] = int(before - len(df))

    # 2) approved leave turns ABSENT into an excused status (never a bunk)
    q["rows_excused_by_leave"] = 0
    if leaves is not None and len(leaves):
        lv = leaves.copy()
        lv["roll_no"] = lv["roll_no"].astype(str).str.strip().str.upper()
        lv["from_date"] = pd.to_datetime(lv["from_date"]).dt.normalize()
        lv["to_date"] = pd.to_datetime(lv["to_date"]).dt.normalize()
        lv["_kind"] = np.where(lv["leave_type"].astype(str).str.upper().eq("ON_DUTY"), "ON_DUTY", "MEDICAL_LEAVE")
        ab = df.loc[df["status"] == "ABSENT", ["roll_no", "date"]].reset_index().rename(columns={"index": "_row"})
        m = ab.merge(lv[["roll_no", "from_date", "to_date", "_kind"]], on="roll_no")
        m = m[(m["date"] >= m["from_date"]) & (m["date"] <= m["to_date"])].drop_duplicates("_row")
        df.loc[m["_row"].to_numpy(), "status"] = m["_kind"].to_numpy()
        q["rows_excused_by_leave"] = int(len(m))

    # 3) map periods to blocks (periods outside every block are ignored, and counted)
    block = np.full(len(df), -1, dtype=int)
    per = df["period"].to_numpy()
    for b, (lo, hi) in enumerate(cfg.blocks):
        block[(per >= lo) & (per <= hi)] = b
    q["rows_outside_blocks"] = int((block < 0).sum())
    df["block"] = block
    df = df[df["block"] >= 0].sort_values(["roll_no", "date", "period"]).reset_index(drop=True)

    q["n_school_dates"] = int(df["date"].nunique())
    q["n_students"] = len(all_students)

    # 4) day-level facts per student
    df["present"] = df["status"].isin(["PRESENT", "LATE"])
    df["absent"] = df["status"].eq("ABSENT")
    df["excused"] = df["status"].isin(["MEDICAL_LEAVE", "ON_DUTY"])
    keys = [df["roll_no"], df["date"]]
    pres_int = df["present"].astype(int)
    df["n_obs"] = df.groupby(keys)["period"].transform("size")
    df["n_present"] = pres_int.groupby(keys).transform("sum")
    df["n_absent"] = df["absent"].astype(int).groupby(keys).transform("sum")
    df["cum_present"] = pres_int.groupby(keys).cumsum()

    day = df.drop_duplicates(["roll_no", "date"])
    q["multi_period_share"] = float((day["n_obs"] >= 2).mean()) if len(day) else 0.0
    q["full_day_absent_student_days"] = int(((day["n_present"] == 0) & (day["n_absent"] >= 1)).sum())

    if q["n_school_dates"] < cfg.min_school_dates:
        return _empty("INSUFFICIENT_DATA",
                      f"Only {q['n_school_dates']} school dates; need at least {cfg.min_school_dates} "
                      "before any tie can be trusted.", q, all_students)
    if q["multi_period_share"] < cfg.min_multi_period_share:
        return _empty("PERIOD_DATA_REQUIRED",
                      "Most student-days have a single observed period, so a bunk cannot be told apart from "
                      "a full-day absence. Upload the merged day register (all periods) or all teachers' registers.",
                      q, all_students)

    # 5) late arrivals: absent for the first few periods, present afterwards
    lead = df["cum_present"] == 0
    n_lead = lead.groupby(keys).transform("sum")
    late = lead & df["absent"] & (n_lead <= cfg.late_arrival_max_periods) & (df["n_present"] >= 1)
    if cfg.treat_late_arrival_as_bunk:
        late = pd.Series(False, index=df.index)
    df["late_arrival"] = late
    q["late_arrival_rows"] = int(late.sum())

    # 6) the two row-level flags
    on_campus = df["n_present"] >= 1                       # full-day absences are not bunks and not eligible
    df["exp_row"] = on_campus & ~df["excused"] & ~df["late_arrival"]
    df["bunk_row"] = df["exp_row"] & df["absent"]

    sel = pd.Series(True, index=df.index)
    if subject:
        sel &= df["subject_code"].astype(str).str.upper().eq(str(subject).upper())
    if periods:
        sel &= df["period"].isin(list(periods))
    if weekdays is not None:
        sel &= df["date"].dt.weekday.isin(list(weekdays))
    if date_from is not None:
        sel &= df["date"] >= pd.Timestamp(date_from)
    if date_to is not None:
        sel &= df["date"] <= pd.Timestamp(date_to)
    q["filtered"] = bool(not sel.all())
    dff = df[sel]
    agg = (dff.groupby(["roll_no", "date", "block"], sort=False)
              .agg(elig=("exp_row", "any"), bunk=("bunk_row", "any")).reset_index())
    agg = agg[agg["elig"]]

    # 7) class-wide skip events are excluded (and reported, because they are information in themselves)
    cell_tot = agg.groupby(["date", "block"]).agg(n_elig=("elig", "sum"), n_bunk=("bunk", "sum")).reset_index()
    cell_tot["rate"] = cell_tot["n_bunk"] / cell_tot["n_elig"]
    cell_tot["mass"] = (cell_tot["n_elig"] >= cfg.mass_cell_min_students) & (cell_tot["rate"] >= cfg.mass_cell_threshold)
    mass = cell_tot[cell_tot["mass"]][["date", "block", "n_elig", "n_bunk", "rate"]].reset_index(drop=True)
    q["mass_cells"] = int(len(mass))
    agg = agg.merge(cell_tot[["date", "block", "mass"]], on=["date", "block"])
    agg = agg[~agg["mass"]].drop(columns="mass")
    if agg.empty:
        return _empty("INSUFFICIENT_DATA", "No eligible cells remain after exclusions and filters.", q, all_students)

    # 8) dense arrays
    cells = (agg[["date", "block"]].drop_duplicates().sort_values(["date", "block"]).reset_index(drop=True))
    cells["weekday"] = cells["date"].dt.weekday
    cells["date_idx"] = (cells["date"] - cells["date"].min()).dt.days
    chunk = (cells["date_idx"] // (7 * cfg.time_chunk_weeks)) if cfg.time_chunk_weeks else 0
    cells["stratum"] = pd.factorize(chunk * 100 + cells["weekday"] * 10 + cells["block"])[0]
    cells["cell_idx"] = np.arange(len(cells))
    agg = agg.merge(cells[["date", "block", "cell_idx"]], on=["date", "block"])
    sidx = pd.Index(all_students).get_indexer(agg["roll_no"])
    E = np.zeros((len(all_students), len(cells)), bool)
    Y = np.zeros_like(E)
    E[sidx, agg["cell_idx"].to_numpy()] = True
    Y[sidx, agg["cell_idx"].to_numpy()] = agg["bunk"].to_numpy()

    detail = dff[dff["bunk_row"]][["roll_no", "date", "block", "period", "subject_code"]]
    detail = detail.merge(cells[["date", "block"]], on=["date", "block"])  # drops mass cells
    q["n_cells"] = int(len(cells))
    q["eligible_cell_share"] = float(E.mean())
    return CellData("OK", "", all_students, cells, Y, E, detail.reset_index(drop=True), mass, q)
