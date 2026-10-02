import React from 'react';

export interface MkBadgeProps {
  label: string;
  variant?: 'cyan' | 'green' | 'gold' | 'orange' | 'red' | 'purple' | 'neutral' | 'live';
  size?: 'sm' | 'md';
  pulse?: boolean;
  count?: number | string;
  icon?: string;
  className?: string;
}

export const MkBadge: React.FC<MkBadgeProps> = ({
  label,
  variant = 'cyan',
  size = 'sm',
  pulse = false,
  count,
  icon,
  className = '',
}) => {
  const sizeClasses = {
    sm: 'text-[9px] px-1.5 py-0.5',
    md: 'text-[10px] px-2 py-1',
  }[size];

  const colorStyles = {
    cyan: { bg: 'bg-[#00b4ff]/10', border: 'border-[#00b4ff]/40', text: 'text-[#00b4ff]', dot: '#00b4ff' },
    green: { bg: 'bg-[#39ff14]/10', border: 'border-[#39ff14]/40', text: 'text-[#39ff14]', dot: '#39ff14' },
    gold: { bg: 'bg-[#ffd700]/10', border: 'border-[#ffd700]/40', text: 'text-[#ffd700]', dot: '#ffd700' },
    orange: { bg: 'bg-[#ff8c00]/10', border: 'border-[#ff8c00]/40', text: 'text-[#ff8c00]', dot: '#ff8c00' },
    red: { bg: 'bg-[#ff4c4c]/10', border: 'border-[#ff4c4c]/40', text: 'text-[#ff4c4c]', dot: '#ff4c4c' },
    purple: { bg: 'bg-[#a855f7]/10', border: 'border-[#a855f7]/40', text: 'text-[#a855f7]', dot: '#a855f7' },
    neutral: { bg: 'bg-[#1a1919]', border: 'border-[#333333]', text: 'text-[#c4c7c8]', dot: '#888888' },
    live: { bg: 'bg-[#39ff14]/10', border: 'border-[#39ff14]/30', text: 'text-[#39ff14]', dot: '#39ff14' },
  }[variant];

  return (
    <span
      className={`inline-flex items-center gap-1.5 font-mono font-bold uppercase tracking-wider rounded-sm border ${colorStyles.bg} ${colorStyles.border} ${colorStyles.text} ${sizeClasses} ${className}`}
    >
      {pulse && (
        <span className="flex h-1.5 w-1.5 relative">
          <span
            className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75"
            style={{ backgroundColor: colorStyles.dot }}
          />
          <span
            className="relative inline-flex rounded-full h-1.5 w-1.5"
            style={{ backgroundColor: colorStyles.dot }}
          />
        </span>
      )}
      {icon && (
        <span className="material-symbols-outlined text-[12px]">{icon}</span>
      )}
      <span>{label}</span>
      {count !== undefined && (
        <span className="ml-0.5 px-1 py-0.2 bg-black/40 border border-white/10 rounded-sm text-[8px] font-mono">
          {count}
        </span>
      )}
    </span>
  );
};
