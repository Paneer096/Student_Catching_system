import React from 'react';

export interface RankedNode {
  id: string;
  name: string;
  metric: number | string;
  metricLabel?: string;
  tag?: string;
}

export interface NetworkSummaryHUDProps {
  title?: string;
  primaryStat?: string; // e.g. "87.4% Attendance"
  metrics?: { label: string; value: string | number }[];
  rankedTitle?: string;
  rankedItems?: RankedNode[];
  onSelectItem?: (item: RankedNode) => void;
  className?: string;
}

export const NetworkSummaryHUD: React.FC<NetworkSummaryHUDProps> = ({
  title = 'SECTION INTELLIGENCE',
  primaryStat = '88.2% ATTENDANCE',
  metrics = [
    { label: 'Enrolled Students', value: 60 },
    { label: 'Communities (Louvain)', value: 5 },
    { label: 'High Attention Alerts', value: 2 },
    { label: 'At-Risk (<75%)', value: 4 },
  ],
  rankedTitle = 'GROUP ANCHORS (CENTRAL)',
  rankedItems = [
    { id: 'stu-cs3b-014', name: 'R.S. (Rohan S.)', metric: '0.88', tag: 'HIGH CONF' },
    { id: 'stu-cs3b-022', name: 'A.K. (Amit K.)', metric: '0.74', tag: 'MED CONF' },
    { id: 'stu-cs3b-007', name: 'V.M. (Vikram M.)', metric: '0.62', tag: 'MED CONF' },
    { id: 'stu-cs3b-033', name: 'P.D. (Priya D.)', metric: '0.51', tag: 'WATCH' },
  ],
  onSelectItem,
  className = '',
}) => {
  return (
    <div
      className={`bg-[#0d0d0d]/90 backdrop-blur-md border border-[#333333] rounded-sm w-64 max-h-[280px] overflow-y-auto custom-scrollbar text-[10px] shadow-2xl font-mono select-none ${className}`}
    >
      {/* Sticky Header */}
      <div className="sticky top-0 bg-[#0d0d0d] px-2.5 py-1.5 border-b border-[#333333] flex items-center justify-between">
        <span className="font-bold text-[#c4c7c8] uppercase tracking-widest text-[9px]">
          {title}
        </span>
        <span className="text-[#39ff14] font-mono font-bold text-[10px]">
          {primaryStat}
        </span>
      </div>

      {/* Metrics Row */}
      {metrics.length > 0 && (
        <div className="px-2.5 py-1.5 border-b border-[#222222] space-y-1">
          {metrics.map((m, idx) => (
            <div key={idx} className="flex justify-between text-[#c4c7c8]">
              <span>{m.label}</span>
              <span className="text-white font-bold">{m.value}</span>
            </div>
          ))}
        </div>
      )}

      {/* Ranked Items */}
      {rankedItems.length > 0 && (
        <div className="px-2.5 py-1.5">
          <span className="font-bold text-[#00b4ff] uppercase tracking-widest block mb-1 text-[9px]">
            {rankedTitle}
          </span>
          <div className="space-y-1">
            {rankedItems.map((item, idx) => (
              <div
                key={item.id}
                onClick={() => onSelectItem?.(item)}
                className="flex items-center justify-between py-0.5 text-[#c4c7c8] hover:text-white cursor-pointer transition-colors"
              >
                <span className="truncate mr-2 max-w-[140px]" title={item.name}>
                  <span className="text-white font-bold mr-1">{idx + 1}.</span>
                  {item.name}
                </span>
                <div className="flex items-center gap-1 shrink-0">
                  {item.tag && (
                    <span className="text-[8px] px-1 bg-[#ff4c4c]/10 text-[#ff4c4c] border border-[#ff4c4c]/30 rounded-xs">
                      {item.tag}
                    </span>
                  )}
                  <span className="text-[#ffd700] font-mono font-bold">
                    {item.metric}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
