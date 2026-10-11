"""Strict CSV validators for every dataset. Each returns (clean_df, errors_df).
Rules: never guess, never silently drop. Every rejected row is reported with its file line number and a reason.
`errors_df` columns: line, column, message. Line numbers count the header as line 1."""
from __future__ import annotations

from typing import NamedTuple

import pandas as pd

from .statuses import normalize_statuses


class Validated(NamedTuple):
    """Every validator returns this. `clean` = accepted rows, `errors` = rejected rows with line + reason,
    `extras` = dataset-specific diagnostics (e.g. unknown status tokens for attendance)."""
    clean: pd.DataFrame
    errors: pd.DataFrame
    extras: dict

DATE_FORMATS = {"YYYY-MM-DD": "%Y-%m-%d", "DD-MM-YYYY": "%d-%m-%Y", "DD/MM/YYYY": "%d/%m/%Y", "MM/DD/YYYY": "%m/%d/%Y"}
ERR_COLS = ["line", "column", "message"]

COLUMN_SYNONYMS = {  # used by the UI's column-mapping step
    "roll_no": ["roll_no", "roll no", "rollno", "roll", "reg no", "regno", "registration number", "enrollment no", "enrolment no", "prn"],
    "date": ["date", "attendance date", "class date"],
    "period": ["period", "slot", "lecture", "lecture no", "hour"],
    "subject_code": ["subject_code", "subject code", "course code", "subject", "course"],
    "status": ["status", "attendance", "present/absent", "mark", "att"],
    "section_code": ["section_code", "section", "division", "div", "class"],
    "name": ["name", "student name", "full name"],
}


def suggest_column_map(headers: list, wanted: list) -> dict:
    """Best-effort header -> canonical column suggestion. The UI shows it and the user confirms; it is never applied silently."""
    norm = {h: str(h).strip().lower().replace("_", " ") for h in headers}
    out = {}
    for w in wanted:
        for h, n in norm.items():
            if n in [s.replace("_", " ") for s in COLUMN_SYNONYMS.get(w, [w])]:
                out[w] = h
                break
    return out


def _errors(rows):
    return pd.DataFrame(rows, columns=ERR_COLS)


def _missing(df, cols):
    return [c for c in cols if c not in df.columns]


def _dates(series: pd.Series, fmt: str, column: str, errs: list, required=True):
    parsed = pd.to_datetime(series.astype("string").str.strip(), format=DATE_FORMATS[fmt], errors="coerce")
    bad = parsed.isna() & (series.notna() & (series.astype("string").str.strip() != "") if not required else True)
    for i in series.index[bad]:
        errs.append((int(i) + 2, column, f"'{series[i]}' is not a valid date in format {fmt}"))
    return parsed


def _rolls(series, known, errs, column="roll_no"):
    r = series.astype("string").str.strip().str.upper()
    for i in r.index[r.isna() | (r == "")]:
        errs.append((int(i) + 2, column, "roll number is empty"))
    if known is not None:
        unk = ~r.isin(known) & r.notna() & (r != "")
        for i in r.index[unk]:
            errs.append((int(i) + 2, column, f"roll number '{r[i]}' is not in the student roster"))
    return r


def _finish(df, errs, keep_cols):
    errors = _errors(errs)
    bad_lines = set(errors["line"]) if len(errors) else set()
    ok = df[[(int(i) + 2) not in bad_lines for i in df.index]]
    return Validated(ok[keep_cols].reset_index(drop=True), errors, {})


