import type { GameEvent } from './EventBus';

// ── Tipos legados (PeerHost/PeerClient/PeerSession) — serão removidos na Sprint 4 ──

export interface JoinMessage {
  type: 'join';
  playerName: string;
  dinoId: string;
  dinoColors: Record<string, string>;
}

export interface InputMessage {
  type: 'input';
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
}

export interface LeaveMessage {
  type: 'leave';
}

export interface ClientListMessage {
  type: 'client_list';
  clients: Array<{ id: string; peerId: string; playerName: string; joinedAt: number }>;
}

export interface HostTransferMessage {
  type: 'host_transfer';
  newHostClientId: string;
  newHostPeerId: string;
}

export interface HostTransferAckMessage {
  type: 'host_transfer_ack';
  clientId: string;
}

export type ClientMessage = JoinMessage | InputMessage | LeaveMessage | HostTransferAckMessage;

export interface JoinAckMessage {
  type: 'join_ack';
  clientId: string;
  worldSeed: number;
  sessionCode: string;
}

export interface PlayerStateSnapshot {
  id: string;
  name: string;
  dinoId: string;
  dinoColors: Record<string, string>;
  posX: number;
  posY: number;
  posZ: number;
  rotY: number;
  level: number;
  health: number;
  maxHealth: number;
  isDead: boolean;
  animationIntent: string;
}

export interface SnapshotMessage {
  type: 'snapshot';
  tick: number;
  npcs: unknown[];
  players: PlayerStateSnapshot[];
  edibleStates: Record<string, number>;
}

export interface PlayerJoinedMessage {
  type: 'player_joined';
  playerState: PlayerStateSnapshot;
}

export interface PlayerLeftMessage {
  type: 'player_left';
  clientId: string;
}

export interface ErrorMessage {
  type: 'error';
  message: string;
}

export type ServerMessage = JoinAckMessage | SnapshotMessage | PlayerJoinedMessage | PlayerLeftMessage | ErrorMessage | ClientListMessage | HostTransferMessage;

// ── Novas mensagens simétricas P2P (PeerMesh) ──

export interface PeerHandshakeMessage {
  type: 'peer_handshake';
  peerId: string;
  playerName: string;
  dinoId: string;
  colors: Record<string, string>;
  chunkX: number;
  chunkZ: number;
  tick: number;
}

export interface PeerHandshakeAckMessage {
  type: 'peer_handshake_ack';
  peerId: string;
  playerName: string;
  dinoId: string;
  colors: Record<string, string>;
  chunkX: number;
  chunkZ: number;
  tick: number;
}

export interface EventMessage {
  type: 'event';
  event: GameEvent;
}

export interface PlayerStateMessage {
  type: 'player_state';
  peerId: string;
  posX: number;
  posY: number;
  posZ: number;
  rotY: number;
  health: number;
  maxHealth: number;
  isDead: boolean;
  animationIntent: string;
  level: number;
  scale: number;
}

export interface HeartbeatMessage {
  type: 'heartbeat';
  chunkX: number;
  chunkZ: number;
  tick: number;
  renderDistance: number;
}

export interface PeerListMessage {
  type: 'peer_list';
  peers: Array<{
    peerId: string;
    playerName: string;
    dinoId: string;
    colors: Record<string, string>;
    chunkX: number;
    chunkZ: number;
  }>;
}

export interface EventHistoryRequestMessage {
  type: 'event_history_request';
  sinceTick: number;
  requesterPeerId: string;
}

export interface EventHistoryResponseMessage {
  type: 'event_history_response';
  events: GameEvent[];
  targetPeerId: string;
}

export type PeerMeshMessage =
  | PeerHandshakeMessage
  | PeerHandshakeAckMessage
  | EventMessage
  | PlayerStateMessage
  | HeartbeatMessage
  | PeerListMessage
  | EventHistoryRequestMessage
  | EventHistoryResponseMessage;
