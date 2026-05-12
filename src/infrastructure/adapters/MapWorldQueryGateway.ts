import { MapGenerator, WATER_THRESHOLD, getWaterValue } from '../generation/MapGenerator';
import type { IWorldQueryGateway, WorldEdiblePoint, WorldObstacle } from '../../useCases/game/contracts/IWorldQueryGateway';

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

  getNearbyObstacles(playerX: number, playerZ: number, radius: number): WorldObstacle[] {
    const chunks = MapGenerator.getChunksAround(playerX, playerZ, radius);
    const result: WorldObstacle[] = [];

    for (const chunk of chunks) {
      for (const tree of chunk.trees) {
        const foliageHorizontalScale = tree.trunkWidth * 2.5 + (tree.heightScale * 0.2);
        const foliageVerticalScale = tree.heightScale * 0.4 + tree.trunkWidth * 1.5;
        const foliageCenterY = tree.heightScale * 2 + foliageVerticalScale * 0.5;

        result.push({
          type: 'TreeTrunk',
          x: tree.position[0],
          z: tree.position[2],
          radius: Math.max(0.1, tree.collisionRadius),
          baseY: 0,
          height: Math.max(0.2, tree.collisionHeight),
          blocksMovement: true,
          blocksVision: true,
        });

        result.push({
          type: 'TreeFoliage',
          x: tree.position[0],
          z: tree.position[2],
          radius: Math.max(0.2, foliageHorizontalScale),
          baseY: Math.max(0, foliageCenterY - foliageVerticalScale),
          height: Math.max(0.3, foliageVerticalScale * 2),
          blocksMovement: false,
          blocksVision: true,
        });
      }

      for (const rock of chunk.rocks) {
        result.push({
          type: 'Rock',
          x: rock.position[0],
          z: rock.position[2],
          radius: Math.max(0.1, rock.collisionRadius),
          baseY: 0,
          height: Math.max(0.2, rock.collisionHeight),
          blocksMovement: true,
          blocksVision: true,
        });
      }
    }

    return result;
  }
}
