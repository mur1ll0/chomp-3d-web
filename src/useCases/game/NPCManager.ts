import type { NPCData } from '../../domain/models/NPCDinosaur';
import { createNPC, getNPCScaleFactor } from '../../domain/models/NPCDinosaur';
import { NPCState } from '../../domain/models/NPCState';
import { DINOSAUR_ROSTER } from '../../domain/models/DinosaurStats';
import type { DinosaurStats } from '../../domain/models/DinosaurStats';
import type { IBehaviorStrategy } from '../../domain/interfaces/IBehaviorStrategy';
import { CarnivoreStrategy } from '../../domain/strategies/CarnivoreStrategy';
import { HerbivoreStrategy } from '../../domain/strategies/HerbivoreStrategy';
import { MapGenerator, getWaterValue, WATER_THRESHOLD } from '../../infrastructure/generation/MapGenerator';
import { npcAttackNPC, npcAttackPlayer, updateCombatTimers } from './CombatSystem';
import { useAppStore } from '../../store/useAppStore';

/**
 * Gerenciador central de NPCs — Singleton puro (sem React).
 *
 * Design para Multiplayer:
 * - No modo offline: roda normalmente
 * - No modo online (Host): roda normalmente e envia snapshots via PeerJS
 * - No modo online (Client): não roda update(), apenas recebe snapshots
 *
 * Todas as operações são síncronas e determinísticas.
 */

const CHUNK_SIZE = 50;
const MAX_ACTIVE_NPCS = 40;
const SPAWN_RADIUS = 2;
const DESPAWN_RADIUS = 4;

// Spawn config
const HERBIVORE_DENSITY = 3;
const CARNIVORE_DENSITY = 0.3;
const HERB_GROUP_SIZE = 3;      // Herbívoros nascem em grupos de 2-4
const CARNIVORE_GUARANTEE_AREA = 5; // Garante 1 carnívoro por 5x5 chunks

// Zona de exclusão: NPCs não spawnam neste raio ao redor do jogador
const PLAYER_EXCLUSION_RADIUS = 40;

// Roster separado por dieta
const HERBIVORE_ROSTER = DINOSAUR_ROSTER.filter(d => d.diet === 'Herbivore');
const CARNIVORE_ROSTER_LIST = DINOSAUR_ROSTER.filter(d => d.diet === 'Carnivore');

/** Pseudo-random determinístico (mesma seed = mesmo resultado) */
function seededRandom(x: number, z: number, salt: number = 0): number {
  return Math.abs((Math.sin((x + salt) * 12.9898 + (z + salt) * 78.233) * 43758.5453) % 1);
}

class NPCManagerClass {
  private npcs: Map<string, NPCData> = new Map();
  private spawnedChunks: Set<string> = new Set();
  private strategies: Map<string, IBehaviorStrategy> = new Map();
  private pendingDamageToPlayer = 0;
  private isAuthority = true;

  // Cache reutilizáveis para evitar alocação por frame
  private edibleCache: { x: number; z: number; id: string; type: string }[] = [];
  private edibleCacheChunkKey = '';

  // Posição do jogador no momento do spawn (para zona de exclusão)
  private playerSpawnX = 0;
  private playerSpawnZ = 0;
  private hasPlayerSpawnPos = false;

  constructor() {
    this.strategies.set('Carnivore', new CarnivoreStrategy());
    this.strategies.set('Herbivore', new HerbivoreStrategy());
  }

