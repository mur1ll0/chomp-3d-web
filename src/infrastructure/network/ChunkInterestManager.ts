export const CHUNK_SIZE = 50;
const MAX_CONNECTIONS = 30;

export interface ChunkPos {
  x: number;
  z: number;
}

export function worldToChunk(worldX: number, worldZ: number): ChunkPos {
  return { x: Math.floor(worldX / CHUNK_SIZE), z: Math.floor(worldZ / CHUNK_SIZE) };
}

function chunkDistance(a: ChunkPos, b: ChunkPos): number {
  return Math.abs(a.x - b.x) + Math.abs(a.z - b.z);
}

interface PeerChunkInfo extends ChunkPos {
  renderDistance: number;
}

export class ChunkInterestManager {
  private _playerChunk: ChunkPos = { x: 0, z: 0 };
  private _interestRadius = 2;
  private _peerChunks = new Map<string, PeerChunkInfo>();

  onChunkChanged: ((oldPos: ChunkPos, newPos: ChunkPos) => void) | null = null;

  setPlayerPosition(worldX: number, worldZ: number): ChunkPos {
    const newChunk = worldToChunk(worldX, worldZ);
    if (newChunk.x !== this._playerChunk.x || newChunk.z !== this._playerChunk.z) {
      const oldPos = { ...this._playerChunk };
      this._playerChunk = newChunk;
      this.onChunkChanged?.(oldPos, newChunk);
    }
    return this._playerChunk;
  }

  get playerChunk(): ChunkPos {
    return this._playerChunk;
  }

  updateInterestRadius(radius: number): void {
    this._interestRadius = Math.max(1, Math.min(6, radius));
  }

  get interestRadius(): number {
    return this._interestRadius;
  }

  updatePeerChunk(peerId: string, cx: number, cz: number, renderDistance = 2): boolean {
    const existing = this._peerChunks.get(peerId);
    if (existing && existing.x === cx && existing.z === cz && existing.renderDistance === renderDistance) {
      return false;
    }
    this._peerChunks.set(peerId, { x: cx, z: cz, renderDistance });
    return true;
  }

  removePeer(peerId: string): void {
    this._peerChunks.delete(peerId);
  }

  getPeersInInterestZone(): string[] {
    const result: string[] = [];
    for (const [peerId, pos] of this._peerChunks) {
      if (this.shouldConnect(pos)) {
        result.push(peerId);
      }
    }
    return result;
  }

  getPeersInExactChunk(cx: number, cz: number): string[] {
    const result: string[] = [];
    for (const [peerId, pos] of this._peerChunks) {
      if (pos.x === cx && pos.z === cz) {
        result.push(peerId);
      }
    }
    return result;
  }

  isPeerInInterest(peerId: string): boolean {
    const pos = this._peerChunks.get(peerId);
    if (!pos) return false;
    return this.shouldConnect(pos);
  }

  private shouldConnect(peerChunk: PeerChunkInfo): boolean {
    const dist = chunkDistance(this._playerChunk, peerChunk);
    const myInterest = dist <= this._interestRadius;
    const theirInterest = dist <= peerChunk.renderDistance;
    return myInterest || theirInterest;
  }

  getConnectedPeersByPriority(): string[] {
    const candidates = this.getPeersInInterestZone();
    candidates.sort((a, b) => {
      const pa = this._peerChunks.get(a)!;
      const pb = this._peerChunks.get(b)!;
      return chunkDistance(this._playerChunk, pa) - chunkDistance(this._playerChunk, pb);
    });
    return candidates.slice(0, MAX_CONNECTIONS);
  }

  getPeerChunk(peerId: string): PeerChunkInfo | undefined {
    return this._peerChunks.get(peerId);
  }

  getAllPeers(): IterableIterator<[string, PeerChunkInfo]> {
    return this._peerChunks.entries();
  }

  get peerCount(): number {
    return this._peerChunks.size;
  }

  clear(): void {
    this._peerChunks.clear();
  }
}
