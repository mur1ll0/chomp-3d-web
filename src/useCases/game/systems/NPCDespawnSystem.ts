import type { NPCData } from '../../../domain/models/NPCDinosaur';

const CHUNK_SIZE = 50;
const DESPAWN_RADIUS = 4;

export class NPCDespawnSystem {
  despawnFarNPCs(args: {
    npcs: Map<string, NPCData>;
    spawnedChunks: Set<string>;
    playerChunkX: number;
    playerChunkZ: number;
  }): void {
    const { npcs, spawnedChunks, playerChunkX, playerChunkZ } = args;
    const keysToRemove: string[] = [];

    for (const [id, npc] of npcs) {
      const npcChunkX = Math.floor(npc.posX / CHUNK_SIZE);
      const npcChunkZ = Math.floor(npc.posZ / CHUNK_SIZE);

      const dx = Math.abs(npcChunkX - playerChunkX);
      const dz = Math.abs(npcChunkZ - playerChunkZ);

      if (dx > DESPAWN_RADIUS || dz > DESPAWN_RADIUS) {
        keysToRemove.push(id);
        spawnedChunks.delete(npc.spawnChunkId);
      }
    }

    for (const key of keysToRemove) {
      npcs.delete(key);
    }
  }
}
