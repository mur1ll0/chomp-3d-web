import React, { useState } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { useT } from '../../i18n/useT';
import { ArrowLeft, Globe, Users, Play } from 'lucide-react';

export const SessionSelectScreen: React.FC = () => {
  const t = useT();
  const { setScreen, setGameMode, setSessionCode } = useAppStore();
  const [partyMode, setPartyMode] = useState<'choose' | 'join'>('choose');
  const [joinCode, setJoinCode] = useState('');

  const handleGlobal = () => {
    setGameMode('global');
    setSessionCode('');
    setScreen('character-select');
  };

  const handlePartyHost = () => {
    setGameMode('party');
    setSessionCode('');
    setScreen('character-select');
  };

  const handlePartyJoin = () => {
    if (joinCode.trim().length < 4) return;
    setGameMode('party');
    setSessionCode(joinCode.trim().toUpperCase());
    setScreen('character-select');
  };

  const handleSingle = () => {
    setGameMode('single');
    setSessionCode('');
    setScreen('character-select');
  };

  if (partyMode === 'join') {
    return (
      <div className="min-h-screen flex items-start sm:items-center justify-center bg-slate-900 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-slate-800 to-slate-950 p-4">
        <div className="max-w-md w-full p-4 sm:p-6 md:p-8 bg-slate-800/50 backdrop-blur-md rounded-2xl shadow-2xl border border-slate-700/50">
          <div className="flex items-center gap-4 mb-8">
            <button onClick={() => setPartyMode('choose')} className="p-2 hover:bg-slate-700 rounded-full transition-colors">
              <ArrowLeft className="w-6 h-6 text-slate-300" />
            </button>
            <h2 className="text-2xl font-bold text-white">{t('session.join.title')}</h2>
          </div>

          <div className="space-y-4 mb-6">
            <label className="block text-sm font-medium text-slate-400">{t('session.join.code')}</label>
            <input
              type="text"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase().slice(0, 4))}
              placeholder={t('session.join.placeholder')}
              className="w-full bg-slate-700/50 border border-slate-600 rounded-lg p-3 text-white text-center text-2xl font-bold tracking-[0.5em] focus:outline-none focus:border-orange-500 transition-colors uppercase"
              maxLength={4}
            />
            <p className="text-xs text-slate-500 text-center">{t('session.join.instruction')}</p>
          </div>

          <button
            onClick={handlePartyJoin}
            disabled={joinCode.trim().length < 4}
            className="w-full flex items-center justify-center gap-3 bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-400 hover:to-red-500 disabled:from-slate-700 disabled:to-slate-700 disabled:text-slate-500 text-white font-bold py-4 px-6 rounded-xl shadow-lg transition-all active:scale-95"
          >
            <Play className="w-5 h-5 fill-current" />
            <span>{t('session.join.button')}</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-start sm:items-center justify-center bg-slate-900 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-slate-800 to-slate-950 p-4">
      <div className="max-w-2xl w-full">
        <div className="flex items-center gap-4 mb-6">
          <button onClick={() => { setGameMode(null); setScreen('menu'); }} className="p-2 hover:bg-slate-700 rounded-full transition-colors">
            <ArrowLeft className="w-6 h-6 text-slate-300" />
          </button>
          <h2 className="text-3xl font-bold text-white">{t('session.title')}</h2>
        </div>

        <div className="space-y-4">
          {/* Global Card */}
          <div className="bg-slate-800/50 backdrop-blur rounded-2xl border border-slate-700/50 p-6 hover:border-orange-500/50 transition-all">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-blue-500/10 rounded-xl">
                <Globe className="w-8 h-8 text-blue-400" />
              </div>
              <div className="flex-1">
                <h3 className="text-xl font-bold text-white mb-1">{t('session.global.title')}</h3>
                <p className="text-sm text-slate-400 mb-4">
                  {t('session.global.desc')}
                </p>
                <div className="flex items-center gap-2 mb-4">
                  <span className="w-2 h-2 rounded-full bg-green-500" />
                  <span className="text-xs text-green-400">{t('session.global.alwaysAvailable')}</span>
                </div>
                <button
                  onClick={handleGlobal}
                  className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-blue-500 to-cyan-600 hover:from-blue-400 hover:to-cyan-500 text-white font-bold py-3 px-6 rounded-xl transition-all active:scale-95"
                >
                  <Globe className="w-4 h-4" />
                  <span>{t('session.global.enter')}</span>
                </button>
              </div>
            </div>
          </div>

          {/* Party Card */}
          <div className="bg-slate-800/50 backdrop-blur rounded-2xl border border-slate-700/50 p-6 hover:border-orange-500/50 transition-all">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-orange-500/10 rounded-xl">
                <Users className="w-8 h-8 text-orange-400" />
              </div>
              <div className="flex-1">
                <h3 className="text-xl font-bold text-white mb-1">{t('session.party.title')}</h3>
                <p className="text-sm text-slate-400 mb-4">
                  {t('session.party.desc')}
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={handlePartyHost}
                    className="flex-1 flex items-center justify-center gap-2 bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-400 hover:to-red-500 text-white font-bold py-3 px-6 rounded-xl transition-all active:scale-95"
                  >
                    <Users className="w-4 h-4" />
                    <span>{t('session.party.create')}</span>
                  </button>
                  <button
                    onClick={() => setPartyMode('join')}
                    className="flex-1 flex items-center justify-center gap-2 bg-slate-700 hover:bg-slate-600 text-white font-bold py-3 px-6 rounded-xl transition-all active:scale-95 border border-slate-600"
                  >
                    <Play className="w-4 h-4" />
                    <span>{t('session.party.enterCode')}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

        </div>

        {/* Offline */}
        <div className="mt-6">
          <button
            onClick={handleSingle}
            className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-green-600 to-emerald-700 hover:from-green-500 hover:to-emerald-600 text-white font-bold py-3 px-6 rounded-xl transition-all active:scale-95"
          >
            <Play className="w-4 h-4" />
            <span>{t('session.offline')}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
