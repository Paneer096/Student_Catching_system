import React from 'react';
import { MkBadge } from '../ui/MkBadge';
import { MkButton } from '../ui/MkButton';

export interface AIInsightPanelProps {
  priorityLevel?: 'HIGH ATTENTION' | 'WATCH' | 'NOTED';
  summary?: string;
  keyFindings?: string[];
  recommendedActions?: string[];
  onGenerateBrief?: () => void;
  onDraftReminder?: () => void;
  isAiDrafted?: boolean;
  className?: string;
}

export const AIInsightPanel: React.FC<AIInsightPanelProps> = ({
  priorityLevel = 'HIGH ATTENTION',
  summary = 'A recurring group absence pattern of 8 students detected in Period 5 Physics on Fridays preceding holidays. Co-absence cohesion 0.78 exceeds chance expectation (z = 3.1).',
  keyFindings = [
    'Absence co-occurrence lift is 3.4x over class baseline in slot P5 Physics',
    'Student R.S. identified as structural anchor across 4 preceding episodes (confidence: High)',
    'Absence pattern clusters before long weekends; baseline subject attendance is otherwise normal',
    '2 peripheral circle members joined only on the highest-risk pre-holiday dates',
  ],
  recommendedActions = [
    'Designate student R.S. as Physics practical study-group coordinator to anchor engagement',
    'Pair with peer mentor P.D. (strong academic consistency, shared network circle)',
    'Send proactive supportive class notice 24h prior to upcoming long-weekend slot',
  ],
  onGenerateBrief,
  onDraftReminder,
  isAiDrafted = true,
  className = '',
}) => {
  return (
    <div className={`p-4 font-mono select-none flex flex-col gap-4 overflow-y-auto custom-scrollbar ${className}`}>
      {/* Header Banner */}
      <div className="bg-[#121212] border border-[#ffd700]/30 p-3 rounded-sm shadow-[0_0_15px_rgba(255,215,0,0.1)]">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] font-bold text-[#ffd700] uppercase tracking-widest flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[15px]" style={{ fontVariationSettings: "'FILL' 1" }}>
              auto_awesome
            </span>
            AI SUPPORT SYNTHESIS
          </span>
          <div className="flex items-center gap-1.5">
            {isAiDrafted ? (
              <span className="text-[9px] bg-[#ffd700]/10 border border-[#ffd700]/30 text-[#ffd700] px-1.5 py-0.5 rounded-xs font-bold">
                GEMINI 2.5
              </span>
            ) : (
              <span className="text-[9px] bg-[#333333] text-[#888888] px-1.5 py-0.5 rounded-xs font-bold">
                TEMPLATE
              </span>
            )}
            <MkBadge
              label={priorityLevel}
              variant={priorityLevel === 'HIGH ATTENTION' ? 'red' : 'gold'}
              size="sm"
              pulse
            />
          </div>
        </div>
        <p className="text-xs text-white leading-relaxed">{summary}</p>
        <span className="text-[9px] text-[#777777] block mt-1 tracking-wider uppercase">
          EVIDENCE-BASED • DE-IDENTIFIED AGGREGATES (G7)
        </span>
      </div>

      {/* Key Findings List */}
      <div className="bg-[#121212] border border-[#333333] rounded-sm overflow-hidden">
        <div className="bg-[#0d0d0d] px-3 py-1.5 border-b border-[#333333] text-[10px] font-bold text-[#c4c7c8] uppercase tracking-wider flex items-center gap-1">
          <span className="material-symbols-outlined text-[13px] text-[#00b4ff]">analytics</span>
          STATISTICAL PATTERN FINDINGS
        </div>
        <div className="p-3 space-y-2">
          {keyFindings.map((finding, idx) => (
            <div key={idx} className="flex items-start gap-2 text-xs">
              <span className="text-[#00b4ff] font-bold mt-0.5">•</span>
              <span className="text-[#c4c7c8] leading-tight">{finding}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Recommended Ethical Interventions */}
      <div className="bg-[#121212] border border-[#333333] rounded-sm overflow-hidden">
        <div className="bg-[#0d0d0d] px-3 py-1.5 border-b border-[#333333] text-[10px] font-bold text-[#39ff14] uppercase tracking-wider flex items-center gap-1">
          <span className="material-symbols-outlined text-[13px]">volunteer_activism</span>
          SUPPORT DIRECTIVES (PROACTIVE ACTIONS)
        </div>
        <div className="p-3 space-y-2">
          {recommendedActions.map((action, idx) => (
            <div key={idx} className="flex items-start gap-2 text-xs">
              <span className="text-[#39ff14] font-bold mt-0.5">[{idx + 1}]</span>
              <span className="text-white leading-tight">{action}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-col gap-2">
        {onDraftReminder && (
          <MkButton
            variant="gold"
            size="md"
            className="w-full"
            icon="mail"
            onClick={onDraftReminder}
          >
            DRAFT CLASS REMINDER
          </MkButton>
        )}

        {onGenerateBrief && (
          <MkButton
            variant="outline"
            size="md"
            className="w-full"
            icon="description"
            onClick={onGenerateBrief}
          >
            1-PAGE SUPPORT BRIEF (PDF)
          </MkButton>
        )}
      </div>
    </div>
  );
};
