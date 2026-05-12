import type { NPCData } from '../../../domain/models/NPCDinosaur';
import { getNPCScaleFactor } from '../../../domain/models/NPCDinosaur';
import type { DinosaurStats, Diet } from '../../../domain/models/DinosaurStats';
import type { IBehaviorStrategy } from '../../../domain/interfaces/IBehaviorStrategy';
import { NPCState } from '../../../domain/models/NPCState';
import { calculateBiteDamage, calculateCarcassNutritionByLevel, calculateInteractRadius, calculatePercentageDamage, isInInteractionRange } from '../../../domain/services/DinosaurService';
import type { IGameStateGateway } from '../contracts/IGameStateGateway';
import type { WorldEdiblePoint } from '../contracts/IWorldQueryGateway';
import type { IRandomProvider } from '../../../domain/interfaces/IRandomProvider';
import { HerbivoreThreatPolicy } from '../../../domain/strategies/policies/HerbivoreThreatPolicy';
import { HerbivoreMovementPolicy } from '../../../domain/strategies/policies/HerbivoreMovementPolicy';

export class NPCFsmSystem {
  private herbivoreThreatPolicy = new HerbivoreThreatPolicy();
  private herbivoreMovementPolicy = new HerbivoreMovementPolicy();
  private carnivoreRetaliationDistance = 28;
  private herbivorePackDefenseDistance = 60;

