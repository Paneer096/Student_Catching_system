"""
Makerove — Graph API Router

Serves live NetworkX social co-absence graph nodes, edges, and student dossiers.
"""
from __future__ import annotations

from typing import Any
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.graph.graph_engine import (
    build_coabsence_graph,
    get_student_dossier,
    build_hierarchical_graph,
    get_student_neighbors_subgraph,
)

router = APIRouter(prefix="/graph", tags=["Social Graph"])


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

