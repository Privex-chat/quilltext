/** Deterministic RNG (mulberry32). Same seed → same page, in preview and export. */
export type Rng = () => number;

export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Derive a child stream so independent subsystems don't consume each other's numbers. */
export function derive(seed: number, ...salts: number[]): Rng {
  let h = seed >>> 0;
  for (const s of salts) {
    h = Math.imul(h ^ (s + 0x9e3779b9), 0x85ebca6b);
    h ^= h >>> 13;
  }
  return mulberry32(h);
}

/** Uniform in [-1, 1). */
export const spread = (rng: Rng): number => rng() * 2 - 1;
