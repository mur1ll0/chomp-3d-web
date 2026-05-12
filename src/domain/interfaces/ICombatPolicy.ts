import type { Diet } from '../models/DinosaurStats';
import type { NPCData } from '../models/NPCDinosaur';

export interface ICombatPolicy {
  shouldAttackPlayer(npc: NPCData, playerLevel: number, playerDiet: Diet): boolean;
  canAttackNpcTarget(npc: NPCData, target: NPCData): boolean;
}
