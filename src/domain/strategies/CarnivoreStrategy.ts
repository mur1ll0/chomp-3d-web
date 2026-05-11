import type { IBehaviorStrategy } from '../interfaces/IBehaviorStrategy';
import type { NPCData } from '../models/NPCDinosaur';
import { NPCState } from '../models/NPCState';

/**
 * Estratégia de comportamento para dinossauros CARNÍVOROS.
 * - Foge de carnívoros MUITO maiores (5+ níveis acima)
 * - Caça presas menores (herbívoros e carnívoros menores)
 * - Também caça o jogador se for menor
 * - Come carne do mapa se disponível
 */
export class CarnivoreStrategy implements IBehaviorStrategy {
  threatRadius = 20;
  foodRadius = 35;

  evaluateThreat(
    npc: NPCData,
    nearbyNPCs: NPCData[],
    playerPos: { x: number; z: number },
    playerLevel: number,
    _playerDiet: string
  ): string | null {
    const threatRadiusSq = this.threatRadius * this.threatRadius;

    // Carnívoro só foge de predadores MUITO maiores (5+ níveis acima)
    const fearThreshold = npc.level + 5;

    // Verifica jogador
    if (playerLevel >= fearThreshold) {
      const dx = playerPos.x - npc.posX;
      const dz = playerPos.z - npc.posZ;
      const distSq = dx * dx + dz * dz;
      if (distSq < threatRadiusSq) {
        return 'player';
      }
    }

    // Verifica outros NPCs
    for (const other of nearbyNPCs) {
      if (other.id === npc.id || other.state === NPCState.Dead) continue;
      if (other.diet !== 'Carnivore') continue;

      const dx = other.posX - npc.posX;
      const dz = other.posZ - npc.posZ;
      const distSq = dx * dx + dz * dz;

      if (distSq < threatRadiusSq && other.level >= fearThreshold) {
        return other.id;
      }
    }

    return null;
  }

  findFood(
    npc: NPCData,
    nearbyNPCs: NPCData[],
    ediblePositions: { x: number; z: number; id: string; type: string }[],
    playerPos: { x: number; z: number },
    playerLevel: number
  ): { x: number; z: number; targetId: string | null } | null {
    const foodRadiusSq = this.foodRadius * this.foodRadius;
    let bestDist = Infinity;
    let bestTarget: { x: number; z: number; targetId: string | null } | null = null;

    // Prioridade 1: NPCs menores (presas vivas)
    for (const other of nearbyNPCs) {
      if (other.id === npc.id || other.state === NPCState.Dead) continue;
      // Caça qualquer dino menor que ele (até 2 níveis acima se for herbívoro)
      const levelAdvantage = other.diet === 'Herbivore' ? 2 : 0;
      if (other.level > npc.level + levelAdvantage) continue;

      const dx = other.posX - npc.posX;
      const dz = other.posZ - npc.posZ;
      const distSq = dx * dx + dz * dz;

      if (distSq < foodRadiusSq && distSq < bestDist) {
        bestDist = distSq;
        bestTarget = { x: other.posX, z: other.posZ, targetId: other.id };
      }
    }

    // Prioridade 1b: Caçar o jogador se for menor
    if (playerLevel <= npc.level + 2) {
      const dx = playerPos.x - npc.posX;
      const dz = playerPos.z - npc.posZ;
      const distSq = dx * dx + dz * dz;

      if (distSq < foodRadiusSq && distSq < bestDist) {
        bestDist = distSq;
        bestTarget = { x: playerPos.x, z: playerPos.z, targetId: 'player' };
      }
    }

    // Prioridade 2: Carne no mapa (menos interessante que presas vivas)
    if (!bestTarget) {
      for (const edible of ediblePositions) {
        if (edible.type !== 'Meat') continue;

        const dx = edible.x - npc.posX;
        const dz = edible.z - npc.posZ;
        const distSq = dx * dx + dz * dz;

        if (distSq < foodRadiusSq && distSq < bestDist) {
          bestDist = distSq;
          bestTarget = { x: edible.x, z: edible.z, targetId: edible.id };
        }
      }
    }

    return bestTarget;
  }
}
