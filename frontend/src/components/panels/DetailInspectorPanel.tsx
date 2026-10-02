import React, { useState } from 'react';
import { MkBadge } from '../ui/MkBadge';
import { MkButton } from '../ui/MkButton';

export interface DetailInspectorProps {
  entity: {
    id: string;
    title: string;          // Masked initial, e.g. "R.S."
    revealedName?: string;  // Full name when revealed, e.g. "Rohan Sharma"
    type: string;           // "Group Anchor", "Student", "Peer Bridge", "Isolated Achiever"
    section?: string;
    supportPriorityScore?: number; // 0 to 100
    supportBand?: 'reach_out' | 'watch' | 'on_track';
    attendanceRate?: number;       // e.g. 71.4%
    shortageProjection?: string;   // e.g. "Needs 9 of next 12 classes to reach 75%"
    confidence?: 'HIGH' | 'MEDIUM' | 'LOW';
    properties: Record<string, any>;
    contributions?: { factor: string; points: number }[];
    strengths?: string[];
  } | null;
  onClose?: () => void;
  onRevealName?: (id: string) => void;
  onLogIntervention?: (entity: any) => void;
  className?: string;
}

export const DetailInspectorPanel: React.FC<DetailInspectorProps> = ({
  entity,
  onClose,
  onRevealName,
  onLogIntervention,
  className = '',
}) => {
  const [isRevealed, setIsRevealed] = useState(false);

  if (!entity) {
    return (
      <div className={`p-6 text-center text-[#777777] font-mono text-xs ${className}`}>
        <span className="material-symbols-outlined text-4xl mb-2 text-[#444444] block">
          school
        </span>
        Select a student node or cohort to inspect support dossier details.
      </div>
    );
  }

  const handleReveal = () => {
    setIsRevealed(true);
    onRevealName?.(entity.id);
  };

  const displayName = isRevealed ? (entity.revealedName || entity.title) : entity.title;
  const score = entity.supportPriorityScore ?? 78;
  const band = entity.supportBand || (score >= 65 ? 'reach_out' : score >= 40 ? 'watch' : 'on_track');

  const bandColor = band === 'reach_out' ? '#ff4c4c' : band === 'watch' ? '#ffd700' : '#39ff14';
  const bandLabel = band === 'reach_out' ? 'REACH OUT SOON' : band === 'watch' ? 'KEEP AN EYE' : 'ON TRACK';

  return (
    <div className={`p-4 font-mono select-none flex flex-col gap-3.5 overflow-y-auto custom-scrollbar ${className}`}>
      {/* Header Profile with Audited Privacy Reveal */}
      <div className="bg-[#121212] border border-[#333333] p-3 rounded-sm relative">
        {onClose && (
          <button
            onClick={onClose}
            className="absolute top-2 right-2 text-[#c4c7c8] hover:text-white text-xs px-1.5 py-0.5 border border-[#333333] hover:border-white rounded-sm cursor-pointer"
          >
            ✕
          </button>
        )}

        <div className="flex items-center gap-1.5 mb-2 flex-wrap">
          <MkBadge
            label={entity.type.toUpperCase()}
            variant={entity.type.includes('Anchor') ? 'gold' : 'cyan'}
            size="sm"
          />
          <MkBadge
            label={bandLabel}
            variant={band === 'reach_out' ? 'red' : band === 'watch' ? 'gold' : 'green'}
            size="sm"
            pulse={band === 'reach_out'}
          />
          {entity.confidence && (
            <MkBadge
              label={`${entity.confidence} CONF`}
              variant="neutral"
              size="sm"
            />
          )}
        </div>

        <div className="flex items-center justify-between mt-1">
          <div>
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">
              {displayName}
            </h3>
            <span className="text-[10px] text-[#777777] tracking-wider block">
              UID: {entity.id} {entity.section ? `• ${entity.section}` : ''}
            </span>
          </div>

          {!isRevealed && (
            <button
              onClick={handleReveal}
              className="text-[9px] px-2 py-1 bg-[#1a1919] hover:bg-[#252424] text-[#00b4ff] hover:text-white border border-[#00b4ff]/40 rounded-sm uppercase tracking-wider font-bold transition-all cursor-pointer flex items-center gap-1"
              title="Audit logged: View student full identity"
            >
              <span className="material-symbols-outlined text-[11px]">visibility</span>
              REVEAL (AUDITED)
            </button>
          )}
        </div>
      </div>

      {/* Support Priority Score Bar */}
      <div className="bg-[#121212] border border-[#333333] p-3 rounded-sm">
        <div className="flex justify-between items-center text-xs mb-1">
          <span className="text-[#c4c7c8] font-bold text-[10px] uppercase tracking-wider">
            SUPPORT PRIORITY INDEX
          </span>
          <span className="font-bold text-xs" style={{ color: bandColor }}>
            {score} / 100
          </span>
        </div>
        <div className="w-full bg-[#222222] h-2 rounded-sm overflow-hidden mb-2">
          <div
            className="h-full transition-all duration-300"
            style={{
              width: `${score}%`,
              backgroundColor: bandColor,
            }}
          />
        </div>
        {entity.shortageProjection && (
          <div className="p-2 bg-[#ff4c4c]/10 border border-[#ff4c4c]/30 rounded-xs flex items-center gap-2">
            <span className="material-symbols-outlined text-[#ff4c4c] text-[14px]">
              warning
            </span>
            <span className="text-[10px] text-[#ff8c00] font-bold">
              {entity.shortageProjection}
            </span>
          </div>
        )}
      </div>

      {/* Evidence & Key Indicators */}
      <div className="bg-[#121212] border border-[#333333] rounded-sm overflow-hidden">
        <div className="bg-[#0d0d0d] px-3 py-1.5 border-b border-[#333333] text-[10px] font-bold text-[#c4c7c8] uppercase tracking-wider flex items-center justify-between">
          <span>EVIDENCE & TELEMETRY</span>
          <span className="text-[9px] text-[#777777]">SIGNALS, NOT VERDICTS</span>
        </div>
        <div className="divide-y divide-[#222222] text-xs">
          {Object.entries(entity.properties).map(([key, val]) => (
            <div key={key} className="flex justify-between p-2">
              <span className="text-[#888888] uppercase text-[10px]">{key}</span>
              <span className="text-white font-mono text-right truncate max-w-[170px]">
                {String(val)}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Strengths & Positive Interventions */}
      {entity.strengths && entity.strengths.length > 0 && (
        <div className="bg-[#121212] border border-[#333333] rounded-sm overflow-hidden">
          <div className="bg-[#0d0d0d] px-3 py-1.5 border-b border-[#333333] text-[10px] font-bold text-[#39ff14] uppercase tracking-wider flex items-center gap-1">
            <span className="material-symbols-outlined text-[13px]">verified</span>
            LEVERAGEABLE STRENGTHS
          </div>
          <div className="p-2.5 space-y-1">
            {entity.strengths.map((str, idx) => (
              <div key={idx} className="flex items-center gap-1.5 text-xs text-[#c4c7c8]">
                <span className="text-[#39ff14] font-bold">✔</span>
                <span>{str}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Action Footer */}
      <div className="flex gap-2">
        <MkButton
          variant="primary"
          size="md"
          className="flex-1"
          icon="handshake"
          onClick={() => onLogIntervention?.(entity)}
        >
          PLAN INTERVENTION
        </MkButton>
        <MkButton
          variant="outline"
          size="md"
          icon="description"
          onClick={() => alert(`Support Dossier generated for ${displayName}`)}
        >
          DOSSIER
        </MkButton>
      </div>
    </div>
  );
};
