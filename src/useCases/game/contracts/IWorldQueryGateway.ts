export type WorldEdibleType = 'Meat' | 'Plant';

export interface WorldEdiblePoint {
  id: string;
  type: WorldEdibleType;
  x: number;
  z: number;
  scale: number;
}

export interface IWorldQueryGateway {
  /** Verifica se uma coordenada está em água. */
  isWaterAt(x: number, z: number): boolean;

  /** Lista recursos comestíveis do mundo ao redor de um ponto. */
  getNearbyEdibles(playerX: number, playerZ: number, radius: number): WorldEdiblePoint[];
}
