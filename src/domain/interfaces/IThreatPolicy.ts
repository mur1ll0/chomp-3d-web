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
}
