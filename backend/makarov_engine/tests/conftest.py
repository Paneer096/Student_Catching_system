import pandas as pd
import pytest

from makarov_engine.config import EngineConfig


@pytest.fixture
def loose_cfg():
    """Config for hand-built micro registers (tiny data would otherwise trip the sufficiency guards)."""
    return EngineConfig(min_school_dates=1, min_multi_period_share=0.0, mass_cell_min_students=8)


def day(roll, date, pattern, subjects=None):
    """pattern: 8-char string over P/A/L/M/O for periods 1..8 -> rows"""
    m = {"P": "PRESENT", "A": "ABSENT", "L": "LATE", "M": "MEDICAL_LEAVE", "O": "ON_DUTY"}
    return [(roll, pd.Timestamp(date), i + 1, (subjects or ["S"] * 8)[i], m[ch]) for i, ch in enumerate(pattern)]


def register(rows):
    return pd.DataFrame(rows, columns=["roll_no", "date", "period", "subject_code", "status"])
