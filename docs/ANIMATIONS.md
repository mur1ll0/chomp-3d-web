# Documentação das Animações 3D

Os modelos 3D do "Dinosaur Animated Pack" foram importados com sucesso para a pasta `public/models/dinos/` no formato **.fbx**.

> **Nota sobre o Formato:** O React Three Fiber e a web em geral preferem largamente o formato `.glb` ou `.gltf` por serem muito mais leves e otimizados para carregamento no navegador. Embora os arquivos `.fbx` originais possam ser carregados pelo `FBXLoader` do Three.js (e já contêm as animações), **é altamente recomendado que no futuro eles sejam convertidos para `.glb`** (você pode fazer isso abrindo no Blender e exportando como glTF).

## Modelos Importados e suas Animações

Abaixo estão as animações disponíveis (extraídas de dentro de cada arquivo) que você poderá chamar pelo código no React Three Fiber quando for animar os dinossauros.

### 1. Trex (`Trex.fbx`)
- `Idle` (Parado / Respirando)
- `Walk` (Andar)
- `Run` (Correr)
- `Attack` (Atacar / Morder)
- `Jump` (Pular)
- `Death` (Morte)

### 2. Velociraptor (`Velociraptor.fbx`)
- `Idle`
- `Walk`
- `Run`
- `Attack`
- `Jump`
- `Death`

### 3. Triceratops (`Triceratops.fbx`)
- `Idle`
- `Walk`
- `Run`
- `Attack`
- `Jump`
- `Death`

### 4. Stegosaurus (`Stegosaurus.fbx`)
- `Idle`
- `Walk`
- `Run`
- `Attack`
- `Jump`
- `Death`

### 5. Parasaurolophus (`Parasaurolophus.fbx`)
- `Idle`
- `Walk`
- `Run`
- `Attack`
- `Jump`
- `Death`

### 6. Apatosaurus (`Apatosaurus.fbx`)
- `Idle`
- `Walk`
- `Run`
- `Attack`
- `Jump`
- `Death`
- `Eat` (Comer - *Aparentemente este modelo possui uma animação específica para comer pasto, enquanto os outros usariam 'Attack' para morder a comida.*)

---

## Como usar (Exemplo Prático Futuro)
Ao utilizar o `@react-three/fiber` em conjunto com o `@react-three/drei`, se você convertê-los para GLB, poderá extrair as animações facilmente assim:

```tsx
import { useGLTF, useAnimations } from '@react-three/drei';

export function TRex() {
  const { scene, animations } = useGLTF('/models/dinos/Trex.glb');
  const { actions } = useAnimations(animations, scene);

  // Para tocar a animação de correr:
  // actions.Run.play();

  return <primitive object={scene} />;
}
```
*(Para arquivos FBX diretamente, você utilizaria o `useLoader(FBXLoader, '/models/dinos/Trex.fbx')` e precisaria instanciar o `AnimationMixer` do Three.js manualmente).*
