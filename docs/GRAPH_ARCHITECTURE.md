# Makerov Knowledge Graph Architecture

## 1. Executive Summary & Problem Context

The Makerov Classroom Intelligence Platform visualizes complex relational networks among students, teachers, clubs, and academic sections. Previously, all entities and relationships were rendered simultaneously in an unconstrained, flat force-directed layout. With 60+ students, 300+ friendships, bunking ties, and club memberships, this caused a classic **"hairball" visualization failure**:
- Nodes overlapped uncontrollably.
- Hundreds of multi-type edges crossed at random angles.
- High-risk students were visually indistinguishable from stable peers.
- Teachers and administrators were unable to derive actionable behavioral insights.

To solve this, the knowledge graph was completely re-architected into a **Deterministic Layered Hierarchical Knowledge Graph** incorporating:
1. **Progressive Disclosure (4 Semantic Layers)**
2. **Deterministic Community Clustering via NetworkX Louvain (`seed=42`)**
3. **Semantic Zoom & Adaptive Label Density**
4. **Curved Edge Routing & Inter-Cluster Edge Aggregation**
5. **Interactive Radial Drill-Down & Contextual Dossier Inspection**

---

## 2. Multi-Layer Progressive Disclosure Model

Instead of dumping all nodes onto the canvas, the visualization strictly enforces progressive disclosure through four hierarchical layers:

```
┌────────────────────────────────────────────────────────┐
│  Layer 0: Institution Overview                         │
│  College Node -> Section Nodes (CS-3B, CS-3A, etc.)    │
└───────────────────────────┬────────────────────────────┘
                            │ (Click Section / Drill Down)
                            ▼
┌────────────────────────────────────────────────────────┐
│  Layer 1: Section Landing (Default)                    │
│  Section Center Node + Louvain Friend Circles (5-6)    │
│  + Teachers & Clubs (Outer Orbit)                      │
│  *Students collapsed into clusters to eliminate clutter*│
└───────────────────────────┬────────────────────────────┘
                            │ (Click Cluster / Drill Down)
                            ▼
┌────────────────────────────────────────────────────────┐
│  Layer 2: Cluster Level                                │
│  Centroid + Radial Orbital Ring of Member Students     │
│  Centrality ordering (anchor student at 12 o'clock)    │
└───────────────────────────┬────────────────────────────┘
                            │ (Click Student / Deep Focus)
                            ▼
┌────────────────────────────────────────────────────────┐
│  Layer 3: Student Deep Dive                            │
│  Focal Student Highlighted (Glow Halo)                 │
│  Direct 1-hop & 2-hop Neighbors Highlighted            │
│  Rest of Canvas dimmed to 15% opacity                  │
│  Right-hand Student Intelligence Dossier Activated    │
└────────────────────────────────────────────────────────┘
```

### Layer Details

| Layer | Primary Focus | Visible Nodes | Default Visible Edges |
|---|---|---|---|
| **Layer 0: Institution** | Multi-class institutional health | Institution centroid + Section nodes | Institutional hierarchy |
| **Layer 1: Section (Default)** | Classroom social fabric & cluster risks | Section centroid + 5-6 Louvain Cluster centroids + Teachers + Clubs | Hierarchical links + Aggregated Cross-Cluster bundled ties |
| **Layer 2: Cluster** | Intra-circle social dynamics | Selected Cluster centroid + 8-15 member students in radial orbit | Cluster membership + Inter-member friendship/bunk edges |
| **Layer 3: Student Focus** | Individual behavioral telemetry | Target student + direct peer neighbors | Typed semantic edges (`FRIENDS_WITH`, `BUNKS_WITH`, `STUDIES_WITH`) |

---

## 3. NetworkX Louvain Community Detection Algorithm

Intra-classroom peer groupings are computed dynamically using the Louvain modularity optimization algorithm implemented in NetworkX (`networkx.algorithms.community.louvain_communities`).

### Edge Weighting Matrix
To accurately separate true peer cliques from superficial interactions, relational ties are weighted:
- **`BUNKS_WITH` (Weight: 3.0)**: Joint attendance evasion demonstrates strong behavioral alignment.
- **`FRIENDS_WITH` (Weight: 2.0)**: Direct peer survey nominations and reciprocal social connections.
- **`STUDIES_WITH` (Weight: 1.0)**: Academic collaboration or study partnership.

