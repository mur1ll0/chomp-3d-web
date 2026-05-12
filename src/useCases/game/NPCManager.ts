import type { NPCData } from '../../domain/models/NPCDinosaur';
import { getNPCScaleFactor } from '../../domain/models/NPCDinosaur';
import { NPCState } from '../../domain/models/NPCState';
import { DINOSAUR_ROSTER, type Diet } from '../../domain/models/DinosaurStats';
import type { IBehaviorStrategy } from '../../domain/interfaces/IBehaviorStrategy';
import { NpcBehaviorFactory } from '../../domain/strategies/factories/NpcBehaviorFactory';
import { npcAttackNPC, npcAttackPlayer, updateCombatTimers } from './CombatSystem';
import { PlayerPositionRef } from './PlayerPositionRef';
import { calculateInteractRadius, isInInteractionRange } from '../../domain/services/DinosaurService';
import type { IGameStateGateway } from './contracts/IGameStateGateway';
import type { IWorldQueryGateway, WorldEdiblePoint } from './contracts/IWorldQueryGateway';
import { NPCSpawnSystem } from './systems/NPCSpawnSystem';
import { NPCDespawnSystem } from './systems/NPCDespawnSystem';
import { NPCFsmSystem } from './systems/NPCFsmSystem';
import { NPCMovementSystem } from './systems/NPCMovementSystem';
import { SeededRandomProvider } from '../../infrastructure/random/SeededRandomProvider';

const CHUNK_SIZE = 50;
const SPAWN_RADIUS = 2;
const DEFAULT_WORLD_SEED = 12345;

class NPCManagerClass {
  private npcs: Map<string, NPCData> = new Map();
  private spawnedChunks: Set<string> = new Set();
  private behaviorFactory = new NpcBehaviorFactory();
  private pendingDamageToPlayer = 0;
  private isAuthority = true;
  private gameStateGateway: IGameStateGateway | null = null;
  private worldQueryGateway: IWorldQueryGateway | null = null;
  private worldSeed = DEFAULT_WORLD_SEED;
  private simulationTick = 0;

  private spawnSystem = new NPCSpawnSystem();
  private despawnSystem = new NPCDespawnSystem();
  private fsmSystem = new NPCFsmSystem();
  private movementSystem = new NPCMovementSystem();

  private edibleCache: WorldEdiblePoint[] = [];

  private playerSpawnX = 0;
  private playerSpawnZ = 0;
  private hasPlayerSpawnPos = false;

  configureGateways(gameStateGateway: IGameStateGateway, worldQueryGateway: IWorldQueryGateway): void {
    this.gameStateGateway = gameStateGateway;
    this.worldQueryGateway = worldQueryGateway;
  }

  configureWorldSeed(worldSeed: number): void {
    this.worldSeed = worldSeed;
  }

  private getGateways(): { gameState: IGameStateGateway; worldQuery: IWorldQueryGateway } | null {
    if (!this.gameStateGateway || !this.worldQueryGateway) {
      return null;
    }

    return {
      gameState: this.gameStateGateway,
      worldQuery: this.worldQueryGateway,
    };
  }

  reset(): void {
    this.npcs.clear();
    this.spawnedChunks.clear();
    this.pendingDamageToPlayer = 0;
    this.hasPlayerSpawnPos = false;
    this.simulationTick = 0;
  }

  private getStrategyForNPC(npc: NPCData): IBehaviorStrategy {
    return this.behaviorFactory.createForSpecies(npc.speciesId, npc.diet);
  }

  setAuthority(isAuthority: boolean): void {
    this.isAuthority = isAuthority;
  }

  getActiveNPCs(): NPCData[] {
    return Array.from(this.npcs.values());
  }

  getNPC(id: string): NPCData | undefined {
    return this.npcs.get(id);
  }

  consumePlayerDamage(): number {
    const dmg = this.pendingDamageToPlayer;
    this.pendingDamageToPlayer = 0;
    return dmg;
  }

  setNPCsFromNetwork(data: NPCData[]): void {
    this.npcs.clear();
    for (const npc of data) {
      this.npcs.set(npc.id, npc);
    }
  }

