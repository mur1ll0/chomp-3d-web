import React, { useMemo, useRef, useEffect } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { useAppStore } from '../../store/useAppStore';
import type { ChunkData } from '../../infrastructure/generation/MapGenerator';

interface ProceduralMapProps {
  chunks: ChunkData[];
}

// Temporary matrix for calculations
const tempMatrix = new THREE.Matrix4();
const tempPosition = new THREE.Vector3();
const tempRotation = new THREE.Euler();
const tempScale = new THREE.Vector3();
const tempQuat = new THREE.Quaternion();
const zeroMatrix = new THREE.Matrix4().set(0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0);
const _colorBlack = new THREE.Color('#000000');
const _colorNightBlue = new THREE.Color('#1e3a8a');

export const ProceduralMap: React.FC<ProceduralMapProps> = ({ chunks }) => {
  const debugCollisions = useAppStore(s => s.debugCollisions);
  
  // Extract all objects from all visible chunks
  const allTrees = useMemo(() => chunks.flatMap(c => c.trees), [chunks]);
  const allRocks = useMemo(() => chunks.flatMap(c => c.rocks), [chunks]);
  const allGrass = useMemo(() => chunks.flatMap(c => c.grass), [chunks]);
  const allWater = useMemo(() => chunks.flatMap(c => c.water), [chunks]);

  // Refs for instanced meshes
  const trunkMeshRef = useRef<THREE.InstancedMesh>(null);
  const leavesMeshRef = useRef<THREE.InstancedMesh>(null);
  const leavesSphereMeshRef = useRef<THREE.InstancedMesh>(null);
  const rockMeshRef = useRef<THREE.InstancedMesh>(null);
  const grassMeshRef = useRef<THREE.InstancedMesh>(null);
  const waterMeshRef = useRef<THREE.InstancedMesh>(null);

  // Debug Refs
  const treeDebugMeshRef = useRef<THREE.InstancedMesh>(null);
  const rockDebugMeshRef = useRef<THREE.InstancedMesh>(null);

  // Refs para materiais para atualização performática de emissão
  const trunkMatRef = useRef<THREE.MeshStandardMaterial>(null);
  const leavesMatRef = useRef<THREE.MeshStandardMaterial>(null);
  const rockMatRef = useRef<THREE.MeshStandardMaterial>(null);
  const grassMatRef = useRef<THREE.MeshStandardMaterial>(null);

  // Update instance matrices when chunks change
  useEffect(() => {
    if (trunkMeshRef.current && leavesMeshRef.current && leavesSphereMeshRef.current) {
      allTrees.forEach((tree, i) => {
        // TRUNK
        tempPosition.set(tree.position[0], tree.heightScale * 1, tree.position[2]); 
        tempRotation.set(0, tree.rotation, 0);
        tempScale.set(tree.trunkWidth, tree.heightScale, tree.trunkWidth);
        
        tempQuat.setFromEuler(tempRotation);
        tempMatrix.compose(tempPosition, tempQuat, tempScale);
        trunkMeshRef.current!.setMatrixAt(i, tempMatrix);

        // LEAVES (Regrinha mágica de escala)
        // Quanto mais alto e grosso o tronco, maior a folhagem. Tronco fino e alto = folhagem pequena.
        const foliageHorizontalScale = tree.trunkWidth * 2.5 + (tree.heightScale * 0.2);
        const foliageVerticalScale = tree.heightScale * 0.4 + tree.trunkWidth * 1.5;
        
        tempPosition.set(tree.position[0], tree.heightScale * 2 + foliageVerticalScale * 0.5, tree.position[2]); 
        tempScale.set(foliageHorizontalScale, foliageVerticalScale, foliageHorizontalScale);
        tempQuat.setFromEuler(tempRotation);
        tempMatrix.compose(tempPosition, tempQuat, tempScale);

        // Define qual geometria usar baseado no type (0=Cone, 1=Esfera)
        if (tree.type === 0) {
          leavesMeshRef.current!.setMatrixAt(i, tempMatrix);
          leavesSphereMeshRef.current!.setMatrixAt(i, zeroMatrix);
        } else {
          leavesMeshRef.current!.setMatrixAt(i, zeroMatrix);
          leavesSphereMeshRef.current!.setMatrixAt(i, tempMatrix);
        }

        if (debugCollisions && treeDebugMeshRef.current) {
          // Debug cylinder matching the trunk collision logic
          const treeRadius = tree.collisionRadius;
          const treeHeight = tree.collisionHeight;

          tempPosition.set(tree.position[0], treeHeight * 0.5, tree.position[2]);
          tempScale.set(treeRadius, treeHeight, treeRadius);
          tempMatrix.compose(tempPosition, new THREE.Quaternion(), tempScale);
          treeDebugMeshRef.current.setMatrixAt(i, tempMatrix);
        }
      });
      
      trunkMeshRef.current.instanceMatrix.needsUpdate = true;
      leavesMeshRef.current.instanceMatrix.needsUpdate = true;
      leavesSphereMeshRef.current.instanceMatrix.needsUpdate = true;
      trunkMeshRef.current.computeBoundingSphere();
      leavesMeshRef.current.computeBoundingSphere();
      leavesSphereMeshRef.current.computeBoundingSphere();
      if (debugCollisions && treeDebugMeshRef.current) treeDebugMeshRef.current.instanceMatrix.needsUpdate = true;
    }

    if (rockMeshRef.current) {
      allRocks.forEach((rock, i) => {
        // Reduzido o offset de Y para 0.3 para garantir que a pedra fique bem enterrada e não flutue
        tempPosition.set(rock.position[0], rock.heightScale * 0.3, rock.position[2]);
        tempRotation.set(rock.rotation, rock.rotation * 2, rock.rotation * 0.5);
        tempScale.set(rock.scale, rock.heightScale, rock.scale);
        
        tempQuat.setFromEuler(tempRotation);
        tempMatrix.compose(tempPosition, tempQuat, tempScale);
        rockMeshRef.current!.setMatrixAt(i, tempMatrix);

        if (debugCollisions && rockDebugMeshRef.current) {
          const rRadius = rock.collisionRadius;
          const rHeight = rock.collisionHeight;
          tempPosition.set(rock.position[0], rHeight * 0.5, rock.position[2]);
          tempScale.set(rRadius, rHeight, rRadius);
          tempMatrix.compose(tempPosition, new THREE.Quaternion(), tempScale);
          rockDebugMeshRef.current.setMatrixAt(i, tempMatrix);
        }
      });
      
      rockMeshRef.current.instanceMatrix.needsUpdate = true;
      rockMeshRef.current.computeBoundingSphere();
      if (debugCollisions && rockDebugMeshRef.current) rockDebugMeshRef.current.instanceMatrix.needsUpdate = true;
    }

    if (grassMeshRef.current) {
      allGrass.forEach((grassObj, i) => {
        // Grass is a flat box sticking out of the ground
        tempPosition.set(grassObj.position[0], grassObj.heightScale * 0.5, grassObj.position[2]);
        tempRotation.set(0, grassObj.rotation, 0);
        tempScale.set(grassObj.scale, grassObj.heightScale, grassObj.scale);
        
        tempQuat.setFromEuler(tempRotation);
        tempMatrix.compose(tempPosition, tempQuat, tempScale);
        grassMeshRef.current!.setMatrixAt(i, tempMatrix);
      });
      
      grassMeshRef.current.instanceMatrix.needsUpdate = true;
      grassMeshRef.current.computeBoundingSphere();
    }

    if (waterMeshRef.current) {
      allWater.forEach((waterObj, i) => {
        // Water is slightly above ground to prevent z-fighting
        tempPosition.set(waterObj.position[0], 0.05, waterObj.position[2]);
        tempRotation.set(0, waterObj.rotation, 0);
        tempScale.set(waterObj.scale, 1, waterObj.scale);
        
        tempQuat.setFromEuler(tempRotation);
        tempMatrix.compose(tempPosition, tempQuat, tempScale);
        waterMeshRef.current!.setMatrixAt(i, tempMatrix);
      });
      
      waterMeshRef.current.instanceMatrix.needsUpdate = true;
      waterMeshRef.current.computeBoundingSphere();
    }

  }, [allTrees, allRocks, allGrass, allWater, debugCollisions]);

  // Efeito de Visibilidade Noturna: Aumenta a emissão conforme o sol se põe
  useFrame(() => {
    const timeMs = Date.now();
    const cycleDuration = 300000; 
    const progress = (timeMs % cycleDuration) / cycleDuration;
    
    const theta = progress < 0.8
      ? (progress / 0.8) * Math.PI
      : Math.PI + ((progress - 0.8) / 0.2) * Math.PI;

    const sunHeight = Math.sin(theta);
    
    // Curva de Transição Suave:
    // Começa a surgir quando o sol ainda está alto (0.7) e vai até o fundo da noite (-1.0)
    
    let glowIntensity = 0;
    if (sunHeight < 0.7) {
      // Mapeia o intervalo [0.7, -1.0] para [0.0, 1.0] linearmente
      const t = (0.7 - sunHeight) / 1.7;
      // Removido o expoente para a subida ser mais constante e "aproveitar" melhor a janela de tempo
      glowIntensity = t * 0.4;
    }

    // Aplica nos materiais (Troncos e Pedras apenas)
    const materials = [trunkMatRef.current, rockMatRef.current];
    materials.forEach(mat => {
      if (mat) {
        mat.emissiveIntensity = glowIntensity;
        // Transição de cor suave proporcional à intensidade (máximo 0.4 -> lerp 1.0)
        const lerpFactor = Math.min(1, glowIntensity / 0.4);
        mat.emissive.lerpColors(_colorBlack, _colorNightBlue, lerpFactor);
      }
    });

    // Garante que folhagens e gramas fiquem sem brilho
    if (leavesMatRef.current) leavesMatRef.current.emissiveIntensity = 0;
    if (grassMatRef.current) grassMatRef.current.emissiveIntensity = 0;
  });

  return (
    <group>
      {/* WATER */}
      {allWater.length > 0 && (
        <instancedMesh ref={waterMeshRef} args={[undefined, undefined, allWater.length]} receiveShadow frustumCulled>
          <boxGeometry args={[2, 0.1, 2]} />
          <meshStandardMaterial color="#2563eb" roughness={0.1} metalness={0.5} transparent opacity={0.8} />
        </instancedMesh>
      )}

      {/* GRASS */}
      {allGrass.length > 0 && (
        <instancedMesh ref={grassMeshRef} args={[undefined, undefined, allGrass.length]} receiveShadow frustumCulled>
          <boxGeometry args={[0.2, 1, 0.2]} />
          <meshStandardMaterial ref={grassMatRef} color="#65a30d" roughness={0.9} />
        </instancedMesh>
      )}

      {/* TREES (Trunks) */}
      {allTrees.length > 0 && (
        <instancedMesh ref={trunkMeshRef} args={[undefined, undefined, allTrees.length]} receiveShadow frustumCulled>
          <cylinderGeometry args={[0.2, 0.4, 2, 8]} />
          <meshStandardMaterial ref={trunkMatRef} color="#5c4033" roughness={0.9} />
        </instancedMesh>
      )}

      {/* TREES (Leaves - Cones) */}
      {allTrees.length > 0 && (
        <instancedMesh ref={leavesMeshRef} args={[undefined, undefined, allTrees.length]} castShadow receiveShadow frustumCulled>
          <coneGeometry args={[1, 2, 5]} />
          <meshStandardMaterial ref={leavesMatRef} color="#166534" roughness={0.8} />
        </instancedMesh>
      )}

      {/* TREES (Leaves - Spheres) */}
      {allTrees.length > 0 && (
        <instancedMesh ref={leavesSphereMeshRef} args={[undefined, undefined, allTrees.length]} receiveShadow frustumCulled>
          <sphereGeometry args={[1, 6, 6]} />
          <meshStandardMaterial ref={leavesMatRef} color="#14532d" roughness={0.8} />
        </instancedMesh>
      )}

      {/* ROCKS */}
      {allRocks.length > 0 && (
        <instancedMesh ref={rockMeshRef} args={[undefined, undefined, allRocks.length]} castShadow receiveShadow frustumCulled>
          <icosahedronGeometry args={[1, 0]} /> {/* 0 detail = low poly rock */}
          <meshStandardMaterial ref={rockMatRef} color="#737373" roughness={0.8} />
        </instancedMesh>
      )}

      {/* DEBUG COLLISIONS */}
      {debugCollisions && (
        <group>
          {allTrees.length > 0 && (
            <instancedMesh ref={treeDebugMeshRef} args={[undefined, undefined, allTrees.length]} frustumCulled={false}>
              <cylinderGeometry args={[1, 1, 1, 8]} />
              <meshBasicMaterial color="#22c55e" wireframe transparent opacity={0.3} />
            </instancedMesh>
          )}
          {allRocks.length > 0 && (
            <instancedMesh ref={rockDebugMeshRef} args={[undefined, undefined, allRocks.length]} frustumCulled={false}>
              <cylinderGeometry args={[1, 1, 1, 8]} />
              <meshBasicMaterial color="#94a3b8" wireframe transparent opacity={0.3} />
            </instancedMesh>
          )}
        </group>
      )}
    </group>
  );
};
