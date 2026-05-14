import Peer from 'peerjs';
import type { DataConnection } from 'peerjs';
import { EventBus, type GameEvent } from './EventBus';
import { ChunkInterestManager, worldToChunk } from './ChunkInterestManager';
import { SignalingClient, type PeerListEntry } from './SignalingClient';
import type {
  PeerHandshakeMessage,
  PeerHandshakeAckMessage,
  EventMessage,
  PlayerStateMessage,
  HeartbeatMessage,
  PeerListMessage,
  EventHistoryRequestMessage,
  EventHistoryResponseMessage,
  PeerMeshMessage,
} from './messages';
import { useAppStore } from '../../store/useAppStore';

export type MeshMode = 'party' | 'global';

export interface PeerInfo {
  id: string;
  peerId: string;
  playerName: string;
  dinoId: string;
  colors: Record<string, string>;
  chunkX: number;
  chunkZ: number;
  connectedAt: number;
}

const HEARTBEAT_INTERVAL_MS = 5000;
const PEER_TIMEOUT_MS = 15000;
const PLAYER_STATE_THROTTLE_MS = 100;

function generateSessionCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 4; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

function generatePeerId(): string {
  const suffix = Math.random().toString(36).slice(2, 8);
  return `chomp_${suffix}`;
}

class PeerMeshClass {
  private _ownPeer: Peer | null = null;
  private _connections = new Map<string, DataConnection>();
  private _peerInfo = new Map<string, PeerInfo>();
  private _chunkInterest: ChunkInterestManager | null = null;
  private _mode: MeshMode = 'party';
  private _sessionCode = '';
  private _ownPeerId = 'local';
  private _heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private _lastPeerHeartbeat = new Map<string, number>();
  private _playerName = '';
  private _dinoId = '';
  private _colors: Record<string, string> = {};
  private _lastPlayerStateSend = 0;
  private _onPeerListChanged: ((peers: PeerInfo[]) => void) | null = null;
  private _isFirstPeer = false;
  private _remotePlayerStates = new Map<string, PlayerStateMessage>();
  private _signalingClient: SignalingClient | null = null;

  // ── Lifecycle ──

  async startParty(sessionCode?: string): Promise<void> {
    this._mode = 'party';

    if (!sessionCode) {
      this._isFirstPeer = true;
      this._sessionCode = generateSessionCode();
      await this._createPeer(this._sessionCode);
    } else {
      this._isFirstPeer = false;
      this._sessionCode = sessionCode;
      await this._createPeer(generatePeerId());
    }

    EventBus.setOwnPeerId(this._ownPeerId);

    if (!this._isFirstPeer) {
      await this._connectToHostPeer(this._sessionCode);
    }

    this._startHeartbeat();
  }

  async startGlobal(signalingUrl: string): Promise<void> {
    this._mode = 'global';
    this._sessionCode = '';

    await this._createPeer(generatePeerId());
    EventBus.setOwnPeerId(this._ownPeerId);

    this._signalingClient = new SignalingClient(signalingUrl);

    this._signalingClient.onWelcome = (_peerId, count) => {
      useAppStore.getState().setConnectionStatus('connected');
      useAppStore.getState().setGlobalPlayerCount(count);
    };

    this._signalingClient.onPeerList = (peers) => {
      this._connectToInterestPeers(peers);
    };

    this._signalingClient.onPeerJoined = (peer) => {
      if (this._isInInterestZone(peer)) {
        this._connectToRemotePeer(peer.peerId, peer);
      }
    };

    this._signalingClient.onPeerLeft = (peerId) => {
      this._onPeerDisconnected(peerId);
    };

    this._signalingClient.onPeerChunkUpdate = (peerId, cx, cz) => {
      const info = this._peerInfo.get(peerId);
      if (info) {
        info.chunkX = cx;
        info.chunkZ = cz;
      }
      if (this._chunkInterest) {
        this._chunkInterest.updatePeerChunk(peerId, cx, cz);
      }
    };

    this._signalingClient.onDisconnected = () => {
      useAppStore.getState().setConnectionStatus('disconnected');
    };

    await this._signalingClient.connect();

    this._signalingClient.sendJoin(
      this._ownPeerId,
      this._playerName,
      this._dinoId,
      this._colors,
      useAppStore.getState().renderDistance
    );

    // Registra chunk do jogador no signaling
    const chunk = worldToChunk(0, 0);
    this._signalingClient.sendChunkUpdate(chunk.x, chunk.z);

    this._startHeartbeat();
  }

