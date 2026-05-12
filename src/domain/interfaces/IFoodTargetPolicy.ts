import type { NPCData } from '../models/NPCDinosaur';

export interface FoodSourcePoint {
  x: number;
  z: number;
  id: string;
  type: string;
  scale: number;
}

export interface FoodSearchContext {
  nearbyNPCs: NPCData[];
  ediblePositions: FoodSourcePoint[];
  playerPos: { x: number; z: number };
  playerLevel: number;
  playerVisible: boolean;
  playerIsDead: boolean;
}

export interface FoodTarget {
  x: number;
  z: number;
  targetId: string | null;
  scale: number;
}

export interface IFoodTargetPolicy {
  foodRadius: number;
  findFood(npc: NPCData, context: FoodSearchContext): FoodTarget | null;
}
