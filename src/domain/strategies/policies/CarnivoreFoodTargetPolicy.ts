import type { IFoodTargetPolicy, FoodSearchContext, FoodTarget } from '../../interfaces/IFoodTargetPolicy';
import type { NPCData } from '../../models/NPCDinosaur';
import { NPCState } from '../../models/NPCState';

export class CarnivoreFoodTargetPolicy implements IFoodTargetPolicy {
  foodRadius = 35;

  findFood(npc: NPCData, context: FoodSearchContext): FoodTarget | null {
    const { nearbyNPCs, ediblePositions, playerPos, playerLevel } = context;
    const foodRadiusSq = this.foodRadius * this.foodRadius;
    let bestDist = Infinity;
    let bestTarget: FoodTarget | null = null;

    for (const other of nearbyNPCs) {
      if (other.id === npc.id || other.state === NPCState.Dead) continue;
      const levelAdvantage = other.diet === 'Herbivore' ? 2 : 0;
      if (other.level > npc.level + levelAdvantage) continue;

      const dx = other.posX - npc.posX;
      const dz = other.posZ - npc.posZ;
      const distSq = dx * dx + dz * dz;

      if (distSq < foodRadiusSq && distSq < bestDist) {
        bestDist = distSq;
        bestTarget = { x: other.posX, z: other.posZ, targetId: other.id, scale: other.level * 0.1 };
      }
    }

    if (playerLevel <= npc.level + 2) {
      const dx = playerPos.x - npc.posX;
      const dz = playerPos.z - npc.posZ;
      const distSq = dx * dx + dz * dz;

      if (distSq < foodRadiusSq && distSq < bestDist) {
        bestDist = distSq;
        bestTarget = { x: playerPos.x, z: playerPos.z, targetId: 'player', scale: 1.0 };
      }
    }

    if (!bestTarget) {
      for (const edible of ediblePositions) {
        if (edible.type !== 'Meat') continue;

        const dx = edible.x - npc.posX;
        const dz = edible.z - npc.posZ;
        const distSq = dx * dx + dz * dz;

        if (distSq < foodRadiusSq && distSq < bestDist) {
          bestDist = distSq;
          bestTarget = { x: edible.x, z: edible.z, targetId: edible.id, scale: edible.scale };
        }
      }
    }

    return bestTarget;
  }
}
