import type { NPCData } from '../../../domain/models/NPCDinosaur';
import { getNPCScaleFactor } from '../../../domain/models/NPCDinosaur';
import type { DinosaurStats } from '../../../domain/models/DinosaurStats';
import type { IBehaviorStrategy } from '../../../domain/interfaces/IBehaviorStrategy';
import { NPCState } from '../../../domain/models/NPCState';
import type { IWorldQueryGateway, WorldObstacle } from '../contracts/IWorldQueryGateway';

export class NPCMovementSystem {
  private movementRampByNpc = new Map<string, number>();

  /**
   * Limpa os recursos de um NPC despawnado.
   */
  cleanupNpc(npcId: string): void {
    this.movementRampByNpc.delete(npcId);
  }

  updateMovement(args: {
    npc: NPCData;
    stats: DinosaurStats;
    strategy: IBehaviorStrategy;
    dt: number;
    npcsById: Map<string, NPCData>;
    worldQuery: IWorldQueryGateway;
    obstacles: WorldObstacle[];
  }): void {
    const { npc, stats, strategy, dt, npcsById, worldQuery, obstacles } = args;

    if (npc.state === NPCState.Eating || npc.state === NPCState.Attacking) return;
    npc.jumpCooldown = Math.max(0, npc.jumpCooldown - dt);

    const dx = npc.targetX - npc.posX;
    const dz = npc.targetZ - npc.posZ;
    const distSq = dx * dx + dz * dz;
    const stopDistance = npc.state === NPCState.Hunting ? 0.12 : 1.0;
    const stopDistanceSq = stopDistance * stopDistance;
    const ramp = this.movementRampByNpc.get(npc.id) ?? 0;

    if (distSq < stopDistanceSq) {
      const nextRamp = Math.max(0, ramp - dt * 4.0);
      this.movementRampByNpc.set(npc.id, nextRamp);
      this.updateVerticalMotion(npc, stats, dt, worldQuery, obstacles, 0);
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
    const shouldRun = movementIntent.animationIntent === 'Run' && npc.stamina > 0 && !npc.isExhausted;

    if (npc.stamina <= 0 && !npc.isExhausted) {
      npc.isExhausted = true;
    } else if (npc.stamina >= 20 && npc.isExhausted) {
      npc.isExhausted = false;
    }

    npc.animationIntent = shouldRun ? 'Run' : 'Walk';

    const levelSpeedMod = npc.level < 20 ? (0.5 + ((npc.level - 1) / 19) * 0.5) : 1.0;
    const inWater = worldQuery.isWaterAt(npc.posX, npc.posZ);
    const waterMod = inWater ? 0.5 : 1.0;
    const nextRamp = Math.min(1.0, ramp + dt * 3.0);
    this.movementRampByNpc.set(npc.id, nextRamp);

    const baseSpeed = shouldRun ? stats.runSpeed : stats.walkSpeed;
    const speed = baseSpeed * levelSpeedMod * waterMod * nextRamp;

    let nx = dx / dist;
    let nz = dz / dist;

    const scale = getNPCScaleFactor(npc.level, stats);
    const npcRadius = Math.min(stats.collisionRadius * scale, 10.0);
    const maxStepHeight = 2.5 * scale;
    const lookAhead = Math.max(2.5, npcRadius + speed * 0.8);
    let steerX = nx;
    let steerZ = nz;
    let shouldJumpAssist = false;

    for (const obstacle of obstacles) {
      if (!obstacle.blocksMovement) continue;

      const relX = obstacle.x - npc.posX;
      const relZ = obstacle.z - npc.posZ;
      const forwardDot = relX * nx + relZ * nz;
      if (forwardDot <= 0 || forwardDot > lookAhead) continue;

      const lateralX = relX - nx * forwardDot;
      const lateralZ = relZ - nz * forwardDot;
      const lateralDist = Math.sqrt(lateralX * lateralX + lateralZ * lateralZ);
      const avoidThreshold = npcRadius + obstacle.radius + 0.7;

      if (lateralDist < avoidThreshold) {
        const invLateral = 1 / (lateralDist || 1);
        let awayX = -lateralX * invLateral;
        let awayZ = -lateralZ * invLateral;

        if (lateralDist < 0.001) {
          awayX = -nz;
          awayZ = nx;
        }

        const weight = (avoidThreshold - lateralDist) / avoidThreshold;
        const nearWeight = 1 - (forwardDot / lookAhead);
        const finalWeight = weight * Math.max(0.2, nearWeight);
        steerX += awayX * finalWeight * 1.8;
        steerZ += awayZ * finalWeight * 1.8;

        const obstacleTop = obstacle.baseY + obstacle.height;
        if (
          obstacle.type === 'Rock' &&
          npc.isGrounded &&
          npc.jumpCooldown <= 0 &&
          !inWater &&
          obstacleTop <= npc.posY + maxStepHeight + 0.6 &&
          forwardDot < npcRadius + obstacle.radius + 1.5
        ) {
          shouldJumpAssist = true;
        }
      }
    }

    const steerLen = Math.sqrt(steerX * steerX + steerZ * steerZ);
    if (steerLen > 0.0001) {
      nx = steerX / steerLen;
      nz = steerZ / steerLen;
    }

    if (shouldJumpAssist) {
      npc.yVelocity = 15.5 + (2.0 / Math.sqrt(scale));
      npc.isGrounded = false;
      npc.jumpCooldown = 1.2;
      npc.animationIntent = 'Jump';
    }

    npc.posX += nx * speed * dt;
    npc.posZ += nz * speed * dt;
    this.resolveObstacleCollisions(npc, npcRadius, maxStepHeight, obstacles);
    this.updateVerticalMotion(npc, stats, dt, worldQuery, obstacles, maxStepHeight);

    if (shouldRun) {
      npc.stamina = Math.max(0, npc.stamina - (10 * scale * dt));
    } else {
      npc.stamina = Math.min(npc.maxStamina, npc.stamina + (1.0 * dt));
    }

    const targetAngle = Math.atan2(nx, nz);
    let angleDiff = targetAngle - npc.rotY;
    while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
    while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
    npc.rotY += angleDiff * Math.min(1, 8 * dt);
  }

  private resolveObstacleCollisions(
    npc: NPCData,
    npcRadius: number,
    maxStepHeight: number,
    obstacles: WorldObstacle[]
  ): void {
    for (const obstacle of obstacles) {
      if (!obstacle.blocksMovement) continue;

      const dx = npc.posX - obstacle.x;
      const dz = npc.posZ - obstacle.z;
      const maxDist = npcRadius + obstacle.radius;
      const distSq = dx * dx + dz * dz;
      if (distSq >= maxDist * maxDist) continue;

      const dist = Math.sqrt(distSq) || 0.001;
      const obstacleTop = obstacle.baseY + obstacle.height;

      if (obstacle.type === 'Rock' && npc.posY >= obstacleTop - maxStepHeight) {
        continue;
      }

      const overlap = maxDist - dist;
      npc.posX += (dx / dist) * overlap * 1.1;
      npc.posZ += (dz / dist) * overlap * 1.1;
    }
  }

  private updateVerticalMotion(
    npc: NPCData,
    stats: DinosaurStats,
    dt: number,
    worldQuery: IWorldQueryGateway,
    obstacles: WorldObstacle[],
    maxStepHeight: number
  ): void {
    const scale = getNPCScaleFactor(npc.level, stats);
    const inWater = worldQuery.isWaterAt(npc.posX, npc.posZ);
    let groundY = inWater ? -3 * scale : 0;

    for (const obstacle of obstacles) {
      if (!obstacle.blocksMovement || obstacle.type !== 'Rock') continue;

      const dx = npc.posX - obstacle.x;
      const dz = npc.posZ - obstacle.z;
      const distSq = dx * dx + dz * dz;
      const rockSupportDist = stats.collisionRadius * scale + obstacle.radius;
      if (distSq > rockSupportDist * rockSupportDist) continue;

      const obstacleTop = obstacle.baseY + obstacle.height;
      if (npc.posY >= obstacleTop - maxStepHeight) {
        groundY = Math.max(groundY, obstacleTop);
      }
    }

    if (!npc.isGrounded || npc.posY > groundY + 0.1) {
      const gravityForce = 100;
      npc.yVelocity -= gravityForce * dt;
      npc.posY += npc.yVelocity * dt;

      if (npc.posY <= groundY) {
        npc.posY = groundY;
        npc.yVelocity = 0;
        npc.isGrounded = true;
      }
      return;
    }

    if (npc.posY < groundY - 0.1) {
      npc.posY = npc.posY + (groundY - npc.posY) * Math.min(1, 10 * dt);
      return;
    }

    npc.posY = groundY;
    npc.isGrounded = true;
  }
}
