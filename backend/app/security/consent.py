"""
Makerove — Consent Management (G14)

Versioned notice, accept, and withdraw. Consent withdrawal removes peer edges
at the next nightly run. Grievance-officer contact is configurable.
"""
from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.orm import ConsentRecord
from app.models.enums import ConsentStatus


# Current notice version — increment when notice text changes
CURRENT_NOTICE_VERSION = "1.0"

NOTICE_TEXT = """
## Makerove Data Processing Notice

**Purpose:** Makerove processes your attendance, marks, and opt-in peer survey data
to help teachers identify students who may need support and to improve the
classroom experience.

**What we collect:**
- Attendance records (provided by the institution)
- Academic marks (provided by the institution)
- Peer survey responses (only if you explicitly opt in)
- Teacher observations (neutral categories only)

**What we do NOT collect:**
- Location, biometric, WiFi, canteen, library, hostel, or bus data
- Caste, religion, or regional information

**Your rights:**
- View all data the system holds about you
- See who has accessed your data and when
- Contest or request correction of any data
- Request erasure of your data
- Withdraw consent at any time

**Peer survey participation** is a separate, voluntary opt-in.
Withdrawing consent removes your peer connections at the next processing cycle.

**Grievance Officer Contact:** [Configurable — see institution settings]

**Legal basis:** Educational activities and student safety under India's
DPDP Act 2023, Section 9 and Fourth Schedule. This is not legal advice —
the institution's legal counsel must review.
""".strip()


async def get_latest_consent(
    db: AsyncSession,
    user_id: str,
) -> ConsentRecord | None:
    """Get the user's most recent consent record."""
    result = await db.execute(
        select(ConsentRecord)
        .where(ConsentRecord.user_id == user_id)
        .order_by(ConsentRecord.recorded_at.desc())
        .limit(1)
    )
    return result.scalar_one_or_none()


async def has_accepted_current_notice(
    db: AsyncSession,
    user_id: str,
) -> bool:
    """Check if the user has accepted the current notice version."""
    consent = await get_latest_consent(db, user_id)
    if consent is None:
        return False
    return (
        consent.notice_version == CURRENT_NOTICE_VERSION
        and consent.status == ConsentStatus.ACCEPTED
    )


async def accept_notice(
    db: AsyncSession,
    user_id: str,
    purpose: str = "general",
) -> ConsentRecord:
    """Record user's acceptance of the current notice version."""
    record = ConsentRecord(
        user_id=user_id,
        notice_version=CURRENT_NOTICE_VERSION,
        status=ConsentStatus.ACCEPTED,
        purpose=purpose,
        recorded_at=datetime.now(timezone.utc),
    )
    db.add(record)
    await db.flush()
    return record


async def withdraw_consent(
    db: AsyncSession,
    user_id: str,
    purpose: str = "general",
) -> ConsentRecord:
    """
    Record consent withdrawal.
    Peer edges are removed at the next nightly run (§11 step 2).
    """
    record = ConsentRecord(
        user_id=user_id,
        notice_version=CURRENT_NOTICE_VERSION,
        status=ConsentStatus.WITHDRAWN,
        purpose=purpose,
        recorded_at=datetime.now(timezone.utc),
    )
    db.add(record)
    await db.flush()
    return record


def get_notice_info() -> dict:
    """Return the current notice version and text."""
    return {
        "version": CURRENT_NOTICE_VERSION,
        "text": NOTICE_TEXT,
    }
