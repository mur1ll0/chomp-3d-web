import type { NPCData } from '../models/NPCDinosaur';

/**
 * Interface de estratégia de comportamento para NPCs.
 * Implementações concretas: CarnivoreStrategy, HerbivoreStrategy.
 * 
 * Design Pattern: Strategy
 * Permite trocar o comportamento de IA sem alterar a máquina de estados.
 */
export interface IBehaviorStrategy {
  /**
   * Determina se o NPC deve fugir de uma ameaça.
   * @returns ID da ameaça ou null se não há ameaça.
   */
  evaluateThreat(
    npc: NPCData,
    nearbyNPCs: NPCData[],
    playerPos: { x: number; z: number },
    playerLevel: number,
    playerDiet: string
  ): string | null;

  /**
   * Encontra o alvo de caça/alimentação mais próximo.
   * @returns Coordenadas do alvo ou null se nenhum disponível.
   */
  findFood(
    npc: NPCData,
    nearbyNPCs: NPCData[],
    ediblePositions: { x: number; z: number; id: string; type: string }[],
    playerPos: { x: number; z: number },
    playerLevel: number
  ): { x: number; z: number; targetId: string | null } | null;

  /** Raio de detecção de ameaças */
  threatRadius: number;

  /** Raio de detecção de comida */
  foodRadius: number;
}
