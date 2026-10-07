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
  // ── 1. MAKEROV CLASSROOM INTELLIGENCE ──────────────────────────────────────
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

  // ── 2. CYBER THREAT INTELLIGENCE & FORENSICS ───────────────────────────────
  cyber: {
    id: 'cyber',
    name: 'Cyber Threat Intelligence & Network Forensics',
    description: 'Attack kill-chain telemetry, malware C2 nodes, CVE exploits, and advanced persistent threat actor infrastructure.',
    icon: 'security',
    nodeTypes: {
      Threat_Actor: { color: '#ff00ff', icon: 'skull', description: 'Adversary group or state-sponsored entity' },
      Malware_Hash: { color: '#ff4c4c', icon: 'bug_report', description: 'Payload binary fingerprint / SHA256 signature' },
      Vulnerability_CVE: { color: '#ff8c00', icon: 'shield_locked', description: 'Common Vulnerabilities and Exposures advisory' },
      IP_Address: { color: '#00ffff', icon: 'router', description: 'Command & Control or exfiltration IP address' },
      Domain_Name: { color: '#ffd700', icon: 'language', description: 'Fast-flux C2 DNS domain' },
      Host_Machine: { color: '#00b4ff', icon: 'computer', description: 'Internal perimeter gateway or workstation' },
    },
    edgeTypes: ['EXPLOITS', 'COMMUNICATES_WITH', 'DROPPED_BY', 'TARGETS', 'HOSTED_ON'],
    nodes: [
      { id: 'actor-apt29', label: 'COZY BEAR (APT29)', type: 'Threat_Actor', community: 1, pagerank: 0.088, properties: { country: 'RU', motivation: 'Espionage', activeSince: '2008' } },
      { id: 'actor-lazarus', label: 'HIDDEN COBRA (Lazarus)', type: 'Threat_Actor', community: 2, pagerank: 0.082, properties: { country: 'KP', motivation: 'Financial / Ransom', activeSince: '2009' } },
      
      { id: 'cve-2024-38077', label: 'CVE-2024-38077 (MadLicense)', type: 'Vulnerability_CVE', community: 1, pagerank: 0.065, properties: { cvss: 9.8, service: 'RDL Services', rce: true } },
      { id: 'cve-2023-36884', label: 'CVE-2023-36884 (Office RCE)', type: 'Vulnerability_CVE', community: 1, pagerank: 0.058, properties: { cvss: 8.8, vector: 'Phishing Doc' } },
      { id: 'cve-2023-4966', label: 'CVE-2023-4966 (Citrix Bleed)', type: 'Vulnerability_CVE', community: 2, pagerank: 0.062, properties: { cvss: 9.4, memoryLeak: true } },

      { id: 'mal-cobalt', label: 'Cobalt Strike Beacon (SHA-256..1a)', type: 'Malware_Hash', community: 1, pagerank: 0.075, properties: { family: 'Post-Exploitation', listenerPort: 443 } },
      { id: 'mal-emotet', label: 'Emotet Trojan Loader (SHA-256..f4)', type: 'Malware_Hash', community: 2, pagerank: 0.068, properties: { family: 'Modular Loader', encryption: 'AES-128' } },
      { id: 'mal-mimikatz', label: 'Mimikatz In-Memory (SHA-256..8c)', type: 'Malware_Hash', community: 1, pagerank: 0.055, properties: { type: 'LSASS Dumper', privilege: 'SYSTEM' } },
      { id: 'mal-blackcat', label: 'ALPHV / BlackCat Ransomware', type: 'Malware_Hash', community: 2, pagerank: 0.060, properties: { lang: 'Rust', ransomNote: 'RECOVER_KEY.txt' } },

      { id: 'ip-195-20-44-11', label: '195.20.44.11 (C2 Proxy)', type: 'IP_Address', community: 1, pagerank: 0.051, properties: { asn: 'AS209848', country: 'NL', ports: [443, 8443] } },
      { id: 'ip-45-154-255-89', label: '45.154.255.89 (Drop Zone)', type: 'IP_Address', community: 1, pagerank: 0.048, properties: { asn: 'AS44050', country: 'RU', abuseScore: 94 } },
      { id: 'ip-185-180-222-14', label: '185.180.222.14 (Staging)', type: 'IP_Address', community: 2, pagerank: 0.046, properties: { asn: 'AS197695', country: 'MD', openRelay: true } },
      { id: 'ip-91-215-85-17', label: '91.215.85.17 (Fast-Flux)', type: 'IP_Address', community: 2, pagerank: 0.044, properties: { asn: 'AS57110', country: 'BG' } },

      { id: 'dom-updates-cdn', label: 'ms-cloud-telemetry.org', type: 'Domain_Name', community: 1, pagerank: 0.050, properties: { registrar: 'NameCheap', ttl: 300, dnsType: 'A' } },
      { id: 'dom-auth-sync', label: 'okta-auth-sync.net', type: 'Domain_Name', community: 1, pagerank: 0.047, properties: { registrar: 'Tucows', sslIssuer: 'Let\'s Encrypt' } },
      { id: 'dom-pay-portal', label: 'sec-payment-cdn.top', type: 'Domain_Name', community: 2, pagerank: 0.043, properties: { registrar: 'Porkbun', whoisGuard: true } },

      { id: 'host-dc01', label: 'CORP-DC01.local', type: 'Host_Machine', community: 3, pagerank: 0.064, properties: { os: 'Windows Server 2022', role: 'Primary Domain Controller', ip: '10.0.1.5' } },
      { id: 'host-vpn-gw', label: 'GW-EDGE-VPN01', type: 'Host_Machine', community: 3, pagerank: 0.058, properties: { os: 'NetScaler 13.1', interface: 'Public WAN', ip: '172.16.0.1' } },
      { id: 'host-ws-fin4', label: 'FIN-WS-104 (CFO Station)', type: 'Host_Machine', community: 3, pagerank: 0.049, properties: { user: 'cfo_admin', edrStatus: 'Compromised', ip: '10.0.4.82' } },
      { id: 'host-db-prod', label: 'SQL-PROD-CLUSTER', type: 'Host_Machine', community: 3, pagerank: 0.056, properties: { dbType: 'PostgreSQL 16', sensitiveTables: 142, ip: '10.0.2.19' } },
      { id: 'host-dev-build', label: 'CI-CD-JENKINS01', type: 'Host_Machine', community: 3, pagerank: 0.041, properties: { gitAccess: true, runners: 12, ip: '10.0.5.11' } },
    ],
    edges: [
      { source: 'actor-apt29', target: 'cve-2024-38077', type: 'EXPLOITS', weight: 1.0, timestamp: '2026-03-01T04:12:00Z' },
      { source: 'actor-apt29', target: 'mal-cobalt', type: 'DROPPED_BY', weight: 0.95, timestamp: '2026-03-01T04:15:00Z' },
      { source: 'actor-lazarus', target: 'mal-emotet', type: 'DROPPED_BY', weight: 0.92, timestamp: '2026-03-02T11:20:00Z' },
      { source: 'actor-lazarus', target: 'mal-blackcat', type: 'DROPPED_BY', weight: 0.90, timestamp: '2026-03-04T18:00:00Z' },

      { source: 'mal-cobalt', target: 'ip-195-20-44-11', type: 'COMMUNICATES_WITH', weight: 0.9, timestamp: '2026-03-01T05:00:00Z' },
      { source: 'mal-cobalt', target: 'dom-updates-cdn', type: 'COMMUNICATES_WITH', weight: 0.88, timestamp: '2026-03-01T05:10:00Z' },
      { source: 'dom-updates-cdn', target: 'ip-195-20-44-11', type: 'HOSTED_ON', weight: 1.0, timestamp: '2026-03-01T05:00:00Z' },

      { source: 'mal-emotet', target: 'ip-185-180-222-14', type: 'COMMUNICATES_WITH', weight: 0.85, timestamp: '2026-03-02T12:00:00Z' },
      { source: 'mal-emotet', target: 'dom-pay-portal', type: 'COMMUNICATES_WITH', weight: 0.82, timestamp: '2026-03-02T12:15:00Z' },
      { source: 'dom-pay-portal', target: 'ip-91-215-85-17', type: 'HOSTED_ON', weight: 1.0, timestamp: '2026-03-02T12:00:00Z' },

      { source: 'actor-apt29', target: 'host-vpn-gw', type: 'TARGETS', weight: 0.85, timestamp: '2026-03-01T03:30:00Z' },
      { source: 'cve-2023-4966', target: 'host-vpn-gw', type: 'EXPLOITS', weight: 1.0, timestamp: '2026-03-01T03:45:00Z' },
      { source: 'mal-cobalt', target: 'host-ws-fin4', type: 'TARGETS', weight: 0.92, timestamp: '2026-03-01T06:00:00Z' },
      { source: 'host-ws-fin4', target: 'mal-mimikatz', type: 'DROPPED_BY', weight: 0.88, timestamp: '2026-03-01T06:30:00Z' },
      { source: 'mal-mimikatz', target: 'host-dc01', type: 'TARGETS', weight: 0.95, timestamp: '2026-03-01T07:15:00Z' },
      { source: 'host-dc01', target: 'host-db-prod', type: 'COMMUNICATES_WITH', weight: 0.78, timestamp: '2026-03-01T08:00:00Z' },
      { source: 'mal-blackcat', target: 'host-db-prod', type: 'TARGETS', weight: 0.94, timestamp: '2026-03-04T19:30:00Z' },
      { source: 'ip-45-154-255-89', target: 'dom-auth-sync', type: 'HOSTED_ON', weight: 1.0, timestamp: '2026-03-01T04:00:00Z' },
      { source: 'mal-cobalt', target: 'dom-auth-sync', type: 'COMMUNICATES_WITH', weight: 0.81, timestamp: '2026-03-01T07:00:00Z' },
      { source: 'actor-lazarus', target: 'host-dev-build', type: 'TARGETS', weight: 0.76, timestamp: '2026-03-03T15:00:00Z' },
      { source: 'cve-2023-36884', target: 'host-ws-fin4', type: 'EXPLOITS', weight: 0.88, timestamp: '2026-03-01T05:50:00Z' },
    ],
  },

  // ── 3. HEALTHCARE & BIOMEDICAL KNOWLEDGE GRAPH ─────────────────────────────
  healthcare: {
    id: 'healthcare',
    name: 'Healthcare & Biomedical Genomics',
    description: 'Targeted oncological pathways, pharmaceutical contraindications, genetic expressions, and clinical trial cohorts.',
    icon: 'biotech',
    nodeTypes: {
      Patient: { color: '#4ade80', icon: 'person', description: 'Patient profile & genetic sequencing registry' },
      Disease: { color: '#ff4c4c', icon: 'coronavirus', description: 'Pathological diagnosis / oncological indication' },
      Gene: { color: '#00b4ff', icon: 'dna', description: 'Genomic biomarker & chromosomal sequence' },
      Drug_Compound: { color: '#ffd700', icon: 'medication', description: 'Therapeutic small molecule or monoclonal antibody' },
      Clinical_Trial: { color: '#a855f7', icon: 'clinical_notes', description: 'Phase I-IV controlled clinical protocol' },
      Symptom: { color: '#ff8c00', icon: 'vital_signs', description: 'Clinical manifestation or phenotypic presentation' },
    },
    edgeTypes: ['TREATS', 'EXPRESSES', 'ASSOCIATED_WITH', 'CAUSES_SYMPTOM', 'CONTRAINDICATED_WITH'],
    nodes: [
      { id: 'dis-nsclc', label: 'Non-Small Cell Lung Carcinoma (NSCLC)', type: 'Disease', community: 1, pagerank: 0.082, properties: { code: 'ICD10-C34.9', stage: 'IVb', fiveYrSurvival: '8%' } },
      { id: 'dis-gbm', label: 'Glioblastoma Multiforme (GBM)', type: 'Disease', community: 2, pagerank: 0.076, properties: { code: 'ICD10-C71.9', grade: 'IV', methylation: 'MGMT+' } },
      { id: 'dis-t2d', label: 'Type 2 Diabetes Mellitus', type: 'Disease', community: 3, pagerank: 0.071, properties: { code: 'ICD10-E11', chronic: true, hba1cAvg: '8.4%' } },

      { id: 'gene-egfr', label: 'EGFR (Exon 19 del / T790M)', type: 'Gene', community: 1, pagerank: 0.068, properties: { locus: '7p11.2', targetable: true, pathway: 'MAPK/ERK' } },
      { id: 'gene-alk', label: 'ALK (EML4-ALK fusion)', type: 'Gene', community: 1, pagerank: 0.059, properties: { locus: '2p23.1', kinase: 'Receptor Tyrosine' } },
      { id: 'gene-kras', label: 'KRAS (G12C mutation)', type: 'Gene', community: 1, pagerank: 0.062, properties: { locus: '12p12.1', gtpase: true } },
      { id: 'gene-tp53', label: 'TP53 (Guardian of Genome)', type: 'Gene', community: 2, pagerank: 0.074, properties: { locus: '17p13.1', tumorSuppressor: true } },
      { id: 'gene-mgmt', label: 'MGMT (Promoter Methylated)', type: 'Gene', community: 2, pagerank: 0.055, properties: { locus: '10q26.3', dnaRepair: true } },

      { id: 'drug-osimertinib', label: 'Osimertinib (Tagrisso)', type: 'Drug_Compound', community: 1, pagerank: 0.065, properties: { class: '3rd Gen EGFR TKI', fdaApproved: 2017, route: 'Oral' } },
      { id: 'drug-alectinib', label: 'Alectinib (Alecensa)', type: 'Drug_Compound', community: 1, pagerank: 0.052, properties: { class: 'ALK Inhibitor', bbbPenetration: 'High' } },
      { id: 'drug-sotorasib', label: 'Sotorasib (Lumakras)', type: 'Drug_Compound', community: 1, pagerank: 0.054, properties: { class: 'KRAS G12C Inhibitor', phase: 'Approved' } },
      { id: 'drug-temozolomide', label: 'Temozolomide (Temodar)', type: 'Drug_Compound', community: 2, pagerank: 0.061, properties: { class: 'Alkylating Agent', oralBioavailability: '100%' } },
      { id: 'drug-metformin', label: 'Metformin Hydrochloride', type: 'Drug_Compound', community: 3, pagerank: 0.058, properties: { class: 'Biguanide', ampkActivator: true } },
      { id: 'drug-warfarin', label: 'Warfarin Sodium', type: 'Drug_Compound', community: 3, pagerank: 0.048, properties: { class: 'Vitamin K Antagonist', inrTarget: '2.0-3.0' } },

      { id: 'trial-flaura', label: 'FLAURA-2 Protocol (NCT04035486)', type: 'Clinical_Trial', community: 1, pagerank: 0.050, properties: { phase: 'III', enrollment: 557, primaryPFS: '25.5 mos' } },
      { id: 'trial-stride', label: 'STRIDE-GBM Trial (NCT05218850)', type: 'Clinical_Trial', community: 2, pagerank: 0.045, properties: { phase: 'II', immunotherapyComb: true } },

      { id: 'pat-0041', label: 'Patient #PT-4091 (48yo M)', type: 'Patient', community: 1, pagerank: 0.044, properties: { smoker: 'Never', performanceStatus: 'ECOG 1', ctdna: 'Positive' } },
      { id: 'pat-0182', label: 'Patient #PT-8812 (62yo F)', type: 'Patient', community: 2, pagerank: 0.042, properties: { seizureHistory: true, dexamethasone: '4mg qd' } },
      { id: 'pat-0309', label: 'Patient #PT-1923 (55yo M)', type: 'Patient', community: 3, pagerank: 0.040, properties: { bmi: 31.4, egfrRenal: '64 mL/min' } },

      { id: 'sym-hemoptysis', label: 'Persistent Hemoptysis', type: 'Symptom', community: 1, pagerank: 0.041, properties: { severity: 'Grade 3', onset: '3 weeks' } },
      { id: 'sym-cephalea', label: 'Morning Cephalea & Nausea', type: 'Symptom', community: 2, pagerank: 0.043, properties: { icpElevation: true } },
      { id: 'sym-neuropathy', label: 'Peripheral Neuropathy', type: 'Symptom', community: 3, pagerank: 0.038, properties: { bilateral: true, feetBurning: true } },
    ],
    edges: [
      { source: 'drug-osimertinib', target: 'dis-nsclc', type: 'TREATS', weight: 1.0, timestamp: '2026-01-15T00:00:00Z' },
      { source: 'drug-osimertinib', target: 'gene-egfr', type: 'TREATS', weight: 0.95, timestamp: '2026-01-15T00:00:00Z' },
      { source: 'gene-egfr', target: 'dis-nsclc', type: 'ASSOCIATED_WITH', weight: 0.98, timestamp: '2026-01-10T00:00:00Z' },
      { source: 'gene-alk', target: 'dis-nsclc', type: 'ASSOCIATED_WITH', weight: 0.90, timestamp: '2026-01-10T00:00:00Z' },
      { source: 'drug-alectinib', target: 'gene-alk', type: 'TREATS', weight: 0.96, timestamp: '2026-01-15T00:00:00Z' },
      { source: 'gene-kras', target: 'dis-nsclc', type: 'ASSOCIATED_WITH', weight: 0.88, timestamp: '2026-01-10T00:00:00Z' },
      { source: 'drug-sotorasib', target: 'gene-kras', type: 'TREATS', weight: 0.92, timestamp: '2026-01-18T00:00:00Z' },

      { source: 'dis-gbm', target: 'gene-mgmt', type: 'EXPRESSES', weight: 0.94, timestamp: '2026-01-12T00:00:00Z' },
      { source: 'dis-gbm', target: 'gene-tp53', type: 'EXPRESSES', weight: 0.91, timestamp: '2026-01-12T00:00:00Z' },
      { source: 'drug-temozolomide', target: 'dis-gbm', type: 'TREATS', weight: 0.95, timestamp: '2026-01-20T00:00:00Z' },

      { source: 'dis-t2d', target: 'drug-metformin', type: 'TREATS', weight: 0.99, timestamp: '2026-01-05T00:00:00Z' },
      { source: 'drug-metformin', target: 'drug-warfarin', type: 'CONTRAINDICATED_WITH', weight: 0.85, timestamp: '2026-02-01T00:00:00Z' },

      { source: 'pat-0041', target: 'dis-nsclc', type: 'ASSOCIATED_WITH', weight: 1.0, timestamp: '2026-02-14T09:00:00Z' },
      { source: 'pat-0041', target: 'gene-egfr', type: 'EXPRESSES', weight: 0.98, timestamp: '2026-02-14T09:00:00Z' },
      { source: 'pat-0041', target: 'drug-osimertinib', type: 'TREATS', weight: 0.95, timestamp: '2026-02-15T10:00:00Z' },
      { source: 'pat-0041', target: 'trial-flaura', type: 'ASSOCIATED_WITH', weight: 0.89, timestamp: '2026-02-16T11:00:00Z' },

      { source: 'dis-nsclc', target: 'sym-hemoptysis', type: 'CAUSES_SYMPTOM', weight: 0.86, timestamp: '2026-01-08T00:00:00Z' },
      { source: 'dis-gbm', target: 'sym-cephalea', type: 'CAUSES_SYMPTOM', weight: 0.92, timestamp: '2026-01-08T00:00:00Z' },
      { source: 'dis-t2d', target: 'sym-neuropathy', type: 'CAUSES_SYMPTOM', weight: 0.84, timestamp: '2026-01-08T00:00:00Z' },
      { source: 'trial-stride', target: 'drug-temozolomide', type: 'ASSOCIATED_WITH', weight: 0.87, timestamp: '2026-01-22T00:00:00Z' },
      { source: 'pat-0182', target: 'dis-gbm', type: 'ASSOCIATED_WITH', weight: 1.0, timestamp: '2026-02-20T08:00:00Z' },
    ],
  },

  // ── 4. FINANCIAL INTELLIGENCE & ANTI-MONEY LAUNDERING (AML) ─────────────────
  financial: {
    id: 'financial',
    name: 'Financial Fraud & Shell Company Tracing (AML)',
    description: 'Illicit fund transfers, nominee shell corporations, layered jurisdictions, and ultimate beneficial ownership mapping.',
    icon: 'attach_money',
    nodeTypes: {
      Individual: { color: '#ff4c4c', icon: 'person', description: 'Beneficial owner, nominee director, or PEP' },
      Bank_Account: { color: '#ffd700', icon: 'account_balance', description: 'Offshore correspondent or escrow bank account' },
      Corporation: { color: '#00b4ff', icon: 'domain', description: 'Holding entity, SPV, or shell corporation' },
      Transaction: { color: '#39ff14', icon: 'payments', description: 'High-velocity SWIFT or crypto wire transaction' },
      Jurisdiction: { color: '#a855f7', icon: 'flag', description: 'Secrecy jurisdiction or tax haven authority' },
    },
    edgeTypes: ['OWNS', 'TRANSFERRED_MONEY_TO', 'DIRECTOR_OF', 'INCORPORATED_IN', 'BENEFICIARY_OF'],
    nodes: [
      { id: 'ind-volkov', label: 'Viktor Volkov (PEP Flagged)', type: 'Individual', community: 1, pagerank: 0.089, properties: { nationality: 'CY', riskScore: '98/100', sanctionsList: true } },
      { id: 'ind-chen', label: 'Eileen Chen (Nominee)', type: 'Individual', community: 1, pagerank: 0.062, properties: { directorshipsCount: 42, residency: 'SG' } },
      { id: 'ind-alvarez', label: 'Mateo Alvarez (Trustee)', type: 'Individual', community: 2, pagerank: 0.058, properties: { profession: 'Fiduciary Agent', firm: 'Apex Legal BVI' } },

      { id: 'corp-apex-holdings', label: 'Apex Sovereign Holdings Ltd', type: 'Corporation', community: 1, pagerank: 0.081, properties: { type: 'Bearer Share SPV', regDate: '2021-04-12' } },
      { id: 'corp-blue-marina', label: 'Blue Marina Logistics SA', type: 'Corporation', community: 1, pagerank: 0.069, properties: { type: 'Trade Shell Co', invoicesFlagged: 18 } },
      { id: 'corp-solaris-trade', label: 'Solaris Commodities FZE', type: 'Corporation', community: 2, pagerank: 0.064, properties: { turnoverAnnual: '$42.5M', physicalOffice: false } },
      { id: 'corp-aurora-trust', label: 'Aurora Global Trust Reg', type: 'Corporation', community: 2, pagerank: 0.059, properties: { trustDeedSealed: true } },

      { id: 'acc-zurich-904', label: 'IBAN CH93 0024 0904 8812', type: 'Bank_Account', community: 1, pagerank: 0.075, properties: { bank: 'Banque Privée Zurich', currency: 'USD', balance: '$14.2M' } },
      { id: 'acc-dubai-331', label: 'IBAN AE42 0330 1199 4002', type: 'Bank_Account', community: 2, pagerank: 0.066, properties: { bank: 'Emirates Commercial Bank', currency: 'AED' } },
      { id: 'acc-cayman-770', label: 'Account KYB-902-8812', type: 'Bank_Account', community: 1, pagerank: 0.060, properties: { bank: 'Grand Cayman Trust Ltd', currency: 'EUR' } },
      { id: 'acc-singapore-115', label: 'IBAN SG12 0011 8844 2011', type: 'Bank_Account', community: 2, pagerank: 0.052, properties: { bank: 'DBS Wealth Escrow', currency: 'USD' } },

      { id: 'tx-swift-881', label: 'TX #SWIFT-99120 ($4,850,000)', type: 'Transaction', community: 1, pagerank: 0.071, properties: { amount: 4850000, fee: 1200, swiftCode: 'MT103', date: '2026-02-14' } },
      { id: 'tx-swift-882', label: 'TX #SWIFT-99144 ($2,400,000)', type: 'Transaction', community: 1, pagerank: 0.061, properties: { amount: 2400000, rapidHop: true, date: '2026-02-15' } },
      { id: 'tx-swift-883', label: 'TX #SWIFT-99190 ($1,950,000)', type: 'Transaction', community: 2, pagerank: 0.055, properties: { amount: 1950000, splitLayering: true, date: '2026-02-16' } },

      { id: 'jur-bvi', label: 'British Virgin Islands (BVI)', type: 'Jurisdiction', community: 1, pagerank: 0.068, properties: { secrecyIndex: 'High', fatfListing: 'Monitored' } },
      { id: 'jur-panama', label: 'Panama Republic', type: 'Jurisdiction', community: 1, pagerank: 0.059, properties: { secrecyIndex: 'Very High', corporateTax: '0%' } },
      { id: 'jur-uae', label: 'UAE (Dubai DMCC)', type: 'Jurisdiction', community: 2, pagerank: 0.056, properties: { freeZone: true, tradeHub: true } },
      { id: 'jur-switzerland', label: 'Switzerland (FINMA)', type: 'Jurisdiction', community: 1, pagerank: 0.050, properties: { privacyStatute: 'Banking Act Art 47' } },
    ],
    edges: [
      { source: 'ind-volkov', target: 'corp-apex-holdings', type: 'OWNS', weight: 1.0, timestamp: '2026-01-01T00:00:00Z' },
      { source: 'ind-volkov', target: 'corp-aurora-trust', type: 'BENEFICIARY_OF', weight: 0.95, timestamp: '2026-01-01T00:00:00Z' },
      { source: 'ind-chen', target: 'corp-apex-holdings', type: 'DIRECTOR_OF', weight: 0.85, timestamp: '2026-01-02T00:00:00Z' },
      { source: 'ind-chen', target: 'corp-blue-marina', type: 'DIRECTOR_OF', weight: 0.90, timestamp: '2026-01-02T00:00:00Z' },
      { source: 'ind-alvarez', target: 'corp-solaris-trade', type: 'DIRECTOR_OF', weight: 0.88, timestamp: '2026-01-05T00:00:00Z' },

      { source: 'corp-apex-holdings', target: 'jur-bvi', type: 'INCORPORATED_IN', weight: 1.0, timestamp: '2026-01-01T00:00:00Z' },
      { source: 'corp-blue-marina', target: 'jur-panama', type: 'INCORPORATED_IN', weight: 1.0, timestamp: '2026-01-01T00:00:00Z' },
      { source: 'corp-solaris-trade', target: 'jur-uae', type: 'INCORPORATED_IN', weight: 1.0, timestamp: '2026-01-01T00:00:00Z' },

      { source: 'corp-apex-holdings', target: 'acc-zurich-904', type: 'OWNS', weight: 1.0, timestamp: '2026-01-10T00:00:00Z' },
      { source: 'corp-blue-marina', target: 'acc-cayman-770', type: 'OWNS', weight: 1.0, timestamp: '2026-01-10T00:00:00Z' },
      { source: 'corp-solaris-trade', target: 'acc-dubai-331', type: 'OWNS', weight: 1.0, timestamp: '2026-01-10T00:00:00Z' },

      { source: 'acc-zurich-904', target: 'tx-swift-881', type: 'TRANSFERRED_MONEY_TO', weight: 1.0, timestamp: '2026-02-14T11:20:00Z' },
      { source: 'tx-swift-881', target: 'acc-cayman-770', type: 'TRANSFERRED_MONEY_TO', weight: 1.0, timestamp: '2026-02-14T11:25:00Z' },
      { source: 'acc-cayman-770', target: 'tx-swift-882', type: 'TRANSFERRED_MONEY_TO', weight: 1.0, timestamp: '2026-02-15T09:00:00Z' },
      { source: 'tx-swift-882', target: 'acc-dubai-331', type: 'TRANSFERRED_MONEY_TO', weight: 1.0, timestamp: '2026-02-15T09:12:00Z' },
      { source: 'acc-dubai-331', target: 'tx-swift-883', type: 'TRANSFERRED_MONEY_TO', weight: 1.0, timestamp: '2026-02-16T14:30:00Z' },
      { source: 'tx-swift-883', target: 'acc-singapore-115', type: 'TRANSFERRED_MONEY_TO', weight: 1.0, timestamp: '2026-02-16T14:45:00Z' },

      { source: 'acc-zurich-904', target: 'jur-switzerland', type: 'INCORPORATED_IN', weight: 0.9, timestamp: '2026-01-01T00:00:00Z' },
      { source: 'ind-volkov', target: 'acc-zurich-904', type: 'BENEFICIARY_OF', weight: 0.95, timestamp: '2026-01-01T00:00:00Z' },
    ],
  },

  // ── 5. SUPPLY CHAIN & LOGISTICS NETWORK ────────────────────────────────────
  supplychain: {
    id: 'supplychain',
    name: 'Global Supply Chain & Logistics Network',
    description: 'Component fabrication hubs, transit choke points, multi-modal routes, inventory buffers, and disruption modeling.',
    icon: 'local_shipping',
    nodeTypes: {
      Factory: { color: '#00b4ff', icon: 'factory', description: 'Assembly or wafer fabrication facility' },
      Warehouse: { color: '#ffd700', icon: 'warehouse', description: 'Consolidation center or strategic stockpile' },
      Supplier: { color: '#39ff14', icon: 'precision_manufacturing', description: 'Tier-1/Tier-2 specialized component maker' },
      Shipping_Route: { color: '#00ffff', icon: 'directions_boat', description: 'Maritime maritime corridor or airfreight lane' },
      Raw_Material: { color: '#a855f7', icon: 'inventory_2', description: 'Rare earth element or semiconductor substrate' },
      Disruption_Event: { color: '#ff4c4c', icon: 'crisis_alert', description: 'Port strike, geopolitical embargo, or canal blockage' },
    },
    edgeTypes: ['SHIPS_TO', 'SUPPLIES', 'STOCKS', 'BLOCKED_BY', 'PRODUCES'],
    nodes: [
      { id: 'fac-tsmc-fab18', label: 'TSMC Fab 18 (Tainan)', type: 'Factory', community: 1, pagerank: 0.088, properties: { nodeSize: '3nm / 5nm', outputWafers: '120k/mo', utilization: '99%' } },
      { id: 'fac-foxconn-sz', label: 'Foxconn Longhua Complex', type: 'Factory', community: 1, pagerank: 0.076, properties: { workers: 180000, lineEfficiency: '97%' } },
      { id: 'fac-tesla-giga4', label: 'Giga Berlin-Brandenburg', type: 'Factory', community: 2, pagerank: 0.071, properties: { annualCapacity: 375000, roboticsLevel: '95%' } },

      { id: 'sup-asml-veldhoven', label: 'ASML Veldhoven (EUV Litho)', type: 'Supplier', community: 1, pagerank: 0.082, properties: { leadTimeWeeks: 52, monopolyShare: '100% High-NA' } },
      { id: 'sup-carl-zeiss', label: 'Carl Zeiss SMT (Optics)', type: 'Supplier', community: 1, pagerank: 0.065, properties: { precisionMirrorUnits: true } },
      { id: 'sup-catl-battery', label: 'CATL Yibin Cell Plant', type: 'Supplier', community: 2, pagerank: 0.068, properties: { chem: 'LFP / Qilin', gWhCapacity: 60 } },

      { id: 'mat-neon-gas', label: 'High-Purity Neon Gas (99.999%)', type: 'Raw_Material', community: 1, pagerank: 0.060, properties: { globalBufferDays: 24, source: 'Black Sea Refineries' } },
      { id: 'mat-lithium-carb', label: 'Battery-Grade Lithium Carbonate', type: 'Raw_Material', community: 2, pagerank: 0.064, properties: { pricePerTon: '$18,200', purity: '99.5%' } },
      { id: 'mat-silicon-poly', label: 'Electronic Polysilicon 11N', type: 'Raw_Material', community: 1, pagerank: 0.057, properties: { supplierLead: '8 weeks' } },

      { id: 'wh-rotterdam-hub', label: 'Port of Rotterdam DistriPark', type: 'Warehouse', community: 2, pagerank: 0.062, properties: { teusAnnual: '14.5M', customsAutomated: true } },
      { id: 'wh-singapore-jurong', label: 'Jurong Island Logistics Center', type: 'Warehouse', community: 1, pagerank: 0.066, properties: { bondedStorage: true, capacitySqM: 850000 } },
      { id: 'wh-chicago-midwest', label: 'O\'Hare Air Cargo Logistics Hub', type: 'Warehouse', community: 3, pagerank: 0.054, properties: { coldChainCertified: true } },

      { id: 'route-malacca-strait', label: 'Malacca Strait Sea Lane', type: 'Shipping_Route', community: 1, pagerank: 0.070, properties: { dailyVessels: 250, criticalChoke: true } },
      { id: 'route-suez-canal', label: 'Suez Canal / Red Sea Transit', type: 'Shipping_Route', community: 2, pagerank: 0.075, properties: { detourViaCapeDays: 14, insuranceIndex: 'High' } },

      { id: 'event-red-sea-crisis', label: 'Red Sea Maritime Blockade', type: 'Disruption_Event', community: 2, pagerank: 0.079, properties: { impactLevel: 'CRITICAL', freightRateSurge: '+280%', active: true } },
      { id: 'event-drought-panama', label: 'Panama Canal Transit Restrictions', type: 'Disruption_Event', community: 3, pagerank: 0.058, properties: { dailySlotsCut: 18, delayDays: 9 } },
    ],
    edges: [
      { source: 'sup-asml-veldhoven', target: 'fac-tsmc-fab18', type: 'SUPPLIES', weight: 1.0, timestamp: '2026-01-05T00:00:00Z' },
      { source: 'sup-carl-zeiss', target: 'sup-asml-veldhoven', type: 'SUPPLIES', weight: 0.98, timestamp: '2026-01-02T00:00:00Z' },
      { source: 'mat-silicon-poly', target: 'fac-tsmc-fab18', type: 'SUPPLIES', weight: 0.90, timestamp: '2026-01-10T00:00:00Z' },
      { source: 'mat-neon-gas', target: 'fac-tsmc-fab18', type: 'SUPPLIES', weight: 0.88, timestamp: '2026-01-12T00:00:00Z' },

      { source: 'fac-tsmc-fab18', target: 'fac-foxconn-sz', type: 'SHIPS_TO', weight: 0.95, timestamp: '2026-01-20T00:00:00Z' },
      { source: 'fac-tsmc-fab18', target: 'route-malacca-strait', type: 'SHIPS_TO', weight: 0.92, timestamp: '2026-01-22T00:00:00Z' },
      { source: 'route-malacca-strait', target: 'wh-singapore-jurong', type: 'SHIPS_TO', weight: 0.94, timestamp: '2026-01-24T00:00:00Z' },

      { source: 'sup-catl-battery', target: 'fac-tesla-giga4', type: 'SHIPS_TO', weight: 0.91, timestamp: '2026-02-01T00:00:00Z' },
      { source: 'mat-lithium-carb', target: 'sup-catl-battery', type: 'SUPPLIES', weight: 0.96, timestamp: '2026-01-15T00:00:00Z' },

      { source: 'wh-singapore-jurong', target: 'route-suez-canal', type: 'SHIPS_TO', weight: 0.89, timestamp: '2026-02-05T00:00:00Z' },
      { source: 'route-suez-canal', target: 'wh-rotterdam-hub', type: 'SHIPS_TO', weight: 0.87, timestamp: '2026-02-12T00:00:00Z' },
      { source: 'wh-rotterdam-hub', target: 'fac-tesla-giga4', type: 'SHIPS_TO', weight: 0.85, timestamp: '2026-02-15T00:00:00Z' },

      { source: 'event-red-sea-crisis', target: 'route-suez-canal', type: 'BLOCKED_BY', weight: 1.0, timestamp: '2026-02-08T00:00:00Z' },
      { source: 'event-drought-panama', target: 'wh-chicago-midwest', type: 'BLOCKED_BY', weight: 0.75, timestamp: '2026-02-10T00:00:00Z' },
      { source: 'fac-foxconn-sz', target: 'wh-chicago-midwest', type: 'SHIPS_TO', weight: 0.83, timestamp: '2026-02-18T00:00:00Z' },
    ],
  },

  // ── 6. CORPORATE KNOWLEDGE BASE & ACADEMIC CITATIONS ───────────────────────
  citations: {
    id: 'citations',
    name: 'Research Citations & Scientific Collaboration',
    description: 'Foundational AI papers, author co-authorship graphs, patent dependencies, and cross-institutional labs.',
    icon: 'auto_stories',
    nodeTypes: {
      Author: { color: '#00b4ff', icon: 'person', description: 'Principal investigator or research scientist' },
      Paper: { color: '#4ade80', icon: 'description', description: 'Published peer-reviewed paper or preprint' },
      Institution: { color: '#ffd700', icon: 'account_balance', description: 'University or corporate research laboratory' },
      Topic: { color: '#a855f7', icon: 'category', description: 'Scientific domain or technological taxonomy' },
      Patent: { color: '#ff8c00', icon: 'workspace_premium', description: 'Granted intellectual property or patent claim' },
    },
    edgeTypes: ['AUTHORED', 'CITES', 'AFFILIATED_WITH', 'COVERS_TOPIC', 'DERIVED_FROM'],
    nodes: [
      { id: 'inst-deepmind', label: 'Google DeepMind (London)', type: 'Institution', community: 1, pagerank: 0.088, properties: { country: 'UK', hIndexAvg: 94, founded: 2010 } },
      { id: 'inst-openai', label: 'OpenAI Research (SF)', type: 'Institution', community: 2, pagerank: 0.084, properties: { country: 'US', computeBudget: 'Ultra-High' } },
      { id: 'inst-stanford', label: 'Stanford University (HAI)', type: 'Institution', community: 3, pagerank: 0.078, properties: { endowment: '$36B', lab: 'Stanford AI Lab' } },

      { id: 'auth-vaswani', label: 'Ashish Vaswani', type: 'Author', community: 1, pagerank: 0.072, properties: { citationsTotal: 184000, hIndex: 48 } },
      { id: 'auth-shazeer', label: 'Noam Shazeer', type: 'Author', community: 1, pagerank: 0.069, properties: { citationsTotal: 195000, role: 'Character.AI / Google' } },
      { id: 'auth-hassabis', label: 'Sir Demis Hassabis', type: 'Author', community: 1, pagerank: 0.081, properties: { nobelPrizeChemistry: 2024, knighted: true } },
      { id: 'auth-jumper', label: 'John Jumper', type: 'Author', community: 1, pagerank: 0.075, properties: { nobelPrizeChemistry: 2024, leadAlphaFold: true } },
      { id: 'auth-sutskever', label: 'Ilya Sutskever', type: 'Author', community: 2, pagerank: 0.079, properties: { citationsTotal: 410000, hIndex: 78 } },

      { id: 'paper-attention', label: 'Attention Is All You Need (2017)', type: 'Paper', community: 1, pagerank: 0.095, properties: { citations: 142000, conf: 'NeurIPS 2017', seminal: true } },
      { id: 'paper-alphafold2', label: 'Highly Accurate Protein Prediction (2021)', type: 'Paper', community: 1, pagerank: 0.089, properties: { citations: 29000, journal: 'Nature', impactFactor: 64.8 } },
      { id: 'paper-gpt3', label: 'Language Models are Few-Shot Learners (2020)', type: 'Paper', community: 2, pagerank: 0.085, properties: { citations: 44000, conf: 'NeurIPS 2020' } },
      { id: 'paper-scaling', label: 'Scaling Laws for Neural Models (2020)', type: 'Paper', community: 2, pagerank: 0.062, properties: { empiricalPowerLaw: true } },

      { id: 'topic-transformer', label: 'Self-Attention / Transformers', type: 'Topic', community: 1, pagerank: 0.080, properties: { taxonomy: 'Deep Learning Architectures' } },
      { id: 'topic-bio-ai', label: 'Computational Structural Biology', type: 'Topic', community: 1, pagerank: 0.073, properties: { taxonomy: 'Biophysics / AI' } },
      { id: 'topic-rlhf', label: 'Reinforcement Learning from Human Feedback', type: 'Topic', community: 2, pagerank: 0.068, properties: { taxonomy: 'Alignment' } },

      { id: 'pat-us108', label: 'US Patent 10,885,291: Multi-Head Attention', type: 'Patent', community: 1, pagerank: 0.064, properties: { assignee: 'Google LLC', filed: 2018 } },
      { id: 'pat-us114', label: 'US Patent 11,417,402: Deep Protein Folding', type: 'Patent', community: 1, pagerank: 0.061, properties: { assignee: 'DeepMind Tech Ltd' } },
    ],
    edges: [
      { source: 'auth-vaswani', target: 'paper-attention', type: 'AUTHORED', weight: 1.0, timestamp: '2017-06-12T00:00:00Z' },
      { source: 'auth-shazeer', target: 'paper-attention', type: 'AUTHORED', weight: 1.0, timestamp: '2017-06-12T00:00:00Z' },
      { source: 'auth-vaswani', target: 'inst-deepmind', type: 'AFFILIATED_WITH', weight: 0.9, timestamp: '2017-01-01T00:00:00Z' },

      { source: 'auth-hassabis', target: 'inst-deepmind', type: 'AFFILIATED_WITH', weight: 1.0, timestamp: '2010-11-01T00:00:00Z' },
      { source: 'auth-jumper', target: 'inst-deepmind', type: 'AFFILIATED_WITH', weight: 1.0, timestamp: '2018-05-01T00:00:00Z' },
      { source: 'auth-jumper', target: 'paper-alphafold2', type: 'AUTHORED', weight: 1.0, timestamp: '2021-07-15T00:00:00Z' },
      { source: 'auth-hassabis', target: 'paper-alphafold2', type: 'AUTHORED', weight: 1.0, timestamp: '2021-07-15T00:00:00Z' },

      { source: 'auth-sutskever', target: 'inst-openai', type: 'AFFILIATED_WITH', weight: 1.0, timestamp: '2015-12-01T00:00:00Z' },
      { source: 'auth-sutskever', target: 'paper-gpt3', type: 'AUTHORED', weight: 0.95, timestamp: '2020-05-28T00:00:00Z' },
      { source: 'auth-sutskever', target: 'paper-scaling', type: 'AUTHORED', weight: 0.90, timestamp: '2020-01-20T00:00:00Z' },

      { source: 'paper-gpt3', target: 'paper-attention', type: 'CITES', weight: 1.0, timestamp: '2020-05-28T00:00:00Z' },
      { source: 'paper-alphafold2', target: 'paper-attention', type: 'CITES', weight: 0.95, timestamp: '2021-07-15T00:00:00Z' },
      { source: 'paper-scaling', target: 'paper-attention', type: 'CITES', weight: 0.88, timestamp: '2020-01-20T00:00:00Z' },

      { source: 'paper-attention', target: 'topic-transformer', type: 'COVERS_TOPIC', weight: 1.0, timestamp: '2017-06-12T00:00:00Z' },
      { source: 'paper-alphafold2', target: 'topic-bio-ai', type: 'COVERS_TOPIC', weight: 1.0, timestamp: '2021-07-15T00:00:00Z' },
      { source: 'paper-gpt3', target: 'topic-rlhf', type: 'COVERS_TOPIC', weight: 0.85, timestamp: '2020-05-28T00:00:00Z' },

      { source: 'pat-us108', target: 'paper-attention', type: 'DERIVED_FROM', weight: 0.96, timestamp: '2018-12-01T00:00:00Z' },
      { source: 'pat-us114', target: 'paper-alphafold2', type: 'DERIVED_FROM', weight: 0.94, timestamp: '2021-09-01T00:00:00Z' },
    ],
  },
};
