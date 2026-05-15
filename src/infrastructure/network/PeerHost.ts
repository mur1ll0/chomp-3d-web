import Peer from 'peerjs';
import type { DataConnection } from 'peerjs';
import type { ClientMessage, PlayerStateSnapshot, SnapshotMessage, InputMessage } from './messages';
import type { NPCData } from '../../domain/models/NPCDinosaur';

export interface ConnectedClient {
  id: string;
  peerId: string;
  connection: DataConnection;
  playerName: string;
  dinoId: string;
  dinoColors: Record<string, string>;
  joinedAt: number;
}

export interface ClientListEntry {
  id: string;
  peerId: string;
  playerName: string;
  joinedAt: number;
}

export class PeerHost {
  private peer: Peer | null = null;
  private clients: Map<string, ConnectedClient> = new Map();
  private sessionCode: string;
  private _latestInputs = new Map<string, import('./messages').InputMessage>();
  private snapshotThrottle = 0;
  private _peerId = '';
  private onClientJoin: ((client: ConnectedClient) => void) | null = null;
  private onClientLeave: ((clientId: string) => void) | null = null;
  private onError: ((error: string) => void) | null = null;

  /** Retorna o ID do peer local (útil para host transfer) */
  getPeerId(): string {
    return this._peerId;
  }

  /** Retorna a lista serializável de clientes para host transfer */
  getClientList(): ClientListEntry[] {
    return Array.from(this.clients.values()).map(c => ({
      id: c.id,
      peerId: c.peerId,
      playerName: c.playerName,
      joinedAt: c.joinedAt,
    }));
  }

  constructor(sessionCode: string) {
    this.sessionCode = sessionCode;
  }

  getSessionCode(): string {
    return this.sessionCode;
  }

  getClients(): ConnectedClient[] {
    return Array.from(this.clients.values());
  }

  setOnClientJoin(cb: (client: ConnectedClient) => void): void {
    this.onClientJoin = cb;
  }

  setOnClientLeave(cb: (clientId: string) => void): void {
    this.onClientLeave = cb;
  }

  setOnError(cb: (error: string) => void): void {
    this.onError = cb;
  }

  async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.peer = new Peer(this.sessionCode, { debug: 0 });

        this.peer.on('open', (id) => {
          this._peerId = id;
          resolve();
        });

