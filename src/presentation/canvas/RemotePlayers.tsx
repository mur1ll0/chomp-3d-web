import React, { useRef, useMemo, useEffect, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Text, useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { DINOSAUR_ROSTER } from '../../domain/models/DinosaurStats';
import { getNPCScaleFactor } from '../../domain/models/NPCDinosaur';
import { useAppStore } from '../../store/useAppStore';
import { PeerMesh } from '../../infrastructure/network/PeerMesh';
import { PlayerPositionRef } from '../../useCases/game/PlayerPositionRef';
import { cloneSkinnedMesh } from '../utils/ThreeUtils';

const _tempPos = new THREE.Vector3();

const ONESHOT_INTENTS = new Set(['Attack', 'Eat', 'Death']);

function findClip(animations: THREE.AnimationClip[], intent: string): THREE.AnimationClip | null {
  for (const clip of animations) {
    if (clip.name === intent) return clip;
    const lower = clip.name.toLowerCase();
    const search = intent.toLowerCase();
    if (lower.includes(search)) return clip;
  }
  return animations[0] ?? null;
}

const HIT_FLASH_DURATION = 0.3;

const RemotePlayerInstance: React.FC<{ peerId: string; name: string; dinoId: string; colors: Record<string, string> }> = ({ peerId, name, dinoId, colors }) => {
  const stats = useMemo(() => DINOSAUR_ROSTER.find(d => d.id === dinoId) ?? DINOSAUR_ROSTER[0], [dinoId]);
  const gltf = useGLTF(stats.modelPath);
  const groupRef = useRef<THREE.Group>(null);
  const prevAnimIntent = useRef('');
  const prevHealthRef = useRef<number | null>(null);
  const flashingUntilRef = useRef(0);
  const materialsRef = useRef<THREE.MeshStandardMaterial[]>([]);
  const [remoteLevel, setRemoteLevel] = useState(1);

  const colorsKey = useMemo(() => JSON.stringify(colors), [colors]);

  const { clonedScene, mixer, materials } = useMemo(() => {
    const clone = cloneSkinnedMesh(gltf.scene);
    clone.position.set(0, 0, 0);
    clone.rotation.set(0, 0, 0);
    clone.scale.set(1, 1, 1);
    const mats: THREE.MeshStandardMaterial[] = [];
    clone.traverse((child) => {
      if ((child as THREE.SkinnedMesh).isSkinnedMesh) {
        (child as THREE.SkinnedMesh).frustumCulled = false;
      }
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        if (mesh.material && !Array.isArray(mesh.material)) {
          const mat = (mesh.material as THREE.MeshStandardMaterial).clone();
          mat.userData.originalColor = mat.color.getHex();
          mesh.material = mat;
          mats.push(mat);
        }
      }
    });

    if (Object.keys(colors).length > 0) {
      clone.traverse((child) => {
        if ((child as THREE.Mesh).isMesh || (child as THREE.SkinnedMesh).isSkinnedMesh) {
          const mesh = child as THREE.Mesh;
          if (mesh.material && !Array.isArray(mesh.material)) {
            const mat = mesh.material as THREE.MeshStandardMaterial;
            if (mat.name && colors[mat.name]) {
              mat.color.set(colors[mat.name]);
              mat.userData.originalColor = mat.color.getHex();
            }
          }
        }
      });
    }

    const m = new THREE.AnimationMixer(clone);
    const clip = findClip(gltf.animations ?? [], 'Idle');
    if (clip) {
      const action = m.clipAction(clip);
      action.play();
    }

    return { clonedScene: clone, mixer: m, materials: mats };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gltf.scene, gltf.animations, dinoId, colorsKey]);

  useEffect(() => {
    materialsRef.current = materials;
    return () => { materialsRef.current = []; };
  }, [materials]);

  useEffect(() => {
    return () => {
      mixer.stopAllAction();
    };
  }, [mixer]);

  // Animação: atualiza a 60fps
  const prevActionRef = useRef<THREE.AnimationAction | null>(null);

  useFrame((_, delta) => {
    if (!groupRef.current) return;

    const latestStates = PeerMesh.getRemotePlayerStates();
    const s = latestStates.get(peerId);
    if (!s) {
      groupRef.current.visible = false;
      return;
    }
    groupRef.current.visible = true;

    if (s.level && s.level !== remoteLevel) {
      setRemoteLevel(s.level);
    }

    // Hit flash detection: se health diminuiu, pisca vermelho
    const currentHealth = s.health;
    if (prevHealthRef.current !== null && currentHealth < prevHealthRef.current) {
      flashingUntilRef.current = performance.now() + HIT_FLASH_DURATION * 1000;
    }
    prevHealthRef.current = currentHealth;

    const now = performance.now();
    const isFlashing = now < flashingUntilRef.current;
    for (const mat of materialsRef.current) {
      if (isFlashing) {
        mat.color.set('red');
      } else {
        const orig = mat.userData.originalColor as number | undefined;
        if (orig !== undefined) {
          mat.color.setHex(orig);
        }
      }
    }

    // Sempre interpola posição/rotação (mesmo invisível, para reentrada suave)
    const interp = Math.min(1, delta * 12);
    groupRef.current.position.lerp(_tempPos.set(s.posX, s.posY ?? 0, s.posZ), interp);

    let angleDiff = s.rotY - groupRef.current.rotation.y;
    while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
    while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
    groupRef.current.rotation.y += angleDiff * interp;

    groupRef.current.updateMatrixWorld();

    // Culling por distância: não renderiza se muito longe (poupa GPU/CPU)
    const RENDER_DISTANCE_SQ = 40000;
    const dx = s.posX - PlayerPositionRef.x;
    const dz = s.posZ - PlayerPositionRef.z;
    groupRef.current.visible = (dx * dx + dz * dz) <= RENDER_DISTANCE_SQ;
    if (!groupRef.current.visible) return;

    const fullIntent = s.animationIntent || 'Idle';
    const intentParts = fullIntent.split('_');
    const intent = intentParts[0];

    const intentChanged = fullIntent !== prevAnimIntent.current;
    prevAnimIntent.current = fullIntent;

    if (intentChanged) {
      const clip = findClip(gltf.animations ?? [], intent);
      if (clip) {
        const isOneShot = ONESHOT_INTENTS.has(intent);
        const action = mixer.clipAction(clip);
        action.reset();
        if (isOneShot) {
          action.setLoop(THREE.LoopOnce, 1);
          action.clampWhenFinished = true;
        } else {
          action.setLoop(THREE.LoopRepeat, Infinity);
          action.clampWhenFinished = false;
        }
        
        if (prevActionRef.current && prevActionRef.current !== action) {
          action.crossFadeFrom(prevActionRef.current, 0.2, true);
        }
        action.play();
        prevActionRef.current = action;
      }
    }

    mixer.update(delta);
  });

  const currentScale = getNPCScaleFactor(remoteLevel, stats);

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
  const connectedPlayers = useAppStore(s => s.connectedPlayers);
  const remoteStateVersion = useAppStore(s => s.remotePlayerStateVersion);
  void connectedPlayers;
  void remoteStateVersion;

  if (gameMode === 'single' || gameMode === null) return null;

  const remoteStates = PeerMesh.getRemotePlayerStates();
  const connectedPeers = PeerMesh.getConnectedPeers();
  const ownPeerId = PeerMesh.getOwnPeerId();

  const peerInfoMap = new Map<string, { dinoId: string; colors: Record<string, string>; playerName: string }>();
  for (const p of connectedPeers) {
    peerInfoMap.set(p.peerId, { dinoId: p.dinoId, colors: p.colors, playerName: p.playerName });
  }

  const entries: Array<{ peerId: string; name: string; dinoId: string; colors: Record<string, string> }> = [];
  for (const [peerId] of remoteStates) {
    if (peerId === ownPeerId) continue;
    const info = peerInfoMap.get(peerId);
    if (!info) continue;
    entries.push({ peerId, name: info.playerName, dinoId: info.dinoId, colors: info.colors });
  }

  if (entries.length === 0) return null;

  return (
    <group>
      {entries.map(e => (
        <React.Suspense key={e.peerId} fallback={null}>
          <RemotePlayerInstance peerId={e.peerId} name={e.name} dinoId={e.dinoId} colors={e.colors} />
        </React.Suspense>
      ))}
    </group>
  );
};