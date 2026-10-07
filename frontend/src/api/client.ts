/**
 * Makerove — API Client
 * Authentic API integration: zero fake data, zero hardcoded numbers.
 * Connects directly to FastAPI backend and SQLite/NetworkX analytical engines.
 */

export interface User {
  id: string;
  username: string;
  role: 'CLASS_TEACHER' | 'SUBJECT_TEACHER' | 'HOD' | 'COUNSELOR' | 'ADMIN' | 'STUDENT';
  name: string;
  department?: string;
  section_ids?: string[];
  must_change_password?: boolean;
  consent_accepted?: boolean;
}

export interface ConsentNotice {
  version: string;
  text: string;
  accepted: boolean;
}

export interface DashboardSummary {
  total_students: number;
  attendance_rate: number;
  cohorts_count: number;
  mass_bunks_count: number;
  active_interventions: number;
  weekly_activity: Array<{
    day: string;
    day_idx?: number;
    attendance: number;
    rate?: number;
    total?: number;
    present?: number;
    bunk_count: number;
    is_peak_risk?: boolean;
  }>;
  flagged_cohorts: Array<{
    id: string;
    name: string;
    cohort_id?: string;
    size: number;
    risk: string;
    risk_level?: string;
    top_peer: string;
    anchor_roll?: string;
    anchor_name?: string;
    pattern?: string;
    risk_score?: number;
    members: string[];
  }>;
  recent_alerts: Array<{
    id: string;
    title: string;
    date?: string;
    time?: string;
    severity: 'HIGH' | 'MEDIUM' | 'LOW';
    absentees: number;
    reason?: string;
  }>;
  has_data: boolean;
}

export interface GraphNode {
  id: string;
  roll_no: string;
  name: string;
  role: string;
  type: 'classroom' | 'teacher' | 'cr' | 'anchor' | 'bridge' | 'associate' | 'student';
  level: number;
  x: number;
  y: number;
  score: number;
  attendance_pct: number;
  total_classes: number;
  absences: number;
  cohort: string;
  cohort_color?: string;
  is_delinquent?: boolean;
  delinquency_label?: string | null;
  betweenness: number;
  pagerank: number;
}

export interface GraphEdge {
  source: string;
  target: string;
  source_roll: string;
  target_roll: string;
  weight: number;
  type?: 'hierarchy' | 'coabsence';
  label?: string;
}

export interface HierarchicalStudent {
  id: string;
  roll_no: string;
  name: string;
  gender: string;
  attendance_pct: number;
  total_classes: number;
  absences: number;
  classification: 'high_concern' | 'at_risk' | 'watch' | 'good_standing' | 'dual_influence' | 'isolated';
  risk_color: string;
  risk_level: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  role: string;
  betweenness: number;
  pagerank: number;
  is_delinquent: boolean;
  clubs?: string[];
  distance?: number;
  is_ghost?: boolean;
  cluster_id?: string;
  cluster_name?: string;
}

export interface ClusterNode {
  id: string;
  cluster_idx: number;
  name: string;
  member_count: number;
  aggregate_risk: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'WATCH' | 'GOOD';
  risk_color: string;
  avg_attendance: number;
  at_risk_count: number;
  anchor_count: number;
  dominant_classification: string;
  members: HierarchicalStudent[];
}

export interface HierarchicalEdge {
  source: string;
  target: string;
  type: 'HIERARCHICAL' | 'FRIENDS_WITH' | 'BUNKS_WITH' | 'STUDIES_WITH' | 'TAGGED_AS' | 'INTERVENED_ON' | 'MEMBER_OF' | 'ATTENDS' | 'AGGREGATE_CROSS_CLUSTER';
  weight: number;
  color?: string;
  label?: string;
  count?: number;
}

export interface HierarchicalGraphData {
  institution: {
    id: string;
    name: string;
    sections: Array<{
      id: string;
      code: string;
      name: string;
      department: string;
      semester: number;
      strength: number;
    }>;
  };
  section: {
    id: string;
    code: string;
    name: string;
    department: string;
    semester: number;
    student_count: number;
    avg_attendance: number;
    class_teacher?: string;
  };
  clusters: ClusterNode[];
  teachers: Array<{
    id: string;
    name: string;
    role: string;
    department: string;
  }>;
  clubs: Array<{
    id: string;
    name: string;
    member_count: number;
  }>;
  subjects: Array<{
    code: string;
    name: string;
    credits: number;
  }>;
  edges: HierarchicalEdge[];
  aggregate_edges: HierarchicalEdge[];
  summary: {
    total_students: number;
    clusters_count: number;
    total_edges: number;
    delinquents_count: number;
  };
}

