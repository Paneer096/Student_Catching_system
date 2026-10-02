"""
Makerove — Hash-Chained Audit Log (G10)

Every read of a student-level record and every write is appended to a
hash-chained audit table. The chain is tamper-evident: modifying any row
breaks the hash link.

`/admin/audit/verify` validates the entire chain.
"""
from __future__ import annotations

import hashlib
import json
from datetime import datetime, timezone

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.orm import AuditLog


GENESIS_HASH = "0" * 64  # The first entry's prev_hash


def _compute_hash(
    seq: int,
    ts: str,
    actor_id: str,
    action: str,
    entity_type: str,
    entity_id: str,
    purpose: str,
    detail_json: str | None,
    prev_hash: str,
) -> str:
    """
    Compute SHA-256 hash for an audit log entry.
    The hash covers all fields including the previous hash, forming a chain.
    """
    payload = json.dumps(
        {
            "seq": seq,
            "ts": ts,
            "actor_id": actor_id,
            "action": action,
            "entity_type": entity_type,
            "entity_id": entity_id,
            "purpose": purpose,
            "detail_json": detail_json,
            "prev_hash": prev_hash,
        },
        sort_keys=True,
        separators=(",", ":"),
    )
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


async def append_audit_entry(
    db: AsyncSession,
    actor_id: str,
    action: str,
    entity_type: str,
    entity_id: str,
    purpose: str,
    detail: dict | None = None,
) -> AuditLog:
    """
    Append a new entry to the hash-chained audit log.

    Args:
        db: Async database session
        actor_id: UUID of the user performing the action (never a name)
        action: AuditAction enum value
        entity_type: Type of entity (e.g. "student", "group_absence_event")
        entity_id: UUID of the entity being accessed/modified
        purpose: Stated purpose of the action
        detail: Optional JSON-serializable dict with additional context

    Returns:
        The newly created AuditLog entry
    """
    # Get the latest entry's hash (or genesis)
    result = await db.execute(
        select(AuditLog.hash).order_by(AuditLog.seq.desc()).limit(1)
    )
    latest = result.scalar_one_or_none()
    prev_hash = latest if latest else GENESIS_HASH

    # Get next seq
    result = await db.execute(select(func.max(AuditLog.seq)))
    max_seq = result.scalar_one_or_none()
    next_seq = (max_seq or 0) + 1

    now = datetime.now(timezone.utc)
    ts_str = now.isoformat()
    detail_str = json.dumps(detail, sort_keys=True) if detail else None

    entry_hash = _compute_hash(
        seq=next_seq,
        ts=ts_str,
        actor_id=actor_id,
        action=action,
        entity_type=entity_type,
        entity_id=entity_id,
        purpose=purpose,
        detail_json=detail_str,
        prev_hash=prev_hash,
    )

    entry = AuditLog(
        seq=next_seq,
        ts=now,
        actor_id=actor_id,
        action=action,
        entity_type=entity_type,
        entity_id=entity_id,
        purpose=purpose,
        detail_json=detail if detail else None,
        prev_hash=prev_hash,
        hash=entry_hash,
    )
    db.add(entry)
    await db.flush()
    return entry


async def verify_audit_chain(db: AsyncSession) -> dict:
    """
    Verify the integrity of the entire audit log hash chain.

    Returns:
        {
            "valid": bool,
            "total_entries": int,
            "first_broken_seq": int | None,
            "message": str
        }
    """
    result = await db.execute(
        select(AuditLog).order_by(AuditLog.seq.asc())
    )
    entries = result.scalars().all()

    if not entries:
        return {
            "valid": True,
            "total_entries": 0,
            "first_broken_seq": None,
            "message": "Audit log is empty — no entries to verify.",
        }

    expected_prev_hash = GENESIS_HASH

    for entry in entries:
        # Verify prev_hash links to previous entry
        if entry.prev_hash != expected_prev_hash:
            return {
                "valid": False,
                "total_entries": len(entries),
                "first_broken_seq": entry.seq,
                "message": f"Chain broken at seq {entry.seq}: expected prev_hash {expected_prev_hash[:16]}..., got {entry.prev_hash[:16]}...",
            }

        # Recompute hash and verify
        detail_str = json.dumps(entry.detail_json, sort_keys=True) if entry.detail_json else None
        ts_str = entry.ts.isoformat() if hasattr(entry.ts, "isoformat") else str(entry.ts)

        recomputed = _compute_hash(
            seq=entry.seq,
            ts=ts_str,
            actor_id=entry.actor_id,
            action=entry.action,
            entity_type=entry.entity_type,
            entity_id=entry.entity_id,
            purpose=entry.purpose,
            detail_json=detail_str,
            prev_hash=entry.prev_hash,
        )

        if recomputed != entry.hash:
            return {
                "valid": False,
                "total_entries": len(entries),
                "first_broken_seq": entry.seq,
                "message": f"Hash mismatch at seq {entry.seq}: entry may have been tampered with.",
            }

        expected_prev_hash = entry.hash

    return {
        "valid": True,
        "total_entries": len(entries),
        "first_broken_seq": None,
        "message": f"All {len(entries)} audit log entries verified — chain is intact.",
    }
