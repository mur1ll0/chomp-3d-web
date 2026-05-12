import type { ICombatPolicy } from './ICombatPolicy';
import type { IFoodTargetPolicy } from './IFoodTargetPolicy';
import type { IMovementPolicy } from './IMovementPolicy';
import type { IThreatPolicy } from './IThreatPolicy';

/**
 * Estratégia composta por políticas atômicas.
 * Cada política encapsula uma responsabilidade específica da IA.
 * Os campos são readonly para impedir substituição em runtime.
 */
export interface IBehaviorStrategy {
  readonly threatPolicy: IThreatPolicy;
  readonly foodTargetPolicy: IFoodTargetPolicy;
  readonly movementPolicy: IMovementPolicy;
  readonly combatPolicy: ICombatPolicy;
}
