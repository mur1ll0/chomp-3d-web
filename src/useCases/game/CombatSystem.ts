import { calculateDamage, getNPCScaleFactor } from '../../domain/models/NPCDinosaur';
import type { NPCData } from '../../domain/models/NPCDinosaur';
import { DINOSAUR_ROSTER, type DinosaurStats } from '../../domain/models/DinosaurStats';
import { NPCState } from '../../domain/models/NPCState';

// Lookup O(1) — evita Array.find() no hot path do combate
const dinoStatsMap: Record<string, DinosaurStats> = {};
for (const d of DINOSAUR_ROSTER) dinoStatsMap[d.id] = d;
import { PlayerPositionRef } from './PlayerPositionRef';
import { calculateInteractRadius, isInInteractionRange } from '../../domain/services/DinosaurService';
import { EventBus } from '../../infrastructure/network/EventBus';

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

/** Janela de retaliação de carnívoro após ser atacado pelo player */
const PLAYER_RETALIATION_DURATION = 6.0;

/** Janela de defesa em bando de herbívoros após agressão do player */
const HERBIVORE_PACK_RETALIATION_DURATION = 6.0;

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

  const attackerStats = dinoStatsMap[attacker.speciesId];
  if (!attackerStats) return null;

  // Verifica colisão (bounding spheres) usando raio de interação
  const attackerScale = getNPCScaleFactor(attacker.level, attackerStats);
  const targetStats = dinoStatsMap[target.speciesId];
  if (!targetStats) return null;
  const targetScale = getNPCScaleFactor(target.level, targetStats);

  const interactRadius = calculateInteractRadius(attackerStats.interactRadius, attackerScale);
  const targetRadius = targetStats.collisionRadius * targetScale;

  if (!isInInteractionRange(attacker.posX, attacker.posZ, target.posX, target.posZ, interactRadius, targetRadius)) {
    return null;
  }

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
  if (PlayerPositionRef.isDead) return 0;

  const attackerStats = dinoStatsMap[attacker.speciesId];
  if (!attackerStats) return 0;

  const attackerScale = getNPCScaleFactor(attacker.level, attackerStats);
  const interactRadius = calculateInteractRadius(attackerStats.interactRadius, attackerScale);

  // O jogador usa sua própria collisionRadius sincronizada na PlayerPositionRef
  const targetRadius = PlayerPositionRef.collisionRadius * playerScale;

  if (!isInInteractionRange(attacker.posX, attacker.posZ, playerPosX, playerPosZ, interactRadius, targetRadius)) {
    return 0;
  }

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

  const targetStats = dinoStatsMap[target.speciesId];
  if (!targetStats) return null;
  const targetScale = getNPCScaleFactor(target.level, targetStats);

  const interactRadius = calculateInteractRadius(PlayerPositionRef.interactRadius, playerScale);
  const targetRadius = targetStats.collisionRadius * targetScale;

  if (!isInInteractionRange(playerPosX, playerPosZ, target.posX, target.posZ, interactRadius, targetRadius)) {
    return null;
  }

  const damage = calculateDamage(playerStrength, playerLevel);
  target.health = Math.max(0, target.health - damage);
  target.isHit = true;
  target.hitTimer = HIT_FLASH_DURATION;

  // Se o player atacar um carnívoro vivo, força janela de revide.
  // Isso cobre a "lacuna" onde ele não perseguiria naturalmente.
  if (target.diet === 'Carnivore') {
    target.retaliatePlayerTimer = PLAYER_RETALIATION_DURATION;
    target.huntingTargetId = 'player';
    target.fleeFromId = null;
    target.state = NPCState.Hunting;
    target.animationIntent = 'Run';
    target.stateTimer = 0;
  }

  if (target.diet === 'Herbivore') {
    target.retaliatePlayerPackTimer = HERBIVORE_PACK_RETALIATION_DURATION;
    target.huntingTargetId = 'player';
    target.fleeFromId = null;
    target.state = NPCState.Hunting;
    target.animationIntent = 'Run';
    target.stateTimer = 0;
  }

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
 * Versão do ataque do jogador que gera eventos via EventBus.
 * Usado em modo Party/Global para sincronizar o ataque com peers remotos.
 * Aplica o dano localmente E dispara o evento para replicação.
 */
export function playerAttackNPCWithEvent(
  playerPosX: number,
  playerPosZ: number,
  playerScale: number,
  playerStrength: number,
  playerLevel: number,
  target: NPCData,
  tick: number
): CombatEvent | null {
  const result = playerAttackNPC(playerPosX, playerPosZ, playerScale, playerStrength, playerLevel, target);
  if (result) {
    EventBus.push({
      type: 'npc_attack',
      tick,
      originPeerId: 'local',
      data: {
        npcId: target.id,
        damage: result.damage,
        attackerPosX: playerPosX,
        attackerPosZ: playerPosZ,
      },
    });

    if (result.targetDied) {
      EventBus.push({
        type: 'npc_died',
        tick,
        originPeerId: 'local',
        data: { npcId: target.id },
      });
    }
  }
  return result;
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
  if (npc.retaliatePlayerTimer > 0) {
    npc.retaliatePlayerTimer = Math.max(0, npc.retaliatePlayerTimer - delta);
  }
  if (npc.retaliatePlayerPackTimer > 0) {
    npc.retaliatePlayerPackTimer = Math.max(0, npc.retaliatePlayerPackTimer - delta);
  }
}
