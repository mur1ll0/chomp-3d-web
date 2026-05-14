import React, { useState } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { peerSession } from '../../infrastructure/network/PeerSession';
import { Users, Copy, Check } from 'lucide-react';

export const BandPanel: React.FC = () => {
  const onlineRole = useAppStore(s => s.onlineRole);
  const sessionCode = useAppStore(s => s.sessionCode);
  const playerName = useAppStore(s => s.playerName);
  const connectionStatus = useAppStore(s => s.connectionStatus);
  const networkPlayers = useAppStore(s => s.networkPlayers) as { name: string }[];
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  if (onlineRole !== 'host' && onlineRole !== 'client') return null;

  // Get remote player names
  const remoteNames = onlineRole === 'host'
    ? peerSession.getHostClients().map(c => c.playerName).filter(n => n)
    : networkPlayers.map(p => p.name).filter(n => n && n !== playerName);

  const totalPlayers = 1 + remoteNames.length;

  const handleCopyCode = () => {
    if (sessionCode) {
      navigator.clipboard.writeText(sessionCode).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }).catch(() => {});
    }
  };

  return (
    <div className="absolute bottom-4 right-4 z-30 pointer-events-auto">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 bg-slate-900/80 hover:bg-slate-800 backdrop-blur border border-slate-700 rounded-lg px-3 py-2 text-white text-sm transition-all"
      >
        <Users className="w-4 h-4 text-orange-400" />
        <span className="font-bold">{totalPlayers}</span>
        {connectionStatus === 'connecting' && (
          <span className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse" />
        )}
        {connectionStatus === 'connected' && (
          <span className="w-2 h-2 rounded-full bg-green-500" />
        )}
      </button>

      {expanded && (
        <div className="absolute bottom-12 right-0 bg-slate-900/95 backdrop-blur border border-slate-700 rounded-xl p-4 w-72 shadow-2xl flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h3 className="text-white font-bold text-sm">Bando</h3>
            <button onClick={() => setExpanded(false)} className="text-slate-500 hover:text-white text-xs">
              Fechar
            </button>
          </div>

          {/* Connection Status */}
          <div className="text-[10px] text-slate-500 flex items-center gap-2">
            <span className={`w-1.5 h-1.5 rounded-full ${
              connectionStatus === 'connected' ? 'bg-green-500' :
              connectionStatus === 'connecting' ? 'bg-yellow-400' : 'bg-red-500'
            }`} />
            {connectionStatus === 'connected' ? 'Conectado' :
             connectionStatus === 'connecting' ? 'Conectando...' : 'Desconectado'}
          </div>

          {/* Código da Sala (host only) */}
          {onlineRole === 'host' && (
            <div className="bg-slate-800/80 border border-orange-500/30 rounded-lg p-3 text-center">
              <div className="text-[10px] text-slate-400 uppercase tracking-wider mb-1">Código do Bando</div>
              <div className="text-2xl font-black text-orange-400 tracking-[0.3em]">{sessionCode}</div>
              <button
                onClick={handleCopyCode}
                className="mt-2 flex items-center justify-center gap-1 w-full bg-slate-700 hover:bg-slate-600 rounded-md py-1.5 text-xs text-white transition-all"
              >
                {copied ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
                {copied ? 'Copiado!' : 'Copiar Código'}
              </button>
            </div>
          )}

          {/* Player List */}
          <div className="space-y-1">
            <div className="text-[10px] text-slate-500 uppercase tracking-wider">Membros ({totalPlayers})</div>
            <div className="flex items-center gap-2 bg-orange-500/10 border border-orange-500/20 rounded-md px-3 py-1.5">
              <span className="w-2 h-2 rounded-full bg-green-500" />
              <span className="text-white text-sm font-medium">{playerName}</span>
              <span className="text-[10px] text-slate-500 ml-auto">(Você)</span>
            </div>
            {remoteNames.map((name, i) => (
              <div key={i} className="flex items-center gap-2 bg-slate-800/50 rounded-md px-3 py-1.5">
                <span className="w-2 h-2 rounded-full bg-green-500" />
                <span className="text-white text-sm">{name}</span>
              </div>
            ))}
          </div>

          {onlineRole === 'client' && (
            <div className="text-[10px] text-slate-500 text-center border-t border-slate-700 pt-2">
              Conectado ao bando {sessionCode}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
