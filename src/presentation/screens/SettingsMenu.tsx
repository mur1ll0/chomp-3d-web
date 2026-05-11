import React, { useState } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { ArrowLeft, Monitor, Keyboard, X } from 'lucide-react';

export const SettingsMenu: React.FC<{ inGame?: boolean }> = ({ inGame }) => {
  const { setScreen, toggleSettingsInGame, renderDistance, setRenderDistance } = useAppStore();
  const [activeTab, setActiveTab] = useState<'controls' | 'graphics'>('controls');

  const handleClose = () => {
    if (inGame) toggleSettingsInGame();
    else setScreen('menu');
  };

  return (
    <div className={`flex items-center justify-center min-h-screen ${inGame ? 'bg-transparent' : 'bg-slate-900 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-slate-800 to-slate-950'} text-slate-200 w-full`}>
      <div className="max-w-2xl w-full p-8 bg-slate-800/90 backdrop-blur-md rounded-2xl shadow-2xl border border-slate-700/50 flex flex-col h-[600px]">
        
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
            <h2 className="text-3xl font-bold text-white">Configurações</h2>
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
            Controles
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
            Gráficos
          </button>
        </div>

        <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
          {activeTab === 'controls' && (
            <div className="space-y-4">
              {[
                { action: 'Mover para Frente', key: 'W' },
                { action: 'Mover para Trás', key: 'S' },
                { action: 'Virar à Esquerda', key: 'A' },
                { action: 'Virar à Direita', key: 'D' },
                { action: 'Atacar / Morder', key: 'Botão Esquerdo Mouse' },
                { action: 'Correr (Sprint)', key: 'Shift' },
              ].map((item, i) => (
                <div key={i} className="flex justify-between items-center p-4 bg-slate-700/30 rounded-xl border border-slate-700/50">
                  <span className="font-medium">{item.action}</span>
                  <kbd className="px-3 py-1.5 bg-slate-800 border border-slate-600 rounded-md shadow-sm text-sm font-mono text-orange-400">
                    {item.key}
                  </kbd>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'graphics' && (
            <div className="space-y-6">
              <div className="space-y-2">
                <label className="block text-sm font-medium text-slate-400">Qualidade Geral</label>
                <select className="w-full bg-slate-700/50 border border-slate-600 rounded-lg p-3 text-white focus:outline-none focus:border-orange-500 transition-colors">
                  <option>Baixa</option>
                  <option>Média</option>
                  <option>Alta</option>
                  <option>Ultra</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="block text-sm font-medium text-slate-400">Distância de Renderização (Chunks: {renderDistance})</label>
                <input 
                  type="range" min="1" max="6" 
                  value={renderDistance} 
                  onChange={(e) => setRenderDistance(parseInt(e.target.value))} 
                  className="w-full accent-orange-500" 
                />
                <div className="flex justify-between text-xs text-slate-500">
                  <span>Perto (Mais FPS)</span>
                  <span>Longe</span>
                </div>
              </div>
              <div className="flex items-center justify-between p-4 bg-slate-700/30 rounded-xl border border-slate-700/50">
                <span>Sombras Dinâmicas</span>
                <input type="checkbox" className="w-5 h-5 accent-orange-500 rounded bg-slate-800 border-slate-600" defaultChecked />
              </div>

            </div>
          )}
        </div>
        
      </div>
    </div>
  );
};
