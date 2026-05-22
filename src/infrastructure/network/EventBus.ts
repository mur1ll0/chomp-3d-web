export type GameEventType =
  | 'npc_attack'
  | 'npc_died'
  | 'food_consumed'
  | 'player_chunk'
  | 'npc_state_sync'
  | 'player_attacked';

export interface GameEvent {
  id: string;
  type: GameEventType;
  tick: number;
  originPeerId: string;
  data: Record<string, unknown>;
}

const HISTORY_RETENTION_TICKS = 10000;

class EventBusClass {
  private events: GameEvent[] = [];
  private sequence = 0;
  private ownPeerId = 'local';

  onEventPushed: ((event: GameEvent) => void) | null = null;

  setOwnPeerId(id: string): void {
    this.ownPeerId = id;
  }

  generateEventId(tick: number, type: string, seq: number): string {
    const str = `${tick}:${this.ownPeerId}:${type}:${seq}`;
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return (h >>> 0).toString(36);
  }

  push(event: Omit<GameEvent, 'id'>): GameEvent {
    const fullEvent: GameEvent = {
      ...event,
      id: this.generateEventId(event.tick, event.type, this.sequence++),
    };
    this.events.push(fullEvent);
    this.onEventPushed?.(fullEvent);
    return fullEvent;
  }

  pushNetworkEvent(event: GameEvent): void {
    this.events.push(event);
  }

  consume(maxTick: number): GameEvent[] {
    const result: GameEvent[] = [];
    const remaining: GameEvent[] = [];
    for (const ev of this.events) {
      if (ev.tick <= maxTick) {
        result.push(ev);
      } else {
        remaining.push(ev);
      }
    }
    this.events = remaining;
    return result;
  }

  getHistory(sinceTick: number): GameEvent[] {
    return this.events.filter(ev => ev.tick > sinceTick);
  }

  prune(currentTick: number): void {
    const cutoff = currentTick - HISTORY_RETENTION_TICKS;
    let cutIndex = 0;
    while (cutIndex < this.events.length && this.events[cutIndex].tick < cutoff) {
      cutIndex++;
    }
    if (cutIndex > 0) {
      this.events = this.events.slice(cutIndex);
    }
  }

  clear(): void {
    this.events = [];
    this.sequence = 0;
  }
}

export const EventBus = new EventBusClass();
