import { EventBus, type GameEvent } from './EventBus';
import { PeerMesh } from './PeerMesh';

class EventReplicatorClass {
  private _enabled = false;
  private _processedEventIds = new Set<string>();

  enable(): void {
    if (this._enabled) return;
    this._enabled = true;

    // Quando um evento é pusheado localmente, replica via PeerMesh
    EventBus.onEventPushed = (event: GameEvent) => {
      if (!this._enabled) return;
      this._processedEventIds.add(event.id);
      PeerMesh.broadcastEvent(event);
    };
  }

  disable(): void {
    this._enabled = false;
    EventBus.onEventPushed = null;
    this._processedEventIds.clear();
  }

  /**
   * Processa um evento recebido da rede.
   * Retorna true se o evento foi aceito (não duplicado).
   */
  receiveEvent(event: GameEvent): boolean {
    if (!this._enabled) return false;

    // Deduplicação: evento já processado?
    if (this._processedEventIds.has(event.id)) return false;

    this._processedEventIds.add(event.id);

    // Insere no EventBus local para ser consumido no próximo tick de simulação
    EventBus.push(event);

    // Podar cache de IDs processados a cada 1000 eventos
    if (this._processedEventIds.size > 1000) {
      const toRemove: string[] = [];
      let i = 0;
      for (const id of this._processedEventIds) {
        if (i++ < 500) toRemove.push(id);
        else break;
      }
      for (const id of toRemove) this._processedEventIds.delete(id);
    }

    return true;
  }

  /**
   * Solicita histórico de eventos de um peer remoto (para late join / gap recovery).
   */
  requestHistory(sinceTick: number, targetPeerId?: string): void {
    if (targetPeerId) {
      PeerMesh.sendEventToPeers(
        { id: '', type: 'npc_state_sync', tick: sinceTick, originPeerId: '', data: {} },
        [targetPeerId]
      );
    }
  }

  isEnabled(): boolean {
    return this._enabled;
  }

  reset(): void {
    this.disable();
  }
}

export const EventReplicator = new EventReplicatorClass();
