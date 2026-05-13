import type { NPCData } from '../../domain/models/NPCDinosaur';
import { getNPCScaleFactor } from '../../domain/models/NPCDinosaur';
import { NPCState } from '../../domain/models/NPCState';
import { DINOSAUR_ROSTER, type Diet } from '../../domain/models/DinosaurStats';
import type { IBehaviorStrategy } from '../../domain/interfaces/IBehaviorStrategy';
import type { IRandomProvider } from '../../domain/interfaces/IRandomProvider';
import { NpcBehaviorFactory } from '../../domain/strategies/factories/NpcBehaviorFactory';
import { npcAttackNPC, npcAttackPlayer, updateCombatTimers } from './CombatSystem';
import { PlayerPositionRef } from './PlayerPositionRef';
import { calculateCarcassNutritionByLevel, calculateInteractRadius, isInInteractionRange } from '../../domain/services/DinosaurService';
import type { IGameStateGateway } from './contracts/IGameStateGateway';
import type { IWorldQueryGateway, WorldEdiblePoint, WorldObstacle } from './contracts/IWorldQueryGateway';
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
  private strategyCache = new Map<Diet, IBehaviorStrategy>();
  private npcRandomCache = new Map<string, IRandomProvider>();
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
  private obstacleCache: WorldObstacle[] = [];
  private lastCacheChunkX = NaN;
  private lastCacheChunkZ = NaN;
  private lastPlayerDeadState = false;

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
    this.strategyCache.clear();
    this.npcRandomCache.clear();
    this.pendingDamageToPlayer = 0;
    this.hasPlayerSpawnPos = false;
    this.simulationTick = 0;
    this.lastCacheChunkX = NaN;
    this.lastCacheChunkZ = NaN;
    this.lastPlayerDeadState = false;
  }

  private getStrategyForNPC(npc: NPCData): IBehaviorStrategy {
    if (!this.strategyCache.has(npc.diet)) {
      this.strategyCache.set(npc.diet, this.behaviorFactory.createForSpecies(npc.speciesId, npc.diet));
    }
    return this.strategyCache.get(npc.diet)!;
  }

  private getNpcRandom(npcId: string): IRandomProvider {
    if (!this.npcRandomCache.has(npcId)) {
      this.npcRandomCache.set(
        npcId,
        new SeededRandomProvider(this.worldSeed).fork(npcId)
      );
    }
    return this.npcRandomCache.get(npcId)!;
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
      this.npcs.set(npc.id, {
        ...npc,
        stamina: npc.stamina ?? 100,
        maxStamina: npc.maxStamina ?? 100,
        isExhausted: npc.isExhausted ?? false,
        yVelocity: npc.yVelocity ?? 0,
        isGrounded: npc.isGrounded ?? true,
        jumpCooldown: npc.jumpCooldown ?? 0,
        searchRotationAngle: npc.searchRotationAngle ?? 0,
        searchTargetId: npc.searchTargetId ?? null,
      });
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

    const despawnedIds = this.despawnSystem.despawnFarNPCs({
      npcs: this.npcs,
      spawnedChunks: this.spawnedChunks,
      playerChunkX,
      playerChunkZ,
    });

    // Limpar recursos de NPCs despawnados
    for (const id of despawnedIds) {
      this.movementSystem.cleanupNpc(id);
      this.npcRandomCache.delete(id);
    }

    const playerDeathStateChanged = PlayerPositionRef.isDead !== this.lastPlayerDeadState;

    // Cache de obstáculos/edibles é rebuild ao trocar de chunk ou quando player morre/ressuscita.
    if (playerChunkX !== this.lastCacheChunkX || playerChunkZ !== this.lastCacheChunkZ || playerDeathStateChanged) {
      this.edibleCache = this.getEdiblePositions(playerX, playerZ, gameState, worldQuery);
      this.obstacleCache = worldQuery.getNearbyObstacles(playerX, playerZ, SPAWN_RADIUS + 1);
      this.lastCacheChunkX = playerChunkX;
      this.lastCacheChunkZ = playerChunkZ;
      this.lastPlayerDeadState = PlayerPositionRef.isDead;
    }

    const allNPCs = this.getActiveNPCs();
    const playerPos = { x: playerX, z: playerZ };

    for (const npc of allNPCs) {
      updateCombatTimers(npc, dt);

      // Se o player morreu, encerra imediatamente qualquer estado focado no player.
      // Isso evita ficar preso em one-shot/retaliação com alvo inválido.
      if (PlayerPositionRef.isDead) {
        const hadPlayerTarget = npc.huntingTargetId === 'player' || npc.fleeFromId === 'player';
        if (hadPlayerTarget) {
          npc.huntingTargetId = null;
          if (npc.fleeFromId === 'player') npc.fleeFromId = null;
          npc.retaliatePlayerTimer = 0;
          npc.retaliatePlayerPackTimer = 0;
          if (npc.state === NPCState.Hunting || npc.state === NPCState.Fleeing || npc.state === NPCState.Attacking) {
            npc.state = NPCState.Wandering;
            npc.animationIntent = 'Idle';
            npc.stateTimer = 0;
            npc.wanderTimer = 0;
          }
        }
      }

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
          if (npc.state === NPCState.Eating) {
            npc.state = NPCState.Wandering;
            npc.animationIntent = 'Idle';
            npc.stateTimer = 0;
            continue;
          }
          if (npc.state === NPCState.Attacking) {
            // Timer expirou — não força Wandering; o FSM decide
            // se retoma perseguição (alvo visível), busca (perdeu vista)
            // ou vagueia (sem alvo).
            npc.stateTimer = 0;
          } else {
            npc.stateTimer = 0;
          }
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
        obstacles: this.obstacleCache,
        playerPos,
        playerLevel,
        playerDiet,
        playerStrength,
        dt,
        random: this.getNpcRandom(npc.id)
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
        obstacles: this.obstacleCache,
      });

      if (!PlayerPositionRef.isDead && npc.state === NPCState.Hunting && npc.attackCooldown <= 0 && strategy.combatPolicy.shouldAttackPlayer(npc, playerLevel, playerDiet)) {
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

    // Expõe contagens de NPCs para o DebugPanel (apenas em DEV)
    if (import.meta.env.DEV) {
      let herbivoreCount = 0;
      let carnivoreCount = 0;
      for (const npc of this.npcs.values()) {
        if (npc.state === NPCState.Dead) continue;
        if (npc.diet === 'Herbivore') herbivoreCount++;
        else carnivoreCount++;
      }
      (window as Window & { dinoNpcCounts?: { herbivores: number; carnivores: number } }).dinoNpcCounts = {
        herbivores: herbivoreCount,
        carnivores: carnivoreCount,
      };
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

    // Carcaça do player: recurso finito, proporcional ao nível do player.
    if (PlayerPositionRef.isDead) {
      const remaining = gameState.getEdibleRemaining('player_carcass');
      if (remaining > 0) {
        const baseScale = calculateCarcassNutritionByLevel(PlayerPositionRef.level);
        result.push({
          x: PlayerPositionRef.x,
          z: PlayerPositionRef.z,
          id: 'player_carcass',
          type: 'Meat',
          scale: baseScale * remaining,
        });
      }
    }

    return result;
  }
}

export const NPCManager = new NPCManagerClass();
