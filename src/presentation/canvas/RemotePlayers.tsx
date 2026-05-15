import React, { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { Text, useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { DINOSAUR_ROSTER } from '../../domain/models/DinosaurStats';
import { getNPCScaleFactor } from '../../domain/models/NPCDinosaur';
import { useAppStore } from '../../store/useAppStore';
import { PeerMesh } from '../../infrastructure/network/PeerMesh';
import { cloneSkinnedMesh } from '../utils/ThreeUtils';
import { useDinosaurAnimations } from '../hooks/useDinosaurAnimations';
import type { PlayerStateMessage } from '../../infrastructure/network/messages';

const _tempPos = new THREE.Vector3();

const ONESHOT_INTENTS = new Set(['Attack', 'Eat', 'Death']);

const RemotePlayerInstance: React.FC<{ state: PlayerStateMessage; name: string; dinoId: string }> = ({ state, name, dinoId }) => {
  const stats = useMemo(() => DINOSAUR_ROSTER.find(d => d.id === dinoId) ?? DINOSAUR_ROSTER[0], [dinoId]);
  const gltf = useGLTF(stats.modelPath);
  const groupRef = useRef<THREE.Group>(null);
  const stateRef = useRef(state);
  const prevAnimIntent = useRef('');

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const { clonedScene } = useMemo(() => {
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
          const mat = (mesh.material as THREE.MeshStandardMaterial).clone();
          mats.push(mat);
          mesh.material = mat;
        }
      }
    });
    return { clonedScene: clone };
  }, [gltf.scene]);

  const { playAnimation } = useDinosaurAnimations(gltf, clonedScene);

  useFrame((_, delta) => {
    if (!groupRef.current) return;
    const s = stateRef.current;
    const interp = Math.min(1, delta * 12);

    groupRef.current.position.lerp(_tempPos.set(s.posX, s.posY ?? 0, s.posZ), interp);

    let angleDiff = s.rotY - groupRef.current.rotation.y;
    while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
    while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
    groupRef.current.rotation.y += angleDiff * interp;

    groupRef.current.updateMatrixWorld();

    const intent = s.animationIntent || 'Idle';
    const isOneShot = ONESHOT_INTENTS.has(intent);
    const intentChanged = intent !== prevAnimIntent.current;
    prevAnimIntent.current = intent;

    if (isOneShot) {
      if (intentChanged) playAnimation(intent, false);
    } else {
      playAnimation(intent, true);
    }
  });

  const currentScale = getNPCScaleFactor(state.level ?? 1, stats);

  return (
    <group ref={groupRef}>
      <group scale={[currentScale, currentScale, currentScale]}>
        <primitive object={clonedScene} />
      </group>
      <Text
        position={[0, (stats.collisionHeight + 1.5) * currentScale, 0]}
        fontSize={Math.max(0.15, currentScale * 1.65)}
        color="#fbbf24"
        anchorX="center"
        anchorY="bottom"
        outlineColor="#000000"
        outlineWidth={0.025}
      >
        {name}
      </Text>
    </group>
  );
};

export const RemotePlayers: React.FC = () => {
  const gameMode = useAppStore(s => s.gameMode);

  if (gameMode === 'single' || gameMode === null) return null;

  const remoteStates = PeerMesh.getRemotePlayerStates();
  const connectedPeers = PeerMesh.getConnectedPeers();
  const ownPeerId = PeerMesh.getOwnPeerId();

  const peerInfoMap = new Map<string, string>();
  for (const p of connectedPeers) {
    peerInfoMap.set(p.peerId, p.dinoId);
  }

  const entries: Array<{ state: PlayerStateMessage; name: string; dinoId: string; id: string }> = [];
  for (const [peerId, state] of remoteStates) {
    if (peerId === ownPeerId) continue;
    const info = connectedPeers.find(p => p.peerId === peerId);
    const displayName = info?.playerName ?? peerId;
    const dinoId = peerInfoMap.get(peerId) ?? 'Velociraptor';
    entries.push({ state, name: displayName, dinoId, id: peerId });
  }

  if (entries.length === 0) return null;

  return (
    <group>
      {entries.map(e => (
        <React.Suspense key={e.id} fallback={null}>
          <RemotePlayerInstance state={e.state} name={e.name} dinoId={e.dinoId} />
        </React.Suspense>
      ))}
    </group>
  );
};
