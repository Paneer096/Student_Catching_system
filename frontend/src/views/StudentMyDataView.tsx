import React, { useState } from 'react';

export const StudentMyDataView: React.FC = () => {
  const [contestModalOpen, setContestModalOpen] = useState(false);
  const [contestCategory, setContestCategory] = useState('MEDICAL_LEAVE_NOT_LOGGED');
  const [contestNotes, setContestNotes] = useState('');
  const [submitted, setSubmitted] = useState(false);

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-8">
      {/* Student Banner */}
      <div className="p-5 bg-surface-container-lowest border border-outline-variant rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-2xl">
              badge
            </span>
            <h2 className="text-base font-bold text-primary">
              Student Attendance &amp; Privacy Transparency Dossier
            </h2>
          </div>
          <span className="text-xs text-on-surface-variant block mt-0.5">
            Student: Rohit Sharma (Roll #21CSB014) • Section AIML Sem 4 • Protected under DPDP 2025 Transparency
          </span>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => setContestModalOpen(true)}
            className="px-3.5 py-1.5 bg-primary-container text-on-primary-container text-xs font-semibold rounded-lg hover:bg-primary transition-colors flex items-center gap-1.5 shadow-xs cursor-pointer"
          >
            <span className="material-symbols-outlined text-[16px]">edit_note</span>
            Submit Correction Request
          </button>
        </div>
      </div>

      {/* Grid: My Scores & Shortage Projection */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Attendance & Shortage */}
        <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-5 shadow-xs">
          <div className="flex justify-between items-start mb-3">
            <div>
              <h3 className="text-xs font-bold text-on-surface uppercase tracking-wider">Attendance Status</h3>
              <p className="text-[11px] text-on-surface-variant">Current semester standing</p>
            </div>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-error-container text-on-error-container">
              71.4% (Below 75%)
            </span>
          </div>

          <div className="space-y-3">
            <div className="flex justify-between items-center text-xs">
              <span className="text-on-surface-variant">Classes Attended:</span>
              <span className="font-bold text-on-surface">45 / 63 Sessions</span>
            </div>
            <div className="w-full bg-surface-container-high h-2 rounded-full overflow-hidden">
              <div className="bg-error h-full rounded-full" style={{ width: '71.4%' }} />
            </div>

            <div className="p-3 bg-error-container/20 border border-error/20 rounded-lg text-xs text-on-error-container font-medium flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px] text-error">info</span>
              Target: Attend 9 of the next 12 lectures to reach the mandatory 75% limit.
            </div>
          </div>
        </div>

        {/* Support Factor Contributions */}
        <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-5 shadow-xs">
          <div className="flex justify-between items-start mb-3">
            <div>
              <h3 className="text-xs font-bold text-on-surface uppercase tracking-wider">Explainable Factors</h3>
              <p className="text-[11px] text-on-surface-variant">Why teacher support was suggested</p>
            </div>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-secondary-container text-on-secondary-container">
              Transparent
            </span>
          </div>

          <div className="space-y-2 text-xs">
            <div className="flex justify-between text-on-surface">
              <span>Attendance gap below statutory threshold</span>
              <span className="text-error font-bold">+30 pts</span>
            </div>
            <div className="flex justify-between text-on-surface">
              <span>Friday afternoon absence frequency</span>
              <span className="text-secondary font-bold">+25 pts</span>
            </div>
            <div className="flex justify-between text-on-surface">
              <span>Shared group absence pattern (Anonymized)</span>
              <span className="text-on-surface font-bold">+18 pts</span>
            </div>
            <div className="pt-2 border-t border-outline-variant flex justify-between font-bold text-primary">
              <span>Support Priority Score</span>
              <span>73 / 100</span>
            </div>
            <span className="text-[10px] text-on-surface-variant block italic pt-1">
              Peer identities are permanently scrubbed from student dossiers.
            </span>
          </div>
        </div>

        {/* My Strengths & Peer Mentoring */}
        <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-5 shadow-xs">
          <div className="flex justify-between items-start mb-3">
            <div>
              <h3 className="text-xs font-bold text-on-surface uppercase tracking-wider">Academic Strengths</h3>
              <p className="text-[11px] text-on-surface-variant">Recognized capabilities</p>
            </div>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-tertiary-fixed text-tertiary-container">
              Commended
            </span>
          </div>

          <div className="space-y-2 text-xs">
            <div className="flex items-center gap-2 text-on-surface">
              <span className="material-symbols-outlined text-tertiary-container text-[18px]">verified</span>
              <span>Operating Systems Lab Project: <strong>Top 10% Score</strong></span>
            </div>
            <div className="flex items-center gap-2 text-on-surface">
              <span className="material-symbols-outlined text-tertiary-container text-[18px]">group</span>
              <span>Collaborative Lab Leadership potential recognized</span>
            </div>
            <div className="flex items-center gap-2 text-on-surface">
              <span className="material-symbols-outlined text-secondary text-[18px]">school</span>
              <span>Paired study with Priya D. (Peer Tutor) scheduled</span>
            </div>
          </div>
        </div>
      </div>

      {/* Contest Modal */}
      {contestModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-surface-container-lowest border border-outline-variant rounded-xl shadow-xl max-w-md w-full overflow-hidden p-6 space-y-4">
            <div className="flex justify-between items-center pb-2 border-b border-outline-variant">
              <h3 className="text-sm font-bold text-primary">Submit Correction Request</h3>
              <button onClick={() => setContestModalOpen(false)} className="text-on-surface-variant hover:text-primary">
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            {submitted ? (
              <div className="p-4 bg-tertiary-fixed-dim/30 border border-tertiary-fixed rounded-lg text-xs text-on-tertiary-container font-medium text-center">
                Your request has been routed to Class Teacher Prof. Raghav Sharma for verification.
              </div>
            ) : (
              <div className="space-y-3 text-xs">
                <div>
                  <label className="block font-semibold text-on-surface mb-1">Reason for Correction</label>
                  <select
                    value={contestCategory}
                    onChange={(e) => setContestCategory(e.target.value)}
                    className="w-full p-2 border border-outline-variant rounded-lg bg-surface text-on-surface"
                  >
                    <option value="MEDICAL_LEAVE_NOT_LOGGED">Medical Leave was submitted but not updated</option>
                    <option value="ON_DUTY_EVENT">Attending College Hackathon / Sports (OD)</option>
                    <option value="DEVICE_SCAN_FAILURE">Attendance Scanner Failure</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-on-surface mb-1">Supporting Details</label>
                  <textarea
                    value={contestNotes}
                    onChange={(e) => setContestNotes(e.target.value)}
                    placeholder="Provide certificate or date details..."
                    className="w-full p-2 border border-outline-variant rounded-lg bg-surface text-on-surface h-20 resize-none"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    onClick={() => setContestModalOpen(false)}
                    className="px-3 py-1.5 border border-outline-variant rounded-lg text-on-surface"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => {
                      setSubmitted(true);
                      setTimeout(() => {
                        setSubmitted(false);
                        setContestModalOpen(false);
                      }, 1800);
                    }}
                    className="px-3.5 py-1.5 bg-primary-container text-on-primary-container rounded-lg font-semibold"
                  >
                    Submit Request
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
