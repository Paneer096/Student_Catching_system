import { useState, useEffect } from 'react';
import { SideNavBar } from './components/layout/SideNavBar';
import { TopHeader } from './components/layout/TopHeader';
import { RoleSwitcherModal } from './components/layout/RoleSwitcherModal';

import { LoginView } from './views/LoginView';
import { DashboardView } from './views/DashboardView';
import { KnowledgeGraphView } from './views/KnowledgeGraphView';
import { DataIngestionView } from './views/DataIngestionView';
import { AlertsView } from './views/AlertsView';
import { InterventionsView } from './views/InterventionsView';
import { StudentRosterView } from './views/StudentRosterView';
import { CalendarRiskView } from './views/CalendarRiskView';
import { StudentMyDataView } from './views/StudentMyDataView';
import { api } from './api/client';

export const USER_PERSONAS: Record<
  string,
  { name: string; role: string; roleKey: string; clearance: string }
> = {
  CLASS_TEACHER: {
    name: 'Prof. Raghav Sharma',
    role: 'Class Teacher • AIML Sem 4',
    roleKey: 'CLASS_TEACHER',
    clearance: 'Classroom Full Clearance',
  },
  SUBJECT_TEACHER: {
    name: 'Dr. Anita Mehta',
    role: 'Subject Teacher • PHY301 Lab',
    roleKey: 'SUBJECT_TEACHER',
    clearance: 'Subject Limited Clearance',
  },
  HOD_DEAN: {
    name: 'Dean Vikram Kapoor',
    role: 'HOD / Academic Dean',
    roleKey: 'HOD_DEAN',
    clearance: 'Executive Institutional Level',
  },
  STUDENT: {
    name: 'Rohit Sharma (R.S.)',
    role: 'Student • Roll #21CSB014',
    roleKey: 'STUDENT',
    clearance: 'Student Privacy Portal',
  },
};

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(true);
  const [currentRoleKey, setCurrentRoleKey] = useState<string>('CLASS_TEACHER');
  const [activeView, setActiveView] = useState<string>('dashboard');
  const [activeSection, setActiveSection] = useState<string>('CS-3B');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStudentId, setSelectedStudentId] = useState<string>('21CSB007');
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [unreadAlertsCount, setUnreadAlertsCount] = useState<number>(0);

  // Theme state: light ("Jurisdiction") vs dark ("Obsidian")
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    const saved = localStorage.getItem('makerov_theme');
    if (saved) return saved === 'dark';
    return false;
  });

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      document.documentElement.classList.remove('light');
    } else {
      document.documentElement.classList.remove('dark');
      document.documentElement.classList.add('light');
    }
    localStorage.setItem('makerov_theme', isDarkMode ? 'dark' : 'light');
  }, [isDarkMode]);

  // Fetch real unread alert count from backend
  useEffect(() => {
    api
      .getMassBunks(activeSection)
      .then((bunks) => setUnreadAlertsCount(bunks.length))
      .catch(() => setUnreadAlertsCount(0));
  }, [activeSection, activeView]);

  const toggleTheme = () => setIsDarkMode((prev) => !prev);

  const currentUser = USER_PERSONAS[currentRoleKey] || USER_PERSONAS.CLASS_TEACHER;

  const handleRoleSelect = (newRoleKey: string) => {
    setCurrentRoleKey(newRoleKey);
    if (newRoleKey === 'STUDENT') {
      setActiveView('student-portal');
    } else if (activeView === 'student-portal') {
      setActiveView('dashboard');
    }
  };

  const handleNavigate = (viewId: string, params?: any) => {
    if (params?.studentId) {
      setSelectedStudentId(params.studentId);
    }
    setActiveView(viewId);
  };

  const handleExportReport = async () => {
    try {
      const summary = await api.getDashboardSummary(activeSection);
      const blob = new Blob([JSON.stringify(summary, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Makerove_Intelligence_Report_${activeSection}_${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      alert(`Export failed: ${err.message}`);
    }
  };

  if (!isAuthenticated) {
    return (
      <LoginView
        onLoginSuccess={(roleKey) => {
          handleRoleSelect(roleKey);
          setIsAuthenticated(true);
        }}
      />
    );
  }

  return (
    <div className="bg-background text-on-surface h-screen flex antialiased font-sans overflow-hidden">
      {/* Fixed Left Navigation Bar */}
      <SideNavBar
        activeView={activeView}
        onViewChange={(v) => {
          if (v === 'settings') {
            setShowRoleModal(true);
          } else {
            setActiveView(v);
          }
        }}
        currentUser={currentUser}
        onRoleClick={() => setShowRoleModal(true)}
        unreadAlertsCount={unreadAlertsCount}
      />

      {/* Top Header & Main Canvas */}
      <div className="flex-1 ml-[260px] flex flex-col h-screen overflow-hidden relative">
        <TopHeader
          currentUser={currentUser}
          activeSection={activeSection}
          onSectionChange={setActiveSection}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          onNotificationsClick={() => setActiveView('alerts')}
          onExportReport={handleExportReport}
          onOpenIngest={() => setActiveView('ingestion')}
          unreadCount={unreadAlertsCount}
          isDarkMode={isDarkMode}
          onToggleTheme={toggleTheme}
        />

        {/* Scrollable Main Content Area */}
        <main className="flex-1 mt-[64px] p-6 overflow-y-auto bg-background">
          {activeView === 'dashboard' && (
            <DashboardView
              onNavigate={handleNavigate}
              onSelectStudent={setSelectedStudentId}
              activeSection={activeSection}
            />
          )}

          {(activeView === 'knowledge-graph' || activeView === 'graph') && (
            <KnowledgeGraphView
              initialStudentId={selectedStudentId}
              onNavigate={handleNavigate}
              activeSection={activeSection}
              onSelectStudent={setSelectedStudentId}
            />
          )}

          {activeView === 'ingestion' && (
            <DataIngestionView onNavigate={handleNavigate} />
          )}

          {activeView === 'alerts' && (
            <AlertsView
              onNavigate={handleNavigate}
              activeSection={activeSection}
            />
          )}

          {activeView === 'interventions' && (
            <InterventionsView
              initialStudentId={selectedStudentId}
              onNavigate={handleNavigate}
              activeSection={activeSection}
            />
          )}

          {activeView === 'students' && (
            <StudentRosterView
              initialStudentId={selectedStudentId}
              onNavigate={handleNavigate}
              onSelectStudent={setSelectedStudentId}
              activeSection={activeSection}
            />
          )}

          {activeView === 'calendar' && (
            <CalendarRiskView
              onNavigate={handleNavigate}
              activeSection={activeSection}
            />
          )}

          {activeView === 'student-portal' && (
            <StudentMyDataView />
          )}
        </main>
      </div>

      {/* Role / Clearance Persona Switcher Modal */}
      <RoleSwitcherModal
        isOpen={showRoleModal}
        onClose={() => setShowRoleModal(false)}
        currentRoleKey={currentRoleKey}
        onSelectRole={handleRoleSelect}
        isDarkMode={isDarkMode}
        onToggleTheme={toggleTheme}
      />
    </div>
  );
}
