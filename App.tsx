import React, { useState, useCallback } from 'react';
import { GameCanvas } from './components/GameCanvas';
import { GeminiDirector } from './components/GeminiDirector';
import { ProfilerOverlay } from './components/ProfilerOverlay';
import { DEFAULT_PHYSICS_PROFILE } from './constants';
import { PhysicsProfile, PerformanceStats } from './types';
import { Info, Settings } from 'lucide-react';

export default function App() {
  const [physicsProfile, setPhysicsProfile] = useState<PhysicsProfile>(DEFAULT_PHYSICS_PROFILE);
  const [showControls, setShowControls] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [fpsLimit, setFpsLimit] = useState<number | 'max'>('max'); // Default to max/uncapped
  
  const [perfStats, setPerfStats] = useState<PerformanceStats>({
    fps: 0,
    frameTimeMs: 0,
    particleCount: 0,
    platformCount: 0
  });

  const handleUpdateProfile = (newValues: Partial<PhysicsProfile>) => {
    setPhysicsProfile(prev => ({ ...prev, ...newValues }));
  };

  const handleStatsUpdate = useCallback((stats: PerformanceStats) => {
    setPerfStats(stats);
  }, []);

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-black">
      {/* Game Layer - Full Screen */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="relative w-full h-full max-w-[1920px] max-h-[1080px] aspect-video">
            <GameCanvas 
                physicsProfile={physicsProfile} 
                onStatsUpdate={handleStatsUpdate}
                fpsLimit={fpsLimit}
            />
            
            {/* HUD Overlay: Title */}
            <div className="absolute top-6 left-6 flex gap-4 pointer-events-none">
                <div className="bg-black/50 backdrop-blur-sm border border-slate-700/50 p-2 rounded text-white font-mono text-sm shadow-lg">
                    <span className="text-blue-400 font-bold">YUI SYSTEM</span> ONLINE
                </div>
            </div>

            {/* Controls Helper */}
            {showControls && (
                <div className="absolute bottom-12 left-1/2 -translate-x-1/2 bg-black/60 backdrop-blur-md border border-slate-600/50 rounded-full px-8 py-4 text-white flex items-center gap-8 pointer-events-none transition-opacity duration-500 hover:opacity-0">
                    <div className="flex flex-col items-center gap-1">
                        <div className="flex gap-1">
                            <span className="w-8 h-8 border border-slate-400 rounded flex items-center justify-center text-xs font-bold">A</span>
                            <span className="w-8 h-8 border border-slate-400 rounded flex items-center justify-center text-xs font-bold">S</span>
                            <span className="w-8 h-8 border border-slate-400 rounded flex items-center justify-center text-xs font-bold">D</span>
                        </div>
                        <span className="text-[10px] text-slate-400 tracking-wider">MOVE</span>
                    </div>
                    <div className="h-8 w-px bg-slate-600/50"></div>
                    <div className="flex flex-col items-center gap-1">
                        <span className="w-20 h-8 border border-slate-400 rounded flex items-center justify-center text-xs font-bold">SPACE</span>
                        <span className="text-[10px] text-slate-400 tracking-wider">JUMP</span>
                    </div>
                    <div className="flex flex-col items-center gap-1">
                        <span className="w-10 h-8 border border-slate-400 rounded flex items-center justify-center text-xs font-bold">K</span>
                        <span className="text-[10px] text-slate-400 tracking-wider">DASH</span>
                    </div>
                    <div className="flex flex-col items-center gap-1">
                        <span className="w-10 h-8 border border-slate-400 rounded flex items-center justify-center text-xs font-bold">J</span>
                        <span className="text-[10px] text-slate-400 tracking-wider">ATK</span>
                    </div>
                </div>
            )}
        </div>
      </div>

      {/* Profiler Overlay (Draggable) */}
      <ProfilerOverlay stats={perfStats} />

      {/* Settings Menu Overlay */}
      {showSettings && (
        <div className="absolute inset-0 bg-black/50 backdrop-blur-sm z-[60] flex items-center justify-center">
            <div className="bg-slate-900 border border-slate-700 p-6 rounded-lg shadow-2xl w-80 animate-in fade-in zoom-in-95 duration-200">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-white font-mono font-bold flex items-center gap-2">
                        <Settings size={18} /> SETTINGS
                    </h2>
                    <button onClick={() => setShowSettings(false)} className="text-slate-400 hover:text-white">✕</button>
                </div>

                <div className="space-y-4">
                    <div>
                        <label className="text-xs text-slate-400 font-mono mb-2 block">TARGET FPS</label>
                        <div className="grid grid-cols-4 gap-2">
                            {[30, 60, 120, 'max'].map((opt) => (
                                <button
                                    key={opt}
                                    onClick={() => setFpsLimit(opt as number | 'max')}
                                    className={`py-2 text-xs font-mono font-bold rounded border transition-colors ${
                                        fpsLimit === opt 
                                        ? 'bg-blue-600 border-blue-500 text-white shadow-[0_0_10px_rgba(37,99,235,0.5)]' 
                                        : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700 hover:text-white'
                                    }`}
                                >
                                    {opt === 'max' ? 'MAX' : opt}
                                </button>
                            ))}
                        </div>
                        <p className="text-[10px] text-slate-500 mt-2">
                            Limits render rate. Physics always runs at 60Hz.
                        </p>
                    </div>
                </div>
                
                <div className="mt-8">
                     <button 
                        onClick={() => setShowSettings(false)}
                        className="w-full bg-slate-800 hover:bg-slate-700 text-white font-mono text-xs py-2 rounded border border-slate-700"
                    >
                        CLOSE
                    </button>
                </div>
            </div>
        </div>
      )}

      {/* UI Layer: Floating Debug Menu */}
      <div className="absolute top-4 right-4 bottom-4 z-50 pointer-events-none flex flex-col items-end justify-start gap-4">
        <GeminiDirector 
            currentProfile={physicsProfile} 
            onUpdateProfile={handleUpdateProfile} 
        />
        
        <button 
          onClick={() => setShowSettings(true)}
          className="pointer-events-auto p-3 bg-slate-900/80 backdrop-blur text-slate-400 rounded-full border border-slate-700 hover:bg-slate-800 hover:text-white transition-colors shadow-lg"
          title="Game Settings"
        >
          <Settings size={20} />
        </button>

        <button 
          onClick={() => setShowControls(!showControls)}
          className="pointer-events-auto p-3 bg-slate-900/80 backdrop-blur text-slate-400 rounded-full border border-slate-700 hover:bg-slate-800 hover:text-white transition-colors shadow-lg"
          title="Toggle Controls Overlay"
        >
          <Info size={20} />
        </button>
      </div>
    </div>
  );
}