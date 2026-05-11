import { NPCState } from './NPCState';
import type { DinosaurStats, Diet } from './DinosaurStats';

/**
 * Dados serializáveis de um NPC — sem referências a Three.js ou React.
 * Pode ser enviado por PeerJS diretamente (JSON-safe).
 */
export interface NPCData {
  id: string;
  speciesId: string;
  diet: Diet;
  level: number;
  health: number;
  maxHealth: number;
  state: NPCState;

  // Transform
  posX: number;
  posY: number;
  posZ: number;
  rotY: number;

  // AI internals
  targetX: number;
  targetZ: number;
  wanderTimer: number;
  attackCooldown: number;
  stateTimer: number; // Tempo no estado atual (para animações de duração fixa)
  fleeFromId: string | null; // ID de quem está fugindo

  // Visual state (para renderização)
  animationIntent: string; // 'Idle' | 'Walk' | 'Run' | 'Attack' | 'Eat' | 'Death'
  isHit: boolean; // Flash vermelho
  hitTimer: number;

  // Spawn metadata
  spawnChunkId: string;
}

/**
 * Calcula o fator de escala do NPC baseado no nível (mesma curva do jogador).
 */
export function getNPCScaleFactor(level: number, stats: DinosaurStats): number {
  const GLOBAL_SCALE_MODIFIER = 0.15;
  let currentScale = 1.0;
  if (level <= 20) {
    const progress = (level - 1) / 19;
    currentScale = stats.minScale + (stats.maxScale - stats.minScale) * progress;
  } else {
    const bonusProgress = Math.log10(1 + (level - 20) / 30);
    currentScale = stats.maxScale * (1 + bonusProgress);
  }
  return currentScale * GLOBAL_SCALE_MODIFIER;
}

/**
 * Calcula o dano que um dinossauro causa baseado na força e nível.
 * Segue a mesma curva de crescimento do tamanho:
 * - Filhote (nível 1): dano mínimo
 * - Adulto (nível 20): dano total = strength
 * - Acima de 20: crescimento logarítmico suave
 */
export function calculateDamage(strength: number, level: number): number {
  let levelFactor: number;
  if (level <= 20) {
    // De 0.05 (filhote) a 1.0 (adulto) — filhote não causa 0 dano
    levelFactor = 0.05 + ((level - 1) / 19) * 0.95;
  } else {
    // Crescimento logarítmico para níveis excedentes
    levelFactor = 1.0 + Math.log10(1 + (level - 20) / 30);
  }
  return strength * levelFactor;
}

/**
 * Cria um NPC com valores iniciais baseados nos stats da espécie.
 */
export function createNPC(
  id: string,
  stats: DinosaurStats,
  level: number,
  posX: number,
  posZ: number,
  chunkId: string
): NPCData {
  const levelFactor = level <= 20 ? (0.05 + ((level - 1) / 19) * 0.95) : (1.0 + Math.log10(1 + (level - 20) / 30));
  const maxHealth = Math.floor((stats.vitality * 10) * levelFactor);
  
  return {
    id,
    speciesId: stats.id,
    diet: stats.diet,
    level,
    health: maxHealth,
    maxHealth,
    state: NPCState.Wandering,

    posX,
    posY: 0,
    posZ,
    rotY: (Math.abs(Math.sin(posX * 12.9898 + posZ * 78.233) * 43758.5453) % 1) * Math.PI * 2,

    targetX: posX + ((Math.abs(Math.sin(posZ * 12.9898 + posX * 78.233) * 43758.5453) % 1) - 0.5) * 20,
    targetZ: posZ + ((Math.abs(Math.sin(posX * 78.233 + posZ * 12.9898) * 43758.5453) % 1) - 0.5) * 20,
    wanderTimer: 2 + (Math.abs(Math.sin(posX + posZ) * 43758.5453) % 1) * 3,
    attackCooldown: 0,
    stateTimer: 0,
    fleeFromId: null,

    animationIntent: 'Idle',
    isHit: false,
    hitTimer: 0,

    spawnChunkId: chunkId,
  };
}