def validate_attendance(df, date_format="YYYY-MM-DD", status_map=None, known_rolls=None, max_period=12):
    need = ["date", "roll_no", "period", "subject_code", "status"]
    m = _missing(df, need)
    if m:
        raise ValueError(f"missing required columns: {m}")
    errs: list = []
    d = df.copy()
    d["date"] = _dates(d["date"], date_format, "date", errs)
    d["roll_no"] = _rolls(d["roll_no"], known_rolls, errs)
    per = pd.to_numeric(d["period"], errors="coerce")
    for i in d.index[per.isna() | (per < 1) | (per > max_period) | (per % 1 != 0)]:
        errs.append((int(i) + 2, "period", f"'{d.at[i, 'period']}' is not an integer from 1 to {max_period}"))
    d["period"] = per
    canon, unknown = normalize_statuses(d["status"], status_map)
    for i in d.index[canon.isna()]:
        errs.append((int(i) + 2, "status", f"unrecognised status '{d.at[i, 'status']}' (map it in the import screen)"))
    d["status"] = canon
    d["subject_code"] = d["subject_code"].astype("string").str.strip().str.upper()
    # conflicting duplicates are errors; identical duplicates are collapsed
    key = ["roll_no", "date", "period"]
    clean_rows = d.dropna(subset=["date", "period", "status"])
    conflict = clean_rows.groupby(key)["status"].transform("nunique") > 1
    for i in clean_rows.index[conflict]:
        errs.append((int(i) + 2, "status", "same student/date/period appears with different statuses in this file"))
    ok, errors, _ = _finish(d, errs, ["date", "roll_no", "period", "subject_code", "status"])
    ok["period"] = ok["period"].astype(int)
    ok = ok.drop_duplicates(key).reset_index(drop=True)
    return Validated(ok, errors, {"unknown_status_tokens": unknown})


def validate_roster(df, known_sections=None):
    m = _missing(df, ["roll_no", "name", "section_code"])
    if m:
        raise ValueError(f"missing required columns: {m}")
    errs: list = []
    d = df.copy()
    d["roll_no"] = _rolls(d["roll_no"], None, errs)
    d["section_code"] = d["section_code"].astype("string").str.strip().str.upper()
    for i in d.index[d["name"].isna() | (d["name"].astype("string").str.strip() == "")]:
        errs.append((int(i) + 2, "name", "name is empty"))
    for i in d.index[d["section_code"].isna() | (d["section_code"] == "")]:
        errs.append((int(i) + 2, "section_code", "section_code is empty"))
    if known_sections is not None:
        for i in d.index[~d["section_code"].isin(known_sections)]:
            errs.append((int(i) + 2, "section_code", f"section '{d.at[i, 'section_code']}' does not exist; create it first, it is never auto-created"))
    dup = d.duplicated("roll_no", keep=False) & d.groupby("roll_no")["section_code"].transform("nunique").gt(1)
    for i in d.index[dup]:
        errs.append((int(i) + 2, "roll_no", "roll number appears in more than one section"))
    for c in ("branch", "year", "batch_code"):
        if c not in d:
            d[c] = pd.NA
    ok, errors, _ = _finish(d, errs, ["roll_no", "name", "section_code", "branch", "year", "batch_code"])
    return Validated(ok.drop_duplicates("roll_no").reset_index(drop=True), errors, {})


EVENT_TYPES = {"CANCELLED", "TEACHER_ABSENT", "SUBSTITUTE", "TEST", "ASSIGNMENT_DUE", "COLLEGE_EVENT"}


def validate_session_events(df, date_format="YYYY-MM-DD"):
    m = _missing(df, ["date", "event_type"])
    if m:
        raise ValueError(f"missing required columns: {m}")
    errs: list = []
    d = df.copy()
    d["date"] = _dates(d["date"], date_format, "date", errs)
    d["event_type"] = d["event_type"].astype("string").str.strip().str.upper()
    for i in d.index[~d["event_type"].isin(EVENT_TYPES)]:
        errs.append((int(i) + 2, "event_type", f"must be one of {sorted(EVENT_TYPES)}"))
    for c in ("period", "section_code", "note"):
        if c not in d:
            d[c] = pd.NA
    per = pd.to_numeric(d["period"], errors="coerce")
    for i in d.index[d["period"].notna() & per.isna()]:
        errs.append((int(i) + 2, "period", "period must be a number or blank (blank = all periods)"))
    d["period"] = per
    return _finish(d, errs, ["date", "period", "section_code", "event_type", "note"])


