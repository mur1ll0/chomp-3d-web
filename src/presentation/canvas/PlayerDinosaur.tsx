/* eslint-disable react-hooks/immutability */
import React, { useRef, useEffect, useState, useMemo, useCallback } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { useGLTF, PointerLockControls } from '@react-three/drei';
import * as THREE from 'three';
import { useAppStore } from '../../store/useAppStore';
import { NPCState } from '../../domain/models/NPCState';
import { DINOSAUR_ROSTER } from '../../domain/models/DinosaurStats';
import { getNPCScaleFactor } from '../../domain/models/NPCDinosaur';
import { useKeyboard } from '../../useCases/game/useKeyboard';
import { MapGenerator, getWaterValue, WATER_THRESHOLD } from '../../infrastructure/generation/MapGenerator';
import type { ChunkData, MapEdible } from '../../infrastructure/generation/MapGenerator';
import { NPCManager } from '../../useCases/game/NPCManager';
import { playerAttackNPC } from '../../useCases/game/CombatSystem';
import { PlayerPositionRef } from '../../useCases/game/PlayerPositionRef';
import { calculateFinalScale, calculateInteractRadius, calculateBiteDamage, calculatePercentageDamage, calculateCarcassNutritionByLevel } from '../../domain/services/DinosaurService';
import { useDinosaurAnimations } from '../hooks/useDinosaurAnimations';
import { cloneSkinnedMesh } from '../utils/ThreeUtils';
import { peerSession } from '../../infrastructure/network/PeerSession';

// Vetores reutilizáveis para evitar alocações por frame (GC pressure)
const _forward = new THREE.Vector3();
const _right = new THREE.Vector3();
const _moveDir = new THREE.Vector3();
const _targetPos = new THREE.Vector3();
const _forwardCam = new THREE.Vector3();
const _tempQuatMove = new THREE.Quaternion();

type DinoDebugInfo = {
  speed: number;
  gameScale: number;
  worldScale: number;
};

type WindowWithDinoDebug = Window & {
  dinoDebug?: DinoDebugInfo;
};

