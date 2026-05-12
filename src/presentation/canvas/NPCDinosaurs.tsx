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

// Singletons reutilizáveis para evitar alocações no loop de render
const _tempPos = new THREE.Vector3();
const _tempScale = new THREE.Vector3();

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

  const { playAnimation } = useDinosaurAnimations(gltf, clonedScene);
  const lastColorState = useRef<'normal' | 'hit' | 'dead'>('normal');

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
  const [renderList, setRenderList] = React.useState<NPCData[]>([]);
  const updateCounter = useRef(0);
  const simulationAccumulator = useRef(0);
  const gameStateGateway = useMemo(() => new ZustandGameStateGateway(), []);
  const worldQueryGateway = useMemo(() => new MapWorldQueryGateway(), []);

  const FIXED_TIMESTEP = 1 / 30;
  const MAX_SUBSTEPS = 5;

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
    NPCManager.reset();
    return () => NPCManager.reset();
  }, [gameStateGateway, worldQueryGateway]);

  useFrame((_, delta) => {
    const pp = PlayerPositionRef;
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
