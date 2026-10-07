import React, { useState, useEffect } from 'react';
import {
  api,
  InterventionItem,
  StudentRosterItem,
  DispatchedEmailRecord,
  SendEmailPayload,
} from '../api/client';

export interface InterventionsViewProps {
  onNavigate: (viewId: string, params?: any) => void;
  initialStudentId?: string;
  activeSection?: string;
}

export const InterventionsView: React.FC<InterventionsViewProps> = ({
  onNavigate: _onNavigate,
  initialStudentId,
  activeSection = 'CS-3B',
}) => {
  // Navigation Tabs
  const [activeTab, setActiveTab] = useState<'email' | 'playbooks' | 'outbox'>('email');

  // Roster & Student Selection
  const [roster, setRoster] = useState<StudentRosterItem[]>([]);
  const [loadingRoster, setLoadingRoster] = useState(false);
  const [selectedStudentRoll, setSelectedStudentRoll] = useState<string>(initialStudentId || '21CSB007');

  // Email Dispatch State
  const [emailCategory, setEmailCategory] = useState<'behavior' | 'attendance' | 'academic' | 'wellbeing' | 'general'>('behavior');
  const [emailSubject, setEmailSubject] = useState('Observation Regarding Classroom Conduct & Lab Engagement');
  const [emailBody, setEmailBody] = useState('');
  const [emailPriority, setEmailPriority] = useState<'normal' | 'high' | 'urgent'>('normal');
  const [ccCounselor, setCcCounselor] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [emailSuccess, setEmailSuccess] = useState<{ id: string; recipient: string; message: string } | null>(null);

  // Outbox State
  const [outbox, setOutbox] = useState<DispatchedEmailRecord[]>([]);
  const [loadingOutbox, setLoadingOutbox] = useState(false);

  // Playbook Case File Form State
  const [interventions, setInterventions] = useState<InterventionItem[]>([]);
  const [loadingInterventions, setLoadingInterventions] = useState(false);
  const [playbookCohort, setPlaybookCohort] = useState('Cohort CS-3B');
  const [playbookStudents, setPlaybookStudents] = useState(initialStudentId ? initialStudentId : '21CSB007, 21CSB014');
  const [playbookType, setPlaybookType] = useState('PEER_MENTORING');
  const [playbookNotes, setPlaybookNotes] = useState('');
  const [submittingPlaybook, setSubmittingPlaybook] = useState(false);
  const [playbookSuccess, setPlaybookSuccess] = useState<string | null>(null);

  // Load section roster
  const fetchRoster = async () => {
    setLoadingRoster(true);
    try {
      const data = await api.getStudentsRoster(activeSection);
      setRoster(data);
      if (data.length > 0 && !selectedStudentRoll) {
        setSelectedStudentRoll(data[0].roll_no);
      }
    } catch (err) {
      console.error('Failed to load roster', err);
    } finally {
      setLoadingRoster(false);
    }
  };

  // Load sent communications outbox
  const fetchOutbox = async () => {
    setLoadingOutbox(true);
    try {
      const data = await api.getDispatchedEmails(activeSection);
      setOutbox(data);
    } catch (err) {
      console.error('Failed to load outbox', err);
    } finally {
      setLoadingOutbox(false);
    }
  };

  // Load playbook interventions
  const fetchInterventions = async () => {
    setLoadingInterventions(true);
    try {
      const data = await api.getInterventions(activeSection);
      setInterventions(data);
    } catch (err) {
      console.error('Failed to load interventions', err);
    } finally {
      setLoadingInterventions(false);
    }
  };

  useEffect(() => {
    fetchRoster();
    fetchOutbox();
    fetchInterventions();
  }, [activeSection]);

  const currentStudent = roster.find((s) => s.roll_no === selectedStudentRoll) || roster[0];
  const studentName = currentStudent?.name || `Student (${selectedStudentRoll})`;
  const studentEmail = `${selectedStudentRoll.toLowerCase()}@college.edu`;

  // Quick Template Applicator
  const applyEmailTemplate = (templateKey: 'behavior' | 'attendance' | 'academic' | 'wellbeing' | 'praise') => {
    const sName = currentStudent?.name || 'Student';
    switch (templateKey) {
      case 'behavior':
        setEmailCategory('behavior');
        setEmailSubject(`Guidance on Classroom Decorum & Lab Session Focus — ${activeSection}`);
        setEmailBody(
          `Dear ${sName},\n\nI am reaching out to share a few observations regarding your engagement during our recent practical laboratory and classroom sessions. Active collaboration and respect for classroom timing are vital for your cohort's learning environment.\n\nI would appreciate if you could meet me briefly after tomorrow's period so we can align on expectations and discuss any challenges you might be experiencing.\n\nBest regards,\nProf. Raghav Sharma\nClass Teacher • Department of Computer Science & Engineering`
        );
        setEmailPriority('normal');
        break;

      case 'attendance':
        setEmailCategory('attendance');
        setEmailSubject(`Notice of Attendance Requirement & Academic Policy — Section ${activeSection}`);
        setEmailBody(
          `Dear ${sName},\n\nThis is an official advisory regarding your attendance record for the ongoing semester. Current attendance logs indicate your presence is approaching or below the statutory 75% institutional threshold.\n\nFailure to maintain 75% attendance across lecture and practical slots will jeopardize your eligibility to appear for semester end examinations. Please treat this notice with priority and ensure consistent attendance in upcoming classes.\n\nWarm regards,\nProf. Raghav Sharma\nClass Teacher • Section ${activeSection}`
        );
        setEmailPriority('high');
        break;

      case 'academic':
        setEmailCategory('academic');
        setEmailSubject(`Academic Support & Doubt Clearance Session — Section ${activeSection}`);
        setEmailBody(
          `Dear ${sName},\n\nDuring recent problem-solving sessions and evaluations, I noticed a few areas where further clarification would help strengthen your conceptual grasp before the upcoming midterm assessments.\n\nI have reserved dedicated office hours on Wednesday from 3:30 PM to 4:30 PM for individual and small group doubt clearance. You are strongly encouraged to attend with your coursework notes.\n\nSincerely,\nProf. Raghav Sharma\nCourse Instructor & Mentor`
        );
        setEmailPriority('normal');
        break;

      case 'wellbeing':
        setEmailCategory('wellbeing');
        setEmailSubject(`Check-in & Student Support — Department of Computer Science`);
        setEmailBody(
          `Dear ${sName},\n\nI am reaching out for a brief supportive check-in. The faculty team wants to ensure you are doing well and navigating academic deadlines comfortably.\n\nIf you are experiencing any personal, health, or academic stress, please know that guidance and institutional counseling support are always available. My office door is always open for a confidential discussion.\n\nBest wishes,\nProf. Raghav Sharma\nStudent Mentor`
        );
        setEmailPriority('normal');
        break;

      case 'praise':
        setEmailCategory('general');
        setEmailSubject(`Commendation: Noticeable Improvement & Positive Classroom Engagement`);
        setEmailBody(
          `Dear ${sName},\n\nI wanted to take a moment to commend you on your positive turnaround and active participation over the last two weeks. Your punctual attendance and dedication in lab coursework have been exemplary.\n\nKeep maintaining this great momentum throughout the remainder of the term!\n\nBest regards,\nProf. Raghav Sharma\nClass Teacher`
        );
        setEmailPriority('normal');
        break;
    }
  };

  // Set default body on mount if empty
  useEffect(() => {
    if (!emailBody) {
      applyEmailTemplate('behavior');
    }
  }, [currentStudent]);

  // Handle Send Student Email
  const handleSendEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailSubject.trim() || !emailBody.trim()) {
      alert('Please provide both an email subject and message body.');
      return;
    }

    setSendingEmail(true);
    setEmailSuccess(null);
    try {
      const payload: SendEmailPayload = {
        student_roll: selectedStudentRoll,
        student_name: studentName,
        student_email: studentEmail,
        category: emailCategory,
        subject: emailSubject.trim(),
        body: emailBody.trim(),
        sender_name: 'Prof. Raghav Sharma',
        sender_role: 'Class Teacher',
        cc_counselor: ccCounselor,
        priority: emailPriority,
        section: activeSection,
      };

      const res = await api.sendStudentEmail(payload);
      setEmailSuccess({
        id: res.email_id,
        recipient: res.recipient,
        message: res.message,
      });

      // Refresh outbox and interventions
      await fetchOutbox();
      await fetchInterventions();
    } catch (err: any) {
      alert(`Failed to dispatch email: ${err?.message || 'Server error'}`);
    } finally {
      setSendingEmail(false);
    }
  };

  // Handle Playbook Intervention Submission
  const handleSubmitPlaybook = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!playbookNotes.trim()) {
      alert('Please enter action details and guidance notes.');
      return;
    }

    setSubmittingPlaybook(true);
    setPlaybookSuccess(null);
    try {
      const rolls = playbookStudents
        .split(',')
        .map((r) => r.trim().toUpperCase())
        .filter(Boolean);

      const res = await api.createIntervention({
        student_ids: rolls,
        type: playbookType,
        trigger_context: `Proactive classroom check-in for ${playbookCohort}`,
        notes: playbookNotes,
        assigned_to: 'Class Teacher',
      });

      setPlaybookSuccess(`Intervention case successfully recorded (ID: ${res.id}).`);
      setPlaybookNotes('');
      await fetchInterventions();
    } catch (err: any) {
      alert(`Failed to log intervention: ${err?.message || 'Server error'}`);
    } finally {
      setSubmittingPlaybook(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-5 pb-8">
      {/* ─── Header & Navigation Tabs ───────────────────────────────────────────── */}
      <div className="flex flex-wrap justify-between items-start gap-4 border-b border-outline-variant pb-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
              <span className="material-symbols-outlined text-[20px]">mark_email_read</span>
            </div>
            <div>
              <h1 className="text-xl font-bold text-on-surface tracking-tight">
                Teacher Interventions &amp; Student Advisory Hub
              </h1>
              <p className="text-xs text-on-surface-variant mt-0.5">
                Dispatch personalized guidance emails, manage conduct advisories, and log supportive interventions for Section {activeSection}.
              </p>
            </div>
          </div>
        </div>

        {/* View Switcher Tabs */}
        <div className="flex items-center bg-surface-container-lowest border border-outline-variant rounded-xl p-1 shadow-2xs text-xs font-semibold">
          <button
            onClick={() => setActiveTab('email')}
            className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'email'
                ? 'bg-primary text-on-primary shadow-xs'
                : 'text-on-surface-variant hover:text-on-surface'
            }`}
          >
            <span className="material-symbols-outlined text-[16px]">forward_to_inbox</span>
            Email Student
          </button>

          <button
            onClick={() => setActiveTab('outbox')}
            className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'outbox'
                ? 'bg-primary text-on-primary shadow-xs'
                : 'text-on-surface-variant hover:text-on-surface'
            }`}
          >
            <span className="material-symbols-outlined text-[16px]">outbox</span>
            Outbox ({outbox.length})
          </button>

          <button
            onClick={() => setActiveTab('playbooks')}
            className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'playbooks'
                ? 'bg-primary text-on-primary shadow-xs'
                : 'text-on-surface-variant hover:text-on-surface'
            }`}
          >
            <span className="material-symbols-outlined text-[16px]">folder_special</span>
            Strategic Playbooks ({interventions.length})
          </button>
        </div>
      </div>

      {/* ─── TAB 1: DIRECT STUDENT EMAIL DISPATCH ───────────────────────────────── */}
      {activeTab === 'email' && (
        <div className="grid grid-cols-12 gap-6">
          {/* Email Composer Form (Col 8) */}
          <div className="col-span-12 lg:col-span-8 bg-surface-container-lowest border border-outline-variant rounded-2xl p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-outline-variant pb-3">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-[20px]">send</span>
                <h3 className="text-sm font-bold text-on-surface">Compose Student Advisory Email</h3>
              </div>
              <span className="text-[10px] font-mono text-on-surface-variant bg-surface-container px-2 py-0.5 rounded-full">
                Sender: Prof. Raghav Sharma (Class Teacher)
              </span>
            </div>

            {/* Success Banner */}
            {emailSuccess && (
              <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-xs text-emerald-700 dark:text-emerald-400 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-[18px]">verified</span>
                  <div>
                    <span className="font-bold block">Advisory Email Dispatched Successfully!</span>
                    <span className="text-[11px] opacity-90">{emailSuccess.message}</span>
                  </div>
                </div>
                <button
                  onClick={() => setActiveTab('outbox')}
                  className="px-2.5 py-1 bg-emerald-600 text-white rounded-lg text-[11px] font-semibold hover:bg-emerald-700 transition-colors cursor-pointer shrink-0"
                >
                  View in Outbox
                </button>
              </div>
            )}

            <form onSubmit={handleSendEmail} className="space-y-4 text-xs">
              {/* Recipient Selector */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-on-surface block mb-1">Target Student</label>
                  <select
                    value={selectedStudentRoll}
                    onChange={(e) => setSelectedStudentRoll(e.target.value)}
                    className="w-full px-3 py-2 bg-surface-container-low border border-outline-variant rounded-xl text-on-surface focus:outline-none focus:border-primary cursor-pointer text-xs"
                  >
                    {loadingRoster ? (
                      <option>Loading student roster...</option>
                    ) : (
                      roster.map((s) => (
                        <option key={s.roll_no} value={s.roll_no}>
                          {s.roll_no} — {s.name} ({s.attendance_pct}% Att.)
                        </option>
                      ))
                    )}
                  </select>
                </div>

                <div>
                  <label className="font-semibold text-on-surface block mb-1">Institutional Email Address</label>
                  <div className="px-3 py-2 bg-surface-container border border-outline-variant rounded-xl text-on-surface-variant font-mono text-xs flex items-center justify-between">
                    <span>{studentEmail}</span>
                    <span className="text-[10px] text-primary font-bold">Verified</span>
                  </div>
                </div>
              </div>

              {/* Category Pills */}
              <div>
                <label className="font-semibold text-on-surface block mb-1.5">Advisory Subject Category</label>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    { id: 'behavior', label: 'Behavior & Conduct', icon: 'psychology' },
                    { id: 'attendance', label: 'Attendance Advisory', icon: 'event_busy' },
                    { id: 'academic', label: 'Academic Doubt Clearance', icon: 'school' },
                    { id: 'wellbeing', label: 'Wellbeing & Support', icon: 'health_and_safety' },
                    { id: 'general', label: 'General Notice', icon: 'notifications' },
                  ].map((cat) => (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setEmailCategory(cat.id as any)}
                      className={`px-3 py-1.5 rounded-xl font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                        emailCategory === cat.id
                          ? 'bg-primary text-on-primary shadow-xs'
                          : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high'
                      }`}
                    >
                      <span className="material-symbols-outlined text-[15px]">{cat.icon}</span>
                      {cat.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Quick Template Buttons */}
              <div className="p-3 bg-surface-container-low/50 rounded-xl border border-outline-variant/60 space-y-2">
                <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider block">
                  One-Click Faculty Draft Templates
                </span>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => applyEmailTemplate('behavior')}
                    className="px-2.5 py-1 bg-surface-container hover:bg-primary/20 text-on-surface hover:text-primary rounded-lg text-[11px] font-medium transition-colors cursor-pointer"
                  >
                    Lab Conduct &amp; Focus
                  </button>
                  <button
                    type="button"
                    onClick={() => applyEmailTemplate('attendance')}
                    className="px-2.5 py-1 bg-surface-container hover:bg-rose-500/20 text-on-surface hover:text-rose-600 rounded-lg text-[11px] font-medium transition-colors cursor-pointer"
                  >
                    Attendance Dip Warning
                  </button>
                  <button
                    type="button"
                    onClick={() => applyEmailTemplate('academic')}
                    className="px-2.5 py-1 bg-surface-container hover:bg-indigo-500/20 text-on-surface hover:text-indigo-600 rounded-lg text-[11px] font-medium transition-colors cursor-pointer"
                  >
                    Midterm Concept Clarification
                  </button>
                  <button
                    type="button"
                    onClick={() => applyEmailTemplate('praise')}
                    className="px-2.5 py-1 bg-surface-container hover:bg-emerald-500/20 text-on-surface hover:text-emerald-600 rounded-lg text-[11px] font-medium transition-colors cursor-pointer"
                  >
                    Commendation / Praise
                  </button>
                  <button
                    type="button"
                    onClick={() => applyEmailTemplate('wellbeing')}
                    className="px-2.5 py-1 bg-surface-container hover:bg-amber-500/20 text-on-surface hover:text-amber-600 rounded-lg text-[11px] font-medium transition-colors cursor-pointer"
                  >
                    Wellbeing Check-in
                  </button>
                </div>
              </div>

              {/* Subject Line */}
              <div>
                <label className="font-semibold text-on-surface block mb-1">Subject Line</label>
                <input
                  type="text"
                  required
                  value={emailSubject}
                  onChange={(e) => setEmailSubject(e.target.value)}
                  placeholder="e.g. Guidance on Classroom Engagement..."
                  className="w-full px-3 py-2 bg-surface-container-low border border-outline-variant rounded-xl text-on-surface font-medium focus:outline-none focus:border-primary text-xs"
                />
              </div>

              {/* Email Body */}
              <div>
                <label className="font-semibold text-on-surface block mb-1">Official Message Body</label>
                <textarea
                  rows={8}
                  required
                  value={emailBody}
                  onChange={(e) => setEmailBody(e.target.value)}
                  placeholder="Write clear, supportive, and actionable guidance for the student..."
                  className="w-full px-3 py-2.5 bg-surface-container-low border border-outline-variant rounded-xl text-on-surface focus:outline-none focus:border-primary text-xs leading-relaxed font-sans"
                />
              </div>

              {/* Priority & CC Options */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="font-semibold text-on-surface block mb-1">Advisory Priority</label>
                  <div className="flex gap-2">
                    {(['normal', 'high', 'urgent'] as const).map((p) => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setEmailPriority(p)}
                        className={`flex-1 py-1.5 rounded-lg font-semibold capitalize text-center transition-all cursor-pointer ${
                          emailPriority === p
                            ? p === 'urgent'
                              ? 'bg-rose-500 text-white shadow-xs'
                              : p === 'high'
                              ? 'bg-amber-500 text-white shadow-xs'
                              : 'bg-primary text-on-primary shadow-xs'
                            : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high'
                        }`}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex items-center justify-between p-2.5 rounded-xl bg-surface-container-low border border-outline-variant/60">
                  <div>
                    <span className="font-semibold text-on-surface block text-[11px]">CC Academic Counselor</span>
                    <span className="text-[10px] text-on-surface-variant">Keep student guidance records in institutional sync</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={ccCounselor}
                    onChange={(e) => setCcCounselor(e.target.checked)}
                    className="w-4 h-4 text-primary rounded cursor-pointer"
                  />
                </div>
              </div>

              {/* Submit Button */}
              <div className="pt-2 border-t border-outline-variant flex justify-between items-center">
                <span className="text-[10px] font-mono text-on-surface-variant">
                  Encrypted &amp; anchored to institutional tamper-evident audit ledger
                </span>
                <button
                  type="submit"
                  disabled={sendingEmail}
                  className="px-5 py-2.5 bg-primary text-on-primary rounded-xl font-bold hover:opacity-90 transition-opacity flex items-center gap-2 cursor-pointer disabled:opacity-50 shadow-xs text-xs"
                >
                  <span className={`material-symbols-outlined text-[16px] ${sendingEmail ? 'animate-spin' : ''}`}>
                    {sendingEmail ? 'sync' : 'send'}
                  </span>
                  {sendingEmail ? 'Dispatching Official Email...' : 'Send Email to Student'}
                </button>
              </div>
            </form>
          </div>

          {/* Student Dossier Summary Panel (Col 4) */}
          <div className="col-span-12 lg:col-span-4 space-y-4">
            <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-5 shadow-xs space-y-3.5">
              <div className="flex items-center gap-2 border-b border-outline-variant pb-3">
                <span className="material-symbols-outlined text-primary text-[20px]">badge</span>
                <h3 className="text-sm font-bold text-on-surface">Recipient Dossier</h3>
              </div>

              {currentStudent ? (
                <div className="space-y-3 text-xs">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold text-base">
                      {currentStudent.name.slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <h4 className="font-bold text-on-surface text-sm">{currentStudent.name}</h4>
                      <span className="font-mono text-primary font-semibold text-[11px]">{currentStudent.roll_no}</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-outline-variant/60 font-mono text-[11px]">
                    <div className="p-2 rounded-lg bg-surface-container-low">
                      <span className="text-[10px] text-on-surface-variant block">Attendance Rate</span>
                      <span className={`font-bold text-sm ${currentStudent.attendance_pct < 75 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600'}`}>
                        {currentStudent.attendance_pct}%
                      </span>
                    </div>

                    <div className="p-2 rounded-lg bg-surface-container-low">
                      <span className="text-[10px] text-on-surface-variant block">Cohort Group</span>
                      <span className="font-bold text-sm text-on-surface truncate block">
                        {currentStudent.cohort || 'CS-3B Main'}
                      </span>
                    </div>
                  </div>

                  <div className="p-3 bg-surface-container-low rounded-xl border border-outline-variant/60 space-y-1 text-[11px]">
                    <span className="font-semibold text-on-surface block">Advisory Protocol:</span>
                    <p className="text-on-surface-variant leading-relaxed">
                      All correspondence sent via Makerove creates a cryptographic delivery timestamp and updates student guidance records. Students receive alerts on college mail and student portal.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="py-8 text-center text-xs text-on-surface-variant">Select a student from the dropdown.</div>
              )}
            </div>

            {/* Recent Outbox Preview */}
            <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-5 shadow-xs space-y-3">
              <div className="flex justify-between items-center border-b border-outline-variant pb-2.5">
                <h4 className="text-xs font-bold text-on-surface uppercase tracking-wider">Recent Sent Notices</h4>
                <button
                  onClick={() => setActiveTab('outbox')}
                  className="text-[11px] text-primary font-semibold hover:underline cursor-pointer"
                >
                  View All ({outbox.length})
                </button>
              </div>

              {outbox.length === 0 ? (
                <div className="py-6 text-center text-xs text-on-surface-variant">No advisories dispatched yet.</div>
              ) : (
                <div className="space-y-2">
                  {outbox.slice(0, 3).map((em) => (
                    <div key={em.id} className="p-2.5 rounded-xl border border-outline-variant bg-surface-container-low/40 text-xs space-y-1">
                      <div className="flex justify-between items-center">
                        <span className="font-bold text-on-surface truncate">{em.student_name}</span>
                        <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-bold">
                          {em.status}
                        </span>
                      </div>
                      <p className="text-[11px] text-on-surface-variant truncate">{em.subject}</p>
                      <span className="text-[9px] font-mono text-on-surface-variant block">
                        {em.timestamp ? em.timestamp.slice(0, 16).replace('T', ' ') : 'Just now'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ─── TAB 2: SENT COMMUNICATIONS OUTBOX ──────────────────────────────────── */}
      {activeTab === 'outbox' && (
        <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl shadow-xs overflow-hidden">
          <div className="p-4 bg-surface-container-low border-b border-outline-variant flex justify-between items-center">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-[20px]">outbox</span>
              <h3 className="text-sm font-bold text-on-surface">Teacher Communication Outbox &amp; Delivery Receipts</h3>
            </div>
            <button
              onClick={fetchOutbox}
              className="text-xs text-primary font-semibold hover:underline flex items-center gap-1 cursor-pointer"
            >
              <span className="material-symbols-outlined text-[14px]">refresh</span> Refresh Receipts
            </button>
          </div>

          <div className="p-4">
            {loadingOutbox ? (
              <div className="py-16 text-center text-xs text-on-surface-variant flex flex-col items-center justify-center space-y-2">
                <span className="material-symbols-outlined text-[24px] text-primary animate-spin">sync</span>
                <span>Fetching delivery log...</span>
              </div>
            ) : outbox.length === 0 ? (
              <div className="py-16 text-center text-xs text-on-surface-variant space-y-2">
                <span className="material-symbols-outlined text-[36px] text-outline">mark_email_unread</span>
                <p className="font-semibold text-on-surface">No Dispatched Emails Yet</p>
                <p className="max-w-xs mx-auto">
                  Use the 'Email Student' tab to send guidance, behavioral notes, or academic advisories.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {outbox.map((email) => (
                  <div
                    key={email.id}
                    className="p-4 rounded-xl border border-outline-variant bg-surface hover:bg-surface-container-low transition-colors space-y-2.5 text-xs"
                  >
                    <div className="flex flex-wrap justify-between items-start gap-2">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-on-surface text-sm">{email.student_name}</span>
                          <span className="font-mono text-[11px] text-primary font-semibold">{email.student_roll}</span>
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-surface-container text-on-surface-variant">
                            {email.student_email}
                          </span>
                        </div>
                        <h4 className="font-bold text-on-surface text-xs mt-1">{email.subject}</h4>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                          email.priority === 'urgent'
                            ? 'bg-rose-500/15 text-rose-600 dark:text-rose-400'
                            : email.priority === 'high'
                            ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
                            : 'bg-primary-container text-on-primary-container'
                        }`}>
                          {email.category} • {email.priority}
                        </span>

                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1">
                          <span className="material-symbols-outlined text-[13px]">check_circle</span>
                          {email.status}
                        </span>
                      </div>
                    </div>

                    <p className="text-on-surface leading-relaxed bg-surface-container-low/60 p-3 rounded-lg border border-outline-variant/40 whitespace-pre-wrap font-sans text-xs">
                      {email.body}
                    </p>

                    <div className="pt-2 border-t border-outline-variant/60 flex flex-wrap justify-between items-center text-[10px] font-mono text-on-surface-variant">
                      <span>Receipt ID: {email.id} • Sender: {email.sender_name} ({email.sender_role})</span>
                      <span>Dispatched: {email.timestamp ? email.timestamp.replace('T', ' ').slice(0, 19) : 'Just now'}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── TAB 3: STRATEGIC PLAYBOOKS & CASE FILES ────────────────────────────── */}
      {activeTab === 'playbooks' && (
        <div className="grid grid-cols-12 gap-6">
          {/* Form (Col 5) */}
          <div className="col-span-12 lg:col-span-5 bg-surface-container-lowest border border-outline-variant rounded-2xl p-5 shadow-xs flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <span className="material-symbols-outlined text-primary text-[22px]">add_circle</span>
                <h3 className="text-sm font-bold text-on-surface">Record Intervention Case File</h3>
              </div>

              {playbookSuccess && (
                <div className="mb-4 p-3 bg-tertiary-container/30 border border-tertiary/40 rounded-lg text-xs font-semibold text-on-tertiary-container flex items-center gap-2">
                  <span className="material-symbols-outlined text-[16px]">check_circle</span>
                  {playbookSuccess}
                </div>
              )}

              <form onSubmit={handleSubmitPlaybook} className="space-y-3.5 text-xs">
                <div>
                  <label className="font-semibold text-on-surface block mb-1">Target Cohort / Focus Group</label>
                  <input
                    type="text"
                    value={playbookCohort}
                    onChange={(e) => setPlaybookCohort(e.target.value)}
                    className="w-full px-3 py-2 bg-surface border border-outline-variant rounded-lg text-on-surface focus:outline-primary"
                    placeholder="e.g. Physics Lab Cohort #2"
                    required
                  />
                </div>

                <div>
                  <label className="font-semibold text-on-surface block mb-1">
                    Target Student Roll Numbers (comma separated)
                  </label>
                  <input
                    type="text"
                    value={playbookStudents}
                    onChange={(e) => setPlaybookStudents(e.target.value)}
                    className="w-full px-3 py-2 bg-surface border border-outline-variant rounded-lg text-on-surface font-mono focus:outline-primary"
                    placeholder="e.g. 21CSB007, 21CSB014"
                    required
                  />
                </div>

                <div>
                  <label className="font-semibold text-on-surface block mb-1">Intervention Strategy</label>
                  <select
                    value={playbookType}
                    onChange={(e) => setPlaybookType(e.target.value)}
                    className="w-full px-3 py-2 bg-surface border border-outline-variant rounded-lg text-on-surface focus:outline-primary cursor-pointer"
                  >
                    <option value="PEER_MENTORING">Peer Mentoring (Buddy Pairing)</option>
                    <option value="ACADEMIC_CHECK_IN">Academic Check-In &amp; Doubt Clearance</option>
                    <option value="INFORMAL_DISCUSSION">Informal Teacher Guidance Chat</option>
                    <option value="TIMETABLE_ADJUSTMENT">Timetable / Lab Session Flexibility</option>
                  </select>
                </div>

                <div>
                  <label className="font-semibold text-on-surface block mb-1">Action Details &amp; Plan</label>
                  <textarea
                    rows={4}
                    value={playbookNotes}
                    onChange={(e) => setPlaybookNotes(e.target.value)}
                    className="w-full px-3 py-2 bg-surface border border-outline-variant rounded-lg text-on-surface focus:outline-primary"
                    placeholder="Describe supportive measures agreed upon (e.g. Paired with Priya D. for Friday lab sessions)..."
                    required
                  />
                </div>

                <button
                  type="submit"
                  disabled={submittingPlaybook}
                  className="w-full py-2.5 bg-primary text-on-primary rounded-lg font-semibold hover:opacity-90 transition-opacity flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 shadow-xs"
                >
                  <span className="material-symbols-outlined text-[16px]">save</span>
                  {submittingPlaybook ? 'Saving Case File...' : 'Record Case File in Ledger'}
                </button>
              </form>
            </div>
          </div>

          {/* List (Col 7) */}
          <div className="col-span-12 lg:col-span-7 bg-surface-container-lowest border border-outline-variant rounded-2xl shadow-xs overflow-hidden flex flex-col">
            <div className="p-4 bg-surface-container-low border-b border-outline-variant flex justify-between items-center">
              <h3 className="text-xs font-bold text-on-surface uppercase tracking-wider">
                Recorded Case Files ({interventions.length})
              </h3>
              <button
                onClick={fetchInterventions}
                className="text-xs text-primary font-semibold hover:underline flex items-center gap-1 cursor-pointer"
              >
                <span className="material-symbols-outlined text-[14px]">refresh</span> Refresh
              </button>
            </div>

            <div className="p-4 flex-1">
              {loadingInterventions ? (
                <div className="py-16 text-center text-xs text-on-surface-variant flex flex-col items-center justify-center space-y-2">
                  <span className="material-symbols-outlined text-[24px] text-primary animate-spin">sync</span>
                  <span>Loading recorded cases...</span>
                </div>
              ) : interventions.length === 0 ? (
                <div className="py-16 text-center text-xs text-on-surface-variant space-y-3">
                  <span className="material-symbols-outlined text-[36px] text-outline">folder_open</span>
                  <p className="font-semibold text-on-surface">No Interventions Logged Yet</p>
                  <p className="max-w-xs mx-auto">
                    Use the form on the left to deploy proactive supportive actions for students flagged by the social knowledge graph.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {interventions.map((item) => (
                    <div
                      key={item.id}
                      className="p-4 rounded-xl border border-outline-variant bg-surface hover:bg-surface-container-low transition-colors space-y-2 text-xs"
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-primary-container text-on-primary-container uppercase font-semibold">
                            {item.type.replace('_', ' ')}
                          </span>
                          <h4 className="font-bold text-on-surface mt-1">{item.target_cohort}</h4>
                        </div>
                        <span className="text-[10px] font-mono text-on-surface-variant">
                          {item.created_at ? item.created_at.slice(0, 10) : 'Active'}
                        </span>
                      </div>

                      <p className="text-on-surface leading-relaxed">{item.action_plan}</p>

                      <div className="pt-2 border-t border-outline-variant/60 flex flex-wrap justify-between items-center text-[11px] text-on-surface-variant">
                        <span className="flex items-center gap-1">
                          <span className="material-symbols-outlined text-[14px]">groups</span>
                          Students: {item.students_involved.join(', ')}
                        </span>
                        <span className="flex items-center gap-1 text-primary font-semibold">
                          <span className="material-symbols-outlined text-[14px]">person</span>
                          {item.assigned_to}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