  async destroy(): Promise<void> {
    this._stopHeartbeat();
    EventBus.clear();

    for (const [, conn] of this._connections) {
      try { conn.close(); } catch { /* noop */ }
    }
    this._connections.clear();
    this._peerInfo.clear();
    this._lastPeerHeartbeat.clear();

    if (this._ownPeer) {
      this._ownPeer.destroy();
      this._ownPeer = null;
    }

    if (this._signalingClient) {
      this._signalingClient.disconnect();
      this._signalingClient = null;
    }

    this._ownPeerId = 'local';
    EventBus.setOwnPeerId('local');
    this._onPeerListChanged = null;
    this._isFirstPeer = false;
    this._remotePlayerStates.clear();
  }

  // ── Configuração ──

  setChunkInterestManager(mgr: ChunkInterestManager): void {
    this._chunkInterest = mgr;
    mgr.onChunkChanged = (oldPos, newPos) => this._onLocalChunkChanged(oldPos, newPos);
  }

  setPlayerInfo(playerName: string, dinoId: string, colors: Record<string, string>): void {
    this._playerName = playerName;
    this._dinoId = dinoId;
    this._colors = colors;
  }

  setOnPeerListChanged(cb: ((peers: PeerInfo[]) => void) | null): void {
    this._onPeerListChanged = cb;
  }

  // ── Consulta ──

  getOwnPeerId(): string {
    return this._ownPeerId;
  }

  getSessionCode(): string {
    return this._sessionCode;
  }

  getMode(): MeshMode {
    return this._mode;
  }

  getConnectedPeers(): PeerInfo[] {
    return Array.from(this._peerInfo.values());
  }

  getPeerInfo(peerId: string): PeerInfo | undefined {
    return this._peerInfo.get(peerId);
  }

  getPeersInChunk(cx: number, cz: number): PeerInfo[] {
    return Array.from(this._peerInfo.values()).filter(
      p => p.chunkX === cx && p.chunkZ === cz
    );
  }

  isConnected(): boolean {
    return this._ownPeer !== null && this._ownPeerId !== 'local';
  }

  getRemotePlayerStates(): Map<string, PlayerStateMessage> {
    return this._remotePlayerStates;
  }

  // ── Envio de mensagens ──

  broadcastEvent(event: GameEvent): void {
    const msg: EventMessage = { type: 'event', event };
    this._broadcast(msg);
  }

  sendEventToPeers(event: GameEvent, peerIds: string[]): void {
    const msg: EventMessage = { type: 'event', event };
    for (const pid of peerIds) {
      this._sendToPeer(pid, msg);
    }
  }

  sendPlayerState(state: Omit<PlayerStateMessage, 'type'>): void {
    const now = Date.now();
    if (now - this._lastPlayerStateSend < PLAYER_STATE_THROTTLE_MS) return;
    this._lastPlayerStateSend = now;

    const msg: PlayerStateMessage = { type: 'player_state', ...state };
    this._broadcast(msg);
  }

  // ── Métodos privados ──

