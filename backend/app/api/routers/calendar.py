"""
Makerove — Calendar Risk API Router

Provides deterministic calendar risk forecasts and teacher holiday management endpoints.
Supports bulk holiday additions, date range adjustments, and college weekend policy recalculations.
"""
from __future__ import annotations

import uuid
from typing import Any
from datetime import date, timedelta
from fastapi import APIRouter, Depends, Query, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.models.orm import CalendarDay
from app.calendar_risk.engine import get_calendar_risk_schedule, calculate_calibrated_prediction

router = APIRouter(prefix="/calendar", tags=["Calendar Risk"])


class BulkHolidayRequest(BaseModel):
    name: str = Field(..., description="Holiday or event title")
    start_date: str | None = Field(None, description="Start date (YYYY-MM-DD)")
    end_date: str | None = Field(None, description="End date (inclusive YYYY-MM-DD)")
    dates: list[str] | None = Field(None, description="Explicit list of dates (YYYY-MM-DD)")
    type: str = Field(default="HOLIDAY", description="HOLIDAY, EVENT, or EXAM")
    is_holiday: bool = Field(default=True, description="Whether classes are cancelled")


@router.get("/risk-week")
async def get_calendar_risk(
    section: str = Query(default="CS-3B", description="Section code"),
    month: str = Query(default="2026-10", description="Month string YYYY-MM"),
    weekend_policy: str = Query(
        default="sat_sun",
        description="Weekend policy: 'sat_sun' (5-day week), 'sunday_only' (6-day week), 'alt_sat' (2nd/4th Sat off)",
    ),
    db: AsyncSession = Depends(get_db),
) -> list[dict[str, Any]]:
    """
    Get mathematical risk forecast for calendar days in the specified month.
    Evaluates vacation days gained, bridge hazards, and college weekend policy.
    """
    if not isinstance(section, str):
        section = "CS-3B"
    return await get_calendar_risk_schedule(db, section, month, weekend_policy)


@router.get("/events")
async def get_calendar_events(
    db: AsyncSession = Depends(get_db),
) -> list[dict[str, Any]]:
    """Get all configured calendar days."""
    stmt = select(CalendarDay).order_by(CalendarDay.date.asc())
    res = await db.execute(stmt)
    days = list(res.scalars().all())

    return [
        {
            "id": cd.id,
            "date": str(cd.date),
            "name": cd.name,
            "type": cd.type,
            "is_holiday": cd.is_holiday,
        }
        for cd in days
    ]


