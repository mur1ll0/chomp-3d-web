import React, { useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Sky } from '@react-three/drei';
import * as THREE from 'three';
import type { Sky as SkyImpl } from 'three-stdlib';
import { useAppStore } from '../../store/useAppStore';
import { getWorldTime, getSunPosition } from '../../infrastructure/system/WorldTime';

// Reutiliza objetos para evitar alocações por frame
const _sunPos = new THREE.Vector3();
const _playerPos = new THREE.Vector3();
const INITIAL_SUN_POSITION: [number, number, number] = [100, 20, 100];

type SkyLikeMaterial = THREE.Material & {
  uniforms?: {
    sunPosition?: { value: THREE.Vector3 };
    rayleigh?: { value: number };
  };
};

export const DynamicEnvironment: React.FC = () => {
  const lightRef = useRef<THREE.DirectionalLight>(null);
  const targetRef = useRef<THREE.Object3D>(new THREE.Object3D());
  const ambientRef = useRef<THREE.AmbientLight>(null);
  const skyRef = useRef<SkyImpl>(null);

  const { scene } = useThree();

  React.useEffect(() => {
    // Adiciona o alvo da luz à cena para que ele possa ser movido
    const target = targetRef.current;
    scene.add(target);
    if (lightRef.current) {
      lightRef.current.target = target;
    }
    return () => {
      scene.remove(target);
    };
  }, [scene]);

  useFrame(() => {
    const { sunHeight } = getWorldTime();
    const heightFactor = Math.max(0, sunHeight);
    const sunPos = getSunPosition(200);
    const sunPosition = _sunPos;
    sunPosition.set(sunPos.x, sunPos.y, sunPos.z);

    // O Alvo da luz deve seguir o JOGADOR (não a câmera!)
    // Usar a posição do chunk do jogador garante que a shadow map NÃO seja
    // recalculada quando o jogador apenas gira a câmera (rotação).
    // Snapping para evitar shadow swimming (sombras tremendo)
    const chunkPos = useAppStore.getState().playerChunkPos;
    const snapSize = 4;
    _playerPos.set(
      Math.round((chunkPos.x * 50) / snapSize) * snapSize,
      0,
      Math.round((chunkPos.z * 50) / snapSize) * snapSize
    );
    targetRef.current.position.copy(_playerPos);

    if (lightRef.current) {
      // A luz fica posicionada RELATIVA ao jogador, na direção do sol
      lightRef.current.position.copy(_playerPos).add(sunPosition);

      // Ajusta intensidade da luz baseada na altura do sol (0 à noite)
      lightRef.current.intensity = 0.0 + (heightFactor * 1.2);
    }

    if (ambientRef.current) {
      // Luz ambiente também muda (noite é mais escura, mas não totalmente preta)
      // Base aumentada para 0.25 para não ficar tão escuro
      ambientRef.current.intensity = 0.25 + (heightFactor * 0.4);
    }

    if (skyRef.current) {
      // O componente Sky do drei não atualiza via props depois de montado,
      // precisamos atualizar o shader interno dele manualmente todo frame.
      const material = skyRef.current.material as SkyLikeMaterial | undefined;
      const sunUniform = material?.uniforms?.sunPosition;
      const rayleighUniform = material?.uniforms?.rayleigh;

      if (!sunUniform || !rayleighUniform) return;

      sunUniform.value.copy(sunPosition).normalize();

      // Quando o sol se põe, reduzimos o Rayleigh para escurecer o céu em vez de deixá-mo branco
      rayleighUniform.value = 0.1 + (heightFactor * 2.0);
    }
  });

  return (
    <>
      <Sky ref={skyRef} turbidity={0.5} rayleigh={1} distance={450000} sunPosition={INITIAL_SUN_POSITION} />
      <ambientLight ref={ambientRef} intensity={0.4} />
      <directionalLight
        ref={lightRef}
        castShadow
        intensity={1.2}
        shadow-mapSize={[1024, 1024]}
        shadow-camera-left={-80}
        shadow-camera-right={80}
        shadow-camera-top={80}
        shadow-camera-bottom={-80}
        shadow-camera-near={1}
        shadow-camera-far={500}
      />
    </>
  );
};
