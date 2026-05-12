import type { ICombatPolicy } from '../../interfaces/ICombatPolicy';
import type { Diet } from '../../models/DinosaurStats';
import type { NPCData } from '../../models/NPCDinosaur';

export class CarnivoreCombatPolicy implements ICombatPolicy {
  shouldAttackPlayer(npc: NPCData, playerLevel: number, playerDiet: Diet): boolean {
    void playerDiet;
    return npc.retaliatePlayerTimer > 0 || playerLevel <= npc.level + 2;
  }

  canAttackNpcTarget(npc: NPCData, target: NPCData): boolean {
    if (target.id === npc.id) return false;
    return true;
  }
}
