export type Weights<T> = ReadonlyArray<readonly [T, number]>;

export interface Rng {
  int(min: number, max: number): number;
  chance(probability: number): boolean;
  pick<T>(items: readonly T[]): T;
  weighted<T>(entries: Weights<T>): T;
  weightedKey<K extends string>(weights: Readonly<Record<K, number>>): K;
  shuffle<T>(items: readonly T[]): T[];
}

const UINT32_RANGE = 4294967296;

function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let mixed = Math.imul(state ^ (state >>> 15), state | 1);
    mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61);
    return ((mixed ^ (mixed >>> 14)) >>> 0) / UINT32_RANGE;
  };
}

export function createRng(seed: number): Rng {
  const next = mulberry32(seed);
  const int = (min: number, max: number) =>
    min + Math.floor(next() * (max - min + 1));
  const pick = <T>(items: readonly T[]): T => {
    if (items.length === 0) throw new Error("Cannot pick from an empty list");
    return items[int(0, items.length - 1)];
  };
  const weighted = <T>(entries: Weights<T>): T => {
    let roll = next() * entries.reduce((sum, [, weight]) => sum + weight, 0);
    for (const [value, weight] of entries) {
      roll -= weight;
      if (roll < 0) return value;
    }
    return entries[entries.length - 1][0];
  };
  const weightedKey = <K extends string>(
    weights: Readonly<Record<K, number>>,
  ) => weighted(Object.entries(weights) as [K, number][]);
  const shuffle = <T>(items: readonly T[]): T[] => {
    const shuffled = [...items];
    for (let index = shuffled.length - 1; index > 0; index--) {
      const swap = int(0, index);
      [shuffled[index], shuffled[swap]] = [shuffled[swap], shuffled[index]];
    }
    return shuffled;
  };
  const chance = (probability: number) => next() < probability;
  return { int, chance, pick, weighted, weightedKey, shuffle };
}
