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
}

// Helper to handle base path for assets (GitHub Pages support)
const getAssetPath = (path: string) => {
  const base = import.meta.env.BASE_URL || '/';
  const cleanPath = path.startsWith('/') ? path.slice(1) : path;
  return base.endsWith('/') ? `${base}${cleanPath}` : `${base}/${cleanPath}`;
};

export const DINOSAUR_ROSTER: DinosaurStats[] = [
  // Carnivores (Walk mais rápido por padrão)
  { id: 'Trex', name: 'T-Rex', diet: 'Carnivore', baseScale: 1.0, minScale: 0.2, maxScale: 3.0, walkSpeed: 6.0, runSpeed: 14.0, strength: 10, vitality: 8, modelPath: getAssetPath('/models/dinos/Trex.glb') },
  { id: 'Velociraptor', name: 'Velociraptor', diet: 'Carnivore', baseScale: 1.0, minScale: 0.3, maxScale: 2.0, walkSpeed: 8.0, runSpeed: 22.0, strength: 5, vitality: 4, modelPath: getAssetPath('/models/dinos/Velociraptor.glb') },
  // Herbivores (Walk mais lento, mas com explosão alta de Run)
  { id: 'Triceratops', name: 'Triceratops', diet: 'Herbivore', baseScale: 1.0, minScale: 0.3, maxScale: 2.5, walkSpeed: 3.0, runSpeed: 12.0, strength: 8, vitality: 10, modelPath: getAssetPath('/models/dinos/Triceratops.glb') },
  { id: 'Stegosaurus', name: 'Stegossaurus', diet: 'Herbivore', baseScale: 1.0, minScale: 0.3, maxScale: 2.5, walkSpeed: 2.5, runSpeed: 10.0, strength: 9, vitality: 9, modelPath: getAssetPath('/models/dinos/Stegossaurus.glb') },
  { id: 'Parasaurolophus', name: 'Parassaurolophus', diet: 'Herbivore', baseScale: 1.0, minScale: 0.3, maxScale: 2.5, walkSpeed: 4.5, runSpeed: 18.0, strength: 4, vitality: 6, modelPath: getAssetPath('/models/dinos/Parasaurolophus.glb') },
  { id: 'Apatosaurus', name: 'Apatossaurus', diet: 'Herbivore', baseScale: 1.0, minScale: 0.2, maxScale: 3.0, walkSpeed: 1.4, runSpeed: 6.5, strength: 10, vitality: 10, modelPath: getAssetPath('/models/dinos/Apatossaurus.glb') },
];
