import type { IBehaviorStrategy } from '../interfaces/IBehaviorStrategy';
import { CarnivoreCombatPolicy } from './policies/CarnivoreCombatPolicy';
import { CarnivoreFoodTargetPolicy } from './policies/CarnivoreFoodTargetPolicy';
import { CarnivoreMovementPolicy } from './policies/CarnivoreMovementPolicy';
import { CarnivoreThreatPolicy } from './policies/CarnivoreThreatPolicy';

/**
 * Estratégia de comportamento para dinossauros CARNÍVOROS.
 * - Foge de carnívoros MUITO maiores (5+ níveis acima)
 * - Caça presas menores (herbívoros e carnívoros menores)
 * - Também caça o jogador se for menor
 * - Come carne do mapa se disponível
 */
export class CarnivoreStrategy implements IBehaviorStrategy {
  threatPolicy = new CarnivoreThreatPolicy();
  foodTargetPolicy = new CarnivoreFoodTargetPolicy();
  movementPolicy = new CarnivoreMovementPolicy();
  combatPolicy = new CarnivoreCombatPolicy();
}
