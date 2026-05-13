import type { Diet } from '../../../domain/models/DinosaurStats';
import type { WorldObstacle } from '../contracts/IWorldQueryGateway';

export interface NpcPerceptionProfile {
  viewDistance: number;
  eyeHeight: number;
  halfFovRad: number;
}

export function getNpcPerceptionProfile(diet: Diet): NpcPerceptionProfile {
  if (diet === 'Herbivore') {
    return {
      viewDistance: 34,
      eyeHeight: 2.2,
      halfFovRad: (165 * Math.PI) / 360,
    };
  }

  return {
    viewDistance: 38,
    eyeHeight: 2.4,
    halfFovRad: (150 * Math.PI) / 360,
  };
}

/**
 * Verifica se um alvo está atrás do NPC (fora do FOV atual).
 * Usado para detectar perda de visão durante ataque/perseguição.
 */
export function isTargetBehindNpc(
  npc: { posX: number; posZ: number; rotY: number },
  targetX: number,
  targetZ: number,
  halfFovRad: number
): boolean {
  return !isTargetInsideFov(
    npc,
    targetX,
    targetZ,
    halfFovRad,
    Infinity
  );
}

export function isTargetInsideFov(
  npc: { posX: number; posZ: number; rotY: number },
  targetX: number,
  targetZ: number,
  halfFovRad: number,
  viewDistance: number
): boolean {
  const dx = targetX - npc.posX;
  const dz = targetZ - npc.posZ;
  const distSq = dx * dx + dz * dz;
  const viewDistSq = viewDistance * viewDistance;

  if (distSq <= 9) {
    return true;
  }

  if (distSq > viewDistSq) {
    return false;
  }

  const invDist = 1 / (Math.sqrt(distSq) || 1);
  const dirX = dx * invDist;
  const dirZ = dz * invDist;
  const forwardX = Math.sin(npc.rotY);
  const forwardZ = Math.cos(npc.rotY);
  const dot = dirX * forwardX + dirZ * forwardZ;

  return dot >= Math.cos(halfFovRad);
}

export function isLineOfSightBlocked(
  startX: number,
  startY: number,
  startZ: number,
  endX: number,
  endY: number,
  endZ: number,
  obstacles: WorldObstacle[]
): boolean {
  const segX = endX - startX;
  const segZ = endZ - startZ;
  const segLenSq = segX * segX + segZ * segZ;

  if (segLenSq <= 0.0001) {
    return false;
  }

  for (const obstacle of obstacles) {
    if (!obstacle.blocksVision) continue;

    const tRaw = ((obstacle.x - startX) * segX + (obstacle.z - startZ) * segZ) / segLenSq;
    const t = Math.max(0, Math.min(1, tRaw));

    const closestX = startX + segX * t;
    const closestZ = startZ + segZ * t;
    const ox = closestX - obstacle.x;
    const oz = closestZ - obstacle.z;
    const radialDistSq = ox * ox + oz * oz;

    if (radialDistSq > obstacle.radius * obstacle.radius) continue;

    const yAtClosest = startY + (endY - startY) * t;
    const topY = obstacle.baseY + obstacle.height;
    if (yAtClosest >= obstacle.baseY && yAtClosest <= topY) {
      return true;
    }
  }

  return false;
}
