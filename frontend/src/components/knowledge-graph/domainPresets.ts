export interface PresetNode {
  id: string;
  label: string;
  type: string;
  community: number;
  pagerank: number;
  properties: Record<string, any>;
}

export interface PresetEdge {
  source: string;
  target: string;
  type: string;
  weight: number;
  timestamp: string;
  properties?: Record<string, any>;
}

export interface DomainPreset {
  id: string;
  name: string;
  description: string;
  icon: string;
  nodeTypes: Record<string, { color: string; icon: string; description: string }>;
  edgeTypes: string[];
  nodes: PresetNode[];
  edges: PresetEdge[];
}

export const DOMAIN_PRESETS: Record<string, DomainPreset> = {
  // ── MAKEROV CLASSROOM & ACADEMIC INTELLIGENCE ─────────────────────────────
  academic: {
    id: 'academic',
    name: 'Classroom & Academic Intelligence',
    description: 'Student behavioral networks, co-absence bunk cascades, faculty mentorship, and academic cohort dynamics.',
    icon: 'school',
    nodeTypes: {
      Student: { color: '#00b4ff', icon: 'person', description: 'Enrolled student with academic risk & attendance profiles' },
      Faculty: { color: '#ffd700', icon: 'badge', description: 'Course instructor & academic mentor' },
      Classroom: { color: '#ff8c00', icon: 'meeting_room', description: 'Physical classroom & section division' },
      Course: { color: '#a855f7', icon: 'menu_book', description: 'Curricular course subject' },
      Club: { color: '#39ff14', icon: 'groups', description: 'Student technical society or extracurricular club' },
      Incident: { color: '#ff4c4c', icon: 'warning', description: 'Mass absence, proxy bunk event, or behavioral escalation' },
    },
    edgeTypes: ['SUPERVISES', 'BUNKS_WITH', 'PEER_OF', 'ENROLLED_IN', 'INVOLVED_IN', 'AFFILIATED_WITH', 'TAUGHT_BY', 'MENTORS'],
    nodes: [
      { id: 'sec-cs3b', label: 'Section CS-3B', type: 'Classroom', community: 1, pagerank: 0.082, properties: { department: 'Computer Science', capacity: 60, room: 'LH-302', term: 'Sem 4' } },
      { id: 'fac-raghav', label: 'Prof. Raghav Sharma', type: 'Faculty', community: 1, pagerank: 0.076, properties: { designation: 'Class Teacher', department: 'AIML & Systems', cabin: 'B-204' } },
      { id: 'fac-anita', label: 'Dr. Anita Mehta', type: 'Faculty', community: 2, pagerank: 0.054, properties: { designation: 'Associate Professor', subject: 'PHY301 Physics Lab' } },
      { id: 'fac-vikram', label: 'Dean Vikram Kapoor', type: 'Faculty', community: 1, pagerank: 0.061, properties: { designation: 'Academic Dean & HOD', office: 'Admin Block 1' } },
      
      { id: 'crs-os', label: 'CS301 Operating Systems', type: 'Course', community: 1, pagerank: 0.048, properties: { credits: 4, labAttached: true, difficulty: 'High' } },
      { id: 'crs-ml', label: 'CS302 Machine Learning', type: 'Course', community: 2, pagerank: 0.045, properties: { credits: 4, labAttached: true, difficulty: 'Advanced' } },
      { id: 'crs-dbms', label: 'CS303 Database Engineering', type: 'Course', community: 3, pagerank: 0.042, properties: { credits: 3, difficulty: 'Medium' } },

      { id: 'club-acm', label: 'ACM Student Chapter', type: 'Club', community: 2, pagerank: 0.038, properties: { domain: 'Competitive Programming', meetings: 'Wed 4 PM' } },
      { id: 'club-robotics', label: 'Autonomous Robotics Club', type: 'Club', community: 3, pagerank: 0.035, properties: { domain: 'Hardware & IoT', lab: 'IoT-Lab 2' } },

      { id: 'inc-fri-bunk', label: 'Friday Post-Lunch Mass Bunk', type: 'Incident', community: 4, pagerank: 0.065, properties: { severity: 'HIGH', absentees: 14, date: '2026-03-27', period: 5 } },
      { id: 'inc-fest-skip', label: 'Pre-Hackathon Attendance Dip', type: 'Incident', community: 4, pagerank: 0.048, properties: { severity: 'MEDIUM', absentees: 9, date: '2026-03-20', period: 3 } },

      // Key Student Pods
      { id: 'stu-001', label: 'Aarav Patel (21CSB001)', type: 'Student', community: 1, pagerank: 0.071, properties: { role: 'Class Representative (CR)', attendance: '98%', status: 'Exemplary', gpa: 9.4 } },
      { id: 'stu-007', label: 'Rohan Sharma (21CSB007)', type: 'Student', community: 4, pagerank: 0.068, properties: { role: 'Social Anchor / Influencer', attendance: '68%', status: 'Critical Risk', bunks: 18 } },
      { id: 'stu-014', label: 'Rohit Sharma (21CSB014)', type: 'Student', community: 4, pagerank: 0.059, properties: { role: 'Core Bunk Partner', attendance: '62%', status: 'Severe Risk', bunks: 22 } },
      { id: 'stu-022', label: 'Priya Singh (21CSB022)', type: 'Student', community: 2, pagerank: 0.052, properties: { role: 'Study Lead Alpha', attendance: '95%', status: 'High Standing', gpa: 9.1 } },
      { id: 'stu-031', label: 'Kabir Verma (21CSB031)', type: 'Student', community: 4, pagerank: 0.055, properties: { role: 'Bridge Student', attendance: '71%', status: 'Moderate Risk', bunks: 12 } },
      { id: 'stu-019', label: 'Ananya Roy (21CSB019)', type: 'Student', community: 2, pagerank: 0.046, properties: { role: 'Research Associate', attendance: '92%', status: 'Good Standing', gpa: 8.9 } },
      { id: 'stu-045', label: 'Dev Malhotra (21CSB045)', type: 'Student', community: 4, pagerank: 0.044, properties: { role: 'Cohort Member', attendance: '66%', status: 'Flagged Delinquent', bunks: 15 } },
      { id: 'stu-012', label: 'Ishaan Gupta (21CSB012)', type: 'Student', community: 3, pagerank: 0.041, properties: { role: 'Robotics Lead', attendance: '88%', status: 'Good Standing', gpa: 8.5 } },
      { id: 'stu-028', label: 'Sneha Nair (21CSB028)', type: 'Student', community: 2, pagerank: 0.039, properties: { role: 'Study Pod Member', attendance: '94%', status: 'High Standing', gpa: 9.0 } },
      { id: 'stu-053', label: 'Aditya Rao (21CSB053)', type: 'Student', community: 4, pagerank: 0.043, properties: { role: 'Cohort Member', attendance: '70%', status: 'Moderate Risk', bunks: 11 } },
      { id: 'stu-034', label: 'Tanvi Joshi (21CSB034)', type: 'Student', community: 3, pagerank: 0.036, properties: { role: 'IoT Specialist', attendance: '89%', status: 'Good Standing', gpa: 8.4 } },
      { id: 'stu-009', label: 'Varun Nair (21CSB009)', type: 'Student', community: 1, pagerank: 0.042, properties: { role: 'Council Deputy', attendance: '91%', status: 'Good Standing', gpa: 8.8 } },
      { id: 'stu-042', label: 'Meera Iyer (21CSB042)', type: 'Student', community: 2, pagerank: 0.035, properties: { role: 'Coding Club Member', attendance: '93%', status: 'High Standing', gpa: 8.7 } },
      { id: 'stu-058', label: 'Arjun Das (21CSB058)', type: 'Student', community: 4, pagerank: 0.038, properties: { role: 'Peripheral Member', attendance: '72%', status: 'Watchlist', bunks: 9 } },
      { id: 'stu-016', label: 'Rhea Sen (21CSB016)', type: 'Student', community: 3, pagerank: 0.034, properties: { role: 'Lab Assistant', attendance: '90%', status: 'Good Standing', gpa: 8.6 } },
      { id: 'stu-025', label: 'Karan Mehra (21CSB025)', type: 'Student', community: 1, pagerank: 0.033, properties: { role: 'Student Coordinator', attendance: '87%', status: 'Good Standing', gpa: 8.2 } },
      { id: 'stu-039', label: 'Simran Kaur (21CSB039)', type: 'Student', community: 4, pagerank: 0.037, properties: { role: 'Cohort Member', attendance: '69%', status: 'Watchlist', bunks: 10 } },
      { id: 'stu-048', label: 'Nikhil Bose (21CSB048)', type: 'Student', community: 3, pagerank: 0.032, properties: { role: 'Hardware Member', attendance: '86%', status: 'Good Standing', gpa: 8.1 } },
    ],
    edges: [
      { source: 'fac-raghav', target: 'sec-cs3b', type: 'SUPERVISES', weight: 1.0, timestamp: '2026-01-10T09:00:00Z' },
      { source: 'fac-raghav', target: 'stu-001', type: 'MENTORS', weight: 0.9, timestamp: '2026-01-12T10:00:00Z' },
      { source: 'fac-raghav', target: 'crs-os', type: 'TAUGHT_BY', weight: 1.0, timestamp: '2026-01-15T08:30:00Z' },
      { source: 'fac-anita', target: 'crs-ml', type: 'TAUGHT_BY', weight: 1.0, timestamp: '2026-01-15T11:30:00Z' },
      { source: 'fac-vikram', target: 'fac-raghav', type: 'SUPERVISES', weight: 0.8, timestamp: '2026-01-05T09:00:00Z' },

      { source: 'stu-001', target: 'sec-cs3b', type: 'ENROLLED_IN', weight: 1.0, timestamp: '2026-01-02T08:00:00Z' },
      { source: 'stu-001', target: 'stu-009', type: 'PEER_OF', weight: 0.85, timestamp: '2026-01-15T14:00:00Z' },
      { source: 'stu-001', target: 'stu-025', type: 'PEER_OF', weight: 0.75, timestamp: '2026-01-18T16:00:00Z' },

      // Bunk Circle Edges
      { source: 'stu-007', target: 'stu-014', type: 'BUNKS_WITH', weight: 0.98, timestamp: '2026-03-27T13:30:00Z' },
      { source: 'stu-007', target: 'stu-031', type: 'BUNKS_WITH', weight: 0.92, timestamp: '2026-03-27T13:30:00Z' },
      { source: 'stu-007', target: 'stu-045', type: 'BUNKS_WITH', weight: 0.88, timestamp: '2026-03-20T11:00:00Z' },
      { source: 'stu-014', target: 'stu-045', type: 'BUNKS_WITH', weight: 0.85, timestamp: '2026-03-20T11:00:00Z' },
      { source: 'stu-014', target: 'stu-053', type: 'BUNKS_WITH', weight: 0.80, timestamp: '2026-03-15T14:00:00Z' },
      { source: 'stu-031', target: 'stu-053', type: 'BUNKS_WITH', weight: 0.78, timestamp: '2026-03-15T14:00:00Z' },
      { source: 'stu-045', target: 'stu-058', type: 'BUNKS_WITH', weight: 0.74, timestamp: '2026-03-22T10:00:00Z' },
      { source: 'stu-053', target: 'stu-039', type: 'BUNKS_WITH', weight: 0.71, timestamp: '2026-03-25T15:00:00Z' },
      { source: 'stu-007', target: 'inc-fri-bunk', type: 'INVOLVED_IN', weight: 1.0, timestamp: '2026-03-27T13:30:00Z' },
      { source: 'stu-014', target: 'inc-fri-bunk', type: 'INVOLVED_IN', weight: 1.0, timestamp: '2026-03-27T13:30:00Z' },
      { source: 'stu-031', target: 'inc-fri-bunk', type: 'INVOLVED_IN', weight: 1.0, timestamp: '2026-03-27T13:30:00Z' },
      { source: 'stu-045', target: 'inc-fest-skip', type: 'INVOLVED_IN', weight: 0.9, timestamp: '2026-03-20T11:00:00Z' },

      // Study Alpha Circle
      { source: 'stu-022', target: 'stu-019', type: 'PEER_OF', weight: 0.95, timestamp: '2026-02-01T10:00:00Z' },
      { source: 'stu-022', target: 'stu-028', type: 'PEER_OF', weight: 0.90, timestamp: '2026-02-05T12:00:00Z' },
      { source: 'stu-019', target: 'stu-042', type: 'PEER_OF', weight: 0.82, timestamp: '2026-02-10T14:00:00Z' },
      { source: 'stu-022', target: 'club-acm', type: 'AFFILIATED_WITH', weight: 0.9, timestamp: '2026-01-20T16:00:00Z' },
      { source: 'stu-042', target: 'club-acm', type: 'AFFILIATED_WITH', weight: 0.85, timestamp: '2026-01-20T16:00:00Z' },

      // Robotics & Hardware Circle
      { source: 'stu-012', target: 'stu-034', type: 'PEER_OF', weight: 0.92, timestamp: '2026-02-08T15:00:00Z' },
      { source: 'stu-012', target: 'stu-016', type: 'PEER_OF', weight: 0.86, timestamp: '2026-02-12T16:00:00Z' },
      { source: 'stu-034', target: 'stu-048', type: 'PEER_OF', weight: 0.84, timestamp: '2026-02-15T11:00:00Z' },
      { source: 'stu-012', target: 'club-robotics', type: 'AFFILIATED_WITH', weight: 0.95, timestamp: '2026-01-18T17:00:00Z' },
      { source: 'stu-048', target: 'club-robotics', type: 'AFFILIATED_WITH', weight: 0.88, timestamp: '2026-01-18T17:00:00Z' },

      // Cross-cluster Bridge ties
      { source: 'stu-031', target: 'stu-022', type: 'PEER_OF', weight: 0.65, timestamp: '2026-02-28T14:00:00Z' },
      { source: 'stu-007', target: 'stu-001', type: 'PEER_OF', weight: 0.60, timestamp: '2026-01-25T11:00:00Z' },
      { source: 'stu-012', target: 'stu-025', type: 'PEER_OF', weight: 0.58, timestamp: '2026-02-18T13:00:00Z' },
      { source: 'stu-022', target: 'crs-ml', type: 'ENROLLED_IN', weight: 0.9, timestamp: '2026-01-10T09:00:00Z' },
      { source: 'stu-007', target: 'crs-os', type: 'ENROLLED_IN', weight: 0.7, timestamp: '2026-01-10T09:00:00Z' },
      { source: 'stu-014', target: 'crs-dbms', type: 'ENROLLED_IN', weight: 0.65, timestamp: '2026-01-10T09:00:00Z' },
      { source: 'stu-039', target: 'stu-058', type: 'BUNKS_WITH', weight: 0.72, timestamp: '2026-03-24T14:30:00Z' },
      { source: 'stu-009', target: 'crs-os', type: 'ENROLLED_IN', weight: 0.88, timestamp: '2026-01-10T09:00:00Z' },
      { source: 'stu-028', target: 'crs-dbms', type: 'ENROLLED_IN', weight: 0.92, timestamp: '2026-01-10T09:00:00Z' },
      { source: 'stu-016', target: 'crs-ml', type: 'ENROLLED_IN', weight: 0.89, timestamp: '2026-01-10T09:00:00Z' },
      { source: 'fac-raghav', target: 'stu-007', type: 'MENTORS', weight: 0.55, timestamp: '2026-03-10T11:00:00Z' },
      { source: 'stu-034', target: 'crs-os', type: 'ENROLLED_IN', weight: 0.80, timestamp: '2026-01-10T09:00:00Z' },
    ],
  },
};
