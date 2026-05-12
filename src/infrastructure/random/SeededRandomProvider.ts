import type { IRandomProvider } from '../../domain/interfaces/IRandomProvider';

const UINT32_MAX = 0xffffffff;

function hashString(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mixSeed(base: number, value: number): number {
  let x = (base ^ value) >>> 0;
  x ^= x >>> 16;
  x = Math.imul(x, 0x7feb352d);
  x ^= x >>> 15;
  x = Math.imul(x, 0x846ca68b);
  x ^= x >>> 16;
  return x >>> 0;
}

function normalizeSeed(seed: number): number {
  const normalized = seed >>> 0;
  return normalized === 0 ? 1 : normalized;
}

export class SeededRandomProvider implements IRandomProvider {
  private readonly seed: number;
  private sequence = 0;

  constructor(seed: number) {
    this.seed = normalizeSeed(seed);
  }

  next(): number {
    this.sequence++;
    const mixed = mixSeed(this.seed, this.sequence);
    return mixed / UINT32_MAX;
  }

  fork(scope: string | number): IRandomProvider {
    const scopeValue = typeof scope === 'number' ? scope >>> 0 : hashString(scope);
    const childSeed = mixSeed(this.seed, scopeValue);
    return new SeededRandomProvider(childSeed);
  }
}
