import React from 'react';

export interface MkCardProps {
  title?: string;
  subtitle?: string;
  badge?: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
  glow?: 'cyan' | 'gold' | 'green' | 'red' | 'orange' | 'none';
  className?: string;
  headerClassName?: string;
}

export const MkCard: React.FC<MkCardProps> = ({
  title,
  subtitle,
  badge,
  actions,
  children,
  glow = 'none',
  className = '',
  headerClassName = '',
}) => {
  const glowStyles = {
    none: 'border-[#333333] shadow-md',
    cyan: 'border-[#00b4ff]/40 shadow-[0_0_20px_rgba(0,180,255,0.15)]',
    gold: 'border-[#ffd700]/40 shadow-[0_0_20px_rgba(255,215,0,0.15)]',
    green: 'border-[#39ff14]/40 shadow-[0_0_20px_rgba(57,255,20,0.15)]',
    red: 'border-[#ff4c4c]/40 shadow-[0_0_20px_rgba(255,76,76,0.15)]',
    orange: 'border-[#ff8c00]/40 shadow-[0_0_20px_rgba(255,140,0,0.15)]',
  }[glow];

  return (
    <div
      className={`bg-[#141313] border rounded-sm flex flex-col overflow-hidden font-mono transition-all duration-200 ${glowStyles} ${className}`}
    >
      {(title || badge || actions) && (
        <div
          className={`px-3 py-2 bg-[#0d0d0d] border-b border-[#333333] flex items-center justify-between gap-2 select-none ${headerClassName}`}
        >
          <div className="flex items-center gap-2 overflow-hidden">
            {title && (
              <div>
                <h3 className="text-xs font-bold text-white uppercase tracking-wider truncate">
                  {title}
                </h3>
                {subtitle && (
                  <span className="text-[9px] text-[#c4c7c8] tracking-widest block uppercase">
                    {subtitle}
                  </span>
                )}
              </div>
            )}
            {badge}
          </div>
          {actions && <div className="flex items-center gap-1.5">{actions}</div>}
        </div>
      )}
      <div className="p-3 flex-1 overflow-auto custom-scrollbar">{children}</div>
    </div>
  );
};
