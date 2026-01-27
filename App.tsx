import React, { useState, useCallback, useEffect } from 'react';
import { GameCanvas } from './components/GameCanvas';
import { GeminiDirector } from './components/GeminiDirector';
import { ProfilerOverlay } from './components/ProfilerOverlay';
import { DEFAULT_PHYSICS_PROFILE, ASSET_ROOT, ANIMATION_MANIFEST } from './constants';
import { PhysicsProfile, PerformanceStats } from './types';
import { Info, Settings, AlertTriangle, RefreshCw, Link as LinkIcon, RotateCcw } from 'lucide-react';
import { AssetManager } from './services/assetManager';

export default function App() {
  const [physicsProfile, setPhysicsProfile] = useState<PhysicsProfile>(DEFAULT_PHYSICS_PROFILE);
  const [showControls, setShowControls] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [fpsLimit, setFpsLimit] = useState<number | 'max'>('max');
  
  // Settings State
  const [assetUrl, setAssetUrl] = useState(ASSET_ROOT);
  const [assetErrors, setAssetErrors] = useState<string[]>([]);

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

  const handleReloadAssets = () => {
    let cleanUrl = assetUrl.trim();
    // Intelligent Fix: If user pastes a file path (ends in .png), strip the filename to get the folder
    if (cleanUrl.match(/\.(png|jpg|jpeg|gif)$/i)) {
        const lastSlashIndex = cleanUrl.lastIndexOf('/');
        if (lastSlashIndex !== -1) {
            cleanUrl = cleanUrl.substring(0, lastSlashIndex);
            // If they pasted a path inside /run/, strip that too to get root
            if (cleanUrl.endsWith('/run')) {
                 cleanUrl = cleanUrl.substring(0, cleanUrl.lastIndexOf('/'));
            }
        }
    }
    // Remove trailing slash
    if (cleanUrl.endsWith('/')) {
        cleanUrl = cleanUrl.slice(0, -1);
    }

    setAssetUrl(cleanUrl);
    AssetManager.setRoot(cleanUrl);
    
    // Short delay to let loading start before checking errors
    setTimeout(() => {
        setAssetErrors([...AssetManager.errorLog]);
    }, 500);
  };

  const handleResetAssets = () => {
      setAssetUrl(ASSET_ROOT);
      AssetManager.setRoot(ASSET_ROOT);
      setAssetErrors([]);
  };

  // Sync error log periodically when settings are open
  useEffect(() => {
      let interval: number;
      if (showSettings) {
          interval = window.setInterval(() => {
              setAssetErrors([...AssetManager.errorLog]);
          }, 1000);
      }
      return () => clearInterval(interval);
  }, [showSettings]);

  // Generate a preview path for the UI
  const getPreviewPath = () => {
      const config = ANIMATION_MANIFEST.RUN;
      const cleanRoot = assetUrl.endsWith('/') ? assetUrl.slice(0, -1) : assetUrl;
      return `${cleanRoot}/${config.folder}/${config.prefix}001.png`;
  };

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
            <div className="bg-slate-900 border border-slate-700 p-6 rounded-lg shadow-2xl w-[500px] animate-in fade-in zoom-in-95 duration-200">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-white font-mono font-bold flex items-center gap-2">
                        <Settings size={18} /> SETTINGS
                    </h2>
                    <button onClick={() => setShowSettings(false)} className="text-slate-400 hover:text-white">✕</button>
                </div>

                <div className="space-y-6">
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

                    {/* Asset Debug Section */}
                    <div className="border-t border-slate-700 pt-4">
                        <label className="text-xs text-slate-400 font-mono mb-2 block flex items-center gap-2">
                            <LinkIcon size={12} className="text-blue-500"/> ASSET SOURCE ROOT
                        </label>
                        
                        {/* Preview Helper */}
                        <div className="mb-2 px-2 py-1 bg-slate-950 rounded border border-slate-800">
                             <div className="text-[10px] text-slate-500 font-mono">NEXT LOAD ATTEMPT:</div>
                             <div className="text-[10px] text-blue-300 font-mono truncate" title={getPreviewPath()}>
                                {getPreviewPath()}
                             </div>
                        </div>

                        <div className="flex gap-2 mb-2">
                            <input 
                                type="text" 
                                value={assetUrl}
                                onChange={(e) => setAssetUrl(e.target.value)}
                                className="flex-1 bg-black/50 border border-slate-700 rounded px-2 py-1 text-xs font-mono text-slate-300 focus:border-blue-500 focus:outline-none"
                                placeholder="https://..."
                            />
                            <button 
                                onClick={handleResetAssets}
                                className="bg-slate-800 hover:bg-slate-700 text-slate-300 p-1.5 rounded border border-slate-700"
                                title="Reset to Default"
                            >
                                <RotateCcw size={14} />
                            </button>
                            <button 
                                onClick={handleReloadAssets}
                                className="bg-blue-700 hover:bg-blue-600 text-white p-1.5 rounded"
                                title="Reload Assets"
                            >
                                <RefreshCw size={14} />
                            </button>
                        </div>
                        
                        <label className="text-xs text-slate-500 font-mono mb-2 block flex items-center gap-2 mt-4">
                            <AlertTriangle size={12} className={assetErrors.length > 0 ? "text-amber-500" : "text-slate-600"}/> LOG
                        </label>
                        <div className="bg-black/50 rounded p-2 h-24 overflow-y-auto font-mono text-[10px] text-red-300 border border-slate-800">
                            {assetErrors.length === 0 ? (
                                <span className="text-slate-500 italic">System Normal.</span>
                            ) : (
                                assetErrors.map((err, i) => (
                                    <div key={i} className="mb-1 border-b border-red-900/30 pb-1 break-all">
                                        {err}
                                    </div>
                                ))
                            )}
                        </div>
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