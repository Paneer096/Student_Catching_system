"""
Makerove — Session Management

Signed httpOnly session cookies, CSRF double-submit, idle/absolute timeouts.
Per §3.3: No tokens in sessionStorage/localStorage.
"""
from __future__ import annotations

import secrets
from datetime import datetime, timedelta, timezone

from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.config.settings import get_settings
from app.models.orm import AuthSession as SessionModel, User


settings = get_settings()


def generate_session_id() -> str:
    """Generate a cryptographically secure session ID (256-bit)."""
    return secrets.token_hex(32)


def generate_csrf_token() -> str:
    """Generate a cryptographically secure CSRF token (256-bit)."""
    return secrets.token_hex(32)


async def create_session(
    db: AsyncSession,
    user_id: str,
    ip_address: str | None = None,
) -> SessionModel:
    """Create a new authenticated session with CSRF token."""
    now = datetime.now(timezone.utc)
    expires_at = now + timedelta(hours=settings.SESSION_ABSOLUTE_HOURS)

    session = SessionModel(
        id=generate_session_id(),
        user_id=user_id,
        csrf_token=generate_csrf_token(),
        created_at=now,
        last_activity=now,
        expires_at=expires_at,
        ip_address=ip_address,
    )
    db.add(session)
    await db.flush()
    return session


async def get_session(db: AsyncSession, session_id: str) -> SessionModel | None:
    """Retrieve a session by ID, checking expiry and idle timeout."""
    result = await db.execute(
        select(SessionModel).where(SessionModel.id == session_id)
    )
    session = result.scalar_one_or_none()
    if session is None:
        return None

    now = datetime.now(timezone.utc)

    # Check absolute expiry
    expires_at = session.expires_at
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if now > expires_at:
        await destroy_session(db, session_id)
        return None

    # Check idle timeout
    last_activity = session.last_activity
    if last_activity.tzinfo is None:
        last_activity = last_activity.replace(tzinfo=timezone.utc)
    idle_limit = last_activity + timedelta(minutes=settings.SESSION_IDLE_MINUTES)
    if now > idle_limit:
        await destroy_session(db, session_id)
        return None

    # Update last activity (touch)
    session.last_activity = now
    await db.flush()
    return session


async def destroy_session(db: AsyncSession, session_id: str) -> None:
    """Delete a session (logout)."""
    await db.execute(
        delete(SessionModel).where(SessionModel.id == session_id)
    )
    await db.flush()


async def destroy_all_user_sessions(db: AsyncSession, user_id: str) -> None:
    """Destroy all sessions for a user (force logout everywhere)."""
    await db.execute(
        delete(SessionModel).where(SessionModel.user_id == user_id)
    )
    await db.flush()


async def cleanup_expired_sessions(db: AsyncSession) -> int:
    """Remove all expired sessions. Returns count of deleted sessions."""
    now = datetime.now(timezone.utc)
    result = await db.execute(
        delete(SessionModel).where(SessionModel.expires_at < now)
    )
    await db.flush()
    return result.rowcount
