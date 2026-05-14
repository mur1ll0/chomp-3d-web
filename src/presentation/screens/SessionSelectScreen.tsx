import React, { useState } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { ArrowLeft, Play, Users, Key } from 'lucide-react';

export const SessionSelectScreen: React.FC = () => {
  const { setScreen, setGameMode, setOnlineRole, setSessionCode } = useAppStore();
  const [mode, setMode] = useState<'choose' | 'join'>('choose');
  const [joinCode, setJoinCode] = useState('');

  const handleHost = () => {
    setOnlineRole('host');
    setGameMode('online');
    setSessionCode('');
    setScreen('character-select');
  };

  const handleJoin = () => {
    if (joinCode.trim().length < 4) return;
    setOnlineRole('client');
    setGameMode('online');
    setSessionCode(joinCode.trim().toUpperCase());
    setScreen('character-select');
  };

  if (mode === 'choose') {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-900 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-slate-800 to-slate-950">
        <div className="max-w-md w-full p-8 bg-slate-800/50 backdrop-blur-md rounded-2xl shadow-2xl border border-slate-700/50">
          <div className="flex items-center gap-4 mb-8">
            <button onClick={() => { setGameMode(null); setScreen('menu'); }} className="p-2 hover:bg-slate-700 rounded-full transition-colors">
              <ArrowLeft className="w-6 h-6 text-slate-300" />
            </button>
            <h2 className="text-2xl font-bold text-white">Jogar Online</h2>
          </div>

          <p className="text-sm text-slate-400 mb-6 text-center">
            Crie uma sala para ser o anfitrião ou entre em uma sala existente
          </p>

          <div className="space-y-3">
            <button
              onClick={handleHost}
              className="w-full flex items-center justify-center gap-3 bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-400 hover:to-red-500 text-white font-bold py-4 px-6 rounded-xl shadow-lg transition-all active:scale-95"
            >
              <Users className="w-5 h-5" />
              <span>Criar Sala (Host)</span>
            </button>
            <button
              onClick={() => setMode('join')}
              className="w-full flex items-center justify-center gap-3 bg-slate-700 hover:bg-slate-600 text-white font-bold py-4 px-6 rounded-xl shadow-lg transition-all active:scale-95 border border-slate-600"
            >
              <Key className="w-5 h-5" />
              <span>Entrar em Sala</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-slate-900 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-slate-800 to-slate-950">
      <div className="max-w-md w-full p-8 bg-slate-800/50 backdrop-blur-md rounded-2xl shadow-2xl border border-slate-700/50">
        <div className="flex items-center gap-4 mb-8">
          <button onClick={() => setMode('choose')} className="p-2 hover:bg-slate-700 rounded-full transition-colors">
            <ArrowLeft className="w-6 h-6 text-slate-300" />
          </button>
          <h2 className="text-2xl font-bold text-white">Entrar em Sala</h2>
        </div>

        <div className="space-y-4 mb-6">
          <label className="block text-sm font-medium text-slate-400">Código da Sala</label>
          <input
            type="text"
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value.toUpperCase().slice(0, 4))}
            placeholder="Ex: ABCD"
            className="w-full bg-slate-700/50 border border-slate-600 rounded-lg p-3 text-white text-center text-2xl font-bold tracking-[0.5em] focus:outline-none focus:border-orange-500 transition-colors uppercase"
            maxLength={4}
          />
          <p className="text-xs text-slate-500 text-center">Peça o código de 4 caracteres para o anfitrião</p>
        </div>

        <button
          onClick={handleJoin}
          disabled={joinCode.trim().length < 4}
          className="w-full flex items-center justify-center gap-3 bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-400 hover:to-red-500 disabled:from-slate-700 disabled:to-slate-700 disabled:text-slate-500 text-white font-bold py-4 px-6 rounded-xl shadow-lg transition-all active:scale-95"
        >
          <Play className="w-5 h-5 fill-current" />
          <span>Conectar</span>
        </button>
      </div>
    </div>
  );
};
