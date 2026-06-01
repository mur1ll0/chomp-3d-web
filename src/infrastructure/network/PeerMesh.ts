import Peer from 'peerjs';
import type { DataConnection } from 'peerjs';
import { EventBus, type GameEvent } from './EventBus';
import { EventReplicator } from './EventReplicator';
import { ChunkInterestManager, worldToChunk } from './ChunkInterestManager';
import { PlayerPositionRef } from '../../useCases/game/PlayerPositionRef';
import { NPCManager } from '../../useCases/game/NPCManager';
import type {
  PeerHandshakeMessage,
  PeerHandshakeAckMessage,
  EventMessage,
  PlayerStateMessage,
  HeartbeatMessage,
  PeerListMessage,
  EventHistoryRequestMessage,
  EventHistoryResponseMessage,
  PackMemberEntry,
  PackInviteMessage,
  PackInviteResponseMessage,
  PackJoinRequestMessage,
  PackJoinResponseMessage,
  PackKickMessage,
  PackMemberUpdateMessage,
  PackLeaveMessage,
  PeerDisconnectMessage,
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
  packCode: string;
  posX: number;
  posZ: number;
  chunkX: number;
  chunkZ: number;
  connectedAt: number;
}

const HEARTBEAT_INTERVAL_MS = 5000;
const PEER_TIMEOUT_MS = 15000;
const PLAYER_STATE_THROTTLE_MS = 100;
const GLOBAL_ROOM_CODE = 'chomp3d-global-v1';

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
  private _packCode = '';
  private _lastPlayerStateSend = 0;
  private _onPeerListChanged: ((peers: PeerInfo[]) => void) | null = null;
  private _isFirstPeer = false;
  private _isPaused = false;
  private _remotePlayerStates = new Map<string, PlayerStateMessage>();
  private _carcassSpawned = new Set<string>();
  private _reconnectingTo = new Set<string>();

  // Pack state
  private _packMembers: PackMemberEntry[] = [];
  private _isPackLeader = false;
  onPackInvite: ((fromPeerId: string, fromPlayerName: string) => void) | null = null;
  onPackInviteAccepted: ((peerId: string, playerName: string) => void) | null = null;
  onPackJoinRequest: ((fromPeerId: string, fromPlayerName: string, fromDinoId: string) => void) | null = null;
  onPackKicked: (() => void) | null = null;
  onPackMemberUpdate: ((members: PackMemberEntry[]) => void) | null = null;
  onPackDisbanded: (() => void) | null = null;

  // ── Lifecycle ──

  async startParty(sessionCode: string, isHost: boolean): Promise<void> {
    this._mode = 'party';
    this._sessionCode = sessionCode;

    // Reforça dados do jogador lendo do store (segurança caso setPlayerInfo
    // tenha sido chamado antes das cores serem inicializadas na UI).
    const st = useAppStore.getState();
    if (st.playerName) this._playerName = st.playerName;
    if (st.selectedDinoId) this._dinoId = st.selectedDinoId;
    if (Object.keys(st.dinoColors).length > 0) this._colors = { ...st.dinoColors };

    // PeerSession.startHost() já cria um PeerJS peer com sessionCode como ID.
    // Para evitar conflito, o PeerMesh do host usa prefixo 'mesh_'.
    const hostPeerId = `mesh_${sessionCode}`;

    this._isFirstPeer = isHost;
    if (isHost) {
      await this._createPeer(hostPeerId);
    } else {
      await this._createPeer(generatePeerId());
    }

    EventBus.setOwnPeerId(this._ownPeerId);

    if (!this._isFirstPeer) {
      await this._connectToHostPeer(hostPeerId);
    }

    EventReplicator.enable();
    this._startHeartbeat();
  }

  async startGlobal(): Promise<void> {
    this._mode = 'global';
    this._sessionCode = GLOBAL_ROOM_CODE;

    // Reforça dados do jogador lendo do store (segurança caso setPlayerInfo
    // tenha sido chamado antes das cores serem inicializadas na UI).
    const st = useAppStore.getState();
    if (st.playerName) this._playerName = st.playerName;
    if (st.selectedDinoId) this._dinoId = st.selectedDinoId;
    if (Object.keys(st.dinoColors).length > 0) this._colors = { ...st.dinoColors };

    // Tenta ser o host (primeiro peer a entrar no mundo)
    try {
      await this._createPeer(this._sessionCode);
      this._isFirstPeer = true;
    } catch {
      // ID já em uso — entra como cliente
      if (this._ownPeer) {
        this._ownPeer.destroy();
        this._ownPeer = null;
      }
      await this._createPeer(generatePeerId());
      this._isFirstPeer = false;
    }

    EventBus.setOwnPeerId(this._ownPeerId);

    if (!this._isFirstPeer) {
      await this._connectToHostPeer(this._sessionCode);
    }

    EventReplicator.enable();
    useAppStore.getState().setConnectionStatus('connected');
    this._startHeartbeat();
  }

  broadcastDisconnect(): void {
    const msg: PeerDisconnectMessage = {
      type: 'peer_disconnect',
      peerId: this._ownPeerId,
      isDead: PlayerPositionRef.isDead,
      posX: PlayerPositionRef.x,
      posY: PlayerPositionRef.y,
      posZ: PlayerPositionRef.z,
      dinoId: this._dinoId,
      level: PlayerPositionRef.level,
    };
    this._broadcast(msg);
  }

  async destroy(): Promise<void> {
    // Envia pacote de despedida antes de fechar conexões
    this.broadcastDisconnect();

    EventReplicator.disable();
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

    this._ownPeerId = 'local';
    EventBus.setOwnPeerId('local');
    this._onPeerListChanged = null;
    this._isFirstPeer = false;
    this._isPaused = false;
    this._remotePlayerStates.clear();
    this._carcassSpawned.clear();
    this._reconnectingTo.clear();
    this._clearPack();
  }

  /**
   * Pausa o mesh sem destruir conexões. Útil quando o jogador sai da
   * partida mas pode voltar (ex.: morte → character-select).
   */
  pause(): void {
    if (this._isPaused) return;
    this._isPaused = true;
    EventReplicator.disable();
  }

  /**
   * Retoma um mesh pausado, reabilitando heartbeat e replicação de eventos.
   */
  resume(): void {
    if (!this._isPaused) return;
    this._isPaused = false;
    EventReplicator.reset();
    EventReplicator.enable();
    EventBus.clear();
    if (!this._heartbeatTimer) {
      this._startHeartbeat();
    }
    useAppStore.getState().setConnectionStatus('connected');
  }

  /**
   * Reinicia o estado interno para uma nova sessão, mantendo a mesma
   * conexão PeerJS ativa. Útil quando o jogador recria o personagem
   * na tela de seleção sem fechar a conexão P2P.
   */
  resetGameState(): void {
    // Limpa estados internos para reentrada, mas NÃO remove a carcaça
    // (ela deve persistir no mapa para outros jogadores e para o próprio
    // jogador quando voltar à partida).
    this._carcassSpawned.clear();
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

  setPackCode(packCode: string): void {
    this._packCode = packCode;
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

  getPackCode(): string {
    return this._packCode;
  }

  isFirstPeer(): boolean {
    return this._isFirstPeer;
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

  getPackLeaderPosition(): { x: number; z: number } | null {
    if (this._packMembers.length === 0) return null;
    // O primeiro membro do pack é sempre o líder
    const leader = this._packMembers[0];
    if (leader.peerId === this._ownPeerId) return null;
    const state = this._remotePlayerStates.get(leader.peerId);
    if (state) return { x: state.posX, z: state.posZ };
    const info = this._peerInfo.get(leader.peerId);
    if (info) return { x: info.posX, z: info.posZ };
    return null;
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

  sendPlayerState(state: Omit<PlayerStateMessage, 'type'>, force = false): void {
    const now = Date.now();
    if (!force && now - this._lastPlayerStateSend < PLAYER_STATE_THROTTLE_MS) return;
    this._lastPlayerStateSend = now;
    const msg: PlayerStateMessage = { type: 'player_state', ...state };
    this._broadcast(msg);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  broadcastNpcSnapshot(tick: number, npcs: any[], players: any[], edibleStates: Record<string, number>): void {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const msg: any = { type: 'npc_snapshot', tick, npcs, players, edibleStates };
    this._broadcast(msg);
  }

  // ── Pack API ──

  createPack(): void {
    if (!this._packCode) {
      this._packCode = generateSessionCode();
    }
    this._packMembers = [{ peerId: this._ownPeerId, playerName: this._playerName, dinoId: this._dinoId }];
    this._isPackLeader = true;
    useAppStore.getState().setPackRole('leading');
    useAppStore.getState().setPackMembers(this._packMembers);
    useAppStore.getState().setPackLeaderPeerId(this._ownPeerId);
    useAppStore.getState().setPackCode(this._packCode);
  }

  inviteToPack(peerId: string): void {
    const msg: PackInviteMessage = {
      type: 'pack_invite',
      fromPeerId: this._ownPeerId,
      fromPlayerName: this._playerName,
      packLeader: this._ownPeerId,
    };
    this._sendToPeer(peerId, msg);
  }

  respondToPackInvite(targetPeerId: string, accept: boolean): void {
    const msg: PackInviteResponseMessage = {
      type: 'pack_invite_response',
      fromPeerId: this._ownPeerId,
      accept,
    };
    this._sendToPeer(targetPeerId, msg);
  }

  requestJoinPack(leaderPeerId: string): void {
    const msg: PackJoinRequestMessage = {
      type: 'pack_join_request',
      fromPeerId: this._ownPeerId,
      fromPlayerName: this._playerName,
      fromDinoId: this._dinoId,
    };
    useAppStore.getState().setPackLeaderPeerId(leaderPeerId);
    this._sendToPeer(leaderPeerId, msg);
  }

  respondToPackJoinRequest(targetPeerId: string, accept: boolean): void {
    const msg: PackJoinResponseMessage = {
      type: 'pack_join_response',
      fromPeerId: this._ownPeerId,
      accept,
    };
    this._sendToPeer(targetPeerId, msg);

    if (accept) {
      this._addPackMember(targetPeerId);
    }
  }

  kickFromPack(memberPeerId: string): void {
    this._removePackMember(memberPeerId);
    const msg: PackKickMessage = {
      type: 'pack_kick',
      targetPeerId: memberPeerId,
    };
    this._broadcast(msg);
  }

  leavePack(): void {
    const msg: PackLeaveMessage = {
      type: 'pack_leave',
      peerId: this._ownPeerId,
    };
    this._broadcast(msg);
    this._clearPack();
  }

  getPackMembers(): PackMemberEntry[] {
    return [...this._packMembers];
  }

  isPackLeader(): boolean {
    return this._isPackLeader;
  }

  private _addPackMember(peerId: string): void {
    const info = this._peerInfo.get(peerId);
    if (!info) return;
    if (this._packMembers.find(m => m.peerId === peerId)) return;

    this._packMembers.push({
      peerId,
      playerName: info.playerName,
      dinoId: info.dinoId,
    });
    useAppStore.getState().setPackMembers([...this._packMembers]);
    this._broadcastPackUpdate();
  }

  private _removePackMember(peerId: string): void {
    this._packMembers = this._packMembers.filter(m => m.peerId !== peerId);
    useAppStore.getState().setPackMembers(this._packMembers);
    this._broadcastPackUpdate();
  }

  private _broadcastPackUpdate(): void {
    const msg: PackMemberUpdateMessage = {
      type: 'pack_member_update',
      members: this._packMembers,
    };
    for (const member of this._packMembers) {
      if (member.peerId !== this._ownPeerId) {
        this._sendToPeer(member.peerId, msg);
      }
    }
    this.onPackMemberUpdate?.(this._packMembers);
  }

  private _clearPack(): void {
    this._packMembers = [];
    this._isPackLeader = false;
    useAppStore.getState().setPackRole('solo');
    useAppStore.getState().setPackMembers([]);
    useAppStore.getState().setPackLeaderPeerId(null);
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
    this._reconnectingTo.add(hostPeerId);
    const cleanup = () => this._reconnectingTo.delete(hostPeerId);
    return new Promise<void>((resolve, reject) => {
      const conn = this._ownPeer!.connect(hostPeerId, { reliable: true });

      const timeout = setTimeout(() => {
        reject(new Error('Connection to host timed out'));
      }, 10000);

      conn.on('data', (raw) => {
        this._handleMessage(conn.peer, raw as PeerMeshMessage);
      });

      conn.on('open', () => {
        clearTimeout(timeout);
        this._connections.set(conn.peer, conn);
        this._lastPeerHeartbeat.set(conn.peer, Date.now());
        const localChunk = this._getCurrentChunk();
        const handshake: PeerHandshakeMessage = {
          type: 'peer_handshake',
          peerId: this._ownPeerId,
          playerName: this._playerName,
          dinoId: this._dinoId,
          colors: this._colors,
          packCode: this._packCode,
          posX: PlayerPositionRef.x,
          posZ: PlayerPositionRef.z,
          chunkX: localChunk.x,
          chunkZ: localChunk.z,
          tick: 0,
        };
        this._sendToPeer(conn.peer, handshake);
        resolve();
      });

      conn.on('error', (err) => {
        clearTimeout(timeout);
        reject(err);
      });
    }).finally(cleanup);
  }

  private _getCurrentChunk(): { x: number; z: number } {
    const px = PlayerPositionRef.x;
    const pz = PlayerPositionRef.z;
    if (px !== 0 || pz !== 0) {
      return worldToChunk(px, pz);
    }
    return this._chunkInterest?.playerChunk ?? worldToChunk(0, 0);
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
      const localChunk = this._getCurrentChunk();
      const ack: PeerHandshakeAckMessage = {
        type: 'peer_handshake_ack',
        peerId: this._ownPeerId,
        playerName: this._playerName,
        dinoId: this._dinoId,
        colors: this._colors,
        packCode: this._packCode,
        posX: PlayerPositionRef.x,
        posZ: PlayerPositionRef.z,
        chunkX: localChunk.x,
        chunkZ: localChunk.z,
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
      case 'pack_invite':
        this._handlePackInvite(msg);
        break;
      case 'pack_invite_response':
        this._handlePackInviteResponse(msg);
        break;
      case 'pack_join_request':
        this._handlePackJoinRequest(msg);
        break;
      case 'pack_join_response':
        this._handlePackJoinResponse(msg);
        break;
      case 'pack_kick':
        this._handlePackKick(msg);
        break;
      case 'pack_member_update':
        this._handlePackMemberUpdate(msg);
        break;
      case 'pack_leave':
        this._handlePackLeave(msg);
        break;
      case 'npc_snapshot':
        this._handleNpcSnapshot(msg as any);
        break;
      case 'peer_disconnect':
        this._handlePeerDisconnect(msg as PeerDisconnectMessage);
        break;
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private _handleNpcSnapshot(msg: { tick: number; npcs: unknown[]; players: unknown[], edibleStates: Record<string, number> }): void {
    useAppStore.getState().setNetworkData(
      msg.npcs,
      msg.players,
      msg.tick,
      msg.edibleStates
    );
  }

  private _handlePeerDisconnect(msg: PeerDisconnectMessage): void {
    // Se o peer morreu E ainda não existe carcaça no NPCManager, gerar carcaça comestível.
    // Usa NPCManager.getNPC (não _carcassSpawned) para verificar existência real.
    const carcassId = `npc_${msg.peerId}_carcass`;
    if (msg.isDead && !NPCManager.getNPC(carcassId)) {
      const info = this._peerInfo.get(msg.peerId);
      NPCManager.spawnPlayerCarcass(msg.peerId, msg.posX, msg.posZ, msg.dinoId || 't-rex', msg.level || 1, info?.colors);
      useAppStore.getState().damageEdible(carcassId, 0);
    }

    // Remove peer (também limpa _carcassSpawned via _onPeerDisconnected)
    // para que reconexão com mesmo peerId não dispare falsa ressurreição.
    this._onPeerDisconnected(msg.peerId);
  }

  private _handleHandshake(peerId: string, msg: PeerHandshakeMessage): void {
    const existing = this._peerInfo.get(peerId);

    // Reentrada: se um peer com o mesmo nome (mas peerId diferente) já estava conectado,
    // remove a entrada antiga para evitar estado obsoleto (ex: jogador morreu, saiu e voltou).
    if (!existing) {
      for (const [oldPid, oldInfo] of this._peerInfo) {
        if (oldInfo.playerName === msg.playerName && oldPid !== peerId) {
          this._onPeerDisconnected(oldPid);
          break;
        }
      }

      this._peerInfo.set(peerId, {
        id: peerId,
        peerId,
        playerName: msg.playerName,
        dinoId: msg.dinoId,
        colors: msg.colors,
        packCode: msg.packCode,
        posX: msg.posX,
        posZ: msg.posZ,
        chunkX: msg.chunkX,
        chunkZ: msg.chunkZ,
        connectedAt: Date.now(),
      });
      this._notifyPeerListChanged();
      this._autoJoinByPackCode(peerId, msg.packCode);

      if (this._isFirstPeer) {
        const localChunk = this._getCurrentChunk();
        const ack: PeerHandshakeAckMessage = {
          type: 'peer_handshake_ack',
          peerId: this._ownPeerId,
          playerName: this._playerName,
          dinoId: this._dinoId,
          colors: this._colors,
          packCode: this._packCode,
          posX: PlayerPositionRef.x,
          posZ: PlayerPositionRef.z,
          chunkX: localChunk.x,
          chunkZ: localChunk.z,
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
              packCode: p.packCode,
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
        packCode: msg.packCode,
        posX: msg.posX,
        posZ: msg.posZ,
        chunkX: msg.chunkX,
        chunkZ: msg.chunkZ,
        connectedAt: Date.now(),
      });
      this._notifyPeerListChanged();
      this._autoJoinByPackCode(peerId, msg.packCode);
    }
  }

  private _handleRemoteEvent(msg: EventMessage): void {
    EventReplicator.receiveEvent(msg.event);
  }

  private _handlePlayerState(msg: PlayerStateMessage): void {
    const isNew = !this._remotePlayerStates.has(msg.peerId);
    const wasDead = this._remotePlayerStates.get(msg.peerId)?.isDead === true;

    this._remotePlayerStates.set(msg.peerId, msg);
    if (isNew) {
      this._notifyPeerListChanged();
    }
    this._bumpRemoteStateVersion();

    // Fallback PvP damage: se esta mensagem carrega dano para nós, aplica
    if (msg.damageToPeer && msg.damageToPeerId === this._ownPeerId) {
      const st = useAppStore.getState();
      if (!st.isDead) {
        st.takeDamage(msg.damageToPeer);
      }
    }

    // Ressurreição: peer que estava morto voltou à vida — remove carcaça, re-adiciona visual.
    // Só dispara se _carcassSpawned contém o peerId (marcador de sessão ativa).
    // _carcassSpawned é limpo em _onPeerDisconnected, então reconexão após
    // desconexão NÃO dispara falsa ressurreição.
    const carcassId = `npc_${msg.peerId}_carcass`;
    if (!msg.isDead && this._carcassSpawned.has(msg.peerId)) {
      this._carcassSpawned.delete(msg.peerId);
      NPCManager.removeCarcass(carcassId);
      useAppStore.getState().removeEdible(carcassId);
      return;
    }

    // Quando um peer remoto morre: spawna carcaça comestível imediatamente
    // e remove o estado remoto. A carcaça NPC executa a animação de morte
    // por conta própria (NPCDinosaurs NPCInstance → playAnimation('Death', false)).
    // Usa NPCManager.getNPC para verificar existência real (mais robusto que
    // _carcassSpawned, que é limpo na desconexão).
    if (msg.isDead && !wasDead && !NPCManager.getNPC(carcassId)) {
      this._carcassSpawned.add(msg.peerId);
      const info = this._peerInfo.get(msg.peerId);
      NPCManager.spawnPlayerCarcass(
        msg.peerId,
        msg.posX,
        msg.posZ,
        msg.dinoId ?? info?.dinoId ?? 't-rex',
        msg.level || 1,
        info?.colors
      );
      useAppStore.getState().damageEdible(carcassId, 0);
      this._remotePlayerStates.delete(msg.peerId);
      this._bumpRemoteStateVersion();
    }
  }

  private _bumpRemoteStateVersion(): void {
    useAppStore.getState().setRemotePlayerStateVersion(Date.now());
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
        packCode: p.packCode,
        posX: 0,
        posZ: 0,
        chunkX: p.chunkX,
        chunkZ: p.chunkZ,
        connectedAt: Date.now(),
      });

      this._autoJoinByPackCode(p.peerId, p.packCode);

      // Conecta diretamente ao peer
      const conn = this._ownPeer!.connect(p.peerId, { reliable: true });

      conn.on('data', (raw) => {
        this._handleMessage(p.peerId, raw as PeerMeshMessage);
      });

      conn.on('open', () => {
        this._connections.set(p.peerId, conn);
        this._lastPeerHeartbeat.set(p.peerId, Date.now());
        const localChunk = this._getCurrentChunk();
        const hs: PeerHandshakeMessage = {
          type: 'peer_handshake',
          peerId: this._ownPeerId,
          playerName: this._playerName,
          dinoId: this._dinoId,
          colors: this._colors,
          packCode: this._packCode,
          posX: PlayerPositionRef.x,
          posZ: PlayerPositionRef.z,
          chunkX: localChunk.x,
          chunkZ: localChunk.z,
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

  private _autoJoinByPackCode(peerId: string, theirPackCode: string): void {
    if (!this._packCode || this._packMembers.length > 0) return;
    if (theirPackCode !== this._packCode) return;
    if (this._isPackLeader) return;

    const info = this._peerInfo.get(peerId);
    if (!info) return;

    this.requestJoinPack(peerId);
  }

  // ── Pack Message Handlers ──

  private _handlePackInvite(msg: PackInviteMessage): void {
    if (this._packMembers.length > 0) return;
    useAppStore.getState().setPackLeaderPeerId(msg.packLeader);
    this.onPackInvite?.(msg.fromPeerId, msg.fromPlayerName);
  }

  private _handlePackInviteResponse(msg: PackInviteResponseMessage): void {
    if (!this._isPackLeader) return;

    if (msg.accept) {
      this._addPackMember(msg.fromPeerId);
      this.onPackInviteAccepted?.(msg.fromPeerId, this._peerInfo.get(msg.fromPeerId)?.playerName ?? '');
    }
  }

  private _handlePackJoinRequest(msg: PackJoinRequestMessage): void {
    if (!this._isPackLeader) return;
    // Auto-aceita: adiciona ao bando sem necessidade de aprovação
    this._addPackMember(msg.fromPeerId);
    this.respondToPackJoinRequest(msg.fromPeerId, true);
  }

  private _handlePackJoinResponse(msg: PackJoinResponseMessage): void {
    if (msg.accept) {
      // Usamos msg.fromPeerId como líder (já que ele aprovou)
      const leaderPeerId = msg.fromPeerId;
      useAppStore.getState().setPackLeaderPeerId(leaderPeerId);
    } else {
      useAppStore.getState().setPackLeaderPeerId(null);
    }
  }

  private _handlePackKick(msg: PackKickMessage): void {
    if (msg.targetPeerId !== this._ownPeerId) return;
    this._clearPack();
    this.onPackKicked?.();
  }

  private _handlePackMemberUpdate(msg: PackMemberUpdateMessage): void {
    this._packMembers = msg.members;
    const isMember = msg.members.some(m => m.peerId === this._ownPeerId);
    if (!isMember) {
      this._clearPack();
      this.onPackDisbanded?.();
      return;
    }
    useAppStore.getState().setPackMembers(msg.members);
    useAppStore.getState().setPackRole('member');
    const leader = msg.members.find(m => m.peerId !== this._ownPeerId);
    if (msg.members.length <= 1) {
      useAppStore.getState().setPackLeaderPeerId(msg.members[0]?.peerId ?? null);
    } else if (leader) {
      useAppStore.getState().setPackLeaderPeerId(leader.peerId);
    }
    this.onPackMemberUpdate?.(msg.members);
  }

  private _handlePackLeave(msg: PackLeaveMessage): void {
    if (this._isPackLeader) {
      this._removePackMember(msg.peerId);
      if (this._packMembers.length <= 1) {
        this._clearPack();
        this.onPackDisbanded?.();
      }
    } else {
      if (useAppStore.getState().packLeaderPeerId === msg.peerId) {
        this._clearPack();
        this.onPackDisbanded?.();
      } else {
        this._packMembers = this._packMembers.filter(m => m.peerId !== msg.peerId);
        if (this._packMembers.length <= 1) {
          this._clearPack();
          this.onPackDisbanded?.();
        } else {
          useAppStore.getState().setPackMembers(this._packMembers);
        }
      }
    }
  }

  private _onPeerDisconnected(peerId: string): void {
    this._connections.delete(peerId);
    this._peerInfo.delete(peerId);
    this._lastPeerHeartbeat.delete(peerId);
    this._remotePlayerStates.delete(peerId);
    this._carcassSpawned.delete(peerId);

    if (this._isPackLeader) {
      this._removePackMember(peerId);
      if (this._packMembers.length <= 1) {
        this._clearPack();
        this.onPackDisbanded?.();
      }
    } else if (useAppStore.getState().packLeaderPeerId === peerId) {
      this._clearPack();
    }

    this._notifyPeerListChanged();
  }

  private _onLocalChunkChanged(_oldPos: { x: number; z: number }, newPos: { x: number; z: number }): void {
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
  }

  private _isInInterestZone(peer: { chunkX: number; chunkZ: number; renderDistance?: number }): boolean {
    const myChunk = this._chunkInterest?.playerChunk ?? { x: 0, z: 0 };
    const dist = Math.abs(peer.chunkX - myChunk.x) + Math.abs(peer.chunkZ - myChunk.z);
    const myRadius = this._chunkInterest?.interestRadius ?? 2;
    const peerRadius = peer.renderDistance ?? 2;
    return dist <= myRadius || dist <= peerRadius;
  }

  reconcileConnections(): void {
    if (!this._chunkInterest) return;

    const peerIds = Array.from(this._peerInfo.keys());
    for (const pid of peerIds) {
      const info = this._peerInfo.get(pid);
      if (!info) continue;
      if (!this._isInInterestZone({ chunkX: info.chunkX, chunkZ: info.chunkZ })) {
        this._onPeerDisconnected(pid);
      }
    }
  }

  // ── Heartbeat ──

  private _startHeartbeat(): void {
    this._heartbeatTimer = setInterval(() => {
      const px = PlayerPositionRef.x;
      const pz = PlayerPositionRef.z;
      const chunk = worldToChunk(px, pz);
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

      // Auto-reconexão: non-host sem conexão com o host tenta reconectar
      if (!this._isFirstPeer && this._mode === 'global' && this._ownPeer) {
        const hostPeerId = GLOBAL_ROOM_CODE;
        if (!this._connections.has(hostPeerId) && !this._reconnectingTo.has(hostPeerId)) {
          this._connectToHostPeer(hostPeerId).catch(() => {
            /* falha silenciosa — retentativa no próximo heartbeat */
          });
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
