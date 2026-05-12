import { createNoise2D } from 'simplex-noise';

export const WORLD_SEED = 12345;

// Seeded noise generators
const noise2D = createNoise2D(() => WORLD_SEED);
const waterNoise2D = createNoise2D(() => 98765);
const grassNoise2D = createNoise2D(() => 55555);

export interface MapObject {
  position: [number, number, number];
  scale: number;
  heightScale: number;
  trunkWidth: number; // Nova propriedade para variação de troncos
  rotation: number;
  type: number; // 0 para Cone, 1 para Esfera (Variação de Folhagem)
  collisionHeight: number;
  collisionRadius: number;
}

export interface MapEdible {
  id: string;
  type: 'Meat' | 'Plant';
  position: [number, number, number];
  scale: number;
  rotation: number;
}

export interface ChunkData {
  id: string;
  x: number;
  z: number;
  trees: MapObject[];
  rocks: MapObject[];
  grass: MapObject[];
  water: MapObject[];
  edibles: MapEdible[];
}

export interface ChunkCacheMetrics {
  size: number;
  maxSize: number;
  hits: number;
  misses: number;
  evictions: number;
}

const CHUNK_SIZE = 50;
const TREE_THRESHOLD = 0.3;
const ROCK_THRESHOLD = 0.5;
const GRASS_THRESHOLD = 0.1;

// Water settings
export const WATER_THRESHOLD = 0.75; // Higher = rarer lakes/rivers
const WATER_NOISE_SCALE = 0.015; // Lower = larger continuous bodies of water
const BEACH_MARGIN = 0.05; // Buffer to prevent trees spawning right on the edge of water

// Helper to get deterministic pseudo-random between 0 and 1
function pseudoRandom(x: number, z: number) {
  return Math.abs((Math.sin(x * 12.9898 + z * 78.233) * 43758.5453) % 1);
}

export function getWaterValue(x: number, z: number) {
  // Adding two noises can help form more interesting river/lake shapes
  const mainNoise = waterNoise2D(x * WATER_NOISE_SCALE, z * WATER_NOISE_SCALE);
  const detailNoise = waterNoise2D(x * 0.05, z * 0.05) * 0.2;
  return mainNoise + detailNoise;
}

export class MapGenerator {
  static chunkCache = new Map<string, ChunkData>();
  static chunkAccessMeta = new Map<string, { x: number; z: number; lastAccessTick: number }>();
  static maxChunkCacheSize = 256;
  static cacheHits = 0;
  static cacheMisses = 0;
  static cacheEvictions = 0;
  static accessTick = 0;

  private static touchChunk(id: string, x: number, z: number): void {
    this.accessTick++;
    this.chunkAccessMeta.set(id, { x, z, lastAccessTick: this.accessTick });
  }

  static setMaxChunkCacheSize(maxSize: number): void {
    this.maxChunkCacheSize = Math.max(64, Math.floor(maxSize));
  }

  static getChunkCacheMetrics(): ChunkCacheMetrics {
    return {
      size: this.chunkCache.size,
      maxSize: this.maxChunkCacheSize,
      hits: this.cacheHits,
      misses: this.cacheMisses,
      evictions: this.cacheEvictions,
    };
  }

