import React from 'react';
import { useAppStore, type Language } from '../../store/useAppStore';
import { LANGUAGES } from '../../i18n/translations';
import { useT } from '../../i18n/useT';
import { Play, Settings } from 'lucide-react';

const FlagSVG: React.FC<{ code: Language }> = ({ code }) => {
  if (code === 'en-US') {
    return (
      <svg className="w-5 h-5 rounded-sm shadow-sm" viewBox="0 0 30 20" xmlns="http://www.w3.org/2000/svg">
        <rect width="30" height="20" fill="#fff" />
        <rect width="30" height="2" y="0" fill="#b22234" />
        <rect width="30" height="2" y="3" fill="#b22234" />
        <rect width="30" height="2" y="6" fill="#b22234" />
        <rect width="30" height="2" y="9" fill="#b22234" />
        <rect width="30" height="2" y="12" fill="#b22234" />
        <rect width="30" height="2" y="15" fill="#b22234" />
        <rect width="30" height="2" y="18" fill="#b22234" />
        <rect width="12" height="10" fill="#3c3b6e" />
      </svg>
    );
  }
  return (
    <svg className="w-5 h-5 rounded-sm shadow-sm" viewBox="0 0 30 20" xmlns="http://www.w3.org/2000/svg">
      <rect width="30" height="20" fill="#009739" />
      <polygon points="15,3 17,9 23,9 18,13 20,19 15,15 10,19 12,13 7,9 13,9" fill="#ffd700" />
      <circle cx="15" cy="10" r="4" fill="#002776" />
    </svg>
  );
};

export const MainMenu: React.FC = () => {
  const { setScreen, language, setLanguage } = useAppStore();
  const t = useT();

  return (
    <div className="min-h-screen flex items-start sm:items-center justify-center bg-slate-900 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-slate-800 to-slate-950 p-4">
      <div className="max-w-md w-full p-4 sm:p-6 md:p-8 bg-slate-800/50 backdrop-blur-md rounded-2xl shadow-2xl border border-slate-700/50 transform transition-all">
        <div className="text-center mb-10">
          <h1 className="text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-red-500 mb-2 drop-shadow-lg">
            {t('menu.title')}
          </h1>
          <p className="text-slate-400 text-sm font-medium tracking-widest uppercase">{t('menu.subtitle')}</p>
        </div>

        <div className="space-y-4">
          <button
            onClick={() => setScreen('session-select')}
            className="group relative w-full flex items-center justify-center gap-3 bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-400 hover:to-red-500 text-white font-bold py-4 px-6 rounded-xl shadow-lg hover:shadow-orange-500/25 transition-all active:scale-95 overflow-hidden"
          >
            <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-out" />
            <Play className="w-5 h-5 fill-current relative z-10" />
            <span className="relative z-10">{t('menu.play')}</span>
          </button>

          <button
            onClick={() => setScreen('settings')}
            className="w-full flex items-center justify-center gap-3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold py-4 px-6 rounded-xl shadow-lg transition-all active:scale-95 border border-slate-700 hover:text-white"
          >
            <Settings className="w-5 h-5" />
            <span>{t('menu.settings')}</span>
          </button>
        </div>

        {/* Language Switcher */}
        <div className="mt-8 flex items-center justify-center gap-3">
          {LANGUAGES.map(lang => (
            <button
              key={lang.code}
              onClick={() => setLanguage(lang.code)}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-all text-xs font-bold ${
                language === lang.code
                  ? 'bg-orange-500/20 text-orange-400 border border-orange-500/40 shadow-sm shadow-orange-500/10'
                  : 'bg-slate-800/50 text-slate-500 border border-slate-700/30 hover:text-slate-300 hover:border-slate-600'
              }`}
            >
              <FlagSVG code={lang.code} />
              {lang.label}
            </button>
          ))}
        </div>

        {/* Footer de Créditos */}
        <div className="mt-8 flex justify-between items-center gap-4 text-[10px] text-slate-500 font-medium border-t border-slate-700/50 pt-6">
          <div className="flex-1 text-center group">
            <a href="https://antigravity.google/" target="_blank" rel="noopener noreferrer" className="hover:text-cyan-400 transition-colors uppercase tracking-widest">
              {t('menu.footer.madeWith')}
            </a>
          </div>
          <div className="w-px h-4 bg-slate-700/50" />
          <div className="flex-1 text-center">
            <span className="uppercase tracking-widest">{t('menu.footer.madeBy')}</span>
          </div>
          <div className="w-px h-4 bg-slate-700/50" />
          <div className="flex-1 text-center group">
            <a href="https://quaternius.itch.io/animated-lowpoly-dinosaurs" target="_blank" rel="noopener noreferrer" className="hover:text-orange-400 transition-colors uppercase tracking-widest">
              {t('menu.footer.models')}
            </a>
          </div>
        </div>

        <div className="mt-4 text-center">
          <p className="text-[10px] text-slate-600 uppercase tracking-[0.2em]">{t('menu.version', { version: APP_VERSION })}</p>
        </div>
      </div>
    </div>
  );
};