### Community Metrics Computation
For every discovered community $C$:
- **Member Count**: Total students assigned to $C$.
- **Average Attendance**: $\frac{1}{|C|}\sum_{s \in C} \text{attendance}(s)$.
- **Community Risk Category**:
  - `High Risk`: Avg attendance $< 75\%$ OR $\ge 2$ delinquent students.
  - `Moderate Risk`: Avg attendance $75\% - 82\%$ OR $\ge 1$ delinquent student.
  - `Low Risk`: Avg attendance $> 82\%$.
- **Anchor Student (Influencer)**: The member exhibiting the highest betweenness centrality or degree centrality within the cluster subgraph, placed prominently at the 12 o'clock position in the radial layout.

Determinism is guaranteed across all backend workers by passing `seed=42`.

---

## 4. Edge Aggregation & Curved Bezier Routing

One of the largest contributors to visual chaos was hundreds of parallel straight lines connecting individual students across different clusters.

### Aggregation Pipeline
When viewing the Section level (Layer 1):
1. All individual student-to-student edges between Cluster $A$ and Cluster $B$ are collapsed into a single **`AGGREGATE_CROSS_CLUSTER`** edge.
2. The bundled edge stroke width scales logarithmically with tie count:
   $$\text{strokeWidth} = \min(6, 1.5 + \ln(\text{count}))$$
3. An interactive badge is rendered at the curve midpoint displaying `"{count} ties"` (e.g. `8 ties`).
4. Clicking the aggregation badge highlights both connected clusters and expands inter-cluster relationship analysis.

### Quadratic Bezier Curve Geometry
To prevent overlapping parallel edges between the same two nodes (or bidirectional ties), edges are rendered as SVG `<path d="M sx sy Q cx cy tx ty" />` curves:
$$\text{midX} = \frac{x_1 + x_2}{2}, \quad \text{midY} = \frac{y_1 + y_2}{2}$$
$$\text{dx} = x_2 - x_1, \quad \text{dy} = y_2 - y_1, \quad L = \sqrt{\text{dx}^2 + \text{dy}^2}$$
$$\text{cx} = \text{midX} - \frac{\text{dy}}{L} \cdot \text{curvatureOffset}, \quad \text{cy} = \text{midY} + \frac{\text{dx}}{L} \cdot \text{curvatureOffset}$$

### Semantic Edge Color Palette
| Edge Type | Color Token | Hex Code | Visual Style |
|---|---|---|---|
| `HIERARCHICAL` | Slate Muted | `#64748b` | Thin solid line with subtle arrow |
| `BUNKS_WITH` | Crimson Rose | `#f43f5e` | Dasharray `5 3`, high contrast |
| `FRIENDS_WITH` | Emerald Green | `#10b981` | Solid 1.8px line |
| `STUDIES_WITH` | Cyan / Sky | `#06b6d4` | Dotarray `3 2` |
| `TAGGED_AS` | Amber / Warning | `#f59e0b` | Dotted line with tag badge |
| `INTERVENED_ON`| Purple Accent | `#a855f7` | Solid 2px line with marker |
| `AGGREGATE` | Dark Slate | `#94a3b8` | Curved bundle with count pill |

---

## 5. Semantic Zoom Thresholds & Density Management

The graph viewport implements continuous semantic zoom ($0.2\times$ to $2.8\times$) that dynamically regulates rendering fidelity and label clutter:

```
0.2x ──── 0.45x ────────── 0.85x ───────────── 1.4x ─────── 2.8x
 │         │                │                   │           │
 └─────────┴────────────────┴───────────────────┴───────────┘
  Far View    Section View      Cluster View      Micro View
  (Icons)     (Cluster Names)   (+ Student Initials) (+ Full Dossier)
```

- **Level 1 (0% - 35% Zoom - Far View)**:
  - Cluster and Section nodes render with high contrast fill.
  - Labels are suppressed except for Section centroids.
  - Edge weights and badges are simplified.
