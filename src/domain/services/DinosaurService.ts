import type { DinosaurStats } from '../models/DinosaurStats';

/**
 * Calcula a escala final do dinossauro baseada no seu nível.
 * Segue a regra: 1-20 crescimento linear, 20+ crescimento logarítmico.
 */
export function calculateFinalScale(level: number, stats: DinosaurStats): number {
  const GLOBAL_SCALE_MODIFIER = 0.15;

  if (level <= 20) {
    const progress = (level - 1) / 19;
    const currentScale = stats.minScale + (stats.maxScale - stats.minScale) * progress;
    return currentScale * GLOBAL_SCALE_MODIFIER;
  } else {
    const bonusProgress = Math.log10(1 + (level - 20) / 30);
    const currentScale = stats.maxScale * (1 + bonusProgress);
    return currentScale * GLOBAL_SCALE_MODIFIER;
  }
}

/**
 * Calcula o raio de interação (para comer ou atacar).
 */
export function calculateInteractRadius(baseInteractRadius: number, finalScale: number): number {
  return baseInteractRadius * finalScale;
}

/**
 * Verifica se dois objetos estão em distância de interação.
 */
export function isInInteractionRange(
  ax: number, az: number,
  bx: number, bz: number,
  interactRadiusA: number,
  collisionRadiusB: number
): boolean {
  const dx = ax - bx;
  const dz = az - bz;
  const distSq = dx * dx + dz * dz;

  // A área de interação deve encostar no raio de colisão do alvo
  // Adicionamos uma pequena margem (epsilon) para suavizar a detecção
  const maxDist = interactRadiusA + collisionRadiusB;
  return distSq < (maxDist * maxDist);
}

/**
 * Calcula o dano de uma "bocada" baseado em força e nível.
 */
export function calculateBiteDamage(strength: number, level: number): number {
  const strengthFactor = strength / 10;
  // Curva de poder baseada no nível (idêntica ao player)
  const levelFactor = Math.pow(level, 0.7) / Math.pow(20, 0.7);
  return 1.0 * strengthFactor * levelFactor;
}

/**
 * Converte o dano absoluto em porcentagem de redução do objeto comestível.
 */
export function calculatePercentageDamage(biteDamage: number, initialSize: number, currentAbsoluteSize: number): number {
  // O dano real não pode ser maior que o que sobra
  let actualDamage = Math.min(biteDamage, currentAbsoluteSize);

  // Se o que sobrar for muito pouco (menos de 15% do original), devora tudo
  const remainingAfterBite = currentAbsoluteSize - actualDamage;
  if (remainingAfterBite < initialSize * 0.15) {
    actualDamage = currentAbsoluteSize;
  }

  return actualDamage / initialSize;
}

/**
 * Define o "tamanho nutricional" da carcaça baseado no nível do dinossauro.
 * Isso controla quantas mordidas a carcaça suporta sem depender da escala visual.
 */
export function calculateCarcassNutritionByLevel(level: number): number {
  const clampedLevel = Math.max(1, level);

  // Faixa base próxima de carnes do mapa, com progressão por nível.
  const base = 0.50 + (Math.min(clampedLevel, 20) * 0.0575); // ~0.4 a 1.5

  if (clampedLevel <= 20) {
    return base;
  }

  // Acima do 20, crescimento logarítmico para evitar carcaças infinitas.
  const bonus = Math.log10(1 + (clampedLevel - 20) / 20) * 0.8;
  return Math.min(2.4, base + bonus);
}
