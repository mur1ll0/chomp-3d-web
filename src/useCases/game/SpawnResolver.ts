import { getWaterValue, WATER_THRESHOLD } from '../../infrastructure/generation/MapGenerator';

export const CHUNK_SIZE = 50;
const SEARCH_RADIUS = 15;
const WATER_CHECK_RESOLUTION = 5;
const MAX_WATER_RETRIES = 5;

function seededRandom(x: number, z: number, salt: number = 0): number {
  return Math.abs((Math.sin((x + salt) * 12.9898 + (z + salt) * 78.233) * 43758.5453) % 1);
}

export interface SpawnPosition {
  chunkX: number;
  chunkZ: number;
  worldX: number;
  worldZ: number;
}

export class SpawnResolver {
  private worldSeed: number;

  constructor(worldSeed: number) {
    this.worldSeed = worldSeed;
  }

  resolve(speciesId: string, herbivoreRoster: string[], diet?: string): SpawnPosition {
    if (diet === 'Carnivore') {
      return this.resolveCarnivore();
    }

    // Primeira passada: prefere packs SEM carnívoros próximos
    for (let radius = 1; radius <= SEARCH_RADIUS; radius++) {
      for (let cx = -radius; cx <= radius; cx++) {
        for (let cz = -radius; cz <= radius; cz++) {
          if (Math.abs(cx) !== radius && Math.abs(cz) !== radius) continue;
          const pos = this.evaluateHerbivoreChunk(cx, cz, speciesId, herbivoreRoster, true);
          if (pos) return pos;
        }
      }
    }

    // Segunda passada: qualquer pack da espécie, mesmo com carnívoro por perto
    for (let radius = 1; radius <= SEARCH_RADIUS; radius++) {
      for (let cx = -radius; cx <= radius; cx++) {
        for (let cz = -radius; cz <= radius; cz++) {
          if (Math.abs(cx) !== radius && Math.abs(cz) !== radius) continue;
          const pos = this.evaluateHerbivoreChunk(cx, cz, speciesId, herbivoreRoster, false);
          if (pos) return pos;
        }
      }
    }

    const fallbackX = (seededRandom(this.worldSeed, speciesId.charCodeAt(0), 999) - 0.5) * 10;
    const fallbackZ = (seededRandom(speciesId.charCodeAt(0), this.worldSeed, 888) - 0.5) * 10;
    return { chunkX: 0, chunkZ: 0, worldX: fallbackX, worldZ: fallbackZ };
  }

  resolveByPackCode(_speciesId: string, chunkX: number, chunkZ: number): SpawnPosition {
    const worldX = chunkX * CHUNK_SIZE + CHUNK_SIZE / 2 + (seededRandom(chunkX, chunkZ, 999) - 0.5) * 5;
    const worldZ = chunkZ * CHUNK_SIZE + CHUNK_SIZE / 2 + (seededRandom(chunkX, chunkZ, 888) - 0.5) * 5;
    return { chunkX, chunkZ, worldX, worldZ };
  }

  private resolveCarnivore(): SpawnPosition {
    for (let radius = 1; radius <= SEARCH_RADIUS; radius++) {
      for (let cx = -radius; cx <= radius; cx++) {
        for (let cz = -radius; cz <= radius; cz++) {
          if (Math.abs(cx) !== radius && Math.abs(cz) !== radius) continue;
          const startX = cx * CHUNK_SIZE;
          const startZ = cz * CHUNK_SIZE;
          if (this.isAreaWater(startX + CHUNK_SIZE / 2, startZ + CHUNK_SIZE / 2)) continue;
          if (this.hasCarnivoreNearby(cx, cz)) continue;
          for (let attempt = 0; attempt < MAX_WATER_RETRIES; attempt++) {
            const wx = startX + seededRandom(cx + attempt, cz, 510) * CHUNK_SIZE;
            const wz = startZ + seededRandom(cz, cx + attempt, 520) * CHUNK_SIZE;
            if (!this.isAreaWater(wx, wz)) {
              return { chunkX: cx, chunkZ: cz, worldX: wx, worldZ: wz };
            }
          }
        }
      }
    }
    const jitterX = (seededRandom(0, 0, 999) - 0.5) * 20;
    const jitterZ = (seededRandom(0, 0, 888) - 0.5) * 20;
    return { chunkX: 0, chunkZ: 0, worldX: jitterX, worldZ: jitterZ };
  }

  private evaluateHerbivoreChunk(cx: number, cz: number, speciesId: string, herbivoreRoster: string[], requireSafe: boolean): SpawnPosition | null {
    const totalNpcs = Math.floor(seededRandom(cx, cz, 100) * 4) + 1;
    const numGroups = Math.max(1, Math.ceil(totalNpcs / 3));

    for (let g = 0; g < numGroups; g++) {
      const speciesIdx = Math.floor(seededRandom(cx + g, cz + g, 200) * herbivoreRoster.length);
      if (herbivoreRoster[speciesIdx] !== speciesId) continue;

      const groupCenterX = cx * CHUNK_SIZE + seededRandom(cx + g, cz, 150) * CHUNK_SIZE;
      const groupCenterZ = cz * CHUNK_SIZE + seededRandom(cz, cx + g, 160) * CHUNK_SIZE;

      if (this.isAreaWater(groupCenterX, groupCenterZ)) continue;
      if (requireSafe && this.hasCarnivoreNearby(cx, cz)) continue;

      // Spawna exatamente onde o primeiro NPC (i=0) deste grupo estaria
      const offsetX = (seededRandom(cx, cz + g, 300) - 0.5) * 10;
      const offsetZ = (seededRandom(cz, cx + g, 310) - 0.5) * 10;
      const npcX = groupCenterX + offsetX;
      const npcZ = groupCenterZ + offsetZ;

      if (this.isAreaWater(npcX, npcZ)) continue;

      return { chunkX: cx, chunkZ: cz, worldX: npcX, worldZ: npcZ };
    }
    return null;
  }

  private hasCarnivoreNearby(cx: number, cz: number): boolean {
    return seededRandom(cx, cz, 500) < 0.3;
  }

  private isAreaWater(worldX: number, worldZ: number): boolean {
    for (let dx = -WATER_CHECK_RESOLUTION; dx <= WATER_CHECK_RESOLUTION; dx += 2) {
      for (let dz = -WATER_CHECK_RESOLUTION; dz <= WATER_CHECK_RESOLUTION; dz += 2) {
        if (getWaterValue(worldX + dx, worldZ + dz) > WATER_THRESHOLD) return true;
      }
    }
    return false;
  }
}
