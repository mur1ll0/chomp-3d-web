import React, { useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Sky } from '@react-three/drei';
import * as THREE from 'three';
import { useAppStore } from '../../store/useAppStore';

// Reutiliza objetos para evitar alocações por frame
const _sunPos = new THREE.Vector3();
const _playerPos = new THREE.Vector3();

export const DynamicEnvironment: React.FC = () => {
  const lightRef = useRef<THREE.DirectionalLight>(null);
  const targetRef = useRef<THREE.Object3D>(new THREE.Object3D());
  const ambientRef = useRef<THREE.AmbientLight>(null);
  const skyRef = useRef<any>(null);

  const { scene, camera } = useThree();

  React.useEffect(() => {
    // Adiciona o alvo da luz à cena para que ele possa ser movido
    scene.add(targetRef.current);
    if (lightRef.current) {
      lightRef.current.target = targetRef.current;
    }
    return () => {
      scene.remove(targetRef.current);
    };
  }, [scene]);

  useFrame(() => {
    // Sistema global de tempo sincronizado pelo relógio do mundo (Date.now)
    // Todos os jogadores online verão o sol exatamente na mesma posição
    const timeMs = Date.now();

    // Ciclo total de 5 minutos (300.000 ms)
    const cycleDuration = 300000;
    const progress = (timeMs % cycleDuration) / cycleDuration;

    // Queremos que o Dia dure 4 minutos e a Noite passe mais rápido (1 minuto)
    // 0.0 até 0.8 (Dia) -> 0 a PI (0 a 180 graus)
    // 0.8 até 1.0 (Noite) -> PI a 2*PI (180 a 360 graus)
    let theta = 0;
    if (progress < 0.8) {
      // Mapeia 0.0-0.8 para 0-PI
      theta = (progress / 0.8) * Math.PI;
    } else {
      // Mapeia 0.8-1.0 para PI-2PI
      theta = Math.PI + ((progress - 0.8) / 0.2) * Math.PI;
    }

    // Calcula a direção do sol (nasce no Leste/X+, se põe no Oeste/X-)
    // Adicionamos uma inclinação no eixo Z para o sol não passar perfeitamente em cima
    const sunDistance = 200;
    const sunX = Math.cos(theta) * sunDistance;
    const sunY = Math.sin(theta) * sunDistance;
    const sunZ = Math.sin(theta) * 50; // Inclinação

    const sunPosition = _sunPos;
    sunPosition.set(sunX, sunY, sunZ);

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
      const heightFactor = Math.max(0, Math.sin(theta));
      lightRef.current.intensity = 0.0 + (heightFactor * 1.2);
    }

    if (ambientRef.current) {
      // Luz ambiente também muda (noite é mais escura, mas não totalmente preta)
      // Base aumentada para 0.25 para não ficar tão escuro
      const heightFactor = Math.max(0, Math.sin(theta));
      ambientRef.current.intensity = 0.25 + (heightFactor * 0.4);
    }

    if (skyRef.current) {
      // O componente Sky do drei não atualiza via props depois de montado,
      // precisamos atualizar o shader interno dele manualmente todo frame.
      skyRef.current.material.uniforms.sunPosition.value.copy(sunPosition).normalize();

      // Quando o sol se põe, reduzimos o Rayleigh para escurecer o céu em vez de deixá-mo branco
      const heightFactor = Math.max(0, Math.sin(theta));
      skyRef.current.material.uniforms.rayleigh.value = 0.1 + (heightFactor * 2.0);
    }
  });

  return (
    <>
      <Sky ref={skyRef} turbidity={0.5} rayleigh={1} distance={450000} sunPosition={lightRef.current?.position || [100, 20, 100]} />
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
