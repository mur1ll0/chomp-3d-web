import React, { useRef, useEffect, useMemo, useLayoutEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { Text, useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { NPCManager } from '../../useCases/game/NPCManager';
import { DINOSAUR_ROSTER } from '../../domain/models/DinosaurStats';
import { getNPCScaleFactor } from '../../domain/models/NPCDinosaur';
import type { NPCData } from '../../domain/models/NPCDinosaur';
import { NPCState } from '../../domain/models/NPCState';
import { useAppStore } from '../../store/useAppStore';
import { PlayerPositionRef } from '../../useCases/game/PlayerPositionRef';
import { calculateInteractRadius } from '../../domain/services/DinosaurService';
import { useDinosaurAnimations } from '../hooks/useDinosaurAnimations';
import { ZustandGameStateGateway } from '../../infrastructure/adapters/ZustandGameStateGateway';
import { MapWorldQueryGateway } from '../../infrastructure/adapters/MapWorldQueryGateway';
import { WORLD_SEED } from '../../infrastructure/generation/MapGenerator';
import { getNpcPerceptionProfile } from '../../useCases/game/systems/NPCPerceptionUtils';
import { cloneSkinnedMesh } from '../utils/ThreeUtils';
import { PeerMesh } from '../../infrastructure/network/PeerMesh';
import { peerSession } from '../../infrastructure/network/PeerSession';
import { NpcSnapshotInterpolator } from '../../useCases/game/network/NpcSnapshotInterpolator';

// Singletons reutilizáveis para evitar alocações no loop de render
const _tempPos = new THREE.Vector3();
const _tempScale = new THREE.Vector3();

// Lookup O(1) para stats de dinossauros — evita Array.find() em hot path
const dinoStatsMap: Record<string, import('../../domain/models/DinosaurStats').DinosaurStats> = {};
for (const d of DINOSAUR_ROSTER) dinoStatsMap[d.id] = d;

/**
 * Instância individual de um NPC.
 */
const NPCInstance: React.FC<{ 
  npc: NPCData; 
  debug: boolean;
  debugLevel: boolean;
  debugVision: boolean;
  debugGeo: THREE.BufferGeometry; 
  debugMat: THREE.Material;
  debugInteractMat: THREE.Material;
  debugVisionGeo: THREE.BufferGeometry;
  debugVisionMat: THREE.Material;
}> = React.memo(({ npc, debug, debugLevel, debugVision, debugGeo, debugMat, debugInteractMat, debugVisionGeo, debugVisionMat }) => {
  const stats = useMemo(() => DINOSAUR_ROSTER.find(d => d.id === npc.speciesId)!, [npc.speciesId]);
  const perception = useMemo(() => getNpcPerceptionProfile(npc.diet), [npc.diet]);
  const gltf = useGLTF(stats.modelPath);
  const groupRef = useRef<THREE.Group>(null);
  const innerGroupRef = useRef<THREE.Group>(null);
  const visualReadyRef = useRef(false);

  // Clone isolado e CORRETO do esqueleto
  const { clonedScene, cachedMaterials } = useMemo(() => {
    const clone = cloneSkinnedMesh(gltf.scene);
    const mats: THREE.MeshStandardMaterial[] = [];
    
    clone.position.set(0, 0, 0);
    clone.rotation.set(0, 0, 0);
    clone.scale.set(1, 1, 1);

    clone.traverse((child) => {
      if ((child as THREE.SkinnedMesh).isSkinnedMesh) {
        // Mantido desabilitado apenas para SkinnedMesh por bounds inconsistentes em animações.
        (child as THREE.SkinnedMesh).frustumCulled = false;
      }
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        if (mesh.material && !Array.isArray(mesh.material)) {
          mesh.material = (mesh.material as THREE.MeshStandardMaterial).clone();
          const mat = mesh.material as THREE.MeshStandardMaterial;
          mat.userData.originalColor = mat.color.clone();
          mats.push(mat);
        }
      }
    });
    return { clonedScene: clone, cachedMaterials: mats };
  }, [gltf.scene]);

  const { names, playAnimation } = useDinosaurAnimations(gltf, clonedScene);
  const lastColorState = useRef<'normal' | 'hit' | 'dead'>('normal');

  useEffect(() => {
    if (names && names.length > 0) {
      playAnimation('Idle');
    }
  }, [names, playAnimation]);

  useFrame((_, delta) => {
    if (!groupRef.current) return;
    const data = NPCManager.getNPC(npc.id);
    if (!data) return;

    // Movimentação do container principal
    const interp = Math.min(1, delta * 12);
    if (!visualReadyRef.current) {
      groupRef.current.position.set(data.posX, data.posY, data.posZ);
      groupRef.current.rotation.y = data.rotY;
      visualReadyRef.current = true;
    } else {
      groupRef.current.position.lerp(_tempPos.set(data.posX, data.posY, data.posZ), interp);
      let angleDiff = data.rotY - groupRef.current.rotation.y;
      while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
      while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
      groupRef.current.rotation.y += angleDiff * interp;
    }
    groupRef.current.updateMatrixWorld();

    // Escala baseada no crescimento e se é uma carcaça sendo comida
    const edibleStates = useAppStore.getState().edibleStates;
    const carcassFactor = data.state === NPCState.Dead ? (edibleStates[data.id] ?? 1.0) : 1.0;
    const currentScale = getNPCScaleFactor(data.level, stats);
    const visualScale = currentScale * carcassFactor;
    
    if (innerGroupRef.current) {
      const scaleInterp = Math.min(1, delta * 8);
      innerGroupRef.current.scale.lerp(_tempScale.setScalar(visualScale), scaleInterp);
    }

    // Animação
    const isOneShot = data.state === NPCState.Dead || data.state === NPCState.Attacking || data.state === NPCState.Eating;
    playAnimation(data.animationIntent, !isOneShot);

    // Hit Flash
    const colorState = data.state === NPCState.Dead ? 'dead' : data.isHit ? 'hit' : 'normal';
    if (colorState !== lastColorState.current) {
      lastColorState.current = colorState;
      cachedMaterials.forEach(m => {
        if (colorState === 'dead') m.color.set('#440000');
        else if (colorState === 'hit') m.color.set('#ff0000');
        else m.color.copy(m.userData.originalColor);
      });
    }
  });

  // Limpeza de memória ao desmontar o NPC
  useEffect(() => {
    return () => {
      clonedScene.traverse((child) => {
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
  }, [clonedScene]);

  const currentScale = getNPCScaleFactor(npc.level, stats);
  const visionRadius = Math.tan(perception.halfFovRad) * perception.viewDistance;
  const eyeHeight = (stats.collisionHeight * 0.42 + perception.eyeHeight) * currentScale;

  return (
    <group ref={groupRef}>
      <group ref={innerGroupRef}>
        <primitive object={clonedScene} />
      </group>
      {debug && npc.state !== NPCState.Dead && (
        <mesh 
          geometry={debugGeo} 
          material={debugMat} 
          position={[0, (stats.collisionHeight / 2) * currentScale, 0]} 
          scale={[stats.collisionRadius * currentScale, stats.collisionHeight * currentScale, stats.collisionRadius * currentScale]}
        />
      )}
      {/* Área de Interação/Ataque (Amarelo) - Permanece ativa se morto para ser comido */}
      {debug && (
        <mesh 
          geometry={debugGeo} 
          material={debugInteractMat} 
          position={[0, (stats.collisionHeight / 2) * currentScale, 0]} 
          scale={[calculateInteractRadius(stats.interactRadius, currentScale), stats.collisionHeight * currentScale, calculateInteractRadius(stats.interactRadius, currentScale)]}
        />
      )}
      {debugVision && npc.state !== NPCState.Dead && (
        <mesh
          geometry={debugVisionGeo}
          material={debugVisionMat}
          position={[0, eyeHeight, perception.viewDistance * 0.5]}
          rotation={[Math.PI / 2, 0, 0]}
          scale={[visionRadius, perception.viewDistance, visionRadius]}
        />
      )}
      {debugLevel && npc.state !== NPCState.Dead && (
        <Text
          position={[0, (stats.collisionHeight + 1.6) * currentScale, 0]}
          fontSize={Math.max(0.4, currentScale * 0.9)}
          color="#fef08a"
          anchorX="center"
          anchorY="middle"
        >
          {`Lv ${npc.level}`}
        </Text>
      )}
    </group>
  );
});

export const NPCDinosaurs: React.FC = () => {
  const debugCollisions = useAppStore(s => s.debugCollisions);
  const debugNpcLevels = useAppStore(s => s.debugNpcLevels);
  const debugNpcVision = useAppStore(s => s.debugNpcVision);
  const gameMode = useAppStore(s => s.gameMode);
  const onlineRole = useAppStore(s => s.onlineRole);
  const networkNPCs = useAppStore(s => s.networkNPCs) as import('../../domain/models/NPCDinosaur').NPCData[];
  const [renderList, setRenderList] = React.useState<NPCData[]>([]);
  const updateCounter = useRef(0);
  const hostBroadcastCounter = useRef(0);
  const simulationAccumulator = useRef(0);
  const gameStateGateway = useMemo(() => new ZustandGameStateGateway(), []);
  const worldQueryGateway = useMemo(() => new MapWorldQueryGateway(), []);
  const lastNetworkNPCs = useRef<NPCData[]>([]);

  const FIXED_TIMESTEP = 1 / 30;
  const MAX_SUBSTEPS = 3;

  const [isGlobalHost, setIsGlobalHost] = React.useState(false);
  const isPartyClient = gameMode === 'party' && onlineRole === 'client';
  const isGlobalClient = gameMode === 'global' && !isGlobalHost;
  const isClientMode = isPartyClient || isGlobalClient;
  const interpolatorRef = useRef<NpcSnapshotInterpolator | null>(null);

  const debugGeo = useMemo(() => new THREE.CylinderGeometry(1, 1, 1, 8), []);
  const debugMat = useMemo(() => new THREE.MeshBasicMaterial({ color: 'red', wireframe: true, transparent: true, opacity: 0.3 }), []);
  const debugInteractMat = useMemo(() => new THREE.MeshBasicMaterial({ color: 'yellow', wireframe: true, transparent: true, opacity: 0.15 }), []);
  const debugVisionGeo = useMemo(() => new THREE.ConeGeometry(1, 1, 20, 1, true), []);
  const debugVisionMat = useMemo(
    () => new THREE.MeshBasicMaterial({ color: '#38bdf8', wireframe: true, transparent: true, opacity: 0.22, side: THREE.DoubleSide }),
    []
  );

  useLayoutEffect(() => {
    NPCManager.configureGateways(gameStateGateway, worldQueryGateway);
    NPCManager.configureWorldSeed(WORLD_SEED);

    if (isClientMode) {
      interpolatorRef.current = new NpcSnapshotInterpolator();
      NPCManager.setAuthority(false);
      NPCManager.reset();
    } else {
      NPCManager.setAuthority(true);
      NPCManager.reset();
    }

    return () => {
      NPCManager.reset();
      interpolatorRef.current = null;
    };
  }, [gameStateGateway, worldQueryGateway, isClientMode]);

  // Client: quando networkNPCs muda no store, alimenta o interpolador
  React.useEffect(() => {
    if (!isClientMode || networkNPCs.length === 0) return;
    if (lastNetworkNPCs.current === networkNPCs) return;
    lastNetworkNPCs.current = networkNPCs;
    interpolatorRef.current?.pushSnapshot(networkNPCs);
  }, [isClientMode, networkNPCs]);

  // Host Migration: se o host desconectar, este cliente assume como novo host
  // Usa event-driven via PeerSession — sem polling
  React.useEffect(() => {
    if (!isPartyClient) return;

    const onTransfer = (newHostClientId: string) => {
      console.log(`Host transferindo para: ${newHostClientId}`);
      NPCManager.setAuthority(true);
    };

    peerSession.setOnHostTransferRequested(onTransfer);

    return () => {
      peerSession.setOnHostTransferRequested(null!);
    };
  }, [isPartyClient]);

  React.useEffect(() => {
    if (gameMode !== 'global') return;
    const interval = setInterval(() => {
      if (PeerMesh.isConnected()) {
        const peers = PeerMesh.getConnectedPeers();
        const allIds = [PeerMesh.getOwnPeerId(), ...peers.map(p => p.peerId)].sort();
        const amIHost = allIds[0] === PeerMesh.getOwnPeerId();
        if (amIHost !== isGlobalHost) {
          setIsGlobalHost(amIHost);
        }
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [gameMode, isGlobalHost]);

  useFrame((_, delta) => {
    const pp = PlayerPositionRef;

    if (isClientMode) {
      // Client: interpola NPCs dos snapshots do host apenas durante interpolação ativa
      // Quando estável (sem novo snapshot), evita alocações e diffing desnecessários
      const interp = interpolatorRef.current;
      const interpolated = interp?.update(delta);
      if (interpolated && interpolated.length > 0 && (interp?.isActive() ?? false)) {
        NPCManager.setNPCsFromNetwork(interpolated);
      }

      updateCounter.current++;
      if (updateCounter.current >= 15) {
        updateCounter.current = 0;
        setRenderList(NPCManager.getActiveNPCs());
      }
      return;
    }

    // Cliente remoto já retornou acima. Aqui só chegam host (onlineRole === 'host')
    // e single player (onlineRole === null), ou Global Mode. Ambos simulam NPCs localmente.

    // Host (Party): alimenta remotePlayers com estados dos clientes conectados
    if (gameMode === 'party' && onlineRole === 'host') {
      const hostPlayerStates = peerSession.getHostPlayerStates();
      const remotePlayers = hostPlayerStates.map(p => {
        const pStats = dinoStatsMap[p.dinoId];
        const defaultStats = DINOSAUR_ROSTER[0];
        return {
          id: p.id,
          posX: p.posX,
          posZ: p.posZ,
          level: p.level,
          diet: (pStats?.diet ?? 'Carnivore') as import('../../domain/models/DinosaurStats').Diet,
          scale: getNPCScaleFactor(p.level, pStats ?? defaultStats),
          strength: pStats?.strength ?? 5,
          collisionRadius: pStats?.collisionRadius ?? 2,
          interactRadius: pStats?.interactRadius ?? 3,
        };
      });
      NPCManager.setRemotePlayers(remotePlayers);
    }
    
    // Global Mode: alimenta remotePlayers via PeerMesh
    if (gameMode === 'global') {
      const states = PeerMesh.getRemotePlayerStates();
      const connectedPeers = PeerMesh.getConnectedPeers();
      const peerInfoMap = new Map<string, { dinoId: string }>();
      for (const p of connectedPeers) peerInfoMap.set(p.peerId, { dinoId: p.dinoId });
      
      const remotePlayers: Parameters<typeof NPCManager.setRemotePlayers>[0] = [];
      for (const [peerId, s] of states) {
        const info = peerInfoMap.get(peerId);
        if (!info) continue;
        const pStats = dinoStatsMap[info.dinoId];
        const defaultStats = DINOSAUR_ROSTER[0];
        remotePlayers.push({
          id: peerId,
          posX: s.posX,
          posZ: s.posZ,
          level: s.level,
          diet: (pStats?.diet ?? 'Carnivore'),
          scale: getNPCScaleFactor(s.level, pStats ?? defaultStats),
          strength: pStats?.strength ?? 5,
          collisionRadius: pStats?.collisionRadius ?? 2,
          interactRadius: pStats?.interactRadius ?? 3,
        });
      }
      NPCManager.setRemotePlayers(remotePlayers);
    }

    // Simulação autoritativa (host + single player + global mode)
    simulationAccumulator.current = Math.min(simulationAccumulator.current + delta, FIXED_TIMESTEP * MAX_SUBSTEPS);

    let substeps = 0;
    while (simulationAccumulator.current >= FIXED_TIMESTEP && substeps < MAX_SUBSTEPS) {
      NPCManager.update(FIXED_TIMESTEP, pp.x, pp.z, pp.level, pp.scale, pp.diet, pp.strength);
      simulationAccumulator.current -= FIXED_TIMESTEP;
      substeps++;
    }

    const dmg = NPCManager.consumePlayerDamage();
    if (!pp.isDead && dmg > 0) {
      useAppStore.getState().takeDamage(dmg);
    }
    
    // Global Mode: aplica dano remoto pendente
    if (gameMode === 'global') {
      const states = PeerMesh.getRemotePlayerStates();
      for (const [peerId] of states) {
        if (NPCManager.hasPendingRemoteDamage(peerId)) {
          NPCManager.consumeRemoteDamage(peerId);
        }
      }
    }

    // Host-only: processa inputs de clientes e broadcast de snapshots
    const isPartyHost = gameMode === 'party' && onlineRole === 'host';
    if (isPartyHost || isGlobalHost) {
      const hostState = useAppStore.getState();
      const allNPCs = NPCManager.getActiveNPCs();
      
      let allPlayers: any[] = [];
      
      if (isPartyHost) {
        const allClients = peerSession.getHostClients();
        for (const client of allClients) {
          const input = peerSession.peekRemoteInput(client.id);
          if (!input) continue;
          const clientStats = dinoStatsMap[client.dinoId];
          if (!clientStats) continue;
          const clientScale = getNPCScaleFactor(input.level, clientStats);
          const interactRadius = calculateInteractRadius(clientStats.interactRadius, clientScale);

          if (input.attacking) {
            NPCManager.processClientAttack(input.posX, input.posZ, input.level, clientStats.strength, interactRadius, client.id);
          }
          if (input.eating && input.eatingTargetId) {
            NPCManager.processClientEat(input.eatingTargetId, input.level, clientStats.strength, input.posX, input.posZ);
          }
        }
        const hostPlayerStates = peerSession.getHostPlayerStates();
        const hostPlayer: import('../../infrastructure/network/messages').PlayerStateSnapshot = {
          id: 'host',
          name: hostState.playerName,
          dinoId: hostState.selectedDinoId,
          dinoColors: hostState.dinoColors,
          posX: pp.x, posY: pp.y, posZ: pp.z,
          rotY: pp.rotY,
          level: pp.level,
          health: hostState.health,
          maxHealth: hostState.maxHealth,
          isDead: pp.isDead,
          animationIntent: pp.animationIntent,
        };
        const clientPlayers = hostPlayerStates.map(p => {
          if (NPCManager.hasPendingRemoteDamage(p.id)) {
            const damage = NPCManager.consumeRemoteDamage(p.id);
            return { ...p, health: Math.max(0, p.health - damage) };
          }
          return p;
        });
        allPlayers = [hostPlayer, ...clientPlayers];
      } else {
        // Global Host
        const states = PeerMesh.getRemotePlayerStates();
        const connectedPeers = PeerMesh.getConnectedPeers();
        const peerInfoMap = new Map<string, { dinoId: string, playerName: string, colors: Record<string, string> }>();
        for (const p of connectedPeers) peerInfoMap.set(p.peerId, { dinoId: p.dinoId, playerName: p.playerName, colors: p.colors });
        
        const hostPlayer = {
          id: PeerMesh.getOwnPeerId(),
          name: hostState.playerName,
          dinoId: hostState.selectedDinoId,
          dinoColors: hostState.dinoColors,
          posX: pp.x, posY: pp.y, posZ: pp.z,
          rotY: pp.rotY,
          level: pp.level,
          health: hostState.health,
          maxHealth: hostState.maxHealth,
          isDead: pp.isDead,
          animationIntent: pp.animationIntent,
        };
        const clientPlayers = [];
        for (const [peerId, s] of states) {
          const info = peerInfoMap.get(peerId);
          if (!info) continue;
          let h = s.health;
          if (NPCManager.hasPendingRemoteDamage(peerId)) {
            const damage = NPCManager.consumeRemoteDamage(peerId);
            h = Math.max(0, h - damage);
          }
          clientPlayers.push({
            id: peerId,
            name: info.playerName,
            dinoId: info.dinoId,
            dinoColors: info.colors,
            posX: s.posX, posY: s.posY, posZ: s.posZ,
            rotY: s.rotY,
            level: s.level,
            health: h,
            maxHealth: s.maxHealth,
            isDead: s.isDead,
            animationIntent: s.animationIntent,
          });
        }
        allPlayers = [hostPlayer, ...clientPlayers];
      }

      // THROTTLE BROADCAST (10 Hz in vez de 60 Hz)
      hostBroadcastCounter.current++;
      if (hostBroadcastCounter.current >= 3) {
        hostBroadcastCounter.current = 0;
        
        if (isPartyHost) {
          peerSession.broadcastSnapshot(
            NPCManager.getSimulationTick(),
            allNPCs,
            allPlayers,
            hostState.edibleStates
          );
        } else {
          PeerMesh.broadcastNpcSnapshot(
            NPCManager.getSimulationTick(),
            allNPCs,
            allPlayers
          );
        }
      }
    }

    updateCounter.current++;
    if (updateCounter.current >= 15) {
      updateCounter.current = 0;
      setRenderList(NPCManager.getActiveNPCs());
    }
  });

  return (
    <group>
      {renderList.map(npc => (
        <React.Suspense key={npc.id} fallback={null}>
          <NPCInstance 
            npc={npc} 
            debug={debugCollisions} 
            debugLevel={debugNpcLevels}
            debugVision={debugNpcVision}
            debugGeo={debugGeo} 
            debugMat={debugMat} 
            debugInteractMat={debugInteractMat}
            debugVisionGeo={debugVisionGeo}
            debugVisionMat={debugVisionMat}
          />
        </React.Suspense>
      ))}
    </group>
  );
};


