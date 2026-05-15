import React, { useState } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { useT } from '../../i18n/useT';
import { ArrowLeft, Monitor, Keyboard, X } from 'lucide-react';

export const SettingsMenu: React.FC<{ inGame?: boolean }> = ({ inGame }) => {
  const {
    setScreen,
    toggleSettingsInGame,
    renderDistance,
    setRenderDistance,
    controlBindings,
    setControlBinding,
  } = useAppStore();
  const t = useT();
  const [activeTab, setActiveTab] = useState<'controls' | 'graphics'>('controls');
  const [rebindingAction, setRebindingAction] = useState<null | keyof typeof controlBindings>(null);
  const panelRef = React.useRef<HTMLDivElement>(null);

  const formatKeyLabel = (keyCode: string): string => {
    if (keyCode === 'MouseLeft') return t('key.mouseLeft');
    if (keyCode === 'MouseRight') return t('key.mouseRight');
    if (keyCode === 'MouseMiddle') return t('key.mouseMiddle');
    if (keyCode.startsWith('Shift')) return 'Shift';
    if (keyCode.startsWith('Control')) return 'Ctrl';
    if (keyCode.startsWith('Key')) return keyCode.replace('Key', '').toUpperCase();
    return keyCode;
  };

  const controlsList: Array<{ action: keyof typeof controlBindings; label: string }> = [
    { action: 'moveForward', label: t('settings.controls.moveForward') },
    { action: 'moveBackward', label: t('settings.controls.moveBackward') },
    { action: 'moveLeft', label: t('settings.controls.moveLeft') },
    { action: 'moveRight', label: t('settings.controls.moveRight') },
    { action: 'attack', label: t('settings.controls.attack') },
    { action: 'eat', label: t('settings.controls.eat') },
    { action: 'sprint', label: t('settings.controls.sprint') },
    { action: 'jump', label: t('settings.controls.jump') },
  ];

  React.useEffect(() => {
    if (!rebindingAction) return;

    const onKeyDown = (e: KeyboardEvent) => {
      e.preventDefault();
      if (e.code === 'Escape') {
        setRebindingAction(null);
        return;
      }
      setControlBinding(rebindingAction, e.code);
      setRebindingAction(null);
    };

    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [rebindingAction, setControlBinding]);

  const mapMouseButtonToBind = (button: number): string | null => {
    if (button === 0) return 'MouseLeft';
    if (button === 1) return 'MouseMiddle';
    if (button === 2) return 'MouseRight';
    return null;
  };

  const handleClose = () => {
    if (inGame) toggleSettingsInGame();
    else setScreen('menu');
  };

  return (
    <div
      className={`flex items-center justify-center min-h-screen ${inGame ? 'bg-transparent' : 'bg-slate-900 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-slate-800 to-slate-950'} text-slate-200 w-full`}
      onMouseDown={(e) => {
        if (!rebindingAction) return;
        const target = e.target as Node;
        if (panelRef.current && !panelRef.current.contains(target)) {
          setRebindingAction(null);
        }
      }}
    >
      <div ref={panelRef} className="max-w-2xl w-full p-8 bg-slate-800/90 backdrop-blur-md rounded-2xl shadow-2xl border border-slate-700/50 flex flex-col h-[600px]">
        
        <div className="flex items-center justify-between mb-8 border-b border-slate-700 pb-4">
          <div className="flex items-center">
            {!inGame && (
              <button 
                onClick={handleClose}
                className="p-2 hover:bg-slate-700 rounded-full transition-colors mr-4"
              >
                <ArrowLeft className="w-6 h-6 text-slate-300" />
              </button>
            )}
            <h2 className="text-3xl font-bold text-white">{t('settings.title')}</h2>
          </div>
          
          {inGame && (
            <button onClick={handleClose} className="p-2 hover:bg-red-500/20 text-red-400 rounded-full transition-colors">
              <X className="w-6 h-6" />
            </button>
          )}
        </div>

        <div className="flex gap-4 mb-6">
          <button
            onClick={() => setActiveTab('controls')}
            className={`flex items-center gap-2 px-6 py-3 rounded-lg font-medium transition-all ${
              activeTab === 'controls' 
                ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/20' 
                : 'bg-slate-700/50 hover:bg-slate-700 text-slate-300'
            }`}
          >
            <Keyboard className="w-4 h-4" />
            {t('settings.tab.controls')}
          </button>
          <button
            onClick={() => setActiveTab('graphics')}
            className={`flex items-center gap-2 px-6 py-3 rounded-lg font-medium transition-all ${
              activeTab === 'graphics' 
                ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/20' 
                : 'bg-slate-700/50 hover:bg-slate-700 text-slate-300'
            }`}
          >
            <Monitor className="w-4 h-4" />
            {t('settings.tab.graphics')}
          </button>
        </div>

        <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
          {activeTab === 'controls' && (
            <div className="space-y-4">
              {controlsList.map((item) => (
                <button
                  key={item.action}
                  onMouseDown={(e) => {
                    if (rebindingAction === item.action && item.action === 'attack') {
                      const mouseBind = mapMouseButtonToBind(e.button);
                      if (!mouseBind) return;
                      e.preventDefault();
                      e.stopPropagation();
                      setControlBinding('attack', mouseBind);
                      setRebindingAction(null);
                    }
                  }}
                  onClick={() => {
                    if (rebindingAction !== null) return;
                    setRebindingAction(item.action);
                  }}
                  className={`w-full flex justify-between items-center p-4 rounded-xl border transition-all text-left ${
                    rebindingAction === item.action
                      ? 'bg-orange-500/20 border-orange-500/60'
                      : 'bg-slate-700/30 border-slate-700/50 hover:bg-slate-700/50'
                  }`}
                >
                  <span className="font-medium">{item.label}</span>
                  <kbd className="px-3 py-1.5 bg-slate-800 border border-slate-600 rounded-md shadow-sm text-sm font-mono text-orange-400">
                    {rebindingAction === item.action
                      ? item.action === 'attack'
                        ? t('settings.controls.keyMouse')
                        : t('settings.controls.keyOnly')
                      : formatKeyLabel(controlBindings[item.action])}
                  </kbd>
                </button>
              ))}
            </div>
          )}

          {activeTab === 'graphics' && (
            <div className="space-y-6">
              <div className="space-y-2">
                <label className="block text-sm font-medium text-slate-400">{t('settings.graphics.quality')}</label>
                <select className="w-full bg-slate-700/50 border border-slate-600 rounded-lg p-3 text-white focus:outline-none focus:border-orange-500 transition-colors">
                  <option>{t('quality.low')}</option>
                  <option>{t('quality.medium')}</option>
                  <option>{t('quality.high')}</option>
                  <option>{t('quality.ultra')}</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="block text-sm font-medium text-slate-400">{t('settings.graphics.renderDistance', { n: renderDistance })}</label>
                <input 
                  type="range" min="1" max="6" 
                  value={renderDistance} 
                  onChange={(e) => setRenderDistance(parseInt(e.target.value))} 
                  className="w-full accent-orange-500" 
                />
                <div className="flex justify-between text-xs text-slate-500">
                  <span>{t('settings.graphics.near')}</span>
                  <span>{t('settings.graphics.far')}</span>
                </div>
              </div>
              <div className="flex items-center justify-between p-4 bg-slate-700/30 rounded-xl border border-slate-700/50">
                <span>{t('settings.graphics.dynamicShadows')}</span>
                <input type="checkbox" className="w-5 h-5 accent-orange-500 rounded bg-slate-800 border-slate-600" defaultChecked />
              </div>

            </div>
          )}
        </div>
        
      </div>
    </div>
  );
};
