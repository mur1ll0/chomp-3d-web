import type { NPCData } from '../../../domain/models/NPCDinosaur';

/**
 * Interpolador de snapshots de NPCs para o client.
 * Mantém um buffer de 2 snapshots e interpola posições suavemente.
 */
export class NpcSnapshotInterpolator {
  private previousSnapshot: NPCData[] | null = null;
  private nextSnapshot: NPCData[] | null = null;
  private interpolationFactor = 0;
  private _isActive = false;

  pushSnapshot(npcs: NPCData[]): void {
    this.previousSnapshot = this.nextSnapshot;
    this.nextSnapshot = npcs;
    this.interpolationFactor = 0;
    this._isActive = this.previousSnapshot !== null && this.nextSnapshot !== null;
  }

  /** Retorna true se há interpolação ativa (novo snapshot chegou e ainda não estabilizou) */
  isActive(): boolean {
    return this._isActive;
  }

  /**
   * Avança o fator de interpolação.
   * Deve ser chamado a cada frame com o delta de tempo.
   * Retorna os NPCs interpolados para renderização.
   * Quando a interpolação completa, retorna o snapshot atual diretamente (sem alocação).
   */
  update(dt: number): NPCData[] {
    if (!this.nextSnapshot) return [];

    if (!this._isActive) {
      // Sem interpolação ativa, retorna o snapshot current sem alocar
      return this.nextSnapshot;
    }

    // Avança o fator de interpolação
    this.interpolationFactor += dt * 10; // ~300ms para completar a interpolação
    this.interpolationFactor = Math.min(1, this.interpolationFactor);

    // Se não tem snapshot anterior, retorna o atual sem interpolação
    if (!this.previousSnapshot) {
      return this.nextSnapshot;
    }

    // Se a interpolação completou, desativa e retorna o snapshot atual
    if (this.interpolationFactor >= 1) {
      this._isActive = false;
      return this.nextSnapshot;
    }

    // Interpola entre os dois snapshots
    const interpolated: NPCData[] = [];
    const nextMap = new Map<string, NPCData>();
    for (const npc of this.nextSnapshot) {
      nextMap.set(npc.id, npc);
    }

    for (const prev of this.previousSnapshot) {
      const next = nextMap.get(prev.id);
      if (!next) continue; // NPC despawneou, skip

      const t = this.interpolationFactor;

      const isHit = next.isHit || prev.isHit;

      interpolated.push({
        ...next,
        isHit,
        posX: prev.posX + (next.posX - prev.posX) * t,
        posY: prev.posY + (next.posY - prev.posY) * t,
        posZ: prev.posZ + (next.posZ - prev.posZ) * t,
        rotY: lerpAngle(prev.rotY, next.rotY, t),
      });
    }

    // Adiciona NPCs que só existem no snapshot atual
    for (const npc of this.nextSnapshot) {
      if (!this.previousSnapshot.find(p => p.id === npc.id)) {
        interpolated.push(npc);
      }
    }

    return interpolated;
  }

  reset(): void {
    this.previousSnapshot = null;
    this.nextSnapshot = null;
    this.interpolationFactor = 0;
    this._isActive = false;
  }
}

function lerpAngle(a: number, b: number, t: number): number {
  let diff = b - a;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  return a + diff * t;
}
