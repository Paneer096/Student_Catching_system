import numpy as np
import pandas as pd
import pytest

from makarov_engine.cells import build_cells
from makarov_engine.config import EngineConfig
from .conftest import day, register


def cell(cd, roll, date, block):
    k = cd.cells[(cd.cells.date == pd.Timestamp(date)) & (cd.cells.block == block)]
    if k.empty:
        return None
    i, j = cd.students.index(roll), int(k.cell_idx.iloc[0])
    return bool(cd.E[i, j]), bool(cd.Y[i, j])


def test_afternoon_bunk_is_a_bunk_and_morning_is_a_normal_attended_cell(loose_cfg):
    cd = build_cells(register(day("R1", "2026-10-05", "PPPPAAAA")), loose_cfg)
    assert cell(cd, "R1", "2026-10-05", 0) == (True, False)
    assert cell(cd, "R1", "2026-10-05", 1) == (True, True)


def test_full_day_absence_is_not_a_bunk_and_is_not_eligible(loose_cfg):
    rows = day("R1", "2026-10-05", "AAAAAAAA") + day("R2", "2026-10-05", "PPPPPPPP")
    cd = build_cells(register(rows), loose_cfg)
    assert cell(cd, "R1", "2026-10-05", 0) in (None, (False, False)) and cell(cd, "R1", "2026-10-05", 1) in (None, (False, False))
    assert cd.Y[cd.students.index("R1")].sum() == 0 and cd.E[cd.students.index("R1")].sum() == 0


def test_leading_absence_up_to_two_periods_is_late_arrival_not_bunk(loose_cfg):
    cd = build_cells(register(day("R1", "2026-10-05", "AAPPPPPP")), loose_cfg)
    # the two leading absences are set aside; periods 3-4 were attended, so the morning is a normal attended cell
    assert cell(cd, "R1", "2026-10-05", 0) == (True, False)
    assert cd.Y.sum() == 0 and cd.quality["late_arrival_rows"] == 2
    cd2 = build_cells(register(day("R1", "2026-10-05", "AAPPPPPP")), EngineConfig(min_school_dates=1, min_multi_period_share=0, treat_late_arrival_as_bunk=True))
    assert cell(cd2, "R1", "2026-10-05", 0) == (True, True)


def test_three_leading_absences_exceed_late_arrival_limit(loose_cfg):
    cd = build_cells(register(day("R1", "2026-10-05", "AAAPPPPP")), loose_cfg)
    assert cell(cd, "R1", "2026-10-05", 0) == (True, True)


def test_medical_leave_status_and_leave_table_make_absence_excused(loose_cfg):
    cd = build_cells(register(day("R1", "2026-10-05", "PPPPMMMM")), loose_cfg)
    assert cell(cd, "R1", "2026-10-05", 1) in (None, (False, False)) and cd.Y.sum() == 0
    leaves = pd.DataFrame({"roll_no": ["R1"], "from_date": ["2026-10-05"], "to_date": ["2026-10-06"], "leave_type": ["ON_DUTY"]})
    cd = build_cells(register(day("R1", "2026-10-05", "PPPPAAAA")), loose_cfg, leaves=leaves)
    assert cd.Y.sum() == 0 and cd.quality["rows_excused_by_leave"] == 4


def test_cancelled_sessions_are_removed(loose_cfg):
    cancelled = pd.DataFrame({"date": ["2026-10-05"], "period": [8]})
    cd = build_cells(register(day("R1", "2026-10-05", "PPPPPPPA")), loose_cfg, cancelled=cancelled)
    assert cd.Y.sum() == 0 and cd.quality["rows_cancelled"] == 1


def test_class_wide_skip_is_excluded_and_reported(loose_cfg):
    rows = []
    for i in range(10):
        rows += day(f"R{i}", "2026-10-05", "PPPPAAAA" if i < 5 else "PPPPPPPP")   # 50% skip the afternoon
    cd = build_cells(register(rows), loose_cfg)
    assert len(cd.mass_cells) == 1 and cd.Y.sum() == 0
    assert cd.quality["mass_cells"] == 1


def test_small_group_skipping_is_not_mass(loose_cfg):
    rows = []
    for i in range(20):
        rows += day(f"R{i}", "2026-10-05", "PPPPAAAA" if i < 3 else "PPPPPPPP")
    cd = build_cells(register(rows), loose_cfg)
    assert len(cd.mass_cells) == 0 and cd.Y.sum() == 3


def test_noncanonical_status_is_refused(loose_cfg):
    df = register(day("R1", "2026-10-05", "PPPPPPPP")).assign(status="A")
    with pytest.raises(ValueError):
        build_cells(df, loose_cfg)


def test_too_little_data_is_reported_honestly():
    cd = build_cells(register(day("R1", "2026-10-05", "PPPPAAAA")), EngineConfig(min_multi_period_share=0))
    assert cd.status == "INSUFFICIENT_DATA"


def test_single_period_registers_are_refused_with_explanation():
    rows = [("R1", pd.Timestamp("2026-10-05") + pd.Timedelta(days=d), 1, "S", "PRESENT") for d in range(30)]
    cd = build_cells(register(rows), EngineConfig())
    assert cd.status == "PERIOD_DATA_REQUIRED" and "full-day absence" in cd.message


def test_subject_filter_keeps_day_level_facts_so_afternoon_bunks_survive(loose_cfg):
    """Regression for a design flaw: filtering raw rows to one subject first would turn this into a full-day absence."""
    subs = ["MA", "MA", "MA", "MA", "CS", "PHY", "CS", "CS"]
    rows = day("R1", "2026-10-05", "PPPPAAAA", subs)
    cd = build_cells(register(rows), loose_cfg, subject="PHY")
    assert cell(cd, "R1", "2026-10-05", 1) == (True, True)
    assert cell(cd, "R1", "2026-10-05", 0) is None            # no Physics session in the morning block
    assert cd.detail["period"].tolist() == [6]


def test_weekday_and_date_filters_restrict_cells(loose_cfg):
    rows = day("R1", "2026-10-05", "PPPPAAAA") + day("R1", "2026-10-09", "PPPPAAAA")   # a Monday and a Friday
    cd = build_cells(register(rows), loose_cfg, weekdays=[4])
    assert set(cd.cells.weekday) == {4}
    cd = build_cells(register(rows), loose_cfg, date_to="2026-10-06")
    assert set(cd.cells.date) == {pd.Timestamp("2026-10-05")}
