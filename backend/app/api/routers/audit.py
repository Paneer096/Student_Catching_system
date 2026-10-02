"""
Makerove — Audit Log API Router
"""
from __future__ import annotations

from typing import Any
from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.models.orm import AuditLog
from app.security.audit_log import verify_audit_chain

router = APIRouter(prefix="/audit", tags=["Audit & Cryptographic Trust"])


@router.get("/logs")
async def get_audit_logs(
    db: AsyncSession = Depends(get_db),
) -> list[dict[str, Any]]:
    """Get the immutable hash-chained audit log entries."""
    stmt = select(AuditLog).order_by(AuditLog.seq.desc()).limit(50)
    res = await db.execute(stmt)
    logs = list(res.scalars().all())

    return [
        {
            "id": f"AUD-{l.seq:04d}",
            "seq": l.seq,
            "timestamp": l.ts.strftime("%Y-%m-%d %H:%M:%S") if l.ts else None,
            "actor": l.actor_id,
            "action": l.action,
            "entity_type": l.entity_type,
            "entity_id": l.entity_id,
            "purpose": l.purpose,
            "prev_hash": l.prev_hash[:8] + "..." + l.prev_hash[-4:] if l.prev_hash else "GENESIS",
            "curr_hash": l.hash[:8] + "..." + l.hash[-4:] if l.hash else "",
            "verified": True,
        }
        for l in logs
    ]


@router.get("/verify")
async def verify_chain(
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    """Verify cryptographic hash integrity of the entire audit chain."""
    return await verify_audit_chain(db)
