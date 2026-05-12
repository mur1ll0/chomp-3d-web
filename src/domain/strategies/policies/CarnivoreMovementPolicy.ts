import type { IMovementPolicy, FleeDestinationContext, MovementIntentContext, WanderDestination, WanderDestinationContext } from '../../interfaces/IMovementPolicy';
import { NPCState } from '../../models/NPCState';

function seededNoise(x: number, z: number, salt: number = 0): number {
  return Math.abs((Math.sin((x + salt) * 12.9898 + (z + salt) * 78.233) * 43758.5453) % 1);
}

export class CarnivoreMovementPolicy implements IMovementPolicy {
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

  pickWanderDestination(context: WanderDestinationContext): WanderDestination {
    const { npc, random } = context;

    return {
      x: npc.posX + (random.next() - 0.5) * 40,
      z: npc.posZ + (random.next() - 0.5) * 40,
      timer: 2 + random.next() * 4,
    };
  }

  getMovementIntent(context: MovementIntentContext): { baseSpeed: number; animationIntent: 'Walk' | 'Run' } {
    const { npc, stats, dist, npcsById } = context;

    if (npc.state === NPCState.Fleeing) {
      return { baseSpeed: stats.runSpeed, animationIntent: 'Run' };
    }

    if (npc.state !== NPCState.Hunting) {
      return { baseSpeed: stats.walkSpeed, animationIntent: 'Walk' };
    }

    const isStaticFood = npc.huntingTargetId && !npc.huntingTargetId.startsWith('npc_') && npc.huntingTargetId !== 'player';

    if (isStaticFood) {
      return { baseSpeed: stats.walkSpeed, animationIntent: 'Walk' };
    }

    let preyFleeing = false;
    if (npc.huntingTargetId && npc.huntingTargetId !== 'player') {
      const prey = npcsById.get(npc.huntingTargetId);
      if (prey && prey.state === NPCState.Fleeing) preyFleeing = true;
    }

    if (dist < 15 || preyFleeing) {
      return { baseSpeed: stats.runSpeed, animationIntent: 'Run' };
    }

    return { baseSpeed: stats.walkSpeed, animationIntent: 'Walk' };
  }
}
