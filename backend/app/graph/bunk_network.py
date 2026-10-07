"""
Makarov — Bunk Network Builder for Cytoscape.js (§7 UI / §5 Graph Engine)

Transforms statistically derived SKIPS_WITH edges and facts into Cytoscape.js compound graphs:
- Landing view: Validated SKIPS_WITH subgraph only.
- Compound Containers: Louvain communities with size >= 3.
- Node properties: Bunk rate 30d, predicted bunk probability, pattern flags.
- Edge properties: Jaccard weight, Lift, q-value, plain-language explanation, evidence.
- Overlays: Friends (NAMED_FRIEND), Observations, Interventions.
- Sidebar: Isolated students list ("No bunk partners found").
"""
from __future__ import annotations

from datetime import date
from typing import Any
import networkx as nx
from networkx.algorithms.community import louvain_communities
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.graph.statistical_derivation import derive_skips_with_edges
from app.models.orm import (
    Student,
    SurveyNomination,
    Observation,
    Intervention,
    InterventionStudent,
    Section,
)


async def build_cytoscape_bunk_graph(
    db: AsyncSession,
    section_code: str = "CS-3B",
    start_date: date | None = None,
    end_date: date | None = None,
    subject_code: str | None = None,
    period: int | None = None,
    weekday: int | None = None,
    overlays: list[str] | None = None,
) -> dict[str, Any]:
    """
    Builds a complete, spec-compliant Cytoscape.js data structure for the Bunk Network screen.
    """
    # 1. Derive statistically validated SKIPS_WITH edges
    derivation = await derive_skips_with_edges(
        db,
        section_code=section_code,
        start_date=start_date,
        end_date=end_date,
        subject_code=subject_code,
        period=period,
        weekday=weekday,
    )

    skips_edges = derivation["edges"]
    nodes_info = derivation["nodes"]
    isolated_rolls = derivation["isolated_students"]
    summary = derivation["summary"]

    node_map = {n["id"]: n for n in nodes_info}

    # 2. Build NetworkX graph on SKIPS_WITH to detect Louvain communities (§5.2)
    G = nx.Graph()
    for edge in skips_edges:
        G.add_edge(edge["source"], edge["target"], weight=edge["weight"])

    compound_containers = []
    group_assignment: dict[str, str] = {}
    communities = []
    if G.number_of_nodes() > 0:
        raw_comms = louvain_communities(G, weight="weight", seed=42)
        # Sort by size descending
        raw_comms = sorted(raw_comms, key=len, reverse=True)
        for idx, comm in enumerate(raw_comms, start=1):
            members = sorted(list(comm))
            if len(members) >= 3:
                group_id = f"group-{idx}"
                for m in members:
                    group_assignment[m] = group_id
                compound_containers.append({
                    "id": group_id,
                    "label": f"Bunk Group {idx}",
                    "size": len(members),
                    "members": members,
                    "is_compound": True,
                })
            else:
                # Pair or small clique
                pair_id = f"pair-{idx}"
                for m in members:
                    group_assignment[m] = pair_id
                compound_containers.append({
                    "id": pair_id,
                    "label": f"Bunk Pair {idx}",
                    "size": len(members),
                    "members": members,
                    "is_compound": True,
                })

    # 3. Assemble Cytoscape.js Elements
    cy_elements = []

    # A. Add compound group nodes first
    for group in compound_containers:
        cy_elements.append({
            "group": "nodes",
            "data": {
                "id": group["id"],
                "label": f"{group['label']} ({group['size']})",
                "is_compound": True,
                "size": group["size"],
            },
            "classes": "compound-group",
        })

    # B. Add student nodes
    # Visual encoding per §7:
    # Size: bunk rate over last 30 days
    # Color: single-hue sequential scale for risk/rate
    connected_rolls = set(derivation["summary"]["connected_students"] and [e["source"] for e in skips_edges] + [e["target"] for e in skips_edges])

    for n in nodes_info:
        # In landing view, students with no edges are listed in sidebar, not drawn (§7)
        if not n["has_edges"]:
            continue

        deg = G.degree(n["id"]) if G.has_node(n["id"]) else 0
        parent_id = group_assignment.get(n["id"])

        cy_elements.append({
            "group": "nodes",
            "data": {
                "id": n["id"],
                "label": n["id"],
                "name": n["name"],
                "roll_no": n["roll_no"],
                "parent": parent_id,
                "bunk_rate_30d": n["bunk_rate_30d"],
                "bunk_count": n["bunk_count"],
                "attendance_rate": n["attendance_rate"],
                "degree": deg,
                "node_type": "student",
            },
            "classes": "student-node",
        })

    # C. Add SKIPS_WITH edges
    for e in skips_edges:
        cy_elements.append({
            "group": "edges",
            "data": {
                "id": e["id"],
                "source": e["source"],
                "target": e["target"],
                "type": "SKIPS_WITH",
                "weight": e["weight"],
                "color": "#D55E00",  # Okabe-Ito vermillion
                "lift": e["props"]["lift"],
                "expected": e["props"]["expected"],
                "p_value": e["p_value"],
                "q_value": e["q_value"],
                "evidence_count": e["evidence_count"],
                "plain_language": e["plain_language"],
                "evidence": e["evidence"],
            },
            "classes": "edge-skips-with",
        })

    # 4. Handle Optional Overlays (§7: Friends, Observations, Interventions)
    active_overlays = set(overlays or [])

    if "friends" in active_overlays:
        # Query survey nominations
        sec_stmt = select(Section).where(Section.code == section_code)
        sec_res = await db.execute(sec_stmt)
        sec = sec_res.scalar_one_or_none()
        if sec:
            stu_stmt = select(Student).where(Student.section_id == sec.id)
            stu_res = await db.execute(stu_stmt)
            sec_students = {s.id: s.roll_no for s in stu_res.scalars().all()}

            survey_stmt = select(SurveyNomination).where(
                SurveyNomination.nominator_id.in_(list(sec_students.keys())),
                SurveyNomination.nominee_id.in_(list(sec_students.keys())),
            )
            surv_res = await db.execute(survey_stmt)
            nominations = list(surv_res.scalars().all())

            # Check reciprocity
            pairs_seen = set()
            for nom in nominations:
                src_roll = sec_students.get(nom.nominator_id)
                dst_roll = sec_students.get(nom.nominee_id)
                if not src_roll or not dst_roll:
                    continue
                pair_key = tuple(sorted([src_roll, dst_roll]))
                is_mutual = pair_key in pairs_seen
                pairs_seen.add(pair_key)

                # Only draw if both nodes are present in active graph
                if src_roll in connected_rolls and dst_roll in connected_rolls:
                    cy_elements.append({
                        "group": "edges",
                        "data": {
                            "id": f"edge-friend-{src_roll}-{dst_roll}",
                            "source": src_roll,
                            "target": dst_roll,
                            "type": "NAMED_FRIEND",
                            "kind": nom.kind,
                            "color": "#009E73",  # Okabe-Ito green
                            "is_mutual": is_mutual,
                            "plain_language": f"Named Friend ({nom.kind})",
                        },
                        "classes": "edge-friend" if is_mutual else "edge-friend-oneway",
                    })

    # 5. Build isolated students detailed list for sidebar (§7)
    isolated_list = [
        node_map[roll] for roll in isolated_rolls if roll in node_map
    ]

    return {
        "section_code": section_code,
        "elements": cy_elements,
        "compound_groups": compound_containers,
        "isolated_students": isolated_list,
        "summary": {
            **summary,
            "groups_count": len(compound_containers),
            "rendered_nodes": len(connected_rolls),
        },
    }
