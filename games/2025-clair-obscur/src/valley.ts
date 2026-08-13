/**
 * valley.ts — the painted valley beneath the Number (render-free).
 *
 *   EXPEDITION START (0,0)        the path begins, petals already falling
 *   PICTO ONE        (7,-28)      a stat sticker off the path's edge
 *   FIGHT ONE        (0,-46)      2 brushlings — the hybrid lesson
 *   PICTO TWO        (-8,-66)     the second sticker
 *   FIGHT TWO        (0,-80)      the shielded mime — gradient/break
 *   EXPEDITION FLAG  (0,-100)     checkpoint + heal
 *   THE GILT ARENA   (0,-136)     the Curator's Marionette, framed
 *   THE GREAT FRAME  (0,-158)     a vast gilt frame the sky hangs in
 *
 * heightAt() is THE height truth: painted bumps, flat fight floors, rim
 * walls. inBounds(): the spine corridor + the arena circle.
 */
import { fbm } from "@tenyears/core";

export const WORLD = 280;
export const START = { x: 0, z: 0 };
export const PICTO1 = { x: 7, z: -28, id: "pictoHp" };
export const PICTO2 = { x: -8, z: -66, id: "pictoDmg" };
export const FIGHT1 = { x: 0, z: -46, trigger: -36 };
export const FIGHT2 = { x: 0, z: -80, trigger: -70 };
export const FLAG = { x: 0, z: -100 };
export const ARENA = { x: 0, z: -136, r: 16, trigger: -124 };
export const GREAT_FRAME = { x: 0, z: -158 };

export const BRUSHLINGS = [
  { x: -3.5, z: -49 },
  { x: 3.5, z: -50 },
];
export const MIME_AT = { x: 0, z: -83 };
export const MARIONETTE_AT = { x: 0, z: -141 };

function sstep(a: number, b: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

/** The one height truth: painted bumps, flat fight floors, rim walls. */
export function heightAt(x: number, z: number): number {
  let h = fbm(x * 0.018 + 5.2, z * 0.018 + 2.9, 3) * 3.6 - 1.2;
  const spine = sstep(24, 10, Math.abs(x));
  h *= 1 - spine * 0.72;
  // fight floors stay flat
  for (const f of [FIGHT1, FIGHT2]) {
    const d = Math.hypot(x - f.x, z - f.z);
    const flat = 1 - sstep(9, 16, d);
    h = h * (1 - flat) + 0 * flat;
  }
  const da = Math.hypot(x - ARENA.x, z - ARENA.z);
  const flatA = 1 - sstep(ARENA.r * 0.85, ARENA.r * 1.6, da);
  h = h * (1 - flatA) + (-0.4) * flatA;
  // world rims
  h += sstep(44, 90, Math.abs(x)) * 26;
  h += sstep(16, 44, z) * 18;
  h += sstep(-178, -220, z) * 30;
  return h;
}

/** walkable bounds: the spine + fight floors + the arena */
export function inBounds(x: number, z: number): boolean {
  if (z > 12 || z < -172) return false;
  const inSpine = Math.abs(x) < 14 && z > -126;
  const inF1 = Math.hypot(x - FIGHT1.x, z - FIGHT1.z) < 12;
  const inF2 = Math.hypot(x - FIGHT2.x, z - FIGHT2.z) < 12;
  const inArena = Math.hypot(x - ARENA.x, z - ARENA.z) < ARENA.r + 1.5;
  return inSpine || inF1 || inF2 || inArena;
}
