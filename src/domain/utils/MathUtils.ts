/**
 * Função de ruído seeded para geradores procedurais.
 * Determinística: mesmo x, z, salt sempre retorna o mesmo valor.
 * Retorna um valor entre 0 e 1.
 */
export function seededNoise(x: number, z: number, salt: number = 0): number {
  return Math.abs((Math.sin((x + salt) * 12.9898 + (z + salt) * 78.233) * 43758.5453) % 1);
}