  update(
    delta: number,
    playerX: number,
    playerZ: number,
    playerLevel: number,
    playerScale: number,
    playerDiet: Diet,
    playerStrength: number
  ): void {
    if (!this.isAuthority) return;
    const gateways = this.getGateways();
    if (!gateways) return;
    const { gameState, worldQuery } = gateways;
    this.simulationTick++;

    const dt = Math.min(delta, 0.05);

    if (!this.hasPlayerSpawnPos) {
      this.playerSpawnX = playerX;
      this.playerSpawnZ = playerZ;
      this.hasPlayerSpawnPos = true;
    }

    const playerChunkX = Math.floor(playerX / CHUNK_SIZE);
    const playerChunkZ = Math.floor(playerZ / CHUNK_SIZE);

    for (let cx = -SPAWN_RADIUS; cx <= SPAWN_RADIUS; cx++) {
      for (let cz = -SPAWN_RADIUS; cz <= SPAWN_RADIUS; cz++) {
        this.spawnSystem.spawnNPCsForChunk({
          chunkX: playerChunkX + cx,
          chunkZ: playerChunkZ + cz,
          npcs: this.npcs,
          spawnedChunks: this.spawnedChunks,
          hasPlayerSpawnPos: this.hasPlayerSpawnPos,
          playerSpawnX: this.playerSpawnX,
          playerSpawnZ: this.playerSpawnZ,
          worldQuery,
        });
      }
    }

    this.despawnSystem.despawnFarNPCs({
      npcs: this.npcs,
      spawnedChunks: this.spawnedChunks,
      playerChunkX,
      playerChunkZ,
    });

    this.edibleCache = this.getEdiblePositions(playerX, playerZ, gameState, worldQuery);

    const allNPCs = this.getActiveNPCs();
    const playerPos = { x: playerX, z: playerZ };

    for (const npc of allNPCs) {
      updateCombatTimers(npc, dt);

      if (npc.state === NPCState.Dead) {
        const remaining = gameState.getEdibleRemaining(npc.id);
        if (remaining <= 0) {
          this.npcs.delete(npc.id);
        }
        continue;
      }

      const stats = DINOSAUR_ROSTER.find(d => d.id === npc.speciesId);
      if (!stats) continue;

      const strategy = this.getStrategyForNPC(npc);

      // One-shot states (Eating/Attacking) can be interrupted by threat-based fleeing.
      // This guarantees that flee has priority over current action.
      const isOneShotStateActive =
        npc.stateTimer > dt &&
        (npc.state === NPCState.Eating || npc.state === NPCState.Attacking);

      if (isOneShotStateActive && npc.diet === 'Carnivore') {
        const threatId = strategy.threatPolicy.evaluateThreat(npc, {
          nearbyNPCs: allNPCs,
          playerPos,
          playerLevel,
          playerDiet,
          playerStrength,
        });

        if (threatId) {
          npc.state = NPCState.Fleeing;
          npc.fleeFromId = threatId;
          npc.huntingTargetId = null;
          npc.animationIntent = 'Run';
          npc.stateTimer = 0;

          let threatX = playerPos.x;
          let threatZ = playerPos.z;
          if (threatId !== 'player') {
            const threat = this.npcs.get(threatId);
            if (threat) {
              threatX = threat.posX;
              threatZ = threat.posZ;
            }
          }

          const fleeTarget = strategy.movementPolicy.pickFleeDestination({
            npc,
            threatX,
            threatZ,
          });
          npc.targetX = fleeTarget.x;
          npc.targetZ = fleeTarget.z;
        }
      }

      if (npc.stateTimer > 0) {
        if (npc.stateTimer <= dt) {
          if (npc.state === NPCState.Eating || npc.state === NPCState.Attacking) {
            npc.state = NPCState.Wandering;
            npc.animationIntent = 'Idle';
            npc.stateTimer = 0;
            // Garante transição de estado entre ações one-shot e evita
            // reentrada no mesmo tick que impede o replay da animação.
            continue;
          }
          npc.stateTimer = 0;
        } else if (npc.state === NPCState.Eating || npc.state === NPCState.Attacking) {
          continue;
        }
      }

      this.fsmSystem.updateFSM({
        npc,
        stats,
        strategy,
        allNPCs,
        ediblePositions: this.edibleCache,
        playerPos,
        playerLevel,
        playerDiet,
        playerStrength,
        dt,
        random: new SeededRandomProvider(this.worldSeed)
          .fork(npc.id)
          .fork(this.simulationTick)
          .fork('fsm'),
        npcsById: this.npcs,
        gameState,
      });

      this.movementSystem.updateMovement({
        npc,
        stats,
        strategy,
        dt,
        npcsById: this.npcs,
        worldQuery,
      });

      if (npc.state === NPCState.Hunting && npc.attackCooldown <= 0 && strategy.combatPolicy.shouldAttackPlayer(npc, playerLevel, playerDiet)) {
        const npcScale = getNPCScaleFactor(npc.level, stats);
        const interactRadius = calculateInteractRadius(stats.interactRadius, npcScale);
        const targetRadius = PlayerPositionRef.collisionRadius * PlayerPositionRef.scale;

        if (isInInteractionRange(npc.posX, npc.posZ, playerX, playerZ, interactRadius, targetRadius)) {
          const dmg = npcAttackPlayer(npc, playerX, playerZ, playerScale);
          if (dmg > 0) {
            this.pendingDamageToPlayer += dmg;
          }
        }
      }

      if (npc.state === NPCState.Hunting && npc.attackCooldown <= 0) {
        for (const target of allNPCs) {
          if (target.id === npc.id || target.state === NPCState.Dead) continue;
          if (!strategy.combatPolicy.canAttackNpcTarget(npc, target)) continue;
          npcAttackNPC(npc, target);
          if (npc.attackCooldown > 0) break;
        }
      }
    }
  }

  private getEdiblePositions(
    playerX: number,
    playerZ: number,
    gameState: IGameStateGateway,
    worldQuery: IWorldQueryGateway
  ): WorldEdiblePoint[] {
    const result: WorldEdiblePoint[] = [];

    for (const edible of worldQuery.getNearbyEdibles(playerX, playerZ, SPAWN_RADIUS)) {
      const remaining = gameState.getEdibleRemaining(edible.id);
      if (remaining > 0) {
        result.push({
          ...edible,
          scale: edible.scale * remaining,
        });
      }
    }

    for (const npc of this.npcs.values()) {
      if (npc.state === NPCState.Dead) {
        const remaining = gameState.getEdibleRemaining(npc.id);
        if (remaining > 0) {
          const stats = DINOSAUR_ROSTER.find(d => d.id === npc.speciesId);
          const baseScale = stats ? getNPCScaleFactor(npc.level, stats) : 1.0;

          result.push({
            x: npc.posX,
            z: npc.posZ,
            id: npc.id,
            type: 'Meat',
            scale: baseScale * 4.0 * remaining,
          });
        }
      }
    }

    return result;
  }
}

export const NPCManager = new NPCManagerClass();