@router.post("/holidays/bulk")
async def add_or_update_holidays_bulk(
    payload: BulkHolidayRequest,
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    """
    Add or update holidays manually in bulk or date range.
    Saves to SQLite database and triggers risk recalculation.
    """
    target_dates: list[date] = []

    # 1. Parse date range if specified
    if payload.start_date:
        try:
            s_date = date.fromisoformat(payload.start_date)
            e_date = date.fromisoformat(payload.end_date) if payload.end_date else s_date
            if s_date > e_date:
                s_date, e_date = e_date, s_date

            curr = s_date
            while curr <= e_date:
                target_dates.append(curr)
                curr += timedelta(days=1)
        except ValueError as err:
            raise HTTPException(status_code=400, detail=f"Invalid date format: {err}")

    # 2. Add explicit dates if specified
    if payload.dates:
        for d_str in payload.dates:
            try:
                parsed_d = date.fromisoformat(d_str)
                if parsed_d not in target_dates:
                    target_dates.append(parsed_d)
            except ValueError:
                continue

    if not target_dates:
        raise HTTPException(
            status_code=400,
            detail="Must provide start_date (and optional end_date) or a non-empty list of dates.",
        )

    # 3. Upsert into calendar_days in SQLite
    updated_count = 0
    for d in target_dates:
        stmt = select(CalendarDay).where(CalendarDay.date == d)
        res = await db.execute(stmt)
        existing = res.scalar_one_or_none()

        if existing:
            existing.name = payload.name
            existing.type = payload.type
            existing.is_holiday = payload.is_holiday
        else:
            new_day = CalendarDay(
                id=str(uuid.uuid4()),
                date=d,
                name=payload.name,
                type=payload.type,
                is_holiday=payload.is_holiday,
            )
            db.add(new_day)
        updated_count += 1

    await db.commit()

    return {
        "status": "SUCCESS",
        "message": f"Successfully updated {updated_count} calendar dates as '{payload.name}'.",
        "affected_dates": [d.isoformat() for d in target_dates],
    }


@router.delete("/holidays/{date_str}")
async def delete_holiday(
    date_str: str,
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    """
    Remove a holiday or reset an academic day to standard status.
    """
    try:
        target_date = date.fromisoformat(date_str)
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Invalid date format '{date_str}'. Expected YYYY-MM-DD.")

    stmt = select(CalendarDay).where(CalendarDay.date == target_date)
    res = await db.execute(stmt)
    entry = res.scalar_one_or_none()

    if not entry:
        raise HTTPException(status_code=404, detail=f"No calendar entry found on {date_str}.")

    await db.delete(entry)
    await db.commit()

    return {
        "status": "SUCCESS",
        "message": f"Successfully removed holiday entry on {date_str}.",
        "date": date_str,
    }


@router.post("/holidays/reset-defaults")
async def reset_calendar_defaults(
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    """
    Reset academic calendar to official 2026 gazetted defaults.
    """
    default_holidays = [
        ("2026-10-02", "Gandhi Jayanti", "HOLIDAY", True),
        ("2026-10-19", "Pre-Dussehra Preparation Day", "EVENT", False),
        ("2026-10-20", "Dussehra Festival", "HOLIDAY", True),
        ("2026-10-26", "Maharishi Valmiki Jayanti", "HOLIDAY", True),
        ("2026-11-08", "Diwali Festival", "HOLIDAY", True),
        ("2026-11-09", "Govardhan Puja", "HOLIDAY", True),
        ("2026-11-24", "Guru Nanak Jayanti", "HOLIDAY", True),
        ("2026-11-25", "Midterm Examination Start", "EXAM", False),
    ]

    for dt_str, name, day_type, is_hol in default_holidays:
        dt = date.fromisoformat(dt_str)
        stmt = select(CalendarDay).where(CalendarDay.date == dt)
        res = await db.execute(stmt)
        entry = res.scalar_one_or_none()
        if entry:
            entry.name = name
            entry.type = day_type
            entry.is_holiday = is_hol
        else:
            db.add(
                CalendarDay(
                    id=str(uuid.uuid4()),
                    date=dt,
                    name=name,
                    type=day_type,
                    is_holiday=is_hol,
                )
            )

    await db.commit()
    return {
        "status": "SUCCESS",
        "message": "Reset academic calendar to 2026 official gazetted defaults.",
    }


class PredictProbabilityRequest(BaseModel):
    day_of_week: str = Field(default="Friday")
    period: int = Field(default=5, ge=1, le=8)
    subject_code: str = Field(default="CS302")
    is_lab: bool = Field(default=False)
    bridge_days_gained: int = Field(default=1, ge=0, le=10)
    is_pre_holiday: bool = Field(default=False)
    is_exam_proximity: bool = Field(default=False)
    cohort_risk_tier: str = Field(default="medium")  # "low" | "medium" | "high"
    student_roll: str | None = Field(default=None)
    section: str = Field(default="CS-3B")


@router.post("/predict-probability")
async def predict_probability(
    payload: PredictProbabilityRequest,
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    """
    Calculates exact, non-vague mathematical absence probability with SHAP-style attribution.
    """
    return calculate_calibrated_prediction(
        day_of_week=payload.day_of_week,
        period=payload.period,
        subject_code=payload.subject_code,
        is_lab=payload.is_lab,
        bridge_days_gained=payload.bridge_days_gained,
        is_pre_holiday=payload.is_pre_holiday,
        is_exam_proximity=payload.is_exam_proximity,
        cohort_risk_tier=payload.cohort_risk_tier,
    )

