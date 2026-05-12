import type { IThreatPolicy, ThreatContext } from '../../interfaces/IThreatPolicy';
import type { NPCData } from '../../models/NPCDinosaur';
import { NPCState } from '../../models/NPCState';

export class HerbivoreThreatPolicy implements IThreatPolicy {
  threatRadius = 25;
  packDetectionRadius = 60; // Raio para detectar aliados do mesmo bando
  juvenileLevel = 10; // Filhotes sempre fogem, nunca defendem

  evaluateThreat(npc: NPCData, context: ThreatContext): string | null {
    const { nearbyNPCs, playerPos, playerLevel, playerDiet } = context;
    const threatRadiusSq = this.threatRadius * this.threatRadius;

    // Player é carnívoro e ameaça?
    if (playerDiet === 'Carnivore') {
      const dx = playerPos.x - npc.posX;
      const dz = playerPos.z - npc.posZ;
      const distSq = dx * dx + dz * dz;
      
      if (distSq < threatRadiusSq && playerLevel >= npc.level - 3) {
        return 'player';
      }
    }

    // Procura por carnívoros em ameaça
    for (const other of nearbyNPCs) {
      if (other.id === npc.id || other.state === NPCState.Dead) continue;
      if (other.diet !== 'Carnivore') continue;

      const dx = other.posX - npc.posX;
      const dz = other.posZ - npc.posZ;
      const distSq = dx * dx + dz * dz;

      if (distSq < threatRadiusSq && other.level >= npc.level - 3) {
        return other.id;
      }
    }

    return null;
  }

  /**
   * Determina se um herbívoro deve defender o bando contra um carnívoro NPC.
   * Retorna true se:
   * - Não é filhote (level >= juvenileLevel)
   * - Há algum aliado da mesma espécie dentro de packDetectionRadius
   * Nota: defesa contra player é tratada diretamente no NPCFsmSystem.
   */
  canDefendAgainstThreat(
    npc: NPCData,
    threatId: string,
    allNPCs: NPCData[],
    _npcsById: Map<string, NPCData> | undefined
  ): boolean {
    void _npcsById;

    // Filhotes sempre fogem, nunca defendem
    if (npc.level < this.juvenileLevel) {
      return false;
    }

    // Ameaça de player é tratada no NPCFsmSystem com lógica própria
    if (threatId === 'player') {
      return false;
    }

    // Verifica se há aliado da mesma espécie em packDetectionRadius
    const packRadiusSq = this.packDetectionRadius * this.packDetectionRadius;
    for (const ally of allNPCs) {
      if (ally.id === npc.id || ally.state === NPCState.Dead) continue;
      if (ally.speciesId !== npc.speciesId) continue;

      const dx = ally.posX - npc.posX;
      const dz = ally.posZ - npc.posZ;
      if (dx * dx + dz * dz < packRadiusSq) {
        return true; // Tem suporte de bando — defende!
      }
    }

    return false; // Sozinho — foge
  }
}