export interface StudentNeighborsSubgraph {
  target_student: HierarchicalStudent | null;
  rings: {
    center: string[];
    ring1: string[];
    ring2: string[];
  };
  nodes: HierarchicalStudent[];
  edges: HierarchicalEdge[];
}

export interface StudentDossier {
  id: string;
  roll_no: string;
  name: string;
  branch: string;
  year: number;
  section: string;
  attendance_pct: number;
  total_classes: number;
  absences: number;
  role: string;
  type?: string;
  cohort: string;
  cohort_color?: string;
  is_delinquent?: boolean;
  delinquency_label?: string | null;
  pagerank: number;
  betweenness: number;
  peers: Array<{
    roll_no: string;
    name: string;
    mutual_absences: number;
    cohort: string;
  }>;
  recent_attendance: Array<{
    date: string;
    period: number;
    subject_code: string;
    status: string;
  }>;
  classroom_info?: {
    strength: number;
    department: string;
    class_teacher: string;
  };
  teacher_info?: {
    department: string;
    sections: string[];
    subjects: string[];
  };
}

export interface MassBunkEvent {
  id: string;
  date: string;
  day: string;
  period: number;
  subject_code: string;
  absent_count: number;
  total_enrolled: number;
  absent_percentage: number;
  risk_score: number;
  structural_anchor: {
    roll_no: string;
    name: string;
  } | null;
  participating_roll_numbers: string[];
  reason: string;
}

export interface CalendarRiskDay {
  date: string;
  day: string;
  day_num?: number;
  risk_level: 'HIGH' | 'MEDIUM' | 'LOW';
  risk_score: number;
  reason: string;
  recommendation?: string;
  is_holiday: boolean;
  holiday_name: string | null;
  consecutive_days_gained?: number;
  preceding_off_days?: number;
  following_off_days?: number;
  vacation_dates?: string[];
  is_bridge_day?: boolean;
  has_lab?: boolean;
  has_detected_bunk?: boolean;
  bunk_details?: {
    absent_count: number;
    total_enrolled: number;
    period: number;
    subject: string;
    anchor?: string;
  } | null;
  periods?: Array<{
    period: number;
    subject: string;
    is_lab: boolean;
    room: string;
  }>;
}

export interface CalendarEvent {
  id: string;
  date: string;
  name: string;
  type: string;
  is_holiday: boolean;
}

export interface InterventionItem {
  id: string;
  type: string;
  target_cohort: string;
  students_involved: string[];
  created_at: string;
  status: string;
  action_plan: string;
  effectiveness: string;
  assigned_to: string;
}

export interface StudentRosterItem {
  id: string;
  roll_no: string;
  name: string;
  branch: string;
  year: number;
  attendance_pct: number;
  attendance?: number;
  total_classes: number;
  absences: number;
  cohort: string;
  cohort_color?: string;
  role: string;
  pagerank: number;
  betweenness: number;
  influenceScore?: number;
  is_delinquent?: boolean;
  delinquency_label?: string | null;
  category?: string;
  statusBadge?: string;
}

export interface IngestionBatchItem {
  id: string;
  filename: string;
  data_type: string;
  status: string;
  row_count: number;
  success_count: number;
  error_count: number;
  created_at: string | null;
}

export interface AuditLogItem {
  id: string;
  timestamp: string;
  action: string;
  actor_user_id: string;
  actor_role: string;
  details: any;
  hash: string;
}

class ApiClient {
  private csrfToken: string | null = null;
  private baseUrl = '/api/v1';

  setCsrfToken(token: string) {
    this.csrfToken = token;
  }

