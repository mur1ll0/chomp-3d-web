import type { IThreatPolicy, ThreatContext } from '../../interfaces/IThreatPolicy';
import type { NPCData } from '../../models/NPCDinosaur';
import { NPCState } from '../../models/NPCState';
import { DINOSAUR_ROSTER } from '../../models/DinosaurStats';
import { calculateBiteDamage } from '../../services/DinosaurService';

export class CarnivoreThreatPolicy implements IThreatPolicy {
  threatRadius = 20;
  biteForceDamageThreshold = 1.0; // Foge sempre que o oponente for mais forte

  evaluateThreat(npc: NPCData, context: ThreatContext): string | null {
    const { nearbyNPCs, playerPos, playerLevel, playerDiet, playerStrength } = context;
    const threatRadiusSq = this.threatRadius * this.threatRadius;

    const npcStats = DINOSAUR_ROSTER.find(d => d.id === npc.speciesId);
    if (!npcStats) return null;

    const npcBiteDamage = calculateBiteDamage(npcStats.strength, npc.level);

    // Verifica ameaça do player por força de mordida real
    if (playerDiet === 'Carnivore') {
      const dx = playerPos.x - npc.posX;
      const dz = playerPos.z - npc.posZ;
      const distSq = dx * dx + dz * dz;
      
      if (distSq < threatRadiusSq) {
        const playerBiteDamage = calculateBiteDamage(playerStrength, playerLevel);
        if (playerBiteDamage > npcBiteDamage * this.biteForceDamageThreshold) {
          return 'player';
        }
      }
    }

    // Verifica ameaça de outros carnívoros
    for (const other of nearbyNPCs) {
      if (other.id === npc.id || other.state === NPCState.Dead) continue;
      if (other.diet !== 'Carnivore') continue;

      const dx = other.posX - npc.posX;
      const dz = other.posZ - npc.posZ;
      const distSq = dx * dx + dz * dz;

      if (distSq < threatRadiusSq) {
        // Compara força de mordida em vez de apenas nível
        const otherStats = DINOSAUR_ROSTER.find(d => d.id === other.speciesId);
        if (otherStats) {
          const otherBiteDamage = calculateBiteDamage(otherStats.strength, other.level);
          
          // Foge se o outro carnívoro for mais forte
          if (otherBiteDamage > npcBiteDamage * this.biteForceDamageThreshold) {
            return other.id;
          }
        }
      }
    }

    return null;
  }
}
