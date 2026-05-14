import { PeerHost } from './PeerHost';
import { PeerClient } from './PeerClient';
import type { ConnectionStatus } from './PeerClient';
import type { PlayerStateSnapshot } from './messages';
import type { NPCData } from '../../domain/models/NPCDinosaur';
import { useAppStore } from '../../store/useAppStore';

export type SessionRole = 'host' | 'client' | null;

export interface SessionConfig {
  playerName: string;
  dinoId: string;
  dinoColors: Record<string, string>;
}

function generateSessionCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 4; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

export class PeerSession {
  private host: PeerHost | null = null;
  private client: PeerClient | null = null;
  private _role: SessionRole = null;
  private _sessionCode: string;
  private _remotePlayers = new Map<string, PlayerStateSnapshot>();
  private _knownClients: Array<{ id: string; peerId: string; playerName: string; joinedAt: number }> = [];
  private _myClientId: string | null = null;
  private _hostTransferInProgress = false;
  private _electionTimeout: ReturnType<typeof setTimeout> | null = null;
  private onClientConnected: ((clientId: string, name: string) => void) | null = null;
  private onClientDisconnected: ((clientId: string) => void) | null = null;
  private onHostTransferRequested: ((newHostClientId: string) => void) | null = null;
  private onError: ((error: string) => void) | null = null;

  constructor() {
    this._sessionCode = generateSessionCode();
  }

  regenerateSessionCode(): void {
    this._sessionCode = generateSessionCode();
  }

  getRole(): SessionRole {
    return this._role;
  }

  getSessionCode(): string {
    return this._sessionCode;
  }

  /** Para migração de host: mantém o código atual */
  getOrGenerateSessionCode(): string {
    if (!this._sessionCode || this._sessionCode.length < 4) {
      this._sessionCode = generateSessionCode();
    }
    return this._sessionCode;
  }

  getRemotePlayers(): PlayerStateSnapshot[] {
    return Array.from(this._remotePlayers.values());
  }

  getClientConnectionStatus(): ConnectionStatus {
    return this.client?.getStatus() ?? 'disconnected';
  }

  getHost(): PeerHost | null {
    return this.host;
  }

  setOnClientConnected(cb: (clientId: string, name: string) => void): void {
    this.onClientConnected = cb;
  }

  setOnClientDisconnected(cb: (clientId: string) => void): void {
    this.onClientDisconnected = cb;
  }

  setOnHostTransferRequested(cb: (newHostClientId: string) => void): void {
    this.onHostTransferRequested = cb;
  }

  setOnError(cb: (error: string) => void): void {
    this.onError = cb;
  }

  async startHost(): Promise<void> {
    this._role = 'host';
    this.host = new PeerHost(this._sessionCode);

    this.host.setOnClientJoin((client) => {
      this.onClientConnected?.(client.id, client.playerName);
    });

    this.host.setOnClientLeave((clientId) => {
      this.onClientDisconnected?.(clientId);
    });

    this.host.setOnError((err) => {
      this.onError?.(err);
    });

    await this.host.start();
    useAppStore.getState().setConnectionStatus('connected');
  }

  async transferHostToNextInLine(): Promise<void> {
    const clients = this.getHostClients();
    if (clients.length === 0) return;

    // Escolhe o próximo host: o cliente conectado há mais tempo
    const sorted = [...clients].sort((a, b) => a.joinedAt - b.joinedAt);
    const nextHost = sorted[0];

    // Broadcasta a transferência para todos os clientes
    this.host?.broadcastHostTransfer(nextHost.id, nextHost.peerId);

    // Aguarda um breve momento para os clientes processarem
    await new Promise(r => setTimeout(r, 500));

    // Destrói o host atual
    this.destroy();
  }

  async joinSession(sessionCode: string, _config: SessionConfig): Promise<void> {
    this._role = 'client';
    this._sessionCode = sessionCode;
    this.client = new PeerClient(sessionCode);

    this.client.setOnError((err) => {
      this.onError?.(err);
    });

    this.client.setOnMessage((msg) => {
      switch (msg.type) {
        case 'snapshot': {
          // Update Zustand store directly — components subscribe via selectors
          useAppStore.getState().setNetworkData(
            msg.npcs as unknown[],
            msg.players as unknown[],
            msg.tick,
            msg.edibleStates
          );

          // Update remote players map for BandPanel
          const updatedPlayers = new Map<string, PlayerStateSnapshot>();
          for (const p of msg.players) {
            updatedPlayers.set(p.id, p);
          }

          // Apply health from host authoritative snapshot for this client
          if (this.client) {
            const myClientId = this.client.getClientId();
            if (myClientId) {
              const mySnapshot = msg.players.find(p => p.id === myClientId);
              if (mySnapshot && mySnapshot.health < useAppStore.getState().health) {
                const diff = useAppStore.getState().health - mySnapshot.health;
                if (diff > 0) {
                  useAppStore.getState().takeDamage(diff);
                }
              }
            }
          }

          this._remotePlayers = updatedPlayers;
          break;
        }
        case 'player_joined': {
          this._remotePlayers.set(msg.playerState.id, msg.playerState);
          break;
        }
        case 'player_left': {
          this._remotePlayers.delete(msg.clientId);
          this.onClientDisconnected?.(msg.clientId);
          // Atualiza lista de clientes conhecidos
          this._knownClients = this._knownClients.filter(c => c.id !== msg.clientId);
          break;
        }
        case 'client_list': {
          this._knownClients = msg.clients;
          break;
        }
        case 'host_transfer': {
          this.handleHostTransferMessage(msg.newHostClientId, msg.newHostPeerId);
          break;
        }
        case 'error': {
          this.onError?.(msg.message);
          break;
        }
        case 'join_ack': {
          this._myClientId = msg.clientId;
          break;
        }
      }
    });

    this.client.setOnStatusChange((status) => {
      useAppStore.getState().setConnectionStatus(status);
    });

    // Detecta desconexão do host (event-driven, sem polling)
    this.client.setOnDisconnected(() => {
      if (this._role !== 'client' || this._hostTransferInProgress) return;
      this._hostTransferInProgress = true;

      // Timeout de 3s para reconhecer que o host realmente caiu
      this._electionTimeout = setTimeout(() => {
        this._electionTimeout = null;
        this.electNewHost();
      }, 3000);
    });

    await this.client.connect();

    useAppStore.getState().setConnectionStatus('connected');

    this.client.send({
      type: 'join',
      playerName: _config.playerName,
      dinoId: _config.dinoId,
      dinoColors: _config.dinoColors,
    });
  }

