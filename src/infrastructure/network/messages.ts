import type { NPCData } from '../../domain/models/NPCDinosaur';

// ── Client → Host ──

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

// ── Host → Client ──

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
  npcs: NPCData[];
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
