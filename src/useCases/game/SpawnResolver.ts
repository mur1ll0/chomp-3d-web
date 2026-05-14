import { getWaterValue, WATER_THRESHOLD } from '../../infrastructure/generation/MapGenerator';

export const CHUNK_SIZE = 50;
const SEARCH_RADIUS = 15;
const CARNIVORE_CHECK_RADIUS = 2;
const WATER_CHECK_RESOLUTION = 5;

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

    for (let radius = 1; radius <= SEARCH_RADIUS; radius++) {
      for (let cx = -radius; cx <= radius; cx++) {
        for (let cz = -radius; cz <= radius; cz++) {
          if (Math.abs(cx) !== radius && Math.abs(cz) !== radius) continue;
          const pos = this.evaluateChunk(cx, cz, speciesId, herbivoreRoster);
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
          if (!this.hasCarnivoreNearby(cx, cz)) {
            const wx = cx * CHUNK_SIZE + seededRandom(cx, cz, 510) * CHUNK_SIZE;
            const wz = cz * CHUNK_SIZE + seededRandom(cz, cx, 520) * CHUNK_SIZE;
            return { chunkX: cx, chunkZ: cz, worldX: wx, worldZ: wz };
          }
        }
      }
    }
    return { chunkX: 0, chunkZ: 0, worldX: 0, worldZ: 0 };
  }

  private evaluateChunk(cx: number, cz: number, speciesId: string, herbivoreRoster: string[]): SpawnPosition | null {
    const herbCount = Math.floor(seededRandom(cx, cz, 100) * 3) + 1;

    for (let g = 0; g < herbCount; g++) {
      const speciesIdx = Math.floor(seededRandom(cx + g, cz + g, 200) * herbivoreRoster.length);
      if (herbivoreRoster[speciesIdx] !== speciesId) continue;

      const groupCenterX = cx * CHUNK_SIZE + seededRandom(cx + g, cz, 150) * CHUNK_SIZE;
      const groupCenterZ = cz * CHUNK_SIZE + seededRandom(cx, cz + g, 150) * CHUNK_SIZE;

      if (this.isAreaWater(groupCenterX, groupCenterZ)) continue;
      if (this.hasCarnivoreNearby(cx, cz)) continue;

      return {
        chunkX: cx,
        chunkZ: cz,
        worldX: groupCenterX + (seededRandom(cx, cz, 999) - 0.5) * 5,
        worldZ: groupCenterZ + (seededRandom(cx, cz, 888) - 0.5) * 5,
      };
    }
    return null;
  }

  private hasCarnivoreNearby(cx: number, cz: number): boolean {
    for (let dx = -CARNIVORE_CHECK_RADIUS; dx <= CARNIVORE_CHECK_RADIUS; dx++) {
      for (let dz = -CARNIVORE_CHECK_RADIUS; dz <= CARNIVORE_CHECK_RADIUS; dz++) {
        if (seededRandom(cx + dx, cz + dz, 500) < 0.3) return true;
      }
    }
    return false;
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
