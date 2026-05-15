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
  emitToast({ id: ++toastId, type: 'invite', message: `${fromPlayerName} convidou você para o bando!`, fromPeerId });
}

export function showPackJoinRequest(fromPeerId: string, fromPlayerName: string): void {
  emitToast({ id: ++toastId, type: 'join_request', message: `${fromPlayerName} quer entrar no seu bando!`, fromPeerId });
}

export function showPackKicked(): void {
  emitToast({ id: ++toastId, type: 'kicked', message: 'Você foi removido do bando!' });
}

export function showPackInfo(message: string): void {
  emitToast({ id: ++toastId, type: 'info', message });
}
