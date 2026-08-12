/**
 * noise.ts — deterministic value noise + fbm, in two matched flavours.
 *
 *  - CPU (TypeScript): the one-spatial-truth workhorse. Terrain, spawn
 *    directors and silhouette shapes all sample these on the main thread so
 *    the renderer and the physics agree bit-for-bit (bake, never
 *    displace-in-shader).
 *  - GPU (NOISE_GLSL): the same value-noise family as an injectable chunk
 *    for animated surface detail (cloud churn, glitter, dust) where exact
 *    CPU parity is not required.
 *
 * Everything is deterministic — no Math.random anywhere in world building.
 */

/* ------------------------------------------------------------------ CPU -- */

function hash2(x: number, y: number): number {
  const h = Math.sin(x * 127.1 + y * 311.7) * 43758.5453123;
  return h - Math.floor(h);
}

function smooth(t: number): number {
  return t * t * (3 - 2 * t);
}

/** 2D value noise, range ~[0,1]. */
export function vnoise(x: number, y: number): number {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;
  const a = hash2(xi, yi);
  const b = hash2(xi + 1, yi);
  const c = hash2(xi, yi + 1);
  const d = hash2(xi + 1, yi + 1);
  const u = smooth(xf);
  const v = smooth(yf);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

/** Fractal brownian motion over value noise, range ~[0,1]. */
export function fbm(
  x: number,
  y: number,
  octaves = 4,
  lacunarity = 2.0,
  gain = 0.5,
): number {
  let amp = 0.5;
  let freq = 1;
  let sum = 0;
  let norm = 0;
  for (let i = 0; i < octaves; i++) {
    sum += amp * vnoise(x * freq, y * freq);
    norm += amp;
    amp *= gain;
    freq *= lacunarity;
  }
  return sum / norm;
}

/** Ridged variant — sharp crests for dunes, ridges, mountain silhouettes. */
export function ridged(x: number, y: number, octaves = 3): number {
  let amp = 0.5;
  let freq = 1;
  let sum = 0;
  let norm = 0;
  for (let i = 0; i < octaves; i++) {
    sum += amp * (1 - Math.abs(vnoise(x * freq, y * freq) * 2 - 1));
    norm += amp;
    amp *= 0.5;
    freq *= 2.1;
  }
  return sum / norm;
}

/** Deterministic 1D hash, range [0,1) — stable seeds for scatter placement. */
export function hash1(n: number): number {
  const s = Math.sin(n * 127.1) * 43758.5453123;
  return s - Math.floor(s);
}

/* ----------------------------------------------------------------- GLSL -- */

/**
 * Shared GLSL noise chunk — inject into any ShaderMaterial fragment shader.
 * Functions are prefixed `g_` to avoid colliding with shader-local names.
 */
export const NOISE_GLSL = /* glsl */ `
float g_hash21(vec2 p) {
  p = fract(p * vec2(127.1, 311.7));
  return fract(sin(dot(p, vec2(1.0, 1.0))) * 43758.5453123);
}
float g_vnoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  float a = g_hash21(i);
  float b = g_hash21(i + vec2(1.0, 0.0));
  float c = g_hash21(i + vec2(0.0, 1.0));
  float d = g_hash21(i + vec2(1.0, 1.0));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}
float g_fbm(vec2 p, int oct) {
  float amp = 0.5, freq = 1.0, sum = 0.0, norm = 0.0;
  for (int i = 0; i < 5; i++) {
    if (i >= oct) break;
    sum += amp * g_vnoise(p * freq);
    norm += amp;
    amp *= 0.5;
    freq *= 2.0;
  }
  return sum / norm;
}
`;