  private static evictChunkCache(currentChunkX: number, currentChunkZ: number, visibleRadius: number): void {
    if (this.chunkCache.size <= this.maxChunkCacheSize) return;

    const keepRadius = visibleRadius + 2;
    const protectedKeys = new Set<string>();

    for (let x = -keepRadius; x <= keepRadius; x++) {
      for (let z = -keepRadius; z <= keepRadius; z++) {
        protectedKeys.add(`${currentChunkX + x},${currentChunkZ + z}`);
      }
    }

    const candidates = Array.from(this.chunkAccessMeta.entries())
      .filter(([id]) => !protectedKeys.has(id))
      .map(([id, meta]) => ({
        id,
        distSq: (meta.x - currentChunkX) * (meta.x - currentChunkX) + (meta.z - currentChunkZ) * (meta.z - currentChunkZ),
        lastAccessTick: meta.lastAccessTick,
      }))
      .sort((a, b) => {
        if (b.distSq !== a.distSq) return b.distSq - a.distSq;
        return a.lastAccessTick - b.lastAccessTick;
      });

    let idx = 0;
    while (this.chunkCache.size > this.maxChunkCacheSize && idx < candidates.length) {
      const id = candidates[idx].id;
      if (this.chunkCache.delete(id)) {
        this.chunkAccessMeta.delete(id);
        this.cacheEvictions++;
      }
      idx++;
    }

    if (this.chunkCache.size <= this.maxChunkCacheSize) return;

    const oldest = Array.from(this.chunkAccessMeta.entries())
      .filter(([id]) => !protectedKeys.has(id))
      .sort((a, b) => a[1].lastAccessTick - b[1].lastAccessTick);

    for (const [id] of oldest) {
      if (this.chunkCache.size <= this.maxChunkCacheSize) break;
      if (this.chunkCache.delete(id)) {
        this.chunkAccessMeta.delete(id);
        this.cacheEvictions++;
      }
    }
  }

