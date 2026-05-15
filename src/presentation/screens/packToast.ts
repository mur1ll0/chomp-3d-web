import { tStandalone } from '../../i18n/useT';

export interface Toast {
  id: number;
  type: 'invite' | 'join_request' | 'kicked' | 'info';
  message: string;
  fromPeerId?: string;
}

let toastId = 0;
export const toastListeners: Set<(toast: Toast) => void> = new Set();

export function emitToast(toast: Toast): void {
  toastListeners.forEach(fn => fn(toast));
}

export function showPackInvite(fromPeerId: string, fromPlayerName: string): void {
  emitToast({ id: ++toastId, type: 'invite', message: tStandalone('pack.invite', { name: fromPlayerName }), fromPeerId });
}

export function showPackJoinRequest(fromPeerId: string, fromPlayerName: string): void {
  emitToast({ id: ++toastId, type: 'join_request', message: tStandalone('pack.joinRequest', { name: fromPlayerName }), fromPeerId });
}

export function showPackKicked(): void {
  emitToast({ id: ++toastId, type: 'kicked', message: tStandalone('pack.kicked') });
}

export function showPackInfo(message: string): void {
  emitToast({ id: ++toastId, type: 'info', message });
}