  private async _createPeer(peerId: string): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      try {
        this._ownPeer = new Peer(peerId, { debug: 0 });

        const timeout = setTimeout(() => {
          reject(new Error('PeerJS connection timeout'));
        }, 10000);

        this._ownPeer.on('open', (id) => {
          clearTimeout(timeout);
          this._ownPeerId = id;
          resolve();
        });

        this._ownPeer.on('connection', (conn) => {
          this._setupConnection(conn);
        });

        this._ownPeer.on('error', (err) => {
          clearTimeout(timeout);
          reject(err);
        });
      } catch (err) {
        reject(err);
      }
    });
  }

  private async _connectToHostPeer(hostPeerId: string): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const conn = this._ownPeer!.connect(hostPeerId, { reliable: true });

      const timeout = setTimeout(() => {
        reject(new Error('Connection to host timed out'));
      }, 10000);

      conn.on('open', () => {
        clearTimeout(timeout);
        this._connections.set(conn.peer, conn);
        this._lastPeerHeartbeat.set(conn.peer, Date.now());

        // Envia handshake
        const chunk = worldToChunk(0, 0);
        const handshake: PeerHandshakeMessage = {
          type: 'peer_handshake',
          peerId: this._ownPeerId,
          playerName: this._playerName,
          dinoId: this._dinoId,
          colors: this._colors,
          chunkX: chunk.x,
          chunkZ: chunk.z,
          tick: 0,
        };
        this._sendToPeer(conn.peer, handshake);
        resolve();
      });

      conn.on('error', (err) => {
        clearTimeout(timeout);
        reject(err);
      });
    });
  }

  private _setupConnection(conn: DataConnection): void {
    conn.on('data', (raw) => {
      this._handleMessage(conn.peer, raw as PeerMeshMessage);
    });

    conn.on('close', () => {
      this._onPeerDisconnected(conn.peer);
    });

    conn.on('error', () => {
      this._onPeerDisconnected(conn.peer);
    });

    this._connections.set(conn.peer, conn);
    this._lastPeerHeartbeat.set(conn.peer, Date.now());

    // Se for o primeiro peer e recebeu conexão de entrada: envia handshake de volta
    if (this._isFirstPeer) {
      const chunk = worldToChunk(0, 0);
      const ack: PeerHandshakeAckMessage = {
        type: 'peer_handshake_ack',
        peerId: this._ownPeerId,
        playerName: this._playerName,
        dinoId: this._dinoId,
        colors: this._colors,
        chunkX: chunk.x,
        chunkZ: chunk.z,
        tick: 0,
      };
      this._sendToPeer(conn.peer, ack);
    }
  }

  private _handleMessage(peerId: string, msg: PeerMeshMessage): void {
    switch (msg.type) {
      case 'peer_handshake':
        this._handleHandshake(peerId, msg);
        break;
      case 'peer_handshake_ack':
        this._handleHandshakeAck(peerId, msg);
        break;
      case 'event':
        this._handleRemoteEvent(msg);
        break;
      case 'player_state':
        this._handlePlayerState(msg);
        break;
      case 'heartbeat':
        this._handleHeartbeat(peerId, msg);
        break;
      case 'peer_list':
        this._handlePeerList(msg);
        break;
      case 'event_history_request':
        this._handleHistoryRequest(msg);
        break;
      case 'event_history_response':
        this._handleHistoryResponse(msg);
        break;
    }
  }

  private _handleHandshake(peerId: string, msg: PeerHandshakeMessage): void {
    const existing = this._peerInfo.get(peerId);
    if (!existing) {
      this._peerInfo.set(peerId, {
        id: peerId,
        peerId,
        playerName: msg.playerName,
        dinoId: msg.dinoId,
        colors: msg.colors,
        chunkX: msg.chunkX,
        chunkZ: msg.chunkZ,
        connectedAt: Date.now(),
      });
      this._notifyPeerListChanged();

      // Primeiro peer: ao receber handshake, envia ack + peer list
      if (this._isFirstPeer) {
        const chunk = worldToChunk(0, 0);
        const ack: PeerHandshakeAckMessage = {
          type: 'peer_handshake_ack',
          peerId: this._ownPeerId,
          playerName: this._playerName,
          dinoId: this._dinoId,
          colors: this._colors,
          chunkX: chunk.x,
          chunkZ: chunk.z,
          tick: 0,
        };
        this._sendToPeer(peerId, ack);

        if (this._connections.size > 1) {
          const list: PeerListMessage = {
            type: 'peer_list',
            peers: Array.from(this._peerInfo.values()).map(p => ({
              peerId: p.peerId,
              playerName: p.playerName,
              dinoId: p.dinoId,
              colors: p.colors,
              chunkX: p.chunkX,
              chunkZ: p.chunkZ,
            })),
          };
          this._sendToPeer(peerId, list);
        }
      }
    } else {
      existing.chunkX = msg.chunkX;
      existing.chunkZ = msg.chunkZ;
    }
  }

  private _handleHandshakeAck(peerId: string, msg: PeerHandshakeAckMessage): void {
    if (!this._peerInfo.has(peerId)) {
      this._peerInfo.set(peerId, {
        id: peerId,
        peerId,
        playerName: msg.playerName,
        dinoId: msg.dinoId,
        colors: msg.colors,
        chunkX: msg.chunkX,
        chunkZ: msg.chunkZ,
        connectedAt: Date.now(),
      });
      this._notifyPeerListChanged();
    }
  }

  private _handleRemoteEvent(msg: EventMessage): void {
    EventBus.push(msg.event);
  }

  private _handlePlayerState(msg: PlayerStateMessage): void {
    // Remote player state é armazenado em um Map local para uso futuro (Sprint 4)
    this._remotePlayerStates.set(msg.peerId, msg);
  }

  private _handleHeartbeat(peerId: string, msg: HeartbeatMessage): void {
    this._lastPeerHeartbeat.set(peerId, Date.now());
    const info = this._peerInfo.get(peerId);
    if (info) {
      info.chunkX = msg.chunkX;
      info.chunkZ = msg.chunkZ;
    }
    if (this._chunkInterest) {
      this._chunkInterest.updatePeerChunk(peerId, msg.chunkX, msg.chunkZ, msg.renderDistance);
    }
  }

  private _handlePeerList(msg: PeerListMessage): void {
    for (const p of msg.peers) {
      if (p.peerId === this._ownPeerId) continue;
      if (this._connections.has(p.peerId)) continue;
      if (this._peerInfo.has(p.peerId)) continue;

      this._peerInfo.set(p.peerId, {
        id: p.peerId,
        peerId: p.peerId,
        playerName: p.playerName,
        dinoId: p.dinoId,
        colors: p.colors,
        chunkX: p.chunkX,
        chunkZ: p.chunkZ,
        connectedAt: Date.now(),
      });

      // Conecta diretamente ao peer
      const conn = this._ownPeer!.connect(p.peerId, { reliable: true });
      conn.on('open', () => {
        this._connections.set(p.peerId, conn);
        this._lastPeerHeartbeat.set(p.peerId, Date.now());
        const chunk = worldToChunk(0, 0);
        const hs: PeerHandshakeMessage = {
          type: 'peer_handshake',
          peerId: this._ownPeerId,
          playerName: this._playerName,
          dinoId: this._dinoId,
          colors: this._colors,
          chunkX: chunk.x,
          chunkZ: chunk.z,
          tick: 0,
        };
        this._sendToPeer(p.peerId, hs);
      });
      conn.on('error', () => this._onPeerDisconnected(p.peerId));
      conn.on('close', () => this._onPeerDisconnected(p.peerId));
    }
    this._notifyPeerListChanged();
  }

  private _handleHistoryRequest(msg: EventHistoryRequestMessage): void {
    const events = EventBus.getHistory(msg.sinceTick);
    const response: EventHistoryResponseMessage = {
      type: 'event_history_response',
      events,
      targetPeerId: msg.requesterPeerId,
    };
    this._sendToPeer(msg.requesterPeerId, response);
  }

  private _handleHistoryResponse(msg: EventHistoryResponseMessage): void {
    for (const ev of msg.events) {
      EventBus.push(ev);
    }
  }

  private _onPeerDisconnected(peerId: string): void {
    this._connections.delete(peerId);
    this._peerInfo.delete(peerId);
    this._lastPeerHeartbeat.delete(peerId);
    this._notifyPeerListChanged();
  }

  private _onLocalChunkChanged(_oldPos: { x: number; z: number }, newPos: { x: number; z: number }): void {
    // Notifica peers conectados sobre mudança de chunk
    const event: GameEvent = EventBus.push({
      type: 'player_chunk',
      tick: 0,
      originPeerId: this._ownPeerId,
      data: {
        chunkX: newPos.x,
        chunkZ: newPos.z,
        peerId: this._ownPeerId,
      },
    });
    this.broadcastEvent(event);

    // Em modo Global, notifica o signaling server
    if (this._mode === 'global' && this._signalingClient) {
      this._signalingClient.sendChunkUpdate(newPos.x, newPos.z);
    }
  }

  // ── Global Mode Helpers ──

  private _isInInterestZone(peer: { chunkX: number; chunkZ: number; renderDistance?: number }): boolean {
    const myChunk = this._chunkInterest?.playerChunk ?? { x: 0, z: 0 };
    const dist = Math.abs(peer.chunkX - myChunk.x) + Math.abs(peer.chunkZ - myChunk.z);
    const myRadius = this._chunkInterest?.interestRadius ?? 2;
    const peerRadius = peer.renderDistance ?? 2;
    return dist <= myRadius || dist <= peerRadius;
  }

  private _connectToInterestPeers(peers: PeerListEntry[]): void {
    const candidates = peers.filter(p => {
      if (p.peerId === this._ownPeerId) return false;
      if (this._connections.has(p.peerId)) return false;
      return this._isInInterestZone(p);
    });

    // Ordena por distância (mais próximos primeiro)
    const myChunk = this._chunkInterest?.playerChunk ?? { x: 0, z: 0 };
    candidates.sort((a, b) => {
      const da = Math.abs(a.chunkX - myChunk.x) + Math.abs(a.chunkZ - myChunk.z);
      const db = Math.abs(b.chunkX - myChunk.x) + Math.abs(b.chunkZ - myChunk.z);
      return da - db;
    });

    // Hard cap: max 30 conexões
    const toConnect = candidates.slice(0, 30);

    for (const peer of toConnect) {
      this._connectToRemotePeer(peer.peerId, peer);
    }
  }

  private _connectToRemotePeer(peerId: string, info: { playerName: string; dinoId: string; chunkX: number; chunkZ: number }): void {
    if (this._connections.has(peerId)) return;
    if (peerId === this._ownPeerId) return;
    if (!this._ownPeer) return;

    this._peerInfo.set(peerId, {
      id: peerId,
      peerId,
      playerName: info.playerName,
      dinoId: info.dinoId,
      colors: {},
      chunkX: info.chunkX,
      chunkZ: info.chunkZ,
      connectedAt: Date.now(),
    });

    const conn = this._ownPeer.connect(peerId, { reliable: true });

    conn.on('open', () => {
      this._connections.set(peerId, conn);
      this._lastPeerHeartbeat.set(peerId, Date.now());
      const chunk = worldToChunk(0, 0);
      const hs: PeerHandshakeMessage = {
        type: 'peer_handshake',
        peerId: this._ownPeerId,
        playerName: this._playerName,
        dinoId: this._dinoId,
        colors: this._colors,
        chunkX: chunk.x,
        chunkZ: chunk.z,
        tick: 0,
      };
      this._sendToPeer(peerId, hs);
    });

    conn.on('data', (raw) => {
      this._handleMessage(peerId, raw as PeerMeshMessage);
    });

    conn.on('error', () => this._onPeerDisconnected(peerId));
    conn.on('close', () => this._onPeerDisconnected(peerId));
  }

  reconcileConnections(): void {
    // Reavalia conexões após mudança de renderDistance
    if (!this._chunkInterest) return;

    const peerIds = Array.from(this._peerInfo.keys());
    for (const pid of peerIds) {
      const info = this._peerInfo.get(pid);
      if (!info) continue;
      if (!this._isInInterestZone({ chunkX: info.chunkX, chunkZ: info.chunkZ })) {
        this._onPeerDisconnected(pid);
      }
    }

    // Notifica signaling sobre a mudança de renderDistance
    if (this._signalingClient) {
      this._signalingClient.sendRenderDistanceUpdate(
        useAppStore.getState().renderDistance
      );
    }
  }

  // ── Heartbeat ──

  private _startHeartbeat(): void {
    this._heartbeatTimer = setInterval(() => {
      const chunk = worldToChunk(0, 0);
      const renderDistance = useAppStore.getState().renderDistance;
      const hb: HeartbeatMessage = {
        type: 'heartbeat',
        chunkX: chunk.x,
        chunkZ: chunk.z,
        tick: 0,
        renderDistance,
      };
      this._broadcast(hb);

      // Verifica timeouts
      const now = Date.now();
      for (const [pid, last] of this._lastPeerHeartbeat) {
        if (now - last > PEER_TIMEOUT_MS) {
          this._onPeerDisconnected(pid);
        }
      }
    }, HEARTBEAT_INTERVAL_MS);
  }

  private _stopHeartbeat(): void {
    if (this._heartbeatTimer) {
      clearInterval(this._heartbeatTimer);
      this._heartbeatTimer = null;
    }
  }

  // ── Envio interno ──

  private _broadcast(msg: PeerMeshMessage): void {
    for (const [peerId] of this._connections) {
      this._sendToPeer(peerId, msg);
    }
  }

  private _sendToPeer(peerId: string, msg: PeerMeshMessage): void {
    const conn = this._connections.get(peerId);
    if (conn?.open) {
      try {
        conn.send(msg);
      } catch {
        // noop
      }
    }
  }

  private _notifyPeerListChanged(): void {
    this._onPeerListChanged?.(this.getConnectedPeers());
    useAppStore.getState().setConnectedPlayers(
      Array.from(this._peerInfo.values()).map(p => p.playerName)
    );
  }
}

export const PeerMesh = new PeerMeshClass();
