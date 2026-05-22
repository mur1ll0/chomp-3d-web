import type { NPCData } from '../models/NPCDinosaur';
import type { IGameStateGateway } from '../../useCases/game/contracts/IGameStateGateway';
import type { IWorldQueryGateway } from '../../useCases/game/contracts/IWorldQueryGateway';
import type { Diet } from '../models/DinosaurStats';
import type { ChunkInterestManager } from '../../infrastructure/network/ChunkInterestManager';

export interface INPCManager {
  configureGateways(gameStateGateway: IGameStateGateway, worldQueryGateway: IWorldQueryGateway): void;
  configureWorldSeed(worldSeed: number): void;
  reset(): void;

  getActiveNPCs(): NPCData[];
  getSimulationTick(): number;
  getNPC(id: string): NPCData | undefined;

  setAuthority(isAuthority: boolean): void;
  setDeterministicMode(enabled: boolean): void;
  setChunkInterestManager(mgr: ChunkInterestManager): void;

  setRemotePlayers(players: Array<{
    id: string; posX: number; posZ: number; level: number;
    diet: Diet; scale: number; strength: number;
    collisionRadius: number; interactRadius: number;
  }>): void;
  getRemotePlayers(): Array<{
    id: string; posX: number; posZ: number; level: number;
    diet: Diet; scale: number; strength: number;
    collisionRadius: number; interactRadius: number;
  }>;

  processClientAttack(posX: number, posZ: number, level: number, strength: number, interactRadius: number, clientId: string): boolean;
  processClientEat(targetId: string, playerLevel: number, playerStrength: number, posX: number, posZ: number): void;

  consumePlayerDamage(): number;
  consumeRemoteDamage(clientId: string): number;
  hasPendingRemoteDamage(clientId: string): boolean;

  setNPCsFromNetwork(data: NPCData[]): void;

  update(delta: number, playerX: number, playerZ: number, playerLevel: number, playerScale: number, playerDiet: Diet, playerStrength: number): void;
  consumeEventsFromBus(maxTick: number): void;
  spawnPlayerCarcass(peerId: string, posX: number, posZ: number, dinoId: string, level: number): void;
}
