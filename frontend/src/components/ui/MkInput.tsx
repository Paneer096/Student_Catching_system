import React from 'react';

export interface MkInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  categories?: string[];
  selectedCategory?: string;
  onCategoryChange?: (category: string) => void;
  icon?: string;
  label?: string;
  error?: string;
}

export const MkInput: React.FC<MkInputProps> = ({
  categories,
  selectedCategory,
  onCategoryChange,
  icon = 'search',
  label,
  error,
  className = '',
  ...props
}) => {
  return (
    <div className={`font-mono ${className}`}>
      {label && (
        <label className="block text-[10px] text-[#c4c7c8] uppercase tracking-widest font-bold mb-1">
          {label}
        </label>
      )}
      <div className="relative flex items-center border border-[#333333] focus-within:border-[#00b4ff] group transition-colors duration-200 bg-[#121212] rounded-sm">
        {categories && categories.length > 0 && (
          <select
            value={selectedCategory}
            onChange={(e) => onCategoryChange?.(e.target.value)}
            className="bg-[#1c1b1b] text-[#c4c7c8] text-[10px] font-mono font-bold uppercase tracking-widest px-2.5 py-1.5 border-r border-[#333333] focus:outline-none focus:text-white cursor-pointer select-none"
          >
            {categories.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        )}

        {icon && (
          <span
            className="material-symbols-outlined text-[#c4c7c8] group-focus-within:text-[#00b4ff] pointer-events-none pl-2.5"
            style={{ fontVariationSettings: "'FILL' 0", fontSize: '15px' }}
          >
            {icon}
          </span>
        )}
        <input
          className="w-full bg-transparent text-white placeholder-[#777777] text-xs py-1.5 pl-2 pr-2.5 focus:outline-none border-none font-mono"
          {...props}
        />
      </div>
      {error && (
        <p className="text-[9px] text-[#ff4c4c] mt-0.5 tracking-wider">{error}</p>
      )}
    </div>
  );
};
