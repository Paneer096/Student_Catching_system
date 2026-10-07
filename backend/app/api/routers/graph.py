"""
Makerove — Graph API Router

Serves live NetworkX social co-absence graph nodes, edges, and student dossiers.
"""
from __future__ import annotations

from typing import Any
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.graph.bunk_network import build_cytoscape_bunk_graph
from app.graph.statistical_derivation import derive_skips_with_edges
from app.graph.graph_engine import (
    build_coabsence_graph,
    get_student_dossier,
    build_hierarchical_graph,
    get_student_neighbors_subgraph,
)

router = APIRouter(prefix="/graph", tags=["Social Graph"])


@router.get("/bunk-network")
async def get_bunk_network(
    section: str = Query(default="CS-3B", description="Section code"),
    overlays: str | None = Query(default=None, description="Comma-separated overlays: friends,observations,interventions"),
    subject: str | None = Query(default=None, description="Subject code filter"),
    period: int | None = Query(default=None, description="Period filter"),
    weekday: int | None = Query(default=None, description="Weekday filter (0=Mon, 6=Sun)"),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    """
    Returns spec-compliant Cytoscape.js bunk network graph (§7):
    - Statistically validated SKIPS_WITH edges (§5.1)
    - Compound container clusters (Louvain communities)
    - Node visual encodings (30d bunk rate)
    - Isolated students list for sidebar
    - Plain-language statistical evidence
    """
    overlay_list = [o.strip() for o in overlays.split(",")] if overlays else None
    return await build_cytoscape_bunk_graph(
        db,
        section_code=section,
        subject_code=subject,
        period=period,
        weekday=weekday,
        overlays=overlay_list,
    )


@router.get("/evidence/{roll_a}/{roll_b}")
async def get_pair_evidence(
    roll_a: str,
    roll_b: str,
    section: str = Query(default="CS-3B", description="Section code"),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    """
    Returns plain-language statistical proof and co-bunk session IDs between two students (§7 Evidence drawer).
    """
    res = await derive_skips_with_edges(db, section_code=section)
    for edge in res.get("edges", []):
        if (edge["source"] == roll_a and edge["target"] == roll_b) or (edge["source"] == roll_b and edge["target"] == roll_a):
            return {
                "student_a": roll_a,
                "student_b": roll_b,
                "plain_language": edge["plain_language"],
                "lift": edge["props"]["lift"],
                "expected": edge["props"]["expected"],
                "co_bunk_count": edge["evidence_count"],
                "p_value": edge["p_value"],
                "q_value": edge["q_value"],
                "jaccard": edge["weight"],
                "sessions": edge["evidence"],
            }
    return {
        "student_a": roll_a,
        "student_b": roll_b,
        "plain_language": "No statistically significant co-bunking edge found between these students.",
        "co_bunk_count": 0,
        "sessions": [],
    }


@router.get("/hierarchy")
async def get_graph_hierarchy(
    section: str = Query(default="CS-3B", description="Section code"),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    """
    Returns precomputed hierarchical tree per specification:
    {institution, section, clusters, teachers, clubs, subjects, edges, aggregate_edges}
    """
    return await build_hierarchical_graph(db, section)


@router.get("/clusters/{section}")
async def get_graph_clusters(
    section: str,
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    """
    Returns Louvain cluster community assignments and statistics for a given section.
    """
    res = await build_hierarchical_graph(db, section)
    return {
        "section": res["section"],
        "clusters": res["clusters"],
        "summary": res["summary"],
    }


@router.get("/student/{roll_no}/neighbors")
async def get_student_neighbors(
    roll_no: str,
    depth: int = Query(default=2, ge=1, le=3),
    edge_types: str | None = Query(default=None, description="Comma-separated edge types"),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    """
    Returns targeted radial subgraph centered on a student filtered by edge types.
    """
    types_list = [t.strip() for t in edge_types.split(",")] if edge_types else None
    subgraph = await get_student_neighbors_subgraph(db, roll_no, depth=depth, edge_types=types_list)
    if not subgraph:
        raise HTTPException(status_code=404, detail=f"Student with roll number '{roll_no}' not found.")
    return subgraph


@router.get("/aggregate-edges")
async def get_graph_aggregate_edges(
    section: str = Query(default="CS-3B", description="Section code"),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    """
    Returns aggregated cross-cluster connection edges with weights.
    """
    res = await build_hierarchical_graph(db, section)
    return {
        "section": res["section"],
        "aggregate_edges": res["aggregate_edges"],
    }


@router.get("/nodes")
async def get_graph_nodes(
    section: str = Query(default="CS-3B", description="Section code"),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    """
    Legacy backward-compatible endpoint for flat/coabsence graph nodes and edges.
    """
    if not isinstance(section, str):
        section = "CS-3B"
    return await build_coabsence_graph(db, section)


@router.get("/student/{roll_no}")
async def get_student_profile(
    roll_no: str,
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    """
    Get comprehensive, traceable student profile dossier.
    """
    profile = await get_student_dossier(db, roll_no)
    if not profile:
        raise HTTPException(status_code=404, detail=f"Student with roll number '{roll_no}' not found.")
    return profile