        this.peer.on('connection', (conn) => {
          const clientId = `client_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
          const client: ConnectedClient = {
            id: clientId,
            peerId: conn.peer,
            connection: conn,
            playerName: 'Unknown',
            dinoId: 'Velociraptor',
            dinoColors: {},
            joinedAt: Date.now(),
          };

          conn.on('data', (raw) => {
            const data = raw as ClientMessage;
            this.handleClientMessage(client, data);
          });

          conn.on('close', () => {
            this.clients.delete(client.id);
            this.onClientLeave?.(client.id);
          });

          conn.on('error', () => {
            this.clients.delete(client.id);
            this.onClientLeave?.(client.id);
          });

          this.clients.set(clientId, client);
          // Avisa todos os clientes sobre a lista atualizada
          this.updateClientListOnAllClients();
        });

        this.peer.on('error', (err) => {
          this.onError?.(err.message);
          reject(err);
        });
      } catch (err) {
        reject(err);
      }
    });
  }

  private handleClientMessage(client: ConnectedClient, msg: ClientMessage): void {
    switch (msg.type) {
      case 'join': {
        client.playerName = msg.playerName;
        client.dinoId = msg.dinoId;
        client.dinoColors = msg.dinoColors;
        client.connection.send({
          type: 'join_ack',
          clientId: client.id,
          worldSeed: 12345,
          sessionCode: this.sessionCode,
        });
        this.onClientJoin?.(client);
        break;
      }
      case 'input': {
        this._latestInputs.set(client.id, msg);
        break;
      }
      case 'leave': {
        client.connection.close();
        this.clients.delete(client.id);
        this.onClientLeave?.(client.id);
        this.updateClientListOnAllClients();
        break;
      }
    }
  }

  peekLatestInput(clientId: string): InputMessage | null {
    return this._latestInputs.get(clientId) ?? null;
  }

  getClientPlayerStates(): PlayerStateSnapshot[] {
    const states: PlayerStateSnapshot[] = [];
    for (const [clientId, client] of this.clients) {
      const input = this._latestInputs.get(clientId);
      if (!input) continue; // Skip clients that haven't sent first input yet
      states.push({
        id: clientId,
        name: client.playerName,
        dinoId: client.dinoId,
        dinoColors: client.dinoColors,
        posX: input.posX,
        posY: input.posY,
        posZ: input.posZ,
        rotY: input.rotY,
        level: input.level,
        health: input.health,
        maxHealth: input.maxHealth,
        isDead: input.isDead,
        animationIntent: input.animationIntent,
      });
    }
    return states;
  }

  broadcastSnapshot(
    tick: number,
    npcs: NPCData[],
    players: PlayerStateSnapshot[],
    edibleStates: Record<string, number>
  ): void {
    if (this.clients.size === 0) return;
    this.snapshotThrottle++;
    if (this.snapshotThrottle < 2) return;
    this.snapshotThrottle = 0;

    const CLIENT_NPC_RADIUS = 250;

    // Check if all clients are near each other (common case: same area)
    // If so, send same unfiltered NPC list to all → O(1) instead of O(N*M)
    let allNearby = true;
    let refX = 0, refZ = 0;
    let firstClient = true;
    for (const [clientId, client] of this.clients) {
      if (!client.connection.open) continue;
      const input = this._latestInputs.get(clientId);
      if (!input) { allNearby = false; break; }
      if (firstClient) {
        refX = input.posX; refZ = input.posZ;
        firstClient = false;
      } else {
        if (Math.abs(input.posX - refX) > CLIENT_NPC_RADIUS || Math.abs(input.posZ - refZ) > CLIENT_NPC_RADIUS) {
          allNearby = false;
          break;
        }
      }
    }

    const baseMessage: SnapshotMessage = {
      type: 'snapshot',
      tick,
      npcs, // unfiltered (used if allNearby or as base for filtered)
      players,
      edibleStates,
    };

    for (const [clientId, client] of this.clients) {
      try {
        if (!client.connection.open) continue;

        let message = baseMessage;
        if (!allNearby) {
          const clientInput = this._latestInputs.get(clientId);
          if (clientInput) {
            const cpx = clientInput.posX;
            const cpz = clientInput.posZ;
            const filteredNpcs = npcs.filter(n =>
              Math.abs(n.posX - cpx) <= CLIENT_NPC_RADIUS && Math.abs(n.posZ - cpz) <= CLIENT_NPC_RADIUS
            );
            message = { ...baseMessage, npcs: filteredNpcs };
          }
        }

        client.connection.send(message);
      } catch {
        // noop
      }
    }
  }

  broadcastPlayerJoined(playerState: PlayerStateSnapshot): void {
    for (const client of this.clients.values()) {
      try {
        client.connection.send({ type: 'player_joined', playerState });
      } catch {
        // noop
      }
    }
  }

  updateClientListOnAllClients(): void {
    const list = this.getClientList();
    for (const client of this.clients.values()) {
      try {
        if (client.connection.open) {
          client.connection.send({ type: 'client_list', clients: list });
        }
      } catch {
        // noop
      }
    }
  }

  broadcastHostTransfer(newHostClientId: string, newHostPeerId: string): void {
    for (const client of this.clients.values()) {
      try {
        if (client.connection.open) {
          client.connection.send({
            type: 'host_transfer',
            newHostClientId,
            newHostPeerId,
          });
        }
      } catch {
        // noop
      }
    }
  }

  destroy(): void {
    for (const client of this.clients.values()) {
      try {
        client.connection.close();
      } catch {
        // noop
      }
    }
    this.clients.clear();
    this.peer?.destroy();
    this.peer = null;
  }
}
