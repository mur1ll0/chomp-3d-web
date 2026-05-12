import type { ICombatPolicy } from './ICombatPolicy';
import type { IFoodTargetPolicy } from './IFoodTargetPolicy';
import type { IMovementPolicy } from './IMovementPolicy';
import type { IThreatPolicy } from './IThreatPolicy';

/**
 * Estratégia composta por políticas atômicas.
 * Cada política encapsula uma responsabilidade específica da IA.
 */
export interface IBehaviorStrategy {
  threatPolicy: IThreatPolicy;
  foodTargetPolicy: IFoodTargetPolicy;
  movementPolicy: IMovementPolicy;
  combatPolicy: ICombatPolicy;
}
