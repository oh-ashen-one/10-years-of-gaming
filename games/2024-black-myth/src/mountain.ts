/**
 * mountain.ts — the ink-wash peak above the cloud sea (render-free).
 *
 *   INCENSE SHRINE   (0,0)         spawn + checkpoint + gourd refill
 *   BAMBOO COURT     (0,-45)       3 lesser yaoguai teach the staff
 *   RED GATE PATH    z -20 → -100  lacquer beam frames over the stone
 *   GATE SHRINE      (3,-95)       last rest before the curtain
 *   FOG CURTAIN      (0,-108)      the white wall
 *   THE ABBOT'S COURT (0,-132)     red-pillar ring, the Tiger Abbot
 *   THE HALL         (0,-158)      roof silhouette behind the arena
 *
 * heightAt() is THE height truth: soft mountain bumps, courts and the
 * path flattened walkable, rims rising to wall the world. inBounds() is
 * the corridor + the two courts.
 */
import { fbm } from "@tenyears/core";

export const WORLD = 260;
export const SHRINE_START = { x: 0, z: 0 };
export const SHRINE_GATE = { x: 3, z: -95 };
export const COURT = { x: 0, z: -45, r: 16 };
export const FOG_GATE = { x: 0, z: -108, w: 10 };
export const ARENA = { x: 0, z: -132, r: 17 };
export const HALL = { x: 0, z: -158 };

export const LESSERS: { x: number; z: number }[] = [
  { x: -6, z: -41 },
  { x: 5, z: -47 },
  { x: -1, z: -53 },
];

function sstep(a: number, b: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

/** The one height truth: bumps, flat courts, the path corridor, rim walls. */
export function heightAt(x: number, z: number): number {
  let h = fbm(x * 0.02 + 3.1, z * 0.02 + 7.7, 3) * 3.4 - 1.2;
  // the walkable spine stays gentle
  const spine = sstep(26, 10, Math.abs(x));
  h *= 1 - spine * 0.72;
  // bamboo court: flat
  const dc = Math.hypot(x - COURT.x, z - COURT.z);
  const flatCourt = 1 - sstep(COURT.r * 0.8, COURT.r * 1.5, dc);
  h = h * (1 - flatCourt) + 0 * flatCourt;
  // the abbot's court: flat
  const da = Math.hypot(x - ARENA.x, z - ARENA.z);
  const flatArena = 1 - sstep(ARENA.r * 0.85, ARENA.r * 1.6, da);
  h = h * (1 - flatArena) + (-0.5) * flatArena;
  // world rims
  h += sstep(46, 90, Math.abs(x)) * 24;   // east/west walls
  h += sstep(14, 40, z) * 16;             // behind the first shrine
  h += sstep(-172, -210, z) * 28;         // beyond the hall
  return h;
}

/** walkable bounds: the spine corridor + both courts */
export function inBounds(x: number, z: number): boolean {
  if (z > 10 || z < -168) return false;
  const inSpine = Math.abs(x) < 15 && z > -120;
  const inCourt = Math.hypot(x - COURT.x, z - COURT.z) < COURT.r;
  const inArena = Math.hypot(x - ARENA.x, z - ARENA.z) < ARENA.r + 1.5;
  return inSpine || inCourt || inArena;
}

/** the boss never leaves his court */
export function inArena(x: number, z: number): boolean {
  return Math.hypot(x - ARENA.x, z - ARENA.z) < ARENA.r;
}

/** through the fog curtain? */
export function pastGate(z: number): boolean {
  return z < FOG_GATE.z;
}
