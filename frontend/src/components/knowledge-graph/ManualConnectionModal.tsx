import React, { useState, useEffect, useMemo } from 'react';
import { api } from '../../api/client';
import {
  X,
  Link2,
  BookOpen,
  Armchair,
  Users,
  Compass,
  Eye,
  AlertCircle,
  Loader2,
  CheckCircle2,
  ArrowRightLeft,
} from 'lucide-react';

export interface ManualConnectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  sectionCode: string;
  students: Array<{ roll_no: string; name: string; attendance_pct?: number; role?: string }>;
  initialStudentA?: string | null;
  initialStudentB?: string | null;
}

const CONNECTION_TYPES = [
  {
    id: 'STUDIES_WITH',
    label: 'Study Partner',
    icon: BookOpen,
    color: '#06b6d4', // Cyan
    description: 'Collaborates on coursework, exam prep, or peer tutoring.',
  },
  {
    id: 'SITS_WITH',
    label: 'Seating / Desk',
    icon: Armchair,
    color: '#3b82f6', // Blue
    description: 'Shares adjacent bench or regular seating in lecture hall.',
  },
  {
    id: 'PROJECT_TEAM',
    label: 'Project / Lab Team',
    icon: Compass,
    color: '#f59e0b', // Amber
    description: 'Group partners on lab experiments, capstone, or submissions.',
  },
  {
    id: 'PEER_OF',
    label: 'Social Peer',
    icon: Users,
    color: '#ec4899', // Pink
    description: 'Observed peer circle or informal lunch/break companionship.',
  },
  {
    id: 'TEACHER_OBSERVED',
    label: 'Faculty Observation',
    icon: Eye,
    color: '#8b5cf6', // Purple
    description: 'Noted behavioral association or mentor-assigned grouping.',
  },
];

