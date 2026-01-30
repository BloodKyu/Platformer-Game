import React from 'react';
import { Play, Box, Zap, Terminal } from 'lucide-react';

interface TitleScreenProps {
  onStartTutorial: () => void;
  onStartSandbox: () => void;
}

export const TitleScreen: React.FC<TitleScreenProps> = ({ onStartTutorial, onStartSandbox }) => {
  return (
    <div className="absolute inset-0 bg-slate-950 flex flex-col items-center justify-center text-white z-50 overflow-hidden">
      {/* Background Grid Animation */}
      <div className="absolute inset-0 opacity-20 pointer-events-none" 
           style={{ 
             backgroundImage: 'linear-gradient(#334155 1px, transparent 1px), linear-gradient(90deg, #334155 1px, transparent 1px)', 
             backgroundSize: '40px 40px' 
           }}>
      </div>
      
      {/* Decorative Circle */}
      <div className="absolute w-[600px] h-[600px] rounded-full border border-blue-900/30 animate-pulse pointer-events-none"></div>

      <div className="z-10 flex flex-col items-center gap-8 animate-in fade-in zoom-in duration-500">
        <div className="text-center">
            <h1 className="text-6xl font-black italic tracking-tighter mb-2 text-transparent bg-clip-text bg-gradient-to-br from-blue-400 to-cyan-600 drop-shadow-[0_0_15px_rgba(59,130,246,0.5)]">
                PROJECT YUI
            </h1>
            <div className="flex items-center justify-center gap-2 text-slate-500 font-mono text-sm tracking-widest">
                <Terminal size={14} />
                <span>FOUNDRY CORE // VER 0.9.1</span>
            </div>
        </div>

        <div className="flex flex-col gap-4 w-64">
             <button 
                onClick={onStartTutorial}
                className="group relative px-6 py-4 bg-slate-900/50 hover:bg-blue-950/50 border border-slate-700 hover:border-blue-500 rounded transition-all flex items-center gap-4 overflow-hidden"
             >
                <div className="absolute inset-0 bg-blue-600/10 translate-x-[-100%] group-hover:translate-x-0 transition-transform duration-300"></div>
                <Play className="text-blue-500 group-hover:text-white transition-colors" size={20} />
                <div className="flex flex-col items-start relative z-10">
                    <span className="font-bold text-sm group-hover:text-blue-200 transition-colors">TUTORIAL</span>
                    <span className="text-[10px] text-slate-500">Learn the basics</span>
                </div>
             </button>

             <button 
                onClick={onStartSandbox}
                className="group relative px-6 py-4 bg-slate-900/50 hover:bg-amber-950/30 border border-slate-700 hover:border-amber-700 rounded transition-all flex items-center gap-4 overflow-hidden"
             >
                <div className="absolute inset-0 bg-amber-600/10 translate-x-[-100%] group-hover:translate-x-0 transition-transform duration-300"></div>
                <Box className="text-amber-500 group-hover:text-white transition-colors" size={20} />
                <div className="flex flex-col items-start relative z-10">
                    <span className="font-bold text-sm group-hover:text-amber-200 transition-colors">SANDBOX</span>
                    <span className="text-[10px] text-slate-500">Free roam & testing</span>
                </div>
             </button>
        </div>

        <div className="text-[10px] text-slate-600 font-mono mt-8">
            SYSTEM READY. WAITING FOR INPUT...
        </div>
      </div>
    </div>
  );
};