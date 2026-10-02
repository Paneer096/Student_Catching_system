"""
Makerove — Auth API Router

Login, logout, password change, session info, and consent endpoints.
Rate-limited login per §3.3 with uniform error messages.
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from loguru import logger

from app.db import get_db
from app.models.orm import User, LoginAttempt
from app.models.schemas import (
    LoginRequest,
    ChangePasswordRequest,
    AuthMeResponse,
    UserResponse,
    ScopeResponse,
    ConsentNoticeResponse,
    ConsentAcceptRequest,
)
from app.security.passwords import hash_password, verify_password, needs_rehash
from app.security.sessions import create_session, destroy_session
from app.security.rbac import AuthContext, get_current_user
from app.security.audit_log import append_audit_entry
from app.security.consent import (
    get_notice_info,
    accept_notice,
    withdraw_consent,
    has_accepted_current_notice,
)
from app.config.settings import get_settings


settings = get_settings()
router = APIRouter(prefix="/auth", tags=["Authentication"])


def _get_client_ip(request: Request) -> str:
    """Extract client IP, checking X-Forwarded-For for reverse proxy setups."""
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()
    if request.client:
        return request.client.host
    return "unknown"


async def _check_rate_limit(
    db: AsyncSession, username: str, ip: str
) -> bool:
    """
    Check if login attempts exceed the rate limit.
    Returns True if the request should be blocked.
    """
    window_start = datetime.now(timezone.utc) - timedelta(minutes=1)
    result = await db.execute(
        select(func.count(LoginAttempt.id)).where(
            LoginAttempt.username == username,
            LoginAttempt.ip_address == ip,
            LoginAttempt.attempted_at >= window_start,
        )
    )
    count = result.scalar_one()
    return count >= settings.LOGIN_RATE_LIMIT_MAX


async def _record_attempt(
    db: AsyncSession, username: str, ip: str, success: bool
) -> None:
    """Record a login attempt for rate limiting."""
    attempt = LoginAttempt(
        username=username,
        ip_address=ip,
        attempted_at=datetime.now(timezone.utc),
        success=success,
    )
    db.add(attempt)
    await db.flush()


@router.post("/login")
async def login(
    request: Request,
    response: Response,
    body: LoginRequest,
    db: AsyncSession = Depends(get_db),
):
    """
    Authenticate with username and password.
    Sets httpOnly session cookie and CSRF cookie on success.
    Uniform error messages to prevent username enumeration.
    """
    ip = _get_client_ip(request)

    # Rate limit check
    if await _check_rate_limit(db, body.username, ip):
        logger.warning("Login rate limit exceeded for IP {ip}", ip=ip)
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many login attempts. Please try again later.",
        )

    # Uniform error message for both "user not found" and "wrong password"
    _auth_error = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid username or password",
    )

    # Find user
    result = await db.execute(
        select(User).where(User.username == body.username)
    )
    user = result.scalar_one_or_none()

    if user is None or not user.is_active:
        await _record_attempt(db, body.username, ip, False)
        raise _auth_error

    # Verify password
    if not verify_password(body.password, user.password_hash):
        await _record_attempt(db, body.username, ip, False)
        raise _auth_error

    # Rehash if needed (parameter upgrade)
    if needs_rehash(user.password_hash):
        user.password_hash = hash_password(body.password)
        await db.flush()

    # Record successful attempt
    await _record_attempt(db, body.username, ip, True)

    # Create session
    session = await create_session(db, user.id, ip)

    # Audit login
    await append_audit_entry(
        db, actor_id=user.id, action="login",
        entity_type="user", entity_id=user.id,
        purpose="User authentication",
    )

    # Set cookies
    response.set_cookie(
        key=settings.SESSION_COOKIE_NAME,
        value=session.id,
        httponly=True,
        samesite="lax",
        secure=False,  # Set True in production behind HTTPS
        max_age=settings.SESSION_ABSOLUTE_HOURS * 3600,
        path="/",
    )
    response.set_cookie(
        key=settings.CSRF_COOKIE_NAME,
        value=session.csrf_token,
        httponly=False,  # Frontend needs to read this
        samesite="lax",
        secure=False,
        max_age=settings.SESSION_ABSOLUTE_HOURS * 3600,
        path="/",
    )

    logger.info("User logged in (user_id={uid})", uid=user.id)

    return {
        "message": "Login successful",
        "must_change_password": user.must_change_password,
        "role": user.role,
        "csrf_token": session.csrf_token,
    }


@router.post("/logout")
async def logout(
    response: Response,
    auth: AuthContext = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Destroy the current session and clear cookies."""
    await destroy_session(db, auth.session_id)

    await append_audit_entry(
        db, actor_id=auth.user.id, action="logout",
        entity_type="user", entity_id=auth.user.id,
        purpose="User logout",
    )

    response.delete_cookie(settings.SESSION_COOKIE_NAME, path="/")
    response.delete_cookie(settings.CSRF_COOKIE_NAME, path="/")

    return {"message": "Logged out"}