export const ManualConnectionModal: React.FC<ManualConnectionModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  sectionCode,
  students,
  initialStudentA,
  initialStudentB,
}) => {
  const [studentA, setStudentA] = useState<string>('');
  const [studentB, setStudentB] = useState<string>('');
  const [connectionType, setConnectionType] = useState<string>('STUDIES_WITH');
  const [weight, setWeight] = useState<number>(1.0);
  const [notes, setNotes] = useState<string>('');
  const [searchA, setSearchA] = useState<string>('');
  const [searchB, setSearchB] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setStudentA(initialStudentA || (students[0]?.roll_no ?? ''));
      setStudentB(
        initialStudentB ||
          students.find((s) => s.roll_no !== initialStudentA)?.roll_no ||
          ''
      );
      setConnectionType('STUDIES_WITH');
      setWeight(1.0);
      setNotes('');
      setError(null);
      setSuccessMsg(null);
      setSearchA('');
      setSearchB('');
    }
  }, [isOpen, initialStudentA, initialStudentB, students]);

  const filteredStudentsA = useMemo(() => {
    if (!searchA.trim()) return students;
    const q = searchA.toLowerCase();
    return students.filter(
      (s) => s.name.toLowerCase().includes(q) || s.roll_no.toLowerCase().includes(q)
    );
  }, [students, searchA]);

  const filteredStudentsB = useMemo(() => {
    if (!searchB.trim()) return students.filter((s) => s.roll_no !== studentA);
    const q = searchB.toLowerCase();
    return students.filter(
      (s) =>
        s.roll_no !== studentA &&
        (s.name.toLowerCase().includes(q) || s.roll_no.toLowerCase().includes(q))
    );
  }, [students, searchB, studentA]);

  const handleSwap = () => {
    const temp = studentA;
    setStudentA(studentB);
    setStudentB(temp);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentA || !studentB) {
      setError('Please select both students to establish a connection.');
      return;
    }
    if (studentA.toUpperCase() === studentB.toUpperCase()) {
      setError('Cannot establish a connection between the same student.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await api.createManualConnection(sectionCode, {
        student_a: studentA,
        student_b: studentB,
        connection_type: connectionType,
        weight,
        notes: notes.trim() || undefined,
      });

      setSuccessMsg('Connection successfully recorded and integrated into Knowledge Graph.');
      setTimeout(() => {
        onSuccess();
        onClose();
      }, 700);
    } catch (err: any) {
      console.error('Failed to create manual connection:', err);
      setError(err?.message || 'Failed to establish connection. Check server status.');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const studentAObj = students.find((s) => s.roll_no === studentA);
  const studentBObj = students.find((s) => s.roll_no === studentB);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-150">
      <div className="relative w-full max-w-xl bg-[#0c0d12] border border-white/10 rounded-2xl shadow-2xl overflow-hidden text-white flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-white/[0.02]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
              <Link2 size={18} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-white tracking-wide font-sans">
                  Establish Student Connection
                </h3>
                <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded-full bg-cyan-500/15 border border-cyan-500/30 text-cyan-300">
                  Section {sectionCode}
                </span>
              </div>
              <p className="text-[11px] text-gray-400">
                Teacher-in-the-loop: manually map observed peer links, study partners, or seating ties.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5">
          {error && (
            <div className="p-3 bg-rose-500/15 border border-rose-500/30 rounded-xl text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle size={16} className="shrink-0 text-rose-400" />
              <span>{error}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3 bg-emerald-500/15 border border-emerald-500/30 rounded-xl text-emerald-300 text-xs flex items-center gap-2">
              <CheckCircle2 size={16} className="shrink-0 text-emerald-400" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Student Pair Selection */}
          <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-4 space-y-3">
            <div className="text-[11px] font-mono text-gray-400 uppercase tracking-wider font-semibold">
              Select Students to Connect
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center relative">
              {/* Student A */}
              <div className="space-y-1.5">
                <label className="text-[11px] text-gray-400 block font-medium">
                  Primary Student (A)
                </label>
                <div className="relative">
                  <select
                    value={studentA}
                    onChange={(e) => setStudentA(e.target.value)}
                    className="w-full bg-[#13151f] border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500 font-sans"
                  >
                    {filteredStudentsA.map((s) => (
                      <option key={s.roll_no} value={s.roll_no} className="bg-[#13151f]">
                        {s.name} ({s.roll_no})
                      </option>
                    ))}
                  </select>
                </div>
                {studentAObj && (
                  <div className="text-[10px] text-gray-400 flex items-center gap-2 font-mono px-1">
                    <span>Att: {studentAObj.attendance_pct ?? 85}%</span>
                    <span>•</span>
                    <span className="text-cyan-400">{studentAObj.role || 'Student'}</span>
                  </div>
                )}
              </div>

              {/* Swap Button */}
              <button
                type="button"
                onClick={handleSwap}
                className="hidden sm:flex absolute left-1/2 -translate-x-1/2 top-7 w-7 h-7 rounded-full bg-white/10 hover:bg-cyan-500/20 border border-white/15 text-gray-300 hover:text-cyan-300 items-center justify-center transition-all shadow-md z-10"
                title="Swap students"
              >
                <ArrowRightLeft size={13} />
              </button>

              {/* Student B */}
              <div className="space-y-1.5">
                <label className="text-[11px] text-gray-400 block font-medium">
                  Connected Peer (B)
                </label>
                <div className="relative">
                  <select
                    value={studentB}
                    onChange={(e) => setStudentB(e.target.value)}
                    className="w-full bg-[#13151f] border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500 font-sans"
                  >
                    <option value="" disabled>
                      -- Select Connected Peer --
                    </option>
                    {filteredStudentsB.map((s) => (
                      <option key={s.roll_no} value={s.roll_no} className="bg-[#13151f]">
                        {s.name} ({s.roll_no})
                      </option>
                    ))}
                  </select>
                </div>
                {studentBObj && (
                  <div className="text-[10px] text-gray-400 flex items-center gap-2 font-mono px-1">
                    <span>Att: {studentBObj.attendance_pct ?? 85}%</span>
                    <span>•</span>
                    <span className="text-cyan-400">{studentBObj.role || 'Student'}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Connection Type Cards */}
          <div className="space-y-2">
            <label className="text-[11px] font-mono text-gray-400 uppercase tracking-wider font-semibold block">
              Observed Relationship Type
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {CONNECTION_TYPES.map((t) => {
                const Icon = t.icon;
                const isSelected = connectionType === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setConnectionType(t.id)}
                    className={`p-3 rounded-xl border text-left transition-all flex items-start gap-3 ${
                      isSelected
                        ? 'bg-white/[0.08] border-cyan-400/60 shadow-md ring-1 ring-cyan-400/30'
                        : 'bg-white/[0.02] border-white/5 hover:border-white/15 hover:bg-white/[0.04]'
                    }`}
                  >
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
                      style={{ backgroundColor: `${t.color}20`, color: t.color }}
                    >
                      <Icon size={16} />
                    </div>
                    <div className="overflow-hidden">
                      <div className="text-xs font-bold text-white flex items-center gap-1.5">
                        <span>{t.label}</span>
                        {isSelected && (
                          <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-cyan-400/20 text-cyan-300 font-normal">
                            Active
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-gray-400 mt-0.5 leading-snug">
                        {t.description}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Connection Weight / Confidence */}
          <div className="space-y-1.5 bg-white/[0.02] border border-white/5 rounded-xl p-3">
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-300 font-medium">Tie Weight / Confidence:</span>
              <span className="font-mono text-cyan-400 font-bold">{weight.toFixed(1)}x</span>
            </div>
            <input
              type="range"
              min="0.5"
              max="2.5"
              step="0.1"
              value={weight}
              onChange={(e) => setWeight(parseFloat(e.target.value))}
              className="w-full accent-cyan-400 cursor-pointer h-1.5 bg-white/10 rounded-lg"
            />
            <div className="flex justify-between text-[10px] text-gray-500 font-mono">
              <span>0.5x (Occasional)</span>
              <span>1.0x (Regular)</span>
              <span>2.5x (Very Close)</span>
            </div>
          </div>

          {/* Teacher Observation Notes */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-mono text-gray-400 uppercase tracking-wider font-semibold block">
              Observation Context / Pedagogical Notes
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g., Regularly collaborates on coding assignments in Lab 2; assigned seat partners in Row 3."
              className="w-full bg-[#13151f] border border-white/10 rounded-xl p-3 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500 resize-none font-sans"
            />
          </div>

          {/* Guardrail Notice */}
          <div className="text-[10px] text-gray-400 bg-white/[0.02] border border-white/5 p-2.5 rounded-xl flex items-start gap-2">
            <Eye size={13} className="text-cyan-400 shrink-0 mt-0.5" />
            <span className="leading-relaxed">
              <strong>Signals, not verdicts (DPDP §9 & G4):</strong> Manual connections assist in
              early supportive outreach. This action is permanently recorded in the immutable audit ledger.
            </span>
          </div>

          {/* Action Footer */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 rounded-xl text-xs font-bold bg-cyan-500 hover:bg-cyan-400 text-black flex items-center gap-2 transition-all shadow-lg shadow-cyan-500/20 disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  <span>Recording Tie...</span>
                </>
              ) : (
                <>
                  <Link2 size={14} />
                  <span>Establish Connection</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
