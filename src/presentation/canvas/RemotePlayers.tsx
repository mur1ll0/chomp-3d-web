import React, { useRef, useMemo, useState, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { Text, useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { DINOSAUR_ROSTER } from '../../domain/models/DinosaurStats';
import { getNPCScaleFactor } from '../../domain/models/NPCDinosaur';
import { useAppStore } from '../../store/useAppStore';
import type { PlayerStateSnapshot } from '../../infrastructure/network/messages';
import { peerSession } from '../../infrastructure/network/PeerSession';
import { cloneSkinnedMesh } from '../utils/ThreeUtils';
import { useDinosaurAnimations } from '../hooks/useDinosaurAnimations';

const _tempPos = new THREE.Vector3();

const ONESHOT_INTENTS = new Set(['Attack', 'Eat', 'Death']);

const RemotePlayerInstance: React.FC<{ player: PlayerStateSnapshot }> = ({ player }) => {
  const stats = useMemo(() => DINOSAUR_ROSTER.find(d => d.id === player.dinoId)!, [player.dinoId]);
  const gltf = useGLTF(stats.modelPath);
  const groupRef = useRef<THREE.Group>(null);
  const playerRef = useRef(player);
  const prevAnimIntent = useRef('');

  // Keep playerRef in sync outside render cycle for useFrame access
  useEffect(() => {
    playerRef.current = player;
  }, [player]);

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
          const mat = (mesh.material as THREE.MeshStandardMaterial).clone();
          mat.userData.originalColor = mat.color.clone();
          mats.push(mat);
          mesh.material = mat;
        }
      }
    });
    return { clonedScene: clone, cachedMaterials: mats };
  }, [gltf.scene]);

  // Apply dinoColors from snapshot to the model
  useEffect(() => {
    const p = playerRef.current;
    if (!cachedMaterials.length || !p.dinoColors) return;
    const colors = p.dinoColors;
    if (typeof colors === 'object' && Object.keys(colors).length > 0) {
      cachedMaterials.forEach(mat => {
        const matName = mat.name || '';
        if (colors[matName]) {
          mat.color.set(colors[matName]);
        } else {
          mat.color.copy(mat.userData.originalColor);
        }
      });
    }
  }, [cachedMaterials, player.dinoId, player.dinoColors]);

  const { playAnimation } = useDinosaurAnimations(gltf, clonedScene);

  useFrame((_, delta) => {
    if (!groupRef.current) return;
    const p = playerRef.current;
    // Match NPCInstance rendering approach: Euler angle lerp (not quaternion slerp)
    const interp = Math.min(1, delta * 12);

    // Position lerp
    groupRef.current.position.lerp(_tempPos.set(p.posX, p.posY, p.posZ), interp);

    // Rotation: Euler angle lerp (identical to NPCInstance in NPCDinosaurs.tsx)
    let angleDiff = p.rotY - groupRef.current.rotation.y;
    while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
    while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
    groupRef.current.rotation.y += angleDiff * interp;

    groupRef.current.updateMatrixWorld();

    // Animation: detect one-shot transitions (Attack, Eat, Death)
    const intent = p.animationIntent || 'Idle';
    const isOneShot = ONESHOT_INTENTS.has(intent);
    const intentChanged = intent !== prevAnimIntent.current;
    prevAnimIntent.current = intent;

    if (isOneShot) {
      // One-shots: play without loop, restart when intent changes
      if (intentChanged) {
        playAnimation(intent, false);
      }
    } else {
      // Looping animations (Idle, Walk, Run)
      playAnimation(intent, true);
    }
  });

  const currentScale = getNPCScaleFactor(player.level, stats);

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
        {player.name}
      </Text>
    </group>
  );
};

export const RemotePlayers: React.FC = () => {
  const onlineRole = useAppStore(s => s.onlineRole);
  const networkPlayers = useAppStore(s => s.networkPlayers) as import('../../infrastructure/network/messages').PlayerStateSnapshot[];
  const myPlayerName = useAppStore(s => s.playerName);
  const [hostPlayers, setHostPlayers] = useState<PlayerStateSnapshot[]>([]);

  // Host: polls PeerHost's client states (snapshot broadcast is the sync mechanism)
  useEffect(() => {
    if (onlineRole !== 'host') return;
    const update = () => {
      const states = peerSession.getHostPlayerStates();
      setHostPlayers(states);
    };
    update();
    const interval = setInterval(update, 150); // 150ms ≈ cada broadcast
    peerSession.setOnClientConnected(update as (clientId: string, name: string) => void);
    peerSession.setOnClientDisconnected(update as (clientId: string) => void);
    return () => {
      clearInterval(interval);
      peerSession.setOnClientConnected(null!);
      peerSession.setOnClientDisconnected(null!);
    };
  }, [onlineRole]);

  const players = onlineRole === 'host' ? hostPlayers : networkPlayers;
  const others = players.filter(p => p.name !== myPlayerName && (onlineRole !== 'host' || p.id !== 'host'));
  if (others.length === 0) return null;

  return (
    <group>
      {others.map(p => (
        <React.Suspense key={p.id} fallback={null}>
          <RemotePlayerInstance player={p} />
        </React.Suspense>
      ))}
    </group>
  );
};
