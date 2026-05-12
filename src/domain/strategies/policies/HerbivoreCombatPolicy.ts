import type { ICombatPolicy } from '../../interfaces/ICombatPolicy';
import type { Diet } from '../../models/DinosaurStats';
import type { NPCData } from '../../models/NPCDinosaur';

export class HerbivoreCombatPolicy implements ICombatPolicy {
  shouldAttackPlayer(npc: NPCData, _playerLevel: number, _playerDiet: Diet): boolean {
    void _playerLevel;
    void _playerDiet;
    return npc.retaliatePlayerPackTimer > 0;
    // Herbívoros só atacam player para defender o bando após agressão.
  }

  /**
   * Permite ataque se é contra carnívoro que está atacando o bando.
   * Herbívoros só atacam em defesa, não por agressão.
   */
  canAttackNpcTarget(npc: NPCData, target: NPCData): boolean {
    // Pode atacar carnívoro se está defendendo bando contra ele
    if (npc.defendingCarnivoreId === target.id && target.diet === 'Carnivore') {
      return true;
    }

    return false;
  }
}
