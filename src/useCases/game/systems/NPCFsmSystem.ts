import type { NPCData } from '../../../domain/models/NPCDinosaur';
import { getNPCScaleFactor } from '../../../domain/models/NPCDinosaur';
import type { DinosaurStats, Diet } from '../../../domain/models/DinosaurStats';
import { DINOSAUR_ROSTER } from '../../../domain/models/DinosaurStats';
import type { IBehaviorStrategy } from '../../../domain/interfaces/IBehaviorStrategy';
import { NPCState } from '../../../domain/models/NPCState';
import { calculateBiteDamage, calculateCarcassNutritionByLevel, calculateInteractRadius, calculatePercentageDamage, isInInteractionRange } from '../../../domain/services/DinosaurService';
import type { IGameStateGateway } from '../contracts/IGameStateGateway';
import type { WorldEdiblePoint, WorldObstacle } from '../contracts/IWorldQueryGateway';
import type { IRandomProvider } from '../../../domain/interfaces/IRandomProvider';
import { getNpcPerceptionProfile, isLineOfSightBlocked, isTargetInsideFov } from './NPCPerceptionUtils';
import { PlayerPositionRef } from '../PlayerPositionRef';

export class NPCFsmSystem {
  private carnivoreRetaliationDistance = 28;
  private herbivorePackDefenseDistance = 60;
  private herbivoreJuvenileLevel = 10; // Filhotes sempre fogem
  private herbivorePackDetectionRadius = 60;

  // Buffers reutilizáveis: evitam alocação de novos arrays por NPC por frame (O(n²) → O(n))
  private visibleNpcsBuffer: NPCData[] = [];
  private visibleEdiblesBuffer: WorldEdiblePoint[] = [];