  updateFSM(args: {
    npc: NPCData;
    stats: DinosaurStats;
    strategy: IBehaviorStrategy;
    allNPCs: NPCData[];
    ediblePositions: WorldEdiblePoint[];
    playerPos: { x: number; z: number };
    playerLevel: number;
    playerDiet: Diet;
    playerStrength: number;
    dt: number;
    random: IRandomProvider;
    npcsById: Map<string, NPCData>;
    gameState: IGameStateGateway;
  }): void {
    const {
      npc,
      stats,
      strategy,
      allNPCs,
      ediblePositions,
      playerPos,
      playerLevel,
      playerDiet,
      playerStrength,
      dt,
      random,
      npcsById,
      gameState,
    } = args;

    const threatId = strategy.threatPolicy.evaluateThreat(npc, {
      nearbyNPCs: allNPCs,
      playerPos,
      playerLevel,
      playerDiet,
      playerStrength,
    });

    // Verifica se herbívoro pode defender bando contra ameaça
    if (threatId && npc.diet === 'Herbivore') {
      const canDefend = this.herbivoreThreatPolicy.canDefendAgainstThreat(
        npc,
        threatId,
        allNPCs,
        npcsById
      );

      if (canDefend) {
        // Herbívoro vai defender - entra em modo de caça direcionado
        npc.defendingCarnivoreId = threatId;
        npc.huntingTargetId = threatId; // Alvo de caça é o carnívoro
        npc.state = NPCState.Hunting;
        npc.fleeFromId = null;
        npc.animationIntent = 'Walk';

        let threatX = playerPos.x;
        let threatZ = playerPos.z;
        if (threatId !== 'player') {
          const threat = npcsById.get(threatId);
          if (threat) {
            threatX = threat.posX;
            threatZ = threat.posZ;
          }
        }

        const defenseTarget = this.herbivoreMovementPolicy.pickDefenseDestination({
          npc,
          threatX,
          threatZ,
        });
        npc.targetX = defenseTarget.x;
        npc.targetZ = defenseTarget.z;
        return;
      }
    }

    // Limpa defesa se ameaça se afastou > 50 unidades
    if (npc.defendingCarnivoreId) {
      const defender = npcsById.get(npc.defendingCarnivoreId);
      if (!defender || defender.state === NPCState.Dead) {
        npc.defendingCarnivoreId = null;
        npc.huntingTargetId = null;
        npc.state = NPCState.Wandering;
        npc.animationIntent = 'Idle';
      } else {
        const dx = defender.posX - npc.posX;
        const dz = defender.posZ - npc.posZ;
        const distSq = dx * dx + dz * dz;
        if (distSq > 2500) { // 50 unidades
          npc.defendingCarnivoreId = null;
          npc.huntingTargetId = null;
          npc.state = NPCState.Wandering;
          npc.animationIntent = 'Idle';
        }
      }
    }

    if (threatId) {
      // Não é defesa, é fuga
      npc.state = NPCState.Fleeing;
      npc.fleeFromId = threatId;
      npc.animationIntent = 'Run';

      let threatX = playerPos.x;
      let threatZ = playerPos.z;
      if (threatId !== 'player') {
        const threat = npcsById.get(threatId);
        if (threat) {
          threatX = threat.posX;
          threatZ = threat.posZ;
        }
      }

      const fleeTarget = strategy.movementPolicy.pickFleeDestination({
        npc,
        threatX,
        threatZ,
      });
      npc.targetX = fleeTarget.x;
      npc.targetZ = fleeTarget.z;
      return;
    }

    if (npc.state === NPCState.Fleeing) {
      npc.state = NPCState.Wandering;
      npc.fleeFromId = null;
    }

    // Defesa em bando contra player: se um herbívoro foi agredido,
    // aliados próximos da mesma espécie entram em revide conjunto.
    if (npc.diet === 'Herbivore') {
      const packRadiusSq = this.herbivoreThreatPolicy.packDetectionRadius * this.herbivoreThreatPolicy.packDetectionRadius;
      let packAggroActive = npc.retaliatePlayerPackTimer > 0;

      if (!packAggroActive) {
        for (const other of allNPCs) {
          if (other.id === npc.id || other.state === NPCState.Dead) continue;
          if (other.diet !== 'Herbivore' || other.speciesId !== npc.speciesId) continue;
          if (other.retaliatePlayerPackTimer <= 0) continue;

          const dx = other.posX - npc.posX;
          const dz = other.posZ - npc.posZ;
          const distSq = dx * dx + dz * dz;
          if (distSq <= packRadiusSq) {
            packAggroActive = true;
            npc.retaliatePlayerPackTimer = Math.max(npc.retaliatePlayerPackTimer, other.retaliatePlayerPackTimer);
            break;
          }
        }
      }

      if (packAggroActive) {
        const dx = playerPos.x - npc.posX;
        const dz = playerPos.z - npc.posZ;
        const distSq = dx * dx + dz * dz;
        const maxDistSq = this.herbivorePackDefenseDistance * this.herbivorePackDefenseDistance;

        // Filhotes continuam fugindo mesmo com defesa de bando ativa.
        if (npc.level < this.herbivoreThreatPolicy.juvenileLevel) {
          npc.state = NPCState.Fleeing;
          npc.fleeFromId = 'player';
          npc.huntingTargetId = null;
          npc.animationIntent = 'Run';
          const fleeTarget = strategy.movementPolicy.pickFleeDestination({
            npc,
            threatX: playerPos.x,
            threatZ: playerPos.z,
          });
          npc.targetX = fleeTarget.x;
          npc.targetZ = fleeTarget.z;
          return;
        }

        if (distSq <= maxDistSq) {
          npc.state = NPCState.Hunting;
          npc.huntingTargetId = 'player';
          npc.fleeFromId = null;
          npc.targetX = playerPos.x;
          npc.targetZ = playerPos.z;
          npc.animationIntent = 'Run';
          return;
        }

        npc.retaliatePlayerPackTimer = 0;
        if (npc.huntingTargetId === 'player') {
          npc.huntingTargetId = null;
        }
      }
    }

    // Retaliação ao player: se foi atacado recentemente, prioriza revide
    // enquanto o player estiver próximo. Ao distanciar, encerra revide.
    if (npc.diet === 'Carnivore' && npc.retaliatePlayerTimer > 0) {
      const dx = playerPos.x - npc.posX;
      const dz = playerPos.z - npc.posZ;
      const distSq = dx * dx + dz * dz;
      const maxDistSq = this.carnivoreRetaliationDistance * this.carnivoreRetaliationDistance;

      if (distSq <= maxDistSq) {
        npc.state = NPCState.Hunting;
        npc.huntingTargetId = 'player';
        npc.targetX = playerPos.x;
        npc.targetZ = playerPos.z;
        npc.animationIntent = 'Run';
        return;
      }

      npc.retaliatePlayerTimer = 0;
      if (npc.huntingTargetId === 'player') {
        npc.huntingTargetId = null;
      }
    }

    const food = strategy.foodTargetPolicy.findFood(npc, {
      nearbyNPCs: allNPCs,
      ediblePositions,
      playerPos,
      playerLevel,
    });

    if (food) {
      // Se está defendendo bando, não come
      if (npc.defendingCarnivoreId) {
        return;
      }

      npc.state = NPCState.Hunting;
      npc.targetX = food.x;
      npc.targetZ = food.z;
      npc.huntingTargetId = food.targetId;
      npc.animationIntent = 'Walk';

      if (food.targetId && food.targetId !== 'player') {
        const isNpcTarget = food.targetId.startsWith('npc_');
        const targetNpc = isNpcTarget ? npcsById.get(food.targetId) : null;
        const isDeadCarcass = Boolean(targetNpc && targetNpc.state === NPCState.Dead);
        const isStaticResource = !isNpcTarget;

        if (!(isStaticResource || isDeadCarcass)) {
          return;
        }

        const npcScale = getNPCScaleFactor(npc.level, stats);
        const interactRadius = calculateInteractRadius(stats.interactRadius, npcScale);
        const edibleCollisionRadius = Math.max(0.08, food.scale * 0.35);

        if (isInInteractionRange(npc.posX, npc.posZ, food.x, food.z, interactRadius, edibleCollisionRadius)) {
          npc.state = NPCState.Eating;
          npc.animationIntent = 'Eat';
          npc.stateTimer = 1.5;

          const initialSize = isDeadCarcass && targetNpc
            ? calculateCarcassNutritionByLevel(targetNpc.level)
            : food.scale;
          const currentPercentage = gameState.getEdibleRemaining(food.targetId);
          const currentAbsoluteSize = initialSize * currentPercentage;

          const biteDamage = calculateBiteDamage(stats.strength, npc.level);
          const percentageDamage = calculatePercentageDamage(biteDamage, initialSize, currentAbsoluteSize);

          gameState.damageEdible(food.targetId, percentageDamage);
        }
      }
      return;
    }

    npc.huntingTargetId = null;

    if (npc.state !== NPCState.Wandering) {
      npc.state = NPCState.Wandering;
    }

    npc.wanderTimer -= dt;
    if (npc.wanderTimer <= 0) {
      const wander = strategy.movementPolicy.pickWanderDestination({
        npc,
        allNPCs,
        random,
      });

      npc.targetX = wander.x;
      npc.targetZ = wander.z;
      npc.wanderTimer = wander.timer;
    }
  }
}
