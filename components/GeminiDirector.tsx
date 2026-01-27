import React, { useState, useRef, useEffect } from 'react';
import { Terminal, Send, Zap, ChevronRight, Copy, Check } from 'lucide-react';
import { processGameDirectorCommand } from '../services/geminiService';
import { PhysicsProfile } from '../types';

interface GeminiDirectorProps {
  currentProfile: PhysicsProfile;
  onUpdateProfile: (newProfile: Partial<PhysicsProfile>) => void;
}

export const GeminiDirector: React.FC<GeminiDirectorProps> = ({ currentProfile, onUpdateProfile }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [logs, setLogs] = useState<string[]>(['> System initialized.', '> Connected to Foundry Core.']);
  const [isLoading, setIsLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const logsEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userCmd = input;
    setInput('');
    setLogs(prev => [...prev, `> User: ${userCmd}`]);
    setIsLoading(true);

    const result = await processGameDirectorCommand(userCmd, currentProfile);

    setLogs(prev => [...prev, `> Director: ${result.text}`]);
    if (result.newProfile) {
      onUpdateProfile(result.newProfile);
      setLogs(prev => [...prev, `> SYSTEM: Physics engine reconfigured.`]);
    }
    
    setIsLoading(false);
  };

  const handleCopyProfile = () => {
    const json = JSON.stringify(currentProfile, null, 2);
    navigator.clipboard.writeText(json);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    setLogs(prev => [...prev, `> SYSTEM: Profile copied to clipboard.`]);
  };

  if (!isOpen) {
    return (
      <button 
        onClick={() => setIsOpen(true)}
        className="pointer-events-auto bg-slate-900/80 backdrop-blur border border-slate-700 text-blue-400 p-3 rounded-full shadow-lg hover:bg-slate-800 hover:text-blue-300 transition-all hover:scale-105 group"
        title="Open Game Director"
      >
        <Terminal size={24} />
      </button>
    );
  }

  return (
    <div className="pointer-events-auto flex flex-col h-[600px] w-[400px] bg-slate-950/95 border border-slate-700 backdrop-blur-md text-slate-300 font-mono text-sm shadow-2xl rounded-lg overflow-hidden transition-all animate-in fade-in slide-in-from-right-10 duration-300">
      <div className="p-3 bg-slate-900 border-b border-slate-800 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2 text-blue-400">
          <Terminal size={16} />
          <span className="font-bold tracking-wider text-xs">GAME DIRECTOR // AI DEBUG</span>
        </div>
        <button onClick={() => setIsOpen(false)} className="p-1 hover:bg-slate-800 rounded">
           <ChevronRight size={18} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-2 scrollbar-thin scrollbar-thumb-slate-700">
        {logs.map((log, i) => (
          <div key={i} className={`break-words ${log.startsWith('> User') ? 'text-slate-400 italic' : log.startsWith('> SYSTEM') ? 'text-amber-500' : 'text-blue-300/90'}`}>
            {log}
          </div>
        ))}
        {isLoading && <div className="text-amber-400 animate-pulse text-xs">... Processing ...</div>}
        <div ref={logsEndRef} />
      </div>

      <form onSubmit={handleSubmit} className="p-3 bg-slate-900 border-t border-slate-800 flex gap-2 shrink-0">
        <input 
          type="text" 
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Command..."
          className="flex-1 bg-slate-950 border border-slate-700 rounded px-3 py-2 focus:outline-none focus:border-blue-500 text-white text-xs"
        />
        <button type="submit" disabled={isLoading} className="bg-blue-600 text-white p-2 rounded disabled:opacity-50">
          {isLoading ? <Zap size={16} className="animate-spin" /> : <Send size={16} />}
        </button>
      </form>

      <div className="p-3 border-t border-slate-800 bg-black/40 text-[10px] shrink-0">
         <div className="flex justify-between items-center mb-2">
            <span className="text-slate-500 font-bold">PHYSICS PROFILE</span>
            <button onClick={handleCopyProfile} className="flex gap-1 items-center text-slate-400 hover:text-white">
                {copied ? <Check size={12} /> : <Copy size={12} />}
            </button>
         </div>
         <div className="grid grid-cols-2 gap-x-4 gap-y-1 font-mono">
            <div className="flex justify-between border-b border-slate-800/50"><span>Gravity</span> <span className="text-blue-200">{currentProfile.gravity.toFixed(2)}</span></div>
            <div className="flex justify-between border-b border-slate-800/50"><span>Run Speed</span> <span className="text-blue-200">{currentProfile.runSpeed.toFixed(1)}</span></div>
            <div className="flex justify-between border-b border-slate-800/50"><span>Accel</span> <span className="text-blue-200">{currentProfile.groundAccel.toFixed(1)}</span></div>
            <div className="flex justify-between border-b border-slate-800/50"><span>Decel</span> <span className="text-blue-200">{currentProfile.groundDecel.toFixed(1)}</span></div>
            <div className="flex justify-between border-b border-slate-800/50"><span>Jump F</span> <span className="text-blue-200">{currentProfile.jumpForce.toFixed(1)}</span></div>
            <div className="flex justify-between border-b border-slate-800/50"><span>D. Jump</span> <span className="text-blue-200">{currentProfile.doubleJumpForce?.toFixed(1) || '0'}</span></div>
            <div className="flex justify-between border-b border-slate-800/50"><span>Dash Spd</span> <span className="text-blue-200">{currentProfile.dashSpeed.toFixed(1)}</span></div>
            <div className="flex justify-between border-b border-slate-800/50"><span>Dash Time</span> <span className="text-blue-200">{currentProfile.dashDurationFrames}</span></div>
         </div>
      </div>
    </div>
  );
};