- **Level 2 (35% - 75% Zoom - Section & Cluster View)**:
  - Cluster names and student count tags appear (`"Core Academics · 12 members"`).
  - Risk indicators (red/amber warning dots) become visible on nodes.
  - Aggregation badges render with tie counts.
- **Level 3 (75% - 130% Zoom - Student Orbit View)**:
  - Student initials render inside circular nodes.
  - Student names render below nodes.
  - Edge type markers and directional arrowheads appear.
- **Level 4 (130%+ Zoom - Deep Focus View)**:
  - Full student details (Roll Number, Attendance %, Risk Classification) render.
  - Hover micro-cards and detailed tooltips activate with sub-pixel alignment.

---

## 6. Layout Algorithms (`useHierarchicalLayout`)

The layout hook provides 4 selectable algorithmic arrangements:

1. **Hierarchical (Default)**:
   - Section node anchored at center $(W/2, H/2 - 40)$.
   - Louvain clusters arranged in a semi-circular arch below and around the anchor.
   - Teachers and Clubs arranged in balanced upper-left and upper-right orbits.
   - Expanded students distributed in an equidistant radial circle around their parent cluster centroid.
2. **Radial Orbit**:
   - Concentric orbital rings radiating outward from the Section center.
   - Ring 1: Louvain Clusters.
   - Ring 2: Student Members.
   - Ring 3: Extracurriculars & Teachers.
3. **Force Directed**:
   - Seeded using cluster centroids with velocity damping and repulsive electrostatic charge, freezing on user request (`Freeze / Reheat` toolbar toggle).
4. **Circular**:
   - Perimeter distribution ideal for topological community boundary inspection.

---

## 7. Backend API Specification

All endpoints are hosted under `/api/v1/graph/` in `app/api/routers/graph.py` and query SQLite database models (`Student`, `ClassroomSection`, `AttendanceRecord`, `PeerSurveyResponse`, `ExtracurricularMembership`, `ObservationEntry`).

### 1. `GET /api/v1/graph/hierarchy`
Returns full hierarchical graph structure for a section.
- **Query Params**: `section` (string, e.g. `CS-3B`)
- **Response**:
```json
{
  "section": {
    "id": "CS-3B",
    "name": "Section CS-3B",
    "student_count": 60,
    "avg_attendance": 81.2
  },
  "clusters": [
    {
      "id": "cluster_0",
      "name": "Front Benches (High Performers)",
      "member_count": 12,
      "avg_attendance": 92.4,
      "risk_level": "low",
      "anchor_student_id": "21CSB001",
      "members": [ ... ]
    }
  ],
  "teachers": [ ... ],
  "clubs": [ ... ],
  "edges": [ ... ],
  "aggregate_edges": [
    {
      "source": "cluster_0",
      "target": "cluster_1",
      "count": 7,
      "weight": 14.0,
      "label": "7 cross-ties"
    }
  ]
}
```

### 2. `GET /api/v1/graph/clusters/{section}`
Returns Louvain community partition summary without heavy member telemetry.

### 3. `GET /api/v1/graph/student/{roll_no}/neighbors`
Fetches 1-hop and 2-hop ego subgraph for a student.
- **Query Params**:
  - `depth`: `1` or `2` (default: `1`)
  - `edge_types`: comma-separated filter (`FRIENDS_WITH,BUNKS_WITH`)
- **Response**: `{ focal_student, neighbors, edges }`

### 4. `GET /api/v1/graph/aggregate-edges`
Computes inter-cluster cross-bundle ties for the specified section.

---

## 8. Verification & Performance Benchmarks

- **Node Budget**: 60 students, 6 clusters, 3 teachers, 4 clubs (73 nodes total).
- **Edge Budget**: In default view, only 6 hierarchical edges + 10 aggregate edges are rendered (16 total edges drawn, reducing canvas overhead by **94%** compared to the 300+ edge hairball).
- **Render Performance**: SVG DOM rendering maintains steady 60 FPS during pan, zoom, and cluster expansion.
- **Deterministic Louvain**: Community clustering produces identical groupings on server restart (`seed=42`).
