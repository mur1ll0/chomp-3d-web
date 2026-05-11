import { calculateDamage, getNPCScaleFactor } from '../../domain/models/NPCDinosaur';
import type { NPCData } from '../../domain/models/NPCDinosaur';
import { DINOSAUR_ROSTER } from '../../domain/models/DinosaurStats';
import { NPCState } from '../../domain/models/NPCState';

/**
 * Sistema de Combate puro — sem dependência de React ou Three.js.
 * Calcula colisões de ataque e aplica dano.
 * 
 * Thread-safe: todas as operações são síncronas e determinísticas.
 * Otimizado para PeerJS: apenas o Host executa, resultados são serializáveis.
 */

/** Resultado de um ataque para notificação visual */
export interface CombatEvent {
  attackerId: string;
  targetId: string;
  damage: number;
  targetHealth: number;
  targetDied: boolean;
}

/** Duração do flash vermelho em segundos */
const HIT_FLASH_DURATION = 0.3;

/** Cooldown entre ataques consecutivos em segundos */
const ATTACK_COOLDOWN = 1.2;

/**
 * Tenta executar um ataque de um NPC contra outro NPC.
 * Retorna o evento de combate ou null se o ataque não aconteceu.
 */
export function npcAttackNPC(
  attacker: NPCData,
  target: NPCData
): CombatEvent | null {
  if (attacker.attackCooldown > 0) return null;
  if (target.state === NPCState.Dead) return null;

  const attackerStats = DINOSAUR_ROSTER.find(d => d.id === attacker.speciesId);
  if (!attackerStats) return null;

  // Verifica colisão (bounding spheres)
  const attackerScale = getNPCScaleFactor(attacker.level, attackerStats);
  const targetStats = DINOSAUR_ROSTER.find(d => d.id === target.speciesId);
  if (!targetStats) return null;
  const targetScale = getNPCScaleFactor(target.level, targetStats);

  const attackRadius = Math.min(3.0 * attackerScale, 5.0);
  const targetRadius = Math.min(2.0 * targetScale, 4.0);
  const maxDist = attackRadius + targetRadius;

  const dx = attacker.posX - target.posX;
  const dz = attacker.posZ - target.posZ;
  const distSq = dx * dx + dz * dz;

  if (distSq > maxDist * maxDist) return null;

  // Calcula e aplica dano
  const damage = calculateDamage(attackerStats.strength, attacker.level);
  target.health = Math.max(0, target.health - damage);
  target.isHit = true;
  target.hitTimer = HIT_FLASH_DURATION;

  // Aplica cooldown no atacante
  attacker.attackCooldown = ATTACK_COOLDOWN;
  attacker.state = NPCState.Attacking;
  attacker.animationIntent = 'Attack';
  attacker.stateTimer = ATTACK_COOLDOWN;

  const died = target.health <= 0;
  if (died) {
    target.state = NPCState.Dead;
    target.animationIntent = 'Death';
  }

  return {
    attackerId: attacker.id,
    targetId: target.id,
    damage,
    targetHealth: target.health,
    targetDied: died,
  };
}

/**
 * Verifica e aplica ataque do NPC contra o jogador.
 * Retorna o dano causado ou 0 se não houve ataque.
 */
export function npcAttackPlayer(
  attacker: NPCData,
  playerPosX: number,
  playerPosZ: number,
  playerScale: number
): number {
  if (attacker.attackCooldown > 0) return 0;
  if (attacker.state === NPCState.Dead) return 0;

  const attackerStats = DINOSAUR_ROSTER.find(d => d.id === attacker.speciesId);
  if (!attackerStats) return 0;

  const attackerScale = getNPCScaleFactor(attacker.level, attackerStats);
  const attackRadius = Math.min(3.0 * attackerScale, 5.0);
  const targetRadius = Math.min(2.0 * playerScale, 4.0);
  const maxDist = attackRadius + targetRadius;

  const dx = attacker.posX - playerPosX;
  const dz = attacker.posZ - playerPosZ;
  const distSq = dx * dx + dz * dz;

  if (distSq > maxDist * maxDist) return 0;

  const damage = calculateDamage(attackerStats.strength, attacker.level);

  // Aplica cooldown
  attacker.attackCooldown = ATTACK_COOLDOWN;
  attacker.state = NPCState.Attacking;
  attacker.animationIntent = 'Attack';
  attacker.stateTimer = ATTACK_COOLDOWN;

  return damage;
}

/**
 * Verifica e aplica ataque do jogador contra um NPC.
 * Retorna o evento de combate ou null.
 */
export function playerAttackNPC(
  playerPosX: number,
  playerPosZ: number,
  playerScale: number,
  playerStrength: number,
  playerLevel: number,
  target: NPCData
): CombatEvent | null {
  if (target.state === NPCState.Dead) return null;

  const targetStats = DINOSAUR_ROSTER.find(d => d.id === target.speciesId);
  if (!targetStats) return null;
  const targetScale = getNPCScaleFactor(target.level, targetStats);

  const attackRadius = Math.min(4.0 * playerScale, 6.0);
  const targetRadius = Math.min(2.0 * targetScale, 4.0);
  const maxDist = attackRadius + targetRadius;

  const dx = playerPosX - target.posX;
  const dz = playerPosZ - target.posZ;
  const distSq = dx * dx + dz * dz;

  if (distSq > maxDist * maxDist) return null;

  const damage = calculateDamage(playerStrength, playerLevel);
  target.health = Math.max(0, target.health - damage);
  target.isHit = true;
  target.hitTimer = HIT_FLASH_DURATION;

  const died = target.health <= 0;
  if (died) {
    target.state = NPCState.Dead;
    target.animationIntent = 'Death';
  }

  return {
    attackerId: 'player',
    targetId: target.id,
    damage,
    targetHealth: target.health,
    targetDied: died,
  };
}

/**
 * Atualiza timers de combate (cooldown, flash).
 * Deve ser chamado todo frame para cada NPC.
 */
export function updateCombatTimers(npc: NPCData, delta: number): void {
  if (npc.attackCooldown > 0) {
    npc.attackCooldown = Math.max(0, npc.attackCooldown - delta);
  }
  if (npc.isHit) {
    npc.hitTimer -= delta;
    if (npc.hitTimer <= 0) {
      npc.isHit = false;
      npc.hitTimer = 0;
    }
  }
  if (npc.stateTimer > 0) {
    npc.stateTimer -= delta;
  }
}
