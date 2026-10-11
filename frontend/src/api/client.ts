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

  async getStudentProfile(rollNo: string): Promise<StudentDossier> {
    return this.request<StudentDossier>(`/students/${encodeURIComponent(rollNo)}/profile`);
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

  async getDemoDataSummary(): Promise<{
    section: string;
    cohort_name: string;
    school_days: number;
    date_range: string;
    storylines: Array<{
      id: string;
      title: string;
      students: Array<{ roll: string; name: string }>;
      subject?: string;
      subject_name?: string;
      pattern: string;
      how_to_verify: string;
    }>;
    files: Record<
      string,
      {
        filename: string;
        label: string;
        total_rows: number;
        preview: Array<Record<string, string>>;
        error?: string;
      }
    >;
  }> {
    return this.request('/admin/demo-data');
  }

  getDemoFileDownloadUrl(fileKey: string): string {
    return `${this.baseUrl}/admin/demo-data/file/${fileKey}`;
  }

  // ── Connection Engine v3 API (§7.3) ─────────────────────────────────────────
  async getBunkGraph(
    sectionCode = 'CS-3B',
    options: {
      sensitivity?: 'strict' | 'balanced' | 'exploratory';
      subject?: string;
      period?: number;
      weekday?: number;
      from?: string;
      to?: string;
      overlays?: string[];
      include_dismissed?: boolean;
    } = {}
  ): Promise<BunkGraphPayload> {
    const q = new URLSearchParams();
    if (options.sensitivity) q.append('sensitivity', options.sensitivity);
    if (options.subject) q.append('subject', options.subject);
    if (options.period !== undefined) q.append('period', String(options.period));
    if (options.weekday !== undefined) q.append('weekday', String(options.weekday));
    if (options.from) q.append('from', options.from);
    if (options.to) q.append('to', options.to);
    if (options.overlays && options.overlays.length > 0) q.append('overlays', options.overlays.join(','));
    if (options.include_dismissed) q.append('include_dismissed', 'true');
    return this.request<BunkGraphPayload>(`/sections/${encodeURIComponent(sectionCode)}/bunk-graph?${q.toString()}`);
  }

  async getPairEvidence(rollA: string, rollB: string, sectionCode = 'CS-3B'): Promise<PairEvidenceData> {
    return this.request<PairEvidenceData>(
      `/sections/${encodeURIComponent(sectionCode)}/pairs/${encodeURIComponent(rollA)}/${encodeURIComponent(rollB)}/evidence`
    );
  }

  async dismissEdge(
    sectionCode: string,
    rollA: string,
    rollB: string,
    reason: string
  ): Promise<{ status: string; message: string }> {
    return this.request(
      `/sections/${encodeURIComponent(sectionCode)}/pairs/${encodeURIComponent(rollA)}/${encodeURIComponent(rollB)}/dismiss`,
      {
        method: 'POST',
        body: JSON.stringify({ reason }),
      }
    );
  }
}

export interface BunkGraphNode {
  roll_no: string;
  name: string;
  bunk_rate: number;
  bunk_cells: number;
  eligible_cells: number;
  n_ties: number;
  group_id: number | null;
}

export interface SharedTieItem {
  tie_type: string;
  kind: string;
  source_type: string;
  detail: string;
}

export interface BunkGraphEdge {
  id: string;
  type: string;
  student_a: string;
  student_b: string;
  weight: number;
  co_cells: number;
  co_dates: number;
  expected: number;
  lift: number;
  q_value: number;
  source_type: string;
  derived_from: string;
  shared_ties: SharedTieItem[];
  has_social_tie: boolean;
  has_context_tie: boolean;
  dismissed: boolean;
}

export interface BunkGroupInfo {
  group_id: number;
  members: string[];
  n_edges: number;
  mean_weight: number;
}

export interface StudentWithoutTie {
  roll_no: string;
  name: string;
  bunk_cells: number;
}

export interface MassSkipEvent {
  date: string;
  block: number;
  skipped: number;
  present: number;
}

export interface BunkGraphPayload {
  status: string;
  message: string;
  engine_version: string;
  params_hash: string;
  quality: Record<string, any>;
  nodes: BunkGraphNode[];
  edges: BunkGraphEdge[];
  groups: BunkGroupInfo[];
  pairs_only: Array<[string, string]>;
  students_without_ties: StudentWithoutTie[];
  mass_skip_events: MassSkipEvent[];
}

export interface PairEvidenceData {
  status: string;
  student_a: string;
  student_b: string;
  plain_language: string;
  co_cells: number;
  co_dates: number;
  expected: number;
  lift: number;
  q_value: number;
  shared_ties: SharedTieItem[];
  overlapping_sessions: Array<{
    date: string;
    block: number;
    weekday: string;
    periods_a: number[];
    periods_b: number[];
    subjects: string[];
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