  getCsrfToken() {
    return this.csrfToken;
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const isFormData = options.body instanceof FormData;
    const headers: Record<string, string> = {
      Accept: 'application/json',
      ...(options.headers as Record<string, string>),
    };

    if (!isFormData && !headers['Content-Type']) {
      headers['Content-Type'] = 'application/json';
    }

    if (this.csrfToken && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(options.method || '')) {
      headers['X-CSRF-Token'] = this.csrfToken;
    }

    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers,
      credentials: 'include',
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail || `HTTP ${response.status}: Request failed`);
    }

    return response.json();
  }

  async login(username: string, password: string) {
    const data = await this.request<{
      user: User;
      csrf_token: string;
      consent_accepted: boolean;
    }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
    this.setCsrfToken(data.csrf_token);
    return data;
  }

  async logout() {
    await this.request('/auth/logout', { method: 'POST' });
    this.csrfToken = null;
  }

  async getMe() {
    const data = await this.request<{
      user: User;
      csrf_token: string;
      consent_accepted: boolean;
    }>('/auth/me');
    this.setCsrfToken(data.csrf_token);
    return data;
  }

  async getConsentNotice(): Promise<ConsentNotice> {
    return this.request<ConsentNotice>('/consent/notice');
  }

  async acceptConsent(): Promise<{ success: boolean; version: string }> {
    return this.request('/consent/accept', {
      method: 'POST',
      body: JSON.stringify({ purpose: 'educational_support' }),
    });
  }

  async getHealth() {
    return this.request<{
      status: string;
      app_name: string;
      database: string;
      scheduler: string;
      llm?: { configured: boolean; model: string | null };
    }>('/health');
  }

  // ── Real Endpoints (De-Vibecoded) ──────────────────────────────────────────

  async getDashboardSummary(section = 'CS-3B'): Promise<DashboardSummary> {
    return this.request<DashboardSummary>(`/dashboard/summary?section=${encodeURIComponent(section)}`);
  }

  async getGraphHierarchy(section = 'CS-3B'): Promise<HierarchicalGraphData> {
    return this.request<HierarchicalGraphData>(`/graph/hierarchy?section=${encodeURIComponent(section)}`);
  }

  async getGraphClusters(section = 'CS-3B'): Promise<{ section: any; clusters: ClusterNode[]; summary: any }> {
    return this.request(`/graph/clusters/${encodeURIComponent(section)}`);
  }

  async getStudentNeighbors(rollNo: string, depth = 2, edgeTypes?: string[]): Promise<StudentNeighborsSubgraph> {
    const params = new URLSearchParams({ depth: String(depth) });
    if (edgeTypes && edgeTypes.length > 0) {
      params.append('edge_types', edgeTypes.join(','));
    }
    return this.request<StudentNeighborsSubgraph>(`/graph/student/${encodeURIComponent(rollNo)}/neighbors?${params.toString()}`);
  }

  async getAggregateEdges(section = 'CS-3B'): Promise<{ section: any; aggregate_edges: HierarchicalEdge[] }> {
    return this.request(`/graph/aggregate-edges?section=${encodeURIComponent(section)}`);
  }

  async getGraphNodes(section = 'CS-3B'): Promise<{
    nodes: GraphNode[];
    edges: GraphEdge[];
    summary: { student_count: number; cohorts_count: number; edge_count: number; section_code: string };
  }> {
    return this.request(`/graph/nodes?section=${encodeURIComponent(section)}`);
  }

  async getStudentProfile(rollNo: string): Promise<StudentDossier> {
    return this.request<StudentDossier>(`/graph/student/${encodeURIComponent(rollNo)}`);
  }

  async getMassBunks(section = 'CS-3B'): Promise<MassBunkEvent[]> {
    return this.request<MassBunkEvent[]>(`/detection/mass-bunks?section=${encodeURIComponent(section)}`);
  }

  async getCalendarRisk(section = 'CS-3B', month = '2026-10', weekendPolicy = 'sat_sun'): Promise<CalendarRiskDay[]> {
    return this.request<CalendarRiskDay[]>(
      `/calendar/risk-week?section=${encodeURIComponent(section)}&month=${encodeURIComponent(month)}&weekend_policy=${encodeURIComponent(weekendPolicy)}`
    );
  }

  async addBulkHolidays(payload: {
    name: string;
    start_date?: string;
    end_date?: string;
    dates?: string[];
    type?: string;
    is_holiday?: boolean;
  }): Promise<{ status: string; message: string; affected_dates: string[] }> {
    return this.request('/calendar/holidays/bulk', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async deleteHoliday(dateStr: string): Promise<{ status: string; message: string; date: string }> {
    return this.request(`/calendar/holidays/${encodeURIComponent(dateStr)}`, {
      method: 'DELETE',
    });
  }

  async resetCalendarDefaults(): Promise<{ status: string; message: string }> {
    return this.request('/calendar/holidays/reset-defaults', {
      method: 'POST',
    });
  }

  async getCalendarEvents(): Promise<CalendarEvent[]> {
    return this.request<CalendarEvent[]>('/calendar/events');
  }

  async getInterventions(section = 'CS-3B'): Promise<InterventionItem[]> {
    return this.request<InterventionItem[]>(`/interventions?section=${encodeURIComponent(section)}`);
  }

  async createIntervention(payload: {
    student_ids: string[];
    type: string;
    trigger_context: string;
    notes?: string;
    assigned_to?: string;
  }): Promise<{ status: string; id: string; message: string }> {
    return this.request('/interventions', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async predictProbability(payload: {
    day_of_week?: string;
    period?: number;
    subject_code?: string;
    is_lab?: boolean;
    bridge_days_gained?: number;
    is_pre_holiday?: boolean;
    is_exam_proximity?: boolean;
    cohort_risk_tier?: string;
    student_roll?: string;
    section?: string;
  }): Promise<CalibratedPredictionResult> {
    return this.request<CalibratedPredictionResult>('/calendar/predict-probability', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async sendStudentEmail(payload: SendEmailPayload): Promise<{
    status: string;
    email_id: string;
    timestamp: string;
    recipient: string;
    student_name: string;
    category: string;
    message: string;
    record: DispatchedEmailRecord;
  }> {
    return this.request('/interventions/send-email', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async getDispatchedEmails(section = 'CS-3B'): Promise<DispatchedEmailRecord[]> {
    return this.request<DispatchedEmailRecord[]>(`/interventions/emails?section=${encodeURIComponent(section)}`);
  }

  async getStudentsRoster(section = 'CS-3B'): Promise<StudentRosterItem[]> {
    return this.request<StudentRosterItem[]>(`/students?section=${encodeURIComponent(section)}`);
  }

  async getIngestionHistory(): Promise<IngestionBatchItem[]> {
    return this.request<IngestionBatchItem[]>('/ingest/history');
  }

  async uploadCsv(
    type: 'attendance' | 'calendar' | 'students' | 'timetable',
    file: File
  ): Promise<{ status: string; records_inserted?: number; events_ingested?: number; total_rows?: number; errors_count?: number }> {
    const formData = new FormData();
    formData.append('file', file);
    return this.request(`/ingest/${type}`, {
      method: 'POST',
      body: formData,
    });
  }

  async getAuditLogs(): Promise<AuditLogItem[]> {
    return this.request<AuditLogItem[]>('/audit/logs');
  }

  async verifyAuditChain(): Promise<{ verified: boolean; total_records: number; message: string }> {
    return this.request('/admin/audit/verify');
  }

  async loadSampleData(): Promise<{
    status: string;
    message: string;
    results: any;
  }> {
    return this.request('/admin/load-sample-data', {
      method: 'POST',
    });
  }

  async getBunkNetwork(params?: {
    section?: string;
    overlays?: string[];
    subject?: string;
    period?: number;
    weekday?: number;
  }): Promise<CytoscapeBunkNetworkData> {
    const q = new URLSearchParams();
    if (params?.section) q.append('section', params.section);
    if (params?.overlays && params.overlays.length > 0) q.append('overlays', params.overlays.join(','));
    if (params?.subject) q.append('subject', params.subject);
    if (params?.period !== undefined) q.append('period', String(params.period));
    if (params?.weekday !== undefined) q.append('weekday', String(params.weekday));
    return this.request<CytoscapeBunkNetworkData>(`/graph/bunk-network?${q.toString()}`);
  }

  async getPairEvidence(rollA: string, rollB: string, section = 'CS-3B'): Promise<PairEvidenceData> {
    return this.request<PairEvidenceData>(`/graph/evidence/${encodeURIComponent(rollA)}/${encodeURIComponent(rollB)}?section=${encodeURIComponent(section)}`);
  }

  // ── Knowledge Graph API (Prompt 3 Specifications) ──────────────────────
  async getKnowledgeGraphData(section = 'CS-3B'): Promise<KnowledgeGraphData> {
    return this.request<KnowledgeGraphData>(`/graph/data?section=${encodeURIComponent(section)}`);
  }

  async getKnowledgeGraphShortestPath(source: string, target: string, section = 'CS-3B'): Promise<ShortestPathResult> {
    return this.request<ShortestPathResult>(
      `/graph/shortest-path?source=${encodeURIComponent(source)}&target=${encodeURIComponent(target)}&section=${encodeURIComponent(section)}`
    );
  }

  async getKnowledgeGraphSubgraph(nodeId: string, depth = 1, section = 'CS-3B'): Promise<{ root_node_id: string; depth: number; nodes: any[]; edges: any[] }> {
    return this.request(
      `/graph/subgraph?node_id=${encodeURIComponent(nodeId)}&depth=${depth}&section=${encodeURIComponent(section)}`
    );
  }

  async createKnowledgeGraphNode(node: { id: string; label: string; type: string; community?: number; properties?: Record<string, any> }) {
    return this.request('/graph/nodes', {
      method: 'POST',
      body: JSON.stringify(node),
    });
  }

  async createKnowledgeGraphEdge(edge: { source: string; target: string; type: string; weight?: number; timestamp?: string; properties?: Record<string, any> }) {
    return this.request('/graph/edges', {
      method: 'POST',
      body: JSON.stringify(edge),
    });
  }

  async getKnowledgeGraphTimeline(start?: string, end?: string, section = 'CS-3B'): Promise<{ start?: string; end?: string; nodes: any[]; edges: any[] }> {
    const q = new URLSearchParams();
    if (start) q.append('start', start);
    if (end) q.append('end', end);
    q.append('section', section);
    return this.request(`/graph/timeline?${q.toString()}`);
  }
}

export interface KnowledgeGraphNode {
  id: string;
  label: string;
  type: string;
  community?: number;
  pagerank?: number;
  degree?: number;
  properties?: Record<string, any>;
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
}

export interface KnowledgeGraphEdge {
  source: string;
  target: string;
  type: string;
  weight?: number;
  timestamp?: string;
  properties?: Record<string, any>;
}

export interface KnowledgeGraphData {
  nodes: KnowledgeGraphNode[];
  edges: KnowledgeGraphEdge[];
  summary?: {
    node_count: number;
    edge_count: number;
    section: string;
    status: string;
  };
}

export interface ShortestPathResult {
  source: string;
  target: string;
  found: boolean;
  nodes: string[];
  edges: Array<{
    source: string;
    target: string;
    type: string;
    weight: number;
  }>;
  length: number;
  message?: string;
}


export interface CytoscapeBunkNetworkData {
  section_code: string;
  elements: Array<{
    group: 'nodes' | 'edges';
    data: any;
    classes?: string;
  }>;
  compound_groups: Array<{
    id: string;
    label: string;
    size: number;
    members: string[];
    is_compound: boolean;
  }>;
  isolated_students: Array<{
    id: string;
    name: string;
    roll_no: string;
    bunk_rate_30d: number;
    attendance_rate: number;
  }>;
  summary: {
    total_students: number;
    connected_students: number;
    isolated_count: number;
    edge_count: number;
    sessions_evaluated: number;
    is_degraded: boolean;
    groups_count: number;
    rendered_nodes: number;
  };
}

export interface PairEvidenceData {
  student_a: string;
  student_b: string;
  plain_language: string;
  lift: number;
  expected: number;
  co_bunk_count: number;
  p_value: number;
  q_value: number;
  jaccard: number;
  sessions: Array<{
    date: string;
    period: number;
    subject_code: string;
  }>;
}

export interface CalibratedPredictionResult {
  probability: number;
  confidence_interval: [number, number];
  margin_of_error: number;
  risk_level: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  baseline_rate: number;
  net_factor_impact: number;
  attributions: Array<{
    factor: string;
    impact: number;
    description: string;
  }>;
  mathematical_model: string;
  inputs: {
    day_of_week: string;
    period: number;
    subject_code: string;
    is_lab: boolean;
    bridge_days_gained: number;
    is_pre_holiday: boolean;
    is_exam_proximity: boolean;
    cohort_risk_tier: string;
  };
}

export interface SendEmailPayload {
  student_roll: string;
  student_name?: string;
  student_email?: string;
  category: 'behavior' | 'attendance' | 'academic' | 'wellbeing' | 'general';
  subject: string;
  body: string;
  sender_name?: string;
  sender_role?: string;
  cc_counselor?: boolean;
  priority?: 'normal' | 'high' | 'urgent';
  section?: string;
}

export interface DispatchedEmailRecord {
  id: string;
  student_roll: string;
  student_name: string;
  student_email: string;
  category: string;
  subject: string;
  body: string;
  sender_name: string;
  sender_role: string;
  cc_counselor: boolean;
  priority: string;
  section: string;
  timestamp: string;
  status: string;
}

export const api = new ApiClient();
