export interface PackCodeResult {
  chunkX: number;
  chunkZ: number;
}

export class PackCodec {
  static encode(chunkX: number, chunkZ: number): string {
    return `CHUNK-${chunkX}x${chunkZ}`;
  }

  static decode(code: string): PackCodeResult | null {
    const match = code.toUpperCase().match(/^CHUNK-(?:(-?\d+)x(-?\d+))$/);
    if (!match) return null;
    return {
      chunkX: parseInt(match[1], 10),
      chunkZ: parseInt(match[2], 10),
    };
  }

  static fromSpawnPosition(_speciesId: string, chunkX: number, chunkZ: number): string {
    return PackCodec.encode(chunkX, chunkZ);
  }
}
