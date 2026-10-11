import pandas as pd
import pytest

from makarov_engine.statuses import normalize_statuses
from makarov_engine.validators import (validate_attendance, validate_peer_survey, validate_roster,
                                       validate_transport, suggest_column_map, register_sanity)


def test_common_register_marks_are_absent_not_present():
    canon, unknown = normalize_statuses(pd.Series(["A", "AB", "ABS", "absent", "P", "Present", "ML", "OD"]))
    assert list(canon) == ["ABSENT", "ABSENT", "ABSENT", "ABSENT", "PRESENT", "PRESENT", "MEDICAL_LEAVE", "ON_DUTY"]
    assert unknown.empty


def test_unknown_and_ambiguous_tokens_are_rejected_never_guessed():
    canon, unknown = normalize_statuses(pd.Series(["L", "X", "", "P"]))
    assert canon.tolist() == [None, None, None, "PRESENT"]
    assert set(unknown["token"]) == {"L", "X", "<EMPTY>"}


def test_user_map_resolves_ambiguous_token_and_validates_targets():
    canon, _ = normalize_statuses(pd.Series(["L"]), {"L": "LATE"})
    assert canon.tolist() == ["LATE"]
    with pytest.raises(ValueError):
        normalize_statuses(pd.Series(["L"]), {"L": "PRESENT_ISH"})


def _att(rows):
    return pd.DataFrame(rows, columns=["date", "roll_no", "period", "subject_code", "status"])


def test_attendance_rejects_with_line_numbers_and_keeps_good_rows():
    df = _att([("2026-10-01", "21CSB001", 1, "CS301", "A"),
               ("2026-10-01", "21CSB999", 1, "CS301", "P"),      # unknown roll
               ("2026-10-01", "21CSB001", 2, "CS301", "L"),      # ambiguous status
               ("01-10-2026", "21CSB001", 3, "CS301", "P"),      # wrong date format
               ("2026-10-01", "21CSB001", 9, "CS301", "P")])
    ok, err, extras = validate_attendance(df, known_rolls={"21CSB001"}, max_period=8)
    assert len(ok) == 1 and ok.iloc[0]["status"] == "ABSENT"
    assert sorted(err["line"]) == [3, 4, 5, 6]          # file lines: header is line 1
    assert set(err["column"]) == {"roll_no", "status", "date", "period"}


def test_attendance_accepts_dd_mm_yyyy_when_selected():
    ok, err, _ = validate_attendance(_att([("09-10-2026", "R1", 1, "S", "P")]), date_format="DD-MM-YYYY")
    assert err.empty and ok.iloc[0]["date"] == pd.Timestamp("2026-10-09")


def test_conflicting_duplicates_rejected_identical_collapsed():
    df = _att([("2026-10-01", "R1", 1, "S", "P"), ("2026-10-01", "R1", 1, "S", "P"),
               ("2026-10-01", "R2", 1, "S", "P"), ("2026-10-01", "R2", 1, "S", "A")])
    ok, err, _ = validate_attendance(df)
    assert len(ok) == 1 and ok.iloc[0]["roll_no"] == "R1" and len(err) == 2


def test_roster_never_autocreates_sections_and_has_no_gender_default():
    df = pd.DataFrame({"roll_no": ["R1", "R2"], "name": ["A", "B"], "section_code": ["CS-3B", "NOPE"]})
    ok, err, _ = validate_roster(df, known_sections={"CS-3B"})
    assert list(ok["roll_no"]) == ["R1"] and len(err) == 1
    assert "gender" not in ok.columns and "dob" not in ok.columns


def test_peer_survey_without_consent_is_rejected_not_stored():
    df = pd.DataFrame({"respondent_roll_no": ["R1", "R2"], "nominee_roll_no": ["R2", "R1"], "relation": ["FRIEND", "FRIEND"],
                       "survey_date": ["2026-09-01"] * 2, "consent": ["Y", "N"]})
    ok, err, _ = validate_peer_survey(df)
    assert list(ok["respondent_roll_no"]) == ["R1"] and "consent" in set(err["column"])


def test_peer_survey_caps_nominations():
    df = pd.DataFrame({"respondent_roll_no": ["R1"] * 7, "nominee_roll_no": [f"R{i}" for i in range(2, 9)],
                       "relation": ["FRIEND"] * 7, "survey_date": ["2026-09-01"] * 7, "consent": ["Y"] * 7})
    ok, err, _ = validate_peer_survey(df, max_nominations=5)
    assert len(ok) == 5 and len(err) == 2


def test_transport_requires_route_for_bus():
    ok, err, _ = validate_transport(pd.DataFrame({"roll_no": ["R1", "R2"], "mode": ["BUS", "OWN"], "route_or_block": [None, None]}))
    assert list(ok["roll_no"]) == ["R2"] and len(err) == 1


def test_column_suggestions_are_suggestions():
    assert suggest_column_map(["Reg No", "Attendance Date", "Hour", "Mark"], ["roll_no", "date", "period", "status"]) == \
        {"roll_no": "Reg No", "date": "Attendance Date", "period": "Hour", "status": "Mark"}


def test_absentee_only_register_is_flagged():
    rows = [("2026-10-01", f"R{i}", 1, "S", "ABSENT") for i in range(3)] + \
           [("2026-10-02", f"R{i}", 1, "S", "ABSENT") for i in range(3)]
    w = register_sanity(_att(rows).assign(date=lambda d: pd.to_datetime(d["date"])), section_strength=60)
    assert w["warnings"]
