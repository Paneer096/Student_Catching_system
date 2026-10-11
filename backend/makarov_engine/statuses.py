"""Strict attendance status normalisation. Unknown tokens are REJECTED, never guessed."""
from __future__ import annotations

import pandas as pd

CANONICAL = ("PRESENT", "ABSENT", "LATE", "MEDICAL_LEAVE", "ON_DUTY")

# Deliberately NOT mapped: "L" (late or leave?), "LV", "X", "-", "". The UI must make the
# user map these explicitly; guessing silently corrupts attendance.
DEFAULT_ALIASES = {
    "P": "PRESENT", "PRES": "PRESENT", "PRESENT": "PRESENT",
    "A": "ABSENT", "AB": "ABSENT", "ABS": "ABSENT", "ABSENT": "ABSENT",
    "LATE": "LATE",
    "ML": "MEDICAL_LEAVE", "MEDICAL": "MEDICAL_LEAVE", "MEDICAL_LEAVE": "MEDICAL_LEAVE",
    "OD": "ON_DUTY", "ON_DUTY": "ON_DUTY", "ON DUTY": "ON_DUTY",
}


def normalize_statuses(raw: pd.Series, user_map: dict | None = None):
    """Return (canonical Series with NaN for unknown, DataFrame of unknown tokens with counts)."""
    mapping = dict(DEFAULT_ALIASES)
    if user_map:
        bad = {v for v in user_map.values() if v not in CANONICAL}
        if bad:
            raise ValueError(f"user_map targets must be one of {CANONICAL}; got {sorted(bad)}")
        mapping.update({str(k).strip().upper(): v for k, v in user_map.items()})
    token = raw.astype("string").str.strip().str.upper()
    canon = token.map(mapping)
    unk = token[canon.isna()].fillna("<EMPTY>").replace("", "<EMPTY>")
    unknown = unk.value_counts().rename_axis("token").reset_index(name="rows")
    return canon.astype(object).where(canon.notna(), None), unknown
