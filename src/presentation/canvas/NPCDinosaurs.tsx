import React, { useRef, useEffect, useMemo, useLayoutEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
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

// Pre-load all models
DINOSAUR_ROSTER.forEach(d => useGLTF.preload(d.modelPath));

const _tempPos = new THREE.Vector3();
const _tempScale = new THREE.Vector3();

/**
 * Helper para clonar SkinnedMeshes corretamente (incluindo esqueleto).
 */
function cloneSkinnedMesh(source: THREE.Group) {
  const clone = source.clone(true);
  const nodes: Record<string, THREE.Object3D> = {};
  const sourceNodes: Record<string, THREE.Object3D> = {};
  
  clone.traverse(node => { nodes[node.name] = node; });
  source.traverse(node => { sourceNodes[node.name] = node; });

  clone.traverse(node => {
    if ((node as THREE.SkinnedMesh).isSkinnedMesh) {
      const mesh = node as THREE.SkinnedMesh;
      const sourceMesh = sourceNodes[node.name] as THREE.SkinnedMesh;
      if (sourceMesh && sourceMesh.skeleton) {
        mesh.skeleton = sourceMesh.skeleton.clone();
        mesh.bind(mesh.skeleton, sourceMesh.bindMatrix);
        // Reconecta os ossos aos novos nós do clone
        mesh.skeleton.bones = sourceMesh.skeleton.bones.map(bone => {
          return nodes[bone.name] as THREE.Bone;
        });
      }
    }
  });
  return clone;
}

/**
 * Instância individual de um NPC.
 */
const NPCInstance: React.FC<{ 
  npc: NPCData; 
  debug: boolean; 
  debugGeo: THREE.BufferGeometry; 
  debugMat: THREE.Material;
  debugInteractMat: THREE.Material;
}> = React.memo(({ npc, debug, debugGeo, debugMat, debugInteractMat }) => {
  const stats = useMemo(() => DINOSAUR_ROSTER.find(d => d.id === npc.speciesId)!, [npc.speciesId]);
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
    </group>
  );
});

export const NPCDinosaurs: React.FC = () => {
  const debugCollisions = useAppStore(s => s.debugCollisions);
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

  useLayoutEffect(() => {
    NPCManager.configureGateways(gameStateGateway, worldQueryGateway);
    NPCManager.configureWorldSeed(WORLD_SEED);
    NPCManager.reset();
    return () => NPCManager.reset();
  }, [gameStateGateway, worldQueryGateway]);

  useFrame((_, delta) => {
    const pp = PlayerPositionRef;
    if (!pp.isDead) {
      simulationAccumulator.current = Math.min(simulationAccumulator.current + delta, FIXED_TIMESTEP * MAX_SUBSTEPS);

      let substeps = 0;
      while (simulationAccumulator.current >= FIXED_TIMESTEP && substeps < MAX_SUBSTEPS) {
        NPCManager.update(FIXED_TIMESTEP, pp.x, pp.z, pp.level, pp.scale, pp.diet, pp.strength);
        simulationAccumulator.current -= FIXED_TIMESTEP;
        substeps++;
      }

      const dmg = NPCManager.consumePlayerDamage();
      if (dmg > 0) useAppStore.getState().takeDamage(dmg);
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
            debugGeo={debugGeo} 
            debugMat={debugMat} 
            debugInteractMat={debugInteractMat}
          />
        </React.Suspense>
      ))}
    </group>
  );
};
