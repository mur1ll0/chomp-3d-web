import type { Diet } from '../models/DinosaurStats';
import type { NPCData } from '../models/NPCDinosaur';

export interface ThreatContext {
  nearbyNPCs: NPCData[];
  playerPos: { x: number; z: number };
  playerLevel: number;
  playerDiet: Diet;
  playerStrength: number;
}

export interface IThreatPolicy {
  threatRadius: number;
  evaluateThreat(npc: NPCData, context: ThreatContext): string | null;

  /**
   * Determina se um NPC deve defender o bando contra um carnívoro detectado.
   * Apenas herbívoros implementam essa lógica (carnívoros sempre fogem ou atacam).
   * Retorna true se o NPC deve entrar em modo de defesa coletiva.
   */
  canDefendAgainstThreat?(
    npc: NPCData,
    threatId: string,
    allNPCs: NPCData[],
    npcsById?: Map<string, NPCData>
  ): boolean;
}
