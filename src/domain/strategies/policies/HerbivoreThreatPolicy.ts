import type { IThreatPolicy, ThreatContext } from '../../interfaces/IThreatPolicy';
import type { NPCData } from '../../models/NPCDinosaur';
import { NPCState } from '../../models/NPCState';
import { DINOSAUR_ROSTER } from '../../models/DinosaurStats';
import { calculateBiteDamage } from '../../services/DinosaurService';

export class HerbivoreThreatPolicy implements IThreatPolicy {
  threatRadius = 25;
  packDetectionRadius = 40; // Raio para detectar aliados do mesmo bando
  juvenileLevel = 10; // Filhotes sempre fogem, nunca defendem
  biteForceDamageThreshold = 1.0; // Defende se herbívoro >= carnívoro (igualdade também defende)

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
   * Determina se um herbívoro deve defender o bando contra um carnívoro.
   * Retorna true se:
   * - Não é filhote
   * - Há bando presente (mesma espécie em packDetectionRadius)
   * - Herbívoro tem força >= carnívoro (ou pequena desvantagem)
   */
  canDefendAgainstThreat(
    npc: NPCData,
    threatId: string,
    allNPCs: NPCData[],
    npcsById: Map<string, NPCData> | undefined
  ): boolean {
    // Filhotes sempre fogem, nunca defendem
    if (npc.level < this.juvenileLevel) {
      return false;
    }

    // Se threatId é player, não temos referência direta (por enquanto, herbívoro não defende contra player)
    if (threatId === 'player') {
      return false;
    }

    // Obtém o carnívoro atacante
    const carnivore = npcsById?.get(threatId) || allNPCs.find(n => n.id === threatId);
    if (!carnivore || carnivore.state === NPCState.Dead) {
      return false;
    }

    // Verifica se há bando presente (mesma espécie em packDetectionRadius)
    const packRadiusSq = this.packDetectionRadius * this.packDetectionRadius;
    let hasPackSupport = false;

    for (const ally of allNPCs) {
      if (ally.id === npc.id || ally.state === NPCState.Dead) continue;
      if (ally.speciesId !== npc.speciesId) continue;

      const dx = ally.posX - npc.posX;
      const dz = ally.posZ - npc.posZ;
      if (dx * dx + dz * dz < packRadiusSq) {
        hasPackSupport = true;
        break;
      }
    }

    if (!hasPackSupport) {
      return false;
    }

    // Compara força de mordida
    const npcStats = DINOSAUR_ROSTER.find(d => d.id === npc.speciesId);
    const carnivoreStats = DINOSAUR_ROSTER.find(d => d.id === carnivore.speciesId);

    if (!npcStats || !carnivoreStats) {
      return false;
    }

    const npcBiteDamage = calculateBiteDamage(npcStats.strength, npc.level);
    const carnivoreBiteDamage = calculateBiteDamage(carnivoreStats.strength, carnivore.level);

    // Defende se herbívoro tem força >= carnívoro * threshold (igualdade defende)
    return npcBiteDamage >= carnivoreBiteDamage * this.biteForceDamageThreshold;
  }
}
