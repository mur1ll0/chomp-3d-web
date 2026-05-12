import type { IFoodTargetPolicy, FoodSearchContext, FoodTarget } from '../../interfaces/IFoodTargetPolicy';
import type { NPCData } from '../../models/NPCDinosaur';

export class HerbivoreFoodTargetPolicy implements IFoodTargetPolicy {
  foodRadius = 30;

  findFood(npc: NPCData, context: FoodSearchContext): FoodTarget | null {
    const { ediblePositions } = context;
    const foodRadiusSq = this.foodRadius * this.foodRadius;
    let bestDist = Infinity;
    let bestTarget: FoodTarget | null = null;

    for (const edible of ediblePositions) {
      if (edible.type !== 'Plant') continue;

      const dx = edible.x - npc.posX;
      const dz = edible.z - npc.posZ;
      const distSq = dx * dx + dz * dz;

      if (distSq < foodRadiusSq && distSq < bestDist) {
        bestDist = distSq;
        bestTarget = { x: edible.x, z: edible.z, targetId: edible.id, scale: edible.scale };
      }
    }

    return bestTarget;
  }
}
