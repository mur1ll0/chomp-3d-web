import { createNPC } from '../../../domain/models/NPCDinosaur';
import type { NPCData } from '../../../domain/models/NPCDinosaur';
import { DINOSAUR_ROSTER } from '../../../domain/models/DinosaurStats';
import type { IWorldQueryGateway } from '../contracts/IWorldQueryGateway';

const CHUNK_SIZE = 50;
const MAX_ACTIVE_NPCS = 40;
const HERBIVORE_DENSITY = 3;
const CARNIVORE_DENSITY = 0.3;
const HERB_GROUP_SIZE = 3;
const CARNIVORE_GUARANTEE_AREA = 5;
const PLAYER_EXCLUSION_RADIUS = 40;

const HERBIVORE_ROSTER = DINOSAUR_ROSTER.filter(d => d.diet === 'Herbivore');
const CARNIVORE_ROSTER_LIST = DINOSAUR_ROSTER.filter(d => d.diet === 'Carnivore');

function seededRandom(x: number, z: number, salt: number = 0): number {
  return Math.abs((Math.sin((x + salt) * 12.9898 + (z + salt) * 78.233) * 43758.5453) % 1);
}

export class NPCSpawnSystem {
  spawnNPCsForChunk(args: {
    chunkX: number;
    chunkZ: number;
    npcs: Map<string, NPCData>;
    spawnedChunks: Set<string>;
    hasPlayerSpawnPos: boolean;
    playerSpawnX: number;
    playerSpawnZ: number;
    worldQuery: IWorldQueryGateway;
  }): void {
    const {
      chunkX,
      chunkZ,
      npcs,
      spawnedChunks,
      hasPlayerSpawnPos,
      playerSpawnX,
      playerSpawnZ,
      worldQuery,
    } = args;

    const chunkId = `${chunkX},${chunkZ}`;
    if (spawnedChunks.has(chunkId)) return;
    spawnedChunks.add(chunkId);

    if (npcs.size >= MAX_ACTIVE_NPCS) return;

    const startX = chunkX * CHUNK_SIZE;
    const startZ = chunkZ * CHUNK_SIZE;

    const distFromCenter = Math.sqrt(startX * startX + startZ * startZ);
    const baseLevel = Math.max(1, Math.floor(distFromCenter / 100));

    const herbCount = Math.floor(seededRandom(chunkX, chunkZ, 100) * HERBIVORE_DENSITY) + 1;
    const numGroups = Math.max(1, Math.ceil(herbCount / HERB_GROUP_SIZE));

    for (let g = 0; g < numGroups && npcs.size < MAX_ACTIVE_NPCS; g++) {
      const groupCenterX = startX + seededRandom(chunkX + g, chunkZ, 150) * CHUNK_SIZE;
      const groupCenterZ = startZ + seededRandom(chunkZ, chunkX + g, 160) * CHUNK_SIZE;

      if (worldQuery.isWaterAt(groupCenterX, groupCenterZ)) continue;

      const distFromSpawnSq = groupCenterX * groupCenterX + groupCenterZ * groupCenterZ;
      if (distFromSpawnSq < PLAYER_EXCLUSION_RADIUS * PLAYER_EXCLUSION_RADIUS) continue;

      if (hasPlayerSpawnPos) {
        const dxP = groupCenterX - playerSpawnX;
        const dzP = groupCenterZ - playerSpawnZ;
        if (dxP * dxP + dzP * dzP < PLAYER_EXCLUSION_RADIUS * PLAYER_EXCLUSION_RADIUS) continue;
      }

      const specIdx = Math.floor(seededRandom(chunkX + g, chunkZ + g, 200) * HERBIVORE_ROSTER.length);
      const species = HERBIVORE_ROSTER[specIdx];

      const groupSize = Math.min(
        HERB_GROUP_SIZE + Math.floor(seededRandom(chunkX, chunkZ, g * 50) * 2) - 1,
        MAX_ACTIVE_NPCS - npcs.size
      );

      for (let i = 0; i < groupSize; i++) {
        const offsetX = (seededRandom(chunkX + i, chunkZ + g, 300) - 0.5) * 10;
        const offsetZ = (seededRandom(chunkZ + i, chunkX + g, 310) - 0.5) * 10;
        const px = groupCenterX + offsetX;
        const pz = groupCenterZ + offsetZ;

        if (worldQuery.isWaterAt(px, pz)) continue;

        const isJuvenile = seededRandom(px, pz, 400) < 0.35;
        const levelVariation = Math.floor(seededRandom(px, pz, 410) * 6) - 2;
        let npcLevel: number;
        if (isJuvenile) {
          npcLevel = Math.max(1, Math.min(8, baseLevel + levelVariation - 5));
        } else {
          npcLevel = Math.max(5, Math.min(30, baseLevel + levelVariation + 5));
        }

        const npcId = `npc_${chunkId}_h${g}_${i}`;
        if (npcs.has(npcId)) continue;

        const npc = createNPC(npcId, species, npcLevel, px, pz, chunkId);
        npcs.set(npcId, npc);
      }
    }

    const hasCarnivore = seededRandom(chunkX, chunkZ, 500) < CARNIVORE_DENSITY;
    if (hasCarnivore && npcs.size < MAX_ACTIVE_NPCS) {
      const cx = startX + seededRandom(chunkX, chunkZ, 510) * CHUNK_SIZE;
      const cz = startZ + seededRandom(chunkZ, chunkX, 520) * CHUNK_SIZE;

      if (!worldQuery.isWaterAt(cx, cz)) {
        const distFromSpawnSq = cx * cx + cz * cz;
        let tooClose = false;
        if (distFromSpawnSq < PLAYER_EXCLUSION_RADIUS * PLAYER_EXCLUSION_RADIUS) {
          tooClose = true;
        } else if (hasPlayerSpawnPos) {
          const dxP = cx - playerSpawnX;
          const dzP = cz - playerSpawnZ;
          tooClose = dxP * dxP + dzP * dzP < PLAYER_EXCLUSION_RADIUS * PLAYER_EXCLUSION_RADIUS;
        }

        if (!tooClose) {
          const cSpecIdx = Math.floor(seededRandom(chunkX, chunkZ, 530) * CARNIVORE_ROSTER_LIST.length);
          const cSpecies = CARNIVORE_ROSTER_LIST[cSpecIdx];
          const cLevel = Math.max(3, Math.min(35, baseLevel + Math.floor(seededRandom(cx, cz, 540) * 8)));

          const npcId = `npc_${chunkId}_c0`;
          if (!npcs.has(npcId)) {
            const npc = createNPC(npcId, cSpecies, cLevel, cx, cz, chunkId);
            npcs.set(npcId, npc);
          }
        }
      }
    }

    const areaX = Math.floor(chunkX / CARNIVORE_GUARANTEE_AREA) * CARNIVORE_GUARANTEE_AREA;
    const areaZ = Math.floor(chunkZ / CARNIVORE_GUARANTEE_AREA) * CARNIVORE_GUARANTEE_AREA;

    if (chunkX === areaX && chunkZ === areaZ && npcs.size < MAX_ACTIVE_NPCS) {
      let hasCarnInArea = false;
      for (const npc of npcs.values()) {
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
        if (!worldQuery.isWaterAt(gcx, gcz)) {
          let tooClose = false;
          if (hasPlayerSpawnPos) {
            const dxP = gcx - playerSpawnX;
            const dzP = gcz - playerSpawnZ;
            tooClose = dxP * dxP + dzP * dzP < PLAYER_EXCLUSION_RADIUS * PLAYER_EXCLUSION_RADIUS;
          }

          if (!tooClose) {
            const gSpecIdx = Math.floor(seededRandom(areaX, areaZ, 600) * CARNIVORE_ROSTER_LIST.length);
            const gSpecies = CARNIVORE_ROSTER_LIST[gSpecIdx];
            const gLevel = Math.max(5, baseLevel + 3);
            const npcId = `npc_area_${areaX}_${areaZ}_c`;

            if (!npcs.has(npcId)) {
              const npc = createNPC(npcId, gSpecies, gLevel, gcx, gcz, `${areaX},${areaZ}`);
              npcs.set(npcId, npc);
            }
          }
        }
      }
    }
  }
}
