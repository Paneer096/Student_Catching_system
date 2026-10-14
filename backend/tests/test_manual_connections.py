"""
Tests for Teacher Manual Connections in the Knowledge Graph (§4, §7, G4, G10).
"""
import pytest
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.main import app
from app.models.orm import TeacherConnection, AuditLog
from app.connection.engine_service import (
    create_teacher_connection,
    load_teacher_connections,
    delete_teacher_connection,
)
from makarov_engine.payload import build_graph_payload
from makarov_engine.engine import EngineResult
import pandas as pd


@pytest.mark.asyncio
async def test_teacher_connection_service(db_session: AsyncSession):
    # 1. Create a manual connection
    conn = await create_teacher_connection(
        db=db_session,
        section_code="CS-3B",
        student_a="21CSB007",
        student_b="21CSB014",
        connection_type="STUDIES_WITH",
        weight=1.5,
        notes="Observed working together on algorithms project",
        created_by="Prof. Sharma",
    )
    assert conn.id is not None
    assert conn.student_a == "21CSB007"
    assert conn.student_b == "21CSB014"
    assert conn.connection_type == "STUDIES_WITH"
    assert conn.weight == 1.5

    # 2. Canonical sorting (if inverted, student_a and student_b are ordered)
    conn2 = await create_teacher_connection(
        db=db_session,
        section_code="CS-3B",
        student_a="21CSB014",
        student_b="21CSB007",
        connection_type="STUDIES_WITH",
        weight=2.0,
        notes="Updated note",
        created_by="Prof. Sharma",
    )
    # Same connection updated
    assert conn2.id == conn.id
    assert conn2.weight == 2.0
    assert conn2.notes == "Updated note"

    # 3. Load connections
    all_conns = await load_teacher_connections(db_session, "CS-3B")
    assert len(all_conns) == 1
    assert all_conns[0].id == conn.id

    # 4. Delete connection
    deleted = await delete_teacher_connection(db_session, conn.id, "CS-3B")
    assert deleted is True

    after_conns = await load_teacher_connections(db_session, "CS-3B")
    assert len(after_conns) == 0


def test_build_graph_payload_with_manual_connection():
    # Empty engine result
    res = EngineResult(
        status="OK",
        message="Graph computed successfully",
        edges=pd.DataFrame(),
        tested=pd.DataFrame(),
        groups=[],
        pairs_only=[],
        nodes=pd.DataFrame(columns=["roll_no", "bunk_rate", "bunk_cells", "eligible_cells", "n_ties", "group_id"]),
        quality={"n_students": 2, "n_edges": 0},
        params_hash="hash123",
    )

    manual = [
        {
            "id": "mc-1",
            "student_a": "21CSB001",
            "student_b": "21CSB002",
            "connection_type": "PROJECT_TEAM",
            "weight": 1.2,
            "notes": "Robotics lab group",
            "created_by": "Dr. Anita",
        }
    ]

    payload = build_graph_payload(
        res,
        names={"21CSB001": "Aarav", "21CSB002": "Bhavna"},
        manual_connections=manual,
    )

    assert len(payload["edges"]) == 1
    edge = payload["edges"][0]
    assert edge["id"] == "21CSB001|21CSB002|PROJECT_TEAM"
    assert edge["type"] == "PROJECT_TEAM"
    assert edge["is_manual"] is True
    assert edge["source_type"] == "TEACHER_MANUAL"
    assert edge["notes"] == "Robotics lab group"
    assert edge["created_by"] == "Dr. Anita"

    # Nodes for both students should be present
    assert len(payload["nodes"]) == 2
    rolls = {n["roll_no"] for n in payload["nodes"]}
    assert "21CSB001" in rolls
    assert "21CSB002" in rolls


@pytest.mark.asyncio
async def test_manual_connection_api_endpoints():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # 1. Create a manual connection
        res = await client.post(
            "/api/sections/CS-3B/manual-connections",
            json={
                "student_a": "21CSB007",
                "student_b": "21CSB014",
                "connection_type": "STUDIES_WITH",
                "weight": 1.5,
                "notes": "Peer programming partners in AI lab",
            },
            headers={"X-User": "Prof. Raghav"},
        )
        assert res.status_code == 200, res.text
        data = res.json()
        assert data["student_a"] == "21CSB007"
        assert data["student_b"] == "21CSB014"
        assert data["connection_type"] == "STUDIES_WITH"
        conn_id = data["id"]

        # 2. List manual connections
        list_res = await client.get("/api/sections/CS-3B/manual-connections")
        assert list_res.status_code == 200
        items = list_res.json()
        assert any(i["id"] == conn_id for i in items)

        # 3. Check graph incorporates the edge
        graph_res = await client.get("/api/sections/CS-3B/bunk-graph")
        assert graph_res.status_code == 200
        graph_data = graph_res.json()
        edge_ids = [e["id"] for e in graph_data.get("edges", [])]
        assert any("21CSB007|21CSB014" in eid for eid in edge_ids)

        # 4. Delete manual connection
        del_res = await client.delete(f"/api/sections/CS-3B/manual-connections/{conn_id}")
        assert del_res.status_code == 200
        del_data = del_res.json()
        assert del_data["deleted"] is True

        # 5. Verify immutable audit log records
        from app.db import async_session_factory
        async with async_session_factory() as db:
            logs = await db.execute(
                select(AuditLog).where(
                    AuditLog.action.in_(["CREATE_MANUAL_CONNECTION", "DELETE_MANUAL_CONNECTION"])
                )
            )
            actions = [l.action for l in logs.scalars().all()]
            assert "CREATE_MANUAL_CONNECTION" in actions
            assert "DELETE_MANUAL_CONNECTION" in actions


