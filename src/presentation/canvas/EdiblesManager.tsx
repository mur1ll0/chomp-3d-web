import React, { useMemo, useRef, useEffect, useCallback } from 'react';
import * as THREE from 'three';
import { useAppStore } from '../../store/useAppStore';
import { Html } from '@react-three/drei';
import { NPCManager } from '../../useCases/game/NPCManager';
import { NPCState } from '../../domain/models/NPCState';
import { DINOSAUR_ROSTER } from '../../domain/models/DinosaurStats';
import { getNPCScaleFactor } from '../../domain/models/NPCDinosaur';
import type { ChunkData, MapEdible } from '../../infrastructure/generation/MapGenerator';

interface EdiblesManagerProps {
  chunks: ChunkData[];
}

const MAX_EDIBLES_PER_TYPE = 500;

// Objetos reutilizáveis para evitar alocações no loop
const _tempMatrix = new THREE.Matrix4();
const _tempPos = new THREE.Vector3();
const _tempQuat = new THREE.Quaternion();
const _tempScale = new THREE.Vector3();
const _upAxis = new THREE.Vector3(0, 1, 0);
const _zeroMatrix = new THREE.Matrix4().set(0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0);

export const EdiblesManager: React.FC<EdiblesManagerProps> = ({ chunks }) => {
  // Subscriptions leves do Zustand (selectors específicos)
  const interactableEdibleId = useAppStore(s => s.interactableEdibleId);
  // Subscription ao edibleStates APENAS para atualizar o highlight do item interagível.
  // Os instanced meshes são atualizados via subscribe() imperativo (sem re-render).
  const edibleStates = useAppStore(s => s.edibleStates);

  const plantMeshRef = useRef<THREE.InstancedMesh>(null);
  const meatMeshRef = useRef<THREE.InstancedMesh>(null);
  const plantsRef = useRef<MapEdible[]>([]);
  const meatsRef = useRef<MapEdible[]>([]);

  // Lista de todos os edibles dos chunks visíveis
  const allEdibles = useMemo(() => chunks.flatMap(c => c.edibles), [chunks]);
  
  // Mapa para busca rápida O(1) do edible interagível
  const ediblesMap = useMemo(() => {
    const map = new Map<string, MapEdible>();
    for (const e of allEdibles) map.set(e.id, e);
    return map;
  }, [allEdibles]);

  // Atualiza refs quando chunks mudam
  useEffect(() => {
    plantsRef.current = allEdibles.filter(e => e.type === 'Plant');
    meatsRef.current = allEdibles.filter(e => e.type === 'Meat');
  }, [allEdibles]);

  // Função imperativa para atualizar matrizes (SEM re-render React)
  const updateMeshes = useCallback(() => {
    const states = useAppStore.getState().edibleStates;

    if (plantMeshRef.current) {
      let count = 0;
      for (const plant of plantsRef.current) {
        if (count >= MAX_EDIBLES_PER_TYPE) break;
        const remaining = states[plant.id] ?? 1.0;
        if (remaining <= 0) continue;
        const s = plant.scale * remaining;
        _tempPos.set(plant.position[0], plant.position[1], plant.position[2]);
        _tempQuat.setFromAxisAngle(_upAxis, plant.rotation);
        _tempScale.set(s, s, s);
        _tempMatrix.compose(_tempPos, _tempQuat, _tempScale);
        plantMeshRef.current!.setMatrixAt(count, _tempMatrix);
        count++;
      }
      for (let i = count; i < plantMeshRef.current.count; i++) {
        plantMeshRef.current.setMatrixAt(i, _zeroMatrix);
      }
      plantMeshRef.current.count = count;
      plantMeshRef.current.instanceMatrix.needsUpdate = true;
      plantMeshRef.current.computeBoundingSphere();
    }

    if (meatMeshRef.current) {
      let count = 0;
      for (const meat of meatsRef.current) {
        if (count >= MAX_EDIBLES_PER_TYPE) break;
        const remaining = states[meat.id] ?? 1.0;
        if (remaining <= 0) continue;
        const s = meat.scale * remaining;
        _tempPos.set(meat.position[0], meat.position[1], meat.position[2]);
        _tempQuat.setFromAxisAngle(_upAxis, meat.rotation);
        _tempScale.set(s, s, s);
        _tempMatrix.compose(_tempPos, _tempQuat, _tempScale);
        meatMeshRef.current!.setMatrixAt(count, _tempMatrix);
        count++;
      }
      for (let i = count; i < meatMeshRef.current.count; i++) {
        meatMeshRef.current.setMatrixAt(i, _zeroMatrix);
      }
      meatMeshRef.current.count = count;
      meatMeshRef.current.instanceMatrix.needsUpdate = true;
      meatMeshRef.current.computeBoundingSphere();
    }
  }, []);

  // Atualiza quando os chunks mudam
  useEffect(() => { updateMeshes(); }, [allEdibles, updateMeshes]);

  // Escuta mudanças no edibleStates para atualizar instanced meshes imperativamente
  useEffect(() => {
    return useAppStore.subscribe((state, prevState) => {
      if (state.edibleStates !== prevState.edibleStates) {
        updateMeshes();
      }
    });
  }, [updateMeshes]);

  // Lógica de Crescimento Gradual (Regrow) - 1x por segundo
  useEffect(() => {
    const interval = setInterval(() => {
      useAppStore.getState().regrowEdibles(1);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Highlight do edible interagível — depende de edibleStates para acompanhar o tamanho
  const interactableData = useMemo(() => {
    if (!interactableEdibleId) return null;
    
    let edible = ediblesMap.get(interactableEdibleId);
    
    // Se não for um edible estático, verifica se é um NPC morto
    if (!edible && interactableEdibleId.startsWith('npc_')) {
      const npc = NPCManager.getNPC(interactableEdibleId);
      if (npc && npc.state === NPCState.Dead) {
        const stats = DINOSAUR_ROSTER.find(d => d.id === npc.speciesId);
        const scaleFactor = stats ? getNPCScaleFactor(npc.level, stats) : 0.5;
        const npcEdible: MapEdible = {
          id: npc.id,
          type: 'Meat',
          position: [npc.posX, npc.posY, npc.posZ] as [number, number, number],
          rotation: npc.rotY,
          scale: scaleFactor * 4.0 // Usando multiplicador 4.0 para durar mais
        };
        edible = npcEdible;
      }
    }

    if (!edible) return null;
    const remaining = edibleStates[edible.id] ?? 1.0;
    if (remaining <= 0) return null;
    const s = edible.scale * remaining;
    return {
      position: edible.position as [number, number, number],
      rotation: edible.rotation,
      scale: s,
      type: edible.type
    };
  }, [interactableEdibleId, ediblesMap, edibleStates]);

  return (
    <group>
      {/* Plants (Instanced) */}
      <instancedMesh ref={plantMeshRef} args={[undefined, undefined, MAX_EDIBLES_PER_TYPE]} frustumCulled>
        <dodecahedronGeometry args={[0.5, 0]} />
        <meshStandardMaterial color="#84cc16" emissive="#3f6212" emissiveIntensity={0.5} />
      </instancedMesh>

      {/* Meats (Instanced) */}
      <instancedMesh ref={meatMeshRef} args={[undefined, undefined, MAX_EDIBLES_PER_TYPE]} frustumCulled>
        <boxGeometry args={[0.8, 0.4, 0.6]} />
        <meshStandardMaterial color="#ef4444" roughness={0.7} />
      </instancedMesh>

      {/* Destaque e tooltip do edible interagível */}
      {interactableData && (
        <group position={interactableData.position}>
          {interactableEdibleId?.startsWith('npc_') ? (
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.08, 0]}>
              <ringGeometry args={[interactableData.scale * 0.65, interactableData.scale * 0.95, 48]} />
              <meshStandardMaterial
                color="#ef4444"
                emissive="#f59e0b"
                emissiveIntensity={1.2}
                transparent
                opacity={0.85}
                side={THREE.DoubleSide}
              />
            </mesh>
          ) : (
            <mesh
              scale={[interactableData.scale * 1.08, interactableData.scale * 1.08, interactableData.scale * 1.08]}
              rotation={[0, interactableData.rotation, 0]}
            >
              {interactableData.type === 'Plant'
                ? <dodecahedronGeometry args={[0.5, 0]} />
                : <boxGeometry args={[0.8, 0.4, 0.6]} />
              }
              <meshStandardMaterial
                color={interactableData.type === 'Plant' ? "#84cc16" : "#ef4444"}
                emissive="#eab308"
                emissiveIntensity={1.1}
              />
            </mesh>
          )}
          
          <Html position={[0, 1.5, 0]} center zIndexRange={[100, 0]}>
            <div className="bg-slate-900/90 text-white px-3 py-1 rounded-lg font-bold text-sm pointer-events-none animate-bounce border border-orange-500 shadow-xl shadow-orange-500/20 whitespace-nowrap">
              Comer [E]
            </div>
          </Html>
        </group>
      )}
    </group>
  );
};
