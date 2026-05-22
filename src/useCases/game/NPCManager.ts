import type { NPCData } from '../../domain/models/NPCDinosaur';
import { getNPCScaleFactor, calculateDamage, createNPC } from '../../domain/models/NPCDinosaur';
import { NPCState } from '../../domain/models/NPCState';
import { DINOSAUR_ROSTER, type Diet } from '../../domain/models/DinosaurStats';
import type { IBehaviorStrategy } from '../../domain/interfaces/IBehaviorStrategy';
import type { IRandomProvider } from '../../domain/interfaces/IRandomProvider';
import { NpcBehaviorFactory } from '../../domain/strategies/factories/NpcBehaviorFactory';
import { npcAttackNPC, npcAttackPlayer, updateCombatTimers } from './CombatSystem';
import { PlayerPositionRef } from './PlayerPositionRef';
import { calculateBiteDamage, calculateCarcassNutritionByLevel, calculateInteractRadius, calculatePercentageDamage, isInInteractionRange } from '../../domain/services/DinosaurService';
import type { IGameStateGateway } from './contracts/IGameStateGateway';
import type { IWorldQueryGateway, WorldEdiblePoint, WorldObstacle } from './contracts/IWorldQueryGateway';
import { NPCSpawnSystem } from './systems/NPCSpawnSystem';
import { NPCDespawnSystem } from './systems/NPCDespawnSystem';
import { NPCFsmSystem } from './systems/NPCFsmSystem';
import { NPCMovementSystem } from './systems/NPCMovementSystem';
import { SeededRandomProvider } from '../../infrastructure/random/SeededRandomProvider';
import { EventBus, type GameEvent } from '../../infrastructure/network/EventBus';
import { PeerMesh } from '../../infrastructure/network/PeerMesh';
import { ChunkInterestManager } from '../../infrastructure/network/ChunkInterestManager';
import type { INPCManager } from '../../domain/interfaces/INPCManager';
import { useAppStore } from '../../store/useAppStore';

const CHUNK_SIZE = 50;
const DEFAULT_WORLD_SEED = 12345;

function getSpawnRadius(): number {
  return Math.max(2, useAppStore.getState().renderDistance);
}

// getDespawnRadius será usado no Sprint 2 ao integrar com NPCDespawnSystem
// function getDespawnRadius(): number { return getSpawnRadius() + 1; }

// Lookup O(1) — evita Array.find() no hot path
const dinoStatsMap: Record<string, import('../../domain/models/DinosaurStats').DinosaurStats> = {};
for (const d of DINOSAUR_ROSTER) dinoStatsMap[d.id] = d;

class NPCManagerClass implements INPCManager {
  private npcs: Map<string, NPCData> = new Map();
  private spawnedChunks: Set<string> = new Set();
  private behaviorFactory = new NpcBehaviorFactory();
  private strategyCache = new Map<Diet, IBehaviorStrategy>();
  private npcRandomCache = new Map<string, IRandomProvider>();
  private pendingDamageToPlayer = 0;
  private pendingRemoteDamage = new Map<string, number>();
  private isAuthority = true;
  private deterministicMode = false;
  private gameStateGateway: IGameStateGateway | null = null;
  private worldQueryGateway: IWorldQueryGateway | null = null;
  private worldSeed = DEFAULT_WORLD_SEED;
  private simulationTick = 0;
  private chunkInterestManager: ChunkInterestManager | null = null;

  private spawnSystem = new NPCSpawnSystem();
  private despawnSystem = new NPCDespawnSystem();
  private fsmSystem = new NPCFsmSystem();
  private movementSystem = new NPCMovementSystem();

  private edibleCache: WorldEdiblePoint[] = [];
  private obstacleCache: WorldObstacle[] = [];
  private lastCacheChunkX = NaN;
  private lastCacheChunkZ = NaN;
  private lastPlayerDeadState = false;

  // Remote players (clients connected via network)
  private remotePlayers: Array<{ id: string; posX: number; posZ: number; level: number; diet: Diet; scale: number; strength: number; collisionRadius: number; interactRadius: number }> = [];

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

