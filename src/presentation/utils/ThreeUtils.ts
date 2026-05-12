import * as THREE from 'three';

/**
 * Clona um THREE.Group contendo SkinnedMeshes com esqueleto correto.
 * Essencial para animar múltiplas instâncias de um modelo com rigging.
 *
 * Importa:
 * - Clona geometria, materiais e transformações
 * - Clona e reconecta esqueletos aos nós do clone
 * - Garante que cada instância tenha seu próprio skeleton para animação independente
 */
export function cloneSkinnedMesh(source: THREE.Group): THREE.Group {
  const clone = source.clone(true);
  const nodes: Record<string, THREE.Object3D> = {};
  const sourceNodes: Record<string, THREE.Object3D> = {};

  clone.traverse(node => {
    nodes[node.name] = node;
  });
  source.traverse(node => {
    sourceNodes[node.name] = node;
  });

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
