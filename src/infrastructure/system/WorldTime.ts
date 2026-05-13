/**
 * Tempo global do mundo — único ponto de consulta para ciclo dia/noite.
 * Usa Date.now() para que todos os jogadores online vejam o sol na mesma posição.
 * Cache atualizado a cada ~100ms para evitar chamadas repetidas de Date.now() por frame.
 */

const CYCLE_DURATION = 300000; // 5 minutos
const CACHE_INTERVAL = 100; // ms

interface WorldTimeSnapshot {
  progress: number; // 0..1
  theta: number; // ângulo do sol (0..2π)
  sunHeight: number; // sin(theta)
}

let cachedSnapshot: WorldTimeSnapshot | null = null;
let lastCacheTime = 0;

function computeSnapshot(): WorldTimeSnapshot {
  const timeMs = Date.now();
  const progress = (timeMs % CYCLE_DURATION) / CYCLE_DURATION;
  const theta = progress < 0.8
    ? (progress / 0.8) * Math.PI
    : Math.PI + ((progress - 0.8) / 0.2) * Math.PI;
  const sunHeight = Math.sin(theta);

  return { progress, theta, sunHeight };
}

export function getWorldTime(): WorldTimeSnapshot {
  const now = Date.now();
  if (!cachedSnapshot || now - lastCacheTime >= CACHE_INTERVAL) {
    cachedSnapshot = computeSnapshot();
    lastCacheTime = now;
  }
  return cachedSnapshot;
}

export function getSunPosition(distance = 200): { x: number; y: number; z: number } {
  const { theta } = getWorldTime();
  return {
    x: Math.cos(theta) * distance,
    y: Math.sin(theta) * distance,
    z: Math.sin(theta) * 50,
  };
}