  /**
   * Lida com mensagem de transferência de host vinda do host atual.
   * Se este cliente for o eleito, torna-se host. Caso contrário, reconecta.
   */
  private async handleHostTransferMessage(newHostClientId: string, _newHostPeerId: string): Promise<void> {
    this._hostTransferInProgress = true;

    const amINewHost = this._myClientId === newHostClientId;

    if (amINewHost) {
      // Este cliente é o novo host
      this.onHostTransferRequested?.(newHostClientId);
      await this.migrateToHost();
    } else {
      // Outro cliente virou host — reconecta
      this.onHostTransferRequested?.(newHostClientId);
      await this.reconnectToHost();
    }
  }

  /**
   * Eleição de novo host após disconnect abrupto.
   * Usa o menor ID de cliente (determinístico) para evitar múltiplos hosts.
   */
  private async electNewHost(): Promise<void> {
    const sorted = [...this._knownClients].sort((a, b) => a.id.localeCompare(b.id));
    const electedHost = sorted[0];
    if (!electedHost) {
      this._hostTransferInProgress = false;
      return;
    }

    const amIElected = this._myClientId === electedHost.id;
    this.onHostTransferRequested?.(electedHost.id);

    if (amIElected) {
      await this.migrateToHost();
    } else {
      // Espera o novo host inicializar e depois reconecta
      await new Promise(r => setTimeout(r, 2000));
      if (this.getClientConnectionStatus() === 'disconnected') {
        await this.reconnectToHost();
      }
    }
  }

  /**
   * Reconecta ao host (após transferência ou eleição).
   */
  private async reconnectToHost(): Promise<void> {
    try {
      if (this.client) {
        this.client.setRetainPeerOnDisconnect(false);
        await this.client.reconnectToSession(this._sessionCode);
      }
      this._hostTransferInProgress = false;
    } catch {
      this._hostTransferInProgress = false;
    }
  }

  sendInput(input: {
    moveX: number;
    moveZ: number;
    isRunning: boolean;
    attacking: boolean;
    eating: boolean;
    eatingTargetId: string;
    jumping: boolean;
    rotY: number;
    posX: number;
    posY: number;
    posZ: number;
    level: number;
    health: number;
    maxHealth: number;
    isDead: boolean;
    animationIntent: string;
  }): void {
    this.client?.send({ type: 'input', ...input });
  }

  broadcastSnapshot(
    tick: number,
    npcs: NPCData[],
    players: PlayerStateSnapshot[],
    edibleStates: Record<string, number>
  ): void {
    this.host?.broadcastSnapshot(tick, npcs, players, edibleStates);
  }

  getHostPlayerStates(): PlayerStateSnapshot[] {
    return this.host?.getClientPlayerStates() ?? [];
  }

  peekRemoteInput(clientId: string): import('./messages').InputMessage | null {
    return this.host?.peekLatestInput(clientId) ?? null;
  }

  getHostClients(): import('./PeerHost').ConnectedClient[] {
    return this.host?.getClients() ?? [];
  }

  /** Retorna true se este peer deve se tornar host (por eleição ou transferência) */
  isHostTransferPending(): boolean {
    return this._hostTransferInProgress;
  }

  async migrateToHost(): Promise<void> {
    // Preserva o sessionCode para que os outros clientes possam reconectar
    const code = this._sessionCode;

    this.host?.destroy();
    this.client?.disconnect();
    this.host = null;
    this.client = null;
    this._remotePlayers.clear();

    // Recria como host no MESMO sessionCode
    this._sessionCode = code;
    this._role = null;
    await this.startHost();
    this._hostTransferInProgress = false;

    // Atualiza store
    useAppStore.getState().setOnlineRole('host');
    useAppStore.getState().setSessionCode(this._sessionCode);
  }

  destroy(): void {
    if (this._electionTimeout) {
      clearTimeout(this._electionTimeout);
      this._electionTimeout = null;
    }
    this._hostTransferInProgress = false;
    this.host?.destroy();
    this.client?.disconnect();
    this.host = null;
    this.client = null;
    this._role = null;
    this._remotePlayers.clear();
    this._knownClients = [];
    this._myClientId = null;
  }
}

// Singleton for the app
export const peerSession = new PeerSession();