def validate_leaves(df, date_format="YYYY-MM-DD", known_rolls=None):
    m = _missing(df, ["roll_no", "from_date", "to_date", "leave_type"])
    if m:
        raise ValueError(f"missing required columns: {m}")
    errs: list = []
    d = df.copy()
    d["roll_no"] = _rolls(d["roll_no"], known_rolls, errs)
    d["from_date"] = _dates(d["from_date"], date_format, "from_date", errs)
    d["to_date"] = _dates(d["to_date"], date_format, "to_date", errs)
    d["leave_type"] = d["leave_type"].astype("string").str.strip().str.upper()
    for i in d.index[~d["leave_type"].isin(["MEDICAL", "ON_DUTY", "APPROVED_PERSONAL"])]:
        errs.append((int(i) + 2, "leave_type", "must be MEDICAL, ON_DUTY or APPROVED_PERSONAL"))
    for i in d.index[(d["from_date"] > d["to_date"]).fillna(False)]:
        errs.append((int(i) + 2, "to_date", "to_date is before from_date"))
    return _finish(d, errs, ["roll_no", "from_date", "to_date", "leave_type"])


def _effective_dates(d, errs, date_format, a="effective_from", b="effective_to"):
    for c in (a, b):
        d[c] = _dates(d[c], date_format, c, errs, required=False) if c in d else pd.NaT
    for i in d.index[(d[a] > d[b]).fillna(False)]:
        errs.append((int(i) + 2, b, f"{b} is before {a}"))


def validate_seating(df, date_format="YYYY-MM-DD", known_rolls=None):
    m = _missing(df, ["roll_no", "bench_id"])
    if m:
        raise ValueError(f"missing required columns: {m}")
    errs: list = []
    d = df.copy()
    d["roll_no"] = _rolls(d["roll_no"], known_rolls, errs)
    for i in d.index[d["bench_id"].isna() | (d["bench_id"].astype("string").str.strip() == "")]:
        errs.append((int(i) + 2, "bench_id", "bench_id is empty"))
    _effective_dates(d, errs, date_format)
    keep = ["roll_no", "bench_id", "effective_from", "effective_to"]
    if "section_code" in d:
        keep.insert(1, "section_code")
    return _finish(d, errs, keep)


GROUP_TYPES = {"LAB_BATCH", "PROJECT_TEAM", "ELECTIVE", "TUTORIAL", "MENTOR_GROUP"}


def validate_groups(df, date_format="YYYY-MM-DD", known_rolls=None):
    m = _missing(df, ["roll_no", "group_type", "group_code"])
    if m:
        raise ValueError(f"missing required columns: {m}")
    errs: list = []
    d = df.copy()
    d["roll_no"] = _rolls(d["roll_no"], known_rolls, errs)
    d["group_type"] = d["group_type"].astype("string").str.strip().str.upper()
    for i in d.index[~d["group_type"].isin(GROUP_TYPES)]:
        errs.append((int(i) + 2, "group_type", f"must be one of {sorted(GROUP_TYPES)}"))
    for i in d.index[d["group_code"].isna() | (d["group_code"].astype("string").str.strip() == "")]:
        errs.append((int(i) + 2, "group_code", "group_code is empty"))
    _effective_dates(d, errs, date_format)
    return _finish(d, errs, ["roll_no", "group_type", "group_code", "effective_from", "effective_to"])


