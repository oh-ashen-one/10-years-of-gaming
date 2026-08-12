/**
 * map.ts — the island, authored as named beats (render-free).
 *
 *   TILTED       (-90,-70)   five chunky cartoon towers — the hot drop
 *   THE FARM     (170,110)   barn, silo, crop rows
 *   HERO HILL    ( 30,210)   the rise where the final circle lands
 *   WATER TOWER  (-135,-15)  the leaning tower, our skyline mascot
 *   BUS ROUTE    SW→NE       the balloon bus crosses the whole island
 *
 * heightAt() is THE height truth (renderer bakes it, physics reads it).
 * Grid constants for the build system live here too — one truth.
 */
import { fbm } from "@tenyears/core";

export const ISLAND_R = 290;
export const WORLD_SIZE = 680;

export const TILTED = { x: -90, z: -70, r: 58 };
export const FARM = { x: 170, z: 110, r: 52 };
export const HILL = { x: 30, z: 210, r: 26 };
export const TOWER = { x: -135, z: -15 };

/** Build grid: 4 m cells, 3 m story height, 3 levels max. */
export const CELL = 4;
export const STORY = 3;
export const MAX_LEVEL = 2;

function sstep(a: number, b: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

/** The one height truth. Toy hills, flat town/farm pads, hero rise. */
export function heightAt(x: number, z: number): number {
  const d = Math.hypot(x, z);
  let h = fbm(x * 0.006 + 3.1, z * 0.006 - 8.4, 4) * 11 - 4;
  h += fbm(x * 0.02 - 1.7, z * 0.02 + 5.9, 3) * 1.6 - 0.8;
  // hero hill: the final-circle rise
  h += 11 * (1 - sstep(0, 80, Math.hypot(x - HILL.x, z - HILL.z)));
  // flat pads
  for (const p of [TILTED, FARM]) {
    const m = 1 - sstep(p.r * 0.6, p.r * 1.4, Math.hypot(x - p.x, z - p.z));
    h = h * (1 - m) + 1.0 * m;
  }
  // beach falloff into the sea
  const shore = sstep(ISLAND_R - 40, ISLAND_R + 25, d);
  h = h * (1 - shore) + (-5) * shore;
  return h;
}

export type Surface = "grass" | "dirt" | "road" | "sand" | "water";

export function surfaceAt(x: number, z: number): Surface {
  if (heightAt(x, z) < -0.8) return "water";
  if (Math.hypot(x, z) > ISLAND_R - 30) return "sand";
  // the town streets: a cross through TILTED
  if (
    (Math.abs(x - TILTED.x) < 7 && Math.abs(z - TILTED.z) < TILTED.r) ||
    (Math.abs(z - TILTED.z) < 7 && Math.abs(x - TILTED.x) < TILTED.r)
  ) {
    return "road";
  }
  if (Math.hypot(x - TILTED.x, z - TILTED.z) < TILTED.r) return "dirt";
  if (Math.hypot(x - FARM.x, z - FARM.z) < FARM.r) return "dirt";
  return "grass";
}

/* ------------------------------------------------ authored props (truth) -- */

export interface TowerDef { x: number; z: number; w: number; d: number; h: number; c: number }
export interface PropDef { x: number; z: number; rot: number; s: number }

import { hash1 } from "@tenyears/core";

/** TILTED-lite: five chunky cartoon towers on the street cross. */
export const TILTED_BUILDINGS: TowerDef[] = [
  { x: TILTED.x - 16, z: TILTED.z - 16, w: 10, d: 10, h: 16, c: 0x5a8ae0 },
  { x: TILTED.x + 16, z: TILTED.z - 14, w: 9, d: 9, h: 12, c: 0xff8ac8 },
  { x: TILTED.x - 15, z: TILTED.z + 15, w: 11, d: 9, h: 20, c: 0xf0ece0 },
  { x: TILTED.x + 15, z: TILTED.z + 16, w: 9, d: 11, h: 10, c: 0x68d0b8 },
  { x: TILTED.x, z: TILTED.z - 24, w: 8, d: 8, h: 14, c: 0xffb85a },
];

/** Harvestable trees (wood), deterministic scatter clear of the beats. */
export const TREES: PropDef[] = (() => {
  const out: PropDef[] = [];
  for (let i = 0; i < 40 && out.length < 26; i++) {
    const a = hash1(i * 3.71) * Math.PI * 2;
    const r = 50 + hash1(i * 7.13) * 220;
    const x = Math.cos(a) * r;
    const z = Math.sin(a) * r;
    if (Math.hypot(x - TILTED.x, z - TILTED.z) < TILTED.r) continue;
    if (Math.hypot(x - FARM.x, z - FARM.z) < FARM.r * 0.7) continue;
    if (Math.hypot(x, z) > ISLAND_R - 35) continue;
    out.push({ x, z, rot: hash1(i * 11.3) * Math.PI, s: 0.85 + hash1(i * 5.7) * 0.5 });
  }
  return out;
})();

/** Cars (metal): parked along the town road and the farm lane. */
export const CARS: (PropDef & { c: number })[] = [
  { x: TILTED.x + 3, z: TILTED.z + 26, rot: 0.2, s: 1, c: 0x68d0f0 },
  { x: TILTED.x - 4, z: TILTED.z - 30, rot: -0.15, s: 1, c: 0xff8a5a },
  { x: TILTED.x + 30, z: TILTED.z - 2, rot: Math.PI / 2 + 0.1, s: 1, c: 0xf0e85a },
  { x: FARM.x - 18, z: FARM.z + 20, rot: 0.8, s: 1, c: 0xe04a3a },
  { x: 30, z: 20, rot: -0.6, s: 1, c: 0x68d0b8 },
];

/** Chests (glow + jingle): two in town, one barn, one tower top, one hill. */
export const CHESTS: PropDef[] = [
  { x: TILTED.x - 16, z: TILTED.z - 10, rot: 0, s: 1 },   // blue tower base
  { x: TILTED.x + 16, z: TILTED.z + 9, rot: 1.2, s: 1 },  // teal tower base
  { x: FARM.x + 8, z: FARM.z - 6, rot: 0.4, s: 1 },       // the barn
  { x: TOWER.x + 4, z: TOWER.z + 3, rot: 0, s: 1 },       // water tower foot
  { x: HILL.x - 3, z: HILL.z + 2, rot: 2.2, s: 1 },       // hero hill
  { x: 60, z: -140, rot: 0, s: 1 },                       // lonely grove
];

/** Farm crop rows (visual, wheat-ish toy corn). */
export const CROP_ROWS = { x: FARM.x - 14, z: FARM.z + 8, rows: 5, len: 34 };