export const PlayerDinosaur: React.FC = () => {
  const selectedDinoId = useAppStore(s => s.selectedDinoId);
  const dinoColors = useAppStore(s => s.dinoColors);
  const debugCollisions = useAppStore(s => s.debugCollisions);
  const level = useAppStore(s => s.level);
  const isDead = useAppStore(s => s.isDead);
  const controlBindings = useAppStore(s => s.controlBindings);
  const health = useAppStore(s => s.health);
  const initPlayerStats = useAppStore(s => s.initPlayerStats);
  const incrementTimeAlive = useAppStore(s => s.incrementTimeAlive);
  const takeDamage = useAppStore(s => s.takeDamage);
  const dinoStats = DINOSAUR_ROSTER.find(d => d.id === selectedDinoId)!;

  // Load GLB
  const gltf = useGLTF(dinoStats.modelPath);

  // RPG Init & Time Tracking
  useEffect(() => {
    initPlayerStats(dinoStats.vitality);
    const interval = setInterval(() => {
      if (!useAppStore.getState().isDead) {
        incrementTimeAlive();
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [selectedDinoId, dinoStats.vitality, initPlayerStats, incrementTimeAlive]);

  // Damage Flashing
  const [isFlashing, setIsFlashing] = useState(false);
  const [isActing, setIsActing] = useState(false);
  const prevHealthRef = useRef(health);

  useEffect(() => {
    if (health < prevHealthRef.current && !isDead) {
      setIsFlashing(true);
      setTimeout(() => setIsFlashing(false), 300);
    }
    prevHealthRef.current = health;
  }, [health, isDead]);

  // Destravar o mouse ao morrer
  useEffect(() => {
    if (isDead && document.pointerLockElement) {
      document.exitPointerLock();
    }
  }, [isDead]);

  // Apply colors & damage/death visual
  React.useEffect(() => {
    if (!gltf.scene) return;
    gltf.scene.traverse((child) => {
      if ((child as THREE.Mesh).isMesh || (child as THREE.SkinnedMesh).isSkinnedMesh) {
        const mesh = child as THREE.Mesh;
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        mesh.frustumCulled = false; // Prevent culling bugs

        if (mesh.material && !Array.isArray(mesh.material)) {
          const mat = mesh.material as THREE.MeshStandardMaterial;
          if (!mat.userData.originalColor) {
            mat.userData.originalColor = mat.color.clone();
          }

          if (isDead || isFlashing) {
            mat.color.set('red');
          } else if (mat.name && dinoColors[mat.name]) {
            mat.color.set(dinoColors[mat.name]);
          } else {
            mat.color.copy(mat.userData.originalColor);
          }
          mat.needsUpdate = true;
        }
      }
    });
  }, [gltf.scene, dinoColors, isDead, isFlashing]);

  // Isolamento do modelo (clone) com correção de esqueleto
  const playerModel = useMemo(() => {
    const clone = cloneSkinnedMesh(gltf.scene);
    clone.traverse(child => {
      if ((child as THREE.Mesh).isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });
    return clone;
  }, [gltf.scene]);

  const { names, playAnimation } = useDinosaurAnimations(gltf, playerModel);
  const keys = useKeyboard();
  const { camera } = useThree();
  const playerRef = useRef<THREE.Group>(null);

  useEffect(() => {
    if (names && names.length > 0) {
      playAnimation('Idle');
    }
  }, [names, playAnimation]);

  // Variáveis físicas e de estado
  const yVelocity = useRef(0);
  const movementRamp = useRef(0);
  const isGrounded = useRef(true);
  const isActionLocked = useRef(false);
  const chunksRef = useRef<ChunkData[]>([]); // Cache de chunks próximos
  const lastChunkRef = useRef({ x: Infinity, z: Infinity });
  const currentActionType = useRef(''); // 'Attack' | 'Eat' | ''
  const lastMoveAngle = useRef(0); // Último targetAngle calculado (evita Euler singularity em PI)
  const collisionFrameCounter = useRef(0); // Throttle colisão quando parado

  // Debug Zoom logic
  const zoomOffset = useRef(0);
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    const handleWheel = (e: WheelEvent) => {
      if (useAppStore.getState().debugZoomUnlocked) {
        zoomOffset.current += e.deltaY * 0.05;
        // Limita o zoom para não entrar no corpo nem ir longe demais
        zoomOffset.current = Math.max(-45, Math.min(500, zoomOffset.current));
      }
    };
    window.addEventListener('wheel', handleWheel);
    return () => window.removeEventListener('wheel', handleWheel);
  }, []);

  // Calcula escala global base e escala final com base no Level
  const GLOBAL_SCALE_MODIFIER = 0.15;
  const finalScale = React.useMemo(() => {
    return calculateFinalScale(level, dinoStats);
  }, [level, dinoStats]);

  // Raio de interação (para comer) - usado no frame e no debug
  const interactRadius = useMemo(() => 
    calculateInteractRadius(dinoStats.interactRadius, finalScale), 
  [dinoStats.interactRadius, finalScale]);

  const triggerEatAction = useCallback(() => {
    if (isActionLocked.current) return;

    const interactableId = useAppStore.getState().interactableEdibleId;
    if (!interactableId) return;

    // Verifica se a comida ainda existe (tamanho > 0)
    const edibleStates = useAppStore.getState().edibleStates;
    const remainingScale = edibleStates[interactableId] ?? 1.0;
    if (remainingScale <= 0) return;

    // Procurar a comida no mapa OU se é um NPC morto (carcaça)
    let initialSize: number;
    const isNPC = interactableId.startsWith('npc_');

    if (isNPC) {
      const npcData = NPCManager.getNPC(interactableId);
      if (!npcData || npcData.state !== NPCState.Dead) return;
      initialSize = calculateCarcassNutritionByLevel(npcData.level);
    } else {
      const chunks = MapGenerator.getChunksAround(playerRef.current?.position.x || 0, playerRef.current?.position.z || 0, 1);
      let targetEdible: MapEdible | undefined;
      for (const chunk of chunks) {
        targetEdible = chunk.edibles?.find(e => e.id === interactableId);
        if (targetEdible) break;
      }
      if (!targetEdible) return;
      initialSize = targetEdible.scale;
    }

    isActionLocked.current = true;
    setIsActing(true);
    currentActionType.current = 'Eat';
    const action = playAnimation('Eat', false);
    const durationMs = action && action.getClip() ? action.getClip().duration * 1000 : 1500;

    const currentPercentage = useAppStore.getState().edibleStates[interactableId] ?? 1.0; // 1.0 = 100%
    const currentAbsoluteSize = initialSize * currentPercentage; // O tamanho físico restante

    const biteDamage = calculateBiteDamage(dinoStats.strength, level);
    const percentageDamage = calculatePercentageDamage(biteDamage, initialSize, currentAbsoluteSize);

    useAppStore.getState().damageEdible(interactableId, percentageDamage);
    useAppStore.getState().consumeFood(percentageDamage * initialSize * 12);

    setTimeout(() => {
      isActionLocked.current = false;
      setIsActing(false);
      currentActionType.current = '';
      playAnimation('Idle');
    }, durationMs);
  }, [dinoStats.strength, level, playAnimation]);

  const triggerAttackAction = useCallback(() => {
    if (isActionLocked.current) return;
    isActionLocked.current = true;
    setIsActing(true);
    currentActionType.current = 'Attack';
    const action = playAnimation('Attack', false);
    const durationMs = action && action.getClip() ? action.getClip().duration * 1000 : 1000;

    // Lógica de dano a NPCs: verifica colisão com todos os NPCs próximos
    if (playerRef.current) {
      const px = playerRef.current.position.x;
      const pz = playerRef.current.position.z;
      const activeNPCs = NPCManager.getActiveNPCs();

      for (const npc of activeNPCs) {
        // Em modo online, não pode atacar aliados do mesmo bando
        if (useAppStore.getState().onlineRole) {
          // NPCs não têm bando — ataque normalmente
        }
        const event = playerAttackNPC(
          px, pz, finalScale,
          dinoStats.strength, level, npc
        );
        if (event) {
          // XP por causar dano
          useAppStore.getState().gainXp(Math.floor(event.damage * 5));
          if (event.targetDied) {
            // Bônus de XP por matar
            useAppStore.getState().gainXp(50 * npc.level);
          }
          break; // Ataca apenas 1 NPC por vez
        }
      }
    }

    setTimeout(() => {
      isActionLocked.current = false;
      setIsActing(false);
      currentActionType.current = '';
      playAnimation('Idle');
    }, durationMs);
  }, [dinoStats.strength, finalScale, level, playAnimation]);

  // Mouse Listener para Atacar (Left Click) e Atalhos de Mouse (Alt, Tab, Esc)
  useEffect(() => {
    const matchesMouseAttack = (button: number): boolean => {
      if (controlBindings.attack === 'MouseLeft') return button === 0;
      if (controlBindings.attack === 'MouseMiddle') return button === 1;
      if (controlBindings.attack === 'MouseRight') return button === 2;
      return false;
    };

    const handleMouseDown = (e: MouseEvent) => {
      // Ataca apenas se o mouse já estiver capturado (PointerLock ativo)
      if (document.pointerLockElement && matchesMouseAttack(e.button)) {
        if (!isActionLocked.current && isGrounded.current) {
          triggerAttackAction();
        }
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === 'Alt' || e.key === 'Tab') {
        if (document.pointerLockElement) {
          document.exitPointerLock();
        }
      }

      if (
        document.pointerLockElement &&
        e.code === controlBindings.attack &&
        !e.repeat &&
        !isActionLocked.current &&
        isGrounded.current
      ) {
        triggerAttackAction();
      }

      // Tecla de teste para simular Dano (Temporário para debug)
      if (e.key === 't' || e.key === 'T') {
        takeDamage(20);
      }
    };

    window.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [controlBindings.attack, takeDamage, triggerAttackAction]);

  // Counter for periodic input sync
  const inputSyncCounter = useRef(0);

  // Movement Logic (8-directional relative to camera)
  useFrame((_, rawDelta) => {
    if (!playerRef.current) return;

    // Sincroniza PlayerPositionRef no TOPO — antes de qualquer early return
    const pRef = playerRef.current;

    // Helper de envio de input para rede (chamado de múltiplos pontos)
    const sendClientInput = (isAttacking: boolean, isEating: boolean, isMoving: boolean, isSprinting: boolean) => {
      if (useAppStore.getState().onlineRole !== 'client') return;
      inputSyncCounter.current++;
      if (inputSyncCounter.current < 3) return;
      inputSyncCounter.current = 0;
      const appState = useAppStore.getState();
      peerSession.sendInput({
        moveX: isMoving ? (keys[controlBindings.moveForward] ? 1 : keys[controlBindings.moveBackward] ? -1 : 0) : 0,
        moveZ: 0,
        isRunning: isSprinting,
        attacking: isAttacking,
        eating: isEating,
        eatingTargetId: appState.interactableEdibleId ?? '',
        jumping: !isGrounded.current,
        rotY: PlayerPositionRef.rotY,
        posX: PlayerPositionRef.x,
        posY: PlayerPositionRef.y,
        posZ: PlayerPositionRef.z,
        level,
        health: appState.health,
        maxHealth: appState.maxHealth,
        isDead,
        animationIntent: PlayerPositionRef.animationIntent,
      });
    };
    PlayerPositionRef.x = pRef.position.x;
    PlayerPositionRef.y = pRef.position.y;
    PlayerPositionRef.z = pRef.position.z;
    // Use lastMoveAngle (computed from atan2) instead of pRef.rotation.y
    // to avoid Euler angle singularity at PI (180° rotation decomposes to Euler(PI,0,PI))
    PlayerPositionRef.rotY = lastMoveAngle.current;
    PlayerPositionRef.scale = finalScale;
    PlayerPositionRef.level = level;
    PlayerPositionRef.diet = dinoStats.diet;
    PlayerPositionRef.strength = dinoStats.strength;
    PlayerPositionRef.isDead = isDead;
    PlayerPositionRef.collisionRadius = dinoStats.collisionRadius;
    PlayerPositionRef.collisionHeight = dinoStats.collisionHeight;
    PlayerPositionRef.interactRadius = dinoStats.interactRadius;

    // Evita teleporte de física se houver lag spike (stutter de carregamento de chunk)
    const delta = Math.min(rawDelta, 0.05);
    const inWater = getWaterValue(PlayerPositionRef.x, PlayerPositionRef.z) > WATER_THRESHOLD;
    let groundY = inWater ? -3 * finalScale : 0;

    if (isDead) {
      PlayerPositionRef.animationIntent = 'Death';
      playAnimation('Death', false);
      if (!isGrounded.current) {
        const gravityForce = 100;
        yVelocity.current -= gravityForce * delta;
        playerRef.current.position.y += yVelocity.current * delta;
      }
      return;
    }

    // Durante ação (Attack/Eat), sincroniza animationIntent e envia input para rede
    if (isActionLocked.current) {
      PlayerPositionRef.animationIntent = currentActionType.current || 'Attack';
      sendClientInput(currentActionType.current === 'Attack', currentActionType.current === 'Eat', false, false);
      return;
    }

    // Acionar Comer pelo teclado (apenas se houver comida próxima)
    if (keys[controlBindings.eat] && isGrounded.current && useAppStore.getState().interactableEdibleId) {
      triggerEatAction();
      return;
    }

    const currentStamina = useAppStore.getState().stamina;
    const currentExhausted = useAppStore.getState().isExhausted;

    // Trava de Exaustão: Se zerar, não pode correr até recuperar pelo menos 20 pontos
    if (currentStamina <= 0 && !currentExhausted) {
      useAppStore.getState().setExhausted(true);
    } else if (currentStamina >= 20 && currentExhausted) {
      useAppStore.getState().setExhausted(false);
    }

    // Só pode correr se tiver stamina e não estiver na trava de exaustão
    const isRunning = keys[controlBindings.sprint] && currentStamina > 0 && !useAppStore.getState().isExhausted;

    // Penalidade de velocidade para filhotes e jovens (atinge 100% no nível 20, adulto)
    // Começa em 0.5 (50%) e sobe 0.5 (até 100%) ao longo de 19 níveis
    const levelSpeedModifier = level < 20 ? (0.5 + ((level - 1) / 19) * 0.5) : 1.0;

    const baseCurrentSpeed = isRunning ? dinoStats.runSpeed : dinoStats.walkSpeed;
    const waterMultiplier = inWater ? 0.5 : 1.0;

    // A velocidade agora é baseada diretamente nos stats, sem interferência da altura/escala
    const moveSpeed = baseCurrentSpeed * waterMultiplier * levelSpeedModifier;
    const turnSpeed = 10.0;



    // Vetores da câmera (reutilizados do escopo de módulo)
    camera.getWorldDirection(_forward);
    _forward.y = 0;
    _forward.normalize();

    // Em Three.js, UP(0,1,0) x FORWARD(0,0,-1) = ESQUERDA(-1,0,0)
    _right.crossVectors(_forward, camera.up).normalize();

    _moveDir.set(0, 0, 0);
    let moving = false;

    // Bloqueia movimento se estiver executando uma ação (Comer/Atacar)
    if (!isActing) {
      if (keys[controlBindings.moveForward]) { _moveDir.add(_forward); moving = true; }
      if (keys[controlBindings.moveBackward]) { _moveDir.sub(_forward); moving = true; }
      if (keys[controlBindings.moveLeft]) { _moveDir.sub(_right); moving = true; }
      if (keys[controlBindings.moveRight]) { _moveDir.add(_right); moving = true; }
    }

    // Lógica de Stamina
    if (moving && isRunning) {
      // Dinos maiores gastam MUITO mais stamina (Ex: um gigante cansa em poucos segundos)
      useAppStore.getState().consumeStamina(10 * finalScale * delta);
    } else {
      // Regenera 1 ponto de stamina por segundo quando não está correndo
      useAppStore.getState().regenerateStamina(1.0 * delta);
    }

    // Física de Pulo e Gravidade
    if (keys[controlBindings.jump] && isGrounded.current && !inWater) {
      // Ajuste fino: aumentamos o valor base para fortalecer o adulto e reduzimos o fator 
      // de escala para suavizar o pulo do filhote, aproximando mais os dois extremos.
      yVelocity.current = 15.5 + (2.0 / Math.sqrt(finalScale));

      isGrounded.current = false;
      playAnimation('Jump', false);
    }

    if (!isGrounded.current || playerRef.current.position.y > groundY + 0.1) {
      // Gravidade constante e forte (100) para todos os tamanhos.
      // Isso elimina o efeito de "lua/flutuação" e faz o dino descer rápido.
      const gravityForce = 100;
      yVelocity.current -= gravityForce * delta;
      playerRef.current.position.y += yVelocity.current * delta;

      if (playerRef.current.position.y <= groundY) {
        playerRef.current.position.y = groundY;
        yVelocity.current = 0;
        isGrounded.current = true;
        // Ao cair no chão ou sobre pedra, se estava movendo, toca andar de novo, senão idle
        if (moving) playAnimation(isRunning ? 'Run' : 'Walk');
        else playAnimation('Idle');
      }
    } else if (playerRef.current.position.y < groundY - 0.1) {
      // Subindo suavemente de volta pro chão seco ou para a pedra
      playerRef.current.position.y = THREE.MathUtils.lerp(playerRef.current.position.y, groundY, 10 * delta);
    } else {
      playerRef.current.position.y = groundY;
    }

    // Aplica movimento no plano XZ (Funciona no ar e no chão)
    if (moving) {
      _moveDir.normalize();

      // Aceleração linear simples: aumenta de 0 a 1 em exatamente 1 segundo
      movementRamp.current = Math.min(1.0, movementRamp.current + delta);
      const rampedSpeed = moveSpeed * movementRamp.current;

      const targetAngle = Math.atan2(_moveDir.x, _moveDir.z);
      lastMoveAngle.current = targetAngle;
      _tempQuatMove.setFromAxisAngle(_forward.set(0, 1, 0), targetAngle);

      playerRef.current.quaternion.slerp(_tempQuatMove, turnSpeed * delta);
      playerRef.current.position.addScaledVector(_moveDir, rampedSpeed * delta);

      // Só muda para animação de andar/correr se estiver no chão
      if (isGrounded.current) {
        playAnimation(isRunning ? 'Run' : 'Walk');
      }
    } else {
      movementRamp.current = 0; // Para imediatamente (sem inércia) para evitar o efeito de arrasto
      if (isGrounded.current) {
        playAnimation('Idle');
      }
    }

    // ----- CÁLCULO DE COLISÕES PROCEDURAIS (Throttled) -----
    // Só roda colisão completa a cada 3 frames quando parado, ou sempre quando se move
    const COLLISION_FRAME_SKIP = 3;
    collisionFrameCounter.current = (collisionFrameCounter.current + 1) % COLLISION_FRAME_SKIP;
    const shouldRunCollision = moving || collisionFrameCounter.current === 0;

    const CHUNK_SIZE = 50;
    const px = playerRef.current.position.x;
    const pz = playerRef.current.position.z;
    const py = playerRef.current.position.y;

    const currentChunkX = Math.floor(px / CHUNK_SIZE);
    const currentChunkZ = Math.floor(pz / CHUNK_SIZE);
    const appState = useAppStore.getState();

    if (lastChunkRef.current.x !== currentChunkX || lastChunkRef.current.z !== currentChunkZ) {
      appState.setPlayerChunkPos(currentChunkX, currentChunkZ);
      chunksRef.current = MapGenerator.getChunksAround(px, pz, 1);
      lastChunkRef.current = { x: currentChunkX, z: currentChunkZ };
    }

    const chunks = chunksRef.current;

    if (shouldRunCollision) {
      // Cap do raio: dinos gigantes (nível 100+) não precisam colidir com tudo a 10m de distância
      const playerRadius = Math.min(dinoStats.collisionRadius * finalScale, 10.0);

      for (const chunk of chunks) {
        for (const tree of chunk.trees) {
          const treeRadius = tree.collisionRadius;
          const dx = px - tree.position[0];
          const dz = pz - tree.position[2];

          // Early rejection: distância quadrada (evita Math.sqrt para objetos longe)
          const maxDist = playerRadius + treeRadius;
          const distSq = dx * dx + dz * dz;
          if (distSq >= maxDist * maxDist) continue;

          const treeHeight = tree.collisionHeight;
          if (py >= treeHeight) continue; // Acima da árvore, sem colisão

          const dist = Math.sqrt(distSq) || 0.001;
          const overlap = maxDist - dist;
          playerRef.current.position.x += (dx / dist) * overlap * 1.1;
          playerRef.current.position.z += (dz / dist) * overlap * 1.1;
        }

        // Colisão com Pedras (Com suporte a pular por cima)
        for (const rock of chunk.rocks) {
          const rockRadius = rock.collisionRadius;
          const dx = px - rock.position[0];
          const dz = pz - rock.position[2];

          // Early rejection com distância quadrada
          const maxDist = playerRadius + rockRadius;
          const distSq = dx * dx + dz * dz;
          if (distSq >= maxDist * maxDist) continue;

          const rockHeight = rock.collisionHeight;
          const dist = Math.sqrt(distSq) || 0.001;
          const maxStepHeight = 2.5 * finalScale;

          if (py >= rockHeight - maxStepHeight) {
            groundY = Math.max(groundY, rockHeight);
            if (py < rockHeight) {
              playerRef.current.position.y = rockHeight;
              yVelocity.current = 0;
              isGrounded.current = true;
            }
          } else {
            const overlap = maxDist - dist;
            playerRef.current.position.x += (dx / dist) * overlap * 1.1;
            playerRef.current.position.z += (dz / dist) * overlap * 1.1;
          }
        }
      }
    }

    // ----- DETECÇÃO DE ALIMENTOS PRÓXIMOS (também throttled) -----
    let nearestEdibleId: string | null = null;
    let minEdibleDist = Infinity;
    const interactRadiusSq = (interactRadius + 5) * (interactRadius + 5);

    if (shouldRunCollision) {
      const edibleStates = appState.edibleStates;
      const diet = dinoStats.diet;

      for (const chunk of chunks) {
        if (chunk.edibles) {
          for (const edible of chunk.edibles) {
            // Filtro rápido de dieta
            if (
              (diet === 'Herbivore' && edible.type === 'Plant') ||
              (diet === 'Carnivore' && edible.type === 'Meat')
            ) {
              const dx = px - edible.position[0];
              const dz = pz - edible.position[2];
              const distSq = dx * dx + dz * dz;

              if (distSq < interactRadiusSq) {
                const remainingScale = edibleStates[edible.id] ?? 1.0;
                if (remainingScale > 0) {
                  const dist = Math.sqrt(distSq) - (edible.scale * remainingScale * 0.8);
                  if (dist < interactRadius && dist < minEdibleDist) {
                    minEdibleDist = dist;
                    nearestEdibleId = edible.id;
                  }
                }
              }
            }
          }
        }
      }

      // 4b. CARCAÇAS DE NPCs (CARNE)
      if (diet === 'Carnivore') {
        const activeNPCs = NPCManager.getActiveNPCs();
        for (const npc of activeNPCs) {
          if (npc.state === NPCState.Dead) {
            const dx = px - npc.posX;
            const dz = pz - npc.posZ;
            const distSq = dx * dx + dz * dz;

            if (distSq < interactRadiusSq) {
              const remainingScale = edibleStates[npc.id] ?? 1.0;
              if (remainingScale > 0) {
                const npcStats = DINOSAUR_ROSTER.find(d => d.id === npc.speciesId);
                const npcBaseScale = npcStats ? getNPCScaleFactor(npc.level, npcStats) : 0.5;
                const carcassScale = npcBaseScale * 4.0;
                const dist = Math.sqrt(distSq) - (carcassScale * remainingScale * 1.0);
                if (dist < interactRadius && dist < minEdibleDist) {
                  minEdibleDist = dist;
                  nearestEdibleId = npc.id;
                }
              }
            }
          }
        }
      }
    }

    if (appState.interactableEdibleId !== nearestEdibleId) {
      appState.setInteractableEdibleId(nearestEdibleId);
    }

    // 5. ATUALIZAR CÂMERA (Sempre por último para evitar jitter/vibração)
    // Coeficientes para câmera próxima
    const targetHeight = 8 * finalScale;
    _targetPos.copy(playerRef.current.position);
    _targetPos.y += targetHeight;
    const desiredDistance = (20 + zoomOffset.current) * finalScale;

    // Câmera firmemente posicionada nas costas do dinossauro
    _forwardCam.set(0, 0, -1).applyQuaternion(camera.quaternion);
    camera.position.copy(_targetPos).addScaledVector(_forwardCam, -desiredDistance);

    // Impede a câmera de entrar embaixo da terra
    if (camera.position.y < 0.2) camera.position.y = 0.2;

    // Velocidade Instantânea Real (Horizontal + Vertical)
    const horizontalSpeed = moving ? moveSpeed * movementRamp.current : 0;
    const actualTotalSpeed = Math.sqrt(horizontalSpeed * horizontalSpeed + yVelocity.current * yVelocity.current);

    // Injetar dados de debug para o painel HTML (Apenas em DEV)
    if (import.meta.env.DEV) {
      (window as WindowWithDinoDebug).dinoDebug = {
        speed: actualTotalSpeed,
        gameScale: finalScale / GLOBAL_SCALE_MODIFIER,
        worldScale: finalScale,
      };
    }

    // Re-sincroniza posição após movimento e determina animationIntent
    PlayerPositionRef.x = playerRef.current.position.x;
    PlayerPositionRef.y = playerRef.current.position.y;
    PlayerPositionRef.z = playerRef.current.position.z;
    // rotY preservado do topo do frame (lastMoveAngle), não lê rotation.y (Euler singularity)

    // animationIntent normal (after movement code runs = não locked/dead)
    const intentNotGrounded = !isGrounded.current;
    PlayerPositionRef.animationIntent = intentNotGrounded ? 'Jump' : moving ? (isRunning ? 'Run' : 'Walk') : 'Idle';

    // Client online: envia posição/estado para o host
    sendClientInput(false, false, moving, isRunning);
  });

  // Geometrias de debug compartilhadas (Unidade 1x1x1 para escala fácil)
  const debugGeo = useMemo(() => new THREE.CylinderGeometry(1, 1, 1, 12), []);
  const debugInteractGeo = useMemo(() => new THREE.CylinderGeometry(1, 1, 1, 12), []);
  const debugMat = useMemo(() => new THREE.MeshBasicMaterial({ color: 'red', wireframe: true, transparent: true, opacity: 0.3 }), []);
  const debugInteractMat = useMemo(() => new THREE.MeshBasicMaterial({ color: 'orange', wireframe: true, transparent: true, opacity: 0.2 }), []);

  // Limpeza de memória ao desmontar o jogador ou trocar de espécie
  useEffect(() => {
    return () => {
      playerModel.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) {
          const mesh = child as THREE.Mesh;
          mesh.geometry.dispose();
          if (Array.isArray(mesh.material)) {
            mesh.material.forEach(m => m.dispose());
          } else {
            mesh.material.dispose();
          }
        }
      });
    };
  }, [playerModel]);

  return (
    <>
      {!isDead && <PointerLockControls enabled={!isActing} />}
      <group ref={playerRef} position={[0, 0, 0]}>
        <group scale={[finalScale, finalScale, finalScale]}>
          <primitive object={playerModel} />
        </group>

        {/* Debug Collisions - Otimizado */}
        {debugCollisions && (
          <>
            {/* Colisão Física */}
            <mesh
              geometry={debugGeo}
              material={debugMat}
              position={[0, (dinoStats.collisionHeight / 2) * finalScale, 0]}
              scale={[dinoStats.collisionRadius * finalScale, dinoStats.collisionHeight * finalScale, dinoStats.collisionRadius * finalScale]}
            />
            {/* Área de Interação (Comida) */}
            <mesh
              geometry={debugInteractGeo}
              material={debugInteractMat}
              position={[0, (dinoStats.collisionHeight / 2) * finalScale, 0]}
              scale={[interactRadius, dinoStats.collisionHeight * finalScale, interactRadius]}
            />
          </>
        )}
      </group>
    </>
  );
};
