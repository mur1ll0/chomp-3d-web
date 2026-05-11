import React, { useRef, useEffect, useMemo, useCallback } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF, useAnimations } from '@react-three/drei';
import * as THREE from 'three';
import { NPCManager } from '../../useCases/game/NPCManager';
import { DINOSAUR_ROSTER } from '../../domain/models/DinosaurStats';
import { getNPCScaleFactor } from '../../domain/models/NPCDinosaur';
import type { NPCData } from '../../domain/models/NPCDinosaur';
import { NPCState } from '../../domain/models/NPCState';
import { useAppStore } from '../../store/useAppStore';
import { PlayerPositionRef } from '../../useCases/game/PlayerPositionRef';

// Pre-load all models
DINOSAUR_ROSTER.forEach(d => useGLTF.preload(d.modelPath));

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
const NPCInstance: React.FC<{ npc: NPCData; debug: boolean; debugGeo: THREE.BufferGeometry; debugMat: THREE.Material }> = React.memo(({ npc, debug, debugGeo, debugMat }) => {
  const stats = useMemo(() => DINOSAUR_ROSTER.find(d => d.id === npc.speciesId)!, [npc.speciesId]);
  const gltf = useGLTF(stats.modelPath);
  const groupRef = useRef<THREE.Group>(null);
  const innerGroupRef = useRef<THREE.Group>(null);

  // Fix animations durations
  const fixedAnimations = useMemo(() => {
    if (!gltf.animations) return [];
    return gltf.animations.map(clip => {
      const newClip = clip.clone();
      let maxActiveTime = 0;
      newClip.tracks.forEach(track => {
        if (track.times.length > 0) maxActiveTime = Math.max(maxActiveTime, track.times[track.times.length - 1]);
      });
      if (maxActiveTime > 0) newClip.duration = maxActiveTime;
      return newClip;
    });
  }, [gltf.animations]);

  // Clone isolado e CORRETO do esqueleto
  const { clonedScene, cachedMaterials } = useMemo(() => {
    const clone = cloneSkinnedMesh(gltf.scene);
    const mats: THREE.MeshStandardMaterial[] = [];
    
    clone.position.set(0, 0, 0);
    clone.rotation.set(0, 0, 0);
    clone.scale.set(1, 1, 1);

    clone.traverse((child) => {
      if ((child as THREE.SkinnedMesh).isSkinnedMesh) {
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

  const { actions, names } = useAnimations(fixedAnimations, clonedScene);
  const currentAnimRef = useRef<string>('');
  const activeActionRef = useRef<THREE.AnimationAction | null>(null);
  const lastColorState = useRef<'normal' | 'hit' | 'dead'>('normal');

  const playAnimation = useCallback((intent: string, loop: boolean = true) => {
    if (currentAnimRef.current === intent && activeActionRef.current) return;
    const name = names.find(n => n.toLowerCase().includes(intent.toLowerCase())) || names[0];
    const action = actions[name];
    if (!action) return;

    if (activeActionRef.current) activeActionRef.current.fadeOut(0.2);
    
    const loopType = loop ? THREE.LoopRepeat : THREE.LoopOnce;
    const repetitions = loop ? Infinity : 1;
    
    action.reset().setLoop(loopType, repetitions).fadeIn(0.2).play();
    action.clampWhenFinished = !loop;
    activeActionRef.current = action;
    currentAnimRef.current = intent;
  }, [names, actions]);

  useFrame(() => {
    if (!groupRef.current) return;
    const data = NPCManager.getNPC(npc.id);
    if (!data) return;

    // Movimentação do container principal
    groupRef.current.position.set(data.posX, data.posY, data.posZ);
    groupRef.current.rotation.y = data.rotY;
    groupRef.current.updateMatrixWorld();

    // Escala baseada no crescimento
    const scale = getNPCScaleFactor(data.level, stats);
    if (innerGroupRef.current) innerGroupRef.current.scale.setScalar(scale);

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

  return (
    <group ref={groupRef}>
      <group ref={innerGroupRef}>
        <primitive object={clonedScene} />
        {debug && (
          <mesh 
            geometry={debugGeo} 
            material={debugMat} 
            position={[0, 4, 0]} 
          />
        )}
      </group>
    </group>
  );
});

export const NPCDinosaurs: React.FC = () => {
  const debugCollisions = useAppStore(s => s.debugCollisions);
  const [renderList, setRenderList] = React.useState<NPCData[]>([]);
  const updateCounter = useRef(0);

  const debugGeo = useMemo(() => new THREE.CylinderGeometry(2, 2, 8, 8), []);
  const debugMat = useMemo(() => new THREE.MeshBasicMaterial({ color: 'yellow', wireframe: true, transparent: true, opacity: 0.5 }), []);

  useEffect(() => {
    NPCManager.reset();
    return () => NPCManager.reset();
  }, []);

  useFrame((_, delta) => {
    const pp = PlayerPositionRef;
    if (!pp.isDead) {
      NPCManager.update(delta, pp.x, pp.z, pp.level, pp.scale, pp.diet);
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
          />
        </React.Suspense>
      ))}
    </group>
  );
};
