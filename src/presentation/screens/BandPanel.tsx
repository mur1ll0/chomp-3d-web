import React, { useState } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { PeerMesh } from '../../infrastructure/network/PeerMesh';
import { Users, Copy, Check, Globe } from 'lucide-react';

export const BandPanel: React.FC = () => {
  const gameMode = useAppStore(s => s.gameMode);
  const sessionCode = useAppStore(s => s.sessionCode);
  const packCode = useAppStore(s => s.packCode);
  const playerName = useAppStore(s => s.playerName);
  const connectionStatus = useAppStore(s => s.connectionStatus);
  const globalPlayerCount = useAppStore(s => s.globalPlayerCount);
  const [expanded, setExpanded] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedPack, setCopiedPack] = useState(false);

  if (gameMode === 'single' || gameMode === null) return null;

  const connectedPeers = PeerMesh.getConnectedPeers();
  const totalPlayers = 1 + connectedPeers.length;

  const isGlobal = gameMode === 'global';
  const isParty = gameMode === 'party';

  const handleCopyCode = () => {
    const code = isParty ? sessionCode : '';
    if (code) {
      navigator.clipboard.writeText(code).then(() => {
        setCopiedCode(true);
        setTimeout(() => setCopiedCode(false), 2000);
      }).catch(() => {});
    }
  };

  const handleCopyPackCode = () => {
    if (packCode) {
      navigator.clipboard.writeText(packCode).then(() => {
        setCopiedPack(true);
        setTimeout(() => setCopiedPack(false), 2000);
      }).catch(() => {});
    }
  };

  return (
    <div className="absolute bottom-4 right-4 z-30 pointer-events-auto">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 bg-slate-900/80 hover:bg-slate-800 backdrop-blur border border-slate-700 rounded-lg px-3 py-2 text-white text-sm transition-all"
      >
        {isGlobal ? <Globe className="w-4 h-4 text-blue-400" /> : <Users className="w-4 h-4 text-orange-400" />}
        <span className="font-bold">{isGlobal ? globalPlayerCount : totalPlayers}</span>
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
            <h3 className="text-white font-bold text-sm">
              {isGlobal ? '🌍 Global' : '🦕 Party'}
            </h3>
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

          {/* Party Code */}
          {isParty && sessionCode && (
            <div className="bg-slate-800/80 border border-orange-500/30 rounded-lg p-3 text-center">
              <div className="text-[10px] text-slate-400 uppercase tracking-wider mb-1">Código do Party</div>
              <div className="text-2xl font-black text-orange-400 tracking-[0.3em]">{sessionCode}</div>
              <button
                onClick={handleCopyCode}
                className="mt-2 flex items-center justify-center gap-1 w-full bg-slate-700 hover:bg-slate-600 rounded-md py-1.5 text-xs text-white transition-all"
              >
                {copiedCode ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
                {copiedCode ? 'Copiado!' : 'Copiar Código'}
              </button>
            </div>
          )}

          {/* Global Info */}
          {isGlobal && (
            <div className="bg-slate-800/80 border border-blue-500/30 rounded-lg p-3 text-center">
              <div className="text-[10px] text-slate-400 uppercase tracking-wider mb-1">Mundo Global</div>
              <div className="text-lg font-bold text-blue-400">{globalPlayerCount} jogadores online</div>
            </div>
          )}

          {/* Pack Code */}
          {packCode && (
            <div className="bg-slate-800/80 border border-green-500/30 rounded-lg p-3 text-center">
              <div className="text-[10px] text-slate-400 uppercase tracking-wider mb-1">Código do Pack</div>
              <div className="text-lg font-bold text-green-400 tracking-[0.2em]">{packCode}</div>
              <button
                onClick={handleCopyPackCode}
                className="mt-2 flex items-center justify-center gap-1 w-full bg-slate-700 hover:bg-slate-600 rounded-md py-1.5 text-xs text-white transition-all"
              >
                {copiedPack ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
                {copiedPack ? 'Copiado!' : 'Copiar Código do Pack'}
              </button>
            </div>
          )}

          {/* Player List */}
          <div className="space-y-1">
            <div className="text-[10px] text-slate-500 uppercase tracking-wider">
              {isGlobal ? 'Peers Conectados' : `Membros (${totalPlayers})`}
            </div>
            <div className="flex items-center gap-2 bg-orange-500/10 border border-orange-500/20 rounded-md px-3 py-1.5">
              <span className="w-2 h-2 rounded-full bg-green-500" />
              <span className="text-white text-sm font-medium">{playerName}</span>
              <span className="text-[10px] text-slate-500 ml-auto">(Você)</span>
            </div>
            {connectedPeers.map((p) => (
              <div key={p.peerId} className="flex items-center gap-2 bg-slate-800/50 rounded-md px-3 py-1.5">
                <span className="w-2 h-2 rounded-full bg-green-500" />
                <span className="text-white text-sm">{p.playerName}</span>
              </div>
            ))}
            {connectedPeers.length === 0 && (
              <div className="text-xs text-slate-500 text-center py-2">
                {isGlobal ? 'Buscando jogadores...' : 'Aguardando jogadores...'}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
