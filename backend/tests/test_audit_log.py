"""
Makerove — Test Audit Log Hash Chain (G10 Guardrail)
"""
import pytest
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.orm import AuditLog
from app.security.audit_log import append_audit_entry, verify_audit_chain


@pytest.mark.asyncio
async def test_audit_log_chain_validity(db_session: AsyncSession):
    """Test that consecutive append operations form a valid SHA-256 chain."""
    entry1 = await append_audit_entry(
        db_session,
        actor_id="usr-teacher-1",
        action="VIEW_DOSSIER",
        entity_type="student",
        entity_id="stu-001",
        purpose="Educational support",
    )

    entry2 = await append_audit_entry(
        db_session,
        actor_id="usr-teacher-1",
        action="REVEAL_IDENTITY",
        entity_type="student",
        entity_id="stu-001",
        purpose="Intervention planning",
    )

    assert entry1.hash is not None
    assert entry2.prev_hash == entry1.hash

    # Verify chain
    verification = await verify_audit_chain(db_session)
    assert verification["valid"] is True
    assert verification["first_broken_seq"] is None
    assert verification["total_entries"] == 2


@pytest.mark.asyncio
async def test_audit_log_tamper_detection(db_session: AsyncSession):
    """Test that tampering with any audit entry breaks the cryptographic chain."""
    entry1 = await append_audit_entry(
        db_session,
        actor_id="usr-teacher-1",
        action="VIEW_DOSSIER",
        entity_type="student",
        entity_id="stu-001",
        purpose="Educational support",
    )

    entry2 = await append_audit_entry(
        db_session,
        actor_id="usr-teacher-1",
        action="REVEAL_IDENTITY",
        entity_type="student",
        entity_id="stu-001",
        purpose="Intervention planning",
    )

    # Tamper with entry1's payload without updating hash
    entry1.action = "UNAUTHORIZED_ACTION"
    await db_session.commit()

    # Verification must fail and detect the tampered block
    verification = await verify_audit_chain(db_session)
    assert verification["valid"] is False
    assert verification["first_broken_seq"] is not None
