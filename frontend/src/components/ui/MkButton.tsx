import React from 'react';

export interface MkButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'white' | 'gold' | 'danger' | 'ghost' | 'outline' | 'active-glow';
  size?: 'sm' | 'md' | 'lg' | 'icon';
  icon?: string;
  loading?: boolean;
}

export const MkButton: React.FC<MkButtonProps> = ({
  variant = 'primary',
  size = 'md',
  icon,
  loading = false,
  children,
  className = '',
  disabled,
  ...props
}) => {
  const sizeClasses = {
    sm: 'px-2.5 py-1 text-[10px]',
    md: 'px-3 py-1.5 text-xs',
    lg: 'px-4 py-2.5 text-xs tracking-widest',
    icon: 'w-8 h-8 p-0 flex items-center justify-center',
  }[size];

  const variantClasses = {
    primary:
      'bg-[#00b4ff] hover:bg-[#0090cc] text-black font-extrabold uppercase tracking-widest shadow-[0_0_15px_rgba(0,180,255,0.25)] border border-[#00b4ff]',
    white:
      'bg-white hover:bg-[#e5e2e1] text-[#2f3131] font-extrabold uppercase tracking-widest border border-white',
    gold:
      'bg-[#ffd700] hover:bg-[#e6c200] text-black font-extrabold uppercase tracking-widest shadow-[0_0_15px_rgba(255,215,0,0.25)] border border-[#ffd700]',
    danger:
      'bg-[#ff4c4c] hover:bg-[#cc3333] text-white font-extrabold uppercase tracking-widest shadow-[0_0_15px_rgba(255,76,76,0.25)] border border-[#ff4c4c]',
    outline:
      'bg-[#181818] hover:bg-[#222222] text-[#c4c7c8] hover:text-white border border-[#333333] hover:border-white font-bold uppercase tracking-wider',
    ghost:
      'bg-transparent hover:bg-[#333333] text-[#c4c7c8] hover:text-white border border-transparent font-bold',
    'active-glow':
      'bg-[#00b4ff]/15 text-[#00b4ff] border border-[#00b4ff] shadow-[0_0_10px_rgba(0,180,255,0.3)] font-bold uppercase tracking-wider',
  }[variant];

  return (
    <button
      disabled={disabled || loading}
      className={`font-mono rounded-sm transition-all duration-150 inline-flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed select-none ${sizeClasses} ${variantClasses} ${className}`}
      {...props}
    >
      {loading ? (
        <span className="material-symbols-outlined text-[14px] animate-spin">
          progress_activity
        </span>
      ) : icon ? (
        <span className="material-symbols-outlined text-[14px]">{icon}</span>
      ) : null}
      {children}
    </button>
  );
};
