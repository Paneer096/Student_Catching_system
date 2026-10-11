"""
Integration tests for Makarov Connection Engine v3 pipeline per §7 and Deliverables.
Tests schema, dry-run, commit, bunk-graph derivation, evidence, dismissal, shuffle-control, and 501 placeholders.
"""
from __future__ import annotations

import io
import json
import pytest
from fastapi.testclient import TestClient

from app.main import app
from makarov_engine.synthetic import make_register


@pytest.fixture(scope="module")
def client():
    return TestClient(app)


def test_get_ingest_datasets(client):
    res = client.get("/api/ingest/datasets")
    assert res.status_code == 200
    datasets = res.json()
    assert len(datasets) == 11
    names = {d["dataset"] for d in datasets}
    assert "attendance" in names
    assert "roster" in names
    assert "peer_survey" in names


def test_get_template_csv(client):
    res = client.get("/api/ingest/attendance/template.csv")
    assert res.status_code == 200
    assert "date,roll_no,period,subject_code,status" in res.text


def test_ingestion_and_graph_pipeline(client):
    # 1. Generate test attendance with planted bunk groups
    att_df, truth = make_register(seed=40, groups=[(0, 1, 2, 3), (10, 11, 12)])
    buf = io.StringIO()
    att_df.to_csv(buf, index=False)
    csv_bytes = buf.getvalue().encode("utf-8")

    # 2. Dry run
    files = {"file": ("test_attendance.csv", csv_bytes, "text/csv")}
    data = {
        "mapping": json.dumps({"date": "date", "roll_no": "roll_no", "period": "period", "subject_code": "subject_code", "status": "status"}),
        "date_format": "YYYY-MM-DD",
    }
    dry_res = client.post("/api/ingest/attendance/dry-run", files=files, data=data)
    assert dry_res.status_code == 200
    dry_body = dry_res.json()
    assert dry_body["accepted"] == len(att_df)
    assert dry_body["rejected"] == 0
    dry_run_id = dry_body["dry_run_id"]

    # 3. Commit
    commit_res = client.post("/api/ingest/attendance/commit", json={"dry_run_id": dry_run_id})
    assert commit_res.status_code == 200
    commit_body = commit_res.json()
    assert commit_body["status"] == "ACCEPTED"
    assert "batch_id" in commit_body

    # 4. Ingest batches list
    batches_res = client.get("/api/ingest/batches")
    assert batches_res.status_code == 200
    batches = batches_res.json()
    assert len(batches) > 0

    # 5. Get bunk graph
    graph_res = client.get("/api/sections/CS-3B/bunk-graph?sensitivity=strict")
    assert graph_res.status_code == 200
    graph = graph_res.json()
    assert graph["status"] == "OK"
    assert len(graph["nodes"]) > 0
    assert len(graph["edges"]) > 0
    assert len(graph["groups"]) >= 2

    # 6. Get pair evidence
    first_edge = graph["edges"][0]
    sa, sb = first_edge["student_a"], first_edge["student_b"]
    ev_res = client.get(f"/api/sections/CS-3B/pairs/{sa}/{sb}/evidence")
    assert ev_res.status_code == 200
    ev = ev_res.json()
    assert "plain_language" in ev
    assert "sessions" in ev
    assert ev["student_a"] == sa
    assert ev["student_b"] == sb

    # 7. Dismiss pair
    dismiss_res = client.post(
        f"/api/sections/CS-3B/pairs/{sa}/{sb}/dismiss",
        json={"reason": "Approved lab research assignment"},
    )
    assert dismiss_res.status_code == 200
    assert dismiss_res.json()["dismissed"] is True

    # 8. Shuffle control diagnostic
    diag_res = client.get("/api/sections/CS-3B/diagnostics/shuffle-control?n_runs=5")
    assert diag_res.status_code == 200
    job_id = diag_res.json()["job_id"]
    job_res = client.get(f"/api/jobs/{job_id}")
    assert job_res.status_code == 200


def test_ui_placeholders_return_501(client):
    assert client.get("/api/sections/CS-3B/graph-screen").status_code == 501
    assert client.get("/api/ingest/screen").status_code == 501
