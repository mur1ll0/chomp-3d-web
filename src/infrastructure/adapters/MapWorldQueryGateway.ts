import { MapGenerator, WATER_THRESHOLD, getWaterValue } from '../generation/MapGenerator';
import type { IWorldQueryGateway, WorldEdiblePoint } from '../../useCases/game/contracts/IWorldQueryGateway';

export class MapWorldQueryGateway implements IWorldQueryGateway {
  isWaterAt(x: number, z: number): boolean {
    return getWaterValue(x, z) > WATER_THRESHOLD;
  }

  getNearbyEdibles(playerX: number, playerZ: number, radius: number): WorldEdiblePoint[] {
    const chunks = MapGenerator.getChunksAround(playerX, playerZ, radius);
    const result: WorldEdiblePoint[] = [];

    for (const chunk of chunks) {
      for (const edible of chunk.edibles) {
        result.push({
          id: edible.id,
          type: edible.type,
          x: edible.position[0],
          z: edible.position[2],
          scale: edible.scale,
        });
      }
    }

    return result;
  }
}
