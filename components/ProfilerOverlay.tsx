import React, { useState, useRef, useEffect } from 'react';
import { Activity, Move, Minimize2, Maximize2, Camera, Brain, ChevronDown } from 'lucide-react';
import { PerformanceStats } from '../types';
import { diagnosePerformance } from '../services/geminiService';

interface ProfilerOverlayProps {
  stats: PerformanceStats;
}

export const ProfilerOverlay: React.FC<ProfilerOverlayProps> = ({ stats }) => {
  const [position, setPosition] = useState({ x: 20, y: 80 });
  const [isDragging, setIsDragging] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(true);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [diagnostic, setDiagnostic] = useState<string | null>(null);
  const [isDiagnosing, setIsDiagnosing] = useState(false);

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setDragOffset({
      x: e.clientX - position.x,
      y: e.clientY - position.y
    });
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging) {
        setPosition({
          x: e.clientX - dragOffset.x,
          y: e.clientY - dragOffset.y
        });
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, dragOffset]);

  const handleSnapshot = () => {
    const json = JSON.stringify(stats, null, 2);
    navigator.clipboard.writeText(json);
    alert("Snapshot copied to clipboard");
  };

  const handleDiagnose = async () => {
      setIsDiagnosing(true);
      const result = await diagnosePerformance(stats);
      setDiagnostic(result);
      setIsDiagnosing(false);
  };

  // Color coding for health
  const fpsColor = stats.fps < 30 ? 'text-red-500' : stats.fps < 55 ? 'text-amber-500' : 'text-green-400';
  const msColor = stats.frameTimeMs > 16.6 ? 'text-red-500' : 'text-blue-300';

  return (
    <div 
      className="absolute z-[100] bg-slate-950/90 backdrop-blur-md border border-slate-700 rounded-lg shadow-2xl font-mono text-xs overflow-hidden w-64 select-none"
      style={{ left: position.x, top: position.y }}
    >
      {/* Header / Drag Handle */}
      <div 
        className="bg-slate-900 p-2 flex items-center justify-between cursor-move border-b border-slate-800"
        onMouseDown={handleMouseDown}
      >
        <div className="flex items-center gap-2 text-slate-300 font-bold">
          <Activity size={14} className="text-amber-500" />
          <span>SYS.PROFILER</span>
        </div>
        <button 
          onMouseDown={(e) => e.stopPropagation()}
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="text-slate-500 hover:text-white"
        >
          {isCollapsed ? <Maximize2 size={14} /> : <Minimize2 size={14} />}
        </button>
      </div>

      {/* Content */}
      {!isCollapsed && (
        <div className="p-3 space-y-3">
            {/* Primary Metrics */}
            <div className="grid grid-cols-2 gap-2">
                <div className="bg-black/40 p-2 rounded border border-slate-800">
                    <div className="text-slate-500 text-[10px] uppercase">FPS</div>
                    <div className={`text-xl font-bold ${fpsColor}`}>{Math.round(stats.fps)}</div>
                </div>
                <div className="bg-black/40 p-2 rounded border border-slate-800">
                    <div className="text-slate-500 text-[10px] uppercase">Frame Time</div>
                    <div className={`text-xl font-bold ${msColor}`}>{stats.frameTimeMs.toFixed(1)}<span className="text-xs text-slate-600">ms</span></div>
                </div>
            </div>

            {/* Secondary Metrics */}
            <div className="space-y-1 text-slate-400">
                <div className="flex justify-between">
                    <span>Entities</span>
                    <span className="text-white">{stats.particleCount + stats.platformCount}</span>
                </div>
                <div className="flex justify-between">
                    <span>Particles</span>
                    <span className="text-white">{stats.particleCount}</span>
                </div>
                {stats.memoryUsage && (
                    <div className="flex justify-between">
                        <span>Heap</span>
                        <span className="text-white">{stats.memoryUsage.toFixed(1)} MB</span>
                    </div>
                )}
            </div>

            {/* AI Diagnostic Area */}
            <div className="pt-2 border-t border-slate-800">
                <div className="flex gap-2 mb-2">
                    <button 
                        onClick={handleSnapshot}
                        className="flex-1 flex items-center justify-center gap-1 bg-slate-800 hover:bg-slate-700 py-1.5 rounded text-[10px] text-white transition-colors"
                    >
                        <Camera size={12} /> SNAPSHOT
                    </button>
                    <button 
                        onClick={handleDiagnose}
                        className="flex-1 flex items-center justify-center gap-1 bg-amber-900/50 hover:bg-amber-800/50 border border-amber-700/50 text-amber-200 py-1.5 rounded text-[10px] transition-colors"
                    >
                        {isDiagnosing ? <Activity size={12} className="animate-spin" /> : <Brain size={12} />}
                        {isDiagnosing ? 'SCANNING...' : 'DIAGNOSE'}
                    </button>
                </div>
                {diagnostic && (
                    <div className="bg-amber-950/30 border border-amber-900/50 p-2 rounded text-amber-200/90 italic leading-tight">
                        "{diagnostic}"
                    </div>
                )}
            </div>
        </div>
      )}

      {/* Collapsed State Mini-View */}
      {isCollapsed && (
         <div className="p-2 flex items-center justify-between text-slate-300">
             <div className="flex gap-3">
                 <span className={fpsColor}>{Math.round(stats.fps)} FPS</span>
                 <span className={msColor}>{stats.frameTimeMs.toFixed(1)} ms</span>
             </div>
         </div>
      )}
    </div>
  );
};