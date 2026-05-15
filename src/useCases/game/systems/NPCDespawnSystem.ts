import type { NPCData } from '../../../domain/models/NPCDinosaur';

const CHUNK_SIZE = 50;
const DESPAWN_RADIUS = 4;

export class NPCDespawnSystem {
  despawnFarNPCs(args: {
    npcs: Map<string, NPCData>;
    spawnedChunks: Set<string>;
    playerChunkX: number;
    playerChunkZ: number;
    remoteChunks?: Array<{ x: number; z: number }>;
  }): string[] {
    const { npcs, spawnedChunks, playerChunkX, playerChunkZ, remoteChunks } = args;
    const keysToRemove: string[] = [];

    for (const [id, npc] of npcs) {
      const npcChunkX = Math.floor(npc.posX / CHUNK_SIZE);
      const npcChunkZ = Math.floor(npc.posZ / CHUNK_SIZE);

      // Check if NPC is near ANY player (host or remote)
      const dxHost = Math.abs(npcChunkX - playerChunkX);
      const dzHost = Math.abs(npcChunkZ - playerChunkZ);
      let nearAnyPlayer = dxHost <= DESPAWN_RADIUS && dzHost <= DESPAWN_RADIUS;

      if (!nearAnyPlayer && remoteChunks) {
        for (const rc of remoteChunks) {
          if (Math.abs(npcChunkX - rc.x) <= DESPAWN_RADIUS && Math.abs(npcChunkZ - rc.z) <= DESPAWN_RADIUS) {
            nearAnyPlayer = true;
            break;
          }
        }
      }

      if (!nearAnyPlayer) {
        keysToRemove.push(id);
        spawnedChunks.delete(npc.spawnChunkId);
      }
    }

    for (const key of keysToRemove) {
      npcs.delete(key);
    }

    return keysToRemove;
  }
}
