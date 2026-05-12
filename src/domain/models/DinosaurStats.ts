export type Diet = 'Carnivore' | 'Herbivore';

export interface DinosaurStats {
  id: string;
  name: string;
  diet: Diet;
  baseScale: number;
  minScale: number;
  maxScale: number;
  walkSpeed: number;
  runSpeed: number;
  strength: number;
  vitality: number;
  modelPath: string;
  collisionRadius: number;
  collisionHeight: number;
  interactRadius: number;
}

// Helper to handle base path for assets (GitHub Pages support)
const getAssetPath = (path: string) => {
  const base = import.meta.env.BASE_URL || '/';
  const cleanPath = path.startsWith('/') ? path.slice(1) : path;
  return base.endsWith('/') ? `${base}${cleanPath}` : `${base}/${cleanPath}`;
};

export const DINOSAUR_ROSTER: DinosaurStats[] = [
  // Carnivores (Walk mais rápido por padrão)
  {
    id: 'Trex', name: 'T-Rex', diet: 'Carnivore',
    baseScale: 1.0, minScale: 0.2, maxScale: 3.0,
    walkSpeed: 6.0, runSpeed: 14.0, strength: 10, vitality: 8,
    modelPath: getAssetPath('/models/dinos/Trex.glb'),
    collisionRadius: 3.5, collisionHeight: 12.0, interactRadius: 5.5
  },
  {
    id: 'Velociraptor', name: 'Velociraptor', diet: 'Carnivore',
    baseScale: 1.0, minScale: 0.3, maxScale: 2.0,
    walkSpeed: 8.0, runSpeed: 22.0, strength: 5, vitality: 4,
    modelPath: getAssetPath('/models/dinos/Velociraptor.glb'),
    collisionRadius: 1.8, collisionHeight: 7.0, interactRadius: 3.0
  },
  // Herbivores (Walk mais lento, mas com explosão alta de Run)
  {
    id: 'Triceratops', name: 'Triceratops', diet: 'Herbivore',
    baseScale: 1.0, minScale: 0.3, maxScale: 2.5,
    walkSpeed: 2.0, runSpeed: 10.0, strength: 9, vitality: 8,
    modelPath: getAssetPath('/models/dinos/Triceratops.glb'),
    collisionRadius: 3.2, collisionHeight: 8.5, interactRadius: 5.0
  },
  {
    id: 'Stegosaurus', name: 'Stegosaurus', diet: 'Herbivore',
    baseScale: 1.0, minScale: 0.3, maxScale: 2.5,
    walkSpeed: 2.2, runSpeed: 10.0, strength: 8, vitality: 10,
    modelPath: getAssetPath('/models/dinos/Stegossaurus.glb'),
    collisionRadius: 3.0, collisionHeight: 9.5, interactRadius: 4.8
  },
  {
    id: 'Parasaurolophus', name: 'Parasaurolophus', diet: 'Herbivore',
    baseScale: 1.0, minScale: 0.3, maxScale: 2.5,
    walkSpeed: 3.5, runSpeed: 14.0, strength: 4, vitality: 6,
    modelPath: getAssetPath('/models/dinos/Parasaurolophus.glb'),
    collisionRadius: 1.8, collisionHeight: 8.0, interactRadius: 3.5
  },
  {
    id: 'Apatosaurus', name: 'Apatosaurus', diet: 'Herbivore',
    baseScale: 1.0, minScale: 0.2, maxScale: 2.5,
    walkSpeed: 1.4, runSpeed: 6.5, strength: 10, vitality: 10,
    modelPath: getAssetPath('/models/dinos/Apatossaurus.glb'),
    collisionRadius: 5.0, collisionHeight: 15.0, interactRadius: 8.5
  },
];
