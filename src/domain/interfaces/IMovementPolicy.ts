import type { DinosaurStats } from '../models/DinosaurStats';
import type { NPCData } from '../models/NPCDinosaur';
import type { IRandomProvider } from './IRandomProvider';

export interface MovementIntent {
  baseSpeed: number;
  animationIntent: 'Walk' | 'Run';
}

export interface FleeDestinationContext {
  npc: NPCData;
  threatX: number;
  threatZ: number;
}

export interface WanderDestinationContext {
  npc: NPCData;
  allNPCs: NPCData[];
  random: IRandomProvider;
}

export interface WanderDestination {
  x: number;
  z: number;
  timer: number;
}

export interface MovementIntentContext {
  npc: NPCData;
  stats: DinosaurStats;
  dist: number;
  npcsById: Map<string, NPCData>;
}

export interface IMovementPolicy {
  pickFleeDestination(context: FleeDestinationContext): { x: number; z: number };
  pickWanderDestination(context: WanderDestinationContext): WanderDestination;
  getMovementIntent(context: MovementIntentContext): MovementIntent;
}