  updateFSM(args: {
    npc: NPCData;
    stats: DinosaurStats;
    strategy: IBehaviorStrategy;
    allNPCs: NPCData[];
    ediblePositions: WorldEdiblePoint[];
    obstacles: WorldObstacle[];
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
      obstacles,
      playerPos,
      playerLevel,
      playerDiet,
      playerStrength,
      dt,
      random,
      npcsById,
      gameState,
    } = args;

    const playerIsDead = PlayerPositionRef.isDead;

    // Com o player morto, limpa alvos/timers de revide para evitar perseguição/ataque inválidos.
    if (playerIsDead) {
      const hadPlayerTarget = npc.huntingTargetId === 'player' || npc.fleeFromId === 'player';
      if (npc.huntingTargetId === 'player') npc.huntingTargetId = null;
      if (npc.fleeFromId === 'player') npc.fleeFromId = null;
      npc.retaliatePlayerTimer = 0;
      npc.retaliatePlayerPackTimer = 0;

      if (
        hadPlayerTarget &&
        (npc.state === NPCState.Hunting || npc.state === NPCState.Fleeing || npc.state === NPCState.Attacking)
      ) {
        npc.state = NPCState.Wandering;
        npc.animationIntent = 'Idle';
        npc.stateTimer = 0;
        npc.wanderTimer = 0;
      }
    }

    const perceptionProfile = getNpcPerceptionProfile(npc.diet);
    const npcEyeY = npc.posY + (stats.collisionHeight * 0.42 + perceptionProfile.eyeHeight) * getNPCScaleFactor(npc.level, stats);

    // Reutiliza buffers pré-alocados — sem alocação de array por NPC por frame
    this.visibleNpcsBuffer.length = 0;
    for (const other of allNPCs) {
      if (other.id === npc.id || other.state === NPCState.Dead) continue;
      const otherStats = DINOSAUR_ROSTER.find(d => d.id === other.speciesId);
      if (!otherStats) continue;
      if (!isTargetInsideFov(npc, other.posX, other.posZ, perceptionProfile.halfFovRad, perceptionProfile.viewDistance)) continue;
      const otherEyeY = other.posY + (otherStats.collisionHeight * 0.45) * getNPCScaleFactor(other.level, otherStats);
      if (!isLineOfSightBlocked(npc.posX, npcEyeY, npc.posZ, other.posX, otherEyeY, other.posZ, obstacles)) {
        this.visibleNpcsBuffer.push(other);
      }
    }
    const visibleNpcs = this.visibleNpcsBuffer;

    const playerVisible = isTargetInsideFov(
      npc,
      playerPos.x,
      playerPos.z,
      perceptionProfile.halfFovRad,
      perceptionProfile.viewDistance
    ) && !isLineOfSightBlocked(
      npc.posX,
      npcEyeY,
      npc.posZ,
      playerPos.x,
      PlayerPositionRef.y + PlayerPositionRef.collisionHeight * 0.42 * PlayerPositionRef.scale,
      playerPos.z,
      obstacles
    );

    this.visibleEdiblesBuffer.length = 0;
    for (const edible of ediblePositions) {
      // Guarda contra cache stale: ignora edibles que já foram esgotados desde a última rebuild
      if (gameState.getEdibleRemaining(edible.id) <= 0) continue;
      if (!isTargetInsideFov(npc, edible.x, edible.z, perceptionProfile.halfFovRad, perceptionProfile.viewDistance)) continue;
      const edibleEyeY = Math.max(0.15, edible.scale * 0.5);
      if (!isLineOfSightBlocked(npc.posX, npcEyeY, npc.posZ, edible.x, edibleEyeY, edible.z, obstacles)) {
        this.visibleEdiblesBuffer.push(edible);
      }
    }
    const visibleEdibles = this.visibleEdiblesBuffer;

    // Propaga revide de bando antes da lógica de ameaça para evitar fuga prematura.
    if (npc.diet === 'Herbivore' && npc.retaliatePlayerPackTimer <= 0) {
      const packRadiusSq = this.herbivorePackDetectionRadius * this.herbivorePackDetectionRadius;
      for (const other of allNPCs) {
        if (other.id === npc.id || other.state === NPCState.Dead) continue;
        if (other.diet !== 'Herbivore' || other.speciesId !== npc.speciesId) continue;
        if (other.retaliatePlayerPackTimer <= 0) continue;

        const dx = other.posX - npc.posX;
        const dz = other.posZ - npc.posZ;
        const distSq = dx * dx + dz * dz;
        if (distSq <= packRadiusSq) {
          npc.retaliatePlayerPackTimer = other.retaliatePlayerPackTimer;
          break;
        }
      }
    }

    // Detecção de ameaças é omnidirecional (360°): faro/sentido de perigo não depende de visão.
    // FOV só restringe caça e busca de comida.
    const rawThreatId = strategy.threatPolicy.evaluateThreat(npc, {
      nearbyNPCs: allNPCs,
      playerPos,
      playerLevel,
      playerDiet,
      playerStrength,
    });
    const threatId = playerIsDead && rawThreatId === 'player' ? null : rawThreatId;

    // Verifica se herbívoro pode defender bando contra ameaça
    if (threatId && npc.diet === 'Herbivore') {
      let canDefend = false;

      if (threatId === 'player') {
        // Defesa contra player: não-filhote + suporte de bando (sem comparação de força)
        if (playerVisible && npc.level >= this.herbivoreJuvenileLevel) {
          const packRadiusSq = this.herbivorePackDetectionRadius * this.herbivorePackDetectionRadius;
          for (const ally of allNPCs) {
            if (ally.id === npc.id || ally.state === NPCState.Dead) continue;
            if (ally.speciesId !== npc.speciesId) continue;
            const allyDx = ally.posX - npc.posX;
            const allyDz = ally.posZ - npc.posZ;
            if (allyDx * allyDx + allyDz * allyDz < packRadiusSq) {
              canDefend = true;
              break;
            }
          }
        }
      } else {
        canDefend = strategy.threatPolicy.canDefendAgainstThreat?.(
          npc,
          threatId,
          allNPCs,
          npcsById
        ) ?? false;
      }

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

        const defenseTarget = strategy.movementPolicy.pickDefenseDestination?.({
          npc,
          threatX,
          threatZ,
        }) ?? strategy.movementPolicy.pickFleeDestination({
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
      // Herbívoros com timer de revide em bando ativo não fogem — eles atacam.
      // O timer é ativado quando um membro do bando é atacado pelo player.
      if (
        npc.diet === 'Herbivore' &&
        npc.retaliatePlayerPackTimer > 0 &&
        npc.level >= this.herbivoreJuvenileLevel
      ) {
        // Deixa o bloco do retaliatePlayerPackTimer mais abaixo tratar o estado de ataque
      } else {
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
      } // else (não pack-timer)
    } // if (threatId)

    if (npc.state === NPCState.Fleeing) {
      npc.state = NPCState.Wandering;
      npc.fleeFromId = null;
    }

    // Defesa em bando contra player: se um herbívoro foi agredido,
    // aliados próximos da mesma espécie entram em revide conjunto.
    if (npc.diet === 'Herbivore') {
      const packRadiusSq = this.herbivorePackDetectionRadius * this.herbivorePackDetectionRadius;
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
        if (npc.level < this.herbivoreJuvenileLevel) {
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

        if (!playerVisible) {
          npc.retaliatePlayerPackTimer = 0;
          npc.huntingTargetId = null;
          npc.state = NPCState.Wandering;
          npc.animationIntent = 'Idle';
          return;
        }

        if (distSq <= maxDistSq) {
          npc.state = NPCState.Hunting;
          npc.huntingTargetId = 'player';
          npc.fleeFromId = null;
          const defenseTarget = strategy.movementPolicy.pickDefenseDestination?.({
            npc,
            threatX: playerPos.x,
            threatZ: playerPos.z,
          }) ?? strategy.movementPolicy.pickFleeDestination({
            npc,
            threatX: playerPos.x,
            threatZ: playerPos.z,
          });
          npc.targetX = defenseTarget.x;
          npc.targetZ = defenseTarget.z;
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
      nearbyNPCs: visibleNpcs,
      ediblePositions: visibleEdibles,
      playerPos,
      playerLevel,
      playerVisible,
      playerIsDead,
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
          const currentPercentage = gameState.getEdibleRemaining(food.targetId);
          if (currentPercentage <= 0) {
            // Comida esgotada (cache stale) — evita loop de animação de comer
            npc.huntingTargetId = null;
            npc.state = NPCState.Wandering;
            return;
          }

          npc.state = NPCState.Eating;
          npc.animationIntent = 'Eat';
          npc.stateTimer = 1.5;

          const initialSize = isDeadCarcass && targetNpc
            ? calculateCarcassNutritionByLevel(targetNpc.level)
            : food.targetId === 'player_carcass'
              ? calculateCarcassNutritionByLevel(playerLevel)
              : food.scale;
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