  reset(): void {
    this.npcs.clear();
    this.spawnedChunks.clear();
    this.pendingDamageToPlayer = 0;
    this.edibleCacheChunkKey = '';
    this.hasPlayerSpawnPos = false;
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

  // ==================== SPAWN SYSTEM ====================

  private spawnNPCsForChunk(chunkX: number, chunkZ: number): void {
    const chunkId = `${chunkX},${chunkZ}`;
    if (this.spawnedChunks.has(chunkId)) return;
    this.spawnedChunks.add(chunkId);

    if (this.npcs.size >= MAX_ACTIVE_NPCS) return;

    const startX = chunkX * CHUNK_SIZE;
    const startZ = chunkZ * CHUNK_SIZE;

    // Posição de spawn do jogador (sempre 0,0 no início do mundo)
    const playerSpawnX = 0;
    const playerSpawnZ = 0;

    // Nível base pela distância do centro do mapa
    const distFromCenter = Math.sqrt(startX * startX + startZ * startZ);
    const baseLevel = Math.max(1, Math.floor(distFromCenter / 100));

    // --- HERBÍVOROS (Grupos perto de árvores) ---
    const herbCount = Math.floor(seededRandom(chunkX, chunkZ, 100) * HERBIVORE_DENSITY) + 1;
    const numGroups = Math.max(1, Math.ceil(herbCount / HERB_GROUP_SIZE));

    for (let g = 0; g < numGroups && this.npcs.size < MAX_ACTIVE_NPCS; g++) {
      const groupCenterX = startX + seededRandom(chunkX + g, chunkZ, 150) * CHUNK_SIZE;
      const groupCenterZ = startZ + seededRandom(chunkZ, chunkX + g, 160) * CHUNK_SIZE;

      // Não spawna em água
      if (getWaterValue(groupCenterX, groupCenterZ) > WATER_THRESHOLD) continue;

      // Zona de exclusão: Não spawna perto do centro do mapa se o jogador estiver lá
      const distFromSpawnSq = groupCenterX * groupCenterX + groupCenterZ * groupCenterZ;
      if (distFromSpawnSq < PLAYER_EXCLUSION_RADIUS * PLAYER_EXCLUSION_RADIUS) continue;

      // Zona de exclusão do jogador
      if (this.hasPlayerSpawnPos) {
        const dxP = groupCenterX - this.playerSpawnX;
        const dzP = groupCenterZ - this.playerSpawnZ;
        if (dxP * dxP + dzP * dzP < PLAYER_EXCLUSION_RADIUS * PLAYER_EXCLUSION_RADIUS) continue;
      }

      const specIdx = Math.floor(seededRandom(chunkX + g, chunkZ + g, 200) * HERBIVORE_ROSTER.length);
      const species = HERBIVORE_ROSTER[specIdx];

      const groupSize = Math.min(
        HERB_GROUP_SIZE + Math.floor(seededRandom(chunkX, chunkZ, g * 50) * 2) - 1,
        MAX_ACTIVE_NPCS - this.npcs.size
      );

      for (let i = 0; i < groupSize; i++) {
        const offsetX = (seededRandom(chunkX + i, chunkZ + g, 300) - 0.5) * 10;
        const offsetZ = (seededRandom(chunkZ + i, chunkX + g, 310) - 0.5) * 10;
        const px = groupCenterX + offsetX;
        const pz = groupCenterZ + offsetZ;

        if (getWaterValue(px, pz) > WATER_THRESHOLD) continue;

        const isJuvenile = seededRandom(px, pz, 400) < 0.35;
        const levelVariation = Math.floor(seededRandom(px, pz, 410) * 6) - 2;
        let npcLevel: number;
        if (isJuvenile) {
          npcLevel = Math.max(1, Math.min(8, baseLevel + levelVariation - 5));
        } else {
          npcLevel = Math.max(5, Math.min(30, baseLevel + levelVariation + 5));
        }

        const npcId = `npc_${chunkId}_h${g}_${i}`;
        if (this.npcs.has(npcId)) continue;

        const npc = createNPC(npcId, species, npcLevel, px, pz, chunkId);
        this.npcs.set(npcId, npc);
      }
    }

    // --- CARNÍVOROS (Solitários, mais raros) ---
    const hasCarnivore = seededRandom(chunkX, chunkZ, 500) < CARNIVORE_DENSITY;
    if (hasCarnivore && this.npcs.size < MAX_ACTIVE_NPCS) {
      const cx = startX + seededRandom(chunkX, chunkZ, 510) * CHUNK_SIZE;
      const cz = startZ + seededRandom(chunkZ, chunkX, 520) * CHUNK_SIZE;

      if (getWaterValue(cx, cz) <= WATER_THRESHOLD) {
        // Zona de exclusão
        const distFromSpawnSq = cx * cx + cz * cz;
        let tooClose = false;
        if (distFromSpawnSq < PLAYER_EXCLUSION_RADIUS * PLAYER_EXCLUSION_RADIUS) {
            tooClose = true;
        } else if (this.hasPlayerSpawnPos) {
          const dxP = cx - this.playerSpawnX;
          const dzP = cz - this.playerSpawnZ;
          tooClose = dxP * dxP + dzP * dzP < PLAYER_EXCLUSION_RADIUS * PLAYER_EXCLUSION_RADIUS;
        }

        if (!tooClose) {
          const cSpecIdx = Math.floor(seededRandom(chunkX, chunkZ, 530) * CARNIVORE_ROSTER_LIST.length);
          const cSpecies = CARNIVORE_ROSTER_LIST[cSpecIdx];
          const cLevel = Math.max(3, Math.min(35, baseLevel + Math.floor(seededRandom(cx, cz, 540) * 8)));

          const npcId = `npc_${chunkId}_c0`;
          if (!this.npcs.has(npcId)) {
            const npc = createNPC(npcId, cSpecies, cLevel, cx, cz, chunkId);
            this.npcs.set(npcId, npc);
          }
        }
      }
    }

    // --- GARANTIA DE CARNÍVORO POR ÁREA 5x5 ---
    const areaX = Math.floor(chunkX / CARNIVORE_GUARANTEE_AREA) * CARNIVORE_GUARANTEE_AREA;
    const areaZ = Math.floor(chunkZ / CARNIVORE_GUARANTEE_AREA) * CARNIVORE_GUARANTEE_AREA;

    if (chunkX === areaX && chunkZ === areaZ && this.npcs.size < MAX_ACTIVE_NPCS) {
      let hasCarnInArea = false;
      for (const npc of this.npcs.values()) {
        if (npc.diet === 'Carnivore') {
          const ncx = Math.floor(npc.posX / CHUNK_SIZE);
          const ncz = Math.floor(npc.posZ / CHUNK_SIZE);
          if (ncx >= areaX && ncx < areaX + CARNIVORE_GUARANTEE_AREA &&
              ncz >= areaZ && ncz < areaZ + CARNIVORE_GUARANTEE_AREA) {
            hasCarnInArea = true;
            break;
          }
        }
      }

      if (!hasCarnInArea) {
        const gcx = (areaX + 2.5) * CHUNK_SIZE;
        const gcz = (areaZ + 2.5) * CHUNK_SIZE;
        if (getWaterValue(gcx, gcz) <= WATER_THRESHOLD) {
          // Zona de exclusão do jogador
          let tooClose = false;
          if (this.hasPlayerSpawnPos) {
            const dxP = gcx - this.playerSpawnX;
            const dzP = gcz - this.playerSpawnZ;
            tooClose = dxP * dxP + dzP * dzP < PLAYER_EXCLUSION_RADIUS * PLAYER_EXCLUSION_RADIUS;
          }

          if (!tooClose) {
            const gSpecIdx = Math.floor(seededRandom(areaX, areaZ, 600) * CARNIVORE_ROSTER_LIST.length);
            const gSpecies = CARNIVORE_ROSTER_LIST[gSpecIdx];
            const gLevel = Math.max(5, baseLevel + 3);
            const npcId = `npc_area_${areaX}_${areaZ}_c`;

            if (!this.npcs.has(npcId)) {
              const npc = createNPC(npcId, gSpecies, gLevel, gcx, gcz, `${areaX},${areaZ}`);
              this.npcs.set(npcId, npc);
            }
          }
        }
      }
    }
  }

  private despawnFarNPCs(playerChunkX: number, playerChunkZ: number): void {
    const keysToRemove: string[] = [];

    for (const [id, npc] of this.npcs) {
      const npcChunkX = Math.floor(npc.posX / CHUNK_SIZE);
      const npcChunkZ = Math.floor(npc.posZ / CHUNK_SIZE);

      const dx = Math.abs(npcChunkX - playerChunkX);
      const dz = Math.abs(npcChunkZ - playerChunkZ);

      if (dx > DESPAWN_RADIUS || dz > DESPAWN_RADIUS) {
        keysToRemove.push(id);
        this.spawnedChunks.delete(npc.spawnChunkId);
      }
    }

    for (const key of keysToRemove) {
      this.npcs.delete(key);
    }
  }

  // ==================== MAIN UPDATE ====================

  update(
    delta: number,
    playerX: number,
    playerZ: number,
    playerLevel: number,
    playerScale: number,
    playerDiet: string
  ): void {
    if (!this.isAuthority) return;

    const dt = Math.min(delta, 0.05);

    // Registra a posição de spawn do jogador na primeira chamada
    if (!this.hasPlayerSpawnPos) {
      this.playerSpawnX = playerX;
      this.playerSpawnZ = playerZ;
      this.hasPlayerSpawnPos = true;
    }

    const playerChunkX = Math.floor(playerX / CHUNK_SIZE);
    const playerChunkZ = Math.floor(playerZ / CHUNK_SIZE);

    // Spawn & Despawn
    for (let cx = -SPAWN_RADIUS; cx <= SPAWN_RADIUS; cx++) {
      for (let cz = -SPAWN_RADIUS; cz <= SPAWN_RADIUS; cz++) {
        this.spawnNPCsForChunk(playerChunkX + cx, playerChunkZ + cz);
      }
    }
    this.despawnFarNPCs(playerChunkX, playerChunkZ);

    // Coleta edibles — refresca a cada frame para a IA funcionar corretamente
    this.edibleCache = this.getEdiblePositions(playerX, playerZ);

    const allNPCs = this.getActiveNPCs();
    const playerPos = { x: playerX, z: playerZ };

    for (const npc of allNPCs) {
      updateCombatTimers(npc, dt);

      if (npc.state === NPCState.Dead) continue;
      
      // Corrigido: Decrementar timer MESMO se pular o loop da FSM/Movimento
      if (npc.stateTimer > 0) {
        npc.stateTimer -= dt;
        if (npc.state === NPCState.Attacking || npc.state === NPCState.Eating) {
          continue;
        }
      }

      const stats = DINOSAUR_ROSTER.find(d => d.id === npc.speciesId);
      if (!stats) continue;

      const strategy = this.strategies.get(npc.diet);
      if (!strategy) continue;

      // FSM
      this.updateFSM(npc, stats, strategy, allNPCs, this.edibleCache, playerPos, playerLevel, playerDiet, dt);

      // Movimento
      this.updateMovement(npc, stats, dt);

      // Combate NPC vs Jogador (carnívoros caçando)
      if (npc.state === NPCState.Hunting && npc.diet === 'Carnivore' && npc.attackCooldown <= 0) {
        const dx = npc.posX - playerX;
        const dz = npc.posZ - playerZ;
        const npcScale = getNPCScaleFactor(npc.level, stats);
        const attackDist = Math.min(3.0 * npcScale, 5.0) + Math.min(2.0 * playerScale, 4.0);

        if (dx * dx + dz * dz < attackDist * attackDist) {
          const dmg = npcAttackPlayer(npc, playerX, playerZ, playerScale);
          if (dmg > 0) {
            this.pendingDamageToPlayer += dmg;
          }
        }
      }

      // Combate NPC vs NPC
      if (npc.state === NPCState.Hunting && npc.diet === 'Carnivore' && npc.attackCooldown <= 0) {
        for (const target of allNPCs) {
          if (target.id === npc.id || target.state === NPCState.Dead) continue;
          if (target.diet === 'Carnivore') continue;
          npcAttackNPC(npc, target);
          if (npc.attackCooldown > 0) break;
        }
      }
    }

    // Limpar NPCs mortos após 10 segundos
    for (const npc of allNPCs) {
      if (npc.state === NPCState.Dead) {
        npc.stateTimer -= dt;
        if (npc.stateTimer < -10) {
          this.npcs.delete(npc.id);
        }
      }
    }
  }

  // ==================== FSM ====================

  private updateFSM(
    npc: NPCData,
    stats: DinosaurStats,
    strategy: IBehaviorStrategy,
    allNPCs: NPCData[],
    ediblePositions: { x: number; z: number; id: string; type: string }[],
    playerPos: { x: number; z: number },
    playerLevel: number,
    playerDiet: string,
    dt: number
  ): void {
    // 1. Verificar ameaças (prioridade máxima)
    const threatId = strategy.evaluateThreat(npc, allNPCs, playerPos, playerLevel, playerDiet);
    if (threatId) {
      npc.state = NPCState.Fleeing;
      npc.fleeFromId = threatId;
      npc.animationIntent = 'Run';

      let threatX = playerPos.x;
      let threatZ = playerPos.z;
      if (threatId !== 'player') {
        const threat = this.npcs.get(threatId);
        if (threat) {
          threatX = threat.posX;
          threatZ = threat.posZ;
        }
      }

      const dx = npc.posX - threatX;
      const dz = npc.posZ - threatZ;
      const dist = Math.sqrt(dx * dx + dz * dz) || 1;

      const deviate = (seededRandom(npc.posX, npc.posZ, 700) - 0.5) * 0.3;
      npc.targetX = npc.posX + (dx / dist + deviate) * 30;
      npc.targetZ = npc.posZ + (dz / dist + deviate) * 30;
      return;
    }

    // Se estava fugindo mas a ameaça sumiu
    if (npc.state === NPCState.Fleeing) {
      npc.state = NPCState.Wandering;
      npc.fleeFromId = null;
    }

    // 2. Verificar comida
    const food = strategy.findFood(npc, allNPCs, ediblePositions, playerPos, playerLevel);
    if (food) {
      npc.state = NPCState.Hunting;
      npc.targetX = food.x;
      npc.targetZ = food.z;
      npc.animationIntent = 'Walk';

      if (food.targetId && food.targetId !== 'player' && !food.targetId.startsWith('npc_')) {
        const dx = npc.posX - food.x;
        const dz = npc.posZ - food.z;
        const distSq = dx * dx + dz * dz;

        if (distSq < 9) {
          npc.state = NPCState.Eating;
          npc.animationIntent = 'Eat';
          npc.stateTimer = 1.5;
          useAppStore.getState().damageEdible(food.targetId, 0.5);
        }
      }
      return;
    }

    // 3. Filhotes ficam perto de adultos da mesma espécie
    if (npc.level < 10) {
      let nearestAdult: NPCData | null = null;
      let bestDistSq = 900;

      for (const other of allNPCs) {
        if (other.id === npc.id || other.state === NPCState.Dead) continue;
        if (other.speciesId !== npc.speciesId || other.level < 10) continue;

        const dx = other.posX - npc.posX;
        const dz = other.posZ - npc.posZ;
        const distSq = dx * dx + dz * dz;

        if (distSq < bestDistSq) {
          bestDistSq = distSq;
          nearestAdult = other;
        }
      }

      if (nearestAdult && bestDistSq > 25) {
        npc.state = NPCState.Wandering;
        npc.targetX = nearestAdult.posX + (Math.random() - 0.5) * 6;
        npc.targetZ = nearestAdult.posZ + (Math.random() - 0.5) * 6;
        npc.animationIntent = 'Walk';
        return;
      }
    }

    // 4. Vagar aleatoriamente
    if (npc.state !== NPCState.Wandering) {
      npc.state = NPCState.Wandering;
    }

    npc.wanderTimer -= dt;
    if (npc.wanderTimer <= 0) {
      if (npc.diet === 'Herbivore') {
        let groupCenterX = npc.posX;
        let groupCenterZ = npc.posZ;
        let groupCount = 1;

        for (const other of allNPCs) {
          if (other.id === npc.id || other.state === NPCState.Dead) continue;
          if (other.speciesId !== npc.speciesId) continue;

          const dx = other.posX - npc.posX;
          const dz = other.posZ - npc.posZ;
          if (dx * dx + dz * dz < 1600) {
            groupCenterX += other.posX;
            groupCenterZ += other.posZ;
            groupCount++;
          }
        }

        groupCenterX /= groupCount;
        groupCenterZ /= groupCount;

        npc.targetX = groupCenterX + (Math.random() - 0.5) * 20;
        npc.targetZ = groupCenterZ + (Math.random() - 0.5) * 20;
      } else {
        npc.targetX = npc.posX + (Math.random() - 0.5) * 40;
        npc.targetZ = npc.posZ + (Math.random() - 0.5) * 40;
      }
      npc.wanderTimer = 2 + Math.random() * 4;
    }

    const dx = npc.targetX - npc.posX;
    const dz = npc.targetZ - npc.posZ;
    npc.animationIntent = (dx * dx + dz * dz < 4) ? 'Idle' : 'Walk';
  }

  // ==================== MOVEMENT ====================

  private updateMovement(npc: NPCData, stats: DinosaurStats, dt: number): void {
    const dx = npc.targetX - npc.posX;
    const dz = npc.targetZ - npc.posZ;
    const distSq = dx * dx + dz * dz;

    if (distSq < 1) return;

    const dist = Math.sqrt(distSq);
    const isFleeing = npc.state === NPCState.Fleeing;
    const isHunting = npc.state === NPCState.Hunting;
    const baseSpeed = (isFleeing || isHunting) ? stats.runSpeed : stats.walkSpeed;
    const levelSpeedMod = npc.level < 20 ? (0.5 + ((npc.level - 1) / 19) * 0.5) : 1.0;
    const inWater = getWaterValue(npc.posX, npc.posZ) > WATER_THRESHOLD;
    const waterMod = inWater ? 0.5 : 1.0;

    const speed = baseSpeed * levelSpeedMod * waterMod;

    const nx = dx / dist;
    const nz = dz / dist;

    npc.posX += nx * speed * dt;
    npc.posZ += nz * speed * dt;
    npc.posY = inWater ? -3 * getNPCScaleFactor(npc.level, stats) : 0;

    // Rotação suave
    const targetAngle = Math.atan2(nx, nz);
    let angleDiff = targetAngle - npc.rotY;
    while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
    while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
    npc.rotY += angleDiff * Math.min(1, 5 * dt);
  }

  // ==================== HELPERS ====================

  private getEdiblePositions(playerX: number, playerZ: number): { x: number; z: number; id: string; type: string }[] {
    const chunks = MapGenerator.getChunksAround(playerX, playerZ, SPAWN_RADIUS);
    const edibleStates = useAppStore.getState().edibleStates;
    const result: { x: number; z: number; id: string; type: string }[] = [];

    for (const chunk of chunks) {
      for (const edible of chunk.edibles) {
        const remaining = edibleStates[edible.id] ?? 1.0;
        if (remaining > 0) {
          result.push({
            x: edible.position[0],
            z: edible.position[2],
            id: edible.id,
            type: edible.type,
          });
        }
      }
    }

    return result;
  }
}

/** Singleton global */
export const NPCManager = new NPCManagerClass();
