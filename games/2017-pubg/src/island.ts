/**
 * island.ts — DUSTFALL ISLAND, the spatial truth (render-free).
 *
 * One island, ~1 km across, authored as named beats:
 *
 *   MILLTOWN     (-260,-180)  three cottages + a silo
 *   FORT RUST    ( 240,-220)  walled yard, two cottages
 *   CHAPEL HILL  (-180, 120)  the chapel on its rise
 *   DEPOT NINE   ( 300,  60)  three long barns
 *   THE SILOS    (  40, 260)  three silos + a cottage
 *   BEACON POINT (-320, 260)  cottage + beacon tower
 *   THE WHEAT    ( 120,  60)  pale wheat field — the final circle's home
 *   CROSSROADS   (   0,   0)  mid-island, where the buggy sits
 *
 * heightAt() is THE height truth (renderer bakes it, physics reads it).
 * surfaceAt() classifies the ground for footstep audio + prone cover.
 */
import { fbm } from "@tenyears/core";

export const ISLAND_R = 500;          // playable radius
export const WORLD_SIZE = 1100;       // terrain mesh extent

export interface Compound {
  name: string;
  x: number;
  z: number;
  r: number;              // flat pad radius
}

export const COMPOUNDS: Compound[] = [
  { name: "MILLTOWN", x: -260, z: -180, r: 46 },
  { name: "FORT RUST", x: 240, z: -220, r: 44 },
  { name: "CHAPEL HILL", x: -180, z: 120, r: 40 },
  { name: "DEPOT NINE", x: 300, z: 60, r: 46 },
  { name: "THE SILOS", x: 40, z: 260, r: 42 },
  { name: "BEACON POINT", x: -320, z: 260, r: 40 },
];

export const WHEAT = { x: 120, z: 60, hw: 75, hh: 55 }; // half-widths
export const CROSSROADS = { x: 0, z: 0 };

function sstep(a: number, b: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

/* ---------------------------------------------------------- heightfield -- */

/** The one height truth. Gentle rolls, flattened pads, beach dip offshore. */
export function heightAt(x: number, z: number): number {
  const d = Math.hypot(x, z);
  // rolling hills, calmer mid-island
  let h = fbm(x * 0.004 + 7.3, z * 0.004 - 2.1, 4) * 14 - 5;
  h += fbm(x * 0.017 - 4.4, z * 0.017 + 9.2, 3) * 2.2 - 1.1;
  // chapel rise
  h += 5.5 * (1 - sstep(0, 90, Math.hypot(x - (-180), z - 120)));
  // flatten compound pads
  for (const c of COMPOUNDS) {
    const cd = Math.hypot(x - c.x, z - c.z);
    const m = 1 - sstep(c.r * 0.6, c.r * 1.4, cd);
    h = h * (1 - m) + 1.2 * m;
  }
  // wheat field: nearly flat
  const wm =
    (1 - sstep(WHEAT.hw * 0.7, WHEAT.hw * 1.3, Math.abs(x - WHEAT.x))) *
    (1 - sstep(WHEAT.hh * 0.7, WHEAT.hh * 1.3, Math.abs(z - WHEAT.z)));
  h = h * (1 - wm) + 0.8 * wm;
  // beach: fall away past the island rim
  const shore = sstep(ISLAND_R - 60, ISLAND_R + 30, d);
  h = h * (1 - shore) + (-6) * shore;
  return h;
}

export type Surface = "wheat" | "grass" | "dirt" | "sand" | "water";

/** Ground cover classification — footsteps, prone cover, terrain tint. */
export function surfaceAt(x: number, z: number): Surface {
  const d = Math.hypot(x, z);
  if (heightAt(x, z) < -1.2) return "water";
  if (d > ISLAND_R - 45) return "sand";
  for (const c of COMPOUNDS) {
    if (Math.hypot(x - c.x, z - c.z) < c.r) return "dirt";
  }
  if (Math.abs(x - WHEAT.x) < WHEAT.hw && Math.abs(z - WHEAT.z) < WHEAT.hh) return "wheat";
  return "grass";
}

/** In deep wheat or not (prone concealment rule). */
export function inWheat(x: number, z: number): boolean {
  return (
    Math.abs(x - WHEAT.x) < WHEAT.hw * 0.9 && Math.abs(z - WHEAT.z) < WHEAT.hh * 0.9
  );
}

/** Nearest compound (for spawn/loot/AI queries). */
export function nearestCompound(x: number, z: number): Compound {
  let best = COMPOUNDS[0];
  let bd = Infinity;
  for (const c of COMPOUNDS) {
    const d = Math.hypot(x - c.x, z - c.z);
    if (d < bd) {
      bd = d;
      best = c;
    }
  }
  return best;
}
