import { useMemo, useRef, useCallback } from 'react';
import * as THREE from 'three';
import { useAnimations } from '@react-three/drei';

interface AnimationSource {
  animations?: THREE.AnimationClip[];
}

/**
 * Hook unificado para gerenciar animações de dinossauros (Player e NPC).
 * Trata correções de exportação do Blender e oferece busca robusta por intenção.
 */
export function useDinosaurAnimations(gltf: AnimationSource, model: THREE.Object3D | null) {
  // 1. Corrigir durações das animações (Remover frames vazios do Blender)
  const fixedAnimations = useMemo(() => {
    if (!gltf.animations) return [];
    return gltf.animations.map((clip: THREE.AnimationClip) => {
      const newClip = clip.clone();
      let maxActiveTime = 0;

      newClip.tracks.forEach(track => {
        const times = track.times;
        const values = track.values;
        const itemSize = track.getValueSize();

        let lastActiveIndex = 0;

        // Varre de trás para frente para encontrar movimento real
        for (let i = times.length - 1; i > 0; i--) {
          let changed = false;
          for (let j = 0; j < itemSize; j++) {
            if (Math.abs(values[i * itemSize + j] - values[(i - 1) * itemSize + j]) > 0.0001) {
              changed = true;
              break;
            }
          }
          if (changed) {
            lastActiveIndex = i;
            break;
          }
        }

        if (times.length > 0) {
          maxActiveTime = Math.max(maxActiveTime, times[lastActiveIndex]);
        }
      });

      if (maxActiveTime > 0 && maxActiveTime < newClip.duration - 0.1) {
        newClip.duration = maxActiveTime;
      }
      return newClip;
    });
  }, [gltf.animations]);

  const { actions, names } = useAnimations(fixedAnimations, model ?? undefined);
  
  const currentActionRef = useRef<string>('');
  const activeAnimationRef = useRef<THREE.AnimationAction | null>(null);

  /**
   * Busca uma animação por intenção (ex: 'Eat') usando correspondência robusta.
   */
  const getActionByIntent = useCallback((intents: string | string[]) => {
    if (!names || names.length === 0) return null;
    const intentList = Array.isArray(intents) ? intents : [intents];

    for (const intent of intentList) {
      if (actions[intent]) return actions[intent];

      const regex = new RegExp(`\\b${intent}\\b`, 'i');
      const exactWordMatch = names.find(n => regex.test(n));
      if (exactWordMatch && actions[exactWordMatch]) return actions[exactWordMatch];

      const safeMatch = names.find(n => {
        const lower = n.toLowerCase();
        const search = intent.toLowerCase();
        if (search === 'eat' && lower.includes('death')) return false;
        return lower.includes(search);
      });
      if (safeMatch && actions[safeMatch]) return actions[safeMatch];
    }

    return actions[names[0]] || null;
  }, [actions, names]);

  /**
   * Toca uma animação com cross-fade e controle de loop.
   */
  const playAnimation = useCallback((intent: string | string[], loop: boolean = true) => {
    const intentName = Array.isArray(intent) ? intent[0] : intent;

    // Evita restart desnecessário quando a mesma animação já está ativa.
    // Para one-shot (ex.: Death), também evita reinício após término.
    if (currentActionRef.current === intentName && activeAnimationRef.current) {
      return activeAnimationRef.current;
    }

    const newAction = getActionByIntent(intent);
    if (!newAction) return null;

    const hasPreviousAction = activeAnimationRef.current !== null;

    if (hasPreviousAction) {
      activeAnimationRef.current!.fadeOut(0.2);
    }

    if (loop) {
      newAction.setLoop(THREE.LoopRepeat, Infinity);
      newAction.clampWhenFinished = false;
    } else {
      newAction.setLoop(THREE.LoopOnce, 1);
      newAction.clampWhenFinished = true;
    }

    // Primeira animação: sem fadeIn para não "arrastar" no spawn do NPC
    // Animações subsequentes: cross-fade suave de 200ms
    if (hasPreviousAction) {
      newAction.reset().fadeIn(0.2).play();
    } else {
      newAction.reset().play();
    }
    activeAnimationRef.current = newAction;
    currentActionRef.current = intentName;
    return newAction;
  }, [getActionByIntent]);

  return {
    actions,
    names,
    playAnimation,
    fixedAnimations,
  };
}
