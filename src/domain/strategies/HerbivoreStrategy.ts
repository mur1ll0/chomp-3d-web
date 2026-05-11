import type { IBehaviorStrategy } from '../interfaces/IBehaviorStrategy';
import type { NPCData } from '../models/NPCDinosaur';
import { NPCState } from '../models/NPCState';

/**
 * Estratégia de comportamento para dinossauros HERBÍVOROS.
 * - Foge de carnívoros maiores ou de mesmo nível
 * - Busca plantas para comer
 * - Não ataca outros dinossauros (exceto se encurralado - TODO futuro)
 */
export class HerbivoreStrategy implements IBehaviorStrategy {
  threatRadius = 25;
  foodRadius = 30;

  evaluateThreat(
    npc: NPCData,
    nearbyNPCs: NPCData[],
    playerPos: { x: number; z: number },
    playerLevel: number,
    playerDiet: string
  ): string | null {
    const threatRadiusSq = this.threatRadius * this.threatRadius;

    // Verifica se o jogador é uma ameaça (carnívoro com nível >= NPC)
    if (playerDiet === 'Carnivore') {
      const dx = playerPos.x - npc.posX;
      const dz = playerPos.z - npc.posZ;
      const distSq = dx * dx + dz * dz;
      if (distSq < threatRadiusSq && playerLevel >= npc.level - 3) {
        return 'player';
      }
    }

    // Verifica NPCs carnívoros próximos
    for (const other of nearbyNPCs) {
      if (other.id === npc.id || other.state === NPCState.Dead) continue;
      if (other.diet !== 'Carnivore') continue;

      const dx = other.posX - npc.posX;
      const dz = other.posZ - npc.posZ;
      const distSq = dx * dx + dz * dz;

      if (distSq < threatRadiusSq && other.level >= npc.level - 3) {
        return other.id;
      }
    }

    return null;
  }

  findFood(
    npc: NPCData,
    _nearbyNPCs: NPCData[],
    ediblePositions: { x: number; z: number; id: string; type: string }[],
    _playerPos: { x: number; z: number },
    _playerLevel: number
  ): { x: number; z: number; targetId: string | null } | null {
    const foodRadiusSq = this.foodRadius * this.foodRadius;
    let bestDist = Infinity;
    let bestTarget: { x: number; z: number; targetId: string | null } | null = null;

    for (const edible of ediblePositions) {
      if (edible.type !== 'Plant') continue;

      const dx = edible.x - npc.posX;
      const dz = edible.z - npc.posZ;
      const distSq = dx * dx + dz * dz;

      if (distSq < foodRadiusSq && distSq < bestDist) {
        bestDist = distSq;
        bestTarget = { x: edible.x, z: edible.z, targetId: edible.id };
      }
    }

    return bestTarget;
  }
}
