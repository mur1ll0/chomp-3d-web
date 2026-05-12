import type { IBehaviorStrategy } from '../../interfaces/IBehaviorStrategy';
import type { Diet } from '../../models/DinosaurStats';
import { CarnivoreStrategy } from '../CarnivoreStrategy';
import { HerbivoreStrategy } from '../HerbivoreStrategy';

export class NpcBehaviorFactory {
  createForSpecies(_speciesId: string, diet: Diet): IBehaviorStrategy {
    return diet === 'Carnivore' ? new CarnivoreStrategy() : new HerbivoreStrategy();
  }
}
