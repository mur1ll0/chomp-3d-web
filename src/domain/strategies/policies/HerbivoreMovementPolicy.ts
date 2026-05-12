import type { IMovementPolicy, FleeDestinationContext, MovementIntentContext, WanderDestination, WanderDestinationContext } from '../../interfaces/IMovementPolicy';
import type { NPCData } from '../../models/NPCDinosaur';
import { NPCState } from '../../models/NPCState';

function seededNoise(x: number, z: number, salt: number = 0): number {
  return Math.abs((Math.sin((x + salt) * 12.9898 + (z + salt) * 78.233) * 43758.5453) % 1);
}

function findNearestAdultOfSpecies(npc: NPCData, allNPCs: NPCData[]): NPCData | null {
  let nearestAdult: NPCData | null = null;
  let bestDistSq = 900;

  for (const other of allNPCs) {
    if (other.id === npc.id || other.state === NPCState.Dead) continue;
    if (other.speciesId !== npc.speciesId || other.level < 10) continue;

    const dx = other.posX - npc.posX;
    const dz = other.posZ - npc.posZ;
    const distSq = dx * dx + dz * dz;

    if (distSq < bestDistSq) {
      bestDistSq = distSq;
      nearestAdult = other;
    }
  }

  return nearestAdult;
}

export class HerbivoreMovementPolicy implements IMovementPolicy {
  pickFleeDestination(context: FleeDestinationContext): { x: number; z: number } {
    const { npc, threatX, threatZ } = context;
    const dx = npc.posX - threatX;
    const dz = npc.posZ - threatZ;
    const dist = Math.sqrt(dx * dx + dz * dz) || 1;
    const deviate = (seededNoise(npc.posX, npc.posZ, 700) - 0.5) * 0.3;

    return {
      x: npc.posX + (dx / dist + deviate) * 30,
      z: npc.posZ + (dz / dist + deviate) * 30,
    };
  }

  /**
   * Escolhe posição para defender o bando contra carnívoro.
   * Aproxima-se do carnívoro para atacar, não fuge.
   */
  pickDefenseDestination(context: FleeDestinationContext): { x: number; z: number } {
    const { npc, threatX, threatZ } = context;
    const dx = threatX - npc.posX;
    const dz = threatZ - npc.posZ;
    const dist = Math.sqrt(dx * dx + dz * dz) || 1;
    
    // Aproxima-se até estar em alcance de ataque (~2-3 unidades)
    const approachDist = Math.max(2, dist - 3);
    
    return {
      x: npc.posX + (dx / dist) * approachDist,
      z: npc.posZ + (dz / dist) * approachDist,
    };
  }

  pickWanderDestination(context: WanderDestinationContext): WanderDestination {
    const { npc, allNPCs, random } = context;

    if (npc.level < 10) {
      const nearestAdult = findNearestAdultOfSpecies(npc, allNPCs);
      if (nearestAdult) {
        return {
          x: nearestAdult.posX + (random.next() - 0.5) * 6,
          z: nearestAdult.posZ + (random.next() - 0.5) * 6,
          timer: 1.5 + random.next() * 2.0,
        };
      }
    }

    let groupCenterX = npc.posX;
    let groupCenterZ = npc.posZ;
    let groupCount = 1;

    for (const other of allNPCs) {
      if (other.id === npc.id || other.state === NPCState.Dead) continue;
      if (other.speciesId !== npc.speciesId) continue;

      const dx = other.posX - npc.posX;
      const dz = other.posZ - npc.posZ;
      if (dx * dx + dz * dz < 1600) {
        groupCenterX += other.posX;
        groupCenterZ += other.posZ;
        groupCount++;
      }
    }

    groupCenterX /= groupCount;
    groupCenterZ /= groupCount;

    return {
      x: groupCenterX + (random.next() - 0.5) * 20,
      z: groupCenterZ + (random.next() - 0.5) * 20,
      timer: 2 + random.next() * 4,
    };
  }

  getMovementIntent(context: MovementIntentContext): { baseSpeed: number; animationIntent: 'Walk' | 'Run' } {
    const { npc, stats, dist } = context;

    if (npc.huntingTargetId === 'player' && npc.retaliatePlayerPackTimer > 0) {
      return { baseSpeed: stats.runSpeed, animationIntent: 'Run' };
    }

    // Corre quando fugindo de predador próximo
    if (npc.state === NPCState.Fleeing && dist < 12) {
      return { baseSpeed: stats.runSpeed, animationIntent: 'Run' };
    }

    // Corre quando defendendo bando (carnívoro dentro do threatRadius)
    if (npc.defendingCarnivoreId && dist < 25) {
      return { baseSpeed: stats.runSpeed, animationIntent: 'Run' };
    }

    // Corre quando caçando (vai atacar)
    if (npc.state === NPCState.Hunting && npc.defendingCarnivoreId && dist < 12) {
      return { baseSpeed: stats.runSpeed, animationIntent: 'Run' };
    }

    return { baseSpeed: stats.walkSpeed, animationIntent: 'Walk' };
  }
}
