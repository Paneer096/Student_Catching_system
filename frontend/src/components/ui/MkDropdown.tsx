import React from 'react';

export interface MkDropdownOption {
  value: string;
  label: string;
}

export interface MkDropdownProps {
  options: MkDropdownOption[];
  value: string;
  onChange: (value: string) => void;
  icon?: string;
  className?: string;
}

export const MkDropdown: React.FC<MkDropdownProps> = ({
  options,
  value,
  onChange,
  icon = 'account_tree',
  className = '',
}) => {
  return (
    <div className={`bg-[#121212] border border-[#333333] rounded-sm flex items-center overflow-hidden font-mono ${className}`}>
      {icon && (
        <span
          className="material-symbols-outlined text-[14px] text-[#c4c7c8] px-2 pointer-events-none"
          style={{ fontVariationSettings: "'FILL' 0" }}
        >
          {icon}
        </span>
      )}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="bg-[#121212] text-[#c4c7c8] text-[10px] font-bold uppercase tracking-widest py-1.5 pr-6 border-none focus:outline-none focus:text-white cursor-pointer appearance-none"
        style={{
          backgroundImage:
            'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'12\' height=\'12\' viewBox=\'0 0 24 24\' fill=\'%23c4c7c8\'%3E%3Cpath d=\'M7 10l5 5 5-5z\'/%3E%3C/svg%3E")',
          backgroundRepeat: 'no-repeat',
          backgroundPosition: 'right 6px center',
        }}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value} className="bg-[#141313] text-white">
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
};
