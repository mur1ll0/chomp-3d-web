export const SPECIES_SHORT: Record<string, string> = {
  TRex: 'TREX',
  Velociraptor: 'RAPT',
  Triceratops: 'TRIC',
  Stegosaurus: 'STEG',
  Parasaurolophus: 'PARA',
  Apatosaurus: 'APAT',
};

export const SHORT_TO_SPECIES: Record<string, string> = {};
for (const [full, short] of Object.entries(SPECIES_SHORT)) {
  SHORT_TO_SPECIES[short] = full;
}

export interface PackCodeResult {
  speciesId: string;
  chunkX: number;
  chunkZ: number;
}

export class PackCodec {
  static encode(speciesId: string, chunkX: number, chunkZ: number): string {
    const short = SPECIES_SHORT[speciesId] ?? speciesId.slice(0, 4).toUpperCase();
    return `${short}-${chunkX}x${chunkZ}`;
  }

  static decode(code: string): PackCodeResult | null {
    const match = code.toUpperCase().match(/^([A-Z]{3,5})-(?:(-?\d+)x(-?\d+))$/);
    if (!match) return null;
    const [, short, cxStr, czStr] = match;
    const speciesId = SHORT_TO_SPECIES[short];
    if (!speciesId) return null;
    return {
      speciesId,
      chunkX: parseInt(cxStr, 10),
      chunkZ: parseInt(czStr, 10),
    };
  }

  static fromSpawnPosition(speciesId: string, chunkX: number, chunkZ: number): string {
    return PackCodec.encode(speciesId, chunkX, chunkZ);
  }
}
