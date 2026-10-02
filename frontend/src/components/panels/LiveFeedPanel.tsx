import React from 'react';

export interface FeedEvent {
  id: string;
  time: string;
  text: string;
  color?: string; // e.g. '#ff8c00', '#00b4ff', '#39ff14', '#ff4c4c'
  type?: 'alert' | 'telemetry' | 'intervention' | 'calendar';
}

export interface LiveFeedPanelProps {
  events?: FeedEvent[];
  className?: string;
}

export const LiveFeedPanel: React.FC<LiveFeedPanelProps> = ({
  events = [
    { id: '1', time: 'NOW', text: 'Group absence spike: 8 students absent in P5 Physics', color: '#ff4c4c', type: 'alert' },
    { id: '2', time: '-10m', text: 'Telemetry sync: CS-3B morning attendance 91.2% processed', color: '#39ff14', type: 'telemetry' },
    { id: '3', time: '-25m', text: 'Calendar risk: High pre-holiday drop predicted for upcoming Friday', color: '#ff8c00', type: 'calendar' },
    { id: '4', time: '-1h', text: 'Intervention logged: Study group coordinator assigned for R.S.', color: '#00b4ff', type: 'intervention' },
    { id: '5', time: '-2h', text: 'Audit trail: Teacher Dr. Sharma accessed student dossier R.S. (audited)', color: '#a855f7', type: 'telemetry' },
  ],
  className = '',
}) => {
  return (
    <div className={`p-3 border-b border-[#333333] font-mono select-none ${className}`}>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xs font-bold text-white uppercase tracking-widest flex items-center gap-1.5">
          <span>LIVE TELEMETRY FEED</span>
        </h2>
        <span className="flex h-2 w-2 relative">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#39ff14] opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-[#39ff14]" />
        </span>
      </div>

      <div className="flex flex-col gap-2 max-h-56 overflow-y-auto custom-scrollbar">
        {events.map((ev) => (
          <div
            key={ev.id}
            className="flex items-start gap-2 pl-2 py-1 bg-[#121212] border-l-2 rounded-r-sm hover:bg-[#181818] transition-colors"
            style={{ borderColor: ev.color || '#00b4ff' }}
          >
            <span className="text-[10px] text-[#c4c7c8] font-mono whitespace-nowrap mt-0.5">
              {ev.time}
            </span>
            <p className="text-[11px] text-white leading-tight">{ev.text}</p>
          </div>
        ))}
      </div>
    </div>
  );
};