@router.post("/change-password")
async def change_password(
    body: ChangePasswordRequest,
    auth: AuthContext = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Change the current user's password."""
    if not verify_password(body.current_password, auth.user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password is incorrect",
        )

    if body.current_password == body.new_password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="New password must differ from current password",
        )

    auth.user.password_hash = hash_password(body.new_password)
    auth.user.must_change_password = False
    await db.flush()

    await append_audit_entry(
        db, actor_id=auth.user.id, action="update",
        entity_type="user", entity_id=auth.user.id,
        purpose="Password change",
    )

    return {"message": "Password changed successfully"}


@router.get("/me", response_model=AuthMeResponse)
async def get_me(
    auth: AuthContext = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get current user info, scope, and consent status."""
    consent_accepted = await has_accepted_current_notice(db, auth.user.id)

    return AuthMeResponse(
        user=UserResponse(
            id=auth.user.id,
            username=auth.user.username,
            role=auth.user.role,
            must_change_password=auth.user.must_change_password,
            is_active=auth.user.is_active,
            teacher_id=auth.user.teacher_id,
            student_id=auth.user.student_id,
        ),
        csrf_token=auth.csrf_token,
        scope=ScopeResponse(
            section_ids=auth.section_ids,
            department=auth.department,
            student_id=auth.student_id,
            teacher_id=auth.teacher_id,
        ),
        consent_accepted=consent_accepted,
    )


# ─── Consent Endpoints ───────────────────────────────────────────────────────

@router.get("/consent/notice", response_model=ConsentNoticeResponse)
async def get_consent_notice(
    auth: AuthContext = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get the current consent notice and whether the user has accepted it."""
    info = get_notice_info()
    accepted = await has_accepted_current_notice(db, auth.user.id)
    return ConsentNoticeResponse(
        version=info["version"],
        text=info["text"],
        accepted=accepted,
    )


@router.post("/consent/accept")
async def accept_consent(
    body: ConsentAcceptRequest,
    auth: AuthContext = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Accept the current consent notice."""
    await accept_notice(db, auth.user.id, body.purpose)

    await append_audit_entry(
        db, actor_id=auth.user.id, action="consent_accept",
        entity_type="user", entity_id=auth.user.id,
        purpose="Consent acceptance",
    )

    return {"message": "Consent accepted", "version": get_notice_info()["version"]}


@router.post("/consent/withdraw")
async def withdraw_user_consent(
    auth: AuthContext = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Withdraw consent. Peer edges will be removed at the next nightly run.
    """
    await withdraw_consent(db, auth.user.id)

    await append_audit_entry(
        db, actor_id=auth.user.id, action="consent_withdraw",
        entity_type="user", entity_id=auth.user.id,
        purpose="Consent withdrawal — peer edges queued for removal",
    )

    return {"message": "Consent withdrawn. Peer connections will be removed at the next processing cycle."}
