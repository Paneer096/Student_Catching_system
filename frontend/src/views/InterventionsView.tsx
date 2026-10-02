import React, { useState, useEffect } from 'react';
import { api, InterventionItem } from '../api/client';

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
  const [interventions, setInterventions] = useState<InterventionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [targetCohort, setTargetCohort] = useState('Cohort CS-3B');
  const [studentRolls, setStudentRolls] = useState(initialStudentId ? initialStudentId : '21CSB007, 21CSB014');
  const [interventionType, setInterventionType] = useState('PEER_MENTORING');
  const [actionNotes, setActionNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);

  const fetchInterventions = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getInterventions(activeSection);
      setInterventions(data);
    } catch (err: any) {
      setError(err?.message || 'Failed to load interventions');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInterventions();
  }, [activeSection]);

  const handleSubmitIntervention = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!actionNotes.trim()) {
      alert('Please enter action details and guidance notes.');
      return;
    }

    setSubmitting(true);
    setFormSuccess(null);
    try {
      const rolls = studentRolls
        .split(',')
        .map((r) => r.trim().toUpperCase())
        .filter(Boolean);

      const res = await api.createIntervention({
        student_ids: rolls,
        type: interventionType,
        trigger_context: `Proactive classroom check-in for ${targetCohort}`,
        notes: actionNotes,
        assigned_to: 'Class Teacher',
      });

      setFormSuccess(`Intervention successfully logged (ID: ${res.id}).`);
      setActionNotes('');
      await fetchInterventions();
    } catch (err: any) {
      alert(`Failed to log intervention: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-8">
      {/* Workspace Header */}
      <div>
        <h1 className="text-2xl font-bold text-primary tracking-tight">Active Teacher Interventions</h1>
        <p className="text-sm text-on-surface-variant mt-0.5">
          Deploy and track proactive, ethical support strategies for Section {activeSection} before absences become chronic.
        </p>
      </div>

      <div className="grid grid-cols-12 gap-6">
        {/* Log New Intervention Form (Col 5) */}
        <div className="col-span-12 lg:col-span-5 bg-surface-container-lowest border border-outline-variant rounded-xl p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <span className="material-symbols-outlined text-primary text-[22px]">add_circle</span>
              <h3 className="text-sm font-bold text-on-surface">Log Proactive Intervention</h3>
            </div>

            {formSuccess && (
              <div className="mb-4 p-3 bg-tertiary-container/30 border border-tertiary/40 rounded-lg text-xs font-semibold text-on-tertiary-container flex items-center gap-2">
                <span className="material-symbols-outlined text-[16px]">check_circle</span>
                {formSuccess}
              </div>
            )}

            <form onSubmit={handleSubmitIntervention} className="space-y-3.5 text-xs">
              <div>
                <label className="font-semibold text-on-surface block mb-1">Target Cohort / Focus Group</label>
                <input
                  type="text"
                  value={targetCohort}
                  onChange={(e) => setTargetCohort(e.target.value)}
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
                  value={studentRolls}
                  onChange={(e) => setStudentRolls(e.target.value)}
                  className="w-full px-3 py-2 bg-surface border border-outline-variant rounded-lg text-on-surface font-mono focus:outline-primary"
                  placeholder="e.g. 21CSB007, 21CSB014"
                  required
                />
              </div>

              <div>
                <label className="font-semibold text-on-surface block mb-1">Intervention Strategy</label>
                <select
                  value={interventionType}
                  onChange={(e) => setInterventionType(e.target.value)}
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
                  value={actionNotes}
                  onChange={(e) => setActionNotes(e.target.value)}
                  className="w-full px-3 py-2 bg-surface border border-outline-variant rounded-lg text-on-surface focus:outline-primary"
                  placeholder="Describe supportive measures agreed upon (e.g. Paired with Priya D. for Friday lab sessions)..."
                  required
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-2.5 bg-primary text-on-primary rounded-lg font-semibold hover:opacity-90 transition-opacity flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 shadow-xs"
              >
                <span className="material-symbols-outlined text-[16px]">save</span>
                {submitting ? 'Saving Intervention...' : 'Record Intervention in Log'}
              </button>
            </form>
          </div>
        </div>

        {/* Real Active Interventions List (Col 7) */}
        <div className="col-span-12 lg:col-span-7 bg-surface-container-lowest border border-outline-variant rounded-xl shadow-xs overflow-hidden flex flex-col">
          <div className="p-4 bg-surface-container-low border-b border-outline-variant flex justify-between items-center">
            <h3 className="text-xs font-bold text-on-surface uppercase tracking-wider">
              Recorded Interventions ({interventions.length})
            </h3>
            <button
              onClick={fetchInterventions}
              className="text-xs text-primary font-semibold hover:underline flex items-center gap-1 cursor-pointer"
            >
              <span className="material-symbols-outlined text-[14px]">refresh</span> Refresh
            </button>
          </div>

          <div className="p-4 flex-1">
            {loading ? (
              <div className="py-16 text-center text-xs text-on-surface-variant flex flex-col items-center justify-center space-y-2">
                <span className="material-symbols-outlined text-[24px] text-primary animate-spin">sync</span>
                <span>Loading active interventions...</span>
              </div>
            ) : error ? (
              <div className="py-12 text-center text-xs text-error space-y-2">
                <p>{error}</p>
                <button
                  onClick={fetchInterventions}
                  className="text-xs text-primary underline cursor-pointer"
                >
                  Retry
                </button>
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
    </div>
  );
};
