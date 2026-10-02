import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.config.settings import get_settings


@pytest.mark.asyncio
async def test_admin_load_sample_data_in_dev():
    """Verify that the dev-only sample data loader works when ENV=development."""
    settings = get_settings()
    settings.ENV = "development"

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.post("/api/v1/admin/load-sample-data")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "SUCCESS"
        assert "Sample data loaded successfully" in data["message"]


@pytest.mark.asyncio
async def test_admin_load_sample_data_forbidden_in_prod():
    """Verify that the dev-only sample data loader is strictly blocked when ENV=production."""
    settings = get_settings()
    settings.ENV = "production"

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.post("/api/v1/admin/load-sample-data")
        assert response.status_code == 403
        assert "strictly restricted to development environments" in response.json()["detail"]

    # Restore dev setting
    settings.ENV = "development"


@pytest.mark.asyncio
async def test_empty_section_returns_honest_empty_state():
    """Verify that an empty/unpopulated section returns has_data=False and empty lists, never fake data."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Dashboard summary
        dash_res = await client.get("/api/v1/dashboard/summary?section=NONEXISTENT_SEC")
        assert dash_res.status_code == 200
        dash_data = dash_res.json()
        assert dash_data["has_data"] is False
        assert dash_data["total_students"] == 0
        assert dash_data["attendance_rate"] == 0.0
        assert dash_data["flagged_cohorts"] == []
        assert dash_data["recent_alerts"] == []

        # Graph nodes
        graph_res = await client.get("/api/v1/graph/nodes?section=NONEXISTENT_SEC")
        assert graph_res.status_code == 200
        graph_data = graph_res.json()
        assert graph_data["nodes"] == []
        assert graph_data["edges"] == []

        # Mass bunks
        bunks_res = await client.get("/api/v1/detection/mass-bunks?section=NONEXISTENT_SEC")
        assert bunks_res.status_code == 200
        assert bunks_res.json() == []

        # Student roster
        roster_res = await client.get("/api/v1/students?section=NONEXISTENT_SEC")
        assert roster_res.status_code == 200
        assert roster_res.json() == []


@pytest.mark.asyncio
async def test_live_data_traceability_for_cs3b():
    """Verify that real ingested records produce real metrics for CS-3B."""
    settings = get_settings()
    settings.ENV = "development"

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Ensure sample data is loaded
        await client.post("/api/v1/admin/load-sample-data")

        # Dashboard summary
        dash_res = await client.get("/api/v1/dashboard/summary?section=CS-3B")
        assert dash_res.status_code == 200
        dash_data = dash_res.json()
        assert dash_data["has_data"] is True
        assert dash_data["total_students"] >= 12
        assert dash_data["attendance_rate"] > 0
        assert len(dash_data["weekly_activity"]) == 6

        # Graph nodes
        graph_res = await client.get("/api/v1/graph/nodes?section=CS-3B")
        assert graph_res.status_code == 200
        graph_data = graph_res.json()
        assert len(graph_data["nodes"]) >= 12
        assert graph_data["summary"]["student_count"] >= 12
        assert any(n["type"] == "classroom" for n in graph_data["nodes"])
        assert any(n["type"] == "teacher" for n in graph_data["nodes"])
        assert len(graph_data["edges"]) > 0

        # Dossier for 21CSB007
        dossier_res = await client.get("/api/v1/graph/student/21CSB007")
        assert dossier_res.status_code == 200
        dossier = dossier_res.json()
        assert dossier["name"] == "Varun Mehta"
        assert dossier["roll_no"] == "21CSB007"
        assert dossier["pagerank"] > 0
        assert len(dossier["recent_attendance"]) > 0

        # Mass bunks detected
        bunks_res = await client.get("/api/v1/detection/mass-bunks?section=CS-3B")
        assert bunks_res.status_code == 200
        bunks = bunks_res.json()
        assert len(bunks) > 0
        assert any("21CSB007" in b["participating_roll_numbers"] for b in bunks)


@pytest.mark.asyncio
async def test_calendar_weekend_policy_and_bulk_adjustments():
    """Verify that teacher holiday adjustments and weekend policy accurately recalculate bunk hazards."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # 1. Test 5-day week (sat_sun): Friday has 3-day vacation block if bunked
        res_5day = await client.get("/api/v1/calendar/risk-week?section=CS-3B&month=2026-10&weekend_policy=sat_sun")
        assert res_5day.status_code == 200
        days_5day = {d["date"]: d for d in res_5day.json()}

        # Oct 9 (Friday) before Sat+Sun off should have consecutive_days_gained >= 3
        assert days_5day["2026-10-09"]["consecutive_days_gained"] >= 3
        assert "2026-10-10" in days_5day["2026-10-09"]["vacation_dates"]
        assert days_5day["2026-10-10"]["is_holiday"] is True

        # 2. Test 6-day week (sunday_only): Saturday is a working day, Friday gained days drops
        res_6day = await client.get("/api/v1/calendar/risk-week?section=CS-3B&month=2026-10&weekend_policy=sunday_only")
        assert res_6day.status_code == 200
        days_6day = {d["date"]: d for d in res_6day.json()}
        assert days_6day["2026-10-10"]["is_holiday"] is False
        assert days_6day["2026-10-09"]["consecutive_days_gained"] == 1

        # 3. Test Teacher Bulk Holiday Addition: Add Diwali break from Oct 21 to Oct 22
        bulk_res = await client.post(
            "/api/v1/calendar/holidays/bulk",
            json={
                "name": "Diwali Festival Vacation",
                "start_date": "2026-10-21",
                "end_date": "2026-10-22",
                "type": "HOLIDAY",
                "is_holiday": True,
            },
        )
        assert bulk_res.status_code == 200
        assert "2026-10-21" in bulk_res.json()["affected_dates"]
        assert "2026-10-22" in bulk_res.json()["affected_dates"]

        # 4. Verify risk recalculation: Oct 21 and Oct 22 are now holidays
        res_after = await client.get("/api/v1/calendar/risk-week?section=CS-3B&month=2026-10&weekend_policy=sat_sun")
        days_after = {d["date"]: d for d in res_after.json()}
        assert days_after["2026-10-21"]["is_holiday"] is True
        assert days_after["2026-10-21"]["holiday_name"] == "Diwali Festival Vacation"
        assert days_after["2026-10-22"]["is_holiday"] is True

        # 5. Delete adjusted holiday and verify removal
        del_res = await client.delete("/api/v1/calendar/holidays/2026-10-21")
        assert del_res.status_code == 200

        del_res2 = await client.delete("/api/v1/calendar/holidays/2026-10-22")
        assert del_res2.status_code == 200