  setDeterministicMode(enabled: boolean): void {
    this.deterministicMode = enabled;
  }

  setChunkInterestManager(mgr: ChunkInterestManager): void {
    this.chunkInterestManager = mgr;
  }

  consumeEventsFromBus(maxTick: number): void {
    const events = EventBus.consume(maxTick);
    for (const event of events) {
      this.applyEvent(event);
    }
    EventBus.prune(this.simulationTick);
  }

  private applyEvent(event: GameEvent): void {
    switch (event.type) {
      case 'npc_attack': {
        const npcId = event.data.npcId as string;
        const npc = this.npcs.get(npcId);
        if (npc && npc.health > 0) {
          npc.health = Math.max(0, npc.health - (event.data.damage as number));
          npc.isHit = true;
          npc.hitTimer = 0.3;
          if (npc.health <= 0) {
            npc.state = NPCState.Dead;
            npc.animationIntent = 'Death';
            EventBus.push({
              type: 'npc_died',
              tick: event.tick,
              originPeerId: event.originPeerId,
              data: { npcId: npc.id },
            });
          }
        }
        break;
      }
      case 'npc_died': {
        const deadId = event.data.npcId as string;
        const dead = this.npcs.get(deadId);
        if (dead && dead.state !== NPCState.Dead) {
          dead.health = 0;
          dead.state = NPCState.Dead;
          dead.animationIntent = 'Death';
        }
        break;
      }
      case 'food_consumed': {
        const foodId = event.data.foodId as string;
        if (this.gameStateGateway) {
          this.gameStateGateway.damageEdible(foodId, 1);
        }
        break;
      }
      case 'player_chunk': {
        if (this.chunkInterestManager) {
          this.chunkInterestManager.updatePeerChunk(
            event.data.peerId as string,
            event.data.chunkX as number,
            event.data.chunkZ as number
          );
        }
        break;
      }
      case 'player_attacked': {
        const targetPeerId = event.data.targetPeerId as string;
        const damage = event.data.damage as number;
        if (targetPeerId === PeerMesh.getOwnPeerId()) {
          useAppStore.getState().takeDamage(damage);
        }
        break;
      }
    }
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
    this.invalidateNpcCache();
    this.spawnedChunks.clear();
    this.strategyCache.clear();
    this.npcRandomCache.clear();
    this.pendingDamageToPlayer = 0;
    this.pendingRemoteDamage.clear();
    this.hasPlayerSpawnPos = false;
    this.simulationTick = 0;
    this.lastCacheChunkX = NaN;
    this.lastCacheChunkZ = NaN;
    this.lastPlayerDeadState = false;
    EventBus.clear();
    this.deterministicMode = false;
  }

