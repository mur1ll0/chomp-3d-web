import React, { useState, useEffect, useCallback } from 'react';
import { PeerMesh } from '../../infrastructure/network/PeerMesh';
import { useT } from '../../i18n/useT';
import { toastListeners, type Toast } from './packToast';
import { UserCheck, UserX, UserPlus } from 'lucide-react';

export const PackInviteToast: React.FC = () => {
  const t = useT();
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((toast: Toast) => {
    setToasts(prev => [...prev, toast]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== toast.id));
    }, 8000);
  }, []);

  useEffect(() => {
    toastListeners.add(addToast);
    return () => { toastListeners.delete(addToast); };
  }, [addToast]);

  const handleAcceptInvite = (toast: Toast) => {
    if (toast.fromPeerId) {
      PeerMesh.respondToPackInvite(toast.fromPeerId, true);
    }
    setToasts(prev => prev.filter(t => t.id !== toast.id));
  };

  const handleDeclineInvite = (toast: Toast) => {
    if (toast.fromPeerId) {
      PeerMesh.respondToPackInvite(toast.fromPeerId, false);
    }
    setToasts(prev => prev.filter(t => t.id !== toast.id));
  };

  const handleAcceptRequest = (toast: Toast) => {
    if (toast.fromPeerId) {
      PeerMesh.respondToPackJoinRequest(toast.fromPeerId, true);
    }
    setToasts(prev => prev.filter(t => t.id !== toast.id));
  };

  const handleDeclineRequest = (toast: Toast) => {
    if (toast.fromPeerId) {
      PeerMesh.respondToPackJoinRequest(toast.fromPeerId, false);
    }
    setToasts(prev => prev.filter(t => t.id !== toast.id));
  };

  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-20 right-4 z-50 flex flex-col gap-2 pointer-events-auto">
      {toasts.map(toast => (
        <div
          key={toast.id}
          className="bg-slate-900/95 backdrop-blur border border-amber-600/40 rounded-xl p-4 shadow-2xl w-72 animate-in slide-in-from-right duration-200"
        >
          <p className="text-white text-sm font-medium mb-3">{toast.message}</p>

          {toast.type === 'invite' && (
            <div className="flex gap-2">
              <button
                onClick={() => handleAcceptInvite(toast)}
                className="flex-1 flex items-center justify-center gap-1 bg-green-600 hover:bg-green-500 text-white text-xs font-bold py-2 rounded-lg transition-all"
              >
                <UserCheck className="w-3 h-3" />
                {t('pack.accept')}
              </button>
              <button
                onClick={() => handleDeclineInvite(toast)}
                className="flex-1 flex items-center justify-center gap-1 bg-red-600/40 hover:bg-red-600/60 border border-red-500/40 text-red-400 text-xs font-bold py-2 rounded-lg transition-all"
              >
                <UserX className="w-3 h-3" />
                {t('pack.decline')}
              </button>
            </div>
          )}

          {toast.type === 'join_request' && (
            <div className="flex gap-2">
              <button
                onClick={() => handleAcceptRequest(toast)}
                className="flex-1 flex items-center justify-center gap-1 bg-green-600 hover:bg-green-500 text-white text-xs font-bold py-2 rounded-lg transition-all"
              >
                <UserPlus className="w-3 h-3" />
                {t('pack.accept')}
              </button>
              <button
                onClick={() => handleDeclineRequest(toast)}
                className="flex-1 flex items-center justify-center gap-1 bg-red-600/40 hover:bg-red-600/60 border border-red-500/40 text-red-400 text-xs font-bold py-2 rounded-lg transition-all"
              >
                <UserX className="w-3 h-3" />
                {t('pack.decline')}
              </button>
            </div>
          )}

          {toast.type === 'kicked' && (
            <div className="text-[10px] text-slate-500 text-center">{t('pack.clickToClose')}</div>
          )}
        </div>
      ))}
    </div>
  );
};
