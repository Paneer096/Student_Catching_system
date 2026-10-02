import React from 'react';

export interface MkModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  icon?: string;
  iconColor?: string;
  children: React.ReactNode;
  footerText?: string;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl';
}

export const MkModal: React.FC<MkModalProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  icon = 'school',
  iconColor = '#00b4ff',
  children,
  footerText,
  maxWidth = 'md',
}) => {
  if (!isOpen) return null;

  const widthClasses = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-2xl',
  }[maxWidth];

  return (
    <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4 font-mono select-none">
      <div
        className={`bg-[#141313] border border-[#333333] rounded-lg w-full ${widthClasses} shadow-[0_0_60px_rgba(0,180,255,0.1)] overflow-hidden transition-all`}
      >
        {/* Modal Top Header */}
        <div className="bg-[#0d0d0d] border-b border-[#333333] p-5 text-center relative">
          <button
            onClick={onClose}
            className="absolute top-3 right-3 text-[#c4c7c8] hover:text-white text-xs px-2 py-1 border border-[#333333] hover:border-white rounded-sm transition-colors cursor-pointer"
          >
            ✕
          </button>

          {icon && (
            <div
              className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-2.5 transition-shadow"
              style={{
                backgroundColor: `${iconColor}15`,
                border: `2px solid ${iconColor}50`,
                boxShadow: `0 0 20px ${iconColor}33`,
              }}
            >
              <span
                className="material-symbols-outlined text-2xl"
                style={{ color: iconColor, fontVariationSettings: "'FILL' 1" }}
              >
                {icon}
              </span>
            </div>
          )}

          <h2 className="text-base font-bold text-white tracking-widest uppercase">
            {title}
          </h2>
          {subtitle && (
            <p className="text-[10px] text-[#c4c7c8] tracking-wider uppercase mt-0.5">
              {subtitle}
            </p>
          )}
        </div>

        {/* Modal Body */}
        <div className="p-5">{children}</div>

        {/* Modal Footer */}
        {footerText && (
          <div className="bg-[#0d0d0d] border-t border-[#333333] px-5 py-2.5 text-center">
            <span className="text-[8px] text-[#666666] tracking-wider uppercase">
              {footerText}
            </span>
          </div>
        )}
      </div>
    </div>
  );
};
