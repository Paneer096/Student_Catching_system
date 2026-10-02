import React, { useState } from 'react';

export interface TimelineScrubberProps {
  startDate?: string;
  endDate?: string;
  currentDate?: string;
  isPlaying?: boolean;
  onTogglePlay?: () => void;
  onSeek?: (value: number) => void;
  onClose?: () => void;
  className?: string;
}

export const TimelineScrubber: React.FC<TimelineScrubberProps> = ({
  startDate = '2026-07-01',
  endDate = '2026-10-01',
  currentDate = '2026-09-18',
  isPlaying = false,
  onTogglePlay,
  onSeek,
  onClose,
  className = '',
}) => {
  const [sliderValue, setSliderValue] = useState(75);

  const handleSlider = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = Number(e.target.value);
    setSliderValue(val);
    onSeek?.(val);
  };

  return (
    <div
      className={`bg-[#0d0d0d]/95 backdrop-blur-md border border-[#333333] rounded-sm p-3 font-mono shadow-2xl select-none ${className}`}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold text-[#00b4ff] uppercase tracking-widest flex items-center gap-1">
            <span className="material-symbols-outlined text-[13px]">history</span>
            ATTENDANCE TIMELINE SCRUBBER
          </span>
          <span className="text-[10px] px-2 py-0.5 bg-[#1a1919] border border-[#333333] text-white">
            {currentDate} (SEMESTER WEEK 11)
          </span>
        </div>

        <div className="flex items-center gap-2">
          {onTogglePlay && (
            <button
              onClick={onTogglePlay}
              className="px-2.5 py-1 bg-[#181818] hover:bg-[#252525] border border-[#333333] hover:border-white text-white text-[10px] font-bold uppercase rounded-sm flex items-center gap-1 cursor-pointer transition-colors"
            >
              <span className="material-symbols-outlined text-[13px]">
                {isPlaying ? 'pause' : 'play_arrow'}
              </span>
              <span>{isPlaying ? 'PAUSE' : 'PLAY'}</span>
            </button>
          )}

          {onClose && (
            <button
              onClick={onClose}
              className="text-[#c4c7c8] hover:text-white text-xs px-1.5 py-0.5 border border-[#333333] hover:border-white rounded-sm cursor-pointer"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Slider Track */}
      <div className="flex items-center gap-3">
        <span className="text-[9px] text-[#777777] font-mono shrink-0">
          {startDate}
        </span>
        <input
          type="range"
          min="0"
          max="100"
          value={sliderValue}
          onChange={handleSlider}
          className="w-full accent-[#00b4ff] cursor-pointer bg-[#222222] h-1.5 rounded-sm"
        />
        <span className="text-[9px] text-[#777777] font-mono shrink-0">
          {endDate}
        </span>
      </div>
    </div>
  );
};
