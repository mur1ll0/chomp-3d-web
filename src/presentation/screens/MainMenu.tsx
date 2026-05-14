import React from 'react';
import { useAppStore } from '../../store/useAppStore';
import { Play, Wifi, Settings } from 'lucide-react';

export const MainMenu: React.FC = () => {
  const { setScreen, setGameMode } = useAppStore();

  return (
    <div className="flex items-center justify-center min-h-screen bg-slate-900 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-slate-800 to-slate-950">
      <div className="max-w-md w-full p-8 bg-slate-800/50 backdrop-blur-md rounded-2xl shadow-2xl border border-slate-700/50 transform transition-all">
        <div className="text-center mb-10">
          <h1 className="text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-red-500 mb-2 drop-shadow-lg">
            CHOMP 3D
          </h1>
          <p className="text-slate-400 text-sm font-medium tracking-widest uppercase">Eat to evolve</p>
        </div>

        <div className="space-y-4">
          <button
            onClick={() => setScreen('session-select')}
            className="group relative w-full flex items-center justify-center gap-3 bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-400 hover:to-red-500 text-white font-bold py-4 px-6 rounded-xl shadow-lg hover:shadow-orange-500/25 transition-all active:scale-95 overflow-hidden"
          >
            <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-out" />
            <Wifi className="w-5 h-5 relative z-10" />
            <span className="relative z-10">Jogar Online</span>
          </button>

          <button
            onClick={() => {
              setGameMode('single');
              setScreen('character-select');
            }}
            className="w-full flex items-center justify-center gap-3 bg-slate-700 hover:bg-slate-600 text-white font-bold py-4 px-6 rounded-xl shadow-lg transition-all active:scale-95 border border-slate-600 hover:border-slate-500"
          >
            <Play className="w-5 h-5 text-green-400" />
            <span>Jogar Offline</span>
          </button>

          <button
            onClick={() => setScreen('settings')}
            className="w-full flex items-center justify-center gap-3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold py-4 px-6 rounded-xl shadow-lg transition-all active:scale-95 border border-slate-700 hover:text-white"
          >
            <Settings className="w-5 h-5" />
            <span>Configurações</span>
          </button>
        </div>

        {/* Footer de Créditos */}
        <div className="mt-12 flex justify-between items-center gap-4 text-[10px] text-slate-500 font-medium border-t border-slate-700/50 pt-6">
          <div className="flex-1 text-center group">
            <a href="https://antigravity.google/" target="_blank" rel="noopener noreferrer" className="hover:text-cyan-400 transition-colors uppercase tracking-widest">
              Made with <span className="text-slate-400 group-hover:text-cyan-300">Antigravity</span>
            </a>
          </div>
          <div className="w-px h-4 bg-slate-700/50" />
          <div className="flex-1 text-center">
            <span className="uppercase tracking-widest">Made by <span className="text-slate-400">Murileski</span></span>
          </div>
          <div className="w-px h-4 bg-slate-700/50" />
          <div className="flex-1 text-center group">
            <a href="https://quaternius.itch.io/animated-lowpoly-dinosaurs" target="_blank" rel="noopener noreferrer" className="hover:text-orange-400 transition-colors uppercase tracking-widest">
              Models by <span className="text-slate-400 group-hover:text-orange-300">Quaternius</span>
            </a>
          </div>
        </div>

        <div className="mt-4 text-center">
          <p className="text-[10px] text-slate-600 uppercase tracking-[0.2em]">v{APP_VERSION} Prototype</p>
        </div>
      </div>
    </div>
  );
};
