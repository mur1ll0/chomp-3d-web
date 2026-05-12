import type { IBehaviorStrategy } from '../interfaces/IBehaviorStrategy';
import { HerbivoreCombatPolicy } from './policies/HerbivoreCombatPolicy';
import { HerbivoreFoodTargetPolicy } from './policies/HerbivoreFoodTargetPolicy';
import { HerbivoreMovementPolicy } from './policies/HerbivoreMovementPolicy';
import { HerbivoreThreatPolicy } from './policies/HerbivoreThreatPolicy';

/**
 * Estratégia de comportamento para dinossauros HERBÍVOROS.
 * - Foge de carnívoros maiores ou de mesmo nível
 * - Busca plantas para comer
 * - Não ataca outros dinossauros (exceto se encurralado - TODO futuro)
 */
export class HerbivoreStrategy implements IBehaviorStrategy {
  threatPolicy = new HerbivoreThreatPolicy();
  foodTargetPolicy = new HerbivoreFoodTargetPolicy();
  movementPolicy = new HerbivoreMovementPolicy();
  combatPolicy = new HerbivoreCombatPolicy();
}