  spawnPlayerCarcass(peerId: string, posX: number, posZ: number, dinoId: string, level: number): void {
    const carcassId = `npc_${peerId}_carcass`;
    const stats = dinoStatsMap[dinoId];
    if (!stats) return;

    const fakeDeadNPC = createNPC(carcassId, stats, level, posX, posZ, 'carcass_chunk');
    fakeDeadNPC.health = 0;
    fakeDeadNPC.state = NPCState.Dead;
    
    this.npcs.set(carcassId, fakeDeadNPC);
    this.invalidateNpcCache();
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

  private npcCacheDirty = false;

  private invalidateNpcCache(): void {
    this.npcCacheDirty = true;
  }

  setAuthority(isAuthority: boolean): void {
    this.isAuthority = isAuthority;
  }

  getActiveNPCs(): NPCData[] {
    if (this.npcCacheDirty || !this.activeNPCsCache) {
      this.activeNPCsCache = Array.from(this.npcs.values());
      this.npcCacheDirty = false;
    }
    return this.activeNPCsCache;
  }

  // Cache fields
  private activeNPCsCache: NPCData[] | null = null;

  getSimulationTick(): number {
    return this.simulationTick;
  }

  setRemotePlayers(
    players: Array<{ id: string; posX: number; posZ: number; level: number; diet: Diet; scale: number; strength: number; collisionRadius: number; interactRadius: number }>
  ): void {
    this.remotePlayers = players;
  }

  getRemotePlayers(): typeof this.remotePlayers {
    return this.remotePlayers;
  }

  getNPC(id: string): NPCData | undefined {
    return this.npcs.get(id);
  }

  /**
   * Processa ataque de um cliente contra NPCs próximos.
   * Usa os stats do cliente (não do host) para calcular raio de interação.
   * Define huntingTargetId para o ID do cliente remoto que atacou.
   */
  processClientAttack(
    posX: number, posZ: number,
    level: number, strength: number,
    interactRadius: number,
    clientId: string
  ): boolean {
    const allNPCs = this.getActiveNPCs();
    for (const target of allNPCs) {
      if (target.state === NPCState.Dead) continue;

      const targetStats = dinoStatsMap[target.speciesId];
      if (!targetStats) continue;

      const targetScale = getNPCScaleFactor(target.level, targetStats);
      const targetRadius = targetStats.collisionRadius * targetScale;

      if (!isInInteractionRange(posX, posZ, target.posX, target.posZ, interactRadius, targetRadius)) continue;

      const damage = calculateDamage(strength, level);
      target.health = Math.max(0, target.health - damage);
      target.isHit = true;
      target.hitTimer = 0.3;

      if (target.diet === 'Carnivore') {
        target.retaliatePlayerTimer = 6.0;
      }
      if (target.diet === 'Herbivore') {
        target.retaliatePlayerPackTimer = 6.0;
      }

      target.huntingTargetId = clientId;
      target.fleeFromId = null;
      target.state = NPCState.Hunting;
      target.animationIntent = 'Run';
      target.stateTimer = 0;

      const died = target.health <= 0;
      if (died) {
        target.state = NPCState.Dead;
        target.animationIntent = 'Death';
      }

      return true;
    }
    return false;
  }

  /**
   * Processa ação de comer de um cliente contra um edible ou carcaça.
   * Usa a posição do cliente (posX/posZ) para buscar edíveis próximos.
   */
  processClientEat(
    targetId: string,
    playerLevel: number,
    playerStrength: number,
    posX: number,
    posZ: number
  ): void {
    if (!this.gameStateGateway) return;

    const remaining = this.gameStateGateway.getEdibleRemaining(targetId);
    if (remaining <= 0) return;

    // Get initial size based on target type
    let initialSize = 1.0;

    if (targetId.startsWith('npc_')) {
      const npc = this.npcs.get(targetId);
      if (npc) {
        initialSize = calculateCarcassNutritionByLevel(npc.level);
      }
    } else if (targetId === 'player_carcass') {
      initialSize = calculateCarcassNutritionByLevel(PlayerPositionRef.level);
    } else {
      // Static edible: scale is the initial size — use client position, not host
      const gateways = this.getGateways();
      if (gateways) {
        const worldQuery = gateways.worldQuery;
        const nearby = worldQuery.getNearbyEdibles(posX, posZ, 1);
        const target = nearby.find(e => e.id === targetId);
        if (target) {
          initialSize = target.scale;
        }
      }
    }

    const currentAbsoluteSize = initialSize * remaining;
    const biteDamage = calculateBiteDamage(playerStrength, playerLevel);
    const percentageDamage = calculatePercentageDamage(biteDamage, initialSize, currentAbsoluteSize);

    this.gameStateGateway.damageEdible(targetId, percentageDamage);
  }

  consumePlayerDamage(): number {
    const dmg = this.pendingDamageToPlayer;
    this.pendingDamageToPlayer = 0;
    return dmg;
  }

  consumeRemoteDamage(clientId: string): number {
    const dmg = this.pendingRemoteDamage.get(clientId) ?? 0;
    if (dmg > 0) this.pendingRemoteDamage.delete(clientId);
    return dmg;
  }

  hasPendingRemoteDamage(clientId: string): boolean {
    return (this.pendingRemoteDamage.get(clientId) ?? 0) > 0;
  }

  setNPCsFromNetwork(data: NPCData[]): void {
    // Diff approach: update changed NPCs in-place, add new ones, remove stale ones
    // This avoids frequent Map.clear + re-populate every frame
    const incomingIds = new Set<string>();
    let changed = false;

    for (const npc of data) {
      incomingIds.add(npc.id);
      const existing = this.npcs.get(npc.id);
      if (!existing) {
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
        changed = true;
      } else if (
        existing.posX !== npc.posX || existing.posZ !== npc.posZ ||
        existing.rotY !== npc.rotY || existing.state !== npc.state ||
        existing.health !== npc.health || existing.isHit !== npc.isHit ||
        existing.animationIntent !== npc.animationIntent
      ) {
        // Update in-place to preserve object reference in cached arrays
        Object.assign(existing, npc);
        existing.stamina = npc.stamina ?? 100;
        existing.maxStamina = npc.maxStamina ?? 100;
        existing.isExhausted = npc.isExhausted ?? false;
        existing.yVelocity = npc.yVelocity ?? 0;
        existing.isGrounded = npc.isGrounded ?? true;
        existing.jumpCooldown = npc.jumpCooldown ?? 0;
        existing.searchRotationAngle = npc.searchRotationAngle ?? 0;
        existing.searchTargetId = npc.searchTargetId ?? null;
      }
    }

    // Remove NPCs that disappeared from the snapshot
    for (const [id] of this.npcs) {
      if (!incomingIds.has(id)) {
        this.npcs.delete(id);
        changed = true;
      }
    }

    if (changed) this.invalidateNpcCache();
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

    // Consome eventos do EventBus antes de simular.
    // Em modo determinístico, limita pelo tick atual; caso contrário, consome todos.
    const maxConsumeTick = this.deterministicMode ? this.simulationTick : Infinity;
    this.consumeEventsFromBus(maxConsumeTick);

    const playerChunkX = Math.floor(playerX / CHUNK_SIZE);
    const playerChunkZ = Math.floor(playerZ / CHUNK_SIZE);
    const spawnRadius = getSpawnRadius();

    for (let cx = -spawnRadius; cx <= spawnRadius; cx++) {
      for (let cz = -spawnRadius; cz <= spawnRadius; cz++) {
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

    // Spawn NPCs around remote players too (for P2P)
    for (const rp of this.remotePlayers) {
      if (rp.id.startsWith('client_')) {
        const rpChunkX = Math.floor(rp.posX / CHUNK_SIZE);
        const rpChunkZ = Math.floor(rp.posZ / CHUNK_SIZE);
        for (let cx = -1; cx <= 1; cx++) {
          for (let cz = -1; cz <= 1; cz++) {
            this.spawnSystem.spawnNPCsForChunk({
              chunkX: rpChunkX + cx,
              chunkZ: rpChunkZ + cz,
              npcs: this.npcs,
              spawnedChunks: this.spawnedChunks,
              hasPlayerSpawnPos: this.hasPlayerSpawnPos,
              playerSpawnX: this.playerSpawnX,
              playerSpawnZ: this.playerSpawnZ,
              worldQuery,
            });
          }
        }
      }
    }

    const despawnedIds = this.despawnSystem.despawnFarNPCs({
      npcs: this.npcs,
      spawnedChunks: this.spawnedChunks,
      playerChunkX,
      playerChunkZ,
      remoteChunks: this.remotePlayers
        .filter(rp => rp.id.startsWith('client_'))
        .map(rp => ({ x: Math.floor(rp.posX / CHUNK_SIZE), z: Math.floor(rp.posZ / CHUNK_SIZE) })),
    });

    // Invalida cache depois de spawn/despawn (pode ter adicionado/removido NPCs)
    this.invalidateNpcCache();

    // Limpar recursos de NPCs despawnados
    for (const id of despawnedIds) {
      this.movementSystem.cleanupNpc(id);
      this.npcRandomCache.delete(id);
    }

    const playerDeathStateChanged = PlayerPositionRef.isDead !== this.lastPlayerDeadState;

    // Cache de obstáculos/edibles é rebuild ao trocar de chunk ou quando player morre/ressuscita.
    // Também inclui areas de remote players para que NPCs simulados perto deles tenham dados corretos.
    if (playerChunkX !== this.lastCacheChunkX || playerChunkZ !== this.lastCacheChunkZ || playerDeathStateChanged) {
      this.edibleCache = this.getEdiblePositions(playerX, playerZ, gameState, worldQuery);
      this.obstacleCache = worldQuery.getNearbyObstacles(playerX, playerZ, getSpawnRadius() + 1);

      // Merge edibles/obstacles from remote player areas
      for (const rp of this.remotePlayers) {
        if (!rp.id.startsWith('client_')) continue;
        const rpObstacles = worldQuery.getNearbyObstacles(rp.posX, rp.posZ, 2);
        for (const obs of rpObstacles) {
          if (!this.obstacleCache.some(o => o.x === obs.x && o.z === obs.z)) {
            this.obstacleCache.push(obs);
          }
        }
        const rpEdibles = this.getEdiblePositions(rp.posX, rp.posZ, gameState, worldQuery);
        for (const ed of rpEdibles) {
          if (!this.edibleCache.some(e => e.id === ed.id)) {
            this.edibleCache.push(ed);
          }
        }
      }

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
          this.invalidateNpcCache();
        }
        continue;
      }

      const stats = dinoStatsMap[npc.speciesId];
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
            // Timer expirou — intercepta para client-target antes do FSM decidir
            if (npc.huntingTargetId?.startsWith('client_')) {
              const rp = this.remotePlayers.find(r => r.id === npc.huntingTargetId);
              if (rp) {
                // Cliente remoto ainda conectado — volta a perseguir
                npc.state = NPCState.Hunting;
                npc.animationIntent = 'Run';
                npc.targetX = rp.posX;
                npc.targetZ = rp.posZ;
              } else {
                // Cliente desconectou — volta a vagar
                npc.state = NPCState.Wandering;
                npc.huntingTargetId = null;
                npc.animationIntent = 'Idle';
              }
              npc.stateTimer = 0;
              continue;
            }
            // Não força Wandering; o FSM decide
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

      // Skip host attack check if NPC is hunting a specific remote player
      const isHuntingRemote = npc.huntingTargetId?.startsWith('client_');
      if (!isHuntingRemote && !PlayerPositionRef.isDead && npc.state === NPCState.Hunting && npc.attackCooldown <= 0 && strategy.combatPolicy.shouldAttackPlayer(npc, playerLevel, playerDiet)) {
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

      // NPC vs Remote Player (clients conectados via rede)
      if (!npc.isExhausted && npc.state === NPCState.Hunting && npc.attackCooldown <= 0) {
        const npcScale = getNPCScaleFactor(npc.level, stats);
        const nInteractRadius = calculateInteractRadius(stats.interactRadius, npcScale);
        for (const rp of this.remotePlayers) {
          if (rp.id === 'host') continue;
          // If NPC is hunting a specific remote player, only attack that one
          if (npc.huntingTargetId?.startsWith('client_') && npc.huntingTargetId !== rp.id) continue;
          const targetRadius = rp.collisionRadius * rp.scale;
          if (isInInteractionRange(npc.posX, npc.posZ, rp.posX, rp.posZ, nInteractRadius, targetRadius)) {
            const dmg = npcAttackPlayer(npc, rp.posX, rp.posZ, rp.scale);
            if (dmg > 0) {
              const existing = this.pendingRemoteDamage.get(rp.id) ?? 0;
              this.pendingRemoteDamage.set(rp.id, existing + dmg);
              break;
            }
          }
        }
      }

      // Post-processing: resolve movement target for client-hunting NPCs
      // (the FSM doesn't understand 'client_' prefix, so we re-target here)
      if (npc.huntingTargetId?.startsWith('client_')) {
        const rp = this.remotePlayers.find(r => r.id === npc.huntingTargetId);
        if (rp) {
          npc.targetX = rp.posX;
          npc.targetZ = rp.posZ;
        } else {
          // Remote player disconnected — go back to wandering
          npc.huntingTargetId = null;
          npc.state = NPCState.Wandering;
          npc.animationIntent = 'Idle';
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

    for (const edible of worldQuery.getNearbyEdibles(playerX, playerZ, getSpawnRadius())) {
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
          const stats = dinoStatsMap[npc.speciesId];
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
