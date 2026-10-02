import React from 'react';

export interface ToolNavAction {
  id: string;
  label: string;
  icon: string;
  color?: string; // hex code for active glow
}

export interface IntelligenceNavProps {
  tools?: ToolNavAction[];
  activeTool: string | null;
  onSelectTool: (id: string | null) => void;
  timelineEnabled?: boolean;
  onToggleTimeline?: () => void;
}

export const IntelligenceNav: React.FC<IntelligenceNavProps> = ({
  tools = [
    { id: 'ai-insight', label: 'AI SUPPORT SYNTHESIS', icon: 'auto_awesome', color: '#ffd700' },
    { id: 'calendar-risk', label: 'CALENDAR RISK ENGINE', icon: 'event_upcoming', color: '#ff8c00' },
    { id: 'support-brief', label: 'SUPPORT BRIEF (PDF)', icon: 'description', color: '#00b4ff' },
    { id: 'audit-ledger', label: 'AUDIT LEDGER (G10)', icon: 'verified_user', color: '#39ff14' },
    { id: 'network-graph', label: 'SOCIAL KNOWLEDGE GRAPH', icon: 'hub', color: '#a855f7' },
  ],
  activeTool,
  onSelectTool,
  timelineEnabled = false,
  onToggleTimeline,
}) => {
  return (
    <nav className="bg-[#141313] border-b border-[#333333] px-3 h-10 flex items-center justify-between z-40 font-mono select-none">
      {/* Left: Intelligence Tools */}
      <div className="flex items-center space-x-2 overflow-x-auto custom-scrollbar py-1">
        <span className="text-[9px] font-bold text-[#666666] uppercase tracking-widest mr-1 hidden lg:inline">
          INTELLIGENCE:
        </span>

        {tools.map((tool) => {
          const isActive = activeTool === tool.id;
          const color = tool.color || '#00b4ff';

          return (
            <button
              key={tool.id}
              onClick={() => onSelectTool(isActive ? null : tool.id)}
              className={`flex items-center gap-1.5 px-3 h-7 text-[10px] font-mono font-bold uppercase tracking-widest transition-all rounded-sm border cursor-pointer ${
                isActive
                  ? 'border-current'
                  : 'bg-[#181818] text-[#c4c7c8] border-[#2a2a2a] hover:border-white/50 hover:text-white'
              }`}
              style={
                isActive
                  ? {
                      backgroundColor: `${color}18`,
                      borderColor: color,
                      color: color,
                      boxShadow: `0 0 10px ${color}44`,
                    }
                  : undefined
              }
            >
              <span
                className="material-symbols-outlined text-[13px]"
                style={{
                  color: isActive ? color : '#c4c7c8',
                  fontVariationSettings: isActive ? "'FILL' 1" : "'FILL' 0",
                }}
              >
                {tool.icon}
              </span>
              <span>{tool.label}</span>
            </button>
          );
        })}
      </div>

      {/* Right: Timeline Toggle Button */}
      {onToggleTimeline && (
        <div className="flex items-center space-x-2 shrink-0">
          <button
            onClick={onToggleTimeline}
            className={`flex items-center gap-1.5 px-3 h-7 text-[10px] font-mono font-bold uppercase tracking-widest transition-all rounded-sm border cursor-pointer ${
              timelineEnabled
                ? 'bg-[#00b4ff]/15 text-[#00b4ff] border-[#00b4ff] shadow-[0_0_10px_rgba(0,180,255,0.3)]'
                : 'bg-[#181818] text-[#c4c7c8] border-[#2a2a2a] hover:border-[#00b4ff]/50 hover:text-white'
            }`}
            title="Toggle Attendance Timeline"
          >
            <span className="material-symbols-outlined text-[13px] text-[#00b4ff]">
              history
            </span>
            <span>TIMELINE</span>
          </button>
        </div>
      )}
    </nav>
  );
};
