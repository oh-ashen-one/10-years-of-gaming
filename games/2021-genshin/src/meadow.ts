/**
 * meadow.ts — the valley, authored as named beats (render-free).
 *
 *   SPAWN MEADOW   (0,0)        wind-waved grass, butterflies
 *   MOSSLUNK CAMP  (-80,-60)    four mobs around a fire
 *   THE MARKED CLIFF (60,120)   the gold-striped climb face
 *   THE GLIDE      cliff → arena  updraft rings across the valley
 *   RUIN ARENA     (-40,230)    pillar ring — the Warden's floor
 *
 * heightAt() is THE height truth (renderer bakes it, physics reads it).
 * The climb wall is a marked band on the cliff face; updraft rings are
 * explicit data (position + radius) consumed by glide physics AND the
 * ring meshes.
 */
import { fbm } from "@tenyears/core";

export const WORLD = 520;
export const CAMP = { x: -80, z: -60, r: 18 };
export const CLIFF = { x: 60, z: 120, w: 46, h: 17 }; // face toward -z
export const ARENA = { x: -40, z: 230, r: 30 };
export const SPAWN = { x: 0, z: 0 };

/** updraft rings: glide through one for height + stamina */
export const RINGS: { x: number; y: number; z: number; r: number }[] = [
  { x: 30, y: 16, z: 155, r: 5 },
  { x: -5, y: 18, z: 185, r: 5 },
  { x: -30, y: 16, z: 210, r: 5 },
];

function sstep(a: number, b: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

/** The one height truth. */
export function heightAt(x: number, z: number): number {
  // rolling meadow
  let h = fbm(x * 0.008 + 5.1, z * 0.008 - 3.3, 4) * 9 - 3.5;
  // the valley dips south toward the arena
  h -= sstep(60, 220, z) * 4;
  // the cliff: a steep-sided block rising to a plateau
  const cd = Math.max(Math.abs(x - CLIFF.x) - CLIFF.w / 2, 0);
  const cliffSide = z > CLIFF.z - 4 && z < CLIFF.z + 26 ? 1 - sstep(0, 14, cd) : 0;
  const plateau = z >= CLIFF.z + 2 && z < CLIFF.z + 26 && cd < 1 ? 1 : cliffSide;
  h = h * (1 - plateau) + (h + CLIFF.h) * plateau;
  // arena: flat packed floor with a raised rim
  const ad = Math.hypot(x - ARENA.x, z - ARENA.z);
  const flat = 1 - sstep(ARENA.r * 0.8, ARENA.r * 1.5, ad);
  h = h * (1 - flat) + (-4) * flat;
  return h;
}

/** on the climbable marked face of the cliff? */
export function onClimbWall(x: number, z: number): boolean {
  return (
    Math.abs(x - CLIFF.x) < CLIFF.w / 2 + 1 &&
    z > CLIFF.z - 6 && z < CLIFF.z + 2
  );
}

/** inside the boss arena bowl? */
export function inArena(x: number, z: number): boolean {
  return Math.hypot(x - ARENA.x, z - ARENA.z) < ARENA.r;
}

/** world bounds clamp */
export function inBounds(x: number, z: number): boolean {
  return Math.abs(x) < WORLD / 2 - 8 && Math.abs(z) < WORLD / 2 - 8;
}
