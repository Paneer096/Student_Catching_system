"""
Makerove — Graph API Router

Serves live NetworkX social co-absence graph nodes, edges, and student dossiers.
"""
from __future__ import annotations

from typing import Any
import networkx as nx
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
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

# In-memory storage for user-injected nodes & edges
_dynamic_nodes: list[dict[str, Any]] = []
_dynamic_edges: list[dict[str, Any]] = []


class CreateNodeRequest(BaseModel):
    id: str
    label: str
    type: str
    community: int | None = None
    pagerank: float | None = None
    properties: dict[str, Any] = Field(default_factory=dict)


class CreateEdgeRequest(BaseModel):
    source: str
    target: str
    type: str
    weight: float = 1.0
    timestamp: str | None = None
    properties: dict[str, Any] = Field(default_factory=dict)



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


# ══════════════════════════════════════════════════════════════════════════════
# Interactive Knowledge Graph Service Endpoints (Prompt 3 Specifications)
# ══════════════════════════════════════════════════════════════════════════════

async def _build_knowledge_nx_graph(
    db: AsyncSession,
    section: str = "CS-3B",
    min_weight: int = 3,
    validated_only: bool = False,
) -> tuple[nx.Graph, list[dict], list[dict]]:
    """Helper to assemble a unified NetworkX Graph from database + dynamic injections."""
    co_graph = await build_coabsence_graph(db, section, min_weight=min_weight)
    G = nx.Graph()

    type_mapping = {
        "classroom": "Classroom",
        "teacher": "Faculty",
        "cr": "Student",
        "anchor": "Student",
        "bridge": "Student",
        "associate": "Student",
        "student": "Student",
    }

    nodes_out: list[dict[str, Any]] = []
    edges_out: list[dict[str, Any]] = []
    node_id_set: set[str] = set()

    for n in co_graph.get("nodes", []):
        nid = str(n.get("id", ""))
        if not nid:
            continue
        node_id_set.add(nid)
        ntype = type_mapping.get(n.get("type", "student"), "Student")
        label = n.get("name") or n.get("roll_no") or nid
        G.add_node(nid, label=label, type=ntype, raw=n)

    for e in co_graph.get("edges", []):
        src = str(e.get("source", ""))
        tgt = str(e.get("target", ""))
        if src in node_id_set and tgt in node_id_set:
            is_val = e.get("is_validated", False)
            if validated_only and e.get("type") == "coabsence" and not is_val:
                continue
            w = float(e.get("weight", 1.0))
            etype = "BUNKS_WITH" if e.get("type") == "coabsence" else "SUPERVISES"
            G.add_edge(src, tgt, weight=w, type=etype, is_validated=is_val, lift=e.get("lift"))

    # Incorporate dynamic user-created nodes & edges
    for dn in _dynamic_nodes:
        nid = str(dn["id"])
        node_id_set.add(nid)
        G.add_node(nid, label=dn.get("label", nid), type=dn.get("type", "Custom"), raw=dn)

    for de in _dynamic_edges:
        src = str(de["source"])
        tgt = str(de["target"])
        if src in node_id_set and tgt in node_id_set:
            G.add_edge(src, tgt, weight=float(de.get("weight", 1.0)), type=de.get("type", "CONNECTED_TO"))

    # Compute graph metrics
    if len(G) > 0:
        deg_dict = dict(G.degree())
        try:
            pr_dict = nx.pagerank(G, weight="weight")
        except Exception:
            pr_dict = {n: 1.0 / len(G) for n in G.nodes}

        # Louvain Community detection
        community_map: dict[str, int] = {}
        try:
            communities = nx.community.louvain_communities(G, weight="weight", seed=42)
            for idx, c_set in enumerate(communities):
                for nid in c_set:
                    community_map[nid] = idx + 1
        except Exception:
            community_map = {n: 1 for n in G.nodes}
    else:
        deg_dict, pr_dict, community_map = {}, {}, {}

    # Format nodes
    for nid in G.nodes:
        node_attrs = G.nodes[nid]
        raw = node_attrs.get("raw", {})
        props = raw.get("properties") or {
            "attendance_pct": raw.get("attendance_pct"),
            "role": raw.get("role"),
            "cohort": raw.get("cohort"),
            "delinquency": raw.get("delinquency_label"),
            "absences": raw.get("absences"),
        }
        nodes_out.append({
            "id": nid,
            "label": node_attrs.get("label", nid),
            "type": node_attrs.get("type", "Student"),
            "community": community_map.get(nid, 1),
            "pagerank": round(pr_dict.get(nid, 0.0), 4),
            "degree": deg_dict.get(nid, 0),
            "properties": {k: v for k, v in props.items() if v is not None},
        })

    # Format edges
    for u, v, data in G.edges(data=True):
        edges_out.append({
            "source": u,
            "target": v,
            "type": data.get("type", "CONNECTED_TO"),
            "weight": round(data.get("weight", 1.0), 2),
            "is_validated": data.get("is_validated", False),
            "lift": data.get("lift"),
            "timestamp": "2026-10-08T00:00:00Z",
            "properties": {
                "weight": data.get("weight", 1.0),
                "is_validated": data.get("is_validated", False),
                "lift": data.get("lift"),
            },
        })

    return G, nodes_out, edges_out


