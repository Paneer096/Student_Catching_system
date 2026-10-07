import React from 'react';

export interface CanvasToolDockProps {
  onZoomIn: () => void;
  onZoomOut: () => void;
  onZoomToFit: () => void;
  isPhysicsPaused: boolean;
  onTogglePhysics: () => void;
  isParticlesEnabled: boolean;
  onToggleParticles: () => void;
  layoutMode: 'force' | 'hierarchical' | 'radial';
  onLayoutModeChange: (mode: 'force' | 'hierarchical' | 'radial') => void;
  onExportImage: () => void;
  onExportJson: () => void;
}

export const CanvasToolDock: React.FC<CanvasToolDockProps> = ({
  onZoomIn,
  onZoomOut,
  onZoomToFit,
  isPhysicsPaused,
  onTogglePhysics,
  isParticlesEnabled,
  onToggleParticles,
  layoutMode,
  onLayoutModeChange,
  onExportImage,
  onExportJson,
}) => {
  return (
    <div className="absolute right-4 bottom-4 z-20 flex items-center gap-1.5 p-1.5 bg-black/80 backdrop-blur-2xl border border-white/10 rounded-2xl shadow-2xl select-none font-mono text-xs">
      {/* Layout Mode Selector */}
      <div className="flex items-center bg-white/[0.04] p-1 rounded-xl border border-white/5 mr-1">
        <button
          onClick={() => onLayoutModeChange('force')}
          className={`px-2.5 py-1 rounded-lg font-semibold transition-all flex items-center gap-1 ${
            layoutMode === 'force'
              ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-xs'
              : 'text-gray-400 hover:text-white'
          }`}
          title="Force-Directed organic layout"
        >
          <span className="material-symbols-outlined text-[15px]">scatter_plot</span>
          <span className="text-[11px] hidden sm:inline">Force</span>
        </button>
        <button
          onClick={() => onLayoutModeChange('hierarchical')}
          className={`px-2.5 py-1 rounded-lg font-semibold transition-all flex items-center gap-1 ${
            layoutMode === 'hierarchical'
              ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-xs'
              : 'text-gray-400 hover:text-white'
          }`}
          title="Hierarchical Tree / DAG layout"
        >
          <span className="material-symbols-outlined text-[15px]">reorder</span>
          <span className="text-[11px] hidden sm:inline">Tree</span>
        </button>
        <button
          onClick={() => onLayoutModeChange('radial')}
          className={`px-2.5 py-1 rounded-lg font-semibold transition-all flex items-center gap-1 ${
            layoutMode === 'radial'
              ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-xs'
              : 'text-gray-400 hover:text-white'
          }`}
          title="Radial concentric rings layout"
        >
          <span className="material-symbols-outlined text-[15px]">radar</span>
          <span className="text-[11px] hidden sm:inline">Radial</span>
        </button>
      </div>

      <div className="w-[1px] h-5 bg-white/10 mx-0.5" />

      {/* Camera Controls */}
      <button
        onClick={onZoomIn}
        className="p-1.5 rounded-xl text-gray-300 hover:text-white hover:bg-white/10 transition-colors"
        title="Zoom In (+)"
      >
        <span className="material-symbols-outlined text-[18px]">add</span>
      </button>
      <button
        onClick={onZoomOut}
        className="p-1.5 rounded-xl text-gray-300 hover:text-white hover:bg-white/10 transition-colors"
        title="Zoom Out (-)"
      >
        <span className="material-symbols-outlined text-[18px]">remove</span>
      </button>
      <button
        onClick={onZoomToFit}
        className="p-1.5 rounded-xl text-gray-300 hover:text-cyan-400 hover:bg-cyan-500/10 transition-colors"
        title="Fit to Screen / Reset View"
      >
        <span className="material-symbols-outlined text-[18px]">fit_screen</span>
      </button>

      <div className="w-[1px] h-5 bg-white/10 mx-0.5" />

      {/* Physics Simulation Toggle */}
      <button
        onClick={onTogglePhysics}
        className={`p-1.5 rounded-xl transition-colors ${
          isPhysicsPaused
            ? 'text-amber-400 bg-amber-500/10 hover:bg-amber-500/20'
            : 'text-gray-300 hover:text-white hover:bg-white/10'
        }`}
        title={isPhysicsPaused ? 'Resume Physics simulation' : 'Pause Physics simulation'}
      >
        <span className="material-symbols-outlined text-[18px]">
          {isPhysicsPaused ? 'play_arrow' : 'pause'}
        </span>
      </button>

      {/* Particles Toggle */}
      <button
        onClick={onToggleParticles}
        className={`p-1.5 rounded-xl transition-colors ${
          isParticlesEnabled
            ? 'text-cyan-400 bg-cyan-500/10 hover:bg-cyan-500/20'
            : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'
        }`}
        title={isParticlesEnabled ? 'Disable Flow Particles' : 'Enable Energy Flow Particles'}
      >
        <span className="material-symbols-outlined text-[18px]">stream</span>
      </button>

      <div className="w-[1px] h-5 bg-white/10 mx-0.5" />

      {/* Export Options */}
      <button
        onClick={onExportImage}
        className="p-1.5 rounded-xl text-gray-300 hover:text-emerald-400 hover:bg-emerald-500/10 transition-colors"
        title="Export PNG High-Res Snapshot"
      >
        <span className="material-symbols-outlined text-[18px]">photo_camera</span>
      </button>
      <button
        onClick={onExportJson}
        className="p-1.5 rounded-xl text-gray-300 hover:text-purple-400 hover:bg-purple-500/10 transition-colors"
        title="Export Graph JSON"
      >
        <span className="material-symbols-outlined text-[18px]">file_download</span>
      </button>
    </div>
  );
};
