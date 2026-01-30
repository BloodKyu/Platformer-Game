import React, { useState, useCallback } from 'react';
import { GameCanvas } from './components/GameCanvas';
import { GeminiDirector } from './components/GeminiDirector';
import { ProfilerOverlay } from './components/ProfilerOverlay';
import { TitleScreen } from './components/TitleScreen';
import { DEFAULT_PHYSICS_PROFILE } from './constants';
import { PhysicsProfile, PerformanceStats, LevelData } from './types';
import { TUTORIAL_LEVEL, SANDBOX_LEVEL } from './levels';
import { AssetManager } from './services/assetManager';
import { Info, Settings, Ruler, Trash2, Home, Bug, Pause, Play } from 'lucide-react';

type Scene = 'TITLE' | 'TUTORIAL' | 'SANDBOX';

export default function App() {
  const [scene, setScene] = useState<Scene>('TITLE');
  const [physicsProfile, setPhysicsProfile] = useState<PhysicsProfile>(DEFAULT_PHYSICS_PROFILE);
  const [showControls, setShowControls] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [fpsLimit, setFpsLimit] = useState<number | 'max'>('max');
  const [isPaused, setIsPaused] = useState(false); // NEW PAUSE STATE
  
  // Settings State
  const [spriteScale, setSpriteScale] = useState(1.0);
  const [debugHitboxes, setDebugHitboxes] = useState(false);

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

  const getCurrentLevel = (): LevelData => {
      switch(scene) {
          case 'TUTORIAL': return TUTORIAL_LEVEL;
          case 'SANDBOX': return SANDBOX_LEVEL;
          default: return SANDBOX_LEVEL;
      }
  };

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-black">
      {/* SCENE MANAGER */}
      {scene === 'TITLE' ? (
          <TitleScreen 
             onStartTutorial={() => setScene('TUTORIAL')}
             onStartSandbox={() => setScene('SANDBOX')}
          />
      ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="relative w-full h-full max-w-[1920px] max-h-[1080px] aspect-video">
                {/* GAME CANVAS with Key to force re-mount on level change */}
                <GameCanvas 
                    key={scene} 
                    level={getCurrentLevel()}
                    physicsProfile={physicsProfile} 
                    onStatsUpdate={handleStatsUpdate}
                    fpsLimit={fpsLimit}
                    spriteScale={spriteScale}
                    debugHitboxes={debugHitboxes}
                    isPaused={isPaused} // PASS PROP
                    onExit={() => setScene('TITLE')}
                />
                
                {/* HUD: Title */}
                <div className="absolute bottom-6 left-6 flex gap-4 pointer-events-none">
                    <div className="bg-black/50 backdrop-blur-sm border border-slate-700/50 p-2 rounded text-white font-mono text-sm shadow-lg">
                        <span className="text-blue-400 font-bold">YUI SYSTEM</span> ONLINE 
                        <span className="ml-2 text-slate-500">// {getCurrentLevel().name}</span>
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
                            <span className="w-8 h-8 border border-slate-400 rounded flex items-center justify-center text-xs font-bold">W</span>
                            <span className="text-[10px] text-slate-400 tracking-wider">JUMP</span>
                        </div>
                        <div className="flex flex-col items-center gap-1">
                            <span className="w-16 h-8 border border-slate-400 rounded flex items-center justify-center text-xs font-bold">SHIFT</span>
                            <span className="text-[10px] text-slate-400 tracking-wider">DASH</span>
                        </div>
                        <div className="flex flex-col items-center gap-1">
                            <span className="w-20 h-8 border border-slate-400 rounded flex items-center justify-center text-xs font-bold">SPACE</span>
                            <span className="text-[10px] text-slate-400 tracking-wider">ATTACK</span>
                        </div>
                    </div>
                )}
            </div>
          </div>
      )}

      {/* Profiler Overlay */}
      {scene !== 'TITLE' && <ProfilerOverlay stats={perfStats} />}

      {/* Settings Menu Overlay */}
      {showSettings && (
        <div className="absolute inset-0 bg-black/50 backdrop-blur-sm z-[60] flex items-center justify-center">
            <div className="bg-slate-900 border border-slate-700 p-6 rounded-lg shadow-2xl w-[500px] max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-200">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-white font-mono font-bold flex items-center gap-2">
                        <Settings size={18} /> SETTINGS
                    </h2>
                    <button onClick={() => setShowSettings(false)} className="text-slate-400 hover:text-white">✕</button>
                </div>

                <div className="space-y-6">
                    {/* PERFORMANCE */}
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
                    </div>

                    {/* VISUALS */}
                    <div className="border-t border-slate-700 pt-4">
                        <div className="flex justify-between text-[10px] text-slate-400 mb-1">
                            <span className="flex items-center gap-1"><Ruler size={10}/> SPRITE SCALE ADJUST</span>
                            <span className="text-blue-300 font-bold">{Math.round(spriteScale * 100)}%</span>
                        </div>
                        <input 
                            type="range" 
                            min="0.1" 
                            max="2.0" 
                            step="0.05"
                            value={spriteScale}
                            onChange={(e) => setSpriteScale(parseFloat(e.target.value))}
                            className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                        />
                        <div className="text-[9px] text-slate-600 mt-1 italic text-center">
                            (Applies to both IDLE and RUN animations)
                        </div>
                    </div>

                    {/* DANGER ZONE / CACHE CLEAR */}
                    <div className="border-t border-slate-700 pt-4 mt-4">
                        <label className="text-xs text-slate-400 font-mono mb-2 block flex items-center gap-1">
                            <Info size={10} /> TROUBLESHOOTING
                        </label>
                        <div className="space-y-2">
                            <button 
                                onClick={() => setDebugHitboxes(!debugHitboxes)}
                                className={`w-full py-2 px-3 rounded border text-xs font-mono flex items-center justify-between transition-colors ${
                                    debugHitboxes 
                                    ? 'bg-purple-900/30 border-purple-500 text-purple-200' 
                                    : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700'
                                }`}
                            >
                                <span className="flex items-center gap-2"><Bug size={14}/> SHOW HITBOXES</span>
                                <span className="text-[10px]">{debugHitboxes ? 'ON' : 'OFF'}</span>
                            </button>

                            <button 
                                onClick={() => AssetManager.purgeCache()}
                                className="w-full bg-red-950/30 hover:bg-red-900/50 text-red-200 text-xs py-3 rounded border border-red-900/50 flex items-center justify-center gap-2 transition-colors"
                            >
                                <Trash2 size={12} /> CLEAR ASSET CACHE & RELOAD
                            </button>
                        </div>
                    </div>
                </div>
                
                <div className="mt-6 border-t border-slate-800 pt-4">
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
      {scene !== 'TITLE' && (
        <div className="absolute top-4 right-4 bottom-4 z-50 pointer-events-none flex flex-col items-end justify-start gap-4">
            
            <button 
              onClick={() => setScene('TITLE')}
              className="pointer-events-auto p-3 bg-red-950/80 backdrop-blur text-red-200 rounded-full border border-red-800 hover:bg-red-900 hover:text-white transition-colors shadow-lg"
              title="Return to Menu"
            >
              <Home size={20} />
            </button>

            <GeminiDirector 
                currentProfile={physicsProfile} 
                onUpdateProfile={handleUpdateProfile} 
            />
            
            {/* PAUSE BUTTON */}
            <button 
                onClick={() => setIsPaused(!isPaused)}
                className={`pointer-events-auto p-3 backdrop-blur rounded-full border transition-colors shadow-lg ${
                    isPaused 
                    ? 'bg-amber-600/80 border-amber-500 text-white animate-pulse' 
                    : 'bg-slate-900/80 border-slate-700 text-slate-400 hover:bg-slate-800 hover:text-white'
                }`}
                title={isPaused ? "Resume" : "Pause"}
            >
                {isPaused ? <Play size={20} /> : <Pause size={20} />}
            </button>

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
      )}
    </div>
  );
}