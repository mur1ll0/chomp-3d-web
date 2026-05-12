export type WorldEdibleType = 'Meat' | 'Plant';

export interface WorldEdiblePoint {
  id: string;
  type: WorldEdibleType;
  x: number;
  z: number;
  scale: number;
}

export type WorldObstacleType = 'TreeTrunk' | 'TreeFoliage' | 'Rock';

export interface WorldObstacle {
  type: WorldObstacleType;
  x: number;
  z: number;
  radius: number;
  baseY: number;
  height: number;
  blocksMovement: boolean;
  blocksVision: boolean;
}

export interface IWorldQueryGateway {
  /** Verifica se uma coordenada está em água. */
  isWaterAt(x: number, z: number): boolean;

  /** Lista recursos comestíveis do mundo ao redor de um ponto. */
  getNearbyEdibles(playerX: number, playerZ: number, radius: number): WorldEdiblePoint[];

  /** Lista obstáculos para colisão, desvio e bloqueio de visão. */
  getNearbyObstacles(playerX: number, playerZ: number, radius: number): WorldObstacle[];
}
