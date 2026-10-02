import React from 'react';
import { MkButton } from '../ui/MkButton';

export interface ErrorAlertModalProps {
  isOpen: boolean;
  title?: string;
  message?: string;
  steps?: string[];
  onRetry?: () => void;
  isRetrying?: boolean;
}

export const ErrorAlertModal: React.FC<ErrorAlertModalProps> = ({
  isOpen,
  title = 'Telemetry Connection Alert',
  message = 'Makerove backend services are currently unreachable or warming up.',
  steps = [
    'Verify FastAPI backend service is running on port 8000 (uvicorn app.main:app)',
    'Verify database connection (makerove.db)',
    'Confirm CORS origin includes frontend port 5173',
  ],
  onRetry,
  isRetrying = false,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 font-mono select-none">
      <div className="bg-[#141416] border border-[#ff4c4c]/40 rounded-xl p-6 max-w-md w-full shadow-[0_0_40px_rgba(255,76,76,0.15)] flex flex-col items-center text-center">
        <div className="w-12 h-12 rounded-full bg-[#00b4ff]/10 border border-[#00b4ff]/30 flex items-center justify-center mb-3 text-[#00b4ff]">
          <span
            className={`material-symbols-outlined text-2xl ${
              isRetrying ? 'animate-spin' : ''
            }`}
          >
            sync
          </span>
        </div>

        <h3 className="text-sm font-bold text-white uppercase tracking-widest mb-1">
          {title}
        </h3>
        <p className="text-xs text-[#8e9aa8] leading-relaxed mb-4">{message}</p>

        {steps.length > 0 && (
          <div className="bg-[#0b0b0d] border border-white/5 rounded-lg p-3 text-left w-full mb-4 text-[11px] font-mono text-[#a0aec0] space-y-1">
            <div className="text-[10px] uppercase font-bold text-[#c4c7c8] tracking-wider mb-1">
              Diagnostic steps:
            </div>
            {steps.map((step, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <span className="text-[#39ff14] font-bold">{idx + 1}.</span>
                <span className="text-white/80">{step}</span>
              </div>
            ))}
          </div>
        )}

        {onRetry && (
          <MkButton
            variant="primary"
            size="lg"
            className="w-full"
            loading={isRetrying}
            onClick={onRetry}
            icon="refresh"
          >
            {isRetrying ? 'RECONNECTING...' : 'RETRY CONNECTION'}
          </MkButton>
        )}
      </div>
    </div>
  );
};
