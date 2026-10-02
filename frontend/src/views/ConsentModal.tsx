import React from 'react';
import { MkModal } from '../components/ui/MkModal';
import { MkButton } from '../components/ui/MkButton';

export interface ConsentModalProps {
  isOpen: boolean;
  onAccept: () => void;
  onClose?: () => void;
  version?: string;
}

export const ConsentModal: React.FC<ConsentModalProps> = ({
  isOpen,
  onAccept,
  onClose,
  version = '2026.1 (DPDP-Compliant)',
}) => {
  return (
    <MkModal
      isOpen={isOpen}
      onClose={onClose || (() => {})}
      title="DATA PRIVACY & CONSENT NOTICE"
      subtitle={`Notice Version: ${version}`}
      icon="verified_user"
      iconColor="#39ff14"
      maxWidth="lg"
    >
      <div className="space-y-3.5 text-xs text-[#c4c7c8] font-mono leading-relaxed">
        <div className="p-3 bg-[#121212] border border-[#333333] rounded-sm">
          <h4 className="text-white font-bold uppercase text-[11px] mb-1 flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[#39ff14] text-[15px]">
              policy
            </span>
            Purpose: Educational Support Before Sanction
          </h4>
          <p>
            Makerove ingests institutional academic data (attendance, timetable, calendar, optional peer surveys) solely to help faculty identify group-absence patterns and provide proactive academic support and mentorship.
          </p>
        </div>

        <div className="space-y-2 text-[11px]">
          <div className="flex items-start gap-2">
            <span className="text-[#39ff14] font-bold">✔</span>
            <div>
              <strong className="text-white">Strict Guardrails:</strong> No individual forecasting. No disciplinary automation. Excused leaves are never penalized.
            </div>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-[#00b4ff] font-bold">✔</span>
            <div>
              <strong className="text-white">Student Transparency:</strong> Students retain full contest rights, erasure requests, and can inspect an immutable access log of every staff member who viewed their dossier.
            </div>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-[#ffd700] font-bold">✔</span>
            <div>
              <strong className="text-white">Minors Protection (DPDP §9):</strong> Under-18 students are excluded from peer-edge inference by default.
            </div>
          </div>
        </div>

        <div className="p-2.5 bg-[#0a0a0a] border border-[#222222] text-[10px] text-[#888888] rounded-sm">
          By proceeding, you acknowledge that all observations and interventions logged are professional, supportive, and subject to hash-chained tamper-evident audit.
        </div>

        <div className="pt-2">
          <MkButton
            variant="primary"
            size="lg"
            className="w-full text-xs font-bold"
            icon="task_alt"
            onClick={onAccept}
          >
            I ACKNOWLEDGE & ACCEPT NOTICE
          </MkButton>
        </div>
      </div>
    </MkModal>
  );
};