def validate_transport(df, known_rolls=None):
    m = _missing(df, ["roll_no", "mode"])
    if m:
        raise ValueError(f"missing required columns: {m}")
    errs: list = []
    d = df.copy()
    d["roll_no"] = _rolls(d["roll_no"], known_rolls, errs)
    d["mode"] = d["mode"].astype("string").str.strip().str.upper()
    if "route_or_block" not in d:
        d["route_or_block"] = pd.NA
    for i in d.index[~d["mode"].isin(["BUS", "HOSTEL", "OWN"])]:
        errs.append((int(i) + 2, "mode", "must be BUS, HOSTEL or OWN"))
    for i in d.index[d["mode"].isin(["BUS", "HOSTEL"]) & d["route_or_block"].isna()]:
        errs.append((int(i) + 2, "route_or_block", "required for BUS and HOSTEL"))
    return _finish(d, errs, ["roll_no", "mode", "route_or_block"])


def validate_clubs(df, date_format="YYYY-MM-DD", known_rolls=None):
    m = _missing(df, ["roll_no", "club_name"])
    if m:
        raise ValueError(f"missing required columns: {m}")
    errs: list = []
    d = df.copy()
    d["roll_no"] = _rolls(d["roll_no"], known_rolls, errs)
    for i in d.index[d["club_name"].isna() | (d["club_name"].astype("string").str.strip() == "")]:
        errs.append((int(i) + 2, "club_name", "club_name is empty"))
    _effective_dates(d, errs, date_format, "from_date", "to_date")
    for c in ("role",):
        if c not in d:
            d[c] = pd.NA
    return _finish(d, errs, ["roll_no", "club_name", "role", "from_date", "to_date"])


def validate_peer_survey(df, date_format="YYYY-MM-DD", known_rolls=None, max_nominations=5):
    m = _missing(df, ["respondent_roll_no", "nominee_roll_no", "relation", "survey_date", "consent"])
    if m:
        raise ValueError(f"missing required columns: {m}")
    errs: list = []
    d = df.copy()
    d["respondent_roll_no"] = _rolls(d["respondent_roll_no"], known_rolls, errs, "respondent_roll_no")
    d["nominee_roll_no"] = _rolls(d["nominee_roll_no"], known_rolls, errs, "nominee_roll_no")
    d["relation"] = d["relation"].astype("string").str.strip().str.upper()
    d["survey_date"] = _dates(d["survey_date"], date_format, "survey_date", errs)
    cons = d["consent"].astype("string").str.strip().str.upper()
    for i in d.index[~cons.isin(["Y", "YES", "TRUE", "1"])]:
        errs.append((int(i) + 2, "consent", "no consent recorded; row rejected and never stored"))
    for i in d.index[~d["relation"].isin(["FRIEND", "STUDY_PARTNER"])]:
        errs.append((int(i) + 2, "relation", "must be FRIEND or STUDY_PARTNER"))
    for i in d.index[d["respondent_roll_no"] == d["nominee_roll_no"]]:
        errs.append((int(i) + 2, "nominee_roll_no", "a student cannot nominate themselves"))
    rank = d.groupby(["respondent_roll_no", "relation"]).cumcount()
    for i in d.index[rank >= max_nominations]:
        errs.append((int(i) + 2, "nominee_roll_no", f"more than {max_nominations} nominations for this relation"))
    return _finish(d, errs, ["respondent_roll_no", "nominee_roll_no", "relation", "survey_date", "consent"])


def register_sanity(att: pd.DataFrame, section_strength: int) -> dict:
    """Catch registers that only list absentees or only some students (both break bunk detection)."""
    per = att.groupby(["date", "period", "subject_code"]).agg(rows=("status", "size"),
                                                              absent_share=("status", lambda s: (s == "ABSENT").mean()))
    low_cov = float((per["rows"] / max(section_strength, 1) < 0.8).mean())
    mostly_abs = float((per["absent_share"] >= 0.9).mean())
    warnings = []
    if mostly_abs > 0.3:
        warnings.append("Most sessions are >=90% ABSENT: this looks like an absentees-only list. Upload the full register.")
    if low_cov > 0.3:
        warnings.append("Over 30% of sessions cover fewer than 80% of the section: some students may be missing from the register.")
    return dict(sessions=int(len(per)), low_coverage_share=low_cov, mostly_absent_share=mostly_abs, warnings=warnings)
