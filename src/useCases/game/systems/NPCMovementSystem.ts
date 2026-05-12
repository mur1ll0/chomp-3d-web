import type { NPCData } from '../../../domain/models/NPCDinosaur';
import { getNPCScaleFactor } from '../../../domain/models/NPCDinosaur';
import type { DinosaurStats } from '../../../domain/models/DinosaurStats';
import type { IBehaviorStrategy } from '../../../domain/interfaces/IBehaviorStrategy';
import { NPCState } from '../../../domain/models/NPCState';
import type { IWorldQueryGateway } from '../contracts/IWorldQueryGateway';

export class NPCMovementSystem {
  private movementRampByNpc = new Map<string, number>();

  updateMovement(args: {
    npc: NPCData;
    stats: DinosaurStats;
    strategy: IBehaviorStrategy;
    dt: number;
    npcsById: Map<string, NPCData>;
    worldQuery: IWorldQueryGateway;
  }): void {
    const { npc, stats, strategy, dt, npcsById, worldQuery } = args;

    if (npc.state === NPCState.Eating || npc.state === NPCState.Attacking) return;

    const dx = npc.targetX - npc.posX;
    const dz = npc.targetZ - npc.posZ;
    const distSq = dx * dx + dz * dz;
    const stopDistance = npc.state === NPCState.Hunting ? 0.12 : 1.0;
    const stopDistanceSq = stopDistance * stopDistance;
    const ramp = this.movementRampByNpc.get(npc.id) ?? 0;

    if (distSq < stopDistanceSq) {
      const nextRamp = Math.max(0, ramp - dt * 4.0);
      this.movementRampByNpc.set(npc.id, nextRamp);
      npc.animationIntent = 'Idle';
      return;
    }

    const dist = Math.sqrt(distSq);
    const movementIntent = strategy.movementPolicy.getMovementIntent({
      npc,
      stats,
      dist,
      npcsById,
    });

    npc.animationIntent = movementIntent.animationIntent;

    const levelSpeedMod = npc.level < 20 ? (0.5 + ((npc.level - 1) / 19) * 0.5) : 1.0;
    const inWater = worldQuery.isWaterAt(npc.posX, npc.posZ);
    const waterMod = inWater ? 0.5 : 1.0;
    const nextRamp = Math.min(1.0, ramp + dt * 3.0);
    this.movementRampByNpc.set(npc.id, nextRamp);

    const speed = movementIntent.baseSpeed * levelSpeedMod * waterMod * nextRamp;

    const nx = dx / dist;
    const nz = dz / dist;

    npc.posX += nx * speed * dt;
    npc.posZ += nz * speed * dt;
    npc.posY = inWater ? -3 * getNPCScaleFactor(npc.level, stats) : 0;

    const targetAngle = Math.atan2(nx, nz);
    let angleDiff = targetAngle - npc.rotY;
    while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
    while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
    npc.rotY += angleDiff * Math.min(1, 8 * dt);
  }
}