@router.get("/data")
async def get_knowledge_graph_data(
    section: str = Query(default="CS-3B", description="Section code"),
    min_weight: int = Query(default=3, ge=1, le=20, description="Minimum mutual absences threshold"),
    validated_only: bool = Query(default=False, description="Filter to statistically validated ties only"),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    """
    Returns complete Knowledge Graph network {nodes, edges} including:
    - Degree Centrality
    - PageRank score
    - Louvain Community detection cluster IDs
    - Multi-entity relational data
    """
    _, nodes, edges = await _build_knowledge_nx_graph(
        db, section, min_weight=min_weight, validated_only=validated_only
    )
    return {
        "nodes": nodes,
        "edges": edges,
        "summary": {
            "node_count": len(nodes),
            "edge_count": len(edges),
            "section": section,
            "min_weight": min_weight,
            "validated_only": validated_only,
            "status": "ONLINE",
        },
    }


@router.get("/shortest-path")
async def get_knowledge_graph_shortest_path(
    source: str = Query(..., description="Source node ID"),
    target: str = Query(..., description="Target node ID"),
    section: str = Query(default="CS-3B", description="Section code"),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    """
    Returns shortest path { nodes: [ids], edges: [...] } between source and target node.
    """
    G, _, _ = await _build_knowledge_nx_graph(db, section)
    if source not in G:
        raise HTTPException(status_code=404, detail=f"Source node '{source}' not found in graph.")
    if target not in G:
        raise HTTPException(status_code=404, detail=f"Target node '{target}' not found in graph.")

    try:
        path = nx.shortest_path(G, source=source, target=target, weight=None)
        path_edges = []
        for i in range(len(path) - 1):
            u, v = path[i], path[i + 1]
            edge_data = G.get_edge_data(u, v) or {}
            path_edges.append({
                "source": u,
                "target": v,
                "type": edge_data.get("type", "CONNECTED_TO"),
                "weight": edge_data.get("weight", 1.0),
            })
        return {
            "source": source,
            "target": target,
            "found": True,
            "nodes": path,
            "edges": path_edges,
            "length": len(path) - 1,
        }
    except nx.NetworkXNoPath:
        return {
            "source": source,
            "target": target,
            "found": False,
            "nodes": [],
            "edges": [],
            "length": 0,
            "message": "No connecting path exists between these entities.",
        }


@router.get("/subgraph")
async def get_knowledge_graph_subgraph(
    node_id: str = Query(..., description="Root node ID"),
    depth: int = Query(default=1, ge=1, le=4, description="Hop depth for ego network"),
    section: str = Query(default="CS-3B", description="Section code"),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    """
    Returns k-hop ego network subgraph around a specific node.
    """
    G, all_nodes, all_edges = await _build_knowledge_nx_graph(db, section)
    if node_id not in G:
        raise HTTPException(status_code=404, detail=f"Node '{node_id}' not found in graph.")

    ego_sub = nx.ego_graph(G, node_id, radius=depth)
    ego_nodes = set(ego_sub.nodes)

    sub_nodes = [n for n in all_nodes if n["id"] in ego_nodes]
    sub_edges = [
        e for e in all_edges
        if e["source"] in ego_nodes and e["target"] in ego_nodes
    ]

    return {
        "root_node_id": node_id,
        "depth": depth,
        "nodes": sub_nodes,
        "edges": sub_edges,
    }


@router.post("/nodes")
async def create_knowledge_graph_node(
    payload: CreateNodeRequest,
) -> dict[str, Any]:
    """
    Dynamically injects a new node into the live Knowledge Graph.
    """
    node_entry = {
        "id": payload.id,
        "label": payload.label,
        "type": payload.type,
        "community": payload.community or 1,
        "pagerank": payload.pagerank or 0.05,
        "properties": payload.properties,
    }
    # Check duplicate
    for i, n in enumerate(_dynamic_nodes):
        if n["id"] == payload.id:
            _dynamic_nodes[i] = node_entry
            return {"status": "updated", "node": node_entry}

    _dynamic_nodes.append(node_entry)
    return {"status": "created", "node": node_entry}


@router.post("/edges")
async def create_knowledge_graph_edge(
    payload: CreateEdgeRequest,
) -> dict[str, Any]:
    """
    Dynamically injects a new edge into the live Knowledge Graph.
    """
    edge_entry = {
        "source": payload.source,
        "target": payload.target,
        "type": payload.type,
        "weight": payload.weight,
        "timestamp": payload.timestamp or "2026-10-08T00:00:00Z",
        "properties": payload.properties,
    }
    _dynamic_edges.append(edge_entry)
    return {"status": "created", "edge": edge_entry}


@router.get("/timeline")
async def get_knowledge_graph_timeline(
    start: str | None = Query(default=None, description="Start date/time ISO string"),
    end: str | None = Query(default=None, description="End date/time ISO string"),
    section: str = Query(default="CS-3B", description="Section code"),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    """
    Filter nodes and relational edges by temporal timeframe.
    """
    _, nodes, edges = await _build_knowledge_nx_graph(db, section)
    # Filter edges by timestamp if specified
    filtered_edges = edges
    if start or end:
        filtered_edges = [
            e for e in edges
            if (not start or e.get("timestamp", "") >= start) and (not end or e.get("timestamp", "") <= end)
        ]
    active_node_ids = {e["source"] for e in filtered_edges} | {e["target"] for e in filtered_edges}
    filtered_nodes = [n for n in nodes if n["id"] in active_node_ids or not (start or end)]

    return {
        "start": start,
        "end": end,
        "nodes": filtered_nodes,
        "edges": filtered_edges,
    }