  static getChunk(chunkX: number, chunkZ: number): ChunkData {
    const id = `${chunkX},${chunkZ}`;
    if (this.chunkCache.has(id)) {
      this.cacheHits++;
      this.touchChunk(id, chunkX, chunkZ);
      return this.chunkCache.get(id)!;
    }
    this.cacheMisses++;

    const trees: MapObject[] = [];
    const rocks: MapObject[] = [];
    const grass: MapObject[] = [];
    const water: MapObject[] = [];
    const edibles: MapEdible[] = [];

    const startX = chunkX * CHUNK_SIZE;
    const startZ = chunkZ * CHUNK_SIZE;

    const step = 2.0;

    // --- FIRST PASS: WATER, TREES, ROCKS ---
    for (let x = startX; x < startX + CHUNK_SIZE; x += step) {
      for (let z = startZ; z < startZ + CHUNK_SIZE; z += step) {
        // WATER
        const waterJitterX = x + (pseudoRandom(x, z) - 0.5) * step * 0.5;
        const waterJitterZ = z + (pseudoRandom(x + 1, z + 1) - 0.5) * step * 0.5;
        const waterVal = getWaterValue(waterJitterX, waterJitterZ);

        if (waterVal > WATER_THRESHOLD) {
          water.push({
            position: [waterJitterX, 0.1, waterJitterZ],
            scale: step * 1.5,
            heightScale: 1,
            trunkWidth: 1,
            rotation: pseudoRandom(x, z) * Math.PI,
            type: 0,
            collisionHeight: 0,
            collisionRadius: 0
          });
          continue; // Don't spawn trees/rocks on water
        }

        const finalX = x + (pseudoRandom(x + 123, z + 456) - 0.5) * step * 3.5;
        const finalZ = z + (pseudoRandom(x + 789, z + 101) - 0.5) * step * 3.5;

        if (getWaterValue(finalX, finalZ) > (WATER_THRESHOLD - BEACH_MARGIN)) continue;

        const prng = Math.abs(pseudoRandom(finalX * 2, finalZ * 2));
        const biomeVal = noise2D(finalX * 0.03, finalZ * 0.03);

        // TREES
        if (biomeVal > TREE_THRESHOLD && pseudoRandom(finalX, finalZ) > 0.45) {
          const treeScale = 0.4 + pseudoRandom(finalX * 2, finalZ * 2) * 1.5;
          const treeHeight = 0.5 + pseudoRandom(finalZ * 3, finalX * 3) * 3.5;

          // Regra: Troncos podem ser finos ou grossos independente da altura
          const trunkWidth = treeScale * (0.3 + pseudoRandom(finalX * 5, finalZ * 5) * 1.2);

          // Variedade de folhagem: 0 = Cone, 1 = Esfera
          const foliageType = pseudoRandom(finalX * 10, finalZ * 10) > 0.6 ? 1 : 0;

          trees.push({
            position: [finalX, 0, finalZ],
            scale: treeScale,
            heightScale: treeHeight,
            trunkWidth: trunkWidth,
            rotation: prng * Math.PI * 2,
            type: foliageType,
            collisionHeight: treeHeight * 2.0, // Árvores são cilindros verticais
            collisionRadius: trunkWidth * 0.4
          });
        }
        // ROCKS
        else if (biomeVal < -ROCK_THRESHOLD && pseudoRandom(finalZ * 1.1, finalX * 1.1) > 0.55) {
          const rScale = 0.1 + Math.pow(pseudoRandom(finalX, finalZ), 3) * 2.5;
          const rHeight = 0.1 + Math.pow(pseudoRandom(finalZ, finalX), 2) * 1.5;
          const rRot = prng * Math.PI * 2;
          
          // Cálculo preciso do Bounding Box da pedra rotacionada (Matriz de Rotação Absoluta)
          // Rotação: X=rot, Y=rot*2, Z=rot*0.5
          const ax = rRot, ay = rRot * 2, az = rRot * 0.5;
          const cx = Math.cos(ax), sx = Math.sin(ax);
          const cy = Math.cos(ay), sy = Math.sin(ay);
          const cz = Math.cos(az), sz = Math.sin(az);

          // Elementos da matriz de rotação (Ordem XYZ do Three.js)
          const r11 = cy * cz;
          const r12 = -cy * sz;
          const r13 = sy;
          const r21 = cx * sz + sx * sy * cz;
          const r22 = cx * cz - sx * sy * sz;
          const r23 = -sx * cy;
          const r31 = sx * sz - cx * sy * cz;
          const r32 = sx * cz + cx * sy * sz;
          const r33 = cx * cy;

          // Extensão máxima em cada eixo (AABB para Elipsoide/Esfera - muito mais justo que para Cubo)
          const hExt = Math.sqrt(Math.pow(r21 * rScale, 2) + Math.pow(r22 * rHeight, 2) + Math.pow(r23 * rScale, 2));
          const wExt = Math.sqrt(Math.pow(r11 * rScale, 2) + Math.pow(r12 * rHeight, 2) + Math.pow(r13 * rScale, 2));
          const dExt = Math.sqrt(Math.pow(r31 * rScale, 2) + Math.pow(r32 * rHeight, 2) + Math.pow(r33 * rScale, 2));

          const yCenter = rHeight * 0.3;
          const collisionHeight = yCenter + hExt;
          const collisionRadius = Math.max(wExt, dExt) * 0.85; // Ajuste para 0.85 para ficar bem rente à pedra

          rocks.push({
            position: [finalX, 0, finalZ],
            scale: rScale,
            heightScale: rHeight,
            trunkWidth: 1, 
            rotation: rRot,
            type: 0,
            collisionHeight,
            collisionRadius
          });
        }
      }
    }

    // --- SECOND PASS: GRASS AND EDIBLES ---
    for (let x = startX; x < startX + CHUNK_SIZE; x += step) {
      for (let z = startZ; z < startZ + CHUNK_SIZE; z += step) {
        const finalX = x + (pseudoRandom(x + 1, z + 1) - 0.5) * step * 3.0;
        const finalZ = z + (pseudoRandom(x + 2, z + 2) - 0.5) * step * 3.0;
        const biomeVal = noise2D(finalX * 0.03, finalZ * 0.03);
        const grassVal = grassNoise2D(finalX * 0.05, finalZ * 0.05);

        if (getWaterValue(finalX, finalZ) > (WATER_THRESHOLD - BEACH_MARGIN)) continue;

        // GRASS
        if (grassVal > GRASS_THRESHOLD && pseudoRandom(finalX * 4, finalZ * 4) > 0.2) {
          // A intensidade do capim depende do quão alto é o noise
          // Pode gerar de 1 a 6+ moitas de capim na mesma célula
          const grassDensity = Math.floor((grassVal - GRASS_THRESHOLD) * 15) + 1;
          const numGrass = Math.min(8, grassDensity);

          for (let i = 0; i < numGrass; i++) {
            const gx = finalX + (pseudoRandom(finalX + i, finalZ) - 0.5) * 2.5;
            const gz = finalZ + (pseudoRandom(finalZ, finalX + i) - 0.5) * 2.5;
            if (getWaterValue(gx, gz) <= (WATER_THRESHOLD - BEACH_MARGIN)) {
              grass.push({
                position: [gx, 0, gz],
                scale: 0.1 + pseudoRandom(gx, gz) * 0.3,
                heightScale: 0.2 + pseudoRandom(gz, gx) * 0.8,
                trunkWidth: 1,
                rotation: pseudoRandom(gx * 2, gz * 2) * Math.PI * 2,
                type: 0,
                collisionHeight: 0,
                collisionRadius: 0
              });
            }
          }
        }

        // EDIBLES: Check distance to ALL trees and rocks in this chunk
        let blocked = false;
        const minDistanceSq = 6.25; // 2.5 * 2.5
        
        for (const t of trees) {
          // Early rejection no eixo X (muito rápido)
          if (Math.abs(t.position[0] - finalX) > 2.5) continue;
          const d2 = (t.position[0] - finalX)**2 + (t.position[2] - finalZ)**2;
          if (d2 < minDistanceSq) { blocked = true; break; }
        }
        if (!blocked) {
          for (const r of rocks) {
            if (Math.abs(r.position[0] - finalX) > 2.5) continue;
            const d2 = (r.position[0] - finalX)**2 + (r.position[2] - finalZ)**2;
            if (d2 < minDistanceSq) { blocked = true; break; }
          }
        }

        if (!blocked) {
          const prng = Math.abs(pseudoRandom(finalX, finalZ));
          // Plants
          if (biomeVal > 0.1 && pseudoRandom(finalX * 7, finalZ * 7) > 0.88) {
            edibles.push({
              id: `p_${Math.round(finalX)}_${Math.round(finalZ)}`,
              type: 'Plant',
              position: [finalX, 0.0, finalZ],
              scale: 0.5 + pseudoRandom(finalX, finalZ) * 1.5,
              rotation: prng * Math.PI * 2
            });
          }
          // Meat (Um pouco mais raras)
          else if (pseudoRandom(finalZ * 8, finalX * 8) > 0.99) {
            edibles.push({
              id: `m_${Math.round(finalX)}_${Math.round(finalZ)}`,
              type: 'Meat',
              position: [finalX, 0.0, finalZ],
              // Distribuição viciada em pedaços de carne menores
              scale: 0.2 + Math.pow(pseudoRandom(finalZ, finalX), 3) * 1.5,
              rotation: prng * Math.PI * 2
            });
          }
        }
      }
    }

    const chunkData = { id: `${chunkX},${chunkZ}`, x: chunkX, z: chunkZ, trees, rocks, grass, water, edibles };
    this.chunkCache.set(id, chunkData);
    this.touchChunk(id, chunkX, chunkZ);
    return chunkData;
  }

  static getChunksAround(playerX: number, playerZ: number, radius: number = 1): ChunkData[] {
    const chunks: ChunkData[] = [];
    const currentChunkX = Math.floor(playerX / CHUNK_SIZE);
    const currentChunkZ = Math.floor(playerZ / CHUNK_SIZE);

    for (let x = -radius; x <= radius; x++) {
      for (let z = -radius; z <= radius; z++) {
        chunks.push(this.getChunk(currentChunkX + x, currentChunkZ + z));
      }
    }

    this.evictChunkCache(currentChunkX, currentChunkZ, radius);
    return chunks;
  }
}
