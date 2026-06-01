import React, { useState } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { useT } from '../../i18n/useT';
import { PeerMesh } from '../../infrastructure/network/PeerMesh';
import { Users, Copy, Check, Globe, UserPlus, UserMinus, LogOut, Shield } from 'lucide-react';

function stop(e: React.PointerEvent | React.MouseEvent): void {
  e.stopPropagation();
}

function stopAndRelease(e: React.PointerEvent | React.MouseEvent): void {
  e.stopPropagation();
  if (document.pointerLockElement) {
    document.exitPointerLock();
  }
}

export const NetworkPanel: React.FC = () => {
  const t = useT();
  const gameMode = useAppStore(s => s.gameMode);
  const packCode = useAppStore(s => s.packCode);
  const playerName = useAppStore(s => s.playerName);
  const connectionStatus = useAppStore(s => s.connectionStatus);
  const packRole = useAppStore(s => s.packRole);
  const packMembers = useAppStore(s => s.packMembers);

  const [expanded, setExpanded] = useState(false);
  const [copiedPack, setCopiedPack] = useState(false);

  if (gameMode === 'single' || gameMode === null) return null;

  const connectedPeers = PeerMesh.getConnectedPeers();
  const totalPlayers = 1 + connectedPeers.length;

  const isGlobal = gameMode === 'global';
  const isLeader = packRole === 'leading';
  const hasPack = packRole !== 'solo';

  const otherPeers = connectedPeers.filter(
    p => !packMembers.find(m => m.peerId === p.peerId)
  );

  const handleCopyPackCode = () => {
    if (packCode) {
      navigator.clipboard.writeText(packCode).then(() => {
        setCopiedPack(true);
        setTimeout(() => setCopiedPack(false), 2000);
      }).catch(() => {});
    }
  };

  return (
    <div className="absolute bottom-4 right-4 z-30" onPointerDown={stop} onMouseDown={stop} onClick={stop}>
      {/* Toggle button */}
      <button
        onClick={(e) => { stopAndRelease(e); setExpanded(!expanded); }}
        onPointerDown={stop}
        onMouseDown={stop}
        className="pointer-events-auto flex items-center gap-2 bg-slate-900/80 hover:bg-slate-800 backdrop-blur border border-slate-700 rounded-lg px-3 py-2 text-white text-sm transition-all"
      >
        {isGlobal ? <Globe className="w-4 h-4 text-blue-400" /> : <Users className="w-4 h-4 text-orange-400" />}
        <span className="font-bold">{totalPlayers}</span>
        {connectionStatus === 'connecting' && (
          <span className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse" />
        )}
        {connectionStatus === 'connected' && (
          <span className="w-2 h-2 rounded-full bg-green-500" />
        )}
        {hasPack && <Shield className="w-3 h-3 text-amber-400" />}
      </button>

      {expanded && (
        <div className="absolute bottom-12 right-0 bg-slate-900/95 backdrop-blur border border-slate-700 rounded-xl p-4 w-72 shadow-2xl flex flex-col gap-3 pointer-events-auto">
          {/* Header */}
          <div className="flex items-center justify-between">
            <h3 className="text-white font-bold text-sm flex items-center gap-2">
              {isGlobal ? <Globe className="w-4 h-4 text-blue-400" /> : <Users className="w-4 h-4 text-orange-400" />}
              {isGlobal ? t('network.global') : t('network.party')}
              {hasPack && <Shield className="w-3 h-3 text-amber-400 ml-1" />}
            </h3>
            <button
              onClick={(e) => { stopAndRelease(e); setExpanded(false); }}
              onPointerDown={stop}
              onMouseDown={stop}
              className="text-slate-500 hover:text-white text-xs"
            >
              {t('network.close')}
            </button>
          </div>

          {/* Connection Status */}
          <div className="text-[10px] text-slate-500 flex items-center gap-2">
            <span className={`w-1.5 h-1.5 rounded-full ${
              connectionStatus === 'connected' ? 'bg-green-500' :
              connectionStatus === 'connecting' ? 'bg-yellow-400' : 'bg-red-500'
            }`} />
            {connectionStatus === 'connected' ? t('network.connected') :
             connectionStatus === 'connecting' ? t('network.connecting') : t('network.disconnected')}
          </div>

          {/* Pack Code */}
          {packCode && (
            <div className="bg-slate-800/80 border border-green-500/30 rounded-lg p-3 text-center">
              <div className="text-[10px] text-slate-400 uppercase tracking-wider mb-1">{t('network.packCode')}</div>
              <div className="text-lg font-bold text-green-400 tracking-[0.2em]">{packCode}</div>
              <button
                onClick={(e) => { stopAndRelease(e); handleCopyPackCode(); }}
                onPointerDown={stop}
                onMouseDown={stop}
                className="mt-2 flex items-center justify-center gap-1 w-full bg-slate-700 hover:bg-slate-600 rounded-md py-1.5 text-xs text-white transition-all"
              >
                {copiedPack ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
                {copiedPack ? t('network.copied') : t('network.copyPackCode')}
              </button>
            </div>
          )}

          {/* My Pack Section */}
          {hasPack && (
            <div className="border-t border-slate-700 pt-2">
              <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-1 flex items-center gap-1">
                <Shield className="w-3 h-3 text-amber-400" />
                {t('network.myPack')}
                <span className="text-amber-400 font-bold">({packMembers.length})</span>
              </div>

              {packRole === 'member' && (
                <div className="text-[10px] text-slate-500 mb-1">
                  {t('network.leader', { name: packMembers.find(m => m.peerId !== PeerMesh.getOwnPeerId())?.playerName ?? '---' })}
                </div>
              )}

              <div className="space-y-1 max-h-36 overflow-y-auto custom-scrollbar">
                {packMembers.map(m => {
                  const isMe = m.peerId === PeerMesh.getOwnPeerId();
                  return (
                    <div key={m.peerId} className="flex items-center gap-2 bg-slate-800/50 rounded-md px-3 py-1.5">
                      <span className={`w-2 h-2 rounded-full ${isLeader && m.peerId === PeerMesh.getOwnPeerId() ? 'bg-amber-500' : 'bg-green-500'}`} />
                      <span className="text-white text-sm flex-1">{m.playerName}</span>
                      <span className="text-[10px] text-slate-500">{m.dinoId}</span>
                      {isMe && <span className="text-[10px] text-slate-500">{t('network.you')}</span>}
                      {isLeader && !isMe && (
                        <button
                          onClick={(e) => { stopAndRelease(e); PeerMesh.kickFromPack(m.peerId); }}
                          onPointerDown={stop}
                          onMouseDown={stop}
                          className="p-1 hover:bg-red-500/20 rounded transition-colors"
                          title={t('network.kick')}
                        >
                          <UserMinus className="w-3 h-3 text-red-400" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>

              {isLeader && otherPeers.length > 0 && (
                <div className="mt-2 pt-2 border-t border-slate-700/50">
                  <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">{t('network.invitePlayers')}</div>
                  <div className="space-y-1 max-h-28 overflow-y-auto custom-scrollbar">
                    {otherPeers.map(p => (
                      <div key={p.peerId} className="flex items-center gap-2 bg-slate-800/30 rounded-md px-3 py-1.5">
                        <span className="text-white text-sm flex-1">{p.playerName}</span>
                        <button
                          onClick={(e) => { stopAndRelease(e); PeerMesh.inviteToPack(p.peerId); }}
                          onPointerDown={stop}
                          onMouseDown={stop}
                          className="p-1 hover:bg-amber-500/20 rounded transition-colors"
                          title={t('network.invite')}
                        >
                          <UserPlus className="w-3 h-3 text-amber-400" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {isLeader && (
                <button
                  onClick={(e) => { stopAndRelease(e); PeerMesh.leavePack(); }}
                  onPointerDown={stop}
                  onMouseDown={stop}
                  className="mt-2 w-full flex items-center justify-center gap-2 bg-red-600/20 hover:bg-red-600/40 border border-red-500/30 rounded-md py-2 text-red-400 text-xs font-bold transition-all"
                >
                  <LogOut className="w-3 h-3" />
                  {t('network.dissolvePack')}
                </button>
              )}
              {packRole === 'member' && (
                <button
                  onClick={(e) => { stopAndRelease(e); PeerMesh.leavePack(); }}
                  onPointerDown={stop}
                  onMouseDown={stop}
                  className="mt-2 w-full flex items-center justify-center gap-2 bg-red-600/20 hover:bg-red-600/40 border border-red-500/30 rounded-md py-2 text-red-400 text-xs font-bold transition-all"
                >
                  <LogOut className="w-3 h-3" />
                  {t('network.leavePack')}
                </button>
              )}
            </div>
          )}

          {/* Create Pack Button — shown when no pack */}
          {!hasPack && (
            <div className="border-t border-slate-700 pt-2">
              <button
                onClick={(e) => { stopAndRelease(e); PeerMesh.createPack(); }}
                onPointerDown={stop}
                onMouseDown={stop}
                className="w-full flex items-center justify-center gap-2 bg-amber-600/20 hover:bg-amber-600/40 border border-amber-500/30 rounded-md py-2 text-amber-400 text-xs font-bold transition-all"
              >
                <Shield className="w-3 h-3" />
                {t('network.createPack')}
              </button>
            </div>
          )}

          {/* Player List */}
          <div className="border-t border-slate-700 pt-2">
            <div className="text-[10px] text-slate-500 uppercase tracking-wider">
              {t('network.connectedPlayers', { n: totalPlayers })}
            </div>
            <div className="space-y-1 mt-1 max-h-24 overflow-y-auto custom-scrollbar">
              <div className="flex items-center gap-2 bg-orange-500/10 border border-orange-500/20 rounded-md px-3 py-1.5">
                <span className="w-2 h-2 rounded-full bg-green-500" />
                <span className="text-white text-sm font-medium">{playerName}</span>
                <span className="text-[10px] text-slate-500 ml-auto">{t('network.you')}</span>
              </div>
              {connectedPeers.map((p) => (
                <div key={p.peerId} className="flex items-center gap-2 bg-slate-800/50 rounded-md px-3 py-1.5">
                  <span className="w-2 h-2 rounded-full bg-green-500" />
                  <span className="text-white text-sm">{p.playerName}</span>
                </div>
              ))}
              {connectedPeers.length === 0 && (
                <div className="text-xs text-slate-500 text-center py-2">
                  {isGlobal ? `${t('network.searching')} (${totalPlayers})` : t('network.waiting')}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
