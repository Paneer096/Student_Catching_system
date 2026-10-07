"""
Makerove — RBAC (Role-Based Access Control) with Scope Injection

Per §3.3 and §4: A FastAPI dependency resolves the caller's scope
(sections/departments/student_id) and every query is filtered by it server-side.
Never rely on the frontend to hide data.
Prevent IDOR: requesting a student outside scope returns 404, not 403.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Sequence

from fastapi import Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.models.orm import (
    User,
    AuthSession as SessionModel,
    Section,
    Teacher,
    TeacherSubjectSection,
)
from app.models.enums import UserRole
from app.security.sessions import get_session
from app.config.settings import get_settings


settings = get_settings()


@dataclass
class AuthContext:
    """
    Resolved authentication and authorization context.
    Injected into every protected endpoint via the `require_auth` dependency.
    """
    user: User
    session_id: str
    csrf_token: str
    role: UserRole
    # Scope fields — what data this user can access
    section_ids: list[str] = field(default_factory=list)
    department: str | None = None
    student_id: str | None = None
    teacher_id: str | None = None


async def get_current_user(
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> AuthContext:
    """
    Core authentication dependency.
    Reads the session cookie, validates the session, resolves the user's scope.
    """
    session_id = request.cookies.get(settings.SESSION_COOKIE_NAME)
    if not session_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required",
        )

    session = await get_session(db, session_id)
    if session is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Session expired or invalid",
        )

    # Load user
    result = await db.execute(
        select(User).where(User.id == session.user_id, User.is_active == True)  # noqa: E712
    )
    user = result.scalar_one_or_none()
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found or deactivated",
        )

    role = UserRole(user.role)

    # Resolve scope based on role
    section_ids: list[str] = []
    department: str | None = None
    student_id: str | None = None
    teacher_id: str | None = user.teacher_id

    if role == UserRole.CLASS_TEACHER:
        # Class teacher sees their own section(s)
        if user.teacher_id:
            result = await db.execute(
                select(Section.id).where(Section.class_teacher_id == user.teacher_id)
            )
            section_ids = [row[0] for row in result.all()]
            # Also load department
            teacher_result = await db.execute(
                select(Teacher.department).where(Teacher.id == user.teacher_id)
            )
            dept_row = teacher_result.first()
            if dept_row:
                department = dept_row[0]

    elif role == UserRole.SUBJECT_TEACHER:
        # Subject teacher sees sections they teach
        if user.teacher_id:
            result = await db.execute(
                select(TeacherSubjectSection.section_id).where(
                    TeacherSubjectSection.teacher_id == user.teacher_id
                )
            )
            section_ids = list(set(row[0] for row in result.all()))
            teacher_result = await db.execute(
                select(Teacher.department).where(Teacher.id == user.teacher_id)
            )
            dept_row = teacher_result.first()
            if dept_row:
                department = dept_row[0]

    elif role == UserRole.HOD:
        # HOD sees all sections in their department
        if user.teacher_id:
            teacher_result = await db.execute(
                select(Teacher.department).where(Teacher.id == user.teacher_id)
            )
            dept_row = teacher_result.first()
            if dept_row:
                department = dept_row[0]
                result = await db.execute(
                    select(Section.id).where(Section.department == department)
                )
                section_ids = [row[0] for row in result.all()]

    elif role == UserRole.COUNSELOR:
        # Counselor sees students referred to them or flagged — handled per-query
        if user.teacher_id:
            teacher_result = await db.execute(
                select(Teacher.department).where(Teacher.id == user.teacher_id)
            )
            dept_row = teacher_result.first()
            if dept_row:
                department = dept_row[0]

    elif role == UserRole.ADMIN:
        # Admin sees aggregates only — section_ids deliberately empty
        # Admin endpoints handle their own data access patterns
        pass

    elif role == UserRole.STUDENT:
        # Student sees only their own data
        student_id = user.student_id

    return AuthContext(
        user=user,
        session_id=session.id,
        csrf_token=session.csrf_token,
        role=role,
        section_ids=section_ids,
        department=department,
        student_id=student_id,
        teacher_id=teacher_id,
    )


def require_roles(*allowed_roles: UserRole):
    """
    Factory for role-checking dependencies.
    Usage: `auth = Depends(require_roles(UserRole.CLASS_TEACHER, UserRole.HOD))`
    """
    async def _check(auth: AuthContext = Depends(get_current_user)) -> AuthContext:
        if auth.role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,  # 404 not 403 — prevent IDOR
                detail="Not found",
            )
        return auth
    return _check


def require_csrf(request: Request, auth: AuthContext = Depends(get_current_user)) -> AuthContext:
    """
    CSRF validation for state-changing requests (POST, PUT, PATCH, DELETE).
    Checks the X-CSRF-Token header against the session's CSRF token.
    """
    if request.method in ("POST", "PUT", "PATCH", "DELETE"):
        csrf_header = request.headers.get("X-CSRF-Token", "")
        if not csrf_header or csrf_header != auth.csrf_token:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="CSRF validation failed",
            )
    return auth


def check_section_access(auth: AuthContext, section_id: str) -> None:
    """
    Verify the user has access to the given section.
    Returns 404 (not 403) to prevent IDOR.
    """
    if auth.role == UserRole.ADMIN:
        return  # Admin can access aggregates for any section
    if auth.role == UserRole.STUDENT:
        raise HTTPException(status_code=404, detail="Not found")
    if section_id not in auth.section_ids:
        raise HTTPException(status_code=404, detail="Not found")


def check_student_access(auth: AuthContext, student_id: str) -> None:
    """
    Verify the user has access to a specific student's data.
    Students can only access their own data.
    """
    if auth.role == UserRole.STUDENT:
        if auth.student_id != student_id:
            raise HTTPException(status_code=404, detail="Not found")
