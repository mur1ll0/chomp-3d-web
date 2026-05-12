import type { IBehaviorStrategy } from '../../interfaces/IBehaviorStrategy';
import type { Diet } from '../../models/DinosaurStats';
import { CarnivoreStrategy } from '../CarnivoreStrategy';
import { HerbivoreStrategy } from '../HerbivoreStrategy';

export class NpcBehaviorFactory {
  createForSpecies(speciesId: string, diet: Diet): IBehaviorStrategy {
    switch (speciesId) {
      case 'Trex':
      case 'Velociraptor':
        return new CarnivoreStrategy();
      case 'Triceratops':
      case 'Stegosaurus':
      case 'Parasaurolophus':
      case 'Apatosaurus':
        return new HerbivoreStrategy();
      default:
        return diet === 'Carnivore' ? new CarnivoreStrategy() : new HerbivoreStrategy();
    }
  }
}
